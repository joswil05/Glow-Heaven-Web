/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { ERPOrder, ERPProduct } from '../types/erp';
import { db } from '../lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { processPEPSSale, cancelWebOrder } from '../services/inventoryService';
import { 
  Package, Truck, CheckCircle2, Copy, Check, MessageCircle, 
  MapPin, Phone, HelpCircle, XCircle, AlertTriangle, Printer, ChevronDown, ChevronUp, History
} from 'lucide-react';

interface PhysicalFulfillmentProps {
  orders: ERPOrder[];
  products: ERPProduct[];
  businessConfig?: any;
}

export const PhysicalFulfillment: React.FC<PhysicalFulfillmentProps> = ({
  orders,
  products,
  businessConfig
}) => {
  const [copiedOrderId, setCopiedOrderId] = useState<string | null>(null);
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);
  const [confirmingOrder, setConfirmingOrder] = useState<{ id: string; action: 'validar' | 'cancelar' } | null>(null);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  // Auto-dismiss notifications
  useEffect(() => {
    if (notification) {
      const t = setTimeout(() => setNotification(null), 4000);
      return () => clearTimeout(t);
    }
  }, [notification]);

  // --- Real-time filtered queues ---
  const colaConciliacion = useMemo(() => {
    if (!Array.isArray(orders)) return [];
    return orders.filter(o => o && (o.estado === 'stock_comprometido' || o.estado === 'pendiente_pago'));
  }, [orders]);

  const colaEmpaque = useMemo(() => {
    if (!Array.isArray(orders)) return [];
    return orders.filter(o => o && o.estado === 'listo_despacho');
  }, [orders]);

  const colaCamino = useMemo(() => {
    if (!Array.isArray(orders)) return [];
    return orders.filter(o => o && o.estado === 'en_camino');
  }, [orders]);

  const colaHistorial = useMemo(() => {
    if (!Array.isArray(orders)) return [];
    return orders.filter(o => o && (o.estado === 'entregado' || o.estado === 'cancelado'))
      .sort((a, b) => {
        const timeA = new Date(a.fecha || 0).getTime();
        const timeB = new Date(b.fecha || 0).getTime();
        return timeB - timeA; // Descending
      });
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

  // Execute PEPS validation
  const handleExecuteValidar = async (order: ERPOrder) => {
    setUpdatingOrderId(order.id_orden);
    setConfirmingOrder(null);
    try {
      await processPEPSSale(order);
      setNotification({ message: `¡Pago validado exitosamente para la orden #${order.id_orden.slice(-6)}!`, type: 'success' });
    } catch (error: any) {
      setNotification({ message: `Error al validar pago: ${error.message}`, type: 'error' });
    } finally {
      setUpdatingOrderId(null);
    }
  };

  // Execute Order Cancellation
  const handleExecuteCancelar = async (orderId: string) => {
    setUpdatingOrderId(orderId);
    setConfirmingOrder(null);
    try {
      await cancelWebOrder(orderId);
      setNotification({ message: `La orden #${orderId.slice(-6)} ha sido cancelada y el stock fue liberado.`, type: 'success' });
    } catch (error: any) {
      setNotification({ message: `Error al cancelar la orden: ${error.message}`, type: 'error' });
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

  // Copy WA template for customer notification
  const handleCopyWhatsApp = (order: ERPOrder) => {
    const nombre = order.cliente?.nombre || 'Cliente';
    const banco = (order.envio?.banco_destino || 'Banco').toUpperCase();
    const total = order.total_cs;
    const direccion = order.envio?.direccion || 'N/A';
    const itemsText = (order.items || []).map(it => `• ${it.cantidad}x ${it.nombre}`).join('\n');
    
    const message = `*✨ GLOW HEAVEN ✨*\n` +
      `*Confirmación de Pago* ✅\n\n` +
      `Hola *${nombre}*, tu pago ha sido recibido con éxito en *${banco}*.\n\n` +
      `📦 *Detalle del Pedido:*\n${itemsText}\n\n` +
      `💰 *Total:* C$ ${total.toLocaleString('es-NI')}\n` +
      `🚚 *Dirección:* ${direccion}\n\n` +
      `Tu pedido está *Listo para Despacho* y pasará a bodega hoy mismo. ¡Muchas gracias por tu preferencia!`;

    navigator.clipboard.writeText(message);
    setCopiedOrderId(order.id_orden + '-wa');
    setTimeout(() => setCopiedOrderId(null), 2000);
  };

  return (
    <div className="flex-1 p-4 h-full flex flex-col min-h-0 relative bg-neutral-50 dark:bg-neutral-950 font-sans">
      {/* Visual Toast Feedback */}
      {notification && (
        <div className={`fixed bottom-4 right-4 z-50 p-4 rounded-xl shadow-lg border text-sm flex items-center gap-2 animate-in fade-in slide-in-from-bottom-5 duration-300 ${
          notification.type === 'success' 
            ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-850 text-emerald-800 dark:text-emerald-400' 
            : 'bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-850 text-rose-800 dark:text-rose-400'
        }`}>
          {notification.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <AlertTriangle className="w-4 h-4 text-rose-500" />}
          <span>{notification.message}</span>
          <button onClick={() => setNotification(null)} className="ml-2 font-mono text-xs hover:opacity-75 font-bold">×</button>
        </div>
      )}

      {/* HEADER */}
      <header className="flex justify-between items-center mb-4 px-2 shrink-0">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Truck className="w-6 h-6 text-emerald-600 dark:text-emerald-500" /> Gestión Operativa de Pedidos
          </h1>
          <p className="text-xs text-neutral-500 font-mono">Terminal ERP Glow Heaven | Ciclo Omnicanal Consolidado (F5)</p>
        </div>
        <div className="flex gap-4 text-[10px] font-mono text-neutral-500 uppercase tracking-widest bg-white dark:bg-neutral-900 px-4 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 shadow-sm">
          <span>Por Conciliar: <strong className="text-amber-600 font-bold">{colaConciliacion.length}</strong></span>
          <span>Cola Empaque: <strong className="text-emerald-600 font-bold">{colaEmpaque.length}</strong></span>
          <span>En Camino: <strong className="text-indigo-650 font-bold">{colaCamino.length}</strong></span>
        </div>
      </header>

      {/* CORE QUEUE GRIDS (3 Columns) */}
      <div className="flex-1 grid grid-cols-3 gap-4 min-h-0 mb-4">
        
        {/* COLUMN 1: COLA DE CONCILIACIÓN (pendiente_pago) */}
        <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl flex flex-col overflow-hidden shadow-sm h-full">
          <div className="p-3 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950/40 flex justify-between items-center">
            <h2 className="text-[11px] font-bold uppercase tracking-widest text-neutral-500 dark:text-neutral-400 flex items-center gap-2 font-mono">
              <Package className="w-4 h-4 text-amber-500" /> 1. Por Conciliar (Pagos)
            </h2>
            <span className="bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-300 text-[10px] font-bold px-2 py-0.5 rounded font-mono">
              {colaConciliacion.length}
            </span>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {colaConciliacion.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center py-20 text-neutral-400 opacity-60">
                <CheckCircle2 className="w-10 h-10 mb-2 text-emerald-500" />
                <p className="text-xs italic">Sin pagos pendientes</p>
                <p className="text-[9px] mt-0.5 font-mono">Todos los pedidos han sido conciliados.</p>
              </div>
            ) : (
              colaConciliacion.map(order => {
                const cleanPhone = String(order.cliente?.telefono || '').replace(/\D/g, '');
                let msg = businessConfig?.mensaje_cobro_wa || 'Hola {nombre}! Gracias por tu pedido en Glow Heaven. Recibimos tu solicitud #{id_orden} por C$ {total}.';
                msg = msg.replace('{nombre}', order.cliente?.nombre || 'Cliente')
                         .replace('{id_orden}', order.id_orden.slice(-6))
                         .replace('{total}', order.total_cs.toLocaleString('es-NI'))
                         .replace('{banco}', (order.envio?.banco_destino || 'Banco').toUpperCase());
                const waChatUrl = `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(msg)}`;

                return (
                  <div key={order.id_orden} className="border border-amber-250 dark:border-amber-900/40 bg-amber-50/15 dark:bg-amber-950/10 rounded-xl p-3 flex flex-col gap-2.5 shadow-xs">
                    {/* Order header */}
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-mono font-bold bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-200 px-1.5 py-0.5 rounded">
                        #{order.id_orden.slice(-6)}
                      </span>
                      <div className="flex gap-1">
                        <span className="text-[8px] font-bold bg-neutral-200 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 px-1 py-0.5 rounded">
                          {order.envio?.canal === 'web_whatsapp' ? 'WEB' : order.envio?.canal?.toUpperCase()}
                        </span>
                        <span className="text-[8px] font-bold bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 px-1 py-0.5 rounded font-mono">
                          {order.envio?.banco_destino?.toUpperCase()}
                        </span>
                      </div>
                    </div>

                    {/* Customer info */}
                    <div>
                      <p className="font-bold text-xs text-neutral-800 dark:text-white leading-tight">{order.cliente?.nombre}</p>
                      <p className="text-[10px] text-neutral-500 font-mono mt-0.5">📞 {order.cliente?.telefono || 'N/A'}</p>
                      <p className="text-[10px] text-neutral-600 dark:text-neutral-400 mt-1 italic leading-tight">📍 {order.envio?.direccion}</p>
                    </div>

                    {/* Items */}
                    <ul className="text-[10px] text-neutral-600 dark:text-neutral-400 font-mono border-t border-b border-neutral-200/50 dark:border-neutral-800/50 py-1.5 space-y-0.5">
                      {(order.items || []).map((it, idx) => (
                        <li key={idx} className="flex justify-between">
                          <span>• {it.cantidad}x {it.nombre}</span>
                          <span className="text-neutral-450">({it.sku})</span>
                        </li>
                      ))}
                    </ul>

                    {/* Total */}
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-neutral-450 uppercase font-bold text-[9px]">Total</span>
                      <span className="font-bold font-mono text-neutral-800 dark:text-neutral-200">C$ {order.total_cs.toLocaleString('es-NI')}</span>
                    </div>

                    {/* Actions */}
                    <div className="space-y-1.5 mt-1">
                      <a
                        href={waChatUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-[9px] uppercase font-bold py-1.5 rounded-lg flex items-center justify-center gap-1 transition-colors cursor-pointer text-center"
                      >
                        <MessageCircle className="w-3 h-3 fill-white/10" /> Iniciar Chat WA
                      </a>

                      <button
                        onClick={() => handleCopyWhatsApp(order)}
                        className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-850 text-[9px] uppercase font-bold py-1.5 rounded-lg flex items-center justify-center gap-1 text-neutral-700 dark:text-neutral-300 transition-colors cursor-pointer"
                      >
                        {copiedOrderId === order.id_orden + '-wa' ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-500" /> ¡Confirmación Copiada!
                          </>
                        ) : (
                          <>
                            <MessageCircle className="w-3 h-3 text-emerald-500" /> Copiar Confirmación WA
                          </>
                        )}
                      </button>

                      <div className="flex gap-1.5">
                        {confirmingOrder?.id === order.id_orden ? (
                          <>
                            <button
                              onClick={() => setConfirmingOrder(null)}
                              disabled={updatingOrderId !== null}
                              className="flex-1 bg-neutral-200 hover:bg-neutral-300 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 text-[9px] uppercase font-bold py-1.5 rounded-lg transition-colors cursor-pointer"
                            >
                              No
                            </button>
                            <button
                              onClick={() => confirmingOrder.action === 'validar' ? handleExecuteValidar(order) : handleExecuteCancelar(order.id_orden)}
                              disabled={updatingOrderId !== null}
                              className={`flex-1 text-[9px] uppercase font-bold py-1.5 rounded-lg text-white transition-colors cursor-pointer ${
                                confirmingOrder.action === 'validar' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'
                              }`}
                            >
                              Sí
                            </button>
                          </>
                        ) : (
                          <>
                            <button 
                              onClick={() => setConfirmingOrder({ id: order.id_orden, action: 'cancelar' })}
                              disabled={updatingOrderId !== null}
                              className="flex-1 bg-white hover:bg-rose-50 dark:bg-neutral-900 dark:hover:bg-rose-950/20 border border-rose-200 dark:border-rose-900/50 text-rose-600 text-[9px] uppercase font-bold py-1.5 rounded-lg flex items-center justify-center gap-0.5 transition-colors cursor-pointer"
                              title="Cancelar Reserva de Stock"
                            >
                              <XCircle className="w-3 h-3" /> Cancelar
                            </button>
                            <button 
                              onClick={() => setConfirmingOrder({ id: order.id_orden, action: 'validar' })}
                              disabled={updatingOrderId !== null}
                              className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-[9px] uppercase font-bold py-1.5 rounded-lg flex items-center justify-center gap-0.5 transition-colors cursor-pointer"
                            >
                              <CheckCircle2 className="w-3 h-3" /> Validar
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* COLUMN 2: COLA DE EMPAQUE (listo_despacho) */}
        <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl flex flex-col overflow-hidden shadow-sm h-full">
          <div className="p-3 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950/40 flex justify-between items-center">
            <h2 className="text-[11px] font-bold uppercase tracking-widest text-neutral-500 dark:text-neutral-400 flex items-center gap-2 font-mono">
              <Package className="w-4 h-4 text-emerald-500" /> 2. Listo para Empaque
            </h2>
            <span className="bg-emerald-100 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-300 text-[10px] font-bold px-2 py-0.5 rounded font-mono">
              {colaEmpaque.length}
            </span>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {colaEmpaque.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center py-20 text-neutral-400 opacity-60">
                <CheckCircle2 className="w-10 h-10 mb-2 text-emerald-500" />
                <p className="text-xs italic">Nada por empacar</p>
                <p className="text-[9px] mt-0.5 font-mono">Todos los pedidos pagados han sido despachados.</p>
              </div>
            ) : (
              colaEmpaque.map(order => (
                <div key={order.id_orden} className="border border-neutral-200 dark:border-neutral-800 rounded-xl p-3 bg-neutral-50/50 dark:bg-neutral-950/20 hover:border-neutral-300 dark:hover:border-neutral-700 transition-all shadow-xs flex flex-col gap-2.5">
                  {/* Packing Header */}
                  <div className="flex justify-between items-start border-b border-neutral-200/50 dark:border-neutral-800/50 pb-2">
                    <div>
                      <span className="text-[9px] font-mono font-bold bg-neutral-250 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 px-1.5 py-0.5 rounded">
                        #{order.id_orden.slice(-6)}
                      </span>
                      <span className="ml-1.5 text-xs font-bold text-neutral-800 dark:text-white">
                        {order.cliente?.nombre}
                      </span>
                    </div>
                    <div className="text-right">
                      <p className="text-[8px] font-mono text-neutral-400">Canal: {order.envio?.canal === 'web_whatsapp' ? 'WEB' : order.envio?.canal?.toUpperCase()}</p>
                    </div>
                  </div>

                  {/* Technical items list */}
                  <div className="space-y-1.5">
                    <p className="text-[9px] font-bold uppercase tracking-wider text-neutral-400 font-mono">Lista de Empaque Técnica:</p>
                    <div className="space-y-1">
                      {(order.items || []).map((item, idx) => {
                        const specs = getProductSpecs(item.sku);
                        return (
                          <div key={idx} className="bg-white dark:bg-neutral-900 border border-neutral-200/60 dark:border-neutral-800/60 p-2 rounded-lg flex justify-between items-center text-[10px] font-mono">
                            <div>
                              <p className="font-bold text-neutral-850 dark:text-neutral-200">{item.cantidad}x {item.nombre}</p>
                              <p className="text-[9px] text-neutral-400">SKU: {item.sku}</p>
                            </div>
                            <div className="text-right">
                              {specs ? (
                                specs.categoria === 'perfume' ? (
                                  <span className="bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 text-[9px] font-bold px-1.5 py-0.5 rounded border border-emerald-100 dark:border-emerald-900/30">
                                    🧪 {specs.mililitros || 100}ml | {specs.concentracion || 'EDP'}
                                  </span>
                                ) : (
                                  <span className="bg-purple-50 dark:bg-purple-950/20 text-purple-700 dark:text-purple-400 text-[9px] font-bold px-1.5 py-0.5 rounded border border-purple-100 dark:border-purple-900/30">
                                    👜 {specs.material || 'Metal'} | {specs.color_banio || 'Baño de Oro'}
                                  </span>
                                )
                              ) : (
                                <span className="text-[8px] text-neutral-400 italic">Sin ficha</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Delivery Location & details */}
                  <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg p-2 text-[10px] text-neutral-600 dark:text-neutral-400 space-y-1">
                    <div className="flex justify-between items-center">
                      <p className="font-semibold">📞 {order.cliente?.telefono}</p>
                      <a
                        href={`https://api.whatsapp.com/send?phone=${String(order.cliente?.telefono || '').replace(/\D/g, '')}&text=${encodeURIComponent(
                          `Hola ${order.cliente?.nombre || 'Cliente'}! Tu pedido #${order.id_orden.slice(-6)} de Glow Heaven ya está en preparación para ser entregado. ¿Nos podrías confirmar si hay alguna indicación especial para la entrega en tu dirección?`
                        )}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[9px] text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 font-bold flex items-center gap-0.5 cursor-pointer"
                      >
                        <MessageCircle className="w-2.5 h-2.5 fill-current" /> Consultar
                      </a>
                    </div>
                    <p className="leading-tight">📍 {order.envio?.direccion}</p>
                    <p className="text-[9px] text-indigo-600 dark:text-indigo-400 font-mono mt-0.5 uppercase font-bold">
                      Pago: {order.metodo_pago === 'efectivo' ? '💵 Contraentrega' : `💳 Transf. (${order.envio?.banco_destino?.toUpperCase()})`}
                    </p>
                  </div>

                  {/* Packing Actions */}
                  <div className="flex gap-1.5 mt-0.5">
                    <button
                      onClick={() => handleCopyMotorizado(order)}
                      disabled={updatingOrderId !== null}
                      className="flex-1 bg-white hover:bg-neutral-50 dark:bg-neutral-900 dark:hover:bg-neutral-850 border border-neutral-200 dark:border-neutral-800 text-[9px] uppercase font-bold py-1.5 rounded-lg flex items-center justify-center gap-1 text-neutral-700 dark:text-neutral-300 transition-colors cursor-pointer disabled:opacity-50"
                    >
                      {copiedOrderId === order.id_orden ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-500" /> Copiado
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3 text-neutral-400" /> Datos Motorizado
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => handleTransitionState(order.id_orden, 'en_camino')}
                      disabled={updatingOrderId !== null}
                      className="flex-1 bg-neutral-900 hover:bg-neutral-850 dark:bg-neutral-100 dark:text-neutral-900 text-white text-[9px] uppercase font-bold py-1.5 rounded-lg flex items-center justify-center gap-1 transition-colors cursor-pointer disabled:opacity-50"
                    >
                      <Truck className="w-3 h-3" /> Despachar
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* COLUMN 3: COLA DE ENTREGA (en_camino) */}
        <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl flex flex-col overflow-hidden shadow-sm h-full">
          <div className="p-3 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950/40 flex justify-between items-center">
            <h2 className="text-[11px] font-bold uppercase tracking-widest text-neutral-500 dark:text-neutral-400 flex items-center gap-2 font-mono">
              <Truck className="w-4 h-4 text-indigo-500" /> 3. En Tránsito (Motorizado)
            </h2>
            <span className="bg-indigo-100 dark:bg-indigo-900/50 text-indigo-800 dark:text-indigo-300 text-[10px] font-bold px-2 py-0.5 rounded font-mono">
              {colaCamino.length}
            </span>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {colaCamino.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center py-20 text-neutral-400 opacity-60">
                <Truck className="w-10 h-10 mb-2 text-neutral-300" />
                <p className="text-xs italic">Sin despachos en tránsito</p>
                <p className="text-[9px] mt-0.5 font-mono">Los envíos activos se listarán en esta columna.</p>
              </div>
            ) : (
              colaCamino.map(order => (
                <div key={order.id_orden} className="border border-indigo-100 dark:border-indigo-950 bg-indigo-50/5 dark:bg-indigo-950/5 rounded-xl p-3 flex flex-col gap-2.5">
                  {/* Card Header */}
                  <div className="flex justify-between items-start border-b border-indigo-100/30 dark:border-indigo-900/25 pb-2">
                    <div>
                      <span className="text-[9px] font-mono font-bold bg-indigo-100 dark:bg-indigo-900 text-indigo-800 dark:text-indigo-200 px-1.5 py-0.5 rounded">
                        #{order.id_orden.slice(-6)}
                      </span>
                      <span className="ml-1.5 text-xs font-bold text-neutral-850 dark:text-white">
                        {order.cliente?.nombre}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-[8px] font-mono bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-300 px-1.5 py-0.5 rounded font-bold uppercase">
                        Tránsito 🚚
                      </span>
                    </div>
                  </div>

                  {/* Tech specs of items summary */}
                  <div className="text-[10px] font-mono text-neutral-600 dark:text-neutral-400">
                    <p className="text-[9px] font-bold uppercase tracking-wider text-neutral-400 mb-0.5">Paquete:</p>
                    <ul className="space-y-0.5">
                      {(order.items || []).map((it, idx) => (
                        <li key={idx}>• {it.cantidad}x {it.nombre} ({it.sku})</li>
                      ))}
                    </ul>
                  </div>

                  {/* Delivery details */}
                  <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg p-2 text-[10px] text-neutral-600 dark:text-neutral-400 space-y-1">
                    <div className="flex justify-between items-center">
                      <p className="font-semibold">📞 {order.cliente?.telefono}</p>
                      <a
                        href={`https://api.whatsapp.com/send?phone=${String(order.cliente?.telefono || '').replace(/\D/g, '')}&text=${encodeURIComponent(
                          `Hola ${order.cliente?.nombre || 'Cliente'}! Tu pedido #${order.id_orden.slice(-6)} de Glow Heaven ya está en tránsito con el motorizado. ¿Hay alguna indicación adicional para facilitar la entrega?`
                        )}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[9px] text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 font-bold flex items-center gap-0.5 cursor-pointer"
                      >
                        <MessageCircle className="w-2.5 h-2.5 fill-current" /> Consultar
                      </a>
                    </div>
                    <p className="leading-tight">📍 {order.envio?.direccion}</p>
                    <p className="text-[9px] text-indigo-650 dark:text-indigo-400 font-mono mt-0.5 uppercase font-bold">
                      Cobrar: {order.metodo_pago === 'efectivo' ? `💵 C$ ${order.total_cs.toLocaleString('es-NI')} NIO` : '💳 Transferido'}
                    </p>
                  </div>

                  {/* Delivery Actions */}
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => handleCopyMotorizado(order)}
                      disabled={updatingOrderId !== null}
                      className="flex-1 bg-white hover:bg-neutral-50 dark:bg-neutral-900 dark:hover:bg-neutral-850 border border-neutral-200 dark:border-neutral-800 text-[9px] uppercase font-bold py-1.5 rounded-lg flex items-center justify-center gap-1 text-neutral-700 dark:text-neutral-300 transition-colors cursor-pointer disabled:opacity-50"
                    >
                      {copiedOrderId === order.id_orden ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-500" /> Copiado
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3 text-neutral-400" /> Copiar Datos
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => handleTransitionState(order.id_orden, 'entregado')}
                      disabled={updatingOrderId !== null}
                      className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-[9px] uppercase font-bold py-1.5 rounded-lg flex items-center justify-center gap-1 transition-colors cursor-pointer disabled:opacity-50 shadow-sm"
                    >
                      <CheckCircle2 className="w-3 h-3" /> Entregado
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>

      {/* ACCORDION BOTTOM SECTION: HISTORIAL DE PEDIDOS */}
      <div className="shrink-0 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden shadow-xs">
        <button 
          onClick={() => setShowHistory(!showHistory)}
          className="w-full px-4 py-3 flex justify-between items-center hover:bg-neutral-50 dark:hover:bg-neutral-950/20 transition-all font-mono text-[10px] uppercase font-bold tracking-wider text-neutral-500"
        >
          <span className="flex items-center gap-2">
            <History className="w-4 h-4 text-emerald-650" /> Historial Reciente de Pedidos ({colaHistorial.length})
          </span>
          {showHistory ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        {showHistory && (
          <div className="border-t border-neutral-200 dark:border-neutral-800 p-4 max-h-48 overflow-y-auto animate-fadeIn divide-y divide-neutral-100 dark:divide-neutral-800 text-[11px]">
            {colaHistorial.length === 0 ? (
              <p className="text-xs text-neutral-400 italic text-center py-4">No hay pedidos registrados en el historial.</p>
            ) : (
              colaHistorial.map(order => (
                <div key={order.id_orden} className="py-2.5 flex justify-between items-center hover:bg-neutral-50/50 dark:hover:bg-neutral-955/20 px-2 rounded-lg transition-colors">
                  <div className="flex items-center gap-3">
                    <span className="font-mono font-bold text-neutral-500">#{order.id_orden.slice(-6)}</span>
                    <span className={`text-[8px] font-bold uppercase px-1.5 py-0.5 rounded font-mono ${
                      order.estado === 'entregado' ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700' : 'bg-rose-100 dark:bg-rose-950 text-rose-700'
                    }`}>
                      {order.estado}
                    </span>
                    <span className="font-bold">{order.cliente?.nombre}</span>
                    <span className="text-neutral-400 font-mono">({order.items.map(it => `${it.cantidad}x ${it.nombre}`).join(', ')})</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="font-mono text-neutral-700 dark:text-neutral-300">C$ {order.total_cs.toLocaleString('es-NI')}</span>
                    <button 
                      className="p-1.5 bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-850 dark:hover:bg-neutral-800 rounded text-neutral-600 dark:text-neutral-350 transition-colors cursor-pointer"
                      title="Imprimir Ticket"
                    >
                      <Printer className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

    </div>
  );
};
