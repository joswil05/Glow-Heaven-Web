import React from 'react';
import { Star, CheckCircle, Quote } from 'lucide-react';
import { motion } from 'motion/react';

interface Testimonial {
  id: number;
  name: string;
  location: string;
  rating: number;
  comment: string;
  perfume: string;
  date: string;
}

export const Testimonials: React.FC = () => {
  const reviews: Testimonial[] = [
    {
      id: 1,
      name: "Valeria Mendoza",
      location: "Bogotá, Colombia",
      rating: 5,
      comment: "El aroma es sencillamente espectacular, sutil pero con una fijación increíble. El empaque venía sellado y con un detalle de lujo. ¡Recomendada la asesoría por WhatsApp!",
      perfume: "Firma Invisible (Edición Grasse)",
      date: "Hace 3 días",
    },
    {
      id: 2,
      name: "Mateo Aristizábal",
      location: "Medellín, Colombia",
      rating: 5,
      comment: "Tenía mis dudas sobre la compra en línea, pero me atendió el sommelier AI y luego la verificación manual. La reserva de 30 minutos me dio la tranquilidad de pagar sin afán.",
      perfume: "Aura Imperial (Extrait de Parfum)",
      date: "Hace 1 semana",
    },
    {
      id: 3,
      name: "Isabella Velez",
      location: "Cali, Colombia",
      rating: 5,
      comment: "Una joya de la perfumería de autor. El despacho fue coordinado de inmediato tras mandar la transferencia. Se nota el cuidado y que realmente son esencias 100% originales.",
      perfume: "Seda Absoluta (Eau de Parfum)",
      date: "Hace 2 semanas",
    },
  ];

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.15,
        delayChildren: 0.1,
      },
    },
  };

  const cardVariants = {
    hidden: { opacity: 0, y: 30, scale: 0.97 },
    show: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: {
        type: 'spring',
        stiffness: 85,
        damping: 15,
        duration: 0.8,
      },
    },
  };

  return (
    <section className="bg-editorial-sand/15 border-t border-editorial-black/5 py-16 sm:py-20 px-6 sm:px-10 overflow-hidden">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className="text-center mb-12 sm:mb-16"
        >
          <span className="text-[10px] uppercase tracking-[0.25em] text-editorial-black/50 font-semibold font-mono">Voces de Distinción</span>
          <h3 className="text-3xl md:text-4xl font-serif mt-2 mb-3">
            Nuestros <span className="italic font-normal">Satisfechos Clientes</span>
          </h3>
          <p className="text-editorial-black/60 text-xs sm:text-sm font-light max-w-md mx-auto">
            Descubre las reseñas y experiencias olfativas reales de nuestra distinguida comunidad de coleccionistas.
          </p>
        </motion.div>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: '-50px' }}
          className="grid grid-cols-1 md:grid-cols-3 gap-8"
        >
          {reviews.map((review, idx) => (
            <motion.div
              key={review.id}
              variants={cardVariants}
              className="bg-white border border-editorial-black/10 rounded-2xl p-6 sm:p-8 flex flex-col justify-between shadow-xs relative hover:shadow-md transition-all duration-300"
            >
              {/* Quote icon watermark */}
              <Quote className="absolute top-6 right-6 w-8 h-8 text-editorial-sand/30" />

              <div>
                {/* Stars */}
                <div className="flex gap-1 mb-4">
                  {[...Array(review.rating)].map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />
                  ))}
                </div>

                <p className="text-xs sm:text-[13px] leading-relaxed text-editorial-black/75 font-light italic mb-6">
                  "{review.comment}"
                </p>
              </div>

              <div className="border-t border-editorial-black/5 pt-4 mt-auto">
                <div className="flex items-center justify-between">
                  <div>
                    <h5 className="text-[11px] sm:text-xs font-bold text-editorial-black uppercase tracking-wider flex items-center gap-1.5">
                      {review.name}
                      <span className="inline-flex" title="Comprador Verificado">
                        <CheckCircle className="w-3.5 h-3.5 text-emerald-600 fill-emerald-50" />
                      </span>
                    </h5>
                    <span className="text-[10px] text-zinc-400 block mt-0.5">{review.location}</span>
                  </div>
                  <span className="text-[9px] font-mono text-zinc-400 uppercase tracking-widest">{review.date}</span>
                </div>
                
                {/* Tag of purchased perfume */}
                <div className="mt-3.5 flex items-center gap-1.5 bg-editorial-sand/40 border border-editorial-black/5 rounded-md px-2.5 py-1 self-start">
                  <span className="text-[9px] text-editorial-black/45 font-mono uppercase tracking-wider">Adquirido:</span>
                  <span className="text-[9.5px] font-medium text-editorial-black/80 font-serif leading-none">{review.perfume}</span>
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
};
