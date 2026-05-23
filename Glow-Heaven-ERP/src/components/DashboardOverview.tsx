import React, { useState, useEffect, useMemo } from 'react';
import { ERPProduct, InventoryBatch, ERPOrder, PettyCashTransaction } from '../types/erp';
import { 
  TrendingUp, Wallet, Activity, Package, AlertTriangle, 
  RefreshCw, CheckCircle, PackageOpen, ArrowUpRight, ArrowDownRight,
  CircleDollarSign, Award, Layers, Receipt, MessageCircle
} from 'lucide-react';
import { PettyCashForm } from './PettyCashForm';

interface DashboardOverviewProps {
  products: ERPProduct[];
  batches: InventoryBatch[];
  orders: ERPOrder[];
  expenses: PettyCashTransaction[];
  isLoading: boolean;
  onOpenQuickSale: () => void;
  businessConfig: any;
}

export const DashboardOverview: React.FC<DashboardOverviewProps> = ({
  products,
  batches,
  orders,
  expenses,
  isLoading,
  onOpenQuickSale,
  businessConfig
}) => {
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [activeTooltip, setActiveTooltip] = useState<{ x: number; y: number; label: string; sales: number; profit: number } | null>(null);

  // Auto-dismiss notifications
  useEffect(() => {
    if (notification) {
      const t = setTimeout(() => setNotification(null), 4000);
      return () => clearTimeout(t);
    }
  }, [notification]);

  // --- KPI CALCULATIONS ---
  const ventasBrutas = useMemo(() => {
    if (!Array.isArray(orders)) return 0;
    return orders
      .filter(o => o && o.estado !== 'pendiente_pago' && o.estado !== 'stock_comprometido' && o.estado !== 'cancelado') // Liquidadas
      .reduce((acc, curr) => acc + (Number(curr.total_cs) || 0), 0);
  }, [orders]);

  const capitalInmovilizado = useMemo(() => {
    if (!Array.isArray(batches)) return 0;
    return batches.reduce((acc, curr) => {
      if (!curr) return acc;
      const qty = Number(curr.cantidad_restante) || 0;
      const cost = Number(curr.costo_adquisicion) || 0;
      return acc + (qty * cost);
    }, 0);
  }, [batches]);

  const gastosTotales = useMemo(() => {
    if (!Array.isArray(expenses)) return 0;
    return expenses
      .filter(e => e && (e as any).tipo === 'gasto_operativo')
      .reduce((acc, curr) => acc + (Number(curr.monto_cs) || 0), 0);
  }, [expenses]);

  const utilidadNeta = useMemo(() => {
    if (!Array.isArray(orders)) return 0;
    const costoMercancia = orders
      .filter(o => o && o.estado !== 'pendiente_pago' && o.estado !== 'stock_comprometido' && o.estado !== 'cancelado')
      .reduce((acc, curr) => {
        const cogs = Number((curr as any).costo_peps_total_cs);
        return acc + (isNaN(cogs) ? 0 : cogs);
      }, 0);
      
    const estimatedCOGS = costoMercancia > 0 ? costoMercancia : ventasBrutas * 0.45; 
    return Math.round((ventasBrutas - estimatedCOGS - gastosTotales) * 100) / 100;
  }, [ventasBrutas, gastosTotales, orders]);

  // --- ALERTS ---
  const productosCriticos = useMemo(() => {
    if (!Array.isArray(products)) return [];
    return products.filter(p => p && (p.stock_disponible || 0) <= (p.stock_minimo || 0) && p.activo);
  }, [products]);

  // --- 1. DYNAMIC SALES & PROFITS HISTORICAL DATA (LAST 7 DAYS) ---
  const last7DaysData = useMemo(() => {
    const days = [];
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      days.push({
        dateStr: d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }),
        dateKey: d.toDateString(),
        sales: 0,
        profit: 0
      });
    }
    
    if (Array.isArray(orders)) {
      orders.forEach(o => {
        if (!o || o.estado === 'cancelado' || o.estado === 'pendiente_pago' || o.estado === 'stock_comprometido') return;
        const oDate = new Date(o.fecha);
        const oDateKey = oDate.toDateString();
        const match = days.find(d => d.dateKey === oDateKey);
        if (match) {
          match.sales += Number(o.total_cs) || 0;
          match.profit += Number(o.utilidad_bruta_cs || o.total_cs * 0.55) || 0; // fallback if profit not recorded
        }
      });
    }
    
    return days;
  }, [orders]);

  // Max value for scaling SVG chart
  const chartScales = useMemo(() => {
    const maxSales = Math.max(...last7DaysData.map(d => d.sales), 100);
    const maxProfit = Math.max(...last7DaysData.map(d => d.profit), 100);
    const maxVal = Math.max(maxSales, maxProfit, 1000);
    return { maxVal, maxSales, maxProfit };
  }, [last7DaysData]);

  // --- 2. PAYMENT METHODS & CHANNELS BREAKDOWN ---
  const paymentBreakdown = useMemo(() => {
    let cashCount = 0;
    let bankCount = 0;
    let totalPaidOrders = 0;

    if (Array.isArray(orders)) {
      orders.forEach(o => {
        if (!o || o.estado === 'cancelado' || o.estado === 'pendiente_pago') return;
        totalPaidOrders++;
        if (o.metodo_pago === 'efectivo') {
          cashCount++;
        } else {
          bankCount++;
        }
      });
    }

    const cashPercent = totalPaidOrders > 0 ? Math.round((cashCount / totalPaidOrders) * 100) : 0;
    const bankPercent = totalPaidOrders > 0 ? Math.round((bankCount / totalPaidOrders) * 100) : 0;
    
    return { cashPercent, bankPercent, totalPaidOrders, cashCount, bankCount };
  }, [orders]);

  // --- 3. TOP SELLING PRODUCTS ---
  const topSellingProducts = useMemo(() => {
    const counts = new Map<string, { sku: string; nombre: string; cant: number; revenue: number }>();
    
    if (Array.isArray(orders)) {
      orders.forEach(o => {
        if (!o || o.estado === 'cancelado' || o.estado === 'pendiente_pago') return;
        const items = o.items || [];
        items.forEach(it => {
          if (!it.sku) return;
          const curr = counts.get(it.sku) || { sku: it.sku, nombre: it.nombre || 'Desconocido', cant: 0, revenue: 0 };
          curr.cant += Number(it.cantidad) || 0;
          curr.revenue += Number(it.precio_cobrado || 0);
          counts.set(it.sku, curr);
        });
      });
    }

    return Array.from(counts.values())
      .sort((a, b) => b.cant - a.cant)
      .slice(0, 4);
  }, [orders]);

  // --- 4. RECENT FINANCIAL ACTIVITY FEED (COMBINED LIST) ---
  const recentFinancialActivity = useMemo(() => {
    const list: Array<{
      id: string;
      fecha: string;
      tipo: 'ingreso_venta' | 'gasto_operativo';
      monto: number;
      descripcion: string;
      categoria?: string;
    }> = [];

    // Add paid orders
    if (Array.isArray(orders)) {
      orders.forEach(o => {
        if (!o || o.estado === 'cancelado' || o.estado === 'pendiente_pago' || o.estado === 'stock_comprometido') return;
        list.push({
          id: o.id_orden,
          fecha: String(o.fecha),
          tipo: 'ingreso_venta',
          monto: o.total_cs,
          descripcion: `Venta #${o.id_orden.slice(-6)} - Cliente: ${o.cliente?.nombre}`
        });
      });
    }

    // Add expenses
    if (Array.isArray(expenses)) {
      expenses.forEach(e => {
        if (!e) return;
        list.push({
          id: e.id_gasto,
          fecha: String(e.fecha),
          tipo: 'gasto_operativo',
          monto: e.monto_cs,
          descripcion: e.descripcion,
          categoria: e.categoria
        });
      });
    }

    // Sort by date descending
    return list
      .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())
      .slice(0, 10);
  }, [orders, expenses]);

  // Sparkline simulation data (percentage comparisons)
  const salesVelocity = useMemo(() => {
    if (last7DaysData.length < 2) return { percent: 0, up: true };
    const today = last7DaysData[6].sales;
    const yesterday = last7DaysData[5].sales;
    if (yesterday === 0) return { percent: today > 0 ? 100 : 0, up: today > 0 };
    const diff = today - yesterday;
    const pct = Math.round((diff / yesterday) * 100);
    return { percent: Math.abs(pct), up: pct >= 0 };
  }, [last7DaysData]);

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

  // Draw sales line points
  const width = 500;
  const height = 180;
  const paddingX = 40;
  const paddingY = 20;
  const pointsSales = last7DaysData.map((d, i) => {
    const x = paddingX + (i * (width - paddingX * 2)) / 6;
    const y = height - paddingY - (d.sales / chartScales.maxVal) * (height - paddingY * 2);
    return { x, y, sales: d.sales, profit: d.profit, label: d.dateStr };
  });

  const pointsProfit = last7DaysData.map((d, i) => {
    const x = paddingX + (i * (width - paddingX * 2)) / 6;
    const y = height - paddingY - (d.profit / chartScales.maxVal) * (height - paddingY * 2);
    return { x, y };
  });

  const salesPath = pointsSales.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const profitPath = pointsProfit.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  
  const salesAreaPath = `${salesPath} L ${pointsSales[pointsSales.length - 1].x} ${height - paddingY} L ${pointsSales[0].x} ${height - paddingY} Z`;
  const profitAreaPath = `${profitPath} L ${pointsProfit[pointsProfit.length - 1].x} ${height - paddingY} L ${pointsProfit[0].x} ${height - paddingY} Z`;

  return (
    <div className="flex-1 p-4 h-full flex flex-col min-h-0 relative bg-neutral-50 dark:bg-neutral-950 font-sans">
      
      {/* HEADER */}
      <header className="flex justify-between items-center mb-4 px-2 shrink-0">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Centro de Control Analítico</h1>
          <p className="text-xs text-neutral-500 font-mono">Terminal ERP Glow Heaven | C$ (NIO) & USD</p>
        </div>
        <div className="flex gap-4 text-[10px] font-mono text-neutral-500 uppercase tracking-widest bg-white dark:bg-neutral-900 px-4 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 shadow-sm">
          <span>T. Cambio: <strong className="text-emerald-600 font-bold">C$ {businessConfig?.tipo_cambio || 36.5}</strong></span>
          <button onClick={onOpenQuickSale} className="hover:text-neutral-900 dark:hover:text-white transition-colors cursor-pointer">
            <kbd className="font-bold border border-neutral-300 dark:border-neutral-700 px-1 rounded mr-1">F2</kbd> Venta Física
          </button>
        </div>
      </header>

      {/* A. KPI CARDS */}
      <div className="grid grid-cols-4 gap-4 mb-4 shrink-0">
        <div className="bg-white dark:bg-neutral-900 p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 flex flex-col shadow-sm relative overflow-hidden group">
          <span className="text-[10px] text-neutral-400 font-bold uppercase tracking-widest flex items-center gap-2 mb-1">
            <CircleDollarSign className="w-3.5 h-3.5 text-emerald-555" /> Ventas Brutas Acumuladas
          </span>
          <span className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400">C$ {ventasBrutas.toLocaleString('es-NI')}</span>
          <div className="flex items-center gap-1 mt-1 text-[10px] font-mono">
            {salesVelocity.up ? (
              <span className="text-emerald-600 dark:text-emerald-400 flex items-center"><ArrowUpRight className="w-3 h-3" /> +{salesVelocity.percent}%</span>
            ) : (
              <span className="text-rose-600 dark:text-rose-400 flex items-center"><ArrowDownRight className="w-3 h-3" /> -{salesVelocity.percent}%</span>
            )}
            <span className="text-neutral-400">vs período anterior</span>
          </div>
        </div>
        
        <div className="bg-white dark:bg-neutral-900 p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 flex flex-col shadow-sm relative overflow-hidden group">
          <span className="text-[10px] text-neutral-400 font-bold uppercase tracking-widest flex items-center gap-2 mb-1">
            <Package className="w-3.5 h-3.5 text-amber-550" /> Capital Inmovilizado
          </span>
          <span className="text-2xl font-bold font-mono text-amber-600 dark:text-amber-400">C$ {capitalInmovilizado.toLocaleString('es-NI')}</span>
          <span className="text-[10px] text-neutral-400 font-mono mt-1">Valorado en costo adquisición</span>
        </div>

        <div className="bg-white dark:bg-neutral-900 p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 flex flex-col shadow-sm relative overflow-hidden group">
          <span className="text-[10px] text-neutral-400 font-bold uppercase tracking-widest flex items-center gap-2 mb-1">
            <Wallet className="w-3.5 h-3.5 text-indigo-550" /> Margen Utilidad Neta
          </span>
          <span className="text-2xl font-bold font-mono text-indigo-600 dark:text-indigo-400">C$ {utilidadNeta.toLocaleString('es-NI')}</span>
          <span className="text-[10px] text-neutral-400 font-mono mt-1">
            Deducido COGS (PEPS) y gastos
          </span>
        </div>

        <div className="bg-white dark:bg-neutral-900 p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 flex flex-col shadow-sm relative overflow-hidden group">
          <span className="text-[10px] text-neutral-400 font-bold uppercase tracking-widest flex items-center gap-2 mb-1">
            <Activity className="w-3.5 h-3.5 text-purple-550" /> Eficiencia Rotación
          </span>
          <span className="text-2xl font-bold font-mono text-purple-600 dark:text-purple-400">
            {products.length > 0 ? Math.round((products.filter(p => (p.stock_disponible || 0) > 0).length / products.length) * 100) : 0}%
          </span>
          <div className="flex items-center gap-2 mt-1">
            <div className="h-1.5 w-full bg-purple-500/20 rounded-full overflow-hidden">
              <div className="h-full bg-purple-500" style={{ width: `${products.length > 0 ? (products.filter(p => (p.stock_disponible || 0) > 0).length / products.length) * 100 : 0}%` }}></div>
            </div>
            <span className="text-[9px] font-bold font-mono">En stock</span>
          </div>
        </div>
      </div>

      {/* LOWER GRID */}
      <div className="grid grid-cols-12 gap-4 flex-1 min-h-0">
        
        {/* LEFT COLUMN: CHARTS & LEDGER (8 COLS) */}
        <div className="col-span-8 flex flex-col gap-4 min-h-0">
          
          {/* B1. PERFORMANCE CHARTS */}
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-4 shadow-sm flex flex-col min-h-0 relative">
            <div className="flex justify-between items-center mb-3 shrink-0">
              <h2 className="text-[11px] font-bold uppercase tracking-widest text-neutral-500 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-500" /> Tendencia Operativa (Últimos 7 días)
              </h2>
              <div className="flex gap-4 text-[10px] font-mono">
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 bg-emerald-500 rounded-full"></span> Ventas</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 bg-indigo-500 rounded-full"></span> Utilidad</span>
              </div>
            </div>
            
            {/* SVG Chart area */}
            <div className="flex-1 w-full relative min-h-0 mt-1">
              <svg className="w-full h-full overflow-visible" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
                <defs>
                  <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity="0.25"/>
                    <stop offset="100%" stopColor="#10b981" stopOpacity="0"/>
                  </linearGradient>
                  <linearGradient id="profitGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#6366f1" stopOpacity="0.25"/>
                    <stop offset="100%" stopColor="#6366f1" stopOpacity="0"/>
                  </linearGradient>
                </defs>

                {/* Gridlines */}
                {[0, 1, 2, 3, 4].map((grid, index) => {
                  const y = paddingY + (index * (height - paddingY * 2)) / 4;
                  return (
                    <g key={index}>
                      <line x1={paddingX} y1={y} x2={width - paddingX} y2={y} stroke="#e5e5e5" strokeDasharray="3 3" className="dark:stroke-neutral-800"/>
                      <text x={paddingX - 10} y={y + 3} textAnchor="end" className="fill-neutral-400 font-mono text-[8px]">
                        {(chartScales.maxVal - (index * chartScales.maxVal) / 4).toLocaleString('es-NI', { notation: 'compact' })}
                      </text>
                    </g>
                  );
                })}

                {/* Draw X Axis labels */}
                {last7DaysData.map((d, i) => {
                  const x = paddingX + (i * (width - paddingX * 2)) / 6;
                  return (
                    <text key={i} x={x} y={height - 4} textAnchor="middle" className="fill-neutral-400 font-mono text-[8px]">
                      {d.dateStr}
                    </text>
                  );
                })}

                {/* Areas */}
                <path d={salesAreaPath} fill="url(#salesGrad)" />
                <path d={profitAreaPath} fill="url(#profitGrad)" />

                {/* Paths */}
                <path d={salesPath} fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                <path d={profitPath} fill="none" stroke="#6366f1" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>

                {/* Node Circles */}
                {pointsSales.map((p, i) => (
                  <circle 
                    key={i} 
                    cx={p.x} 
                    cy={p.y} 
                    r="4" 
                    fill="#10b981" 
                    stroke="#ffffff" 
                    strokeWidth="1.5"
                    className="cursor-pointer hover:r-5 transition-all"
                    onMouseEnter={(e) => setActiveTooltip({
                      x: p.x,
                      y: p.y,
                      label: p.label,
                      sales: p.sales,
                      profit: p.profit
                    })}
                    onMouseLeave={() => setActiveTooltip(null)}
                  />
                ))}

                {pointsProfit.map((p, i) => (
                  <circle 
                    key={i} 
                    cx={p.x} 
                    cy={p.y} 
                    r="4" 
                    fill="#6366f1" 
                    stroke="#ffffff" 
                    strokeWidth="1.5"
                    className="cursor-pointer hover:r-5 transition-all"
                  />
                ))}
              </svg>

              {/* Tooltip Overlay */}
              {activeTooltip && (
                <div 
                  className="absolute bg-white/95 dark:bg-neutral-900/95 border border-neutral-200 dark:border-neutral-800 p-2.5 rounded-lg shadow-lg text-[10px] font-mono z-20 pointer-events-none"
                  style={{ left: activeTooltip.x - 50, top: activeTooltip.y - 85 }}
                >
                  <p className="font-bold text-neutral-800 dark:text-neutral-200 border-b border-neutral-100 dark:border-neutral-800 pb-1 mb-1">{activeTooltip.label}</p>
                  <p className="text-emerald-600">Ventas: C$ {activeTooltip.sales.toLocaleString('es-NI')}</p>
                  <p className="text-indigo-600">Utilidad: C$ {activeTooltip.profit.toLocaleString('es-NI')}</p>
                </div>
              )}
            </div>
          </div>

          {/* B2. RECENT FINANCIAL ACTIVITY LEDGER */}
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl flex flex-col min-h-0 flex-1 shadow-sm overflow-hidden">
            <div className="p-3 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950/40 flex justify-between items-center shrink-0">
              <h2 className="text-[11px] font-bold uppercase tracking-widest text-neutral-500 flex items-center gap-2">
                <Receipt className="w-4 h-4 text-neutral-400" /> Bitácora Contable y Transacciones Recientes
              </h2>
              <span className="text-[9px] font-mono text-neutral-400 uppercase">Historial del Período</span>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-neutral-100 dark:divide-neutral-850 p-2 text-xs">
              {recentFinancialActivity.length === 0 ? (
                <div className="h-32 flex items-center justify-center text-neutral-400 italic">
                  No hay actividades financieras registradas en este ciclo.
                </div>
              ) : (
                recentFinancialActivity.map(act => (
                  <div key={act.id} className="py-2.5 px-2 flex justify-between items-center hover:bg-neutral-50/50 dark:hover:bg-neutral-950/20 transition-all rounded-lg">
                    <div className="flex items-center gap-3">
                      <span className={`w-2 h-2 rounded-full ${act.tipo === 'ingreso_venta' ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
                      <div>
                        <p className="font-bold text-neutral-800 dark:text-neutral-200">{act.descripcion}</p>
                        <p className="text-[9px] text-neutral-400 font-mono">
                          {new Date(act.fecha).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                          {act.categoria && ` • Categoría: ${act.categoria.toUpperCase()}`}
                        </p>
                      </div>
                    </div>
                    <span className={`font-bold font-mono ${act.tipo === 'ingreso_venta' ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {act.tipo === 'ingreso_venta' ? '+' : '-'} C$ {act.monto.toLocaleString('es-NI')}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>

        {/* RIGHT COLUMN: ALERTS, TOP PRODUCTS & PETTY CASH (4 COLS) */}
        <div className="col-span-4 flex flex-col gap-4 min-h-0">
          
          {/* C. ALERTAS DE REABASTECIMIENTO CRÍTICO */}
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl flex flex-col overflow-hidden shadow-sm h-48 shrink-0">
            <div className="p-3 border-b border-rose-100 dark:border-rose-900/30 bg-rose-50/50 dark:bg-rose-950/20">
              <h2 className="text-[11px] font-bold uppercase tracking-widest text-rose-600 dark:text-rose-400 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" /> Alertas de Reabastecimiento
              </h2>
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              {productosCriticos.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center p-4 text-center opacity-60">
                  <PackageOpen className="w-8 h-8 text-neutral-300 dark:text-neutral-700 mb-1" />
                  <p className="text-[10px] text-neutral-400 italic">Catálogo saludable. Sin alertas.</p>
                </div>
              ) : (
                productosCriticos.map(prod => (
                  <div key={prod.sku || prod.id} className="p-2 border-b border-neutral-100 dark:border-neutral-800/50 last:border-0 flex justify-between items-center text-xs">
                    <div>
                      <p className="font-bold text-neutral-800 dark:text-neutral-200">{prod.nombre}</p>
                      <p className="text-[9px] text-neutral-400 font-mono">Stock: {prod.stock_disponible} / Min: {prod.stock_minimo}</p>
                    </div>
                    <span className="text-[9px] font-mono font-bold bg-rose-100 dark:bg-rose-950 text-rose-600 dark:text-rose-400 px-1.5 py-0.5 rounded">
                      Falta {prod.stock_minimo - prod.stock_disponible} u.
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* E. TOP SELLING PRODUCTS */}
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl flex flex-col overflow-hidden shadow-sm h-64 shrink-0">
            <div className="p-3 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950/40">
              <h2 className="text-[11px] font-bold uppercase tracking-widest text-neutral-500 flex items-center gap-2">
                <Award className="w-4 h-4 text-amber-550" /> Productos Más Populares (Top 4)
              </h2>
            </div>
            <div className="flex-1 p-3 space-y-3 justify-center flex flex-col">
              {topSellingProducts.length === 0 ? (
                <div className="text-center text-xs text-neutral-400 italic">No hay historial de ventas.</div>
              ) : (
                topSellingProducts.map((p, idx) => {
                  const maxQty = topSellingProducts[0].cant || 1;
                  const ratio = Math.round((p.cant / maxQty) * 100);

                  return (
                    <div key={p.sku} className="space-y-1">
                      <div className="flex justify-between items-center text-xs">
                        <span className="truncate max-w-[70%] font-bold text-neutral-800 dark:text-neutral-200">
                          {idx + 1}. {p.nombre}
                        </span>
                        <span className="font-mono text-neutral-400 text-[10px]">
                          {p.cant} u. (C$ {p.revenue.toLocaleString('es-NI')})
                        </span>
                      </div>
                      <div className="h-1.5 w-full bg-neutral-100 dark:bg-neutral-800 rounded-full overflow-hidden">
                        <div className="h-full bg-amber-500" style={{ width: `${ratio}%` }}></div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* D. CAJA CHICA (INPUT FORM) */}
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl flex flex-col overflow-hidden shadow-sm h-64 shrink-0">
            <PettyCashForm expenses={expenses} />
          </div>

        </div>
      </div>
    </div>
  );
};
