/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { CartProvider, useCart } from './context/CartContext';
import { Hero } from './components/Hero';
import { TrustBar } from './components/TrustBar';
import { Testimonials } from './components/Testimonials';
import { Footer } from './components/Footer';
import { ScentQuiz } from './components/ScentQuiz';
import { ProductCatalog } from './components/ProductCatalog';
import { CartDrawer } from './components/CartDrawer';
import { CheckoutForm } from './components/CheckoutForm';
import { GeminiChatbot } from './components/GeminiChatbot';
import { ShoppingBag, Sparkles, AlertCircle, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

function Header({ onOpenCart, onStartQuiz, view, setView }: { 
  onOpenCart: () => void; 
  onStartQuiz: () => void;
  view: 'main' | 'checkout';
  setView: (v: 'main' | 'checkout') => void;
}) {
  const { cartCount } = useCart();

  return (
    <header className="sticky top-0 bg-editorial-ivory/90 backdrop-blur-md border-b border-editorial-black/10 z-30 px-6 sm:px-10 py-5 flex items-center justify-between">
      <div 
        onClick={() => setView('main')}
        className="flex items-center gap-2.5 cursor-pointer group"
      >
        <span className="font-serif italic font-bold text-2xl tracking-tight text-editorial-black group-hover:opacity-70 transition-opacity uppercase">
          Glow <span className="font-sans font-light not-italic text-sm text-editorial-black/60 tracking-widest pl-1">Heaven</span>
        </span>
      </div>

      <nav className="flex items-center gap-6 sm:gap-8">
        <button
          onClick={() => {
            setView('main');
            setTimeout(() => {
              const el = document.getElementById('catalog-section');
              if (el) el.scrollIntoView({ behavior: 'smooth' });
            }, 100);
          }}
          className="text-[11px] uppercase tracking-widest font-semibold text-editorial-black/70 hover:text-editorial-black transition-colors cursor-pointer"
        >
          Colecciones
        </button>

        <button
          onClick={onStartQuiz}
          className="hidden sm:flex items-center gap-1.5 text-[11px] uppercase tracking-widest font-semibold text-editorial-black/70 hover:text-editorial-black transition-colors cursor-pointer"
        >
          <Sparkles className="w-3.5 h-3.5 text-editorial-black/60" />
          Quiz Olfativo
        </button>

        <button
          onClick={onOpenCart}
          className="relative px-3.5 py-1.5 border border-editorial-black border-dashed hover:border-solid hover:bg-editorial-black hover:text-editorial-ivory text-editorial-black text-[11px] tracking-widest font-black uppercase transition-all cursor-pointer flex items-center gap-2"
          id="cart-trigger-btn"
        >
          Bolsa
          <span className="font-mono text-[9px] font-bold">({cartCount.toString().padStart(2, '0')})</span>
        </button>
      </nav>
    </header>
  );
}

function MainAppContent() {
  const [view, setView] = useState<'main' | 'checkout'>('main');
  const [cartOpen, setCartOpen] = useState(false);
  const [showQuiz, setShowQuiz] = useState(false);

  const handleScrollToCatalog = () => {
    const el = document.getElementById('catalog-section');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-editorial-ivory text-editorial-black font-sans flex flex-col justify-between">
      {/* Header component */}
      <Header 
        onOpenCart={() => setCartOpen(true)} 
        onStartQuiz={() => {
          setView('main');
          setShowQuiz(true);
          setTimeout(() => {
            const el = document.getElementById('quiz-section');
            if (el) el.scrollIntoView({ behavior: 'smooth' });
          }, 100);
        }}
        view={view}
        setView={setView}
      />

      {/* Main Panel views */}
      <main className="flex-1">
        <AnimatePresence mode="wait">
          {view === 'main' ? (
            <motion.div
              key="main-view"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              {/* Landing Section (Hero) */}
              <Hero 
                onScrollToCatalog={handleScrollToCatalog}
                onOpenQuiz={() => {
                  setShowQuiz(true);
                  setTimeout(() => {
                    const el = document.getElementById('quiz-section');
                    if (el) el.scrollIntoView({ behavior: 'smooth' });
                  }, 100);
                }}
              />

              {/* Quick trust bar banner below design block */}
              <TrustBar />

              {/* Scent Matcher Quiz Section (Interactive) */}
              {showQuiz && (
                <section id="quiz-section" className="w-full max-w-4xl mx-auto px-4 sm:px-6 py-12 sm:py-16 scroll-mt-20">
                  <div className="text-center mb-10">
                    <span className="text-[10px] uppercase tracking-[0.25em] text-editorial-black/50 font-semibold font-mono">Experiencia Interactiva</span>
                    <h3 className="text-3xl md:text-4xl font-serif mt-2 mb-3">Quiz Olfativo</h3>
                    <p className="text-editorial-black/60 text-sm font-light max-w-md mx-auto">Responde las 3 preguntas guiadas de nuestro sumiller olfativo para revelar tu recomendación ideal.</p>
                  </div>
                  <ScentQuiz 
                    onClose={() => setShowQuiz(false)}
                    onScrollToCatalog={handleScrollToCatalog}
                  />
                </section>
              )}

              {/* Dynamic products Catalog */}
              <ProductCatalog />
            </motion.div>
          ) : (
            <motion.div
              key="checkout-view"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
            >
              <CheckoutForm 
                onBack={() => setView('main')}
                onSuccess={() => {
                  // Successful flow redirect handles inside form.
                }}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Cart drawer panel state trigger */}
      <CartDrawer 
        isOpen={cartOpen} 
        onClose={() => setCartOpen(false)} 
        onProceedToCheckout={() => setView('checkout')}
      />

      {/* Testimonials social proof block */}
      {view === 'main' && <Testimonials />}

      {/* Visual Footer Accordion policies panel */}
      <Footer />

      {/* Floating Interactive Gemini Chatbot */}
      <GeminiChatbot />
    </div>
  );
}

export default function App() {
  return (
    <CartProvider>
      <MainAppContent />
    </CartProvider>
  );
}
