/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { ERPProduct } from '../types/erp';
import { deleteProduct, uploadProductImage } from '../services/inventoryService';
import { 
  Globe, Search, Edit3, Save, CheckCircle2, AlertCircle, 
  Eye, EyeOff, Image as ImageIcon, Sparkles, Tag, Layers,
  Trash2, Upload
} from 'lucide-react';

interface CatalogManagementProps {
  products: ERPProduct[];
}

export const CatalogManagement: React.FC<CatalogManagementProps> = ({ products }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSku, setSelectedSku] = useState<string | null>(null);
  
  // States for the edit form
  const [activo, setActivo] = useState(true);
  const [precio, setPrecio] = useState<number>(0);
  const [imagenUrl, setImagenUrl] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [genero, setGenero] = useState<'Dama' | 'Caballero' | 'Unisex'>('Unisex');
  const [notasInput, setNotasInput] = useState('');

  // UI state feedback
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  // Search & Filter products
  const filteredProducts = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    if (!Array.isArray(products)) return [];
    return products.filter(p => {
      if (!p) return false;
      const sku = (p.sku || '').toLowerCase();
      const nombre = (p.nombre || '').toLowerCase();
      const marca = (p.marca || '').toLowerCase();
      return sku.includes(term) || nombre.includes(term) || marca.includes(term);
    });
  }, [searchTerm, products]);

  // Selected product object
  const selectedProduct = useMemo(() => {
    if (!selectedSku || !Array.isArray(products)) return null;
    return products.find(p => (p.sku || p.id) === selectedSku) || null;
  }, [selectedSku, products]);

  // Handle select product and load values to form
  const handleSelectProduct = (product: ERPProduct) => {
    setSelectedSku(product.sku || product.id);
    setActivo(product.activo !== false);
    setPrecio(product.precio || 0);
    setImagenUrl(product.imagenUrl || '');
    setDescripcion(product.descripcion || '');
    setGenero(product.genero || 'Unisex');
    setNotasInput(Array.isArray(product.notas) ? product.notas.join(', ') : '');
    
    // Clear status
    setFormError(null);
    setFormSuccess(null);
  };

  // Submit changes to Firestore
  const handleSaveChanges = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSku) return;

    setIsSubmitting(true);
    setFormError(null);
    setFormSuccess(null);

    // Parse scent notes tags
    const cleanNotes = notasInput
      .split(',')
      .map(note => note.trim())
      .filter(note => note.length > 0);

    try {
      const productRef = doc(db, 'productos', selectedSku);
      
      const updateData = {
        activo,
        precio: Number(precio) || 0,
        imagenUrl: imagenUrl.trim(),
        descripcion: descripcion.trim(),
        genero,
        notas: cleanNotes
      };

      await updateDoc(productRef, updateData);
      
      setFormSuccess(`¡Catálogo Web actualizado con éxito para "${selectedProduct?.nombre}"!`);
    } catch (error: any) {
      console.error('[CatalogManagement] Error actualizando producto:', error);
      setFormError(`Error al guardar en base de datos: ${error.message || String(error)}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Upload image from PC to Firebase Storage
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedSku) return;

    setIsSubmitting(true);
    setFormError(null);
    setFormSuccess(null);

    try {
      setFormSuccess("Subiendo imagen a Firebase Storage...");
      const url = await uploadProductImage(selectedSku, file);
      setImagenUrl(url);
      setFormSuccess("¡Imagen subida y previsualizada con éxito!");
    } catch (error: any) {
      console.error('[CatalogManagement] Error al subir imagen:', error);
      setFormError(`Error al subir imagen: ${error.message || String(error)}`);
      setFormSuccess(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete product permanently
  const handleDeleteProduct = async () => {
    if (!selectedSku || !selectedProduct) return;
    
    if (window.confirm(`⚠️ ¿Estás seguro de que deseas ELIMINAR el producto "${selectedProduct.nombre}" (${selectedSku}) de forma permanente? Esto eliminará el producto del ERP, de la web pública, y borrará todos los lotes de inventario asociados. Esta acción no se puede deshacer.`)) {
      setIsSubmitting(true);
      setFormError(null);
      setFormSuccess(null);
      
      try {
        await deleteProduct(selectedSku);
        setSelectedSku(null);
        setFormSuccess(`¡Producto "${selectedProduct.nombre}" eliminado exitosamente del catálogo!`);
      } catch (error: any) {
        console.error('[CatalogManagement] Error eliminando producto:', error);
        setFormError(`Error al eliminar el producto: ${error.message || String(error)}`);
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  return (
    <div className="w-full h-full flex bg-neutral-50 dark:bg-neutral-950/40 overflow-hidden font-sans select-none">
      
      {/* LEFT SIDEBAR: PRODUCT LIST */}
      <div className="w-[45%] border-r border-neutral-200 dark:border-neutral-800 flex flex-col h-full bg-white dark:bg-neutral-900">
        
        {/* Header Search */}
        <div className="p-4 border-b border-neutral-200 dark:border-neutral-800 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-widest text-neutral-400 flex items-center gap-1.5">
              <Globe className="w-4 h-4 text-emerald-500" /> Sincronización Catálogo Web
            </h2>
            <span className="text-[10px] font-mono bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-full font-bold uppercase">
              {filteredProducts.length} Ítems
            </span>
          </div>
          
          <div className="relative">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-neutral-400" />
            <input 
              type="text" 
              placeholder="Buscar por SKU, Nombre o Marca..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-all font-mono"
            />
          </div>
        </div>

        {/* Product List Scrollable */}
        <div className="flex-1 overflow-y-auto min-h-0 divide-y divide-neutral-100 dark:divide-neutral-800/50">
          {filteredProducts.length === 0 ? (
            <div className="p-8 text-center text-xs text-neutral-400 font-mono italic">
              Ningún producto coincide con el filtro.
            </div>
          ) : (
            filteredProducts.map(p => {
              const isSelected = selectedSku === (p.sku || p.id);
              const productStockWeb = typeof p.stock === 'number' ? p.stock : (p.stock_disponible || 0);
              const isVisibleWeb = p.activo !== false;
              
              return (
                <div 
                  key={p.sku || p.id}
                  onClick={() => handleSelectProduct(p)}
                  className={`p-3.5 flex items-center justify-between cursor-pointer transition-all ${
                    isSelected 
                      ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-l-4 border-emerald-500 pl-2.5' 
                      : 'hover:bg-neutral-50 dark:hover:bg-neutral-800/40 border-l-4 border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    {/* Thumbnail Preview */}
                    <div className="w-10 h-10 rounded-lg bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 overflow-hidden flex items-center justify-center shrink-0">
                      {p.imagenUrl ? (
                        <img 
                          src={p.imagenUrl} 
                          alt={p.nombre} 
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = 'https://picsum.photos/seed/fallback/100/100';
                          }}
                        />
                      ) : (
                        <ImageIcon className="w-4 h-4 text-neutral-400" />
                      )}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] font-bold font-mono text-neutral-400 bg-neutral-100 dark:bg-neutral-800 px-1 py-0.5 rounded uppercase tracking-wider">{p.sku || p.id}</span>
                        {!isVisibleWeb && (
                          <span className="text-[8px] font-bold text-rose-500 uppercase tracking-widest flex items-center gap-0.5">
                            <EyeOff className="w-2.5 h-2.5" /> Oculto
                          </span>
                        )}
                      </div>
                      <p className="font-bold text-xs truncate text-neutral-800 dark:text-neutral-200 mt-1">{p.nombre}</p>
                      <p className="text-[10px] text-neutral-400 truncate mt-0.5 font-mono">{p.marca} • {p.categoria.toUpperCase()}</p>
                    </div>
                  </div>

                  <div className="text-right shrink-0 flex flex-col justify-center items-end">
                    <span className="text-xs font-bold text-neutral-800 dark:text-neutral-200 font-mono">
                      {p.precio ? `$${p.precio} USD` : '$0 USD'}
                    </span>
                    <span className={`text-[10px] font-mono font-bold mt-1 px-2 py-0.5 rounded-full ${
                      productStockWeb <= (p.stock_minimo || 0) 
                        ? 'bg-rose-500/10 text-rose-500' 
                        : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-500'
                    }`}>
                      {productStockWeb} u. en Web
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* RIGHT WORKPLACE: PRODUCT EDITOR */}
      <div className="flex-1 flex flex-col h-full bg-neutral-100 dark:bg-neutral-950">
        {selectedProduct ? (
          <form onSubmit={handleSaveChanges} className="flex-1 flex flex-col h-full overflow-hidden">
            
            {/* Editor Top Bar */}
            <div className="p-4 border-b border-neutral-200 dark:border-neutral-800/80 bg-white dark:bg-neutral-900 flex justify-between items-center shrink-0">
              <div>
                <h3 className="text-sm font-bold truncate text-neutral-800 dark:text-neutral-200 flex items-center gap-1.5">
                  <Edit3 className="w-4 h-4 text-emerald-500" /> Editar Ficha de Catálogo
                </h3>
                <p className="text-[10px] text-neutral-400 font-mono mt-0.5">SKU: {selectedProduct.sku} | {selectedProduct.nombre}</p>
              </div>
              <div className="flex gap-2">
                <button 
                  type="button"
                  onClick={handleDeleteProduct}
                  disabled={isSubmitting}
                  className="bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-xs font-bold uppercase tracking-wider px-4 py-2 rounded-lg flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Eliminar
                </button>
                <button 
                  type="submit" 
                  disabled={isSubmitting}
                  className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold uppercase tracking-wider px-4 py-2 rounded-lg flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                >
                  {isSubmitting ? (
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <Save className="w-3.5 h-3.5" />
                  )}
                  Guardar Cambios
                </button>
              </div>
            </div>

            {/* Notification Area */}
            {(formError || formSuccess) && (
              <div className="px-4 pt-4 shrink-0">
                {formError && (
                  <div className="flex items-center gap-2 bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs px-3.5 py-2.5 rounded-lg">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{formError}</span>
                  </div>
                )}
                {formSuccess && (
                  <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs px-3.5 py-2.5 rounded-lg animate-pulse">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>{formSuccess}</span>
                  </div>
                )}
              </div>
            )}

            {/* Form Fields Scrollable */}
            <div className="flex-1 p-6 overflow-y-auto space-y-6 min-h-0">
              
              <div className="grid grid-cols-2 gap-4">
                
                {/* 1. VISIBILIDAD WEB SWITCH */}
                <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 p-4 rounded-xl flex items-center justify-between shadow-sm">
                  <div className="space-y-0.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-neutral-400 flex items-center gap-1">
                      {activo ? <Eye className="w-3.5 h-3.5 text-emerald-500" /> : <EyeOff className="w-3.5 h-3.5 text-neutral-400" />}
                      Visibilidad en Catálogo
                    </label>
                    <p className="text-[10px] text-neutral-400">Controla si el producto se muestra en la web pública.</p>
                  </div>
                  
                  <label className="relative inline-flex items-center cursor-pointer select-none">
                    <input 
                      type="checkbox" 
                      checked={activo} 
                      onChange={(e) => setActivo(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-neutral-200 dark:bg-neutral-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                  </label>
                </div>

                {/* 2. PRECIO WEB (USD) */}
                <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 p-4 rounded-xl flex flex-col justify-between shadow-sm">
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-neutral-400 block mb-1">Precio Web Público (USD)</label>
                    <p className="text-[10px] text-neutral-400">Precio en dólares mostrado en la tienda web.</p>
                  </div>
                  <div className="relative mt-2">
                    <span className="absolute left-3 top-2.5 text-xs text-neutral-400 font-mono font-bold">$</span>
                    <input 
                      type="number" 
                      step="0.01"
                      min="0"
                      value={precio || ''}
                      onChange={(e) => setPrecio(Number(e.target.value))}
                      className="w-full pl-7 pr-4 py-2 text-xs font-mono rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-bold"
                      placeholder="0.00"
                    />
                  </div>
                </div>

              </div>

              {/* 3. IMAGEN DE PORTADA */}
              <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 p-5 rounded-xl space-y-3 shadow-sm">
                <label className="text-xs font-bold uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
                  <ImageIcon className="w-3.5 h-3.5" /> Imagen de Portada
                </label>
                <div className="space-y-4">
                  {/* File Upload Zone */}
                  <div className="flex items-center gap-4">
                    <label className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-neutral-300 dark:border-neutral-800 hover:border-emerald-500 dark:hover:border-emerald-500 rounded-lg p-4 cursor-pointer transition-colors bg-neutral-50 dark:bg-neutral-950">
                      <div className="flex flex-col items-center justify-center text-center">
                        <Upload className="w-6 h-6 text-neutral-400 mb-1" />
                        <span className="text-xs font-bold text-neutral-600 dark:text-neutral-300">Subir imagen desde PC</span>
                        <span className="text-[10px] text-neutral-400 mt-0.5">Formatos soportados: JPG, PNG, WEBP</span>
                      </div>
                      <input 
                        type="file" 
                        accept="image/*" 
                        onChange={handleImageUpload} 
                        className="hidden" 
                        disabled={isSubmitting}
                      />
                    </label>
                    
                    {imagenUrl && (
                      <div className="w-20 h-20 rounded-lg bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 overflow-hidden flex items-center justify-center shrink-0">
                        <img 
                          src={imagenUrl} 
                          alt="Preview" 
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = 'https://picsum.photos/seed/fallback/100/100';
                          }}
                        />
                      </div>
                    )}
                  </div>
                  
                  {/* Text URL option as fallback */}
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-neutral-400 block uppercase tracking-wider">O introduce una URL de internet:</span>
                    <input 
                      type="url" 
                      value={imagenUrl}
                      onChange={(e) => setImagenUrl(e.target.value)}
                      className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      placeholder="https://ejemplo.com/fotos/fragancia.jpg"
                    />
                  </div>
                </div>
              </div>

              {/* 4. GÉNERO E INFORMACIÓN ADICIONAL */}
              <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 p-5 rounded-xl space-y-4 shadow-sm">
                <div className="grid grid-cols-2 gap-4">
                  
                  {/* Género */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5" /> Orientación de Género
                    </label>
                    <select 
                      value={genero}
                      onChange={(e) => setGenero(e.target.value as any)}
                      className="w-full px-3 py-2 text-xs rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-bold"
                    >
                      <option value="Dama">Dama</option>
                      <option value="Caballero">Caballero</option>
                      <option value="Unisex">Unisex</option>
                    </select>
                  </div>

                  {/* Notas Olfativas (Tags Input) */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
                      <Tag className="w-3.5 h-3.5" /> Notas Olfativas / Estilo
                    </label>
                    <input 
                      type="text" 
                      value={notasInput}
                      onChange={(e) => setNotasInput(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      placeholder="Ej: Madera, Cítrico, Jazmín, Vainilla..."
                    />
                    <span className="text-[9px] text-neutral-400 block mt-1">Separa los tags con comas.</span>
                  </div>

                </div>

                {/* Renderizado de Notas parsed localmente */}
                {notasInput.split(',').map(n => n.trim()).filter(n => n.length > 0).length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-2 border-t border-neutral-100 dark:border-neutral-800/50">
                    {notasInput.split(',').map(n => n.trim()).filter(n => n.length > 0).map((note, idx) => (
                      <span key={idx} className="text-[9px] font-mono font-bold bg-neutral-100 dark:bg-neutral-800 text-neutral-500 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <Tag className="w-2.5 h-2.5 text-neutral-400" /> {note}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* 5. DESCRIPCIÓN PÚBLICA */}
              <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 p-5 rounded-xl space-y-3 shadow-sm">
                <label className="text-xs font-bold uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5" /> Descripción Comercial / Reseña Web
                </label>
                <textarea 
                  rows={4}
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                  className="w-full px-3 py-2.5 text-xs rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 focus:outline-none focus:ring-1 focus:ring-emerald-500 leading-relaxed"
                  placeholder="Escribe la historia o descripción de la fragancia para convencer al cliente..."
                />
              </div>

            </div>

          </form>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-neutral-50 dark:bg-neutral-950/20">
            <div className="w-14 h-14 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500 mb-4 animate-bounce">
              <Globe className="w-7 h-7" />
            </div>
            <h4 className="text-sm font-bold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider">Gestión de Tienda Web</h4>
            <p className="text-xs text-neutral-400 max-w-xs mt-1.5 leading-relaxed font-mono">
              Selecciona un producto de la barra lateral izquierda para configurar su precio, visibilidad y fotos comerciales en el catálogo.
            </p>
          </div>
        )}
      </div>

    </div>
  );
};
