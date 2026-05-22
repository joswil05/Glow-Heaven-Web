/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { useCart } from '../context/CartContext';
import { Product, Gender } from '../types';
import { Search, SlidersHorizontal, Info, ShoppingBag } from 'lucide-react';
import { motion } from 'motion/react';

export const ProductCatalog: React.FC = () => {
  const { products, addToCart } = useCart();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGender, setSelectedGender] = useState<Gender | 'Todos'>('Todos');
  const [selectedBrand, setSelectedBrand] = useState<string | 'Todos'>('Todos');
  const [showFilters, setShowFilters] = useState(false);

  // Extract unique brands dynamically from active products
  const brands = useMemo(() => {
    const list = new Set(products.map((p) => p.marca));
    return ['Todos', ...Array.from(list)];
  }, [products]);

  // Filtered list
  const filteredProducts = useMemo(() => {
    return products.filter((prod) => {
      const matchesSearch =
        prod.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
        prod.marca.toLowerCase().includes(searchTerm.toLowerCase()) ||
        prod.notas.some((nota) => nota.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchesGender = selectedGender === 'Todos' || prod.genero === selectedGender;
      const matchesBrand = selectedBrand === 'Todos' || prod.marca === selectedBrand;

      return matchesSearch && matchesGender && matchesBrand;
    });
  }, [products, searchTerm, selectedGender, selectedBrand]);

  return (
    <div id="catalog-section" className="w-full max-w-7xl mx-auto px-6 py-16">
      
      {/* Title & Filter trigger line */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12 border-b border-editorial-black/10 pb-6">
        <div>
          <span className="text-[10px] uppercase tracking-[0.25em] text-editorial-black/40 font-semibold font-mono block">Curaduría de Aromas</span>
          <h2 className="text-4xl md:text-5xl font-serif text-editorial-black mt-2 leading-tight">
            Catálogo <span className="italic font-normal">Exclusivo</span>
          </h2>
          <p className="text-zinc-500 text-xs font-light mt-1.5 font-mono uppercase">Línea de stock validada remota en tiempo real.</p>
        </div>

        {/* Dynamic Filters Toggle */}
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="flex items-center gap-2 px-5 py-2.5 border border-editorial-black text-editorial-black hover:bg-editorial-black hover:text-editorial-ivory text-[10px] uppercase font-bold tracking-widest transition-all cursor-pointer self-start md:self-auto"
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
          Filtros {showFilters ? 'Ocultar' : 'Mostrar'}
        </button>
      </div>

      {/* Filter and Search Bar Panel */}
      <div className="bg-editorial-sand/40 border border-editorial-black/10 rounded-xl p-5 md:p-6 mb-10 flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-editorial-black/40" />
            <input
              type="text"
              placeholder="Buscar por marca, acorde olfativo o perfume..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-editorial-black/10 text-sm focus:outline-none focus:border-editorial-black/60 text-editorial-black placeholder-editorial-black/30 font-light"
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
                {['Todos', Gender.DAMA, Gender.CABALLERO, Gender.UNISEX].map((g) => (
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
      {filteredProducts.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-editorial-black/10 rounded-2xl bg-white/50">
          <Info className="w-8 h-8 text-editorial-black/40 mx-auto mb-3" />
          <h4 className="text-base font-serif text-editorial-black font-semibold uppercase tracking-wider">No se encontraron productos</h4>
          <p className="text-editorial-black/50 text-xs mt-1.5 max-w-sm mx-auto font-light">Limpia tus filtros o realiza una búsqueda alternativa.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-12">
          {filteredProducts.map((prod) => {
            const hasStock = prod.stock > 0;
            return (
              <motion.article
                layout
                key={prod.id}
                className="flex flex-col overflow-hidden group border-b border-editorial-black/10 pb-6"
              >
                {/* Product lookbook image (3:4 portrait) */}
                <div className="relative aspect-[3/4] bg-editorial-clay overflow-hidden border border-editorial-black/15">
                  <img
                    src={prod.imagenUrl}
                    alt={prod.nombre}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover group-hover:scale-102 transition-transform duration-500 opacity-90 group-hover:opacity-100"
                  />
                  
                  {/* Portrait labels */}
                  <div className="absolute top-3 right-3 flex flex-col gap-1 items-end">
                    <span className="text-[9px] uppercase font-bold tracking-widest bg-white border border-editorial-black text-editorial-black px-2 py-0.5 font-mono shadow-xs">
                      {prod.genero}
                    </span>
                    {!hasStock && (
                      <span className="text-[9px] uppercase font-bold tracking-widest bg-editorial-black text-white px-2 py-0.5 font-mono shadow-xs">
                        Agotado
                      </span>
                    )}
                  </div>
                </div>

                {/* Information block */}
                <div className="pt-4 flex-1 flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-baseline gap-2">
                      <span className="text-[10px] uppercase text-editorial-black/40 font-semibold tracking-widest font-mono">
                        {prod.marca}
                      </span>
                      <span className="text-xs uppercase tracking-wider font-mono text-editorial-black/50">
                        {hasStock ? `@${prod.stock} u.` : 'Agotado'}
                      </span>
                    </div>

                    <h3 className="text-lg font-bold uppercase tracking-tight text-editorial-black mt-1">
                      {prod.nombre}
                    </h3>
                    
                    {prod.descripcion && (
                      <p className="text-editorial-black/70 text-xs font-light mt-2 line-clamp-3 leading-relaxed">
                        {prod.descripcion}
                      </p>
                    )}

                    {/* Olfactive ingredient tags */}
                    <div className="flex flex-wrap gap-1.5 mt-3.5">
                      {prod.notas.map((nota) => (
                        <span
                          key={nota}
                          className="bg-white text-[9px] text-editorial-black/60 px-2 py-0.5 rounded border border-editorial-black/10 uppercase tracking-widest font-mono"
                        >
                          {nota}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Operational add to bag action row */}
                  <div className="pt-4 mt-4 border-t border-editorial-black/10 flex items-center justify-between">
                    <div>
                      <span className="text-[9px] text-editorial-black/40 block font-mono uppercase">Inversión</span>
                      <span className="text-lg font-serif italic text-editorial-black">${prod.precio} USD</span>
                    </div>

                    {hasStock ? (
                      <button
                        onClick={() => addToCart(prod)}
                        className="px-4 py-2 border border-editorial-black hover:bg-editorial-black hover:text-white text-editorial-black text-[10px] uppercase font-bold tracking-widest transition-colors cursor-pointer flex items-center gap-1.5"
                      >
                        <ShoppingBag className="w-3 h-3" />
                        Invertir
                      </button>
                    ) : (
                      <button
                        disabled
                        className="px-4 py-2 border border-editorial-black/20 text-editorial-black/40 text-[10px] uppercase font-bold tracking-widest cursor-not-allowed"
                      >
                        Stock Out
                      </button>
                    )}
                  </div>
                </div>
              </motion.article>
            );
          })}
        </div>
      )}
    </div>
  );
};
