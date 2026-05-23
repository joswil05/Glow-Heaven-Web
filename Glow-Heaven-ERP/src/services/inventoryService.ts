/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { db, storage } from '../lib/firebase';
import { 
  runTransaction, doc, collection, getDoc, setDoc, 
  writeBatch, query, where, getDocs 
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { ERPOrder, ERPProduct, InventoryBatch } from '../types/erp';

// Helper para parsear fechas de lotes de forma defensiva y evitar fallos en el sort
const getTime = (dateStr: any): number => {
  if (!dateStr) return 0;
  if (typeof dateStr.toDate === 'function') {
    return dateStr.toDate().getTime();
  }
  if (typeof dateStr === 'object' && typeof dateStr.seconds === 'number') {
    return dateStr.seconds * 1000;
  }
  const time = new Date(dateStr).getTime();
  return isNaN(time) ? 0 : time;
};

/**
 * Procesa una venta aplicando el algoritmo PEPS (Primeras Entradas, Primeras Salidas).
 * Utiliza una transacción atómica de Firestore para garantizar la consistencia en entornos concurrentes.
 * 
 * @param orderData Datos de la orden a procesar.
 * @returns Promesa que se resuelve cuando la transacción es exitosa.
 */
export const processPEPSSale = async (orderData: ERPOrder): Promise<void> => {
  try {
    await runTransaction(db, async (transaction) => {
      // ----------------------------------------------------------------------
      // FASE 1: LECTURAS (Firestore exige que todas las lecturas ocurran antes de las escrituras)
      // ----------------------------------------------------------------------
      
      // Mapeo temporal para almacenar la información de los productos leídos y su COGS calculado
      const productsData = new Map<string, { 
        docRef: any, 
        data: ERPProduct, 
        lotes: InventoryBatch[], 
        costoPEPSItem: number,
        lotesMutados: InventoryBatch[]
      }>();
      let costoPEPSTotalOrden = 0;

      // Medida Anti-Deadlock: Ordenar los artículos alfabéticamente por SKU.
      // Esto garantiza que todas las transacciones concurrentes bloqueen los documentos en el mismo orden.
      const sortedItems = [...orderData.items].sort((a, b) => a.sku.localeCompare(b.sku));

      for (const item of sortedItems) {
        // NOTA: El ID del documento en la colección 'productos' es el propio SKU.
        const productRef = doc(db, 'productos', item.sku);
        const productSnap = await transaction.get(productRef);

        if (!productSnap.exists()) {
          throw new Error(`Integridad fallida: El producto con SKU ${item.sku} no existe en la base de datos.`);
        }

        const productData = productSnap.data() as ERPProduct;
        
        // Accedemos al array de 'lotes' de ese producto.
        let lotesActivos = (productData as any).lotes as InventoryBatch[] || [];
        
        // Ordenamiento Cronológico (FIFO/PEPS): Del más antiguo al más nuevo por fecha_ingreso
        lotesActivos.sort((a, b) => getTime(a.fecha_ingreso) - getTime(b.fecha_ingreso));

        // Validar Stock Real Disponible
        if (productData.stock_disponible < item.cantidad) {
          throw new Error(`Stock insuficiente para ${productData.nombre}. Solicitado: ${item.cantidad}, Disponible: ${productData.stock_disponible}`);
        }

        // ----------------------------------------------------------------------
        // FASE 2: DEDUCCIÓN DE STOCK CRONOLÓGICA (ALGORITMO PEPS)
        // ----------------------------------------------------------------------
        let cantidadPendiente = item.cantidad;
        let costoPEPSAcumuladoItem = 0;
        const lotesMutados: InventoryBatch[] = [];

        for (let i = 0; i < lotesActivos.length && cantidadPendiente > 0; i++) {
          const lote = lotesActivos[i];
          if (lote.cantidad_restante <= 0) continue;

          if (lote.cantidad_restante >= cantidadPendiente) {
            // El lote actual puede cubrir toda la demanda restante
            lote.cantidad_restante = Math.round((lote.cantidad_restante - cantidadPendiente) * 100) / 100;
            costoPEPSAcumuladoItem = Math.round((costoPEPSAcumuladoItem + (cantidadPendiente * lote.costo_adquisicion)) * 100) / 100;
            cantidadPendiente = 0;
          } else {
            // El lote actual NO puede cubrir toda la demanda, se consume entero
            cantidadPendiente = Math.round((cantidadPendiente - lote.cantidad_restante) * 100) / 100;
            costoPEPSAcumuladoItem = Math.round((costoPEPSAcumuladoItem + (lote.cantidad_restante * lote.costo_adquisicion)) * 100) / 100;
            lote.cantidad_restante = 0;
          }
          lotesMutados.push(lote);
        }

        // Medida de seguridad algorítmica: Si después de recorrer los lotes sigue habiendo cantidad pendiente,
        // significa que el array de lotes está desfasado respecto al 'stock_disponible' general.
        if (cantidadPendiente > 0) {
          throw new Error(`Inconsistencia contable en ${productData.nombre}: El stock general marca disponible pero no hay lotes físicos suficientes para respaldar el costo PEPS.`);
        }

        // Redondeo de flotantes en los montos de Córdobas (C$)
        costoPEPSTotalOrden = Math.round((costoPEPSTotalOrden + costoPEPSAcumuladoItem) * 100) / 100;
        item.costo_peps_calculado = costoPEPSAcumuladoItem; // Mutamos el item para guardar histórico

        productsData.set(item.sku, {
          docRef: productRef,
          data: productData,
          lotes: lotesActivos,
          costoPEPSItem: costoPEPSAcumuladoItem,
          lotesMutados
        });
      }

      // ----------------------------------------------------------------------
      // FASE 3: ESCRITURAS ATÓMICAS MULTI-COLECCIÓN
      // ----------------------------------------------------------------------

      // 3.1 Actualizar la colección 'productos' e 'inventario_lotes'
      productsData.forEach(({ docRef, data, lotes, costoPEPSItem, lotesMutados }, sku) => {
        const cantidadVendida = orderData.items.find(i => i.sku === sku)?.cantidad || 0;
        
        const nuevoDisponible = Math.round((data.stock_disponible - cantidadVendida) * 100) / 100;
        const updatePayload: any = {
          lotes: lotes, // Lotes actualizados con la deducción PEPS
          stock_disponible: nuevoDisponible
        };

        let nuevoComprometido = data.stock_comprometido || 0;
        if (orderData.canal === 'web_whatsapp') {
          nuevoComprometido = Math.max(0, Math.round((data.stock_comprometido - cantidadVendida) * 100) / 100);
          updatePayload.stock_comprometido = nuevoComprometido;
        }

        // Sincronizar el campo stock con la tienda web
        const currentStockWeb = typeof (data as any).stock === 'number' ? (data as any).stock : data.stock_disponible;
        const nuevoStock = orderData.canal === 'web_whatsapp'
          ? Math.max(0, nuevoDisponible - nuevoComprometido)
          : Math.max(0, currentStockWeb - cantidadVendida);

        updatePayload.stock = nuevoStock;

        transaction.update(docRef, updatePayload);

        // Sincronizar con la colección independiente 'inventario_lotes'
        lotesMutados.forEach(l => {
          const batchRef = doc(db, 'inventario_lotes', l.id_lote);
          transaction.update(batchRef, {
            cantidad_restante: l.cantidad_restante
          });
        });
      });

      // 3.2 Crear o actualizar la Orden en la colección 'pedidos'
      const utilidadNetaCalculada = Math.round((orderData.total_cs - costoPEPSTotalOrden) * 100) / 100;
      
      // Evitar duplicación de pedidos: si el pedido ya existe en Firebase (por ser una orden web),
      // actualizamos el documento original. Si es nuevo (mostrador), generamos un ID.
      const orderRef = orderData.id_orden 
        ? doc(db, 'pedidos', orderData.id_orden) 
        : doc(collection(db, 'pedidos'));
      
      const orderDocData = {
        ...orderData,
        id_orden: orderRef.id,
        // Si es canal web, pasa de "stock_comprometido" a "listo_despacho" al validar pago.
        // Si es físico de mostrador, se entrega de inmediato.
        estado: orderData.canal === 'web_whatsapp' ? 'listo_despacho' : 'entregado',
        costo_peps_total_cs: costoPEPSTotalOrden,
        utilidad_bruta_cs: utilidadNetaCalculada,
        fecha_procesamiento: new Date().toISOString()
      };
      
      transaction.set(orderRef, orderDocData);

      // 3.3 Insertar registro financiero (Solo si es venta inmediata y generó ingreso)
      if (orderDocData.estado !== 'pendiente_pago') {
        const transaccionRef = doc(collection(db, 'transacciones_financieras'));
        const transaccionData = {
          id_gasto: transaccionRef.id,
          tipo: 'ingreso_venta',
          referencia_orden: orderRef.id,
          fecha: new Date().toISOString(),
          monto_cs: orderDocData.total_cs,
          metodo_pago: orderDocData.metodo_pago,
          descripcion: orderDocData.canal === 'web_whatsapp' 
            ? `Pago de orden web validado (${orderDocData.items.length} ítems) - Pedido #${orderRef.id.slice(-6)}`
            : `Venta de mostrador (${orderDocData.items.length} ítems) - Ticket #${orderRef.id.slice(-6)}`,
          categoria: 'ventas_netas'
        };
        transaction.set(transaccionRef, transaccionData);
      }

    });

    console.log('[ERP] Transacción PEPS ejecutada exitosamente. Datos sincronizados.');

  } catch (error: any) {
    console.error('[ERP] Fallo Crítico en Transacción PEPS:', error.message);
    throw new Error(`No se pudo procesar la venta. ${error.message}`);
  }
};

/**
 * Cancela una orden web, retornando el stock_comprometido al stock_disponible.
 * Utiliza una transacción atómica para asegurar que el inventario no se corrompa.
 * 
 * @param orderId ID de la orden a cancelar
 */
export const cancelWebOrder = async (orderId: string): Promise<void> => {
  try {
    await runTransaction(db, async (transaction) => {
      // 1. Leer el pedido
      const orderRef = doc(db, 'pedidos', orderId);
      const orderSnap = await transaction.get(orderRef);

      if (!orderSnap.exists()) {
        throw new Error(`El pedido ${orderId} no existe.`);
      }

      const orderData = orderSnap.data() as ERPOrder;

      // Solo se pueden cancelar pedidos que aún estén reteniendo stock
      if (orderData.estado !== 'stock_comprometido' && orderData.estado !== 'pendiente_pago') {
        throw new Error(`No se puede cancelar un pedido en estado: ${orderData.estado}`);
      }

      // 2. Leer todos los productos involucrados (Fase de lectura)
      const productsData = new Map<string, { ref: any, data: ERPProduct }>();
      
      // Medida Anti-Deadlock: Ordenar los SKU al leer
      const sortedItems = [...orderData.items].sort((a, b) => a.sku.localeCompare(b.sku));

      for (const item of sortedItems) {
        const productRef = doc(db, 'productos', item.sku);
        const productSnap = await transaction.get(productRef);
        
        if (productSnap.exists()) {
          productsData.set(item.sku, {
            ref: productRef,
            data: productSnap.data() as ERPProduct
          });
        }
      }

      // 3. Fase de Escritura: Revertir stock y cancelar orden
      productsData.forEach(({ ref, data }, sku) => {
        const cantidadDevuelta = orderData.items.find(i => i.sku === sku)?.cantidad || 0;
        
        // Evitamos saldos negativos si la BD fue manipulada manualmente (y redondeamos)
        const nuevoComprometido = Math.max(0, Math.round((data.stock_comprometido - cantidadDevuelta) * 100) / 100);
        
        // El stock disponible no cambia, porque nunca se restó físicamente
        const nuevoDisponible = data.stock_disponible || 0;

        // Devolver el stock a la tienda web
        const currentStockWeb = typeof (data as any).stock === 'number' ? (data as any).stock : data.stock_disponible;
        const nuevoStock = Math.round((currentStockWeb + cantidadDevuelta) * 100) / 100;

        transaction.update(ref, {
          stock_comprometido: nuevoComprometido,
          stock_disponible: nuevoDisponible,
          stock: nuevoStock
        });
      });

      // Marcar orden como cancelada
      transaction.update(orderRef, {
        estado: 'cancelado',
        fecha_cancelacion: new Date().toISOString()
      });
    });

    console.log(`[ERP] Orden ${orderId} cancelada. Stock liberado exitosamente.`);

  } catch (error: any) {
    console.error(`[ERP] Error cancelando orden ${orderId}:`, error.message);
    throw new Error(`No se pudo cancelar el pedido. ${error.message}`);
  }
};

/**
 * Crea un nuevo producto en la colección 'productos' de Firestore.
 * Valida que el SKU no esté duplicado.
 * 
 * @param product Datos del producto a crear
 */
export const createProduct = async (product: ERPProduct): Promise<void> => {
  try {
    const productRef = doc(db, 'productos', product.sku);
    const productSnap = await getDoc(productRef);

    if (productSnap.exists()) {
      throw new Error(`Ya existe un producto con el SKU ${product.sku}.`);
    }

    await setDoc(productRef, {
      ...product,
      stock_disponible: 0,
      stock_comprometido: 0,
      stock: 0,
      activo: product.activo ?? true,
      lotes: []
    });
    console.log(`[ERP] Producto ${product.nombre} (SKU: ${product.sku}) creado exitosamente.`);
  } catch (error: any) {
    console.error('[ERP] Error creando producto:', error.message);
    throw new Error(`No se pudo crear el producto. ${error.message}`);
  }
};

/**
 * Inyecta un lote de inventario (reabastecimiento) a un producto existente.
 * Utiliza una transacción para actualizar el producto y la colección 'inventario_lotes' atómicamente.
 * 
 * @param sku SKU del producto
 * @param cantidad Cantidad de unidades entrantes
 * @param costoAdquisicion Costo unitario en Córdobas (C$)
 */
export const addInventoryBatch = async (sku: string, cantidad: number, costoAdquisicion: number): Promise<void> => {
  try {
    if (cantidad <= 0 || isNaN(cantidad) || !Number.isInteger(cantidad)) {
      throw new Error('La cantidad de reabastecimiento debe ser un número entero mayor a 0.');
    }
    if (costoAdquisicion <= 0 || isNaN(costoAdquisicion)) {
      throw new Error('El costo de adquisición debe ser mayor a 0.');
    }

    await runTransaction(db, async (transaction) => {
      const productRef = doc(db, 'productos', sku);
      const productSnap = await transaction.get(productRef);

      if (!productSnap.exists()) {
        throw new Error(`El producto con SKU ${sku} no existe.`);
      }

      const productData = productSnap.data() as ERPProduct;
      const batchRef = doc(collection(db, 'inventario_lotes')); // Auto-genera ID del lote

      const nuevoLote: InventoryBatch = {
        id_lote: batchRef.id,
        producto_id: sku,
        fecha_ingreso: new Date().toISOString(),
        costo_adquisicion: costoAdquisicion,
        cantidad_inicial: cantidad,
        cantidad_restante: cantidad
      };

      const lotesActuales = (productData as any).lotes as InventoryBatch[] || [];
      lotesActuales.push(nuevoLote);

      const nuevoDisponible = Math.round((productData.stock_disponible + cantidad) * 100) / 100;
      const comprom = productData.stock_comprometido || 0;
      const nuevoStock = Math.max(0, nuevoDisponible - comprom);

      // A) Actualizar el producto: inyectar el lote en su array y sumar al stock_disponible
      transaction.update(productRef, {
        lotes: lotesActuales,
        stock_disponible: nuevoDisponible,
        stock: nuevoStock
      });

      // B) Crear el espejo en la colección independiente 'inventario_lotes'
      transaction.set(batchRef, nuevoLote);
    });

    console.log(`[ERP] Lote de reabastecimiento añadido exitosamente para el producto ${sku}.`);
  } catch (error: any) {
    console.error('[ERP] Error en reabastecimiento de inventario:', error.message);
    throw new Error(`No se pudo añadir el lote de inventario. ${error.message}`);
  }
};

/**
 * Elimina un producto de Firestore y todos sus lotes asociados de forma atómica.
 * 
 * @param sku SKU del producto a eliminar
 */
export const deleteProduct = async (sku: string): Promise<void> => {
  try {
    const batch = writeBatch(db);
    
    // 1. Eliminar el documento del producto
    const productRef = doc(db, 'productos', sku);
    batch.delete(productRef);

    // 2. Buscar y eliminar todos los lotes de reabastecimiento asociados
    const lotesRef = collection(db, 'inventario_lotes');
    const q = query(lotesRef, where('producto_id', '==', sku));
    const querySnapshot = await getDocs(q);

    querySnapshot.forEach((doc) => {
      batch.delete(doc.ref);
    });

    // 3. Ejecutar el lote de escritura (atomic)
    await batch.commit();
    console.log(`[ERP] Producto ${sku} y sus lotes asociados eliminados exitosamente.`);
  } catch (error: any) {
    console.error(`[ERP] Error al eliminar producto ${sku}:`, error.message);
    throw new Error(`No se pudo eliminar el producto de la base de datos. ${error.message}`);
  }
};

/**
 * Sube una imagen local de la PC a Firebase Storage y devuelve su URL de descarga pública.
 * 
 * @param sku SKU del producto para nombrar el archivo
 * @param file Objeto File binario de la imagen
 * @returns Promesa con la URL de descarga de la imagen
 */
export const uploadProductImage = async (sku: string, file: File): Promise<string> => {
  if (!storage) {
    throw new Error('El servicio de almacenamiento de Firebase (Storage) no está inicializado.');
  }
  try {
    // Generar un nombre único con timestamp para evitar problemas de caché del navegador
    const fileName = `${sku}_${Date.now()}.png`;
    const storageRef = ref(storage, `productos/${fileName}`);
    
    // Subir el archivo
    await uploadBytes(storageRef, file);
    
    // Obtener la URL de descarga
    const downloadUrl = await getDownloadURL(storageRef);
    console.log(`[ERP] Imagen subida exitosamente para ${sku}. URL: ${downloadUrl}`);
    return downloadUrl;
  } catch (error: any) {
    console.error(`[ERP] Error subiendo imagen para ${sku}:`, error.message);
    throw new Error(`No se pudo subir la imagen. ${error.message}`);
  }
};
