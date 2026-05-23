import React, { useState, useEffect, useMemo, useRef } from 'react';
import { ERPProduct, InventoryBatch, ERPOrder, PettyCashTransaction } from '../types/erp';
import { 
  TrendingUp, Wallet, Activity, Package, AlertTriangle, 
  ShoppingCart, RefreshCw, Printer, CheckCircle, PackageOpen, X, Search, XCircle
} from 'lucide-react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../lib/firebase';
import { PettyCashForm } from './PettyCashForm';
import { cancelWebOrder, processPEPSSale } from '../services/inventoryService';

interface DashboardOverviewProps {
  products: ERPProduct[];
  batches: InventoryBatch[];
  orders: ERPOrder[];
  expenses: PettyCashTransaction[];
  isLoading: boolean;
  onOpenQuickSale: () => void;
}

export const DashboardOverview: React.FC<DashboardOverviewProps> = ({
  products,
  batches,
  orders,
  expenses,
  isLoading,
  onOpenQuickSale
}) => {
  // --- KPI CALCULATIONS ---
  const ventasBrutas = useMemo(() => {
    return orders
      .filter(o => o.estado !== 'pendiente_pago' && o.estado !== 'stock_comprometido' && o.estado !== 'cancelado') // Liquidadas
      .reduce((acc, curr) => acc + curr.total_cs, 0);
  }, [orders]);

  const capitalInmovilizado = useMemo(() => {
    return batches.reduce((acc, curr) => acc + (curr.cantidad_restante * curr.costo_adquisicion), 0);
  }, [batches]);

  const gastosTotales = useMemo(() => {
    return expenses.reduce((acc, curr) => acc + curr.monto_cs, 0);
  }, [expenses]);

  const utilidadNeta = useMemo(() => {
    // Calculo usando el costo real guardado en las ordenes
    const costoMercancia = orders
      .filter(o => o.estado !== 'pendiente_pago' && o.estado !== 'stock_comprometido' && o.estado !== 'cancelado')
      .reduce((acc, curr) => acc + (curr as any).costo_peps_total_cs || 0, 0);
      
    // Fallback: Si no hay historial PEPS, simulamos para la UI
    const estimatedCOGS = costoMercancia > 0 ? costoMercancia : ventasBrutas * 0.45; 
    return ventasBrutas - estimatedCOGS - gastosTotales;
  }, [ventasBrutas, gastosTotales, orders]);

  // --- ALERTS ---
  const productosCriticos = useMemo(() => {
    return products.filter(p => p.stock_disponible <= p.stock_minimo && p.activo);
  }, [products]);

  // --- ORDER PIPELINES ---
  const pedidosComprometidos = orders.filter(o => o.estado === 'stock_comprometido');
  const pedidosListos = orders.filter(o => o.estado === 'listo_despacho' || o.estado === 'entregado'); // 'entregado' también para ver histórico reciente

  const handleValidarPago = async (order: ERPOrder) => {
    if (window.confirm(`¿Confirmar pago y descontar PEPS de la orden ${order.id_orden}?`)) {
      try {
        await processPEPSSale(order);
      } catch (error: any) {
        alert("Error al validar pago: " + error.message);
      }
    }
  };

  const handleCancelOrder = async (orderId: string) => {
    if (window.confirm(`⚠️ ¿Estás seguro de que deseas CANCELAR la orden ${orderId} y liberar el inventario comprometido?`)) {
      try {
        await cancelWebOrder(orderId);
      } catch (error: any) {
        alert("Error al cancelar la orden: " + error.message);
      }
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-neutral-100 dark:bg-neutral-950 p-6 h-screen flex flex-col gap-6 font-sans animate-pulse">
        <div className="h-10 bg-neutral-200 dark:bg-neutral-800 rounded w-1/4"></div>
        <div className="grid grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <div key={i} className="h-24 bg-neutral-200 dark:bg-neutral-800 rounded-xl"></div>)}
        </div>
        <div className="grid grid-cols-12 gap-4 flex-1">
          <div className="col-span-8 bg-neutral-200 dark:bg-neutral-800 rounded-xl h-full"></div>
          <div className="col-span-4 flex flex-col gap-4 h-full">
            <div className="flex-1 bg-neutral-200 dark:bg-neutral-800 rounded-xl"></div>
            <div className="h-48 bg-neutral-200 dark:bg-neutral-800 rounded-xl"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 p-4 h-full flex flex-col min-h-0">
      
      {/* HEADER & ATTAJOS */}
      <header className="flex justify-between items-center mb-4 px-2 shrink-0">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Centro de Control Operativo</h1>
          <p className="text-xs text-neutral-500 font-mono">Terminal ERP Glow Heaven | C$ (NIO)</p>
        </div>
        <div className="flex gap-4 text-[10px] font-mono text-neutral-500 uppercase tracking-widest bg-white dark:bg-neutral-900 px-4 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 shadow-sm">
          <button onClick={onOpenQuickSale} className="hover:text-neutral-900 dark:hover:text-white transition-colors cursor-pointer">
            <kbd className="font-bold border border-neutral-300 dark:border-neutral-700 px-1 rounded mr-1">F2</kbd> Venta Física
          </button>
          <span><kbd className="font-bold border border-neutral-300 dark:border-neutral-700 px-1 rounded mr-1">Ctrl+G</kbd> Caja Chica</span>
        </div>
      </header>

      {/* A. KPI FINANCIAL MODULE (TOP) */}
      <div className="grid grid-cols-4 gap-4 mb-4 shrink-0">
        <div className="bg-white dark:bg-neutral-900 p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 flex flex-col shadow-sm">
          <span className="text-[10px] text-neutral-400 font-bold uppercase tracking-widest flex items-center gap-2 mb-1">
            <TrendingUp className="w-3.5 h-3.5" /> Ventas Brutas (Día)
          </span>
          <span className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400">C$ {ventasBrutas.toLocaleString('es-NI')}</span>
        </div>
        
        <div className="bg-white dark:bg-neutral-900 p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 flex flex-col shadow-sm">
          <span className="text-[10px] text-neutral-400 font-bold uppercase tracking-widest flex items-center gap-2 mb-1">
            <Package className="w-3.5 h-3.5" /> Capital Inmovilizado
          </span>
          <span className="text-2xl font-bold font-mono text-amber-600 dark:text-amber-400">C$ {capitalInmovilizado.toLocaleString('es-NI')}</span>
        </div>

        <div className="bg-white dark:bg-neutral-900 p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 flex flex-col shadow-sm">
          <span className="text-[10px] text-neutral-400 font-bold uppercase tracking-widest flex items-center gap-2 mb-1">
            <Wallet className="w-3.5 h-3.5" /> Margen Utilidad Neta
          </span>
          <span className="text-2xl font-bold font-mono text-indigo-600 dark:text-indigo-400">C$ {utilidadNeta.toLocaleString('es-NI')}</span>
        </div>

        <div className="bg-white dark:bg-neutral-900 p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 flex flex-col shadow-sm">
          <span className="text-[10px] text-neutral-400 font-bold uppercase tracking-widest flex items-center gap-2 mb-1">
            <Activity className="w-3.5 h-3.5" /> Eficiencia Rotación
          </span>
          <div className="flex items-center gap-2 mt-1">
            <div className="h-2 w-full bg-emerald-500/20 rounded-full overflow-hidden"><div className="h-full bg-emerald-500 w-[85%]"></div></div>
            <span className="text-xs font-bold font-mono">85%</span>
          </div>
        </div>
      </div>

      {/* LOWER GRID: B, C, D Modules */}
      <div className="grid grid-cols-12 gap-4 flex-1 min-h-0">
        
        {/* B. PIPELINE OMNICANAL (LEFT - 8 Cols) */}
        <div className="col-span-8 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl flex flex-col overflow-hidden shadow-sm">
          <div className="p-3 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950/50 flex justify-between items-center">
            <h2 className="text-[11px] font-bold uppercase tracking-widest text-neutral-500 flex items-center gap-2">
              <ShoppingCart className="w-4 h-4" /> Pipeline de Despacho
            </h2>
            <button onClick={onOpenQuickSale} className="bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 text-[10px] font-bold px-3 py-1.5 rounded uppercase tracking-wider hover:opacity-80 transition-opacity cursor-pointer">
              + Venta Física (F2)
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-6">
            {/* ROW 1: Stock Comprometido (Por validar) */}
            <div>
              <h3 className="text-xs font-bold text-amber-600 dark:text-amber-500 mb-3 border-l-2 border-amber-500 pl-2 uppercase tracking-wide">Pedidos Web: Stock Comprometido</h3>
              {pedidosComprometidos.length === 0 ? (
                <p className="text-xs text-neutral-400 italic">No hay pedidos pendientes de validación.</p>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {pedidosComprometidos.map(p => (
                    <div key={p.id_orden} className="border border-amber-200 dark:border-amber-900/50 bg-amber-50/50 dark:bg-amber-950/20 p-3 rounded-lg flex flex-col justify-between">
                      <div>
                        <div className="flex justify-between items-start mb-2">
                          <span className="text-[10px] font-mono font-bold bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-200 px-1.5 py-0.5 rounded">{p.id_orden}</span>
                          <span className="text-[10px] uppercase font-bold text-neutral-500">{p.metodo_pago}</span>
                        </div>
                        <p className="font-bold text-sm">{p.cliente_nombre}</p>
                        <ul className="text-xs text-neutral-600 dark:text-neutral-400 mt-1 mb-2">
                          {p.items.map((it, i) => <li key={i}>• {it.cantidad}x {it.nombre}</li>)}
                        </ul>
                        <p className="text-sm font-mono font-bold text-neutral-800 dark:text-neutral-200">C$ {p.total_cs}</p>
                      </div>
                      
                      <div className="mt-3 flex gap-2">
                        <button 
                          onClick={() => handleCancelOrder(p.id_orden)}
                          className="flex-1 bg-white hover:bg-rose-50 dark:bg-neutral-900 dark:hover:bg-rose-950 border border-rose-200 dark:border-rose-900/50 text-rose-600 text-[10px] uppercase font-bold py-2 rounded flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                          title="Cancelar Orden y Liberar Stock"
                        >
                          <XCircle className="w-3.5 h-3.5" /> Cancelar
                        </button>
                        <button 
                          onClick={() => handleValidarPago(p)}
                          className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] uppercase font-bold py-2 rounded flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <CheckCircle className="w-3.5 h-3.5" /> Validar (PEPS)
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ROW 2: Listo para Despacho */}
            <div>
              <h3 className="text-xs font-bold text-emerald-600 dark:text-emerald-500 mb-3 border-l-2 border-emerald-500 pl-2 uppercase tracking-wide">Despachados Recientemente</h3>
              {pedidosListos.length === 0 ? (
                <p className="text-xs text-neutral-400 italic">No hay pedidos despachados recientes.</p>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {pedidosListos.slice(0, 10).map(p => (
                    <div key={p.id_orden} className="border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-3 rounded-lg flex justify-between items-center shadow-sm">
                      <div>
                        <span className="text-[10px] font-mono font-bold bg-emerald-100 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-300 px-1.5 py-0.5 rounded">{p.id_orden}</span>
                        <p className="font-bold text-sm mt-1">{p.cliente_nombre}</p>
                        <p className="text-[10px] text-neutral-400 mt-0.5">{p.canal === 'web_whatsapp' ? 'Web' : 'Mostrador'} • C$ {p.total_cs}</p>
                      </div>
                      <button className="p-2.5 bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 rounded-lg text-neutral-600 dark:text-neutral-300 transition-colors cursor-pointer" title="Imprimir Remisión">
                        <Printer className="w-5 h-5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN (4 Cols) */}
        <div className="col-span-4 flex flex-col gap-4 min-h-0">
          
          {/* C. ALERTAS DE REABASTECIMIENTO CRÍTICO */}
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl flex flex-col overflow-hidden shadow-sm flex-1">
            <div className="p-3 border-b border-rose-100 dark:border-rose-900/30 bg-rose-50 dark:bg-rose-950/20">
              <h2 className="text-[11px] font-bold uppercase tracking-widest text-rose-600 dark:text-rose-400 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" /> Alertas Críticas (Stock)
              </h2>
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              {productosCriticos.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center p-4 text-center">
                  <PackageOpen className="w-8 h-8 text-neutral-300 dark:text-neutral-700 mb-2" />
                  <p className="text-xs text-neutral-400">Inventario sano. No hay alertas críticas de reabastecimiento.</p>
                </div>
              ) : (
                productosCriticos.map(prod => (
                  <div key={prod.id} className="p-3 border-b border-neutral-100 dark:border-neutral-800 last:border-0 flex flex-col gap-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="text-[9px] uppercase tracking-wider font-bold text-neutral-400 flex items-center gap-1">
                          {prod.categoria === 'perfume' ? '✨' : '👜'} {prod.categoria}
                        </span>
                        <p className="text-sm font-bold mt-0.5">{prod.nombre}</p>
                      </div>
                      <span className="text-[10px] font-mono font-bold bg-rose-100 dark:bg-rose-900/50 text-rose-600 dark:text-rose-400 px-1.5 py-0.5 rounded">
                        Faltan {prod.stock_minimo - prod.stock_disponible} u.
                      </span>
                    </div>
                    <div className="flex justify-between items-center mt-1">
                      <p className="text-[10px] text-neutral-500 font-mono">Stock: {prod.stock_disponible} / Min: {prod.stock_minimo}</p>
                      <button className="text-[9px] uppercase font-bold tracking-wider text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer">
                        Generar OC ➔
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* D. CAJA CHICA (COMPONENT) */}
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl flex flex-col overflow-hidden shadow-sm h-72 shrink-0">
            <PettyCashForm expenses={expenses} />
          </div>

        </div>
      </div>
    </div>
  );
};
