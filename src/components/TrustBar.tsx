import React from 'react';
import { Truck, ShieldCheck, Headphones, Clock } from 'lucide-react';
import { motion } from 'motion/react';

export const TrustBar: React.FC = () => {
  const steps = [
    {
      icon: <ShieldCheck className="w-5 h-5 text-emerald-600" />,
      title: "Fragancias 100% Originales",
      desc: "Importaciones oficiales directas de Grasse",
    },
    {
      icon: <Truck className="w-5 h-5 text-editorial-black/70" />,
      title: "Envíos Seguros y Coordinados",
      desc: "Entrega express con rastreo personalizado",
    },
    {
      icon: <Clock className="w-5 h-5 text-amber-600" />,
      title: "Reserva VIP de 30 Minutos",
      desc: "Garantía de stock reservado temporalmente",
    },
    {
      icon: <Headphones className="w-5 h-5 text-indigo-600" />,
      title: "Asesoría Personalizada 24/7",
      desc: "Sommelier virtual y atención vía WhatsApp",
    },
  ];

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.12,
        delayChildren: 0.05,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    show: {
      opacity: 1,
      y: 0,
      transition: {
        type: 'spring',
        stiffness: 110,
        damping: 15,
        duration: 0.7,
      },
    },
  };

  return (
    <div className="w-full bg-white relative py-6 sm:py-8 px-4 sm:px-6 md:px-8 overflow-hidden">
      {/* Premium Border expansion line effects on enter */}
      <motion.div 
        initial={{ scaleX: 0 }}
        whileInView={{ scaleX: 1 }}
        viewport={{ once: true, margin: "-50px" }}
        transition={{ duration: 1.2, ease: "easeOut" }}
        className="absolute top-0 left-0 right-0 h-[1px] bg-editorial-black/5 origin-left"
      />
      <motion.div 
        initial={{ scaleX: 0 }}
        whileInView={{ scaleX: 1 }}
        viewport={{ once: true, margin: "-50px" }}
        transition={{ duration: 1.2, ease: "easeOut" }}
        className="absolute bottom-0 left-0 right-0 h-[1px] bg-editorial-black/5 origin-right"
      />

      <div className="max-w-7xl mx-auto">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-100px" }}
          className="grid grid-cols-2 md:grid-cols-4 gap-6 sm:gap-8 divide-y md:divide-y-0 md:divide-x divide-editorial-black/10"
        >
          {steps.map((step, idx) => (
            <motion.div
              key={idx}
              variants={itemVariants}
              className={`flex flex-col items-center md:items-start text-center md:text-left gap-3 ${
                idx > 0 ? 'pt-6 md:pt-0 md:pl-6' : 'md:pl-0'
              }`}
            >
              <div className="p-2.5 bg-editorial-sand/40 rounded-xl inline-flex items-center justify-center shadow-xs">
                {step.icon}
              </div>
              <div>
                <h4 className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-editorial-black">
                  {step.title}
                </h4>
                <p className="text-[10px] sm:text-[11.5px] text-editorial-black/55 font-light mt-1">
                  {step.desc}
                </p>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </div>
  );
};
