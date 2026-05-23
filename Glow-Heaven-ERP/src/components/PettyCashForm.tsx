/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { db } from '../lib/firebase';
import { collection, doc, setDoc } from 'firebase/firestore';
import { PettyCashTransaction } from '../types/erp';
import { Wallet, PlusCircle } from 'lucide-react';

interface PettyCashFormProps {
  expenses: PettyCashTransaction[];
}

export const PettyCashForm: React.FC<PettyCashFormProps> = ({ expenses }) => {
  const [descripcion, setDescripcion] = useState('');
  const [montoStr, setMontoStr] = useState('');
  const [categoria, setCategoria] = useState<'marketing' | 'logistica' | 'empaques' | 'otros'>('otros');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const descripcionRef = useRef<HTMLInputElement>(null);

  // Atajo de teclado local para este componente (Ctrl+G)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key.toLowerCase() === 'g') {
        e.preventDefault();
        descripcionRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleRegistrarGasto = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    
    const monto = parseFloat(montoStr);
    if (!descripcion.trim() || isNaN(monto) || monto <= 0) {
      alert('Por favor, ingresa una descripción válida y un monto mayor a 0 en Córdobas.');
      return;
    }

    try {
      setIsSubmitting(true);
      
      // La mutación nativa en Firestore
      const transaccionRef = doc(collection(db, 'transacciones_financieras'));
      
      const nuevoGasto = {
        id_gasto: transaccionRef.id,
        fecha: new Date().toISOString(),
        monto_cs: monto,
        descripcion: descripcion.trim(),
        categoria: categoria,
        tipo: 'gasto_operativo' // Clasificación interna para el ERP
      };

      await setDoc(transaccionRef, nuevoGasto);

      // Limpiar formulario. El listener onSnapshot en App.tsx actualizará la UI instantáneamente
      setDescripcion('');
      setMontoStr('');
      setCategoria('otros');
      
    } catch (error: any) {
      console.error('[ERP Caja Chica] Error registrando el gasto:', error);
      alert('Error registrando el gasto: ' + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950/50 flex justify-between items-center shrink-0">
        <h2 className="text-[11px] font-bold uppercase tracking-widest text-neutral-500 flex items-center gap-2">
          <Wallet className="w-4 h-4" /> Caja Chica (Egresos)
        </h2>
        <span className="text-[9px] font-mono text-neutral-400 border border-neutral-200 dark:border-neutral-800 px-1.5 rounded bg-white dark:bg-neutral-900">Ctrl+G</span>
      </div>
      
      <div className="p-3 flex-1 flex flex-col min-h-0">
        
        {/* FORMULARIO COMPACTO */}
        <form onSubmit={handleRegistrarGasto} className="flex flex-col gap-2 mb-4 shrink-0">
          <input 
            ref={descripcionRef}
            type="text" 
            placeholder="Descripción del gasto (Ej: Bolsas de regalo)" 
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            disabled={isSubmitting}
            className="w-full text-xs px-3 py-2 border border-neutral-200 dark:border-neutral-800 rounded bg-neutral-50 dark:bg-neutral-950 focus:outline-none focus:border-neutral-400 transition-colors" 
          />
          <div className="flex gap-2">
            <input 
              type="number" 
              step="0.01"
              min="0"
              placeholder="Monto C$" 
              value={montoStr}
              onChange={(e) => setMontoStr(e.target.value)}
              disabled={isSubmitting}
              className="w-24 text-xs font-mono px-3 py-2 border border-neutral-200 dark:border-neutral-800 rounded bg-neutral-50 dark:bg-neutral-950 focus:outline-none focus:border-neutral-400 transition-colors" 
            />
            <select 
              value={categoria}
              onChange={(e) => setCategoria(e.target.value as any)}
              disabled={isSubmitting}
              className="flex-1 text-xs px-2 py-2 border border-neutral-200 dark:border-neutral-800 rounded bg-neutral-50 dark:bg-neutral-950 focus:outline-none focus:border-neutral-400 appearance-none cursor-pointer"
            >
              <option value="logistica">Transporte / Logística</option>
              <option value="marketing">Publicidad / Marketing</option>
              <option value="empaques">Empaques / Materiales</option>
              <option value="otros">Gastos Varios</option>
            </select>
            <button 
              type="submit"
              disabled={isSubmitting}
              className="bg-neutral-900 hover:bg-neutral-800 dark:bg-neutral-100 dark:hover:bg-neutral-200 disabled:opacity-50 text-white dark:text-neutral-900 px-3 py-2 rounded text-[10px] font-bold uppercase tracking-wider flex items-center justify-center transition-colors cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" />
            </button>
          </div>
        </form>

        {/* HISTORIAL RECIENTE */}
        <div className="flex-1 overflow-y-auto pr-1">
          <h3 className="text-[10px] font-bold uppercase tracking-widest text-neutral-400 mb-2">Últimos Registros</h3>
          {expenses.length === 0 ? (
            <p className="text-xs text-neutral-400 italic">No hay egresos registrados.</p>
          ) : (
            <ul className="space-y-2">
              {expenses.filter(e => e.monto_cs > 0).slice(0, 5).map(exp => (
                <li key={exp.id_gasto} className="flex justify-between items-center text-xs p-2 border border-neutral-100 dark:border-neutral-800/50 rounded bg-white dark:bg-neutral-900 shadow-sm">
                  <div className="flex flex-col overflow-hidden pr-2">
                    <span className="text-neutral-700 dark:text-neutral-300 font-medium truncate">{exp.descripcion}</span>
                    <span className="text-[9px] uppercase tracking-wider text-neutral-400 mt-0.5">{exp.categoria}</span>
                  </div>
                  <span className="font-mono font-bold text-rose-600 dark:text-rose-400 shrink-0">
                    - C$ {exp.monto_cs.toLocaleString('es-NI')}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};
