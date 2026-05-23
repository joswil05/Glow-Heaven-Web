/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(express.json());
const PORT = 3000;

// Helper to get GoogleGenAI client safely
function getGeminiClient() {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    throw new Error('GEMINI_API_KEY_MISSING');
  }
  return new GoogleGenAI({
    apiKey: key,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// 1. AI Intelligent Quiz Recommendation Route
app.post('/api/gemini/quiz', async (req, res) => {
  try {
    const { prompt, products } = req.body;

    if (!prompt || !products || !Array.isArray(products)) {
      return res.status(400).json({ error: 'Faltan parámetros: prompt o productos' });
    }

    let ai;
    try {
      ai = getGeminiClient();
    } catch (err: any) {
      if (err.message === 'GEMINI_API_KEY_MISSING') {
        return res.status(400).json({
          error: 'API_KEY_MISSING',
          message: 'Por favor, configure su GEMINI_API_KEY en Settings > Secrets para habilitar las funciones de IA.'
        });
      }
      throw err;
    }

    // Format products catalog into a string for the model safely supporting both perfumes and accessories
    const catalogString = products
      .map(
        (p) =>
          `ID: ${p.id}\nNombre: ${p.nombre}\nMarca: ${p.marca}\nCategoría: ${p.categoria}\nGénero: ${p.genero}\n` +
          `${p.categoria === 'perfume' && p.notas ? `Notas/Acordes: ${p.notas.join(', ')}\n` : ''}` +
          `${p.categoria === 'accesorio' ? `Color: ${p.color || ''}\nMaterial: ${p.material || ''}\n` : ''}` +
          `Precio: $${p.precio} USD\nStock: ${p.stock}\nDescripción: ${p.descripcion}\n`
      )
      .join('\n---\n');

    const systemInstruction = `Eres "Asistente de Estilo Glow Heaven", experto estilista y sommelier de alta perfumería de nuestra prestigiada boutique de lujo híbrida.
Ofrecemos Alta Perfumería Francesa y una exclusiva colección de Accesorios finos para Dama (bolsos de mano, carteras, clutches premium).

Tu tarea es analizar la solicitud del usuario (donde puede pedir oler de una manera específica, buscar vestir un look increíble para un evento, querer regalar el obsequio perfecto o complementar su outfit) y recomendar el producto o la DUPLA perfecta de nuestro catálogo.

CATÁLOGO REAL COMPLETAMENTE DISPONIBLE:
${catalogString}

INSTRUCCIONES DE RECOMENDACIÓN:
1. Recomienda de forma primordial un ID de producto que exista arriba y devuélvelo en "recommendedProductId".
2. Si el usuario pide un aroma, recomiéndale un perfume de lujo.
3. Si el usuario busca complementar un outfit, un vestuario, o quiere el regalo completo definitivo de dama, sugiérele la COMBINACIÓN PERFECTA de un perfume (ej: Sunkissed Pétale) Y un bolso a juego de nuestra colección de Accesorios (ej: Maison Clutch Nappa) en el campo "explanation".
4. Aunque recomiendes una hermosa combinación en la explicación, de todos modos selecciona el ID de uno de ellos (preferiblemente que tenga stock > 0) para el campo "recommendedProductId" para que el usuario pueda cargarlo directamente al carrito.
5. Devuelve la explicación (explanation) redactada de un modo extremadamente sofisticado, refinado, poético y acogedor en español, explicando por qué tu elección o dupla de perfume y accesorio elevará su presencia y encanto.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: `Solicitud del usuario: "${prompt}"`,
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            recommendedProductId: {
              type: Type.STRING,
              description: 'El ID exacto del producto recomendado que existe en el catálogo.',
            },
            explanation: {
              type: Type.STRING,
              description: 'Explicación elegante y detallada en español de por qué es la fragancia ideal.',
            },
          },
          required: ['recommendedProductId', 'explanation'],
        },
      },
    });

    const bodyText = response.text?.trim() || '{}';
    const jsonResult = JSON.parse(bodyText);
    res.json(jsonResult);
  } catch (error: any) {
    console.error('Error in /api/gemini/quiz:', error);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: error.message });
  }
});

// 2. AI Support Chatbot Route (with Tooling / Function Calling)
app.post('/api/gemini/chat', async (req, res) => {
  try {
    const { messages, products } = req.body;

    if (!messages || !Array.isArray(messages) || !products || !Array.isArray(products)) {
      return res.status(400).json({ error: 'Faltan parámetros: messages o productos' });
    }

    let ai;
    try {
      ai = getGeminiClient();
    } catch (err: any) {
      if (err.message === 'GEMINI_API_KEY_MISSING') {
        return res.status(400).json({
          error: 'API_KEY_MISSING',
          message: 'Por favor, configure su GEMINI_API_KEY en Settings > Secrets para habilitar las funciones del Chatbot.'
        });
      }
      throw err;
    }

    // Format products catalog safely for both perfumes and accessories
    const catalogString = products
      .map(
        (p) =>
          `ID: ${p.id}\nNombre: ${p.nombre}\nMarca: ${p.marca}\nCategoría: ${p.categoria}\nGénero: ${p.genero}\n` +
          `${p.categoria === 'perfume' && p.notas ? `Notas/Acordes: ${p.notas.join(', ')}\n` : ''}` +
          `${p.categoria === 'accesorio' ? `Color: ${p.color || ''}\nMaterial: ${p.material || ''}\n` : ''}` +
          `Precio: $${p.precio} USD\nStock: ${p.stock}\nDescripción: ${p.descripcion}\n`
      )
      .join('\n---\n');

    // Function Declaration to add a product to cart safely
    const addToCartFD = {
      name: 'addToCart',
      description: 'Añade un perfume o accesorio al carrito de compras del usuario mediante su ID.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          productId: {
            type: Type.STRING,
            description: 'El ID exacto del producto a añadir (ej: "prod_ambre_eclat", "prod_maison_clutch").',
          },
        },
        required: ['productId'],
      },
    };

    const systemInstruction = `Eres "El Asistente Virtual de Glow Heaven", un sommelier y estilista experto en nuestra prestigiosa boutique de lujo híbrida.
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

    // Map conversation turns to standard Gemini content turns
    const contents = messages.map((m: any) => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.text }],
    }));

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents,
      config: {
        systemInstruction,
        tools: [{ functionDeclarations: [addToCartFD] }],
      },
    });

    let toolCall = null;
    const functionCalls = response.functionCalls;
    if (functionCalls && functionCalls.length > 0) {
      const call = functionCalls[0];
      if (call.name === 'addToCart') {
        toolCall = {
          name: 'addToCart',
          args: call.args as { productId: string },
        };
      }
    }

    res.json({
      text: response.text || 'He procesado tu solicitud, ¿en qué más puedo asistirte?',
      toolCall,
    });
  } catch (error: any) {
    console.error('Error in /api/gemini/chat:', error);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: error.message });
  }
});

// Configure Vite middleware and static serving
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
    console.log('Vite middleware mounted for development mode.');
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    // SPA fallback handling
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
    console.log('Serving production static files from /dist.');
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Glow Heaven Back-end running on http://localhost:${PORT}`);
  });
}

startServer();
