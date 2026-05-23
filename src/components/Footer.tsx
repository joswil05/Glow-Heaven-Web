import React, { useState } from 'react';
import { ShieldCheck, HelpCircle, FileText, Lock, ChevronDown, Landmark, HandCoins, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface PolicyItem {
  id: string;
  icon: React.ReactNode;
  title: string;
  content: React.ReactNode;
}

export const Footer: React.FC = () => {
  const [activeAccordion, setActiveAccordion] = useState<string | null>(null);

  const toggleAccordion = (id: string) => {
    setActiveAccordion(activeAccordion === id ? null : id);
  };

  const policies: PolicyItem[] = [
    {
      id: "garantia",
      icon: <ShieldCheck className="w-4 h-4 text-emerald-600" />,
      title: "Garantía y Originalidad 100%",
      content: (
        <div className="space-y-2 text-editorial-black/70 text-xs font-light leading-relaxed">
          <p>
            En <strong>Glow Heaven</strong>, cada una de nuestras piezas olfativas es adquirida directamente de distribuidores oficiales y casas autorizadas en Grasse, Francia.
          </p>
          <p>
            Garantizamos la originalidad absoluta de nuestros lotes. Si la fragancia no cumple con los más altos estándares de autenticidad exigidos, gestionaremos la devolución de tu dinero.
          </p>
        </div>
      ),
    },
    {
      id: "faq",
      icon: <HelpCircle className="w-4 h-4 text-editorial-black/60" />,
      title: "Preguntas Frecuentes (FAQ)",
      content: (
        <div className="space-y-3.5 text-editorial-black/70 text-xs font-light leading-relaxed">
          <div>
            <h5 className="font-semibold text-editorial-black pr-2">¿Cómo se confirma mi pedido?</h5>
            <p>Un asesor manual procesará tu comprobante de transferencia bancaria enviado por WhatsApp antes del vencimiento temporal de 30 minutos.</p>
          </div>
          <div>
            <h5 className="font-semibold text-editorial-black pr-2">¿Qué métodos de pago son admitidos?</h5>
            <p>Transferencia Bancaria directa (Bancolombia, Nequi, Daviplata, PSE) y Pago Contra Entrega en efectivo.</p>
          </div>
          <div>
            <h5 className="font-semibold text-editorial-black pr-2">¿Cuánto dura la entrega?</h5>
            <p>Los envíos tardan entre 24 y 48 horas una vez coordinado y confirmado el abono correspondiente.</p>
          </div>
        </div>
      ),
    },
    {
      id: "terminos",
      icon: <FileText className="w-4 h-4 text-indigo-600" />,
      title: "Términos de Servicio",
      content: (
        <div className="space-y-2 text-editorial-black/70 text-xs font-light leading-relaxed">
          <p>
            Al solicitar un pedido, el sistema bloquea los artículos correspondientes del inventario físico durante un lapso estricto de <strong>30 minutos</strong>.
          </p>
          <p>
            Si transcurrido este término no se reporta el comprobante de pago o de contacto directo a nuestro canal de atención por WhatsApp, el pedido se cancelará automáticamente y las unidades volverán al canal público.
          </p>
        </div>
      ),
    },
    {
      id: "privacidad",
      icon: <Lock className="w-4 h-4 text-rose-500" />,
      title: "Privacidad de Datos",
      content: (
        <div className="space-y-2 text-editorial-black/70 text-xs font-light leading-relaxed">
          <p>
            Tus datos de nombre, celular y dirección se utilizan exclusivamente para los fines de envío, verificación telefónica y soporte posventa directo. No compartimos tu información con terceros de acuerdo con las leyes vigentes de régimen de protección de bases de datos.
          </p>
        </div>
      ),
    },
  ];

  return (
    <footer className="bg-white border-t border-editorial-black/10 text-editorial-black">
      {/* Upper Policy Section (Accordions) */}
      <div className="max-w-7xl mx-auto px-6 sm:px-10 py-10 sm:py-14 border-b border-editorial-black/5">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-4 text-left">
            <span className="font-serif italic font-bold text-xl uppercase tracking-wider block">
              Glow <span className="font-sans font-light not-italic text-xs tracking-widest pl-1">Heaven</span>
            </span>
            <p className="text-editorial-black/50 text-[11px] font-mono uppercase tracking-widest mt-1.5">
              Esencias De Distinción • 2026
            </p>
            <p className="text-zinc-400 text-xs font-light leading-relaxed mt-4 max-w-sm">
              Una cuidada selección de creaciones premium. Control total de stock y transacciones verificadas con protección integrada contra la venta de inventario fantasma.
            </p>
          </div>

          <div className="lg:col-span-8 w-full space-y-3">
            <span className="text-[9px] uppercase tracking-widest font-mono text-editorial-black/40 block mb-2 font-bold">
              Sección de Transparencia y Legal
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {policies.map((p) => {
                const isOpen = activeAccordion === p.id;
                return (
                  <div
                    key={p.id}
                    className="border border-editorial-black/10 rounded-xl bg-editorial-sand/10 overflow-hidden transition-all hover:bg-editorial-sand/20"
                  >
                    <button
                      onClick={() => toggleAccordion(p.id)}
                      className="w-full flex items-center justify-between p-4 text-left focus:outline-none"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-1.5 bg-white rounded-md border border-editorial-black/5 shadow-xs">
                          {p.icon}
                        </div>
                        <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-editorial-black/85">
                          {p.title}
                        </span>
                      </div>
                      <motion.div
                        animate={{ rotate: isOpen ? 180 : 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        <ChevronDown className="w-4 h-4 text-editorial-black/40" />
                      </motion.div>
                    </button>

                    <AnimatePresence initial={false}>
                      {isOpen && (
                        <motion.div
                          initial="collapsed"
                          animate="open"
                          exit="collapsed"
                          variants={{
                            open: { opacity: 1, height: "auto" },
                            collapsed: { opacity: 0, height: 0 }
                          }}
                          transition={{ duration: 0.3, ease: [0.04, 0.62, 0.23, 0.98] }}
                        >
                          <div className="p-4 pt-1 border-t border-editorial-black/5 bg-white">
                            {p.content}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Under Credits Bar (Footer End) */}
      <div className="max-w-7xl mx-auto px-6 sm:px-10 py-6 sm:py-8 flex flex-col md:flex-row items-center justify-between gap-6 text-[10px] uppercase tracking-widest font-medium">
        {/* Left side */}
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-6 items-center text-center sm:text-left">
          <div className="flex items-center gap-2">
            <span className="text-[9.5px] font-serif italic text-emerald-800 font-semibold uppercase bg-emerald-50 border border-emerald-100 rounded-md px-2 py-0.5 shadow-xs">Originalidad Certificada</span>
          </div>
          <span className="hidden sm:inline text-editorial-black/20">|</span>
          <span className="text-editorial-black/60 font-mono text-[9px]">Acompañamiento VIP vía WhatsApp 24/7</span>
        </div>

        {/* Payment Icons Represented Sophisticatedly */}
        <div className="flex flex-col items-center sm:items-end gap-2.5">
          <span className="text-[8px] font-bold text-zinc-400 tracking-[0.2em] font-mono">
            Canales de Pago Habilitados
          </span>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 bg-neutral-150 border border-zinc-200/50 rounded-md px-2.5 py-1 text-zinc-700 text-[9px] font-bold font-mono tracking-normal leading-none hover:bg-neutral-200 transition-colors">
              <Landmark className="w-3.5 h-3.5 text-editorial-black" />
              <span>TRANSFERENCIA BANCARIA</span>
            </div>
            <div className="flex items-center gap-1 bg-neutral-150 border border-zinc-200/50 rounded-md px-2.5 py-1 text-zinc-700 text-[9px] font-bold font-mono tracking-normal leading-none hover:bg-neutral-200 transition-colors">
              <HandCoins className="w-3.5 h-3.5 text-emerald-700" />
              <span>CONTRAENTREGA COORD.</span>
            </div>
          </div>
        </div>
      </div>

      {/* Fine Print Footer Copyright */}
      <div className="w-full bg-neutral-50 border-t border-neutral-100/60 py-4 px-6 text-center text-zinc-400 text-[9px] font-mono uppercase tracking-[0.25em]">
        <span>© 2026 GLOW HEAVEN CO. Todos los derechos reservados • Conexión Cifrada Transf. SSL 256-bits</span>
      </div>
    </footer>
  );
};
