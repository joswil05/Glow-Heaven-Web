/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { ERPProduct, InventoryBatch } from '../types/erp';
import { deleteProduct, uploadProductImage, updateProduct } from '../services/inventoryService';
import { 
  Package, PlusCircle, Search, AlertCircle, 
  Layers, CheckCircle2, Info, Trash2, Upload, Edit3, X
} from 'lucide-react';

interface InventoryManagementProps {
  products: ERPProduct[];
  onCreateProduct: (product: ERPProduct) => Promise<void>;
  onAddInventoryBatch: (sku: string, cantidad: number, costoAdquisicion: number) => Promise<void>;
}

export const InventoryManagement: React.FC<InventoryManagementProps> = ({ 
  products,
  onCreateProduct,
  onAddInventoryBatch
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFormTab, setActiveFormTab] = useState<'batch' | 'product'>('batch');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // --- Form Error/Success States (Try/Catch UI feedback) ---
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

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
    color_banio: '',
    imagenUrl: ''
  });

  // --- Form 2: New Batch State ---
  const [selectedSku, setSelectedSku] = useState('');
  const [batchQtyStr, setBatchQtyStr] = useState('');
  const [batchCostStr, setBatchCostStr] = useState('');

  // --- Form 3: Edit Product State ---
  const [editingProduct, setEditingProduct] = useState<ERPProduct | null>(null);
  const [editForm, setEditForm] = useState({
    nombre: '',
    marca: '',
    categoria: 'perfume' as 'perfume' | 'accesorio',
    stock_minimo: 5,
    precio: 0,
    mililitros: 100 as 30 | 50 | 100,
    concentracion: 'EDP' as 'EDT' | 'EDP' | 'Parfum',
    material: '',
    color_banio: '',
    imagenUrl: ''
  });

  const handleOpenEditModal = (product: ERPProduct) => {
    setEditingProduct(product);
    setEditForm({
      nombre: product.nombre || '',
      marca: product.marca || '',
      categoria: product.categoria || 'perfume',
      stock_minimo: product.stock_minimo || 0,
      precio: product.precio || 0,
      mililitros: product.mililitros || 100,
      concentracion: product.concentracion || 'EDP',
      material: product.material || '',
      color_banio: product.color_banio || '',
      imagenUrl: product.imagenUrl || ''
    });
    setFormError(null);
    setFormSuccess(null);
  };

  const handleEditProductImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editingProduct) return;

    setIsSubmitting(true);
    setFormError(null);
    setFormSuccess(null);

    try {
      setFormSuccess("Subiendo imagen...");
      const url = await uploadProductImage(editingProduct.sku, file);
      setEditForm(prev => ({ ...prev, imagenUrl: url }));
      setFormSuccess("¡Imagen subida con éxito!");
    } catch (error: any) {
      console.error('[InventoryManagement] Error al subir imagen de edición:', error);
      setFormError(`Error al subir imagen: ${error.message || String(error)}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveProductEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;

    setFormError(null);
    setFormSuccess(null);

    if (!editForm.nombre.trim() || !editForm.marca.trim()) {
      setFormError('Por favor, completa los campos obligatorios (Nombre y Marca).');
      return;
    }

    try {
      setIsSubmitting(true);
      const updatePayload: Record<string, any> = {
        id: editingProduct.id || editingProduct.sku,
        nombre: editForm.nombre.trim(),
        marca: editForm.marca.trim(),
        categoria: editForm.categoria,
        stock_minimo: Number(editForm.stock_minimo) || 0,
        precio: Number(editForm.precio) || 0,
        stock: typeof editingProduct.stock === 'number' ? editingProduct.stock : (editingProduct.stock_disponible || 0),
        imagenUrl: editForm.imagenUrl || '',
        ...(editForm.categoria === 'perfume' ? {
          mililitros: editForm.mililitros,
          concentracion: editForm.concentracion,
          material: null,
          color_banio: null
        } : {
          material: editForm.material.trim(),
          color_banio: editForm.color_banio.trim(),
          mililitros: null,
          concentracion: null
        })
      };

      await updateProduct(editingProduct.sku, updatePayload);
      setFormSuccess(`¡Producto "${editForm.nombre}" actualizado exitosamente!`);
      setTimeout(() => {
        setEditingProduct(null);
        setFormSuccess(null);
      }, 1500);
    } catch (error: any) {
      console.error('[InventoryManagement] Error al guardar edición:', error);
      setFormError(error.message || 'Error inesperado al actualizar el producto.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Tab Switch & Reset Statuses
  const handleTabChange = (tab: 'batch' | 'product') => {
    setActiveFormTab(tab);
    setFormError(null);
    setFormSuccess(null);
  };

  // --- Search and Filter ---
  const filteredProducts = useMemo(() => {
    const term = (searchTerm || '').toLowerCase().trim();
    if (!Array.isArray(products)) return [];
    return products.filter(p => {
      if (!p) return false;
      const sku = (p.sku || '').toLowerCase();
      const nombre = (p.nombre || '').toLowerCase();
      const marca = (p.marca || '').toLowerCase();
      return sku.includes(term) || nombre.includes(term) || marca.includes(term);
    });
  }, [searchTerm, products]);

  // --- Memoized Options for Selector Dropdown ---
  const productOptions = useMemo(() => {
    if (!Array.isArray(products)) return [];
    return products
      .filter(p => p && p.sku)
      .map(p => ({
        sku: p.sku,
        nombre: p.nombre || ''
      }));
  }, [products]);

  // --- Memoized Product Details ---
  const selectedProductDetails = useMemo(() => {
    if (!selectedSku || !Array.isArray(products)) return undefined;
    return products.find(p => p && p.sku === selectedSku);
  }, [selectedSku, products]);

  // Handle uploading product image for new product
  const handleNewProductImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const sku = newProduct.sku.trim().toUpperCase();
    if (!file || !sku) return;

    setIsSubmitting(true);
    setFormError(null);
    setFormSuccess(null);

    try {
      setFormSuccess("Subiendo imagen a Firebase Storage...");
      const url = await uploadProductImage(sku, file);
      setNewProduct(prev => ({ ...prev, imagenUrl: url }));
      setFormSuccess("¡Imagen subida con éxito!");
    } catch (error: any) {
      console.error('[InventoryManagement] Error al subir imagen de nuevo producto:', error);
      setFormError(`Error al subir imagen: ${error.message || String(error)}`);
      setFormSuccess(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle deleting a product
  const handleDeleteProduct = async (product: ERPProduct) => {
    const idOrSku = product.sku || product.id;
    if (window.confirm(`⚠️ ¿Estás seguro de que deseas ELIMINAR el producto "${product.nombre}" (${idOrSku}) del sistema? Esta acción eliminará el producto del ERP, de la tienda web y borrará de forma permanente todos sus lotes asociados. Esta acción no se puede deshacer.`)) {
      setIsSubmitting(true);
      setFormError(null);
      setFormSuccess(null);

      try {
        await deleteProduct(idOrSku);
        setFormSuccess(`¡Producto "${product.nombre}" eliminado con éxito!`);
        if (selectedSku === idOrSku) {
          setSelectedSku('');
        }
      } catch (error: any) {
        console.error('[InventoryManagement] Error al eliminar producto:', error);
        setFormError(`Error al eliminar el producto: ${error.message || String(error)}`);
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  // Handle New Product Submit
  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    const skuUpper = newProduct.sku.trim().toUpperCase();
    if (!skuUpper || !newProduct.nombre.trim() || !newProduct.marca.trim()) {
      setFormError('Por favor, completa los campos obligatorios del producto (SKU, Nombre y Marca).');
      return;
    }

    // Validación de SKU duplicado localmente
    if (products && products.some(p => p && p.sku && p.sku.toUpperCase() === skuUpper)) {
      setFormError('El SKU ya existe en el catálogo.');
      return;
    }

    try {
      setIsSubmitting(true);
      const productPayload: ERPProduct = {
        id: skuUpper, // SKU acts as document ID
        sku: skuUpper,
        nombre: newProduct.nombre.trim(),
        marca: newProduct.marca.trim(),
        categoria: newProduct.categoria,
        stock_disponible: 0,
        stock_comprometido: 0,
        stock_minimo: Number(newProduct.stock_minimo) || 0,
        activo: true,
        proveedor_id: 'default_prov',
        lotes: [],
        imagenUrl: newProduct.imagenUrl || '',
        ...(newProduct.categoria === 'perfume' ? {
          mililitros: newProduct.mililitros,
          concentracion: newProduct.concentracion
        } : {
          material: newProduct.material.trim(),
          color_banio: newProduct.color_banio.trim()
        })
      };

      await onCreateProduct(productPayload);
      setFormSuccess(`Producto "${productPayload.nombre}" creado exitosamente en el catálogo.`);
      
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
        color_banio: '',
        imagenUrl: ''
      });
    } catch (error: any) {
      console.error('[InventoryManagement] Error al crear producto:', error);
      setFormError(error.message || 'Error inesperado al crear el producto.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Ingest Batch Submit
  const handleIngestBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    const cantidad = Number(batchQtyStr);
    const costo = Number(batchCostStr);

    if (!selectedSku) {
      setFormError('Por favor, selecciona un producto.');
      return;
    }
    
    // Validar cantidad entera mayor a 0
    if (isNaN(cantidad) || cantidad <= 0 || !Number.isInteger(cantidad)) {
      setFormError('La cantidad de reabastecimiento debe ser un número entero mayor a 0.');
      return;
    }

    // Validar costo mayor a 0
    if (isNaN(costo) || costo <= 0) {
      setFormError('El costo de adquisición debe ser un número válido mayor a 0 en C$.');
      return;
    }

    try {
      setIsSubmitting(true);
      await onAddInventoryBatch(selectedSku, cantidad, costo);
      setFormSuccess(`Ingreso de lote exitoso. Se añadieron ${cantidad} unidades al producto "${selectedSku}".`);
      
      // Reset form fields
      setBatchQtyStr('');
      setBatchCostStr('');
    } catch (error: any) {
      console.error('[InventoryManagement] Error en reabastecimiento:', error);
      setFormError(error.message || 'Error inesperado al añadir el lote de inventario.');
    } finally {
      setIsSubmitting(false);
    }
  };

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
                  const lotesList = prod.lotes || [];
                  const activeBatchesCount = lotesList.filter((l: any) => l && l.cantidad_restante > 0).length;
                  const isUnderStock = (prod.stock_disponible || 0) <= (prod.stock_minimo || 0);

                  return (
                    <tr key={prod.sku || prod.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-950/30 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-neutral-600 dark:text-neutral-400">
                        {prod.sku || prod.id}
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
                          {prod.stock_disponible || 0} u.
                        </div>
                        <div className="text-[9px] text-neutral-400">Mín: {prod.stock_minimo || 0} u.</div>
                      </td>
                      <td className="py-3 px-4 text-center flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => {
                            setSelectedSku(prod.sku || prod.id);
                            handleTabChange('batch');
                          }}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] uppercase font-bold px-2 py-1.5 rounded-md transition-colors cursor-pointer"
                        >
                          + Lote
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenEditModal(prod)}
                          disabled={isSubmitting}
                          className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white p-1.5 rounded-md transition-colors cursor-pointer"
                          title="Editar producto"
                        >
                          <Edit3 className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteProduct(prod)}
                          disabled={isSubmitting}
                          className="bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white p-1.5 rounded-md transition-colors cursor-pointer"
                          title="Eliminar producto"
                        >
                          <Trash2 className="w-3 h-3" />
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
            onClick={() => handleTabChange('batch')}
            className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider transition-colors ${activeFormTab === 'batch' ? 'border-b-2 border-emerald-500 text-emerald-600 bg-white dark:bg-neutral-900' : 'text-neutral-400 hover:text-neutral-600'}`}
          >
            Abastecer Lote
          </button>
          <button 
            onClick={() => handleTabChange('product')}
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

              {formError && (
                <div className="p-3 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 rounded-lg flex items-start gap-2 text-xs text-rose-600 dark:text-rose-400 font-medium animate-fadeIn">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-500 mt-0.5" />
                  <span>{formError}</span>
                </div>
              )}

              {formSuccess && (
                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-lg flex items-start gap-2 text-xs text-emerald-600 dark:text-emerald-400 font-medium animate-fadeIn">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500 mt-0.5" />
                  <span>{formSuccess}</span>
                </div>
              )}

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] uppercase font-bold tracking-wide text-neutral-400">Producto Destino</label>
                <select
                  value={selectedSku}
                  onChange={(e) => setSelectedSku(e.target.value)}
                  disabled={isSubmitting}
                  className="w-full text-xs px-3 py-2 border border-neutral-200 dark:border-neutral-800 rounded bg-neutral-50 dark:bg-neutral-950 focus:outline-none focus:border-neutral-400 cursor-pointer text-neutral-900 dark:text-neutral-100"
                >
                  <option value="">-- Selecciona un Producto --</option>
                  {productOptions.map(p => (
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
                  <span>Stock Disponible: <span className="font-mono font-bold text-emerald-600">{selectedProductDetails.stock_disponible || 0} u.</span></span>
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
                    className="w-full text-xs px-3 py-2 border border-neutral-200 dark:border-neutral-800 rounded bg-neutral-50 dark:bg-neutral-950 focus:outline-none focus:border-neutral-400 text-neutral-900 dark:text-neutral-100"
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
                    className="w-full text-xs px-3 py-2 border border-neutral-200 dark:border-neutral-800 rounded bg-neutral-50 dark:bg-neutral-950 focus:outline-none focus:border-neutral-400 font-mono text-neutral-900 dark:text-neutral-100"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold uppercase py-3 rounded-lg text-xs tracking-wider flex items-center justify-center gap-1.5 shadow-md shadow-emerald-500/10 cursor-pointer transition-colors"
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

              {formError && (
                <div className="p-3 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 rounded-lg flex items-start gap-2 text-xs text-rose-600 dark:text-rose-400 font-medium animate-fadeIn">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-500 mt-0.5" />
                  <span>{formError}</span>
                </div>
              )}

              {formSuccess && (
                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-lg flex items-start gap-2 text-xs text-emerald-600 dark:text-emerald-400 font-medium animate-fadeIn">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500 mt-0.5" />
                  <span>{formSuccess}</span>
                </div>
              )}

              <div className="flex gap-2">
                <div className="w-2/5 flex flex-col gap-1.5">
                  <label className="text-[10px] uppercase font-bold tracking-wide text-neutral-400">SKU (Único)</label>
                  <input 
                    type="text"
                    placeholder="CHANEL5"
                    value={newProduct.sku}
                    onChange={(e) => setNewProduct(prev => ({ ...prev, sku: e.target.value }))}
                    disabled={isSubmitting}
                    className="w-full text-xs px-3 py-2 border border-neutral-200 dark:border-neutral-800 rounded bg-neutral-50 dark:bg-neutral-950 focus:outline-none focus:border-neutral-400 font-mono uppercase text-neutral-900 dark:text-neutral-100"
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
                    className="w-full text-xs px-3 py-2 border border-neutral-200 dark:border-neutral-800 rounded bg-neutral-50 dark:bg-neutral-950 focus:outline-none focus:border-neutral-400 text-neutral-900 dark:text-neutral-100"
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
                    className="w-full text-xs px-3 py-2 border border-neutral-200 dark:border-neutral-800 rounded bg-neutral-50 dark:bg-neutral-950 focus:outline-none focus:border-neutral-400 text-neutral-900 dark:text-neutral-100"
                  />
                </div>

                <div className="flex-1 flex flex-col gap-1.5">
                  <label className="text-[10px] uppercase font-bold tracking-wide text-neutral-400">Categoría</label>
                  <select
                    value={newProduct.categoria}
                    onChange={(e) => setNewProduct(prev => ({ ...prev, categoria: e.target.value as any }))}
                    disabled={isSubmitting}
                    className="w-full text-xs px-3 py-2 border border-neutral-200 dark:border-neutral-800 rounded bg-neutral-50 dark:bg-neutral-950 focus:outline-none focus:border-neutral-400 cursor-pointer text-neutral-900 dark:text-neutral-100"
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
                  className="w-full text-xs px-3 py-2 border border-neutral-200 dark:border-neutral-800 rounded bg-neutral-50 dark:bg-neutral-950 focus:outline-none focus:border-neutral-400 text-neutral-900 dark:text-neutral-100"
                />
              </div>

              {/* Upload image from PC */}
              <div className="flex flex-col gap-1.5 bg-neutral-50 dark:bg-neutral-950 p-3 rounded-lg border border-neutral-200 dark:border-neutral-800">
                <label className="text-[10px] uppercase font-bold tracking-wide text-neutral-400 flex items-center gap-1">
                  <Upload className="w-3.5 h-3.5" /> Imagen de Portada (Opcional)
                </label>
                <div className="flex items-center gap-3">
                  <label className={`flex-1 text-center bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-800 rounded px-3 py-2 cursor-pointer text-xs font-bold transition-all text-neutral-800 dark:text-neutral-200 ${newProduct.sku.trim() ? 'hover:border-emerald-500' : 'opacity-50 cursor-not-allowed'}`}>
                    {newProduct.imagenUrl ? "✓ Imagen Cargada" : "Subir de PC"}
                    <input 
                      type="file" 
                      accept="image/*" 
                      onChange={handleNewProductImageUpload} 
                      className="hidden" 
                      disabled={isSubmitting || !newProduct.sku.trim()}
                    />
                  </label>
                  {newProduct.imagenUrl && (
                    <div className="w-8 h-8 rounded border overflow-hidden flex items-center justify-center shrink-0">
                      <img src={newProduct.imagenUrl} alt="Preview" className="w-full h-full object-cover" />
                    </div>
                  )}
                </div>
                {!newProduct.sku.trim() && (
                  <span className="text-[9px] text-rose-500 font-medium">Escribe el SKU antes de subir la imagen.</span>
                )}
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
                        className="w-full text-xs px-2 py-1.5 border border-neutral-200 dark:border-neutral-800 rounded bg-white dark:bg-neutral-900 focus:outline-none focus:border-neutral-400 text-neutral-900 dark:text-neutral-100"
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
                        className="w-full text-xs px-2 py-1.5 border border-neutral-200 dark:border-neutral-800 rounded bg-white dark:bg-neutral-900 focus:outline-none focus:border-neutral-400 text-neutral-900 dark:text-neutral-100"
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
                        className="w-full text-xs px-2 py-1.5 border border-neutral-200 dark:border-neutral-800 rounded bg-white dark:bg-neutral-900 focus:outline-none focus:border-neutral-400 text-neutral-900 dark:text-neutral-100"
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
                        className="w-full text-xs px-2 py-1.5 border border-neutral-200 dark:border-neutral-800 rounded bg-white dark:bg-neutral-900 focus:outline-none focus:border-neutral-400 text-neutral-900 dark:text-neutral-100"
                      />
                    </div>
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold uppercase py-3 rounded-lg text-xs tracking-wider flex items-center justify-center gap-1.5 shadow-md shadow-emerald-500/10 cursor-pointer transition-colors"
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

      {/* 3. MODAL DE EDICIÓN DE PRODUCTO */}
      {editingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fadeIn">
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl max-w-md w-full shadow-2xl flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="p-4 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950/40 flex justify-between items-center shrink-0">
              <div>
                <h3 className="font-bold text-sm text-neutral-800 dark:text-neutral-200 flex items-center gap-1.5">
                  <Edit3 className="w-4 h-4 text-emerald-500" /> Editar Ficha de Producto
                </h3>
                <p className="text-[10px] text-neutral-400 font-mono mt-0.5">SKU: {editingProduct.sku}</p>
              </div>
              <button 
                onClick={() => setEditingProduct(null)}
                className="text-neutral-450 hover:text-neutral-600 dark:hover:text-neutral-200 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body / Form */}
            <form onSubmit={handleSaveProductEdit} className="p-5 flex-1 overflow-y-auto space-y-4 max-h-[75vh]">
              {formError && (
                <div className="p-3 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 rounded-lg flex items-start gap-2 text-xs text-rose-600 dark:text-rose-400 font-medium">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-500 mt-0.5" />
                  <span>{formError}</span>
                </div>
              )}

              {formSuccess && (
                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-lg flex items-start gap-2 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500 mt-0.5" />
                  <span>{formSuccess}</span>
                </div>
              )}

              {/* Nombre */}
              <div className="flex flex-col gap-1">
                <label className="text-[10px] uppercase font-bold tracking-wide text-neutral-450">Nombre</label>
                <input 
                  type="text"
                  value={editForm.nombre}
                  onChange={(e) => setEditForm(prev => ({ ...prev, nombre: e.target.value }))}
                  className="w-full text-xs px-3 py-2 border border-neutral-200 dark:border-neutral-800 rounded bg-neutral-50 dark:bg-neutral-950 focus:outline-none focus:border-neutral-400 text-neutral-900 dark:text-neutral-100"
                  required
                />
              </div>

              {/* Marca y Categoría */}
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] uppercase font-bold tracking-wide text-neutral-450">Marca</label>
                  <input 
                    type="text"
                    value={editForm.marca}
                    onChange={(e) => setEditForm(prev => ({ ...prev, marca: e.target.value }))}
                    className="w-full text-xs px-3 py-2 border border-neutral-200 dark:border-neutral-800 rounded bg-neutral-50 dark:bg-neutral-955 focus:outline-none focus:border-neutral-400 text-neutral-900 dark:text-neutral-100"
                    required
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] uppercase font-bold tracking-wide text-neutral-450">Categoría</label>
                  <select
                    value={editForm.categoria}
                    onChange={(e) => setEditForm(prev => ({ ...prev, categoria: e.target.value as any }))}
                    className="w-full text-xs px-3 py-2 border border-neutral-200 dark:border-neutral-800 rounded bg-neutral-50 dark:bg-neutral-955 focus:outline-none focus:border-neutral-400 text-neutral-900 dark:text-neutral-100 cursor-pointer"
                  >
                    <option value="perfume">✨ Perfume</option>
                    <option value="accesorio">👜 Accesorio</option>
                  </select>
                </div>
              </div>

              {/* Stock Mínimo y Precio Web */}
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] uppercase font-bold tracking-wide text-neutral-455">Stock Mínimo</label>
                  <input 
                    type="number"
                    min="0"
                    value={editForm.stock_minimo}
                    onChange={(e) => setEditForm(prev => ({ ...prev, stock_minimo: Number(e.target.value) }))}
                    className="w-full text-xs px-3 py-2 border border-neutral-200 dark:border-neutral-800 rounded bg-neutral-50 dark:bg-neutral-955 focus:outline-none focus:border-neutral-400 text-neutral-900 dark:text-neutral-100"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] uppercase font-bold tracking-wide text-neutral-455">Precio Web (USD)</label>
                  <input 
                    type="number"
                    step="0.01"
                    min="0"
                    value={editForm.precio}
                    onChange={(e) => setEditForm(prev => ({ ...prev, precio: Number(e.target.value) }))}
                    className="w-full text-xs px-3 py-2 border border-neutral-200 dark:border-neutral-800 rounded bg-neutral-50 dark:bg-neutral-955 focus:outline-none focus:border-neutral-400 font-mono text-neutral-900 dark:text-neutral-100"
                  />
                </div>
              </div>

              {/* Condicionales por Categoría */}
              {editForm.categoria === 'perfume' ? (
                <div className="grid grid-cols-2 gap-3 p-3 bg-emerald-50/50 dark:bg-emerald-950/10 border border-emerald-100 dark:border-emerald-900/30 rounded-xl">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] uppercase font-bold tracking-wide text-neutral-500">Mililitros</label>
                    <select
                      value={editForm.mililitros}
                      onChange={(e) => setEditForm(prev => ({ ...prev, mililitros: Number(e.target.value) as any }))}
                      className="w-full text-xs px-2 py-1.5 border border-neutral-200 dark:border-neutral-800 rounded bg-white dark:bg-neutral-900 focus:outline-none focus:border-neutral-400 text-neutral-900 dark:text-neutral-100 cursor-pointer"
                    >
                      <option value="30">30 ml</option>
                      <option value="50">50 ml</option>
                      <option value="100">100 ml</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] uppercase font-bold tracking-wide text-neutral-500">Concentración</label>
                    <select
                      value={editForm.concentracion}
                      onChange={(e) => setEditForm(prev => ({ ...prev, concentracion: e.target.value as any }))}
                      className="w-full text-xs px-2 py-1.5 border border-neutral-200 dark:border-neutral-800 rounded bg-white dark:bg-neutral-900 focus:outline-none focus:border-neutral-400 text-neutral-900 dark:text-neutral-100 cursor-pointer"
                    >
                      <option value="EDT">EDT</option>
                      <option value="EDP">EDP</option>
                      <option value="Parfum">Parfum</option>
                    </select>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3 p-3 bg-indigo-50/50 dark:bg-indigo-950/10 border border-indigo-100 dark:border-indigo-900/30 rounded-xl">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] uppercase font-bold tracking-wide text-neutral-500">Material</label>
                    <input 
                      type="text"
                      value={editForm.material}
                      onChange={(e) => setEditForm(prev => ({ ...prev, material: e.target.value }))}
                      className="w-full text-xs px-2 py-1.5 border border-neutral-200 dark:border-neutral-800 rounded bg-white dark:bg-neutral-900 focus:outline-none focus:border-neutral-400 text-neutral-900 dark:text-neutral-100"
                      placeholder="Ej: Acero Inoxidable"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] uppercase font-bold tracking-wide text-neutral-500">Color / Baño</label>
                    <input 
                      type="text"
                      value={editForm.color_banio}
                      onChange={(e) => setEditForm(prev => ({ ...prev, color_banio: e.target.value }))}
                      className="w-full text-xs px-2 py-1.5 border border-neutral-200 dark:border-neutral-800 rounded bg-white dark:bg-neutral-900 focus:outline-none focus:border-neutral-400 text-neutral-900 dark:text-neutral-100"
                      placeholder="Ej: Bañado en Oro"
                    />
                  </div>
                </div>
              )}

              {/* Imagen */}
              <div className="flex flex-col gap-1.5 bg-neutral-50 dark:bg-neutral-950 p-3 rounded-lg border border-neutral-200 dark:border-neutral-800">
                <label className="text-[10px] uppercase font-bold tracking-wide text-neutral-450 flex items-center gap-1">
                  <Upload className="w-3.5 h-3.5" /> Imagen de Portada (Opcional)
                </label>
                <div className="flex items-center gap-3">
                  <label className="flex-1 text-center bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-800 rounded px-3 py-2 cursor-pointer text-xs font-bold transition-all text-neutral-850 dark:text-neutral-200 hover:border-emerald-500 hover:text-emerald-500">
                    {editForm.imagenUrl ? "✓ Cambiar Imagen" : "Subir de PC"}
                    <input 
                      type="file" 
                      accept="image/*" 
                      onChange={handleEditProductImageUpload} 
                      className="hidden" 
                      disabled={isSubmitting}
                    />
                  </label>
                  {editForm.imagenUrl && (
                    <div className="w-8 h-8 rounded border overflow-hidden flex items-center justify-center shrink-0">
                      <img src={editForm.imagenUrl} alt="Preview" className="w-full h-full object-cover" />
                    </div>
                  )}
                </div>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold uppercase py-2.5 rounded-lg text-xs tracking-wider flex items-center justify-center gap-1.5 transition-colors cursor-pointer mt-2"
              >
                {isSubmitting ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <CheckCircle2 className="w-4 h-4" />
                )}
                Guardar Cambios
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
