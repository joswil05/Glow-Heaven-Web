/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { ArrowRight, Compass } from 'lucide-react';
import { motion } from 'motion/react';

interface HeroProps {
  onScrollToCatalog: () => void;
  onOpenQuiz: () => void;
}

export const Hero: React.FC<HeroProps> = ({ onScrollToCatalog, onOpenQuiz }) => {
  return (
    <section className="relative min-h-[80vh] flex flex-col md:flex-row border-b border-editorial-black/10">
      
      {/* Editorial Left Column / Creative Pane */}
      <div className="w-full md:w-1/2 bg-editorial-sand flex flex-col justify-center px-8 sm:px-16 py-12 md:py-20 relative overflow-hidden">
        {/* Absolute Season Indicator */}
        <div className="absolute top-8 left-8 sm:left-16 text-[10px] uppercase tracking-[0.3em] text-editorial-black/40 font-mono font-bold">
          Colección de Estación • 2026
        </div>

        <div className="max-w-md mt-6">
          <motion.h1
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-6xl sm:text-7xl font-serif leading-[0.95] tracking-tight text-editorial-black mb-6"
          >
            Firma <br />
            <span className="italic font-normal">Invisible</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.15 }}
            className="text-sm sm:text-base leading-relaxed text-editorial-black/70 mb-8 font-light"
          >
            Descubre una selección exquisita de tesoros olfativos diseñados para elevar tu aura y trascender el tiempo. Materias primas cultivadas en Grasse y fundidas en tu piel.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="flex flex-col sm:flex-row gap-3.5"
          >
            <button
              onClick={onScrollToCatalog}
              className="px-8 py-4 bg-editorial-black text-editorial-ivory hover:bg-editorial-black/90 text-[10px] uppercase tracking-widest font-bold transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              Explorar Catálogo
              <ArrowRight className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={onOpenQuiz}
              className="px-8 py-4 border border-editorial-black hover:bg-editorial-black hover:text-editorial-ivory text-editorial-black text-[10px] uppercase tracking-widest font-bold transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              Encontrar Mi Esencia (Quiz)
            </button>
          </motion.div>
        </div>

        <div className="mt-12 sm:mt-16 flex items-center gap-4">
          <div className="w-12 h-[1px] bg-editorial-black/50"></div>
          <span className="text-[10px] uppercase tracking-widest italic text-editorial-black/60">Esencias De Distinción</span>
        </div>
      </div>

      {/* Editorial Right Column / Immersive Visual Pane */}
      <div className="w-full md:w-1/2 min-h-[350px] md:min-h-auto relative bg-editorial-clay flex items-center justify-center py-16 px-8 border-t md:border-t-0 md:border-l border-editorial-black/10">
        <div 
          className="absolute inset-0 bg-cover bg-center opacity-70 mix-blend-multiply transition-transform duration-1000"
          style={{ 
            backgroundImage: "url('https://images.unsplash.com/photo-1541643600914-78b084683601?auto=format&fit=crop&q=80&w=1200')" 
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-editorial-clay/80 via-transparent to-transparent" />
        
        {/* Floating Minimal Card holding brand core philosophy */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.3 }}
          className="relative bg-white/95 backdrop-blur-md border border-editorial-black/10 p-6 sm:p-8 max-w-xs shadow-sm flex flex-col items-center text-center"
        >
          <Compass className="w-6 h-6 text-editorial-black mb-3.5" />
          <h3 className="font-serif italic text-lg text-editorial-black mb-1">Recomendación Sugerida</h3>
          <p className="text-[11px] leading-relaxed text-editorial-black/60 font-light mb-4">
            "Un aroma de ámbar, vainilla y mística orquídea. La firma invisible perfecta."
          </p>
          <button 
            onClick={onOpenQuiz}
            className="text-[9px] uppercase tracking-widest font-mono font-bold text-editorial-black border-b border-editorial-black pb-0.5 hover:opacity-60 transition-opacity"
          >
            Iniciar Quiz Olfativo →
          </button>
        </motion.div>
      </div>

    </section>
  );
};
