/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { ERPProduct } from '../types/erp';
import { createProduct, addInventoryBatch } from '../services/inventoryService';
import { 
  Package, PlusCircle, Search, AlertCircle, 
  Layers, CheckCircle2, ChevronRight, Info 
} from 'lucide-react';

interface InventoryManagementProps {
  products: ERPProduct[];
}

export const InventoryManagement: React.FC<InventoryManagementProps> = ({ products }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFormTab, setActiveFormTab] = useState<'batch' | 'product'>('batch');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // --- Form 1: New Product State ---
  const [newProduct, setNewProduct] = useState({
    sku: '',
    nombre: '',
    marca: '',
    categoria: 'perfume' as 'perfume' | 'accesorio',
    stock_minimo: 5,
    mililitros: 100 as 30 | 50 | 100,
    concentracion: 'EDP' as 'EDT' | 'EDP' | 'Parfum',
    material: '',
    color_banio: ''
  });

  // --- Form 2: New Batch State ---
  const [selectedSku, setSelectedSku] = useState('');
  const [batchQtyStr, setBatchQtyStr] = useState('');
  const [batchCostStr, setBatchCostStr] = useState('');

  // --- Search and Filter ---
  const filteredProducts = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return products.filter(p => 
      p.sku.toLowerCase().includes(term) || 
      p.nombre.toLowerCase().includes(term) ||
      p.marca.toLowerCase().includes(term)
    );
  }, [searchTerm, products]);

  // Handle New Product Submit
  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProduct.sku.trim() || !newProduct.nombre.trim() || !newProduct.marca.trim()) {
      alert('Por favor, completa los campos obligatorios del producto.');
      return;
    }

    try {
      setIsSubmitting(true);
      const productPayload: ERPProduct = {
        id: newProduct.sku.trim(), // SKU acts as document ID
        sku: newProduct.sku.trim().toUpperCase(),
        nombre: newProduct.nombre.trim(),
        marca: newProduct.marca.trim(),
        categoria: newProduct.categoria,
        stock_disponible: 0,
        stock_comprometido: 0,
        stock_minimo: Number(newProduct.stock_minimo),
        activo: true,
        proveedor_id: 'default_prov', // Default value to satisfy types
        ...(newProduct.categoria === 'perfume' ? {
          mililitros: newProduct.mililitros,
          concentracion: newProduct.concentracion
        } : {
          material: newProduct.material.trim(),
          color_banio: newProduct.color_banio.trim()
        })
      };

      await createProduct(productPayload);
      alert('Producto creado exitosamente en el catálogo.');
      
      // Reset form
      setNewProduct({
        sku: '',
        nombre: '',
        marca: '',
        categoria: 'perfume',
        stock_minimo: 5,
        mililitros: 100,
        concentracion: 'EDP',
        material: '',
        color_banio: ''
      });
    } catch (error: any) {
      alert(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Ingest Batch Submit
  const handleIngestBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    const cantidad = parseInt(batchQtyStr);
    const costo = parseFloat(batchCostStr);

    if (!selectedSku) {
      alert('Por favor, selecciona un producto.');
      return;
    }
    if (isNaN(cantidad) || cantidad <= 0) {
      alert('Ingresa una cantidad de unidades válida mayor a 0.');
      return;
    }
    if (isNaN(costo) || costo <= 0) {
      alert('Ingresa un costo de adquisición unitario válido en C$.');
      return;
    }

    try {
      setIsSubmitting(true);
      await addInventoryBatch(selectedSku, cantidad, costo);
      alert(`Ingreso de lote exitoso. Se añadieron ${cantidad} unidades al stock.`);
      
      // Reset form
      setBatchQtyStr('');
      setBatchCostStr('');
    } catch (error: any) {
      alert(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedProductDetails = useMemo(() => {
    return products.find(p => p.sku === selectedSku);
  }, [selectedSku, products]);

  return (
    <div className="flex-1 flex min-h-0 bg-neutral-100 dark:bg-neutral-950 p-4 gap-4">
      
      {/* 1. SECCIÓN IZQUIERDA: MONITOREO DE INVENTARIO (65%) */}
      <div className="w-2/3 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl flex flex-col overflow-hidden shadow-sm h-full">
        
        {/* Header & Buscador */}
        <div className="p-4 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950/50 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-emerald-600 dark:text-emerald-500" />
            <h2 className="text-sm font-bold uppercase tracking-widest text-neutral-800 dark:text-neutral-200">
              Monitoreo Operativo de Lotes
            </h2>
          </div>
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
            <input 
              type="text"
              placeholder="Buscar por SKU o Nombre..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs border border-neutral-200 dark:border-neutral-800 rounded-lg bg-white dark:bg-neutral-900 focus:outline-none focus:border-neutral-400"
            />
          </div>
        </div>

        {/* Tabla */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {filteredProducts.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-center opacity-50">
              <Package className="w-12 h-12 text-neutral-400 mb-2" />
              <p className="text-sm">No se encontraron productos en el catálogo.</p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse text-xs">
              <thead className="sticky top-0 bg-neutral-50 dark:bg-neutral-950 text-[10px] uppercase font-bold tracking-wider text-neutral-400 border-b border-neutral-200 dark:border-neutral-800 z-10">
                <tr>
                  <th className="py-3 px-4">SKU</th>
                  <th className="py-3 px-4">Producto</th>
                  <th className="py-3 px-4">Categoría</th>
                  <th className="py-3 px-4 text-center">Lotes Activos</th>
                  <th className="py-3 px-4 text-right">Disponible</th>
                  <th className="py-3 px-4 text-center">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                {filteredProducts.map(prod => {
                  // Calcular lotes activos (donde cantidad_restante > 0)
                  const lotesList = (prod as any).lotes || [];
                  const activeBatchesCount = lotesList.filter((l: any) => l.cantidad_restante > 0).length;
                  const isUnderStock = prod.stock_disponible <= prod.stock_minimo;

                  return (
                    <tr key={prod.sku} className="hover:bg-neutral-50 dark:hover:bg-neutral-950/30 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-neutral-600 dark:text-neutral-400">
                        {prod.sku}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-neutral-900 dark:text-white">{prod.nombre}</div>
                        <div className="text-[10px] text-neutral-400">{prod.marca}</div>
                      </td>
                      <td className="py-3 px-4 uppercase tracking-wider text-[10px] text-neutral-400">
                        {prod.categoria}
                      </td>
                      <td className="py-3 px-4 text-center font-mono font-bold">
                        {activeBatchesCount > 0 ? (
                          <span className="bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded">
                            {activeBatchesCount} lotes
                          </span>
                        ) : (
                          <span className="bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 px-2 py-0.5 rounded">
                            0 lotes
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold">
                        <div className={`${isUnderStock ? 'text-rose-500' : 'text-neutral-800 dark:text-neutral-200'}`}>
                          {prod.stock_disponible} u.
                        </div>
                        <div className="text-[9px] text-neutral-400">Mín: {prod.stock_minimo} u.</div>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => {
                            setSelectedSku(prod.sku);
                            setActiveFormTab('batch');
                          }}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] uppercase font-bold px-2 py-1.5 rounded-md transition-colors cursor-pointer"
                        >
                          + Lote
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* 2. SECCIÓN DERECHA: FORMULARIOS DE REGISTRO (35%) */}
      <div className="w-1/3 flex flex-col bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl overflow-hidden shadow-sm h-full">
        
        {/* Pestañas de Formulario */}
        <div className="flex border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950/50 shrink-0">
          <button 
            onClick={() => setActiveFormTab('batch')}
            className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider transition-colors ${activeFormTab === 'batch' ? 'border-b-2 border-emerald-500 text-emerald-600 bg-white dark:bg-neutral-900' : 'text-neutral-400 hover:text-neutral-600'}`}
          >
            Abastecer Lote
          </button>
          <button 
            onClick={() => setActiveFormTab('product')}
            className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider transition-colors ${activeFormTab === 'product' ? 'border-b-2 border-emerald-500 text-emerald-600 bg-white dark:bg-neutral-900' : 'text-neutral-400 hover:text-neutral-600'}`}
          >
            Nuevo Producto
          </button>
        </div>

        {/* Contenido de Formularios */}
        <div className="flex-1 p-5 overflow-y-auto">
          
          {/* A. FORMULARIO: INGESTA DE LOTES */}
          {activeFormTab === 'batch' && (
            <form onSubmit={handleIngestBatch} className="flex flex-col gap-4">
              <h3 className="text-xs font-bold uppercase tracking-widest text-neutral-400 flex items-center gap-1.5">
                <PlusCircle className="w-4 h-4 text-emerald-600" /> Ingreso de Mercancía
              </h3>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] uppercase font-bold tracking-wide text-neutral-400">Producto Destino</label>
                <select
                  value={selectedSku}
                  onChange={(e) => setSelectedSku(e.target.value)}
                  disabled={isSubmitting}
                  className="w-full text-xs px-3 py-2 border border-neutral-200 dark:border-neutral-800 rounded bg-neutral-50 dark:bg-neutral-950 focus:outline-none focus:border-neutral-400 cursor-pointer"
                >
                  <option value="">-- Selecciona un Producto --</option>
                  {products.map(p => (
                    <option key={p.sku} value={p.sku}>
                      [{p.sku}] {p.nombre}
                    </option>
                  ))}
                </select>
              </div>

              {selectedProductDetails && (
                <div className="bg-neutral-50 dark:bg-neutral-950/40 p-3 rounded-lg border border-neutral-100 dark:border-neutral-800/50 flex flex-col gap-1 text-[11px]">
                  <span className="font-bold text-neutral-700 dark:text-neutral-300">Resumen Actual del Producto:</span>
                  <span>Categoría: <span className="uppercase">{selectedProductDetails.categoria}</span></span>
                  <span>Marca: {selectedProductDetails.marca}</span>
                  <span>Stock Disponible: <span className="font-mono font-bold text-emerald-600">{selectedProductDetails.stock_disponible} u.</span></span>
                </div>
              )}

              <div className="flex gap-3">
                <div className="flex-1 flex flex-col gap-1.5">
                  <label className="text-[10px] uppercase font-bold tracking-wide text-neutral-400">Cantidad (Unidades)</label>
                  <input 
                    type="number"
                    min="1"
                    step="1"
                    placeholder="Ej: 10"
                    value={batchQtyStr}
                    onChange={(e) => setBatchQtyStr(e.target.value)}
                    disabled={isSubmitting}
                    className="w-full text-xs px-3 py-2 border border-neutral-200 dark:border-neutral-800 rounded bg-neutral-50 dark:bg-neutral-950 focus:outline-none focus:border-neutral-400"
                  />
                </div>

                <div className="flex-1 flex flex-col gap-1.5">
                  <label className="text-[10px] uppercase font-bold tracking-wide text-neutral-400">Costo Unitario (C$)</label>
                  <input 
                    type="number"
                    min="0.01"
                    step="0.01"
                    placeholder="C$ 450.00"
                    value={batchCostStr}
                    onChange={(e) => setBatchCostStr(e.target.value)}
                    disabled={isSubmitting}
                    className="w-full text-xs px-3 py-2 border border-neutral-200 dark:border-neutral-800 rounded bg-neutral-50 dark:bg-neutral-950 focus:outline-none focus:border-neutral-400 font-mono"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold uppercase py-3 rounded-lg text-xs tracking-wider flex items-center justify-center gap-1.5 shadow-md shadow-emerald-500/10 cursor-pointer"
              >
                <PlusCircle className="w-4 h-4" /> Registrar Entrada PEPS
              </button>
            </form>
          )}

          {/* B. FORMULARIO: NUEVO PRODUCTO */}
          {activeFormTab === 'product' && (
            <form onSubmit={handleCreateProduct} className="flex flex-col gap-4">
              <h3 className="text-xs font-bold uppercase tracking-widest text-neutral-400 flex items-center gap-1.5">
                <PlusCircle className="w-4 h-4 text-emerald-600" /> Registrar Nuevo Artículo
              </h3>

              <div className="flex gap-2">
                <div className="w-2/5 flex flex-col gap-1.5">
                  <label className="text-[10px] uppercase font-bold tracking-wide text-neutral-400">SKU (Único)</label>
                  <input 
                    type="text"
                    placeholder="CHANEL5"
                    value={newProduct.sku}
                    onChange={(e) => setNewProduct(prev => ({ ...prev, sku: e.target.value }))}
                    disabled={isSubmitting}
                    className="w-full text-xs px-3 py-2 border border-neutral-200 dark:border-neutral-800 rounded bg-neutral-50 dark:bg-neutral-950 focus:outline-none focus:border-neutral-400 font-mono uppercase"
                  />
                </div>

                <div className="w-3/5 flex flex-col gap-1.5">
                  <label className="text-[10px] uppercase font-bold tracking-wide text-neutral-400">Nombre</label>
                  <input 
                    type="text"
                    placeholder="Chanel N°5"
                    value={newProduct.nombre}
                    onChange={(e) => setNewProduct(prev => ({ ...prev, nombre: e.target.value }))}
                    disabled={isSubmitting}
                    className="w-full text-xs px-3 py-2 border border-neutral-200 dark:border-neutral-800 rounded bg-neutral-50 dark:bg-neutral-950 focus:outline-none focus:border-neutral-400"
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <div className="flex-1 flex flex-col gap-1.5">
                  <label className="text-[10px] uppercase font-bold tracking-wide text-neutral-400">Marca</label>
                  <input 
                    type="text"
                    placeholder="Chanel"
                    value={newProduct.marca}
                    onChange={(e) => setNewProduct(prev => ({ ...prev, marca: e.target.value }))}
                    disabled={isSubmitting}
                    className="w-full text-xs px-3 py-2 border border-neutral-200 dark:border-neutral-800 rounded bg-neutral-50 dark:bg-neutral-950 focus:outline-none focus:border-neutral-400"
                  />
                </div>

                <div className="flex-1 flex flex-col gap-1.5">
                  <label className="text-[10px] uppercase font-bold tracking-wide text-neutral-400">Categoría</label>
                  <select
                    value={newProduct.categoria}
                    onChange={(e) => setNewProduct(prev => ({ ...prev, categoria: e.target.value as any }))}
                    disabled={isSubmitting}
                    className="w-full text-xs px-3 py-2 border border-neutral-200 dark:border-neutral-800 rounded bg-neutral-50 dark:bg-neutral-950 focus:outline-none focus:border-neutral-400 cursor-pointer"
                  >
                    <option value="perfume">✨ Perfume</option>
                    <option value="accesorio">👜 Accesorio</option>
                  </select>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] uppercase font-bold tracking-wide text-neutral-400">Stock Mínimo Alerta</label>
                <input 
                  type="number"
                  min="1"
                  step="1"
                  value={newProduct.stock_minimo}
                  onChange={(e) => setNewProduct(prev => ({ ...prev, stock_minimo: Number(e.target.value) }))}
                  disabled={isSubmitting}
                  className="w-full text-xs px-3 py-2 border border-neutral-200 dark:border-neutral-800 rounded bg-neutral-50 dark:bg-neutral-950 focus:outline-none focus:border-neutral-400"
                />
              </div>

              {/* CAMPOS DINÁMICOS CONDICIONALES */}
              {newProduct.categoria === 'perfume' ? (
                <div className="p-3 bg-emerald-50/50 dark:bg-emerald-950/10 border border-emerald-100 dark:border-emerald-900/30 rounded-xl flex flex-col gap-3">
                  <div className="flex gap-2">
                    <div className="flex-1 flex flex-col gap-1.5">
                      <label className="text-[10px] uppercase font-bold tracking-wide text-neutral-500">Mililitros</label>
                      <select
                        value={newProduct.mililitros}
                        onChange={(e) => setNewProduct(prev => ({ ...prev, mililitros: Number(e.target.value) as any }))}
                        disabled={isSubmitting}
                        className="w-full text-xs px-2 py-1.5 border border-neutral-200 dark:border-neutral-800 rounded bg-white dark:bg-neutral-900 focus:outline-none focus:border-neutral-400"
                      >
                        <option value="30">30 ml</option>
                        <option value="50">50 ml</option>
                        <option value="100">100 ml</option>
                      </select>
                    </div>

                    <div className="flex-1 flex flex-col gap-1.5">
                      <label className="text-[10px] uppercase font-bold tracking-wide text-neutral-500">Concentración</label>
                      <select
                        value={newProduct.concentracion}
                        onChange={(e) => setNewProduct(prev => ({ ...prev, concentracion: e.target.value as any }))}
                        disabled={isSubmitting}
                        className="w-full text-xs px-2 py-1.5 border border-neutral-200 dark:border-neutral-800 rounded bg-white dark:bg-neutral-900 focus:outline-none focus:border-neutral-400"
                      >
                        <option value="EDT">EDT (Eau de Toilette)</option>
                        <option value="EDP">EDP (Eau de Parfum)</option>
                        <option value="Parfum">Parfum</option>
                      </select>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-indigo-50/50 dark:bg-indigo-950/10 border border-indigo-100 dark:border-indigo-900/30 rounded-xl flex flex-col gap-3">
                  <div className="flex gap-2">
                    <div className="flex-1 flex flex-col gap-1.5">
                      <label className="text-[10px] uppercase font-bold tracking-wide text-neutral-500">Material</label>
                      <input 
                        type="text"
                        placeholder="Ej: Acero Inoxidable"
                        value={newProduct.material}
                        onChange={(e) => setNewProduct(prev => ({ ...prev, material: e.target.value }))}
                        disabled={isSubmitting}
                        className="w-full text-xs px-2 py-1.5 border border-neutral-200 dark:border-neutral-800 rounded bg-white dark:bg-neutral-900 focus:outline-none focus:border-neutral-400"
                      />
                    </div>

                    <div className="flex-1 flex flex-col gap-1.5">
                      <label className="text-[10px] uppercase font-bold tracking-wide text-neutral-500">Color / Baño</label>
                      <input 
                        type="text"
                        placeholder="Ej: Bañado en Oro"
                        value={newProduct.color_banio}
                        onChange={(e) => setNewProduct(prev => ({ ...prev, color_banio: e.target.value }))}
                        disabled={isSubmitting}
                        className="w-full text-xs px-2 py-1.5 border border-neutral-200 dark:border-neutral-800 rounded bg-white dark:bg-neutral-900 focus:outline-none focus:border-neutral-400"
                      />
                    </div>
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold uppercase py-3 rounded-lg text-xs tracking-wider flex items-center justify-center gap-1.5 shadow-md shadow-emerald-500/10 cursor-pointer"
              >
                <PlusCircle className="w-4 h-4" /> Crear Producto
              </button>
            </form>
          )}

          <div className="mt-6 p-3 bg-neutral-50 dark:bg-neutral-950/20 border border-neutral-200 dark:border-neutral-800 rounded-lg flex items-start gap-2 text-[10px] text-neutral-400 leading-normal">
            <Info className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-500 mt-0.5" />
            <p>
              Todos los productos nuevos se inicializan con stock cero. Utiliza la pestaña <b>Abastecer Lote</b> para inyectar su inventario inicial con los costos correspondientes.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
