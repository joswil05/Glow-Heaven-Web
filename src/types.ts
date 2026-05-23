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
  celular: string;
  direccion: string;
}

export interface Order {
  id_pedido: string;
  fecha: string; // ISO string / timestamp
  cliente: ClientData;
  items: OrderItem[];
  total: number;
  metodo_pago: PaymentMethod;
  estado: OrderStatus;
  expiraEn: any; // Firebase Timestamp or string date for expiration
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
