/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { db } from '../lib/firebase';
import { 
  runTransaction, doc, collection, getDoc, setDoc, 
  writeBatch, query, where, getDocs, updateDoc
} from 'firebase/firestore';
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

        // Validar Stock Real en lotes
        const totalLotes = lotesActivos.reduce((acc, curr) => acc + (curr.cantidad_restante || 0), 0);
        if (totalLotes < item.cantidad) {
          throw new Error(`Stock insuficiente en lotes para ${productData.nombre}. Solicitado: ${item.cantidad}, Disponible en lotes: ${totalLotes}`);
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

        // Medida de seguridad algorítmica
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
        
        const isSocialMedia = orderData.envio.canal === 'whatsapp' || orderData.envio.canal === 'instagram';
        
        const nuevoDisponible = isSocialMedia 
          ? data.stock_disponible 
          : Math.round((data.stock_disponible - cantidadVendida) * 100) / 100;
          
        const nuevoComprometido = Math.max(0, Math.round(((data.stock_comprometido || 0) - cantidadVendida) * 100) / 100);
        
        const updatePayload: any = {
          lotes: lotes, // Lotes actualizados con la deducción PEPS
          stock_disponible: nuevoDisponible,
          stock_comprometido: nuevoComprometido
        };

        // Sincronizar el campo stock con la tienda web
        const nuevoStock = Math.max(0, Math.round((nuevoDisponible - nuevoComprometido) * 100) / 100);
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
      
      const orderRef = orderData.id_orden 
        ? doc(db, 'pedidos', orderData.id_orden) 
        : doc(collection(db, 'pedidos'));
      
      const orderDocData = {
        ...orderData,
        id_orden: orderRef.id,
        // Si es canal web o redes sociales, pasa a listo_despacho al validar pago.
        // Si es mostrador, se entrega inmediatamente.
        estado: orderData.envio.canal === 'mostrador_fisico' ? 'entregado' : 'listo_despacho',
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
          descripcion: orderDocData.envio.canal === 'web_whatsapp' 
            ? `Pago de orden web validado (${orderDocData.items.length} ítems) - Pedido #${orderRef.id.slice(-6)}`
            : `Venta digital validada (${orderDocData.items.length} ítems) - Pedido #${orderRef.id.slice(-6)}`,
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
  if (!orderId) {
    throw new Error("El ID de la orden no puede estar vacío.");
  }
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
      const orderEstado = String(orderData.estado || '').toLowerCase();
      if (orderEstado !== 'stock_comprometido' && orderEstado !== 'pendiente_pago' && orderEstado !== 'pendiente de pago') {
        throw new Error(`No se puede cancelar un pedido en estado: ${orderData.estado}`);
      }

      // Sanitizar/Unificar items defensivamente para evitar SKU undefined o vacío
      const items = Array.isArray(orderData.items) ? orderData.items : [];
      const unifiedItems = items.map((it: any) => {
        const skuStr = String(it.sku || it.producto_id || '').trim();
        return {
          sku: skuStr,
          cantidad: Number(it.cantidad) || 0
        };
      }).filter(it => it.sku !== '');

      // 2. Leer todos los productos involucrados (Fase de lectura)
      const productsData = new Map<string, { ref: any, data: ERPProduct }>();
      
      // Medida Anti-Deadlock: Ordenar los SKU al leer
      const sortedItems = [...unifiedItems].sort((a, b) => a.sku.localeCompare(b.sku));

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
        const itemMatch = unifiedItems.find(i => i.sku === sku);
        const cantidadDevuelta = itemMatch ? itemMatch.cantidad : 0;

        const nuevoDisponible = Math.round(((data.stock_disponible || 0) + cantidadDevuelta) * 100) / 100;
        const nuevoComprometido = Math.max(0, Math.round(((data.stock_comprometido || 0) - cantidadDevuelta) * 100) / 100);

        // Devolver el stock a la tienda web
        const nuevoStock = Math.max(0, Math.round((nuevoDisponible - nuevoComprometido) * 100) / 100);

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
 * @param idOrSku ID o SKU del producto a eliminar
 */
export const deleteProduct = async (idOrSku: string): Promise<void> => {
  if (!idOrSku) {
    throw new Error("El identificador del producto (ID/SKU) es nulo o indefinido.");
  }
  try {
    const batch = writeBatch(db);
    
    // 1. Eliminar el documento del producto
    const productRef = doc(db, 'productos', idOrSku);
    batch.delete(productRef);

    // 2. Buscar y eliminar todos los lotes de reabastecimiento asociados
    const lotesRef = collection(db, 'inventario_lotes');
    const q = query(lotesRef, where('producto_id', '==', idOrSku));
    const querySnapshot = await getDocs(q);

    querySnapshot.forEach((doc) => {
      batch.delete(doc.ref);
    });

    // 3. Ejecutar el lote de escritura (atomic)
    await batch.commit();
    console.log(`[ERP] Producto ${idOrSku} y sus lotes asociados eliminados exitosamente.`);
  } catch (error: any) {
    console.error(`[ERP] Error al eliminar producto ${idOrSku}:`, error.message);
    throw new Error(`No se pudo eliminar el producto de la base de datos. ${error.message}`);
  }
};

/**
 * Convierte una imagen local de la PC a un Data URL base64 comprimido.
 * Redimensiona la imagen a un máximo de 800px para mantener los documentos de Firestore ligeros.
 * NO requiere Firebase Storage (plan Blaze/pago).
 * 
 * @param _sku SKU del producto (para logging)
 * @param file Objeto File binario de la imagen
 * @returns Promesa con el Data URL base64 de la imagen
 */
export const uploadProductImage = async (_sku: string, file: File): Promise<string> => {
  const MAX_DIMENSION = 800;
  const QUALITY = 0.75; // 75% JPEG quality — buen balance peso/calidad

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('No se pudo leer el archivo de imagen.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('El archivo seleccionado no es una imagen válida.'));
      img.onload = () => {
        try {
          // Calcular dimensiones proporcionales
          let { width, height } = img;
          if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
            const ratio = Math.min(MAX_DIMENSION / width, MAX_DIMENSION / height);
            width = Math.round(width * ratio);
            height = Math.round(height * ratio);
          }

          // Dibujar en canvas y exportar como JPEG comprimido
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('No se pudo crear el contexto de renderizado del canvas.'));
            return;
          }
          ctx.drawImage(img, 0, 0, width, height);

          const dataUrl = canvas.toDataURL('image/jpeg', QUALITY);
          console.log(`[ERP] Imagen convertida a base64 para ${_sku}. Tamaño: ${Math.round(dataUrl.length / 1024)}KB`);
          resolve(dataUrl);
        } catch (err: any) {
          reject(new Error(`Error procesando la imagen: ${err.message}`));
        }
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
};

/**
 * Actualiza las propiedades de un producto existente en Firestore.
 * 
 * @param sku SKU del producto a editar
 * @param productData Campos a actualizar
 */
export const updateProduct = async (sku: string, productData: Partial<ERPProduct>): Promise<void> => {
  try {
    const productRef = doc(db, 'productos', sku);
    await updateDoc(productRef, productData);
    console.log(`[ERP] Producto ${sku} actualizado exitosamente.`);
  } catch (error: any) {
    console.error('[ERP] Error actualizando producto:', error.message);
    throw new Error(`No se pudo actualizar el producto. ${error.message}`);
  }
};
