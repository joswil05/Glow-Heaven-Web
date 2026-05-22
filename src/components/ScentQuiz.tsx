/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { QuizAnswers, Gender, Product } from '../types';
import { useCart } from '../context/CartContext';
import { RotateCcw, ShoppingBag, Sparkles, Sun, Moon, Compass } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ScentQuizProps {
  onClose: () => void;
  onScrollToCatalog: () => void;
}

export const ScentQuiz: React.FC<ScentQuizProps> = ({ onClose, onScrollToCatalog }) => {
  const { products, addToCart } = useCart();
  const [step, setStep] = useState<number>(1);
  const [answers, setAnswers] = useState<Partial<QuizAnswers>>({});
  const [recommendation, setRecommendation] = useState<Product | null>(null);

  const handleSelectAnswer = (key: keyof QuizAnswers, value: any) => {
    const updatedAnswers = { ...answers, [key]: value };
    setAnswers(updatedAnswers);

    if (step < 3) {
      setStep((p) => p + 1);
    } else {
      // Calculate Recommendation at the final step!
      findRecommendation(updatedAnswers as QuizAnswers);
      setStep(4);
    }
  };

  const findRecommendation = (finalAnswers: QuizAnswers) => {
    const scoredProducts = products.map((product) => {
      let score = 0;

      // 1. Gender matching (Highly critical weight)
      if (product.genero === finalAnswers.genero) {
        score += 10;
      } else if (product.genero === Gender.UNISEX) {
        score += 5; // unisex fits anything with lower priority
      }

      // 2. Olfactory notes alignment
      const queryNotes = finalAnswers.notas; // 'frescas' | 'dulces' | 'madera_especias' | 'florales'
      const productNotesLower = product.notas.map(n => n.toLowerCase());

      if (queryNotes === 'frescas') {
        const triggers = ['menta', 'sal', 'pomelo', 'mandarina', 'limón', 'brisa', 'agua', 'bergamota'];
        if (productNotesLower.some(n => triggers.some(t => n.includes(t)))) score += 8;
      } else if (queryNotes === 'dulces') {
        const triggers = ['miel', 'durazno', 'vainilla', 'dulce', 'coco', 'haba tonka', 'caramelo'];
        if (productNotesLower.some(n => triggers.some(t => n.includes(t)))) score += 8;
      } else if (queryNotes === 'madera_especias') {
        const triggers = ['cedro', 'sándalo', 'pachulí', 'pimienta', 'oud', 'madera', 'tabaco', 'azafrán'];
        if (productNotesLower.some(n => triggers.some(t => n.includes(t)))) score += 8;
      } else if (queryNotes === 'florales') {
        const triggers = ['rosa', 'jazmín', 'orquídea', 'flor', 'lavanda', 'lirio', 'violetas'];
        if (productNotesLower.some(n => triggers.some(t => n.includes(t)))) score += 8;
      }

      // 3. Occasion matching rules
      const occasion = finalAnswers.ocasion; // 'diario' | 'noche' | 'especial'
      if (occasion === 'diario') {
        // Daily benefits fresh scents
        if (productNotesLower.some(n => ['sal', 'menta', 'pomelo', 'mandarina'].some(t => n.includes(t)))) {
          score += 5;
        }
      } else if (occasion === 'noche') {
        // Night fits heavy spices, vanilla, woods
        if (productNotesLower.some(n => ['ámbar', 'vainilla', 'pachulí', 'oud', 'pimienta'].some(t => n.includes(t)))) {
          score += 5;
        }
      } else if (occasion === 'especial') {
        // Special events fit luxury complexes like Oud, Ambar or rich florals
        if (productNotesLower.some(n => ['oud', 'azafrán', 'rosa', 'jazmín', 'ámbar'].some(t => n.includes(t)))) {
          score += 5;
        }
      }

      return { product, score };
    });

    const sorted = scoredProducts.sort((a, b) => b.score - a.score);
    if (sorted.length > 0 && sorted[0].score > 0) {
      setRecommendation(sorted[0].product);
    } else {
      const fallback = products.find(p => p.id === 'prod_ambre_eclat') || products[0];
      setRecommendation(fallback);
    }
  };

  const handleRestart = () => {
    setStep(1);
    setAnswers({});
    setRecommendation(null);
  };

  return (
    <div className="bg-white border border-editorial-black/10 rounded-2xl p-6 md:p-10 max-w-2xl mx-auto shadow-sm relative overflow-hidden">
      {/* Editorial Decorative Details */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-editorial-sand/50 rounded-full filter blur-2xl" />

      <div className="flex justify-between items-center mb-8 pb-4 border-b border-editorial-black/10">
        <h3 className="text-xl font-serif text-editorial-black italic flex items-center gap-2">
          <Compass className="w-4 h-4 text-editorial-black/60" />
          Encuentra tu esencia
        </h3>
        <span className="text-xs uppercase tracking-widest font-semibold font-mono text-editorial-black/40">
          Pregunta {Math.min(step, 3)} / 03
        </span>
      </div>

      <AnimatePresence mode="wait">
        {step === 1 && (
          <motion.div
            key="step1"
            initial={{ opacity: 0, x: 15 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -15 }}
            transition={{ duration: 0.3 }}
            className="space-y-4"
          >
            <p className="text-base text-editorial-black font-serif italic mb-5">1. ¿Para qué ocasión principal buscas este perfume?</p>
            <div className="grid grid-cols-1 gap-3">
              <button
                onClick={() => handleSelectAnswer('ocasion', 'diario')}
                className="p-4 bg-editorial-sand hover:bg-editorial-clay border border-editorial-black/10 text-left rounded-xl transition-all cursor-pointer flex items-center justify-between group"
              >
                <div>
                  <span className="text-[11px] uppercase tracking-widest font-bold text-editorial-black block group-hover:opacity-70">Uso Diario / Casual</span>
                  <span className="text-[10px] text-editorial-black/50 block mt-0.5">Fresco, dinámico, diario.</span>
                </div>
                <Sun className="w-4 h-4 text-editorial-black/40 group-hover:text-editorial-black transition-colors" />
              </button>

              <button
                onClick={() => handleSelectAnswer('ocasion', 'noche')}
                className="p-4 bg-editorial-sand hover:bg-editorial-clay border border-editorial-black/10 text-left rounded-xl transition-all cursor-pointer flex items-center justify-between group"
              >
                <div>
                  <span className="text-[11px] uppercase tracking-widest font-bold text-editorial-black block group-hover:opacity-70">Noches de Salida</span>
                  <span className="text-[10px] text-editorial-black/50 block mt-0.5">Intenso y cautivador para cenas o fiestas.</span>
                </div>
                <Moon className="w-4 h-4 text-editorial-black/40 group-hover:text-editorial-black transition-colors" />
              </button>

              <button
                onClick={() => handleSelectAnswer('ocasion', 'especial')}
                className="p-4 bg-editorial-sand hover:bg-editorial-clay border border-editorial-black/10 text-left rounded-xl transition-all cursor-pointer flex items-center justify-between group"
              >
                <div>
                  <span className="text-[11px] uppercase tracking-widest font-bold text-editorial-black block group-hover:opacity-70">Momentos Especiales</span>
                  <span className="text-[10px] text-editorial-black/50 block mt-0.5">Exclusivo, de alta costura, imponente.</span>
                </div>
                <Sparkles className="w-4 h-4 text-editorial-black/40 group-hover:text-editorial-black transition-colors" />
              </button>
            </div>
          </motion.div>
        )}

        {step === 2 && (
          <motion.div
            key="step2"
            initial={{ opacity: 0, x: 15 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -15 }}
            transition={{ duration: 0.3 }}
            className="space-y-4"
          >
            <p className="text-base text-editorial-black font-serif italic mb-5">2. ¿Qué familia olfativa o notas te atraen más?</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                onClick={() => handleSelectAnswer('notas', 'frescas')}
                className="p-5 border border-editorial-black/20 hover:border-editorial-black bg-editorial-sand rounded-xl text-left transition-all cursor-pointer group"
              >
                <span className="text-[11px] uppercase tracking-widest font-bold text-editorial-black block">Frescas / Cítricas</span>
                <span className="text-[10px] text-editorial-black/50 mt-1 block">Brillo de limón, sal de mar y menta.</span>
              </button>

              <button
                onClick={() => handleSelectAnswer('notas', 'dulces')}
                className="p-5 border border-editorial-black/20 hover:border-editorial-black bg-editorial-sand rounded-xl text-left transition-all cursor-pointer group"
              >
                <span className="text-[11px] uppercase tracking-widest font-bold text-editorial-black block">Dulces / Gourmet</span>
                <span className="text-[10px] text-editorial-black/50 mt-1 block">Vainilla cálida, miel y durazno.</span>
              </button>

              <button
                onClick={() => handleSelectAnswer('notas', 'madera_especias')}
                className="p-5 border border-editorial-black/20 hover:border-editorial-black bg-editorial-sand rounded-xl text-left transition-all cursor-pointer group"
              >
                <span className="text-[11px] uppercase tracking-widest font-bold text-editorial-black block">Cálidas / Maderas</span>
                <span className="text-[10px] text-editorial-black/50 mt-1 block">Sándalo, oud valioso, cedro y pimienta.</span>
              </button>

              <button
                onClick={() => handleSelectAnswer('notas', 'florales')}
                className="p-5 border border-editorial-black/20 hover:border-editorial-black bg-editorial-sand rounded-xl text-left transition-all cursor-pointer group"
              >
                <span className="text-[11px] uppercase tracking-widest font-bold text-editorial-black block">Florales Sublimes</span>
                <span className="text-[10px] text-editorial-black/50 mt-1 block">Rosa de Grasse, orquídea y jazmín.</span>
              </button>
            </div>

            <button
              onClick={() => setStep(1)}
              className="mt-6 text-[10px] uppercase tracking-widest hover:opacity-100 text-editorial-black/50 flex items-center gap-1 cursor-pointer transition-colors"
            >
              <RotateCcw className="w-3 h-3" /> Regresar
            </button>
          </motion.div>
        )}

        {step === 3 && (
          <motion.div
            key="step3"
            initial={{ opacity: 0, x: 15 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -15 }}
            transition={{ duration: 0.3 }}
            className="space-y-4"
          >
            <p className="text-base text-editorial-black font-serif italic mb-5">3. ¿Para quién está pensada la fragancia?</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <button
                onClick={() => handleSelectAnswer('genero', Gender.DAMA)}
                className="p-4 border border-editorial-black/25 hover:border-editorial-black bg-editorial-sand text-center rounded-xl transition-all cursor-pointer group"
              >
                <span className="text-[11px] uppercase tracking-widest font-bold text-editorial-black block whitespace-nowrap">Para Dama</span>
              </button>

              <button
                onClick={() => handleSelectAnswer('genero', Gender.CABALLERO)}
                className="p-4 border border-editorial-black/25 hover:border-editorial-black bg-editorial-sand text-center rounded-xl transition-all cursor-pointer group"
              >
                <span className="text-[11px] uppercase tracking-widest font-bold text-editorial-black block whitespace-nowrap">Para Caballero</span>
              </button>

              <button
                onClick={() => handleSelectAnswer('genero', Gender.UNISEX)}
                className="p-4 border border-editorial-black/25 hover:border-editorial-black bg-editorial-sand text-center rounded-xl transition-all cursor-pointer group"
              >
                <span className="text-[11px] uppercase tracking-widest font-bold text-editorial-black block whitespace-nowrap">Unisex</span>
              </button>
            </div>

            <button
              onClick={() => setStep(2)}
              className="mt-6 text-[10px] uppercase tracking-widest hover:opacity-100 text-editorial-black/50 flex items-center gap-1 cursor-pointer transition-colors"
            >
              <RotateCcw className="w-3 h-3" /> Regresar
            </button>
          </motion.div>
        )}

        {step === 4 && recommendation && (
          <motion.div
            key="step4"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4 }}
            className="text-center"
          >
            <div className="inline-flex items-center gap-1.5 px-3 py-1 border border-editorial-black/10 bg-editorial-sand text-editorial-black rounded-sm text-[10px] uppercase tracking-[0.2em] font-mono mb-6">
              <Sparkles className="w-3 h-3" /> Recomendación Olfativa
            </div>

            <div className="flex flex-col md:flex-row gap-8 items-center text-left bg-editorial-sand/70 p-6 sm:p-8 rounded-2xl border border-editorial-black/10 mb-8">
              <img
                src={recommendation.imagenUrl}
                alt={recommendation.nombre}
                referrerPolicy="no-referrer"
                className="w-32 h-40 md:w-44 md:h-52 rounded-lg object-cover bg-neutral-200 shadow-sm border border-editorial-black/10"
              />
              <div className="flex-1">
                <span className="text-[10px] uppercase text-editorial-black/40 tracking-wider font-mono">
                  {recommendation.marca} • {recommendation.genero}
                </span>
                <h4 className="text-3xl font-serif font-normal text-editorial-black mt-1">{recommendation.nombre}</h4>
                <p className="text-editorial-black/70 text-xs sm:text-sm font-light mt-3 leading-relaxed">
                  {recommendation.descripcion}
                </p>
                <div className="flex flex-wrap gap-1.5 mt-4">
                  {recommendation.notas.map((n) => (
                    <span key={n} className="text-[9px] uppercase tracking-wider px-2 py-1 bg-white text-editorial-black rounded border border-editorial-black/5 font-mono">
                      {n}
                    </span>
                  ))}
                </div>
                <div className="mt-5 flex items-baseline gap-4">
                  <span className="text-2xl font-serif text-editorial-black">${recommendation.precio} USD</span>
                  {recommendation.stock > 0 ? (
                    <span className="text-[11px] uppercase tracking-wider text-emerald-600 font-semibold">✓ En Stock ({recommendation.stock} u.)</span>
                  ) : (
                    <span className="text-[11px] uppercase tracking-wider text-rose-500 font-semibold">Agotado</span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3.5 justify-center">
              {recommendation.stock > 0 ? (
                <button
                  onClick={() => {
                    addToCart(recommendation);
                    onClose();
                    onScrollToCatalog();
                  }}
                  className="px-8 py-3.5 bg-editorial-black text-editorial-ivory hover:bg-editorial-black/90 text-[10px] uppercase tracking-widest font-bold flex items-center justify-center gap-2 cursor-pointer transition-all"
                >
                  <ShoppingBag className="w-3.5 h-3.5" />
                  Agregar e Ir al Catálogo
                </button>
              ) : (
                <button
                  disabled
                  className="px-8 py-3.5 bg-editorial-clay text-editorial-black/40 text-[10px] uppercase tracking-widest font-bold cursor-not-allowed border border-editorial-black/10"
                >
                  Perfume Agotado
                </button>
              )}

              <button
                onClick={handleRestart}
                className="px-8 py-3.5 border border-editorial-black hover:bg-editorial-black hover:text-editorial-ivory text-editorial-black text-[10px] uppercase tracking-widest font-bold flex items-center justify-center gap-2 cursor-pointer transition-all"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Hacer de nuevo
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
