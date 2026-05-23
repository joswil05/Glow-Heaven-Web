/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { useCart } from '../context/CartContext';
import { Bot, X, Send, Sparkles, ShoppingBag, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  text: string;
  timestamp: string;
}

export const GeminiChatbot: React.FC = () => {
  const { products, addToCart } = useCart();
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      text: '¡Hola! Bienvenida/o a Glow Heaven Perfumes. ✨ Soy tu Sommelier Virtual de fragancias.\n\n¿Buscas recomendaciones exquisitas, tienes dudas sobre la duración de nuestros aromas o deseas ayuda para armar tu bolsa de compras?',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [inputText, setInputText] = useState<string>('');
  const [isTyping, setIsTyping] = useState<boolean>(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Auto scroll to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const handleSendMessage = async (textToSend: string) => {
    if (!textToSend.trim()) return;

    // 1. Add user message
    const userMsg: ChatMessage = {
      id: `m_user_${Date.now()}`,
      role: 'user',
      text: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputText('');
    setIsTyping(true);

    try {
      // Format messages history for the api
      // Gemini expects system instructions in config, and conversational rolls
      const messagesPayload = [...messages, userMsg]
        .filter((m) => m.role !== 'system') // only send user/assistant messages to preserve role-alternation
        .map((m) => ({
          role: m.role === 'assistant' ? 'assistant' : 'user',
          text: m.text,
        }));

      const response = await fetch('/api/gemini/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: messagesPayload,
          products: products,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.error === 'API_KEY_MISSING') {
          throw new Error('API_KEY_MISSING');
        }
        throw new Error(data.message || 'Error en comunicación con el chatbot.');
      }

      // Add assistant response
      const assistantMsg: ChatMessage = {
        id: `m_ast_${Date.now()}`,
        role: 'assistant',
        text: data.text,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, assistantMsg]);

      // Handle server-returned dynamic tool/function call (addToCart)
      if (data.toolCall && data.toolCall.name === 'addToCart') {
        const pId = data.toolCall.args?.productId;
        const targetProduct = products.find((p) => p.id === pId);
        
        if (targetProduct) {
          if (targetProduct.stock > 0) {
            addToCart(targetProduct);
            
            // Append visual feedback message as system log in stream
            setMessages((prev) => [
              ...prev,
              {
                id: `m_sys_${Date.now()}`,
                role: 'system',
                text: `🛍️ Se ha añadido "${targetProduct.nombre}" a tu bolsa de compras automáticamente.`,
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              },
            ]);
          } else {
            // Out of stock warning
            setMessages((prev) => [
              ...prev,
              {
                id: `m_sys_${Date.now()}`,
                role: 'system',
                text: `⚠️ He intentado añadir "${targetProduct.nombre}" pero se encuentra temporalmente agotado.`,
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              },
            ]);
          }
        }
      }
    } catch (err: any) {
      console.error(err);
      let errorText = 'Lo lamento, he tenido un pequeño inconveniente para analizar tu texto. ¿Podrías reescribirlo?';
      if (err.message === 'API_KEY_MISSING') {
        errorText = '⚠️ El servicio de Inteligencia Artificial requiere configurar la clave de API. Por favor, agregue su GEMINI_API_KEY en el panel de Secrets de AI Studio.';
      }
      setMessages((prev) => [
        ...prev,
        {
          id: `m_err_${Date.now()}`,
          role: 'assistant',
          text: errorText,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleSuggest = (topic: string) => {
    handleSendMessage(topic);
  };

  const suggestions = [
    'Recomiéndame un perfume dulce para dama.',
    '¿Qué opciones de aromas frescos y cítricos tienen para caballero?',
    '¿Tienen stock de Oud Oasis? Dime su precio.',
    '¿Cómo funciona el proceso de pago y envío de Glow Heaven?',
  ];

  return (
    <div id="glow-chatbot-widget" className="fixed bottom-6 right-6 z-50 font-sans">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            key="chat-window"
            id="chat-window-container"
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.95 }}
            transition={{ type: 'spring', damping: 25, stiffness: 350 }}
            className="bg-white border border-editorial-black/10 rounded-2xl shadow-xl w-80 sm:w-96 h-[520px] flex flex-col overflow-hidden mb-4"
          >
            {/* Header */}
            <div className="bg-editorial-black px-5 py-4 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 bg-editorial-ivory/15 rounded-lg text-editorial-sand">
                  <Bot className="w-4 h-4 animate-pulse text-editorial-clay" />
                </div>
                <div>
                  <h4 className="text-xs font-mono uppercase tracking-[0.15em] font-semibold text-editorial-sand">Glow Heaven</h4>
                  <span className="text-[10px] text-editorial-clay/80 font-light block">Sommelier de Perfumes</span>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 text-editorial-clay/60 hover:text-white hover:bg-white/10 rounded-full transition-colors cursor-pointer"
                title="Cerrar sommelier"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Message Stream */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-editorial-sand/10">
              {messages.map((m) => {
                if (m.role === 'system') {
                  return (
                    <div key={m.id} className="flex justify-center my-1.5">
                      <span className="text-[10px] bg-editorial-sand border border-editorial-black/5 text-editorial-black/75 px-3 py-1.5 rounded-full inline-block font-mono">
                        {m.text}
                      </span>
                    </div>
                  );
                }

                const isAssistant = m.role === 'assistant';
                return (
                  <div
                    key={m.id}
                    className={`flex ${isAssistant ? 'justify-start' : 'justify-end'}`}
                  >
                    <div className={`max-w-[85%] rounded-2xl p-3.5 shadow-xs border ${
                      isAssistant
                        ? 'bg-white border-editorial-black/5 text-editorial-black'
                        : 'bg-editorial-black text-editorial-ivory border-editorial-black'
                    }`}>
                      <div className="text-[11px] sm:text-xs leading-relaxed whitespace-pre-line font-light">
                        {m.text}
                      </div>
                      <span className={`text-[8px] font-mono mt-1.5 block text-right ${
                        isAssistant ? 'text-editorial-black/40' : 'text-editorial-clay/50'
                      }`}>
                        {m.timestamp}
                      </span>
                    </div>
                  </div>
                );
              })}

              {isTyping && (
                <div className="flex justify-start">
                  <div className="bg-white border border-editorial-black/5 rounded-2xl p-3.5 flex items-center gap-2 shadow-xs">
                    <Loader2 className="w-3.5 h-3.5 text-editorial-black animate-spin" />
                    <span className="text-[10px] uppercase tracking-widest font-mono text-editorial-black/40">Inhalando aromas...</span>
                  </div>
                </div>
              )}

              <div ref={chatEndRef} />
            </div>

            {/* Quick Suggestions - Scrollable horizontally */}
            {messages.length === 1 && (
              <div className="px-4 py-2 bg-editorial-sand/30 border-t border-editorial-black/5 flex gap-2 overflow-x-auto scrollbar-none">
                {suggestions.map((s, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSuggest(s)}
                    className="flex-shrink-0 text-[10px] bg-white border border-editorial-black/10 text-editorial-black hover:border-editorial-black px-3 py-1.5 rounded-full transition-all cursor-pointer whitespace-nowrap font-light"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}

            {/* Input Form */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage(inputText);
              }}
              className="p-3 bg-white border-t border-editorial-black/10 flex gap-2 items-center"
            >
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Pregunta o describe tu acorde..."
                className="flex-1 px-4 py-2.5 bg-editorial-sand/20 border border-editorial-black/15 focus:border-editorial-black text-xs rounded-xl focus:outline-none placeholder-editorial-black/35 font-light"
              />
              <button
                type="submit"
                disabled={!inputText.trim()}
                className={`p-2.5 bg-editorial-black text-editorial-ivory rounded-xl cursor-pointer transition-all ${
                  !inputText.trim() ? 'opacity-40 cursor-not-allowed text-editorial-clay/30' : 'hover:bg-editorial-black/90'
                }`}
                title="Enviar mensaje"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Toggle Button */}
      <motion.button
        type="button"
        id="chatbot-toggle-btn"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen((prev) => !prev)}
        className="h-14 w-14 bg-editorial-black text-editorial-ivory rounded-full shadow-lg flex items-center justify-center cursor-pointer relative group border border-editorial-ivory/10"
        title="Sommelier Virtual de Glow Heaven"
      >
        <AnimatePresence mode="wait">
          {isOpen ? (
            <motion.div
              key="close-icon"
              initial={{ rotate: -45, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: 45, opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <X className="w-5 h-5" />
            </motion.div>
          ) : (
            <motion.div
              key="bot-icon"
              initial={{ rotate: 45, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: -45, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="relative"
            >
              <Bot className="w-5 h-5 text-editorial-clay group-hover:text-white transition-colors" />
              <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-editorial-clay rounded-full border-2 border-editorial-black" />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.button>
    </div>
  );
};
