/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { ERPOrder, ERPProduct } from '../types/erp';
import { db } from '../lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { 
  Package, Truck, CheckCircle2, Copy, Check, MessageSquare, 
  MapPin, User, Phone, FileText, ExternalLink, Calendar, HelpCircle
} from 'lucide-react';

interface PhysicalFulfillmentProps {
  orders: ERPOrder[];
  products: ERPProduct[];
}

export const PhysicalFulfillment: React.FC<PhysicalFulfillmentProps> = ({
  orders,
  products
}) => {
  const [copiedOrderId, setCopiedOrderId] = useState<string | null>(null);
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Auto-dismiss notifications
  useEffect(() => {
    if (notification) {
      const t = setTimeout(() => setNotification(null), 4000);
      return () => clearTimeout(t);
    }
  }, [notification]);

  // --- Real-time filtered queues ---
  const colaEmpaque = useMemo(() => {
    return orders.filter(o => o && o.estado === 'listo_despacho');
  }, [orders]);

  const colaCamino = useMemo(() => {
    return orders.filter(o => o && o.estado === 'en_camino');
  }, [orders]);

  // Helper to find technical product specifications from the catalogue
  const getProductSpecs = (sku: string) => {
    const prod = products.find(p => p.sku === sku);
    if (!prod) return null;
    return {
      categoria: prod.categoria,
      mililitros: prod.mililitros,
      concentracion: prod.concentracion,
      material: prod.material,
      color_banio: prod.color_banio
    };
  };

  // State transitions in the database
  const handleTransitionState = async (orderId: string, nextState: 'en_camino' | 'entregado') => {
    setUpdatingOrderId(orderId);
    try {
      const orderRef = doc(db, 'pedidos', orderId);
      await updateDoc(orderRef, {
        estado: nextState,
        [`fecha_${nextState === 'en_camino' ? 'despacho' : 'entrega'}`]: new Date().toISOString()
      });
      setNotification({
        message: nextState === 'en_camino' 
          ? `Pedido #${orderId.slice(-6)} despachado con éxito. En camino.` 
          : `¡Entrega confirmada para el pedido #${orderId.slice(-6)}!`,
        type: 'success'
      });
    } catch (err: any) {
      console.error(err);
      setNotification({
        message: `Error al actualizar el estado logístico: ${err.message}`,
        type: 'error'
      });
    } finally {
      setUpdatingOrderId(null);
    }
  };

  // Copy template data to motorizado driver clipboard
  const handleCopyMotorizado = (order: ERPOrder) => {
    const nombre = order.cliente?.nombre || 'Cliente';
    const telefono = order.cliente?.telefono || 'N/A';
    const direccion = order.envio?.direccion || 'N/A';
    const canal = order.envio?.canal === 'web_whatsapp' ? 'Web' : order.envio?.canal === 'instagram' ? 'Instagram' : 'WhatsApp';
    const itemsText = (order.items || []).map(it => `• ${it.cantidad}x ${it.nombre} (${it.sku})`).join('\n');
    const total = order.total_cs;
    const metodo = order.metodo_pago === 'efectivo' ? 'EFECTIVO (COBRAR AL ENTREGAR)' : 'TRANSFERENCIA (YA PAGADO)';

    const message = `🚚 *GLOW HEAVEN - ORDEN DE MOTORIZADO* 🚚\n\n` +
      `👤 *Cliente:* ${nombre}\n` +
      `📞 *Teléfono:* ${telefono}\n` +
      `📍 *Dirección de Destino:* ${direccion}\n\n` +
      `📦 *Items a Entregar:*\n${itemsText}\n\n` +
      `💰 *Total a Cobrar:* C$ ${total.toLocaleString('es-NI')}\n` +
      `💳 *Forma de Pago:* *${metodo}*\n\n` +
      `🚦 *Origen:* Venta ${canal} • #${order.id_orden.slice(-6)}`;

    navigator.clipboard.writeText(message);
    setCopiedOrderId(order.id_orden);
    setTimeout(() => setCopiedOrderId(null), 2000);
  };

  return (
    <div className="flex-1 p-4 h-full flex flex-col min-h-0 relative bg-neutral-50 dark:bg-neutral-950">
      {/* Visual Toast Feedback */}
      {notification && (
        <div className={`fixed bottom-4 right-4 z-50 p-4 rounded-xl shadow-lg border text-sm flex items-center gap-2 animate-in fade-in slide-in-from-bottom-5 duration-300 ${
          notification.type === 'success' 
            ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-850 text-emerald-800 dark:text-emerald-400' 
            : 'bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-850 text-rose-800 dark:text-rose-400'
        }`}>
          {notification.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-555" /> : <Package className="w-4 h-4 text-rose-500" />}
          <span>{notification.message}</span>
          <button onClick={() => setNotification(null)} className="ml-2 font-mono text-xs hover:opacity-75 font-bold">×</button>
        </div>
      )}

      {/* HEADER */}
      <header className="flex justify-between items-center mb-4 px-2 shrink-0">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Truck className="w-6 h-6 text-emerald-600 dark:text-emerald-500" /> Control de Fulfillment Logístico
          </h1>
          <p className="text-xs text-neutral-500 font-mono">Terminal ERP Glow Heaven | Gestión Física de Despacho (F5)</p>
        </div>
        <div className="flex gap-4 text-[10px] font-mono text-neutral-500 uppercase tracking-widest bg-white dark:bg-neutral-900 px-4 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 shadow-sm">
          <span>Cola Empaque: <strong className="text-amber-600 font-bold">{colaEmpaque.length}</strong></span>
          <span>En Camino: <strong className="text-indigo-650 font-bold">{colaCamino.length}</strong></span>
        </div>
      </header>

      {/* CORE QUEUE GRIDS */}
      <div className="grid grid-cols-2 gap-6 flex-1 min-h-0">
        
        {/* COLUMN 1: COLA DE EMPAQUE (listo_despacho) */}
        <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl flex flex-col overflow-hidden shadow-sm">
          <div className="p-4 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950/40 flex justify-between items-center">
            <h2 className="text-xs font-bold uppercase tracking-widest text-neutral-600 dark:text-neutral-350 flex items-center gap-2 font-mono">
              <Package className="w-4 h-4 text-amber-500" /> 1. Cola de Empaque (Packing Slips)
            </h2>
            <span className="bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-300 text-[10px] font-bold px-2 py-0.5 rounded font-mono">
              {colaEmpaque.length} pendientes
            </span>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {colaEmpaque.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center py-20 text-neutral-400 opacity-60">
                <CheckCircle2 className="w-12 h-12 mb-3 text-emerald-500" />
                <p className="text-xs italic">¡No hay pedidos pendientes de empaque!</p>
                <p className="text-[10px] mt-1 font-mono">Todo el stock conciliado ha sido despachado.</p>
              </div>
            ) : (
              colaEmpaque.map(order => (
                <div key={order.id_orden} className="border border-neutral-200 dark:border-neutral-800 rounded-xl p-4 bg-neutral-50/50 dark:bg-neutral-950/20 hover:border-neutral-300 dark:hover:border-neutral-700 transition-all shadow-xs flex flex-col gap-3">
                  
                  {/* Packing Slip Header */}
                  <div className="flex justify-between items-start border-b border-neutral-200/50 dark:border-neutral-800/50 pb-2">
                    <div>
                      <span className="text-[9px] font-mono font-bold bg-neutral-200 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 px-1.5 py-0.5 rounded">
                        #{order.id_orden.slice(-6)}
                      </span>
                      <span className="ml-2 text-xs font-bold text-neutral-800 dark:text-white">
                        {order.cliente?.nombre}
                      </span>
                    </div>
                    <div className="text-right">
                      <p className="text-[9px] font-mono text-neutral-400">Canal: {order.envio?.canal === 'web_whatsapp' ? 'WEB' : order.envio?.canal?.toUpperCase()}</p>
                      <p className="text-[10px] font-bold font-mono text-neutral-800 dark:text-neutral-200">C$ {order.total_cs.toLocaleString('es-NI')}</p>
                    </div>
                  </div>

                  {/* Technical items list (Packing Specs) */}
                  <div className="space-y-2">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 font-mono">Lista de Empaque Técnica:</p>
                    <div className="space-y-1.5">
                      {(order.items || []).map((item, idx) => {
                        const specs = getProductSpecs(item.sku);
                        return (
                          <div key={idx} className="bg-white dark:bg-neutral-900 border border-neutral-200/60 dark:border-neutral-800/60 p-2.5 rounded-lg flex justify-between items-center text-xs font-mono">
                            <div>
                              <p className="font-bold text-neutral-800 dark:text-neutral-200">{item.cantidad}x {item.nombre}</p>
                              <p className="text-[10px] text-neutral-400">SKU: {item.sku}</p>
                            </div>
                            <div className="text-right">
                              {specs ? (
                                specs.categoria === 'perfume' ? (
                                  <span className="bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 text-[10px] font-bold px-2 py-0.5 rounded border border-emerald-100 dark:border-emerald-900/50">
                                    🧪 {specs.mililitros || 100}ml | {specs.concentracion || 'EDP'}
                                  </span>
                                ) : (
                                  <span className="bg-purple-50 dark:bg-purple-950/20 text-purple-700 dark:text-purple-400 text-[10px] font-bold px-2 py-0.5 rounded border border-purple-100 dark:border-purple-900/50">
                                    👜 {specs.material || 'Metal'} | {specs.color_banio || 'Baño de Oro'}
                                  </span>
                                )
                              ) : (
                                <span className="text-[9px] text-neutral-400 italic flex items-center gap-0.5">
                                  <HelpCircle className="w-3 h-3 text-neutral-500" /> Sin ficha técnica
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Delivery Info */}
                  <div className="bg-white dark:bg-neutral-900 border border-neutral-250/50 dark:border-neutral-800/50 rounded-lg p-2.5 text-xs text-neutral-600 dark:text-neutral-400 space-y-1">
                    <p className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5 text-neutral-400 shrink-0" /> {order.cliente?.telefono}</p>
                    <p className="flex items-start gap-1.5 leading-tight"><MapPin className="w-3.5 h-3.5 text-neutral-400 mt-0.5 shrink-0" /> {order.envio?.direccion}</p>
                    <p className="text-[10px] text-indigo-650 dark:text-indigo-400 font-mono mt-1 uppercase font-bold">
                      Método: {order.metodo_pago === 'efectivo' ? '💵 EFECTIVO' : `💳 TRANSFERENCIA - ${order.envio?.banco_destino?.toUpperCase()}`}
                    </p>
                  </div>

                  {/* Packing Actions */}
                  <div className="flex gap-2 mt-1">
                    <button
                      onClick={() => handleCopyMotorizado(order)}
                      disabled={updatingOrderId !== null}
                      className="flex-1 bg-white hover:bg-neutral-50 dark:bg-neutral-900 dark:hover:bg-neutral-850 border border-neutral-200 dark:border-neutral-800 text-[10px] uppercase font-bold py-2 rounded-lg flex items-center justify-center gap-1.5 text-neutral-700 dark:text-neutral-300 transition-colors cursor-pointer disabled:opacity-50"
                    >
                      {copiedOrderId === order.id_orden ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-555" /> ¡Datos Copiados!
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5 text-neutral-400" /> Copiar para Motorizado
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => handleTransitionState(order.id_orden, 'en_camino')}
                      disabled={updatingOrderId !== null}
                      className="flex-1 bg-neutral-900 hover:bg-neutral-850 dark:bg-neutral-100 dark:text-neutral-900 text-white text-[10px] uppercase font-bold py-2 rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                    >
                      <Truck className="w-3.5 h-3.5" /> Despachar (En Camino)
                    </button>
                  </div>

                </div>
              ))
            )}
          </div>
        </div>

        {/* COLUMN 2: COLA DE ENTREGA (en_camino) */}
        <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl flex flex-col overflow-hidden shadow-sm">
          <div className="p-4 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950/40 flex justify-between items-center">
            <h2 className="text-xs font-bold uppercase tracking-widest text-neutral-600 dark:text-neutral-355 flex items-center gap-2 font-mono">
              <Truck className="w-4 h-4 text-indigo-500" /> 2. Cola de Entrega (En Tránsito)
            </h2>
            <span className="bg-indigo-100 dark:bg-indigo-900/50 text-indigo-800 dark:text-indigo-300 text-[10px] font-bold px-2 py-0.5 rounded font-mono">
              {colaCamino.length} motorizados activos
            </span>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {colaCamino.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center py-20 text-neutral-400 opacity-60">
                <Truck className="w-12 h-12 mb-3 text-neutral-300" />
                <p className="text-xs italic">No hay envíos en camino en este momento.</p>
                <p className="text-[10px] mt-1 font-mono">Los despachos activos se listarán en esta sección.</p>
              </div>
            ) : (
              colaCamino.map(order => (
                <div key={order.id_orden} className="border border-indigo-100 dark:border-indigo-950 bg-indigo-50/10 dark:bg-indigo-950/10 rounded-xl p-4 hover:border-indigo-250 dark:hover:border-indigo-900 transition-all shadow-xs flex flex-col gap-3 animate-pulse-subtle">
                  
                  {/* Card Header */}
                  <div className="flex justify-between items-start border-b border-indigo-100/40 dark:border-indigo-900/30 pb-2">
                    <div>
                      <span className="text-[9px] font-mono font-bold bg-indigo-100 dark:bg-indigo-900 text-indigo-850 dark:text-indigo-350 px-1.5 py-0.5 rounded">
                        #{order.id_orden.slice(-6)}
                      </span>
                      <span className="ml-2 text-xs font-bold text-neutral-800 dark:text-white">
                        {order.cliente?.nombre}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-[9px] font-mono bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-300 px-1.5 py-0.5 rounded font-bold uppercase">
                        En Camino 🚚
                      </span>
                      <p className="text-[10px] font-bold font-mono text-neutral-800 dark:text-neutral-200 mt-1">C$ {order.total_cs.toLocaleString('es-NI')}</p>
                    </div>
                  </div>

                  {/* Summary of Items */}
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 font-mono mb-1">Items del Paquete:</p>
                    <ul className="text-xs font-mono text-neutral-600 dark:text-neutral-400 space-y-0.5">
                      {(order.items || []).map((it, idx) => (
                        <li key={idx}>• {it.cantidad}x {it.nombre} ({it.sku})</li>
                      ))}
                    </ul>
                  </div>

                  {/* Delivery Location & Phone details */}
                  <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg p-2.5 text-xs text-neutral-600 dark:text-neutral-400 space-y-1">
                    <p className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5 text-neutral-400 shrink-0" /> {order.cliente?.telefono}</p>
                    <p className="flex items-start gap-1.5 leading-tight"><MapPin className="w-3.5 h-3.5 text-neutral-400 mt-0.5 shrink-0" /> {order.envio?.direccion}</p>
                    <p className="text-[10px] text-indigo-650 dark:text-indigo-400 font-mono mt-1 uppercase font-bold">
                      Pago: {order.metodo_pago === 'efectivo' ? '💵 EFECTIVO (COBRAR)' : '💳 TRANSFERENCIA'}
                    </p>
                  </div>

                  {/* Delivery Actions */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleCopyMotorizado(order)}
                      disabled={updatingOrderId !== null}
                      className="flex-1 bg-white hover:bg-neutral-50 dark:bg-neutral-900 dark:hover:bg-neutral-850 border border-neutral-200 dark:border-neutral-800 text-[10px] uppercase font-bold py-2 rounded-lg flex items-center justify-center gap-1.5 text-neutral-700 dark:text-neutral-300 transition-colors cursor-pointer disabled:opacity-50"
                    >
                      {copiedOrderId === order.id_orden ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-555" /> Copiado
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5 text-neutral-400" /> Copiar Datos
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => handleTransitionState(order.id_orden, 'entregado')}
                      disabled={updatingOrderId !== null}
                      className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] uppercase font-bold py-2 rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50 shadow-sm"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" /> Confirmar Entrega
                    </button>
                  </div>

                </div>
              ))
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
