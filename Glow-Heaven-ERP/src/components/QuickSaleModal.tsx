/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { ERPProduct, ERPOrderItem, ERPOrder } from '../types/erp';
import { 
  Search, X, ShoppingCart, Plus, Minus, Trash2, 
  CheckCircle, CreditCard, Banknote, Package, Loader2, AlertCircle
} from 'lucide-react';

interface QuickSaleModalProps {
  onClose: () => void;
  products: ERPProduct[];
  onProcessPEPSSale: (orderData: ERPOrder) => Promise<void>;
}

interface CartItem extends ERPOrderItem {
  id: string; // Para control del render
  precio_unitario: number;
}

export const QuickSaleModal: React.FC<QuickSaleModalProps> = ({ 
  onClose, 
  products,
  onProcessPEPSSale
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<'efectivo' | 'transferencia'>('efectivo');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // --- UI Error/Success Feedback ---
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  
  const searchInputRef = useRef<HTMLInputElement>(null);

  // 1. AUTO-FOCUS AL ABRIR EL MODAL (Preparado para Escáner o Teclado)
  useEffect(() => {
    const timer = setTimeout(() => {
      searchInputRef.current?.focus();
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  // 2. BÚSQUEDA PREDICTIVA HÍBRIDA (SKU o Nombre)
  const filteredProducts = useMemo(() => {
    const term = (searchTerm || '').trim().toLowerCase();
    if (!term) return [];
    
    return products.filter(p => 
      p && p.activo && (
        (p.sku || '').toLowerCase().includes(term) || 
        (p.nombre || '').toLowerCase().includes(term) ||
        (p.marca || '').toLowerCase().includes(term)
      )
    ).slice(0, 5); // Limitar a los 5 mejores resultados visualmente
  }, [searchTerm, products]);

  // Si el usuario escribe el SKU completo y presiona Enter (Lógica de Escáner)
  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      setFormError(null);
      setFormSuccess(null);
      
      const cleanTerm = searchTerm.trim().toUpperCase();
      if (!cleanTerm) return;

      const exactMatch = products.find(p => p && p.sku && p.sku.toUpperCase() === cleanTerm);
      if (exactMatch) {
        addToCart(exactMatch);
        setSearchTerm(''); // Limpiar para el siguiente escaneo
      } else {
        setFormError(`El SKU "${cleanTerm}" no fue encontrado en el catálogo.`);
      }
    }
  };

  const addToCart = (product: ERPProduct) => {
    setFormError(null);
    setFormSuccess(null);

    setCart(prev => {
      const existing = prev.find(item => item.sku === product.sku);
      if (existing) {
        // Validación básica de stock para mostrador
        if (existing.cantidad + 1 > (product.stock_disponible || 0)) {
          setFormError(`Stock insuficiente de ${product.nombre}. Disponible: ${product.stock_disponible || 0}`);
          return prev;
        }
        return prev.map(item => 
          item.sku === product.sku 
            ? { ...item, cantidad: item.cantidad + 1, precio_cobrado: (item.cantidad + 1) * item.precio_unitario } 
            : item
        );
      }
      
      if ((product.stock_disponible || 0) < 1) {
        setFormError(`El producto ${product.nombre} está agotado.`);
        return prev;
      }

      // Extraer el precio real del catálogo o usar fallback de 1200 C$
      const precioVenta = Number(product.precio) || Number(product.precio_venta) || 1200; 

      return [...prev, {
        id: product.id,
        sku: product.sku,
        nombre: product.nombre,
        cantidad: 1,
        precio_unitario: precioVenta,
        precio_cobrado: precioVenta
      }];
    });
  };

  const updateQuantity = (sku: string, delta: number) => {
    setFormError(null);
    setFormSuccess(null);

    setCart(prev => prev.map(item => {
      if (item.sku === sku) {
        const productData = products.find(p => p.sku === sku);
        const newQty = Math.max(1, item.cantidad + delta);
        
        if (productData && newQty > (productData.stock_disponible || 0)) {
          setFormError(`Stock límite alcanzado para ${productData.nombre}: ${productData.stock_disponible || 0} unidades.`);
          return item;
        }

        return { ...item, cantidad: newQty, precio_cobrado: newQty * item.precio_unitario };
      }
      return item;
    }));
  };

  const removeFromCart = (sku: string) => {
    setFormError(null);
    setFormSuccess(null);
    setCart(prev => prev.filter(item => item.sku !== sku));
  };

  // 3. CÁLCULOS FINANCIEROS EN TIEMPO REAL
  const subtotal = cart.reduce((acc, item) => acc + item.precio_cobrado, 0);
  const total = subtotal;

  // 4. INTEGRACIÓN REAL AL MOTOR PEPS CON CONTROL DE CONCURRENCIA Y CAÍDAS DE RED
  const handleConfirmSale = async () => {
    if (cart.length === 0 || isSubmitting) return;
    setFormError(null);
    setFormSuccess(null);

    const orderData: ERPOrder = {
      id_orden: '', // Se autogenera un nuevo ID en el servidor Firestore
      canal: 'mostrador_fisico',
      fecha: new Date().toISOString(),
      cliente_nombre: 'Cliente Mostrador',
      cliente_telefono: '',
      items: cart.map(item => ({
        sku: item.sku,
        nombre: item.nombre,
        cantidad: item.cantidad,
        precio_cobrado: item.precio_cobrado
      })),
      total_cs: total,
      metodo_pago: paymentMethod,
      estado: 'entregado'
    };

    try {
      setIsSubmitting(true);
      console.log('[QuickSale] Iniciando transacción PEPS en base de datos...');
      await onProcessPEPSSale(orderData);
      setFormSuccess(`Venta registrada exitosamente por C$ ${total.toLocaleString('es-NI')} (Método: ${paymentMethod.toUpperCase()})`);
      
      // Reset cart and search
      setCart([]);
      setSearchTerm('');
      
      // Auto close after brief reading pause
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (error: any) {
      console.error('[QuickSale] Error al procesar la venta en Firestore:', error);
      setFormError(`Error al registrar la venta: ${error.message || 'Verifica tu conexión a Internet e inténtalo nuevamente.'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-neutral-900/70 backdrop-blur-md p-6">
      <div 
        className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 w-full max-w-5xl rounded-2xl shadow-2xl overflow-hidden flex flex-col h-full max-h-[85vh] animate-in fade-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
      >
        
        {/* HEADER */}
        <div className="px-6 py-4 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-3">
            <div className="bg-emerald-100 dark:bg-emerald-900/50 p-2 rounded-lg text-emerald-600 dark:text-emerald-400">
              <ShoppingCart className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold uppercase tracking-widest text-neutral-900 dark:text-white">Terminal Punto de Venta</h2>
              <p className="text-xs text-neutral-500 font-mono">Mostrador Físico • Facturación Inmediata</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            disabled={isSubmitting}
            className="p-2 hover:bg-neutral-200 dark:hover:bg-neutral-800 rounded-lg text-neutral-500 transition-colors disabled:opacity-50"
            title="Cerrar (Esc)"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
        
        {/* BODY - 2 COLUMNS */}
        <div className="flex-1 flex min-h-0">
          
          {/* LADO IZQUIERDO: BÚSQUEDA Y RESULTADOS (60%) */}
          <div className="w-3/5 border-r border-neutral-200 dark:border-neutral-800 p-6 flex flex-col bg-white dark:bg-neutral-900">
            
            {/* Barra de Búsqueda / Escáner */}
            <div className="relative mb-6 shrink-0">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-emerald-600 dark:text-emerald-500" />
              <input 
                ref={searchInputRef}
                autoFocus
                type="text" 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                disabled={isSubmitting}
                placeholder={isSubmitting ? "Procesando venta..." : "Escanea el código de barras o escribe para buscar..."}
                className="w-full pl-12 pr-4 py-4 border-2 border-emerald-500/30 focus:border-emerald-500 dark:border-emerald-500/20 dark:focus:border-emerald-500 rounded-xl bg-neutral-50 dark:bg-neutral-950 focus:outline-none transition-colors text-lg font-mono placeholder:font-sans placeholder:text-base placeholder:text-neutral-400 disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-bold text-neutral-400 bg-neutral-200 dark:bg-neutral-800 px-2 py-1 rounded">
                AUTO-FOCUS
              </div>
            </div>

            {/* Resultados Predictivos */}
            <div className="flex-1 overflow-y-auto pr-2">
              <h3 className="text-xs font-bold uppercase tracking-widest text-neutral-500 mb-3">Resultados en Catálogo</h3>
              
              {searchTerm.trim() === '' ? (
                <div className="h-48 flex flex-col items-center justify-center text-center opacity-50">
                  <Package className="w-12 h-12 text-neutral-400 mb-2" />
                  <p className="text-sm">Esperando captura del escáner...</p>
                </div>
              ) : filteredProducts.length === 0 ? (
                <p className="text-sm text-rose-500 italic">No se encontraron productos coincidentes.</p>
              ) : (
                <div className="space-y-2">
                  {filteredProducts.map(prod => (
                    <div 
                      key={prod.id} 
                      className="flex justify-between items-center p-3 border border-neutral-200 dark:border-neutral-800 rounded-xl hover:border-emerald-500/50 dark:hover:border-emerald-500/50 transition-colors cursor-pointer bg-neutral-50 dark:bg-neutral-950/50"
                      onClick={() => addToCart(prod)}
                    >
                      <div>
                        <span className="text-[10px] font-mono font-bold bg-neutral-200 dark:bg-neutral-800 px-1.5 py-0.5 rounded text-neutral-600 dark:text-neutral-400">
                          {prod.sku}
                        </span>
                        <p className="font-bold text-sm mt-1">{prod.nombre}</p>
                        <p className="text-xs text-neutral-500">{prod.marca} • Stock: {prod.stock_disponible || 0}</p>
                      </div>
                      <button 
                        disabled={isSubmitting}
                        className="bg-emerald-100 hover:bg-emerald-200 dark:bg-emerald-900/50 dark:hover:bg-emerald-800 text-emerald-700 dark:text-emerald-400 w-8 h-8 rounded-full flex items-center justify-center transition-colors cursor-pointer disabled:opacity-50"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* LADO DERECHO: CARRITO Y COBRO (40%) */}
          <div className="w-2/5 flex flex-col bg-neutral-50 dark:bg-neutral-950/30">
            
            {/* Lista de Ítems del Carrito */}
            <div className="flex-1 p-6 overflow-y-auto">
              <h3 className="text-xs font-bold uppercase tracking-widest text-neutral-500 mb-4 border-b border-neutral-200 dark:border-neutral-800 pb-2">Ticket de Venta</h3>
              
              {formError && (
                <div className="p-3 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 rounded-lg flex items-start gap-2 text-xs text-rose-600 dark:text-rose-400 font-medium mb-4 animate-fadeIn">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-500 mt-0.5" />
                  <span>{formError}</span>
                </div>
              )}

              {formSuccess && (
                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-lg flex items-start gap-2 text-xs text-emerald-600 dark:text-emerald-400 font-medium mb-4 animate-fadeIn">
                  <CheckCircle className="w-4 h-4 shrink-0 text-emerald-500 mt-0.5" />
                  <span>{formSuccess}</span>
                </div>
              )}

              {cart.length === 0 ? (
                <p className="text-sm text-neutral-400 italic">El carrito está vacío.</p>
              ) : (
                <div className="space-y-4">
                  {cart.map(item => (
                    <div key={item.sku} className="flex flex-col gap-2 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800/80 p-3 rounded-lg shadow-sm">
                      <div className="flex justify-between items-start">
                        <div className="pr-4">
                          <p className="text-sm font-bold leading-tight">{item.nombre}</p>
                          <p className="text-[10px] font-mono text-neutral-500">{item.sku}</p>
                        </div>
                        <p className="text-sm font-mono font-bold text-neutral-900 dark:text-white shrink-0">
                          C$ {item.precio_cobrado.toLocaleString('es-NI')}
                        </p>
                      </div>
                      
                      <div className="flex justify-between items-center mt-2 border-t border-neutral-100 dark:border-neutral-800/60 pt-2">
                        <div className="flex items-center gap-3 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg p-1">
                          <button 
                            type="button"
                            onClick={() => updateQuantity(item.sku, -1)} 
                            disabled={isSubmitting}
                            className="p-1 hover:bg-neutral-200 dark:hover:bg-neutral-800 rounded text-neutral-500 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="text-xs font-bold font-mono w-4 text-center">{item.cantidad}</span>
                          <button 
                            type="button"
                            onClick={() => updateQuantity(item.sku, 1)} 
                            disabled={isSubmitting}
                            className="p-1 hover:bg-neutral-200 dark:hover:bg-neutral-800 rounded text-neutral-500 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <button 
                          type="button"
                          onClick={() => removeFromCart(item.sku)} 
                          disabled={isSubmitting}
                          className="text-rose-500 hover:text-rose-600 p-1 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Panel de Cobro Inferior */}
            <div className="p-6 bg-white dark:bg-neutral-900 border-t border-neutral-200 dark:border-neutral-800 shrink-0">
              
              {/* Selector de Pago */}
              <div className="mb-4">
                <p className="text-[10px] uppercase font-bold text-neutral-500 tracking-widest mb-2">Método de Pago</p>
                <div className="grid grid-cols-2 gap-2">
                  <button 
                    onClick={() => setPaymentMethod('efectivo')}
                    disabled={isSubmitting}
                    className={`py-2.5 rounded-lg border flex items-center justify-center gap-2 text-xs font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer ${paymentMethod === 'efectivo' ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 ring-1 ring-emerald-500' : 'border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 text-neutral-500'}`}
                  >
                    <Banknote className="w-4 h-4" /> Efectivo
                  </button>
                  <button 
                    onClick={() => setPaymentMethod('transferencia')}
                    disabled={isSubmitting}
                    className={`py-2.5 rounded-lg border flex items-center justify-center gap-2 text-xs font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer ${paymentMethod === 'transferencia' ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400 ring-1 ring-indigo-500' : 'border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 text-neutral-500'}`}
                  >
                    <CreditCard className="w-4 h-4" /> Transferencia
                  </button>
                </div>
              </div>

              <div className="flex justify-between items-end mb-6">
                <span className="text-sm font-bold uppercase tracking-widest text-neutral-500">Total</span>
                <span className="text-3xl font-mono font-black text-emerald-600 dark:text-emerald-400">
                  C$ {total.toLocaleString('es-NI')}
                </span>
              </div>

              <button 
                onClick={handleConfirmSale}
                disabled={cart.length === 0 || isSubmitting}
                className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-neutral-300 disabled:dark:bg-neutral-800 disabled:cursor-not-allowed text-white py-4 rounded-xl font-bold uppercase tracking-widest flex items-center justify-center gap-2 transition-colors shadow-lg shadow-emerald-500/20 cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" /> Procesando...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-5 h-5" /> Confirmar Venta
                  </>
                )}
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};
