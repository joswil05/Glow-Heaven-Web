/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface ERPProduct {
  id: string;
  sku: string;
  nombre: string;
  marca: string;
  categoria: 'perfume' | 'accesorio';
  stock_disponible: number;
  stock_comprometido: number;
  stock_minimo: number;
  activo: boolean;
  proveedor_id: string;

  // Propiedades dinámicas - Perfume
  mililitros?: 30 | 50 | 100;
  concentracion?: 'EDT' | 'EDP' | 'Parfum';
  batch_code?: string;

  // Propiedades dinámicas - Accesorio
  material?: string;
  color_banio?: string;
}

export interface InventoryBatch {
  id_lote: string;
  producto_id: string; // Enlace al ERPProduct.id
  fecha_ingreso: string | Date;
  costo_adquisicion: number; // en Córdobas (C$)
  cantidad_inicial: number;
  cantidad_restante: number;
}

export interface ERPOrderItem {
  sku: string;
  nombre: string;
  cantidad: number;
  precio_cobrado: number; // en C$
  costo_peps_calculado?: number; // Costo interno (COGS) calculado tras liquidación
}

export interface ERPOrder {
  id_orden: string;
  canal: 'web_whatsapp' | 'mostrador_fisico';
  fecha: string | Date;
  cliente_nombre: string;
  cliente_telefono: string;
  items: ERPOrderItem[];
  total_cs: number;
  metodo_pago: 'transferencia' | 'efectivo';
  estado: 'pendiente_pago' | 'stock_comprometido' | 'listo_despacho' | 'entregado' | 'cancelado';
}

export interface PettyCashTransaction {
  id_gasto: string;
  fecha: string | Date;
  monto_cs: number;
  descripcion: string;
  categoria: 'marketing' | 'logistica' | 'empaques' | 'otros';
}
