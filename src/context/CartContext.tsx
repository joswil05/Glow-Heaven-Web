/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import { Product, CartItem, Order, OrderItem, ClientData, PaymentMethod, OrderStatus } from '../types';
import { db, isFirebaseConfigured, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, onSnapshot, doc, setDoc, writeBatch, runTransaction, Timestamp } from 'firebase/firestore';
import { INITIAL_PRODUCTS } from '../data/productos';

interface CartContextProps {
  products: Product[];
  productsLoading: boolean;
  cart: CartItem[];
  addToCart: (product: Product) => void;
  removeFromCart: (productId: string) => void;
  updateQuantity: (productId: string, delta: number) => void;
  clearCart: () => void;
  cartSubtotal: number;
  cartTotal: number;
  cartCount: number;
  placeOrder: (clientData: ClientData, paymentMethod: PaymentMethod) => Promise<Order>;
  getWhatsAppRedirectUrl: (order: Order) => string;
  isFirebaseActive: boolean;
}

const CartContext = createContext<CartContextProps | undefined>(undefined);

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [cart, setCart] = useState<CartItem[]>(() => {
    const saved = localStorage.getItem('glow_heaven_cart');
    return saved ? JSON.parse(saved) : [];
  });

  const isFirebaseActive = isFirebaseConfigured() && db !== null;

  // Initialize/Listen to products
  useEffect(() => {
    if (isFirebaseActive) {
      console.log("Firebase Active. Setting up live product stream...");
      const path = 'productos';
      const unsubscribe = onSnapshot(
          collection(db, path),
          (snapshot) => {
            if (snapshot.empty) {
              // Seed products if Firestore collection is completely empty
              console.log("Firestore 'productos' collection is empty. Seeding INITIAL_PRODUCTS...");
              const batch = writeBatch(db);
              INITIAL_PRODUCTS.forEach((prod) => {
                const docRef = doc(db, 'productos', prod.id);
                batch.set(docRef, prod);
              });
              batch.commit().then(() => {
                setProductsLoading(false);
              }).catch((err) => {
                console.error("Error seeding initial products to Firestore:", err);
                setProductsLoading(false);
              });
            } else {
              const list: Product[] = [];
              snapshot.forEach((doc) => {
                list.push({ id: doc.id, ...doc.data() } as Product);
              });
              setProducts(list.filter(p => p.activo !== false));
              setProductsLoading(false);
            }
          },
          (error) => {
            setProductsLoading(false);
            // CRITICAL: Always handle firestore error as instructed in standard guidelines
            handleFirestoreError(error, OperationType.GET, path);
          }
      );
      return () => unsubscribe();
    } else {
      // Local Mode: Read from localStorage or pre-seed with INITIAL_PRODUCTS
      console.log("Local Mode active. Flowing with local storage...");
      const savedProducts = localStorage.getItem('glow_heaven_products');
      if (savedProducts) {
        setProducts(JSON.parse(savedProducts));
      } else {
        localStorage.setItem('glow_heaven_products', JSON.stringify(INITIAL_PRODUCTS));
        setProducts(INITIAL_PRODUCTS);
      }
      setProductsLoading(false);
    }
  }, [isFirebaseActive]);

  // Sync cart state with localStorage
  useEffect(() => {
    localStorage.setItem('glow_heaven_cart', JSON.stringify(cart));
  }, [cart]);

  // Add Item to Cart
  const addToCart = (product: Product) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      
      // Determine latest available stock from active products list
      const dbProduct = products.find((p) => p.id === product.id);
      const stock = dbProduct ? dbProduct.stock : product.stock;

      if (existing) {
        // Enforce stock upper bounds
        if (existing.quantity >= stock) return prev;
        return prev.map((item) =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      } else {
        if (stock <= 0) return prev; // Cant add out of stock
        return [...prev, { product, quantity: 1 }];
      }
    });
  };

  // Remove Item from Cart
  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
  };

  // Change Item Quantity
  const updateQuantity = (productId: string, delta: number) => {
    setCart((prev) => {
      return prev
        .map((item) => {
          if (item.product.id === productId) {
            const newQty = item.quantity + delta;
            
            // Get current live stock
            const dbProduct = products.find((p) => p.id === productId);
            const stock = dbProduct ? dbProduct.stock : item.product.stock;

            if (newQty <= 0) return null;
            if (newQty > stock) return item; // Block exceeding stock
            return { ...item, quantity: newQty };
          }
          return item;
        })
        .filter(Boolean) as CartItem[];
    });
  };

  const clearCart = () => {
    setCart([]);
  };

  // Calculations
  const cartSubtotal = cart.reduce((acc, item) => acc + item.product.precio * item.quantity, 0);
  const cartTotal = cartSubtotal; // Any taxes or shipping can be configured if requested. Direct is direct!
  const cartCount = cart.reduce((acc, item) => acc + item.quantity, 0);

  // Place order
  const placeOrder = async (clientData: ClientData, paymentMethod: PaymentMethod): Promise<Order> => {
    if (cart.length === 0) {
      throw new Error("El carrito está vacío");
    }

    // Generate unique order ID with prefix 'GH-'
    const orderNum = Math.floor(1000 + Math.random() * 9000);
    const orderId = `GH-${Date.now().toString().slice(-6)}-${orderNum}`;

    const orderItems: OrderItem[] = cart.map((item) => ({
      producto_id: item.product.id,
      nombre: item.product.nombre,
      cantidad: item.quantity,
      precio_unitario: item.product.precio,
    }));

    // Generate expiration time (30 minutes from now)
    const expirationDate = new Date();
    expirationDate.setMinutes(expirationDate.getMinutes() + 30);

    const newOrder: Order = {
      id_pedido: orderId,
      fecha: new Date().toISOString(),
      cliente: clientData,
      items: orderItems,
      total: cartTotal,
      metodo_pago: paymentMethod,
      estado: OrderStatus.PENDIENTE,
      expiraEn: isFirebaseActive 
        ? Timestamp.fromDate(expirationDate)
        : expirationDate.toISOString(),
    };

    if (isFirebaseActive) {
      const transactionPath = `pedidos-productos-transaction`;
      try {
        await runTransaction(db, async (transaction) => {
          // 1. Fetch latest product documents inside the transaction to get real-time stock
          const productDocs = await Promise.all(
            cart.map(async (item) => {
              const productRef = doc(db, 'productos', item.product.id);
              const productSnapshot = await transaction.get(productRef);
              if (!productSnapshot.exists()) {
                throw new Error(`El producto "${item.product.nombre}" no existe en la base de datos.`);
              }
              const dbProductData = productSnapshot.data() as Product;
              return {
                item,
                ref: productRef,
                currentStock: dbProductData.stock ?? 0,
                dbProductData
              };
            })
          );

          // 2. Validate all stocks before performing any writes
          for (const p of productDocs) {
            if (p.currentStock < p.item.quantity) {
              throw new Error(`¡Agotado! Lo sentimos, no hay stock suficiente de "${p.item.product.nombre}". Disponible: ${p.currentStock} u., solicitado: ${p.item.quantity} u.`);
            }
          }

          // 3. Create the order
          const orderRef = doc(db, 'pedidos', orderId);
          transaction.set(orderRef, newOrder);

          // 4. Update product stocks (sync with ERP schema)
          for (const p of productDocs) {
            const updatedStock = p.currentStock - p.item.quantity;
            const currentStockDisponible = p.dbProductData.stock_disponible ?? p.currentStock;
            const currentStockComprometido = p.dbProductData.stock_comprometido ?? 0;

            transaction.update(p.ref, { 
              stock: updatedStock,
              stock_comprometido: currentStockComprometido + p.item.quantity,
              stock_disponible: currentStockDisponible
            });
          }
        });

        console.log("Order written to Firestore with atomic stock updates via Transaction!");
      } catch (error: any) {
        // ENFORCE SKILL CRITICAL EXCEPTION BINDINGS
        // Check if it's a customer-facing stock error, if so pass it through, else use firestore handler
        if (error.message && (error.message.includes("¡Agotado!") || error.message.includes("no existe"))) {
          throw error;
        } else {
          handleFirestoreError(error, OperationType.WRITE, transactionPath);
        }
      }
    } else {
      // Local Mode: Write to local orders log and update local products stock
      const localOrders = JSON.parse(localStorage.getItem('glow_heaven_orders') || '[]');
      localOrders.push(newOrder);
      localStorage.setItem('glow_heaven_orders', JSON.stringify(localOrders));

      const updatedProducts = products.map((prod) => {
        const cartMatch = cart.find((item) => item.product.id === prod.id);
        if (cartMatch) {
          return {
            ...prod,
            stock: Math.max(0, prod.stock - cartMatch.quantity),
          };
        }
        return prod;
      });

      localStorage.setItem('glow_heaven_products', JSON.stringify(updatedProducts));
      setProducts(updatedProducts);
      console.log("Order submitted locally. Mock stock decremented!");
    }

    // Clear cart on successful order creation
    clearCart();

    return newOrder;
  };

  // Generate structured WhatsApp string
  const getWhatsAppRedirectUrl = (order: Order): string => {
    // Elegant receipt message for user
    const dateStr = new Date(order.fecha).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    let message = `*✨ GLOW HEAVEN PERFUMES ✨*\n`;
    message += `*¡Nuevo Pedido Confirmado!* 🛍️\n\n`;
    message += `*Detalles del Pedido:*\n`;
    message += `📋 *ID del Pedido:* \`${order.id_pedido}\`\n`;
    message += `📅 *Fecha:* ${dateStr}\n`;
    message += `💳 *Método de Pago:* ${order.metodo_pago}\n`;
    message += `🚦 *Estado:* 🟡 *${order.estado}*\n\n`;

    message += `👤 *Información del Cliente:*\n`;
    message += `• *Nombre:* ${order.cliente.nombre}\n`;
    message += `• *Celular:* ${order.cliente.celular}\n`;
    message += `• *Dirección de Entrega:* ${order.cliente.direccion}\n\n`;

    message += `📦 *Detalle de Artículos:*\n`;
    order.items.forEach((item, index) => {
      const subtotal = item.cantidad * item.precio_unitario;
      message += `${index + 1}. *${item.nombre}* \n`;
      message += `   ${item.cantidad} x $${item.precio_unitario} USD  ➝  *$${subtotal} USD*\n`;
    });

    message += `\n💵 *TOTAL COMPRA: $${order.total} USD*\n\n`;
    message += `🔔 _El pedido ha sido cargado al sistema de Glow Heaven en tiempo real. ¡Muchas gracias por tu compra!_`;

    const encodedMessage = encodeURIComponent(message);
    
    // We target the official API which directs beautifully to either WhatsApp Web or App
    return `https://api.whatsapp.com/send?phone=573000000000&text=${encodedMessage}`; 
    // Colombia base or dummy phone since it gets overridden easily or prompts user
  };

  return (
    <CartContext.Provider
      value={{
        products,
        productsLoading,
        cart,
        addToCart,
        removeFromCart,
        updateQuantity,
        clearCart,
        cartSubtotal,
        cartTotal,
        cartCount,
        placeOrder,
        getWhatsAppRedirectUrl,
        isFirebaseActive,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};
