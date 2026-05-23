/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { useCart } from '../context/CartContext';
import { X, Trash2, Plus, Minus, ReceiptText, ShoppingCart } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onProceedToCheckout: () => void;
}

export const CartDrawer: React.FC<CartDrawerProps> = ({ isOpen, onClose, onProceedToCheckout }) => {
  const { cart, updateQuantity, removeFromCart, cartSubtotal, cartTotal, cartCount } = useCart();

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop Shadow Screen */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.3 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-editorial-black z-40 cursor-pointer"
          />

          {/* Drawer Sidebar Frame */}
          <motion.aside
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 24, stiffness: 180 }}
            className="fixed right-0 top-0 bottom-0 w-full sm:max-w-md bg-editorial-card border-l border-editorial-card-border shadow-2xl z-50 flex flex-col"
          >
            {/* Header */}
            <div className="p-6 border-b border-editorial-card-border flex items-center justify-between bg-editorial-sand">
              <div className="flex items-center gap-2.5 text-editorial-black font-medium">
                <ShoppingCart className="w-4 h-4 text-editorial-black" />
                <span className="font-serif italic font-bold text-lg">Mi Bolsa</span>
                <span className="text-[10px] bg-editorial-black text-editorial-ivory px-2.5 py-0.5 rounded-sm font-mono tracking-wider font-semibold uppercase">
                  {cartCount.toString().padStart(2, '0')} i.
                </span>
              </div>
              <button
                onClick={onClose}
                className="p-1 text-editorial-black/50 hover:text-editorial-black hover:bg-editorial-black/5 rounded transition-all cursor-pointer"
                id="close-cart-btn"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Shopping List Items container */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {cart.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 text-editorial-black/40">
                  <ShoppingCart className="w-12 h-12 stroke-[1] mb-4 text-editorial-black/20" />
                  <p className="font-serif italic font-medium text-lg text-editorial-black">La bolsa está vacía</p>
                  <p className="text-xs mt-1 max-w-[220px] leading-relaxed font-light">Agrega aromas selectos de nuestra curaduría para comenzar tu solicitud.</p>
                  <button
                    onClick={onClose}
                    className="mt-6 px-6 py-3 border border-editorial-black hover:bg-editorial-black hover:text-white transition-all text-xs font-bold uppercase tracking-widest cursor-pointer"
                  >
                    Regresar
                  </button>
                </div>
              ) : (
                cart.map((item) => {
                  return (
                    <motion.div
                      layout
                      key={item.product.id}
                      className="flex gap-4 p-4 border border-editorial-black/10 bg-editorial-sand/30 hover:bg-editorial-sand/65 transition-colors rounded-lg"
                    >
                      <img
                        src={item.product.imagenUrl}
                        alt={item.product.nombre}
                        referrerPolicy="no-referrer"
                        className="w-16 h-20 rounded-md object-cover bg-neutral-200 border border-editorial-black/10 flex-shrink-0"
                      />
                      <div className="flex-1 min-w-0 flex flex-col justify-between">
                        <div>
                          <div className="flex justify-between items-start">
                            <h4 className="font-serif italic text-sm text-editorial-black leading-tight truncate pr-2">
                              {item.product.nombre}
                            </h4>
                            <button
                              onClick={() => removeFromCart(item.product.id)}
                              className="text-editorial-black/40 hover:text-rose-600 p-0.5 rounded transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <span className="text-[9px] uppercase tracking-wider text-editorial-black/40 font-mono block mt-1">
                            {item.product.marca}
                          </span>
                        </div>

                        {/* Price & Quantity handlers */}
                        <div className="flex items-center justify-between mt-2.5">
                          <span className="text-sm font-semibold text-editorial-black">${item.product.precio} USD</span>
                          
                          <div className="flex items-center gap-2 border border-editorial-card-border bg-editorial-card rounded-md p-0.5">
                            <button
                              onClick={() => updateQuantity(item.product.id, -1)}
                              className="p-1 px-1.5 text-editorial-black/50 hover:text-editorial-black hover:bg-editorial-sand rounded cursor-pointer transition-colors"
                            >
                              <Minus className="w-2.5 h-2.5" />
                            </button>
                            <span className="text-xs font-semibold px-1 font-mono text-editorial-black">{item.quantity}</span>
                            <button
                              onClick={() => updateQuantity(item.product.id, 1)}
                              className="p-1 px-1.5 text-editorial-black/50 hover:text-editorial-black hover:bg-editorial-sand rounded cursor-pointer transition-colors"
                              disabled={item.quantity >= item.product.stock}
                              title={item.quantity >= item.product.stock ? "Stock límite alcanzado" : ""}
                            >
                              <Plus className="w-2.5 h-2.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                })
              )}
            </div>

            {/* Summation Footer and Proceed Actions */}
            {cart.length > 0 && (
              <div className="p-6 border-t border-editorial-black/10 bg-editorial-sand space-y-4">
                <div className="space-y-1.5">
                  <div className="flex justify-between text-editorial-black/60 text-xs uppercase tracking-wider font-mono">
                    <span>Subtotal compra</span>
                    <span>${cartSubtotal} USD</span>
                  </div>
                  <div className="flex justify-between text-editorial-black text-base font-bold border-t border-editorial-black/10 pt-3">
                    <span className="font-serif italic font-normal text-lg">Total Estimado</span>
                    <span className="text-lg font-serif italic font-bold border-b border-editorial-black/90 pb-0.5">${cartTotal} USD</span>
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    onClick={() => {
                      onClose();
                      onProceedToCheckout();
                    }}
                    className="w-full py-4 bg-editorial-black text-editorial-ivory hover:opacity-90 font-bold text-[11px] uppercase tracking-[0.2em] flex items-center justify-center gap-2 cursor-pointer transition-all shadow-sm"
                  >
                    <ReceiptText className="w-3.5 h-3.5" />
                    Proceder al Checkout
                  </button>
                </div>
              </div>
            )}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
};
