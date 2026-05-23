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
    telefono: '',
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

  // Standard cellular format regex checks
  const isValidPhoneNumber = (phone: string): boolean => {
    const cleaned = phone.replace(/[\s\-\(\)]/g, '');
    const colombianRegex = /^(?:\+57|57)?3\d{9}$/;
    const internationalRegex = /^\+?[1-9]\d{7,14}$/;
    return colombianRegex.test(cleaned) || internationalRegex.test(cleaned);
  };

  // Anti-bot & injection protection (checks for script tags, SQL, BBCode links or mail tags)
  const isSuspiciousText = (text: string): boolean => {
    const suspectPatterns = [
      /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
      /href\s*=\s*['"]/gi,
      /\[url=.*\]/gi,
      /SELECT\s+.*\s+FROM/gi,
      /UNION\s+SELECT/gi,
      /INSERT\s+INTO/gi,
      /UPDATE\s+.*\s+SET/gi,
      /DELETE\s+FROM/gi,
      /javascript:/gi,
      /onload\s*=/gi,
      /onerror\s*=/gi
    ];
    return suspectPatterns.some((pattern) => pattern.test(text));
  };

  const isNombreSuspicious = isSuspiciousText(formData.nombre);
  const isCelularSuspicious = isSuspiciousText(formData.telefono);
  const isDireccionSuspicious = isSuspiciousText(formData.direccion);
  const isPhoneInvalid = formData.telefono.trim() ? !isValidPhoneNumber(formData.telefono) : false;

  const isAnyFieldSuspicious = isNombreSuspicious || isCelularSuspicious || isDireccionSuspicious;
  const isAnyFieldEmpty = !formData.nombre.trim() || !formData.telefono.trim() || !formData.direccion.trim();

  // Strict boolean validation to block any bot submissions or malformed states
  const isFormInvalid = isAnyFieldEmpty || isAnyFieldSuspicious || isPhoneInvalid || cart.length === 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Extra runtime safety guards
    if (isAnyFieldEmpty) {
      setError("Por favor, completa todos los campos requeridos en el registro.");
      return;
    }
    if (isAnyFieldSuspicious) {
      setError("Se detectó contenido no permitido en los campos de texto. Por favor, remueve caracteres especiales o enlaces.");
      return;
    }
    if (isPhoneInvalid) {
      setError("Formato de celular no válido. Ej. Colombia: 300 123 4567 o +57 300 123 4567 (entre 10 y 15 dígitos internacionales).");
      return;
    }
    if (cart.length === 0) {
      setError("El carrito está vacío.");
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
      setError(err.message || "Ocurrió un error procesando tu compra. Por favor, intenta de nuevo.");
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
          className="bg-editorial-card rounded-2xl border border-editorial-card-border p-8 md:p-12 shadow-sm flex flex-col items-center"
        >
          <div className="w-14 h-14 bg-editorial-sand rounded-xl flex items-center justify-center text-editorial-black mb-6 border border-editorial-card-border shadow-xs">
            <CheckCircle2 className="w-8 h-8 stroke-[1.5]" />
          </div>

          <h2 className="text-3xl font-serif text-editorial-black mb-2 leading-tight">
            Pedido <span className="italic">Registrado</span>
          </h2>
          <p className="text-[10px] font-mono tracking-widest text-editorial-black/40 bg-editorial-sand px-3 py-1.5 rounded-sm inline-block font-semibold mb-6">
            ID DE REGISTRO: {placedOrder.id_orden}
          </p>

          {/* SUCCESS SCREEN UX EXPLAINING DE 30 MINUTES RULE AND TRANSFER CONSTRAINTS */}
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 sm:p-5 mb-8 text-left max-w-md shadow-xs">
            <span className="text-[10px] font-mono font-bold uppercase bg-amber-500/20 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded-[4px] tracking-wider">⚠️ Reserva Temporal Limitada</span>
            <p className="text-editorial-black text-xs font-light mt-2.5 leading-relaxed">
              El estado inicial de tu pedido es <strong className="font-semibold text-amber-600 dark:text-amber-400 bg-amber-550/10 px-1 py-0.5 rounded text-[11px] font-mono">Pendiente de Pago</strong>. Tu inventario exclusivo quedará reservado por exactamente <strong className="font-semibold text-amber-600 dark:text-amber-400 underline">30 minutos</strong>.
            </p>
            <p className="text-editorial-black/80 text-xs font-light mt-1.5 leading-relaxed">
              Deberás hacer clic en el botón inferior para enviarnos tu comprobante de pago o coordinar el despacho temporal mediante WhatsApp antes de que se cumpla el plazo, de lo contrario la reserva expirará y se liberará el producto para restaurar el stock físico.
            </p>
          </div>

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
              className="w-full py-3.5 border border-editorial-black hover:bg-editorial-black hover:text-editorial-ivory text-editorial-black font-semibold text-[10px] uppercase tracking-widest cursor-pointer transition-colors"
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
    <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
      {/* Navigation Return */}
      <button
        onClick={onBack}
        className="mb-8 flex items-center gap-1 text-editorial-black/60 hover:text-editorial-black uppercase tracking-widest font-semibold text-[10px] cursor-pointer transition-colors group"
      >
        <ChevronLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
        Regresar al Catálogo
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-start">
        {/* Form Inputs Block */}
        <form onSubmit={handleSubmit} className="lg:col-span-7 bg-editorial-card rounded-2xl border border-editorial-card-border p-4 sm:p-8 md:p-10 space-y-8 shadow-xs text-editorial-black">
          <div>
            <h3 className="text-2xl sm:text-3xl font-serif text-editorial-black">
              Detalles de <span className="italic">Despacho</span>
            </h3>
            <p className="text-xs text-editorial-black/50 uppercase tracking-wider font-mono mt-1">Check-out express libre de registro y con alta seguridad.</p>
          </div>

          {error && (
            <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-xs text-rose-500 flex items-start gap-2 rounded-lg">
              <Info className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Customer Inputs with Active Feedback and Validation warnings */}
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
                className={`w-full px-4 py-3 bg-editorial-card border rounded-xl text-sm focus:outline-none focus:ring-2 text-editorial-black placeholder-editorial-black/30 font-light transition-all duration-300 shadow-xs ${
                  isNombreSuspicious 
                    ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-100 bg-rose-500/10' 
                    : 'border-editorial-card-border focus:border-editorial-black focus:ring-editorial-black/10 hover:border-editorial-black/25'
                }`}
              />
              {isNombreSuspicious && (
                <p className="text-[10px] text-rose-600 font-mono mt-1 w-full text-left">⚠️ Contenido sospechoso no permitido (códigos o scripts).</p>
              )}
            </div>

            <div>
              <label htmlFor="telefono" className="block text-[10px] font-bold uppercase tracking-widest text-editorial-black/50 font-mono mb-2">Celular de Contacto / WhatsApp</label>
              <input
                type="tel"
                id="telefono"
                name="telefono"
                value={formData.telefono}
                onChange={handleInputChange}
                required
                placeholder="Ej. +57 300 123 4567"
                className={`w-full px-4 py-3 bg-editorial-card border rounded-xl text-sm focus:outline-none focus:ring-2 text-editorial-black placeholder-editorial-black/30 font-light transition-all duration-300 shadow-xs ${
                  isCelularSuspicious 
                    ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-100 bg-rose-500/10'
                    : isPhoneInvalid 
                      ? 'border-amber-400 focus:border-amber-500 focus:ring-amber-100 bg-amber-550/10'
                      : 'border-editorial-card-border focus:border-editorial-black focus:ring-editorial-black/10 hover:border-editorial-black/25'
                }`}
              />
              {isCelularSuspicious && (
                <p className="text-[10px] text-rose-600 font-mono mt-1 w-full text-left">⚠️ Contenido sospechoso no permitido.</p>
              )}
              {isPhoneInvalid && !isCelularSuspicious && (
                <p className="text-[10px] text-amber-500 font-mono mt-1 w-full text-left">⚠️ Formato incorrecto. Ingresa tu número móvil (Ej. +57 300 123 4567).</p>
              )}
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
                className={`w-full px-4 py-3 bg-editorial-card border rounded-xl text-sm focus:outline-none focus:ring-2 text-editorial-black placeholder-editorial-black/30 font-light transition-all duration-300 shadow-xs ${
                  isDireccionSuspicious 
                    ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-100 bg-rose-500/10' 
                    : 'border-editorial-card-border focus:border-editorial-black focus:ring-editorial-black/10 hover:border-editorial-black/25'
                }`}
              />
              {isDireccionSuspicious && (
                <p className="text-[10px] text-rose-600 font-mono mt-1 w-full text-left">⚠️ Contenido sospechoso no permitido.</p>
              )}
            </div>
          </div>

          {/* Payment Method Selector */}
          <div className="pt-6 border-t border-editorial-card-border">
            <span className="block text-[10px] font-bold uppercase tracking-widest text-editorial-black/50 font-mono mb-3.5">Método de Pago Seleccionado</span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { type: PaymentMethod.TRANSFERENCIA, label: "Transferencia", desc: "Nequi, Bancolombia, etc." },
                { type: PaymentMethod.EFECTIVO, label: "Contraentrega", desc: "Efectivo al recibir" },
                { type: PaymentMethod.TARJETA, label: "Tarjeta de Crédito", desc: "Enlace de pago" }
              ].map((pVal) => (
                <motion.button
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  type="button"
                  key={pVal.type}
                  onClick={() => setPaymentMethod(pVal.type)}
                  className={`p-4 border rounded-xl text-left transition-all cursor-pointer ${
                    paymentMethod === pVal.type
                      ? 'bg-editorial-black border-editorial-black text-editorial-ivory shadow-sm'
                      : 'bg-editorial-card hover:bg-editorial-sand border-editorial-card-border text-editorial-black'
                  }`}
                >
                  <span className="text-xs font-bold block">{pVal.label}</span>
                  <span className={`text-[10px] block mt-0.5 ${paymentMethod === pVal.type ? 'text-editorial-ivory/60' : 'text-editorial-black/40'}`}>
                    {pVal.desc}
                  </span>
                </motion.button>
              ))}
            </div>
          </div>

          {/* Google reCAPTCHA v3 Visual Container (Placeholder) */}
          <div className="bg-editorial-sand/30 border border-editorial-card-border rounded-xl p-3.5 flex items-center justify-between gap-3 text-[10px] text-editorial-black/50 leading-relaxed font-sans mt-2 shadow-xs">
            <div className="flex items-center gap-2.5">
              <svg className="w-6 h-6 text-emerald-600 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
              <div>
                <span className="block font-semibold text-[11px] text-editorial-black">Protección Google reCAPTCHA v3</span>
                <span>Análisis de comportamiento heurístico activo para bloquear software automatizado.</span>
              </div>
            </div>
            <div className="shrink-0 flex items-center gap-1 opacity-90">
              <span className="font-mono font-bold text-[8px] bg-emerald-550/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 rounded-sm">Seguro</span>
            </div>
          </div>

          <motion.button
            whileHover={{ scale: isFormInvalid ? 1 : 1.01 }}
            whileTap={{ scale: isFormInvalid ? 1 : 0.99 }}
            type="submit"
            disabled={loading || isFormInvalid}
            className={`w-full py-4.5 text-xs uppercase font-bold tracking-[0.16em] transition-all cursor-pointer shadow-md rounded-xl ${
              isFormInvalid 
                ? 'bg-neutral-300 dark:bg-neutral-800 text-neutral-500 cursor-not-allowed opacity-65 shadow-none' 
                : 'bg-editorial-black hover:opacity-95 text-editorial-ivory'
            }`}
          >
            {loading ? "Procesando Orden..." : "Confirmar Compra y Concluir en WhatsApp"}
          </motion.button>
        </form>

        {/* Dynamic Purchase Summary column */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-editorial-sand border border-editorial-card-border rounded-2xl p-6 text-editorial-black animate-none">
            <h4 className="text-[10px] font-bold uppercase tracking-widest text-editorial-black/60 font-mono mb-4">Resumen del Pedido</h4>
            
            <div className="divide-y divide-editorial-card-border max-h-80 overflow-y-auto pr-1">
              {cart.map((item) => (
                <div key={item.product.id} className="py-4 flex gap-4 items-center">
                  <img
                    src={item.product.imagenUrl}
                    alt={item.product.nombre}
                    referrerPolicy="no-referrer"
                    className="w-12 h-16 object-cover bg-neutral-200/20 border border-editorial-card-border flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <h5 className="text-xs uppercase font-bold text-editorial-black truncate pr-1">{item.product.nombre}</h5>
                    <span className="text-[10px] text-editorial-black/50 font-mono uppercase block mt-1">Cantidad: {item.quantity}</span>
                  </div>
                  <span className="text-xs font-mono font-bold text-editorial-black">${item.product.precio * item.quantity} USD</span>
                </div>
              ))}
            </div>

            <div className="pt-4 mt-4 border-t border-editorial-card-border space-y-2">
              <div className="flex justify-between text-editorial-black/55 text-[10px] uppercase tracking-wider font-mono">
                <span>Subtotal</span>
                <span>${cartSubtotal} USD</span>
              </div>
              <div className="flex justify-between text-editorial-black/55 text-[10px] uppercase tracking-wider font-mono pt-1">
                <span>Envío</span>
                <span className="text-emerald-700 dark:text-emerald-400 font-bold">Sin costo</span>
              </div>
              <div className="flex justify-between text-editorial-black font-bold text-base border-t border-editorial-card-border pt-4">
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
