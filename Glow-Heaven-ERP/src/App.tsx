/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from './lib/firebase'; // Configuración compartida de Firebase
import { DashboardOverview } from './components/DashboardOverview';
import { QuickSaleModal } from './components/QuickSaleModal';
import { InventoryManagement } from './components/InventoryManagement';
import { CatalogManagement } from './components/CatalogManagement';
import { PhysicalFulfillment } from './components/PhysicalFulfillment';
import { SettingsView } from './components/SettingsView';
import { ERPProduct, InventoryBatch, ERPOrder, PettyCashTransaction } from './types/erp';
import { createProduct, addInventoryBatch, processPEPSSale } from './services/inventoryService';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[ErrorBoundary] Fallo detectado:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="w-full h-full flex flex-col items-center justify-center p-6 bg-neutral-100 dark:bg-neutral-950">
          <div className="bg-white dark:bg-neutral-900 border border-rose-200 dark:border-rose-800 p-6 rounded-2xl max-w-md shadow-lg flex flex-col items-center text-center">
            <div className="w-12 h-12 rounded-full bg-rose-100 dark:bg-rose-950/30 flex items-center justify-center text-rose-600 dark:text-rose-400 mb-4 animate-pulse">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400 mb-2">Error de Renderizado</h3>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-4 leading-relaxed">
              La vista de inventario ha experimentado un fallo y se ha aislado para mantener estable el resto de la aplicación.
            </p>
            <pre className="w-full text-[10px] text-rose-500 font-mono bg-neutral-100 dark:bg-neutral-950 p-3 rounded border border-neutral-200 dark:border-neutral-800 overflow-x-auto text-left max-h-32 mb-4">
              {this.state.error?.message || String(this.state.error)}
            </pre>
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold uppercase tracking-wider cursor-pointer transition-colors"
            >
              Reintentar Renderizado
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  const [products, setProducts] = useState<ERPProduct[]>([]);
  const [batches, setBatches] = useState<InventoryBatch[]>([]);
  const [orders, setOrders] = useState<ERPOrder[]>([]);
  const [expenses, setExpenses] = useState<PettyCashTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Estado para el modal de Venta Rápida (Atajo F2)
  const [showQuickSale, setShowQuickSale] = useState(false);
  const [currentView, setCurrentView] = useState<'dashboard' | 'inventory' | 'catalog' | 'fulfillment' | 'settings'>('dashboard');

  // 1. DISPARADOR GLOBAL DE TECLADO (Entorno de Escritorio Nacio/Tauri)
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      
      // F1: Ir al Dashboard
      if (e.key === 'F1') {
        e.preventDefault();
        setCurrentView('dashboard');
      }
      // F3: Ir al módulo de Catálogo Web
      if (e.key === 'F3') {
        e.preventDefault();
        setCurrentView('catalog');
      }
      // F4: Ir al módulo de Inventario
      if (e.key === 'F4') {
        e.preventDefault();
        setCurrentView('inventory');
      }
      // F5: Ir al módulo de Fulfillment & Logística
      if (e.key === 'F5') {
        e.preventDefault();
        setCurrentView('fulfillment');
      }
      // F6: Ir al módulo de Configuraciones
      if (e.key === 'F6') {
        e.preventDefault();
        setCurrentView('settings');
      }
      // F2: Abrir Venta Rápida
      if (e.key === 'F2') {
        e.preventDefault();
        setShowQuickSale(true);
      }
      // Escape: Cerrar Venta Rápida
      if (e.key === 'Escape' && showQuickSale) {
        e.preventDefault();
        setShowQuickSale(false);
      }
      // F5, Ctrl+R o Ctrl+Shift+R: Prevenir recargas en la app nativa
      if (e.key === 'F5' || (e.ctrlKey && key === 'r')) {
        e.preventDefault();
        console.warn('[ERP OS] Recarga de ventana prevenida para asegurar persistencia del estado en escritorio.');
      }
      // Ctrl+P: Prevenir diálogo de impresión nativa (el ERP tiene botones específicos)
      if (e.ctrlKey && key === 'p') {
        e.preventDefault();
        console.warn('[ERP OS] Diálogo de impresión nativa prevenido. Use la opción de impresión de ticket.');
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [showQuickSale]);

  // 2. CONEXIÓN DIRECTA A FIRESTORE (Listeners en Tiempo Real con Tolerancia a Fallos)
  useEffect(() => {
    console.log('[ERP OS] Inicializando motores de sincronización con Firestore...');

    const unsubProducts = onSnapshot(
      collection(db, 'productos'), 
      (snap) => {
        setProducts(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as ERPProduct)));
      },
      (error) => {
        console.error('[ERP OS] Error de conexión/permisos en la colección "productos":', error);
      }
    );

    const unsubBatches = onSnapshot(
      collection(db, 'inventario_lotes'), 
      (snap) => {
        setBatches(snap.docs.map(doc => ({ id_lote: doc.id, ...doc.data() } as InventoryBatch)));
      },
      (error) => {
        console.error('[ERP OS] Error de conexión/permisos en la colección "inventario_lotes":', error);
      }
    );

    const unsubOrders = onSnapshot(
      collection(db, 'pedidos'), 
      (snap) => {
        const parsedOrders = snap.docs.map(doc => {
          const data = doc.data();
          const exchangeRate = 36.5;

          // Parse and unify cliente structure
          const cliente = {
            nombre: data.cliente?.nombre || data.cliente_nombre || 'Cliente Desconocido',
            telefono: data.cliente?.telefono || data.cliente?.celular || data.cliente_telefono || ''
          };

          // Parse and unify envio structure
          const envio = {
            direccion: data.envio?.direccion || data.cliente_direccion || data.cliente?.direccion || 'Mostrador',
            canal: data.envio?.canal || data.canal || 'whatsapp',
            banco_destino: data.envio?.banco_destino || data.banco_destino || 'banpro'
          };

          // Unify items
          const erpItems = Array.isArray(data.items) ? data.items.map((it: any) => ({
            sku: it.sku || it.producto_id || '',
            nombre: it.nombre || '',
            cantidad: Number(it.cantidad) || 0,
            precio_cobrado: Number(it.precio_cobrado || (it.precio_unitario ? it.precio_unitario * exchangeRate : 0)) || 0,
            costo_peps_calculado: Number(it.costo_peps_calculado) || 0
          })) : [];

          // Unify payment method
          let mappedMetodoPago: 'transferencia' | 'efectivo' = 'transferencia';
          if (data.metodo_pago) {
            const mp = String(data.metodo_pago).toLowerCase();
            if (mp.includes('efectivo')) mappedMetodoPago = 'efectivo';
          }

          // Unify state machine flow
          let mappedEstado: 'pendiente_pago' | 'stock_comprometido' | 'listo_despacho' | 'en_camino' | 'entregado' | 'cancelado' = 'pendiente_pago';
          if (data.estado) {
            const est = String(data.estado);
            if (est === 'Pendiente de Pago' || est === 'pendiente_pago') {
              mappedEstado = 'pendiente_pago';
            } else if (est === 'stock_comprometido') {
              mappedEstado = 'stock_comprometido';
            } else if (est === 'listo_despacho') {
              mappedEstado = 'listo_despacho';
            } else if (est === 'en_camino') {
              mappedEstado = 'en_camino';
            } else if (est === 'Completado' || est === 'entregado') {
              mappedEstado = 'entregado';
            } else if (est === 'Cancelado' || est === 'cancelado') {
              mappedEstado = 'cancelado';
            }
          }

          const totalCs = Number(data.total_cs || (data.total ? data.total * exchangeRate : 0)) || 0;

          return {
            id_orden: doc.id,
            fecha: data.fecha || new Date().toISOString(),
            cliente,
            envio,
            items: erpItems,
            total_cs: totalCs,
            metodo_pago: mappedMetodoPago,
            estado: mappedEstado,
            costo_peps_total_cs: Number(data.costo_peps_total_cs) || 0,
            utilidad_bruta_cs: Number(data.utilidad_bruta_cs) || 0,
            fecha_procesamiento: data.fecha_procesamiento || undefined
          } as ERPOrder;
        });
        setOrders(parsedOrders);
      },
      (error) => {
        console.error('[ERP OS] Error de conexión/permisos en la colección "pedidos":', error);
      }
    );

    const unsubExpenses = onSnapshot(
      collection(db, 'transacciones_financieras'), 
      (snap) => {
        setExpenses(snap.docs.map(doc => ({ id_gasto: doc.id, ...doc.data() } as PettyCashTransaction)));
      },
      (error) => {
        console.error('[ERP OS] Error de conexión/permisos en la colección "transacciones_financieras":', error);
      }
    );

    // Simulando un tiempo de gracia mínimo para pintar la UI inicial (Skeleton)
    const loadTimer = setTimeout(() => setIsLoading(false), 1200);

    return () => {
      console.log('[ERP OS] Apagando sincronización...');
      unsubProducts();
      unsubBatches();
      unsubOrders();
      unsubExpenses();
      clearTimeout(loadTimer);
    };
  }, []);

  return (
    // Contenedor estricto a pantalla completa, previniendo scroll global (Desktop Feel)
    <div className="w-screen h-screen overflow-hidden bg-neutral-100 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 font-sans selection:bg-emerald-500/30 flex flex-col">
      
      {/* Barra de Título Simulada (Para arrastrar la ventana en Tauri/Electron) */}
      <div 
        className="h-8 bg-neutral-200 dark:bg-neutral-900 border-b border-neutral-300 dark:border-neutral-800 flex items-center px-4 shrink-0 select-none"
        style={{ WebkitAppRegion: 'drag' } as any} // Propiedad nativa para Electron
      >
        <div className="flex gap-1.5 mr-4">
          <div className="w-3 h-3 rounded-full bg-rose-500"></div>
          <div className="w-3 h-3 rounded-full bg-amber-500"></div>
          <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
        </div>
        <span className="text-[10px] font-bold tracking-widest uppercase text-neutral-500 dark:text-neutral-400">
          Glow Heaven OS | Terminal ERP Administrativa
        </span>
      </div>

      {/* Barra de Navegación del Sistema ERP */}
      <div className="h-12 bg-white dark:bg-neutral-900 border-b border-neutral-300 dark:border-neutral-800 flex items-center justify-between px-4 shrink-0 shadow-sm z-20">
        <div className="flex gap-2">
          <button 
            onClick={() => setCurrentView('dashboard')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-colors cursor-pointer ${currentView === 'dashboard' ? 'bg-emerald-600 text-white shadow-sm' : 'text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'}`}
          >
            Dashboard <kbd className="text-[9px] font-mono border border-current px-1 rounded opacity-75">F1</kbd>
          </button>
          <button 
            onClick={() => setCurrentView('catalog')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-colors cursor-pointer ${currentView === 'catalog' ? 'bg-emerald-600 text-white shadow-sm' : 'text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'}`}
          >
            Catálogo Web <kbd className="text-[9px] font-mono border border-current px-1 rounded opacity-75">F3</kbd>
          </button>
          <button 
            onClick={() => setCurrentView('inventory')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-colors cursor-pointer ${currentView === 'inventory' ? 'bg-emerald-600 text-white shadow-sm' : 'text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'}`}
          >
            Inventario & Lotes <kbd className="text-[9px] font-mono border border-current px-1 rounded opacity-75">F4</kbd>
          </button>
          <button 
            onClick={() => setCurrentView('fulfillment')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-colors cursor-pointer ${currentView === 'fulfillment' ? 'bg-emerald-600 text-white shadow-sm' : 'text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'}`}
          >
            Fulfillment <kbd className="text-[9px] font-mono border border-current px-1 rounded opacity-75">F5</kbd>
          </button>
          <button 
            onClick={() => setCurrentView('settings')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-colors cursor-pointer ${currentView === 'settings' ? 'bg-emerald-600 text-white shadow-sm' : 'text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'}`}
          >
            Configuración <kbd className="text-[9px] font-mono border border-current px-1 rounded opacity-75">F6</kbd>
          </button>
        </div>

        <div className="flex gap-4 text-[10px] font-mono text-neutral-400 uppercase tracking-widest">
          <span><kbd className="font-bold border border-neutral-300 dark:border-neutral-700 px-1 rounded mr-1">F2</kbd> Venta Física</span>
          <span><kbd className="font-bold border border-neutral-300 dark:border-neutral-700 px-1 rounded mr-1">F6</kbd> Ajustes</span>
          <span><kbd className="font-bold border border-neutral-300 dark:border-neutral-700 px-1 rounded mr-1">Escape</kbd> Cerrar Modal</span>
        </div>
      </div>

      {/* ÁREA PRINCIPAL DE TRABAJO */}
      <main className="flex-1 relative min-h-0">
        {currentView === 'dashboard' ? (
          <DashboardOverview 
            products={products}
            batches={batches}
            orders={orders}
            expenses={expenses}
            isLoading={isLoading}
            onOpenQuickSale={() => setShowQuickSale(true)}
          />
        ) : currentView === 'inventory' ? (
          <ErrorBoundary>
            {/* Cortocorticuito defensivo para asegurar que productos está cargado antes de renderizar */}
            {(products && products.length >= 0) ? (
              <InventoryManagement 
                products={products}
                onCreateProduct={createProduct}
                onAddInventoryBatch={addInventoryBatch}
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center p-6 bg-neutral-100 dark:bg-neutral-950">
                <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                <p className="text-xs text-neutral-400 font-mono">Cargando catálogo de productos...</p>
              </div>
            )}
          </ErrorBoundary>
        ) : currentView === 'fulfillment' ? (
          <ErrorBoundary>
            <PhysicalFulfillment orders={orders} products={products} />
          </ErrorBoundary>
        ) : currentView === 'settings' ? (
          <ErrorBoundary>
            <SettingsView />
          </ErrorBoundary>
        ) : (
          <ErrorBoundary>
            {products ? (
              <CatalogManagement products={products} />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center p-6 bg-neutral-150 dark:bg-neutral-950">
                <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                <p className="text-xs text-neutral-400 font-mono">Cargando catálogo de productos...</p>
              </div>
            )}
          </ErrorBoundary>
        )}

        {/* MODAL F2: VENTA RÁPIDA SUPERPUESTA */}
        {showQuickSale && (
          <QuickSaleModal 
            onClose={() => setShowQuickSale(false)} 
            products={products}
          />
        )}
      </main>
    </div>
  );
}
