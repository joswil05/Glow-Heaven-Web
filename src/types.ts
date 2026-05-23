/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export enum Gender {
  DAMA = "Dama",
  CABALLERO = "Caballero",
  UNISEX = "Unisex"
}

export enum PaymentMethod {
  EFECTIVO = "Efectivo",
  TRANSFERENCIA = "Transferencia",
  TARJETA = "Tarjeta"
}

export enum OrderStatus {
  PENDIENTE = "Pendiente de Pago",
  COMPLETADO = "Completado",
  CANCELADO = "Cancelado"
}

export interface Product {
  id: string;
  nombre: string;
  marca: string;
  genero: Gender;
  categoria: 'perfume' | 'accesorio';
  notas?: string[];
  color?: string;
  material?: string;
  precio: number;
  stock: number;
  stock_disponible?: number;
  stock_comprometido?: number;
  imagenUrl: string;
  activo: boolean;
  descripcion?: string; // Optional nice detail
}

export interface OrderItem {
  producto_id: string;
  nombre: string; // for easier receipt display
  cantidad: number;
  precio_unitario: number;
}

export interface ClientData {
  nombre: string;
  telefono: string;
  direccion: string;
}

export interface EnvioData {
  direccion: string;
  canal: 'web_whatsapp' | 'whatsapp' | 'instagram';
  banco_destino: 'banpro' | 'lafise' | 'bac';
}

export interface OrderItem {
  sku: string;
  nombre: string;
  cantidad: number;
  precio_cobrado: number;
}

export interface Order {
  id_orden: string;
  fecha: string; // ISO string
  cliente: ClientData;
  envio: EnvioData;
  items: OrderItem[];
  total_cs: number;
  metodo_pago: 'transferencia' | 'efectivo';
  estado: 'stock_comprometido' | 'pendiente_pago' | 'listo_despacho' | 'en_camino' | 'entregado' | 'cancelado';
}

export interface CartItem {
  product: Product;
  quantity: number;
}

export interface QuizAnswers {
  ocasion: "diario" | "noche" | "especial";
  notas: "frescas" | "dulces" | "madera_especias" | "florales";
  genero: Gender;
}
