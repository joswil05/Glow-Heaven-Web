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

    const apiKey = import.meta.env.VITE_GEMINI_API_KEY || '';
    if (!apiKey) {
      setMessages((prev) => [
        ...prev,
        {
          id: `m_err_${Date.now()}`,
          role: 'assistant',
          text: '⚠️ El servicio de Inteligencia Artificial requiere configurar la clave de API (VITE_GEMINI_API_KEY).',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
      setIsTyping(false);
      return;
    }

    try {
      // Format messages history for Gemini API
      // Gemini expects: [ { role: 'user' | 'model', parts: [{ text: string }] } ]
      const geminiHistory = messages
        .filter((m) => m.role !== 'system') // system logs are internal
        .map((m) => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.text }],
        }));

      // Append the latest user message
      geminiHistory.push({
        role: 'user',
        parts: [{ text: textToSend }],
      });

      // Catalog details unifier
      const catalogString = products
        .map(
          (p) =>
            `ID: ${p.id}\nNombre: ${p.nombre}\nMarca: ${p.marca}\nCategoría: ${p.categoria}\nGénero: ${p.genero}\n` +
            `${p.categoria === 'perfume' && p.notas ? `Notas/Acordes: ${p.notas.join(', ')}\n` : ''}` +
            `${p.categoria === 'accesorio' ? `Color: ${p.color || ''}\nMaterial: ${p.material || ''}\n` : ''}` +
            `Precio: $${p.precio} USD\nStock: ${p.stock}\nDescripción: ${p.descripcion}\n`
        )
        .join('\n---\n');

      const systemInstructionText = `Eres "El Asistente Virtual de Glow Heaven", un sommelier y estilista experto en nuestra prestigiosa boutique de lujo híbrida.
Ahora combinamos Alta Perfumería Francesa con Accesorios exclusivos para Dama (bolsos de mano fine leather, clutches, minimal totes).

Tu objetivo es guiar a los visitantes, responder dudas sobre nuestras fragancias o accesorios (colores, materiales), asesorarles en estilo y vestimenta o recomendaciones de regalos y añadir los productos indicados al carrito con addToCart.

FILOSOFÍA DE LA BOUTIQUE E HÍBRIDO:
- Glow Heaven destaca por su curaduría artística. Sabor de Grasse y fina marroquinería para damas sofisticadas.
- El proceso de compra es híbrido y express: El usuario agrega perfumes o bolsos a su bolsa, llena sus datos en el checkout, confirma el pedido y al completarse, se le redirige automáticamente a WhatsApp con su pedido formalizado.

CATÁLOGO REAL DE PRODUCTOS ACTIVOS EN ESTE MOMENTO:
${catalogString}

REGLAS DE CONDUCTA:
1. Responde de forma cálida, refinada y profesional en español.
2. Si el usuario te indica que quiere comprar, agregar, o llevar algún producto (sea un perfume u accesorio) del catálogo, utiliza activamente la herramienta "addToCart" suministrando el ID del producto que desea. Una vez invocada la función, explícale de forma amena que has colocado el producto en su bolsa de compras y que puede verlo abriendo el carrito o yendo directamente al checkout.
3. Si un producto está de baja o agotado (stock = 0), sugiérele amablemente otra alternativa similar que sí tenga unidades disponibles.
4. Si pide outfit o regalo ideal para mujer, promueve combinaciones poéticas de perfumes con un bolso de mano a juego.`;

      // Declaramos la herramienta para añadir al carrito
      const addToCartTool = {
        functionDeclarations: [
          {
            name: 'addToCart',
            description: 'Añade un perfume o accesorio al carrito de compras del usuario mediante su ID.',
            parameters: {
              type: 'OBJECT',
              properties: {
                productId: {
                  type: 'STRING',
                  description: 'El ID exacto del producto a añadir (ej: "prod_ambre_eclat", "prod_maison_clutch").',
                },
              },
              required: ['productId'],
            },
          }
        ]
      };

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: geminiHistory,
            systemInstruction: {
              parts: [{ text: systemInstructionText }]
            },
            tools: [addToCartTool]
          })
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || 'Error al conectar con el chatbot.');
      }

      const modelPart = data.candidates?.[0]?.content?.parts?.[0];
      const botText = modelPart?.text || 'He procesado tu solicitud. ¿En qué más te puedo asistir?';

      // Add assistant response
      const assistantMsg: ChatMessage = {
        id: `m_ast_${Date.now()}`,
        role: 'assistant',
        text: botText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, assistantMsg]);

      // Handle function/tool calls returned by Gemini
      const functionCalls = modelPart?.functionCalls;
      if (functionCalls && functionCalls.length > 0) {
        const call = functionCalls[0];
        if (call.name === 'addToCart') {
          const args = call.args as { productId: string };
          const pId = args?.productId;
          const targetProduct = products.find((p) => p.id === pId);
          
          if (targetProduct) {
            if (targetProduct.stock > 0) {
              addToCart(targetProduct);
              
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
      }
    } catch (err: any) {
      console.error(err);
      setMessages((prev) => [
        ...prev,
        {
          id: `m_err_${Date.now()}`,
          role: 'assistant',
          text: `Lo lamento, he tenido un inconveniente: ${err.message || String(err)}`,
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
            className="bg-editorial-card border border-editorial-card-border rounded-2xl shadow-xl w-80 sm:w-96 h-[520px] flex flex-col overflow-hidden mb-4"
          >
            {/* Header */}
            <div className="bg-editorial-black px-5 py-4 text-editorial-ivory flex items-center justify-between">
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
                className="p-1 text-editorial-clay/60 hover:text-editorial-ivory hover:bg-white/10 rounded-full transition-colors cursor-pointer"
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
                      <span className="text-[10px] bg-editorial-sand border border-editorial-card-border text-editorial-black/75 px-3 py-1.5 rounded-full inline-block font-mono">
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
                        ? 'bg-editorial-card border-editorial-card-border text-editorial-black'
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
                  <div className="bg-editorial-card border border-editorial-card-border rounded-2xl p-3.5 flex items-center gap-2 shadow-xs">
                    <Loader2 className="w-3.5 h-3.5 text-editorial-black animate-spin" />
                    <span className="text-[10px] uppercase tracking-widest font-mono text-editorial-black/40">Inhalando aromas...</span>
                  </div>
                </div>
              )}

              <div ref={chatEndRef} />
            </div>

            {/* Quick Suggestions - Scrollable horizontally */}
            {messages.length === 1 && (
              <div className="px-4 py-2 bg-editorial-sand/30 border-t border-editorial-card-border flex gap-2 overflow-x-auto scrollbar-none">
                {suggestions.map((s, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSuggest(s)}
                    className="flex-shrink-0 text-[10px] bg-editorial-card border border-editorial-card-border text-editorial-black hover:border-editorial-black px-3 py-1.5 rounded-full transition-all cursor-pointer whitespace-nowrap font-light"
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
              className="p-3 bg-editorial-card border-t border-editorial-card-border flex gap-2 items-center"
            >
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Pregunta o describe tu acorde..."
                className="flex-1 px-4 py-2.5 bg-editorial-sand/20 border border-editorial-card-border focus:border-editorial-black text-xs rounded-xl focus:outline-none placeholder-editorial-black/35 font-light"
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
