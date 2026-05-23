/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { doc, collection, runTransaction } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { ERPProduct, ERPOrderItem, ERPOrder } from '../types/erp';
import { 
  Search, X, ShoppingCart, Plus, Minus, Trash2, 
  CheckCircle, CreditCard, Banknote, Package, Loader2, AlertCircle,
  User, Phone, MapPin, Landmark, Share2
} from 'lucide-react';

interface QuickSaleModalProps {
  onClose: () => void;
  products: ERPProduct[];
}

interface CartItem extends ERPOrderItem {
  id: string; // Para control del render
  precio_unitario: number;
}

export const QuickSaleModal: React.FC<QuickSaleModalProps> = ({ 
  onClose, 
  products
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  
  // --- Unified Customer & Shipping States ---
  const [clienteNombre, setClienteNombre] = useState('');
  const [clienteTelefono, setClienteTelefono] = useState('');
  const [envioDireccion, setEnvioDireccion] = useState('');
  const [envioCanal, setEnvioCanal] = useState<'whatsapp' | 'instagram'>('whatsapp');
  const [envioBanco, setEnvioBanco] = useState<'banpro' | 'lafise' | 'bac'>('banpro');
  const [paymentMethod, setPaymentMethod] = useState<'transferencia' | 'efectivo'>('transferencia');
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  
  const searchInputRef = useRef<HTMLInputElement>(null);

  // 1. AUTO-FOCUS AL ABRIR EL MODAL
  useEffect(() => {
    const timer = setTimeout(() => {
      searchInputRef.current?.focus();
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  // 2. BÚSQUEDA PREDICTIVA CON useMemo
  const filteredProducts = useMemo(() => {
    const term = (searchTerm || '').trim().toLowerCase();
    if (!term) return [];
    
    return products.filter(p => 
      p && p.activo && (
        (p.sku || '').toLowerCase().includes(term) || 
        (p.nombre || '').toLowerCase().includes(term) ||
        (p.marca || '').toLowerCase().includes(term)
      )
    ).slice(0, 5);
  }, [searchTerm, products]);

  // Lógica de Escaneo de SKU con Enter
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
        setSearchTerm('');
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

  const total = cart.reduce((acc, item) => acc + item.precio_cobrado, 0);

  // 3. TRANSACCIÓN ATÓMICA DE INMOVILIZACIÓN DE STOCK
  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cart.length === 0 || isSubmitting) return;

    // Validaciones de Campos
    const nombreClean = clienteNombre.trim();
    const telefonoClean = clienteTelefono.trim();
    const direccionClean = envioDireccion.trim();

    if (!nombreClean || !telefonoClean || !direccionClean) {
      setFormError('Por favor complete todos los datos obligatorios del cliente y envío.');
      return;
    }

    setIsSubmitting(true);
    setFormError(null);
    setFormSuccess(null);

    try {
      await runTransaction(db, async (transaction) => {
        // A) Validar y restar stock disponible y sumar al comprometido para cada producto
        for (const item of cart) {
          const productRef = doc(db, 'productos', item.sku);
          const productSnap = await transaction.get(productRef);

          if (!productSnap.exists()) {
            throw new Error(`El producto con SKU ${item.sku} no existe en el catálogo.`);
          }

          const productData = productSnap.data() as ERPProduct;

          if ((productData.stock_disponible || 0) < item.cantidad) {
            throw new Error(`Stock insuficiente para ${productData.nombre}. Disponible: ${productData.stock_disponible}`);
          }

          const nuevoDisponible = Math.round((productData.stock_disponible - item.cantidad) * 100) / 100;
          const nuevoComprometido = Math.round(((productData.stock_comprometido || 0) + item.cantidad) * 100) / 100;
          
          // Actualización atómica del inventario en productos
          transaction.update(productRef, {
            stock_disponible: nuevoDisponible,
            stock_comprometido: nuevoComprometido,
            stock: nuevoDisponible // Congela el stock en la tienda web
          });
        }

        // B) Crear el pedido con la estructura unificada
        const orderRef = doc(collection(db, 'pedidos'));
        const newOrder: ERPOrder = {
          id_orden: orderRef.id,
          fecha: new Date().toISOString(),
          cliente: {
            nombre: nombreClean,
            telefono: telefonoClean
          },
          envio: {
            direccion: direccionClean,
            canal: envioCanal,
            banco_destino: envioBanco
          },
          items: cart.map(item => ({
            sku: item.sku,
            nombre: item.nombre,
            cantidad: item.cantidad,
            precio_cobrado: item.precio_cobrado
          })),
          total_cs: total,
          metodo_pago: paymentMethod,
          estado: 'pendiente_pago' // Inicia en etapa A
        };

        transaction.set(orderRef, newOrder);
      });

      setFormSuccess(`¡Orden manual guardada con éxito! Stock comprometido congelado en catálogo.`);
      setCart([]);
      setClienteNombre('');
      setClienteTelefono('');
      setEnvioDireccion('');
      
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err: any) {
      console.error('[QuickSaleModal] Error en transacción:', err);
      setFormError(`Error al guardar pedido: ${err.message || String(err)}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-neutral-900/70 backdrop-blur-md p-6 overflow-y-auto">
      <div 
        className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 w-full max-w-5xl rounded-2xl shadow-2xl overflow-hidden flex flex-col h-full max-h-[90vh] animate-in fade-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
      >
        {/* HEADER */}
        <div className="px-6 py-4 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-3">
            <div className="bg-emerald-100 dark:bg-emerald-900/50 p-2 rounded-lg text-emerald-600 dark:text-emerald-400">
              <Share2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold uppercase tracking-widest text-neutral-900 dark:text-white">Creador de Pedidos Manuales (Redes)</h2>
              <p className="text-xs text-neutral-500 font-mono">Instagram & WhatsApp • Registro de Venta Digital</p>
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
        
        {/* BODY */}
        <div className="flex-1 flex min-h-0">
          {/* LADO IZQUIERDO: BUSCADOR Y FORMULARIO DE CLIENTE (60%) */}
          <div className="w-3/5 border-r border-neutral-200 dark:border-neutral-800 p-6 flex flex-col bg-white dark:bg-neutral-900 overflow-y-auto">
            
            {/* Buscador de Catálogo */}
            <div className="relative mb-6 shrink-0">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-emerald-600 dark:text-emerald-500" />
              <input 
                ref={searchInputRef}
                type="text" 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                disabled={isSubmitting}
                placeholder={isSubmitting ? "Procesando orden..." : "Escanea SKU o busca por nombre/marca..."}
                className="w-full pl-12 pr-4 py-3.5 border-2 border-emerald-500/20 focus:border-emerald-500 dark:border-neutral-800 dark:focus:border-emerald-500 rounded-xl bg-neutral-50 dark:bg-neutral-950 focus:outline-none transition-colors text-base font-mono placeholder:font-sans placeholder:text-sm placeholder:text-neutral-400 disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>

            {/* Resultados Predictivos */}
            {searchTerm.trim() !== '' && (
              <div className="mb-6 shrink-0 max-h-48 overflow-y-auto border border-neutral-200 dark:border-neutral-800 rounded-xl p-2 bg-neutral-50 dark:bg-neutral-950">
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-neutral-400 mb-2 px-2">Catálogo Relacionado</h3>
                {filteredProducts.length === 0 ? (
                  <p className="text-xs text-rose-500 italic p-2">Ningún producto coincide.</p>
                ) : (
                  <div className="space-y-1">
                    {filteredProducts.map(prod => (
                      <div 
                        key={prod.id} 
                        className="flex justify-between items-center p-2.5 rounded-lg hover:bg-neutral-200 dark:hover:bg-neutral-900 cursor-pointer transition-colors"
                        onClick={() => {
                          addToCart(prod);
                          setSearchTerm('');
                        }}
                      >
                        <div>
                          <span className="text-[9px] font-mono font-bold bg-neutral-200 dark:bg-neutral-800 px-1 py-0.5 rounded text-neutral-500">{prod.sku}</span>
                          <p className="font-bold text-xs mt-0.5">{prod.nombre} ({prod.marca})</p>
                        </div>
                        <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 font-mono">Stock: {prod.stock_disponible}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* FORMULARIO DE CLIENTE Y ENVÍO */}
            <form onSubmit={handleCreateOrder} className="space-y-4 flex-1">
              <h3 className="text-xs font-bold uppercase tracking-widest text-neutral-500 border-b border-neutral-100 dark:border-neutral-800 pb-2">Datos de Entrega Unificados</h3>
              
              <div className="grid grid-cols-2 gap-4">
                {/* Nombre del Cliente */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5" /> Nombre del Cliente *
                  </label>
                  <input 
                    type="text" 
                    required
                    value={clienteNombre}
                    onChange={(e) => setClienteNombre(e.target.value)}
                    disabled={isSubmitting}
                    placeholder="Ej. Ariana Grande"
                    className="w-full px-3 py-2 text-sm border border-neutral-200 dark:border-neutral-800 rounded-lg bg-neutral-50 dark:bg-neutral-950 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>

                {/* Teléfono */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5" /> Celular / WhatsApp *
                  </label>
                  <input 
                    type="tel" 
                    required
                    value={clienteTelefono}
                    onChange={(e) => setClienteTelefono(e.target.value)}
                    disabled={isSubmitting}
                    placeholder="Ej. +505 8888-8888"
                    className="w-full px-3 py-2 text-sm border border-neutral-200 dark:border-neutral-800 rounded-lg bg-neutral-50 dark:bg-neutral-950 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>

              {/* Dirección de entrega */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5" /> Dirección de Destino Exacta *
                </label>
                <input 
                  type="text" 
                  required
                  value={envioDireccion}
                  onChange={(e) => setEnvioDireccion(e.target.value)}
                  disabled={isSubmitting}
                  placeholder="Ej. León, costado sur de la Catedral 1c al oeste"
                  className="w-full px-3 py-2 text-sm border border-neutral-200 dark:border-neutral-800 rounded-lg bg-neutral-50 dark:bg-neutral-950 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Canal de venta */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
                    Canal Origen
                  </label>
                  <select 
                    value={envioCanal} 
                    onChange={(e) => setEnvioCanal(e.target.value as any)}
                    disabled={isSubmitting}
                    className="w-full px-3 py-2 text-sm border border-neutral-200 dark:border-neutral-800 rounded-lg bg-neutral-50 dark:bg-neutral-950 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-bold"
                  >
                    <option value="whatsapp">WhatsApp Chat</option>
                    <option value="instagram">Instagram Direct</option>
                  </select>
                </div>

                {/* Banco de Destino */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
                    <Landmark className="w-3.5 h-3.5" /> Banco Destino Conciliación
                  </label>
                  <select 
                    value={envioBanco} 
                    onChange={(e) => setEnvioBanco(e.target.value as any)}
                    disabled={isSubmitting || paymentMethod === 'efectivo'}
                    className="w-full px-3 py-2 text-sm border border-neutral-200 dark:border-neutral-800 rounded-lg bg-neutral-50 dark:bg-neutral-950 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-bold disabled:opacity-50"
                  >
                    <option value="banpro">Banpro Transferencia</option>
                    <option value="lafise">Lafise Transferencia</option>
                    <option value="bac">BAC Credomatic</option>
                  </select>
                </div>
              </div>

              <div className="pt-2">
                <button type="submit" className="hidden" id="submit-hidden-btn" />
              </div>
            </form>

          </div>

          {/* LADO DERECHO: TICKET Y CONTROL DE BOTÓN (40%) */}
          <div className="w-2/5 flex flex-col bg-neutral-50 dark:bg-neutral-950/30 overflow-y-auto">
            <div className="flex-1 p-6">
              <h3 className="text-xs font-bold uppercase tracking-widest text-neutral-500 mb-4 border-b border-neutral-200 dark:border-neutral-800 pb-2">Resumen de Compra</h3>
              
              {formError && (
                <div className="p-3 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 rounded-lg flex items-start gap-2 text-xs text-rose-600 dark:text-rose-400 font-medium mb-4 animate-fadeIn">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-500 mt-0.5" />
                  <span>{formError}</span>
                </div>
              )}

              {formSuccess && (
                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-lg flex items-start gap-2 text-xs text-emerald-600 dark:text-emerald-400 font-medium mb-4 animate-fadeIn">
                  <CheckCircle className="w-4 h-4 shrink-0 text-emerald-550 mt-0.5" />
                  <span>{formSuccess}</span>
                </div>
              )}

              {cart.length === 0 ? (
                <div className="h-32 flex flex-col items-center justify-center text-center opacity-40">
                  <Package className="w-10 h-10 mb-2" />
                  <p className="text-xs italic">El carrito está vacío. Agrega ítems.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {cart.map(item => (
                    <div key={item.sku} className="flex flex-col gap-2 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800/80 p-3 rounded-xl shadow-xs">
                      <div className="flex justify-between items-start">
                        <div className="pr-4">
                          <p className="text-xs font-bold leading-tight">{item.nombre}</p>
                          <p className="text-[9px] font-mono text-neutral-400">{item.sku}</p>
                        </div>
                        <p className="text-xs font-mono font-bold shrink-0">
                          C$ {item.precio_cobrado.toLocaleString('es-NI')}
                        </p>
                      </div>
                      
                      <div className="flex justify-between items-center mt-1.5 border-t border-neutral-100 dark:border-neutral-800/50 pt-1.5">
                        <div className="flex items-center gap-2.5 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200/80 dark:border-neutral-850 rounded-lg p-0.5">
                          <button 
                            type="button"
                            onClick={() => updateQuantity(item.sku, -1)} 
                            disabled={isSubmitting}
                            className="p-1 hover:bg-neutral-200 dark:hover:bg-neutral-850 rounded text-neutral-500 disabled:opacity-30 cursor-pointer"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="text-[11px] font-bold font-mono w-3.5 text-center">{item.cantidad}</span>
                          <button 
                            type="button"
                            onClick={() => updateQuantity(item.sku, 1)} 
                            disabled={isSubmitting}
                            className="p-1 hover:bg-neutral-200 dark:hover:bg-neutral-850 rounded text-neutral-500 disabled:opacity-30 cursor-pointer"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                        <button 
                          type="button"
                          onClick={() => removeFromCart(item.sku)} 
                          disabled={isSubmitting}
                          className="text-rose-500 hover:text-rose-600 p-1 cursor-pointer disabled:opacity-30"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* PANEL DE GUARDADO */}
            <div className="p-6 bg-white dark:bg-neutral-900 border-t border-neutral-200 dark:border-neutral-800 shrink-0">
              {/* Método de pago */}
              <div className="mb-4">
                <p className="text-[9px] uppercase font-bold text-neutral-400 tracking-widest mb-2">Método Tentativo de Pago</p>
                <div className="grid grid-cols-2 gap-2">
                  <button 
                    type="button"
                    onClick={() => {
                      setPaymentMethod('transferencia');
                    }}
                    disabled={isSubmitting}
                    className={`py-2 rounded-lg border flex items-center justify-center gap-1.5 text-xs font-bold transition-all cursor-pointer ${paymentMethod === 'transferencia' ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/20 text-indigo-700 dark:text-indigo-400 ring-1 ring-indigo-500' : 'border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 text-neutral-500'}`}
                  >
                    <CreditCard className="w-3.5 h-3.5" /> Transferencia
                  </button>
                  <button 
                    type="button"
                    onClick={() => {
                      setPaymentMethod('efectivo');
                    }}
                    disabled={isSubmitting}
                    className={`py-2 rounded-lg border flex items-center justify-center gap-1.5 text-xs font-bold transition-all cursor-pointer ${paymentMethod === 'efectivo' ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 ring-1 ring-emerald-500' : 'border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 text-neutral-500'}`}
                  >
                    <Banknote className="w-3.5 h-3.5" /> Efectivo (Al recibir)
                  </button>
                </div>
              </div>

              <div className="flex justify-between items-end mb-4">
                <span className="text-xs font-bold uppercase tracking-widest text-neutral-400">Subtotal de Reserva</span>
                <span className="text-2xl font-mono font-black text-emerald-600 dark:text-emerald-400">
                  C$ {total.toLocaleString('es-NI')}
                </span>
              </div>

              <button 
                type="button"
                onClick={handleCreateOrder}
                disabled={cart.length === 0 || isSubmitting}
                className="w-full bg-neutral-900 hover:bg-neutral-800 dark:bg-neutral-100 dark:text-neutral-900 text-white disabled:bg-neutral-300 disabled:dark:bg-neutral-800 disabled:cursor-not-allowed py-3.5 rounded-xl font-bold uppercase tracking-widest flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-md"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Congelando inventario...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4" /> Guardar Pedido Manual
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
