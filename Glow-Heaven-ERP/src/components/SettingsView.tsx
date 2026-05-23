/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { db } from '../lib/firebase';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { Settings, Save, Smartphone, CheckCircle, AlertCircle } from 'lucide-react';

export const SettingsView: React.FC = () => {
  const [telefonoContacto, setTelefonoContacto] = useState('+505 8110 5252');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, 'configuracion', 'negocio'),
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          if (data.telefono_contacto) {
            setTelefonoContacto(data.telefono_contacto);
          }
        }
        setIsLoading(false);
      },
      (error) => {
        console.error('[Settings] Error fetching settings:', error);
        setFormError('No se pudieron cargar las configuraciones de Firestore.');
        setIsLoading(false);
      }
    );

    return () => unsub();
  }, []);

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    const cleanPhone = telefonoContacto.trim();
    if (!cleanPhone) {
      setFormError('El número de teléfono no puede estar vacío.');
      return;
    }

    try {
      setIsSubmitting(true);
      await setDoc(doc(db, 'configuracion', 'negocio'), {
        telefono_contacto: cleanPhone
      });
      setFormSuccess('Configuraciones guardadas exitosamente.');
      setTimeout(() => setFormSuccess(null), 3000);
    } catch (error: any) {
      console.error('[Settings] Error saving settings:', error);
      setFormError('Error al guardar: ' + (error.message || 'Error inesperado'));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center p-6 bg-neutral-100 dark:bg-neutral-950">
        <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-xs text-neutral-400 font-mono">Cargando configuraciones...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-neutral-50 dark:bg-neutral-950 select-none">
      <div className="p-3 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950/50 flex justify-between items-center shrink-0">
        <h2 className="text-[11px] font-bold uppercase tracking-widest text-neutral-500 flex items-center gap-2">
          <Settings className="w-4 h-4 text-emerald-500" /> Configuraciones del Negocio
        </h2>
      </div>

      <div className="p-6 max-w-lg mx-auto w-full flex-1 overflow-y-auto">
        <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-6 pb-4 border-b border-neutral-100 dark:border-neutral-800">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-neutral-800 dark:text-neutral-200">Parámetros del Negocio</h3>
              <p className="text-[10px] text-neutral-400 dark:text-neutral-500 leading-none mt-1">Configure los datos generales sincronizados con el catálogo web.</p>
            </div>
          </div>

          <form onSubmit={handleSave} className="flex flex-col gap-4">
            {formSuccess && (
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
                <CheckCircle className="w-4 h-4 shrink-0" />
                <span>{formSuccess}</span>
              </div>
            )}

            {formError && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800 rounded-xl text-xs text-rose-600 dark:text-rose-400 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <label htmlFor="telefono_contacto" className="text-[10px] font-bold uppercase tracking-widest text-neutral-500 font-mono">
                Número de Teléfono del Negocio (WhatsApp)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 dark:text-neutral-600">
                  <Smartphone className="w-4 h-4" />
                </span>
                <input
                  ref={inputRef}
                  id="telefono_contacto"
                  type="text"
                  value={telefonoContacto}
                  onChange={(e) => setTelefonoContacto(e.target.value)}
                  disabled={isSubmitting}
                  className="w-full pl-9 pr-3 py-2 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg text-xs font-medium focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-shadow disabled:opacity-50"
                  placeholder="+505 8110 5252"
                />
              </div>
              <p className="text-[9px] text-neutral-400 dark:text-neutral-500 leading-normal">
                Este número se utilizará para construir los enlaces de redirección a WhatsApp de la tienda web y las fichas de pedidos del ERP. Formato sugerido: <code className="font-mono text-neutral-600 dark:text-neutral-300 bg-neutral-100 dark:bg-neutral-850 px-1 rounded">+505 8110 5252</code>.
              </p>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="mt-2 w-full py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-800 text-white rounded-lg text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer shadow-sm hover:shadow-emerald-600/10 transition-all"
            >
              <Save className="w-3.5 h-3.5" />
              {isSubmitting ? 'Guardando...' : 'Guardar Configuraciones'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
