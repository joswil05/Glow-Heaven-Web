/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { QuizAnswers, Gender, Product } from '../types';
import { useCart } from '../context/CartContext';
import { RotateCcw, ShoppingBag, Sparkles, Sun, Moon, Compass, Bot, Loader2, Lightbulb } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ScentQuizProps {
  onClose: () => void;
  onScrollToCatalog: () => void;
}

export const ScentQuiz: React.FC<ScentQuizProps> = ({ onClose, onScrollToCatalog }) => {
  const { products, addToCart } = useCart();
  const [searchMode, setSearchMode] = useState<'traditional' | 'ai'>('ai'); // Default to AI to highlight this beautiful new feature!
  const [step, setStep] = useState<number>(1);
  const [answers, setAnswers] = useState<Partial<QuizAnswers>>({});
  const [recommendation, setRecommendation] = useState<Product | null>(null);
  
  // AI State Variables
  const [aiPrompt, setAiPrompt] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [customExplanation, setCustomExplanation] = useState<string | null>(null);

  const handleSelectAnswer = (key: keyof QuizAnswers, value: any) => {
    const updatedAnswers = { ...answers, [key]: value };
    setAnswers(updatedAnswers);

    if (step < 3) {
      setStep((p) => p + 1);
    } else {
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
      const queryNotes = finalAnswers.notas;
      const productNotesLower = product.notas ? product.notas.map(n => n.toLowerCase()) : [];

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
      const occasion = finalAnswers.ocasion;
      if (occasion === 'diario') {
        if (productNotesLower.some(n => ['sal', 'menta', 'pomelo', 'mandarina'].some(t => n.includes(t)))) {
          score += 5;
        }
      } else if (occasion === 'noche') {
        if (productNotesLower.some(n => ['ámbar', 'vainilla', 'pachulí', 'oud', 'pimienta'].some(t => n.includes(t)))) {
          score += 5;
        }
      } else if (occasion === 'especial') {
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

  const handleAiRecommendation = async (promptText: string) => {
    if (!promptText.trim()) return;
    setIsLoading(true);
    setAiError(null);
    setCustomExplanation(null);

    try {
      const response = await fetch('/api/gemini/quiz', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: promptText,
          products: products,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.error === 'API_KEY_MISSING') {
          throw new Error('API_KEY_MISSING');
        }
        throw new Error(data.message || 'Error al conectar con la botica inteligente.');
      }

      const matchedProduct = products.find((p) => p.id === data.recommendedProductId);
      if (matchedProduct) {
        setRecommendation(matchedProduct);
        setCustomExplanation(data.explanation);
        setStep(4);
      } else {
        const fallback = products.find(p => p.id === 'prod_ambre_eclat') || products[0];
        setRecommendation(fallback);
        setCustomExplanation(data.explanation || null);
        setStep(4);
      }
    } catch (err: any) {
      console.error(err);
      if (err.message === 'API_KEY_MISSING') {
        setAiError(
          'El sommelier de IA requiere una clave de API. Por favor, configura tu GEMINI_API_KEY en el panel de Secrets de AI Studio.'
        );
      } else {
        setAiError(
          'No hemos podido contactar al Atelier de IA en este momento. Por favor ingresa tu preferencia nuevamente o utiliza el Quiz Tradicional.'
        );
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleRestart = () => {
    setStep(1);
    setAnswers({});
    setRecommendation(null);
    setAiPrompt('');
    setAiError(null);
    setCustomExplanation(null);
  };

  const promptSuggestions = [
    'Busco un regalo lujoso para dama: un perfume seductor y un bolso elegante a juego.',
    'Quiero un perfume dulce con vainilla para una boda de gala y mi clutch ideal para la noche.',
    'Busco un perfume veraniego cítrico de diario, y una bandolera fresca que le vaya espectacular.',
    'Necesito un bolso de mano elegante de cuero con diseño minimalista y un aroma exclusivo que combine.'
  ];

  return (
    <div id="ai-quiz-container" className="bg-editorial-card border border-editorial-card-border rounded-2xl p-4 sm:p-8 md:p-10 max-w-2xl mx-auto shadow-xl relative overflow-hidden text-editorial-black">
      {/* Editorial Decorative Details */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-editorial-sand/50 rounded-full filter blur-2xl" />

      {/* Mode Switches - Only show if not in recommendation screen */}
      {step < 4 && (
        <div className="flex border-b border-editorial-card-border mb-8 overflow-hidden rounded-t-lg bg-editorial-sand/30">
          <button
            onClick={() => {
              setSearchMode('ai');
              handleRestart();
            }}
            className={`flex-1 py-3 text-xs uppercase tracking-widest font-bold flex items-center justify-center gap-2 transition-all ${
              searchMode === 'ai'
                ? 'bg-editorial-card border-b-2 border-editorial-black text-editorial-black shadow-sm'
                : 'text-editorial-black/40 hover:text-editorial-black/75'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 animate-pulse text-amber-500" />
            Asistente de Estilo IA ✨
          </button>
          <button
            onClick={() => {
              setSearchMode('traditional');
              handleRestart();
            }}
            className={`flex-1 py-3 text-xs uppercase tracking-widest font-bold flex items-center justify-center gap-2 transition-all ${
              searchMode === 'traditional'
                ? 'bg-editorial-card border-b-2 border-editorial-black text-editorial-black shadow-sm'
                : 'text-editorial-black/40 hover:text-editorial-black/75'
            }`}
          >
            <Compass className="w-3.5 h-3.5" />
            Quiz Tradicional
          </button>
        </div>
      )}

      {/* Header section */}
      <div className="flex justify-between items-center mb-6 pb-3 border-b border-editorial-black/10">
        <h3 className="text-lg font-serif text-editorial-black italic flex items-center gap-2">
          {searchMode === 'traditional' ? (
            <>
              <Compass className="w-4 h-4 text-editorial-black/60" />
              Encuentra tu esencia
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4 text-amber-500" />
              Asistente de Estilo Glow Heaven
            </>
          )}
        </h3>
        {step < 4 && (
          <span className="text-[10px] uppercase tracking-widest font-semibold font-mono text-editorial-black/40">
            {searchMode === 'traditional' ? `Pregunta ${step} / 03` : 'IA Inspiración Libre'}
          </span>
        )}
      </div>

      <AnimatePresence mode="wait">
        {/* LOADING OVERLAY FOR AI ENDPOINT */}
        {isLoading && (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="py-12 flex flex-col items-center justify-center text-center space-y-4"
          >
            <Loader2 className="w-8 h-8 text-editorial-black animate-spin" />
            <div className="space-y-1">
              <p className="text-sm font-serif italic text-editorial-black">Consultando con el Asistente de Estilo de Glow Heaven...</p>
              <p className="text-[10px] uppercase font-mono tracking-widest text-editorial-black/40">Diseñando tu combinación perfecta de lujo...</p>
            </div>
          </motion.div>
        )}

        {/* 1. AI FREE TEXT MODE (RENDERED WHEN searchMode === 'ai' AND NOT LOADING) */}
        {!isLoading && searchMode === 'ai' && step < 4 && (
          <motion.div
            key="ai-prompt-step"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
            className="space-y-5"
          >
            <div className="space-y-2">
              <label htmlFor="ai-scent-description" className="block text-sm text-editorial-black font-serif italic">
                ¿Qué ocasión especial quieres vestir, qué aroma prefieres o qué look buscas complementar?
              </label>
              <textarea
                id="ai-scent-description"
                rows={4}
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                placeholder="Escribe con tus propias palabras. Ejemplo: Busco una combinación de perfume dulce con jazmín y un bolso a juego de noche en tonos neutros o cuero premium para una gala..."
                className="w-full p-4 border border-editorial-card-border focus:border-editorial-black focus:ring-2 focus:ring-editorial-black/10 text-xs sm:text-sm rounded-xl focus:outline-none transition-all duration-300 bg-editorial-sand/15 hover:bg-editorial-sand/25 focus:bg-editorial-card placeholder-editorial-black/35 font-light leading-relaxed shadow-xs"
              />
            </div>

            {aiError && (
              <div className="p-3.5 bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs rounded-xl leading-relaxed">
                {aiError}
              </div>
            )}

            <div className="space-y-3 pt-2">
              <h4 className="text-[10px] uppercase tracking-widest font-mono text-editorial-black/50 flex items-center gap-1.5">
                <Lightbulb className="w-3.5 h-3.5" /> Idea de Inspiración (Oprime para rellenar)
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {promptSuggestions.map((s, idx) => (
                  <motion.button
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                    key={idx}
                    type="button"
                    onClick={() => setAiPrompt(s)}
                    className="p-3 border border-editorial-card-border hover:border-editorial-black/40 bg-editorial-sand/30 hover:bg-editorial-card text-left text-[11px] rounded-lg transition-all cursor-pointer text-editorial-black/75 truncate"
                  >
                    "{s}"
                  </motion.button>
                ))}
              </div>
            </div>

            <div className="pt-4 border-t border-editorial-card-border flex justify-end">
              <motion.button
                whileHover={{ scale: !aiPrompt.trim() ? 1 : 1.02 }}
                whileTap={{ scale: !aiPrompt.trim() ? 1 : 0.98 }}
                type="button"
                id="generate-scent-btn"
                disabled={!aiPrompt.trim()}
                onClick={() => handleAiRecommendation(aiPrompt)}
                className={`w-full sm:w-auto px-6 py-4 bg-editorial-black text-editorial-ivory text-xs uppercase tracking-widest font-bold flex items-center justify-center gap-2 cursor-pointer transition-all rounded-xl hover:shadow-md ${
                  !aiPrompt.trim() ? 'opacity-40 cursor-not-allowed bg-neutral-400' : 'hover:bg-editorial-black/90'
                }`}
              >
                <Sparkles className="w-4 h-4 animate-pulse" />
                Obtener Recomendación de Estilo
              </motion.button>
            </div>
          </motion.div>
        )}

        {/* 2. TRADITIONAL STEPS */}
        {!isLoading && searchMode === 'traditional' && step === 1 && (
          <motion.div
            key="step1"
            initial={{ opacity: 0, x: 15 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -15 }}
            transition={{ duration: 0.2 }}
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

        {!isLoading && searchMode === 'traditional' && step === 2 && (
          <motion.div
            key="step2"
            initial={{ opacity: 0, x: 15 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -15 }}
            transition={{ duration: 0.2 }}
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

        {!isLoading && searchMode === 'traditional' && step === 3 && (
          <motion.div
            key="step3"
            initial={{ opacity: 0, x: 15 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -15 }}
            transition={{ duration: 0.2 }}
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

        {/* 3. SHOW RECOMMENDATION RESULT */}
        {!isLoading && step === 4 && recommendation && (
          <motion.div
            key="step4"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4 }}
            className="text-center"
          >
            <div className="inline-flex items-center gap-1.5 px-3 py-1 border border-editorial-card-border bg-editorial-sand text-editorial-black rounded-sm text-[10px] uppercase tracking-[0.2em] font-mono mb-6">
              <Sparkles className="w-3 h-3" />
              {searchMode === 'ai' ? 'Sommelier Inteligente Gemini' : 'Recomendación Olfativa'}
            </div>

            <div className="flex flex-col md:flex-row gap-6 md:gap-8 items-center text-left bg-editorial-sand/60 p-5 sm:p-8 rounded-2xl border border-editorial-card-border mb-8 w-full">
              <img
                src={recommendation.imagenUrl}
                alt={recommendation.nombre}
                referrerPolicy="no-referrer"
                className="w-28 h-36 xs:w-32 xs:h-40 md:w-44 md:h-52 rounded-xl object-cover bg-neutral-200/20 shadow-sm border border-editorial-card-border"
              />
              <div className="flex-1 w-full">
                <span className="text-[9px] sm:text-[10px] uppercase text-zinc-400 font-bold tracking-widest font-mono">
                  {recommendation.marca} • {recommendation.genero}
                </span>
                <h4 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight text-editorial-black mt-1">{recommendation.nombre}</h4>
                
                {/* AI CUSTOM EXPLANATION OR FALLBACK TO PRODUCT STANDARD DESCRIPTION */}
                <div className="mt-3 text-editorial-black/75 text-xs sm:text-sm leading-relaxed space-y-2">
                  {customExplanation ? (
                    <>
                      <p className="font-serif italic text-editorial-black/90 font-semibold text-xs sm:text-sm">✨ Del Asistente de Estilo:</p>
                      <p className="font-light">{customExplanation}</p>
                    </>
                  ) : (
                    <p className="font-light">{recommendation.descripcion}</p>
                  )}
                </div>

                {recommendation.categoria === 'perfume' && recommendation.notas && (
                  <div className="flex flex-wrap gap-1 mt-4">
                    {recommendation.notas.map((n) => (
                      <span key={n} className="text-[8px] sm:text-[9px] uppercase tracking-wider px-2 py-0.5 bg-editorial-clay text-editorial-black rounded border border-editorial-card-border font-mono font-medium">
                        {n}
                      </span>
                    ))}
                  </div>
                )}

                {recommendation.categoria === 'accesorio' && (
                  <div className="flex flex-wrap gap-1.5 mt-4">
                    {recommendation.color && (
                      <span className="text-[8px] sm:text-[9px] uppercase tracking-widest font-mono font-semibold px-2 py-0.5 bg-editorial-clay text-editorial-black rounded border border-editorial-card-border">
                        Color: {recommendation.color}
                      </span>
                    )}
                    {recommendation.material && (
                      <span className="text-[8px] sm:text-[9px] uppercase tracking-widest font-mono font-semibold px-2 py-0.5 bg-amber-500/15 text-amber-500 rounded border border-amber-500/20">
                        {recommendation.material}
                      </span>
                    )}
                  </div>
                )}

                <div className="mt-5 flex items-baseline justify-between xs:justify-start gap-4 border-t border-editorial-card-border pt-4">
                  <div>
                    <span className="text-[8px] sm:text-[9px] text-editorial-black/40 block font-mono uppercase tracking-wider">Inversión</span>
                    <span className="text-xl sm:text-2xl font-bold text-editorial-black">${recommendation.precio} USD</span>
                  </div>
                  {recommendation.stock > 0 ? (
                    <span className="text-[11px] uppercase tracking-wider text-emerald-600 dark:text-emerald-400 font-bold font-mono">✓ Disponible ({recommendation.stock} u.)</span>
                  ) : (
                    <span className="text-[11px] uppercase tracking-wider text-rose-500 font-bold font-mono">Agotado</span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 justify-center w-full max-w-md mx-auto">
              {recommendation.stock > 0 ? (
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    addToCart(recommendation);
                    onClose();
                    onScrollToCatalog();
                  }}
                  className="w-full sm:w-auto px-7 py-4 bg-editorial-black text-editorial-ivory hover:bg-editorial-black/90 text-[10px] sm:text-xs uppercase tracking-widest font-bold flex items-center justify-center gap-2 cursor-pointer transition-all shadow-md"
                >
                  <ShoppingBag className="w-3.5 h-3.5 text-editorial-clay" />
                  Agregar e Ir al Catálogo
                </motion.button>
              ) : (
                <button
                  disabled
                  className="w-full sm:w-auto px-7 py-4 bg-editorial-clay text-editorial-black/40 text-[10px] sm:text-xs uppercase tracking-widest font-bold cursor-not-allowed border border-editorial-black/10"
                >
                  Producto Agotado
                </button>
              )}

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleRestart}
                className="w-full sm:w-auto px-7 py-4 border border-editorial-black hover:bg-editorial-black hover:text-editorial-ivory text-editorial-black text-[10px] sm:text-xs uppercase tracking-widest font-bold flex items-center justify-center gap-2 cursor-pointer transition-all"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Hacer de nuevo
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
