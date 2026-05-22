/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useCart } from '../context/CartContext';
import { ClientData, PaymentMethod, Order } from '../types';
import { ChevronLeft, Info, Send, HeartHandshake, CheckCircle2 } from 'lucide-react';
import { motion } from 'motion/react';

interface CheckoutFormProps {
  onBack: () => void;
  onSuccess: (order: Order) => void;
}

export const CheckoutForm: React.FC<CheckoutFormProps> = ({ onBack, onSuccess }) => {
  const { cart, cartSubtotal, cartTotal, placeOrder, getWhatsAppRedirectUrl } = useCart();
  
  const [formData, setFormData] = useState<ClientData>({
    nombre: '',
    celular: '',
    direccion: '',
  });
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(PaymentMethod.TRANSFERENCIA);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [placedOrder, setPlacedOrder] = useState<Order | null>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!formData.nombre.trim()) {
      setError("Por favor, ingresa tu nombre completo.");
      return;
    }
    if (!formData.celular.trim()) {
      setError("Por favor, ingresa tu número telefónico.");
      return;
    }
    if (!formData.direccion.trim()) {
      setError("Por favor, ingresa una dirección o punto de entrega exacto.");
      return;
    }
    if (cart.length === 0) {
      setError("El carrito está vacío. Agrega algún perfume para comprar.");
      return;
    }

    setLoading(true);
    try {
      const order = await placeOrder(formData, paymentMethod);
      setPlacedOrder(order);
      onSuccess(order);

      const waUrl = getWhatsAppRedirectUrl(order);
      setTimeout(() => {
        window.open(waUrl, '_blank', 'noopener,noreferrer');
      }, 800);

    } catch (err: any) {
      console.error(err);
      setError("Ocurrió un error procesando tu compra. Por favor, intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  if (placedOrder) {
    const waUrl = getWhatsAppRedirectUrl(placedOrder);
    return (
      <div className="w-full max-w-2xl mx-auto px-6 py-16 text-center">
        <motion.div
          initial={{ scale: 0.98, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="bg-white rounded-2xl border border-editorial-black/10 p-8 md:p-12 shadow-sm flex flex-col items-center"
        >
          <div className="w-14 h-14 bg-editorial-sand rounded-xl flex items-center justify-center text-editorial-black mb-6 border border-editorial-black/10 shadow-xs">
            <CheckCircle2 className="w-8 h-8 stroke-[1.5]" />
          </div>

          <h2 className="text-3xl font-serif text-editorial-black mb-2 leading-tight">
            Pedido <span className="italic">Registrado</span>
          </h2>
          <p className="text-[10px] font-mono tracking-widest text-[#1A1A1A]/40 bg-editorial-sand px-3 py-1.5 rounded-sm inline-block font-semibold mb-6">
            ID DE REGISTRO: {placedOrder.id_pedido}
          </p>

          <p className="text-editorial-black/75 font-light text-sm leading-relaxed max-w-md mb-8">
            Tu orden ha sido registrada en el sistema de **Glow Heaven** en tiempo real. Ahora, para coordinar el envío e iniciar el despacho de tu fragancia, haz clic a continuación para finalizar la transacción en WhatsApp.
          </p>

          <div className="w-full max-w-sm space-y-3">
            <a
              href={waUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-4 bg-editorial-black hover:opacity-90 text-editorial-ivory font-bold text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 cursor-pointer transition-all shadow"
            >
              <Send className="w-3.5 h-3.5 fill-current" />
              Finalizar Pedido vía WhatsApp
            </a>

            <button
              onClick={onBack}
              className="w-full py-3.5 border border-editorial-black hover:bg-editorial-black hover:text-white text-editorial-black font-semibold text-[10px] uppercase tracking-widest cursor-pointer transition-colors"
            >
              Regresar al Catálogo
            </button>
          </div>

          <p className="text-[9px] text-editorial-black/40 uppercase tracking-widest mt-8 flex items-center justify-center gap-1">
            <HeartHandshake className="w-3.5 h-3.5 text-editorial-black/50" />
            Gracias por preferir Glow Heaven Alta Perfumería
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-5xl mx-auto px-6 py-12">
      {/* Navigation Return */}
      <button
        onClick={onBack}
        className="mb-8 flex items-center gap-1 text-editorial-black/60 hover:text-editorial-black uppercase tracking-widest font-semibold text-[10px] cursor-pointer transition-colors group"
      >
        <ChevronLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
        Regresar al Catálogo
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
        {/* Form Inputs Block */}
        <form onSubmit={handleSubmit} className="lg:col-span-7 bg-white rounded-2xl border border-editorial-black/10 p-6 md:p-10 space-y-8 shadow-xs">
          <div>
            <h3 className="text-3xl font-serif text-editorial-black">
              Detalles de <span className="italic">Despacho</span>
            </h3>
            <p className="text-xs text-editorial-black/50 uppercase tracking-wider font-mono mt-1">Check-out express libre de registro.</p>
          </div>

          {error && (
            <div className="p-4 bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-start gap-2 rounded-lg">
              <Info className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Customer Inputs */}
          <div className="space-y-5">
            <div>
              <label htmlFor="nombre" className="block text-[10px] font-bold uppercase tracking-widest text-editorial-black/50 font-mono mb-2">Nombre Completo</label>
              <input
                type="text"
                id="nombre"
                name="nombre"
                value={formData.nombre}
                onChange={handleInputChange}
                required
                placeholder="Ej. Camila Espinoza"
                className="w-full px-4 py-3 bg-white border border-editorial-black/10 text-sm focus:outline-none focus:border-editorial-black/60 text-editorial-black placeholder-editorial-black/30 font-light"
              />
            </div>

            <div>
              <label htmlFor="celular" className="block text-[10px] font-bold uppercase tracking-widest text-editorial-black/50 font-mono mb-2">Celular de Contacto / WhatsApp</label>
              <input
                type="tel"
                id="celular"
                name="celular"
                value={formData.celular}
                onChange={handleInputChange}
                required
                placeholder="Ej. +57 300 123 4567"
                className="w-full px-4 py-3 bg-white border border-editorial-black/10 text-sm focus:outline-none focus:border-editorial-black/60 text-editorial-black placeholder-editorial-black/30 font-light"
              />
            </div>

            <div>
              <label htmlFor="direccion" className="block text-[10px] font-bold uppercase tracking-widest text-editorial-black/50 font-mono mb-2">Dirección de Entrega Exacta</label>
              <textarea
                id="direccion"
                name="direccion"
                rows={3}
                value={formData.direccion}
                onChange={handleInputChange}
                required
                placeholder="Calle, Barrio, Apartamento, u Oficina (Ej: Calle 85 #11-45, Bogotá)"
                className="w-full px-4 py-3 bg-white border border-editorial-black/10 text-sm focus:outline-none focus:border-editorial-black/60 text-editorial-black placeholder-editorial-black/30 font-light"
              />
            </div>
          </div>

          {/* Payment Method Selector */}
          <div className="pt-6 border-t border-editorial-black/10">
            <span className="block text-[10px] font-bold uppercase tracking-widest text-editorial-black/50 font-mono mb-3.5">Método de Pago Seleccionado</span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { type: PaymentMethod.TRANSFERENCIA, label: "Transferencia", desc: "Nequi, Bancolombia, etc." },
                { type: PaymentMethod.EFECTIVO, label: "Contraentrega", desc: "Efectivo al recibir" },
                { type: PaymentMethod.TARJETA, label: "Tarjeta de Crédito", desc: "Enlace de pago" }
              ].map((pVal) => (
                <button
                  type="button"
                  key={pVal.type}
                  onClick={() => setPaymentMethod(pVal.type)}
                  className={`p-4 border rounded-xl text-left transition-all cursor-pointer ${
                    paymentMethod === pVal.type
                      ? 'bg-editorial-black border-editorial-black text-white shadow-sm'
                      : 'bg-white hover:bg-editorial-sand border-editorial-black/15 text-editorial-black'
                  }`}
                >
                  <span className="text-xs font-bold block">{pVal.label}</span>
                  <span className={`text-[10px] block mt-0.5 ${paymentMethod === pVal.type ? 'text-editorial-ivory/60' : 'text-editorial-black/40'}`}>
                    {pVal.desc}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || cart.length === 0}
            className="w-full py-4 bg-editorial-black hover:opacity-90 text-editorial-ivory text-[10px] uppercase font-bold tracking-widest transition-all cursor-pointer shadow-md disabled:opacity-50"
          >
            {loading ? "Procesando Orden..." : "Confirmar Compra y Concluir en WhatsApp"}
          </button>
        </form>

        {/* Dynamic Purchase Summary column */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-editorial-sand border border-editorial-black/10 rounded-2xl p-6">
            <h4 className="text-[10px] font-bold uppercase tracking-widest text-editorial-black/60 font-mono mb-4">Resumen del Pedido</h4>
            
            <div className="divide-y divide-editorial-black/5 max-h-80 overflow-y-auto pr-1">
              {cart.map((item) => (
                <div key={item.product.id} className="py-4 flex gap-4 items-center">
                  <img
                    src={item.product.imagenUrl}
                    alt={item.product.nombre}
                    referrerPolicy="no-referrer"
                    className="w-12 h-16 object-cover bg-neutral-200 border border-editorial-black/10 flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <h5 className="text-xs uppercase font-bold text-editorial-black truncate pr-1">{item.product.nombre}</h5>
                    <span className="text-[10px] text-editorial-black/50 font-mono uppercase block mt-1">Cantidad: {item.quantity}</span>
                  </div>
                  <span className="text-xs font-mono font-bold text-editorial-black">${item.product.precio * item.quantity} USD</span>
                </div>
              ))}
            </div>

            <div className="pt-4 mt-4 border-t border-editorial-black/10 space-y-2">
              <div className="flex justify-between text-editorial-black/55 text-[10px] uppercase tracking-wider font-mono">
                <span>Subtotal</span>
                <span>${cartSubtotal} USD</span>
              </div>
              <div className="flex justify-between text-editorial-black/55 text-[10px] uppercase tracking-wider font-mono pt-1">
                <span>Envío</span>
                <span className="text-emerald-700 font-bold">Sin costo</span>
              </div>
              <div className="flex justify-between text-editorial-black font-bold text-base border-t border-editorial-black/10 pt-4">
                <span className="font-serif italic font-normal">Valor de Compra</span>
                <span className="text-lg font-serif italic font-bold border-b border-editorial-black pb-0.5">${cartTotal} USD</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
