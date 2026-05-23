/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from './lib/firebase'; // Configuración compartida de Firebase
import { DashboardOverview } from './components/DashboardOverview';
import { QuickSaleModal } from './components/QuickSaleModal';
import { ERPProduct, InventoryBatch, ERPOrder, PettyCashTransaction } from './types/erp';

export default function App() {
  const [products, setProducts] = useState<ERPProduct[]>([]);
  const [batches, setBatches] = useState<InventoryBatch[]>([]);
  const [orders, setOrders] = useState<ERPOrder[]>([]);
  const [expenses, setExpenses] = useState<PettyCashTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Estado para el modal de Venta Rápida (Atajo F2)
  const [showQuickSale, setShowQuickSale] = useState(false);

  // 1. DISPARADOR GLOBAL DE TECLADO (Entorno de Escritorio Nacio/Tauri)
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      
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
      // F5 o Ctrl+R o Ctrl+Shift+R: Prevenir recargas en la app nativa
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
        setOrders(snap.docs.map(doc => ({ id_orden: doc.id, ...doc.data() } as ERPOrder)));
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

      {/* ÁREA PRINCIPAL DE TRABAJO */}
      <main className="flex-1 relative min-h-0">
        <DashboardOverview 
          products={products}
          batches={batches}
          orders={orders}
          expenses={expenses}
          isLoading={isLoading}
          onOpenQuickSale={() => setShowQuickSale(true)}
        />

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
