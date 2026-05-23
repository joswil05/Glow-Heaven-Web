/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { db } from '../lib/firebase';
import { runTransaction, doc, collection } from 'firebase/firestore';
import { ERPOrder, ERPProduct, InventoryBatch } from '../types/erp';

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
        lotesActivos.sort((a, b) => new Date(a.fecha_ingreso).getTime() - new Date(b.fecha_ingreso).getTime());

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
        
        const updatePayload: any = {
          lotes: lotes, // Lotes actualizados con la deducción PEPS
          stock_disponible: Math.round((data.stock_disponible - cantidadVendida) * 100) / 100
        };

        // Si la orden viene de la Web, significa que el stock físico ya estaba marcado como "comprometido".
        // Al facturarlo y entregarlo, se debe limpiar ese stock comprometido.
        if (orderData.canal === 'web_whatsapp') {
          updatePayload.stock_comprometido = Math.max(0, Math.round((data.stock_comprometido - cantidadVendida) * 100) / 100);
        }

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
        const nuevoDisponible = Math.round((data.stock_disponible + cantidadDevuelta) * 100) / 100;

        transaction.update(ref, {
          stock_comprometido: nuevoComprometido,
          stock_disponible: nuevoDisponible
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
