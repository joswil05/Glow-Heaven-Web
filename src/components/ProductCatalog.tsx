/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { useCart } from '../context/CartContext';
import { Product, Gender } from '../types';
import { Search, SlidersHorizontal, Info, ShoppingBag, Check, Sparkles, MessageCircle, GitCompare, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export const ProductCatalog: React.FC = () => {
  const { products, productsLoading, addToCart } = useCart();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<'Todos' | 'perfume' | 'accesorio'>('Todos');
  const [selectedGender, setSelectedGender] = useState<Gender | 'Todos'>('Todos');
  const [selectedBrand, setSelectedBrand] = useState<string | 'Todos'>('Todos');
  const [showFilters, setShowFilters] = useState(false);
  const [sortBy, setSortBy] = useState<'newest' | 'price-asc' | 'price-desc'>('newest');

  const [compareList, setCompareList] = useState<Product[]>([]);
  const [showCompareModal, setShowCompareModal] = useState(false);

  const [toasts, setToasts] = useState<{ id: number; message: string; submessage?: string }[]>([]);
  const [addedProducts, setAddedProducts] = useState<Record<string, boolean>>({});
  const [floatingChecks, setFloatingChecks] = useState<{ id: number; productId: string }[]>([]);

  const toggleCompare = (prod: Product) => {
    if (compareList.some((p) => p.id === prod.id)) {
      setCompareList((prev) => prev.filter((p) => p.id !== prod.id));
    } else {
      if (compareList.length >= 2) {
        // Show elegant toast representing a limit
        const toastId = Date.now() + Math.random();
        setToasts((prev) => [
          ...prev,
          {
            id: toastId,
            message: "Límite de comparación",
            submessage: "Solo puedes comparar un máximo de 2 productos simultáneamente.",
          },
        ]);
        setTimeout(() => {
          setToasts((prev) => prev.filter((t) => t.id !== toastId));
        }, 3000);
        return;
      }
      setCompareList((prev) => [...prev, prod]);
    }
  };

  const handleAddToCart = (prod: Product) => {
    addToCart(prod);
    setAddedProducts((prev) => ({ ...prev, [prod.id]: true }));

    const clickId = Date.now() + Math.random();
    setFloatingChecks((prev) => [...prev, { id: clickId, productId: prod.id }]);
    setTimeout(() => {
      setFloatingChecks((prev) => prev.filter((item) => item.id !== clickId));
    }, 1200);

    const toastId = Date.now() + Math.random();
    setToasts((prev) => [
      ...prev,
      {
        id: toastId,
        message: "¡Agregado con éxito!",
        submessage: `${prod.nombre} se sumó a tu bolsa de compra.`,
      },
    ]);

    setTimeout(() => {
      setAddedProducts((prev) => ({ ...prev, [prod.id]: false }));
    }, 1500);

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== toastId));
    }, 3000);
  };

  // Extract unique brands dynamically from active products in the current category
  const brands = useMemo(() => {
    const relevantProducts = selectedCategory === 'Todos'
      ? products
      : products.filter(p => p.categoria === selectedCategory);
    const list = new Set(relevantProducts.map((p) => p.marca));
    return ['Todos', ...Array.from(list)];
  }, [products, selectedCategory]);

  // Extract unique genders dynamically from active products in the current category
  const genders = useMemo(() => {
    const relevantProducts = selectedCategory === 'Todos'
      ? products
      : products.filter(p => p.categoria === selectedCategory);
    const list = new Set(relevantProducts.map((p) => p.genero));
    return ['Todos', ...Array.from(list)];
  }, [products, selectedCategory]);

  // Filtered and sorted list
  const filteredProducts = useMemo(() => {
    const filtered = products.filter((prod) => {
      const matchesCategory = selectedCategory === 'Todos' || prod.categoria === selectedCategory;

      const matchesSearch =
        prod.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
        prod.marca.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (prod.notas && prod.notas.some((nota) => nota.toLowerCase().includes(searchTerm.toLowerCase()))) ||
        (prod.color && prod.color.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (prod.material && prod.material.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchesGender = selectedGender === 'Todos' || prod.genero === selectedGender;
      const matchesBrand = selectedBrand === 'Todos' || prod.marca === selectedBrand;

      return matchesCategory && matchesSearch && matchesGender && matchesBrand;
    });

    if (sortBy === 'price-asc') {
      return [...filtered].sort((a, b) => a.precio - b.precio);
    } else if (sortBy === 'price-desc') {
      return [...filtered].sort((a, b) => b.precio - a.precio);
    } else {
      return filtered;
    }
  }, [products, selectedCategory, searchTerm, selectedGender, selectedBrand, sortBy]);

  return (
    <div id="catalog-section" className="w-full max-w-7xl mx-auto px-6 py-16">
      
      {/* Title & Filter trigger line */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8 border-b border-editorial-black/10 pb-6">
        <div>
          <span className="text-[10px] uppercase tracking-[0.25em] text-editorial-black/40 font-semibold font-mono block">
            {selectedCategory === 'accesorio' ? 'Colección de Complementos' : 'Curaduría de Aromas y Estilo'}
          </span>
          <h2 className="text-4xl md:text-5xl font-serif text-editorial-black mt-2 leading-tight">
            Catálogo <span className="italic font-normal">{selectedCategory === 'accesorio' ? 'de Accesorios' : 'Exclusivo'}</span>
          </h2>
          <p className="text-zinc-500 text-xs font-light mt-1.5 font-mono uppercase">Línea de stock mixta unificada y validada en tiempo real.</p>
        </div>

        {/* Dynamic Filters & Sorting Actions */}
        <div className="flex flex-wrap items-center gap-3.5 self-start md:self-auto">
          {/* Sorting Dropdown */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-wider font-bold text-editorial-black/40 font-mono hidden sm:inline">Ordenar por:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-3.5 py-2.5 bg-white border border-editorial-black/10 text-editorial-black text-[10px] uppercase font-bold tracking-widest cursor-pointer focus:outline-none focus:border-editorial-black/60 rounded-md font-sans"
            >
              <option value="newest">Novedades ✨</option>
              <option value="price-asc">Precio: de Menor a Mayor ➔</option>
              <option value="price-desc">Precio: de Mayor a Menor ➔</option>
            </select>
          </div>

          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 px-5 py-2.5 border border-editorial-black text-editorial-black hover:bg-editorial-black hover:text-editorial-ivory text-[10px] uppercase font-bold tracking-widest transition-all cursor-pointer rounded-md"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            Filtros {showFilters ? 'Ocultar' : 'Mostrar'}
          </button>
        </div>
      </div>

      {/* Category Navigation Tabs */}
      <div className="flex border-b border-editorial-black/10 gap-6 sm:gap-10 mb-8 overflow-x-auto scrollbar-none pb-0.5">
        {[
          { id: 'Todos', label: 'Todos los Productos 🛍️' },
          { id: 'perfume', label: 'Perfumes ✨' },
          { id: 'accesorio', label: 'Bolsos & Accesorios 👜' }
        ].map((tab) => {
          const isActive = selectedCategory === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => {
                setSelectedCategory(tab.id as any);
                setSelectedGender('Todos');
                setSelectedBrand('Todos');
              }}
              className={`pb-3.5 text-[11px] sm:text-[12px] uppercase tracking-[0.15em] font-bold transition-all relative shrink-0 cursor-pointer ${
                isActive ? 'text-editorial-black' : 'text-editorial-black/40 hover:text-editorial-black/70'
              }`}
            >
              {tab.label}
              {isActive && (
                <motion.div
                  layoutId="activeCategoryTab"
                  className="absolute bottom-0 left-0 right-0 h-[2.5px] bg-editorial-black"
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Filter and Search Bar Panel */}
      <div className="bg-editorial-sand/40 border border-editorial-black/10 rounded-xl p-5 md:p-6 mb-10 flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-editorial-black/40" />
            <input
              type="text"
              placeholder={
                selectedCategory === 'accesorio'
                  ? "Buscar por marca, color, material o bolso..."
                  : selectedCategory === 'perfume'
                    ? "Buscar por fragancia, marca o acorde olfativo..."
                    : "Buscar por marca, perfume, bolso o características..."
              }
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-editorial-black/10 text-sm focus:outline-none focus:border-editorial-black/60 text-editorial-black placeholder-editorial-black/30 font-light rounded-lg"
            />
          </div>
        </div>

        {/* Expandable filters selection */}
        {(showFilters || selectedGender !== 'Todos' || selectedBrand !== 'Todos') && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-4 border-t border-editorial-black/10">
            {/* Gender filters */}
            <div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-editorial-black/40 block mb-2.5 font-mono">Orientación de Género</span>
              <div className="flex flex-wrap gap-2">
                {genders.map((g) => (
                  <button
                    key={g}
                    onClick={() => setSelectedGender(g as any)}
                    className={`px-3.5 py-1.5 text-[10px] uppercase tracking-wider font-semibold transition-all cursor-pointer border ${
                      selectedGender === g
                        ? 'bg-editorial-black text-white border-editorial-black'
                        : 'bg-white hover:bg-editorial-sand text-editorial-black border-editorial-black/10'
                    }`}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>

            {/* Brand Filters */}
            <div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-editorial-black/40 block mb-2.5 font-mono">Marca / Autoría</span>
              <div className="flex flex-wrap gap-2">
                {brands.map((b) => (
                  <button
                    key={b}
                    onClick={() => setSelectedBrand(b)}
                    className={`px-3.5 py-1.5 text-[10px] uppercase tracking-wider font-semibold transition-all cursor-pointer border ${
                      selectedBrand === b
                        ? 'bg-editorial-black text-white border-editorial-black'
                        : 'bg-white hover:bg-editorial-sand text-editorial-black border-editorial-black/10'
                    }`}
                  >
                    {b}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Grid Display */}
      {productsLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-3.5 sm:gap-x-8 gap-y-8 sm:gap-y-12">
          {Array.from({ length: 8 }).map((_, idx) => (
            <div key={idx} className="flex flex-col animate-pulse border-b border-editorial-black/5 pb-5">
              <div className="aspect-[3/4] bg-editorial-black/5 rounded-xl mb-3.5 relative overflow-hidden">
                <div className="absolute top-2 right-2 bg-white/40 h-5 w-12 rounded-sm" />
              </div>
              <div className="h-3 w-1/3 bg-editorial-black/5 rounded-sm mb-2" />
              <div className="h-5 w-3/4 bg-editorial-black/10 rounded-md mb-2" />
              <div className="h-4 w-5/6 bg-editorial-black/5 rounded-md mb-3" />
              <div className="flex gap-1.5 mt-2.5">
                <div className="h-4.5 w-14 bg-editorial-black/5 rounded-sm" />
                <div className="h-4.5 w-14 bg-editorial-black/5 rounded-sm" />
              </div>
              <div className="pt-3 mt-3.5 border-t border-editorial-black/5 flex items-center justify-between">
                <div>
                  <div className="h-2 w-8 bg-editorial-black/5 rounded-sm mb-1" />
                  <div className="h-5 w-16 bg-editorial-black/10 rounded-md" />
                </div>
                <div className="h-9 w-20 bg-editorial-black/10 rounded-md" />
              </div>
            </div>
          ))}
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-editorial-black/10 rounded-2xl bg-white/50">
          <Info className="w-8 h-8 text-editorial-black/40 mx-auto mb-3" />
          <h4 className="text-base font-serif text-editorial-black font-semibold uppercase tracking-wider">No se encontraron productos</h4>
          <p className="text-editorial-black/50 text-xs mt-1.5 max-w-sm mx-auto font-light">Limpia tus filtros o realiza una búsqueda alternativa.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-3.5 sm:gap-x-8 gap-y-8 sm:gap-y-12">
          {filteredProducts.map((prod) => {
            const hasStock = prod.stock > 0;
            return (
              <motion.article
                layout
                key={prod.id}
                className="flex flex-col overflow-hidden group border-b border-editorial-black/10 pb-5"
              >
                {/* Product lookbook image (3:4 portrait) */}
                <div className="relative aspect-[3/4] bg-editorial-clay overflow-hidden border border-editorial-black/10 rounded-xl">
                  <img
                    src={prod.imagenUrl}
                    alt={prod.nombre}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover group-hover:scale-102 transition-transform duration-500 opacity-90 group-hover:opacity-100"
                  />
                  
                  {/* Floating Micro-interaction checkmark animations */}
                  <AnimatePresence>
                    {floatingChecks
                      .filter((f) => f.productId === prod.id)
                      .map((f) => (
                        <motion.div
                          key={f.id}
                          initial={{ opacity: 0, scale: 0.3, y: 30, rotate: -15 }}
                          animate={{ opacity: 1, scale: 1.2, y: -20, rotate: 0 }}
                          exit={{ opacity: 0, scale: 0.7, y: -70 }}
                          transition={{ duration: 0.8, ease: "easeOut" }}
                          className="absolute inset-0 m-auto w-12 h-12 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-lg border-2 border-white z-25 pointer-events-none"
                        >
                          <Check className="w-6 h-6 stroke-[3px]" />
                          <motion.span 
                            initial={{ scale: 0.8, opacity: 0.5 }}
                            animate={{ scale: 1.6, opacity: 0 }}
                            transition={{ duration: 0.6, ease: "easeOut" }}
                            className="absolute inset-0 rounded-full bg-emerald-400 -z-10"
                          />
                        </motion.div>
                      ))}
                  </AnimatePresence>

                  {/* Portrait labels */}
                  <div className="absolute top-2 right-2 sm:top-3 sm:right-3 flex flex-col gap-1 items-end">
                    <span className="text-[8px] sm:text-[9px] uppercase font-bold tracking-widest bg-white/95 backdrop-blur-xs border border-editorial-black/10 text-editorial-black px-1.5 sm:px-2.5 py-0.5 font-mono shadow-xs rounded-[4px]">
                      {prod.genero}
                    </span>
                    {!hasStock && (
                      <span className="text-[8px] sm:text-[9px] uppercase font-bold tracking-widest bg-editorial-black text-white px-1.5 sm:px-2.5 py-0.5 font-mono shadow-xs rounded-[4px]">
                        Agotado
                      </span>
                    )}
                  </div>

                  {/* Comparar toggle button */}
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      toggleCompare(prod);
                    }}
                    className={`absolute top-2 left-2 sm:top-3 sm:left-3 flex items-center justify-center gap-1.5 px-2 py-1 text-[8px] sm:text-[8.5px] font-bold tracking-wider uppercase backdrop-blur-xs border rounded-[4px] font-mono shadow-xs transition-all duration-300 z-10 cursor-pointer ${
                      compareList.some((p) => p.id === prod.id)
                        ? 'bg-editorial-black text-white border-editorial-black'
                        : 'bg-white/80 hover:bg-white text-editorial-black border-editorial-black/10'
                    }`}
                  >
                    <GitCompare className="w-3 h-3" />
                    <span>{compareList.some((p) => p.id === prod.id) ? 'Comp.' : 'Comparar'}</span>
                  </button>

                  {/* Floating Quick Inquiry Button */}
                  <motion.a
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    href={`https://api.whatsapp.com/send?phone=573000000000&text=${encodeURIComponent(
                      `Hola Glow Heaven! Me gustaría realizar una consulta rápida sobre el producto "${prod.nombre}" de la marca "Glow Heaven". ¿Tienen disponibilidad e información de stock en tiempo real? ¡Muchas gracias!`
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="absolute bottom-3 left-3 flex items-center gap-1.5 px-2.5 py-1.5 bg-emerald-600/90 hover:bg-emerald-600 text-white text-[9px] uppercase font-mono tracking-widest font-bold rounded-full shadow-lg hover:shadow-emerald-600/20 transition-all duration-300 z-10"
                    title="Consulta rápida por WhatsApp"
                  >
                    <MessageCircle className="w-3.5 h-3.5 fill-white/10" />
                    <span>Consultar</span>
                  </motion.a>
                </div>

                {/* Information block */}
                <div className="pt-3.5 flex-1 flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-baseline gap-1.5">
                      <span className="text-[8px] sm:text-[10px] uppercase text-zinc-400 font-bold tracking-widest font-mono">
                        {prod.marca}
                      </span>
                      <span className="text-[9px] sm:text-xs uppercase tracking-wider font-mono text-zinc-400 font-medium">
                        {hasStock ? `${prod.stock} u.` : 'Agotado'}
                      </span>
                    </div>

                    <h3 className="text-sm sm:text-base md:text-lg font-bold tracking-tight text-editorial-black mt-1 leading-snug line-clamp-1">
                      {prod.nombre}
                    </h3>
                    
                    {prod.descripcion && (
                      <p className="text-editorial-black/65 text-[11px] sm:text-xs font-light mt-1.5 line-clamp-2 leading-relaxed">
                        {prod.descripcion}
                      </p>
                    )}

                    {/* Item specific metadata */}
                    {prod.categoria === 'perfume' && prod.notas && (
                      <div className="flex flex-wrap gap-1 mt-2.5">
                        {prod.notas.map((nota) => (
                          <span
                            key={nota}
                            className="bg-editorial-sand/40 text-[8px] sm:text-[9.5px] text-editorial-black/75 px-1.5 py-0.5 rounded border border-editorial-black/5 uppercase tracking-widest font-mono font-medium"
                          >
                            {nota}
                          </span>
                        ))}
                      </div>
                    )}

                    {prod.categoria === 'accesorio' && (
                      <div className="flex flex-wrap gap-1.5 mt-2.5">
                        {prod.color && (
                          <span className="bg-neutral-100 text-[8px] sm:text-[9.5px] text-neutral-700 px-1.5 py-0.5 rounded border border-neutral-200/80 uppercase tracking-widest font-mono font-semibold">
                            Color: {prod.color}
                          </span>
                        )}
                        {prod.material && (
                          <span className="bg-orange-50/70 text-[8px] sm:text-[9.5px] text-amber-900 px-1.5 py-0.5 rounded border border-amber-200/40 uppercase tracking-widest font-mono font-semibold">
                            {prod.material}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Operational add to bag action row */}
                  <div className="pt-3 mt-3.5 border-t border-editorial-black/10 flex flex-col xs:flex-row xs:items-center justify-between gap-2.5">
                    <div>
                      <span className="text-[8px] sm:text-[9px] text-editorial-black/40 block font-mono uppercase tracking-wider">Inversión</span>
                      <span className="text-base sm:text-lg font-bold text-editorial-black">${prod.precio} USD</span>
                    </div>

                    {hasStock ? (
                      <motion.button
                        whileHover={{ scale: 1.03 }}
                        whileTap={{ scale: 0.97 }}
                        onClick={() => handleAddToCart(prod)}
                        className={`px-3 py-2 sm:px-4 sm:py-2.5 text-[9px] sm:text-[10px] uppercase font-bold tracking-widest transition-all cursor-pointer flex items-center justify-center gap-1.5 focus:outline-none focus:ring-1 focus:ring-editorial-black/20 rounded-md ${
                          addedProducts[prod.id]
                            ? 'bg-emerald-600 border-emerald-600 text-white'
                            : 'bg-editorial-black text-editorial-ivory border-editorial-black hover:bg-neutral-900'
                        }`}
                      >
                        {addedProducts[prod.id] ? (
                          <>
                            <Check className="w-3 h-3 text-white" />
                            ¡Añadido!
                          </>
                        ) : (
                          <>
                            <ShoppingBag className="w-3 h-3 text-editorial-clay" />
                            Añadir
                          </>
                        )}
                      </motion.button>
                    ) : (
                      <button
                        disabled
                        className="px-3 py-2 sm:px-4 sm:py-2.5 border border-editorial-black/15 text-editorial-black/35 text-[9px] sm:text-[10px] uppercase font-bold tracking-widest cursor-not-allowed text-center rounded-md"
                      >
                        Agotado
                      </button>
                    )}
                  </div>
                </div>
              </motion.article>
            );
          })}
        </div>
      )}

      {/* Floating Banners / Toasts notifications */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3.5 max-w-sm w-full pointer-events-none px-4">
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              layout
              key={toast.id}
              initial={{ opacity: 0, x: 100, scale: 0.92 }}
              animate={{ 
                opacity: 1, 
                x: 0, 
                scale: 1,
                transition: {
                  type: "spring",
                  stiffness: 350,
                  damping: 25,
                }
              }}
              exit={{ 
                opacity: 0, 
                x: 80, 
                scale: 0.95, 
                transition: { 
                  duration: 0.22,
                  ease: "easeOut"
                } 
              }}
              className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 shadow-2xl flex items-start gap-3 pointer-events-auto"
            >
              <div className="p-1.5 bg-emerald-500/15 rounded-lg text-emerald-400 shrink-0">
                <Sparkles className="w-4 h-4" />
              </div>
              <div className="flex-1 text-left">
                <h5 className="text-[11px] font-bold text-white uppercase tracking-wider">
                  {toast.message}
                </h5>
                {toast.submessage && (
                  <p className="text-[10.5px] text-zinc-400 font-light mt-0.5 leading-snug">
                    {toast.submessage}
                  </p>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Floating Comparison Tray */}
      <AnimatePresence>
        {compareList.length > 0 && (
          <motion.div
            initial={{ y: 100, x: '-50%', opacity: 0 }}
            animate={{ y: 0, x: '-50%', opacity: 1 }}
            exit={{ y: 100, x: '-50%', opacity: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 20 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-neutral-950 text-white rounded-2xl p-3 sm:p-4 shadow-2xl flex items-center justify-between gap-4 z-40 border border-neutral-800 w-[92%] max-w-lg"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="p-1.5 bg-neutral-900 rounded-lg shrink-0">
                <GitCompare className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider font-mono text-zinc-100">
                  Comparativa ({compareList.length}/2)
                </p>
                <div className="flex gap-2.5 mt-1 overflow-x-auto scrollbar-none pr-2">
                  {compareList.map((cp) => (
                    <span
                      key={cp.id}
                      className="text-[9px] sm:text-[10px] font-light bg-neutral-900 hover:bg-neutral-800 px-2.5 py-0.5 rounded border border-neutral-800 text-zinc-300 truncate max-w-[120px] transition-colors flex items-center gap-1 shrink-0"
                    >
                      {cp.nombre}
                      <button
                        onClick={() => toggleCompare(cp)}
                        className="text-zinc-500 hover:text-white font-bold ml-1 cursor-pointer"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {compareList.length === 2 ? (
                <button
                  onClick={() => setShowCompareModal(true)}
                  className="bg-white hover:bg-neutral-100 text-neutral-950 font-sans tracking-widest font-bold text-[9px] sm:text-[10px] uppercase px-3 py-2 sm:px-4 sm:py-2.5 rounded-lg cursor-pointer transition-colors"
                >
                  Comparar
                </button>
              ) : (
                <span className="text-[8.5px] uppercase tracking-wider font-mono text-zinc-500 font-bold hidden sm:inline">
                  Elige 1 más
                </span>
              )}
              <button
                onClick={() => setCompareList([])}
                className="p-1 hover:bg-neutral-900 rounded-lg text-zinc-400 hover:text-white transition-colors cursor-pointer"
                title="Limpiar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Comparison Modal Side-by-Side */}
      <AnimatePresence>
        {showCompareModal && compareList.length === 2 && (
          <div className="fixed inset-0 bg-neutral-950/70 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
              className="bg-white rounded-2xl w-full max-w-4xl max-h-[85vh] overflow-y-auto shadow-2xl relative border border-neutral-200"
            >
              {/* Modal header */}
              <div className="sticky top-0 bg-white/95 backdrop-blur-md p-5 sm:p-6 border-b border-zinc-100 flex items-center justify-between z-10">
                <div>
                  <span className="text-[10px] uppercase tracking-[0.25em] text-zinc-400 font-mono font-bold block">Comparador Exclusivo</span>
                  <h3 className="text-xl sm:text-2xl font-serif text-neutral-950 mt-1">Análisis Detallado de Selección</h3>
                </div>
                <button
                  onClick={() => setShowCompareModal(false)}
                  className="p-2 hover:bg-zinc-100 rounded-lg text-zinc-500 hover:text-neutral-950 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Side-by-side Layout */}
              <div className="grid grid-cols-2 divide-x divide-zinc-100 min-w-[500px] overflow-x-auto">
                {compareList.map((cp) => {
                  const hasStock = cp.stock > 0;
                  return (
                    <div key={cp.id} className="p-5 sm:p-8 flex flex-col gap-5 sm:gap-6">
                      {/* Product Visual */}
                      <div className="aspect-[4/3] w-full max-w-[240px] mx-auto bg-neutral-50 rounded-xl overflow-hidden border border-neutral-100 relative shadow-sm">
                        <img
                          src={cp.imagenUrl}
                          alt={cp.nombre}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                        <span className="absolute top-2 right-2 text-[8px] uppercase tracking-wider font-extrabold bg-neutral-950 text-white px-2 py-0.5 rounded font-mono shadow-xs">
                          {cp.categoria === 'perfume' ? 'Perfume ✨' : 'Accesorio 👜'}
                        </span>
                      </div>

                      {/* Title, Brand, and Price */}
                      <div className="text-center pb-4 border-b border-zinc-100">
                        <span className="text-[9px] uppercase tracking-widest text-zinc-400 font-bold font-mono block">
                          {cp.marca}
                        </span>
                        <h4 className="text-base sm:text-lg font-bold font-serif text-neutral-950 mt-1 min-h-[3rem] line-clamp-2">
                          {cp.nombre}
                        </h4>
                        <p className="text-lg sm:text-xl font-bold text-neutral-950 mt-2 font-mono">
                          ${cp.precio} USD
                        </p>
                        <span className={`text-[9px] uppercase tracking-wider font-semibold font-mono mt-1.5 inline-block px-2.5 py-0.5 rounded-full ${
                          hasStock ? 'bg-emerald-50 text-emerald-800 border border-emerald-100' : 'bg-red-50 text-red-800 border border-red-100'
                        }`}>
                          {hasStock ? `${cp.stock} unidades` : 'Agotado'}
                        </span>
                      </div>

                      {/* Specs section */}
                      <div className="space-y-4 text-xs font-sans">
                        <div>
                          <span className="block text-[8px] uppercase font-bold tracking-widest text-zinc-400 font-mono mb-1">Descripción</span>
                          <p className="text-neutral-600 font-light leading-relaxed text-[11px] sm:text-xs">
                            {cp.descripcion}
                          </p>
                        </div>

                        <div>
                          <span className="block text-[8px] uppercase font-bold tracking-widest text-zinc-400 font-mono mb-1">Compatibilidad</span>
                          <span className="text-neutral-900 font-mono text-[11px] uppercase tracking-wider bg-neutral-100 px-2 py-0.5 rounded border border-neutral-200/50">
                            {cp.genero}
                          </span>
                        </div>

                        {/* Olfactive specifications or material/color criteria */}
                        {cp.categoria === 'perfume' ? (
                          <div>
                            <span className="block text-[8px] uppercase font-bold tracking-widest text-zinc-400 font-mono mb-1.5">Acordes Olfativos</span>
                            <div className="flex flex-wrap gap-1">
                              {cp.notas && cp.notas.map((n) => (
                                <span key={n} className="bg-editorial-sand/40 text-[9px] text-editorial-black px-2 py-0.5 rounded border border-editorial-black/5 uppercase tracking-widest font-mono font-medium">
                                  {n}
                                </span>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {cp.color && (
                              <div>
                                <span className="block text-[8px] uppercase font-bold tracking-widest text-zinc-400 font-mono mb-0.5">Color de Diseño</span>
                                <span className="text-neutral-900 font-mono text-[11px] font-semibold">
                                  {cp.color}
                                </span>
                              </div>
                            )}
                            {cp.material && (
                              <div>
                                <span className="block text-[8px] uppercase font-bold tracking-widest text-zinc-400 font-mono mb-0.5">Material de Confección</span>
                                <span className="text-amber-900 font-mono text-[11px] font-semibold bg-amber-50 px-2 py-0.5 rounded border border-amber-200/50">
                                  {cp.material}
                                </span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Add to action triggers */}
                      <div className="mt-auto pt-4 border-t border-zinc-100 flex flex-col gap-2">
                        {hasStock ? (
                          <button
                            onClick={() => {
                              handleAddToCart(cp);
                            }}
                            className="w-full py-2.5 sm:py-3 bg-neutral-950 text-white hover:bg-neutral-900 text-[10px] sm:text-xs uppercase font-extrabold tracking-widest flex items-center justify-center gap-1.5 rounded-lg cursor-pointer transition-colors shadow-sm"
                          >
                            <ShoppingBag className="w-3.5 h-3.5 text-editorial-clay" />
                            Agregar a Bolsa
                          </button>
                        ) : (
                          <button
                            disabled
                            className="w-full py-2.5 sm:py-3 border border-neutral-200 text-neutral-300 text-[10px] sm:text-xs uppercase font-extrabold tracking-widest cursor-not-allowed text-center bg-neutral-50 rounded-lg"
                          >
                            Agotado
                          </button>
                        )}

                        <a
                          href={`https://api.whatsapp.com/send?phone=573000000000&text=${encodeURIComponent(
                            `Hola Glow Heaven! Estoy comparando el producto "${cp.nombre}" y me interesa comprarlo o recibir asesoramiento. ¿Me comentan la disponibilidad?`
                          )}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-full py-2.5 sm:py-3 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] sm:text-xs uppercase font-bold tracking-widest text-center flex items-center justify-center gap-1.5 rounded-lg transition-colors"
                        >
                          <MessageCircle className="w-3.5 h-3.5 fill-white/10" />
                          Consultar WhatsApp
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
