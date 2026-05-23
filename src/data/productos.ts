/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Product, Gender } from '../types';

export const INITIAL_PRODUCTS: Product[] = [
  {
    id: "prod_ambre_eclat",
    nombre: "Ambre Éclat",
    marca: "Glow Heaven Signature",
    genero: Gender.UNISEX,
    categoria: "perfume",
    notas: ["Ambar", "Vainilla", "Jazmín Blanco"],
    precio: 85,
    stock: 12,
    imagenUrl: "https://picsum.photos/seed/amber/400/400",
    activo: true,
    descripcion: "Una fragancia oriental majestuosa que fusiona la calidez del ámbar con notas dulces de vainilla de Madagascar y sutil jazmín nocturno. Una joya para ocasiones especiales."
  },
  {
    id: "prod_sunkissed_petale",
    nombre: "Sunkissed Pétale",
    marca: "Maison Luxury",
    genero: Gender.DAMA,
    categoria: "perfume",
    notas: ["Mandarina", "Rosa de Grasse", "Almizcle Blanco"],
    precio: 72,
    stock: 8,
    imagenUrl: "https://picsum.photos/seed/bloom/400/400",
    activo: true,
    descripcion: "La frescura de la mañana capturada en una botella. Destellos de mandarina bergamota dan paso a un corazón sublime de rosa búlgara, descansando sobre un sutil almizcle blanco de larga duración."
  },
  {
    id: "prod_noir_boise",
    nombre: "Noir Boisé",
    marca: "Le Parisien",
    genero: Gender.CABALLERO,
    categoria: "perfume",
    notas: ["Cedro", "Pachulí", "Pimienta Negra"],
    precio: 78,
    stock: 5,
    imagenUrl: "https://picsum.photos/seed/wood/400/400",
    activo: true,
    descripcion: "Carácter, firmeza y seducción. Un aroma intensamente amaderado que contrapone el místico sándalo y cedro con toques audaces de pimienta negra ahumada."
  },
  {
    id: "prod_nectar_divin",
    nombre: "Nectar Divin",
    marca: "Glow Heaven Signature",
    genero: Gender.DAMA,
    categoria: "perfume",
    notas: ["Durazno", "Miel natural", "Orquídea"],
    precio: 65,
    stock: 0, // Out of stock to test the Agotado flow!
    imagenUrl: "https://picsum.photos/seed/sweet/400/400",
    activo: true,
    descripcion: "Seducción frutal y gourmet. Deliciosos toques de durazno de agua dulce y miel tibia se encuentran con la exótica orquídea silvestre."
  },
  {
    id: "prod_oud_oasis",
    nombre: "Oud Oasis",
    marca: "Oriental Oud",
    genero: Gender.UNISEX,
    categoria: "perfume",
    notas: ["Madera de Oud", "Azafrán", "Incienso místico"],
    precio: 95,
    stock: 4,
    imagenUrl: "https://picsum.photos/seed/gold/400/400",
    activo: true,
    descripcion: "Un viaje sensorial hacia los misterios de Oriente. La resina refinada de Oud se envuelve con hilos dorados de azafrán y una estela hipnotizante de incienso real."
  },
  {
    id: "prod_marine_breeze",
    nombre: "Marine Breeze",
    marca: "Le Parisien",
    genero: Gender.CABALLERO,
    categoria: "perfume",
    notas: ["Menta fresca", "Sal marina", "Pomelo"],
    precio: 60,
    stock: 15,
    imagenUrl: "https://picsum.photos/seed/ocean/400/400",
    activo: true,
    descripcion: "Una ráfaga de aire marino y libertad. Notas acuáticas de salvia de mar, unidas a la energía vibrante de la toronja y menta triturada."
  },
  // High-end accessories added for lady/unisex
  {
    id: "prod_maison_clutch",
    nombre: "Maison Clutch Nappa",
    marca: "Glow Heaven Atelier",
    genero: Gender.DAMA,
    categoria: "accesorio",
    color: "Negro Ébano",
    material: "Cuero Genuino Nappa",
    precio: 145,
    stock: 6,
    imagenUrl: "https://picsum.photos/seed/clutch/400/400",
    activo: true,
    descripcion: "Un bolso cartera de mano de silueta minimalista pura, confeccionado con el más suave cuero Nappa. Cuenta con herrajes invisibles y es el acompañamiento perfecto para portar la distinción en eventos nocturnos."
  },
  {
    id: "prod_chic_tote",
    nombre: "Chic Canvas Tote",
    marca: "Parisian Atelier",
    genero: Gender.DAMA,
    categoria: "accesorio",
    color: "Arena Beige",
    material: "Canva de Alta Densidad",
    precio: 120,
    stock: 8,
    imagenUrl: "https://picsum.photos/seed/tote/400/400",
    activo: true,
    descripcion: "Bolso de hombro estilo tote refinado. Combina canvas resistente de tejido cerrado con asas de piel curtida al vegetal en tono camel. Práctico y sofisticado para el diario."
  },
  {
    id: "prod_mini_bandolera",
    nombre: "Mini Bandolera Saffiano",
    marca: "Maison Luxury",
    genero: Gender.DAMA,
    categoria: "accesorio",
    color: "Rosa Aura",
    material: "Cuero Italiano Saffiano",
    precio: 110,
    stock: 4,
    imagenUrl: "https://picsum.photos/seed/purse/400/400",
    activo: true,
    descripcion: "Bolso cruzado de geometría estructurada y rígida. Fabricado en cuero repujado tipo Saffiano con cadena fina chapada en oro de 24k para vestir con total sutileza."
  },
  {
    id: "prod_portafolio_oliva",
    nombre: "Portafolio Minimal Oliva",
    marca: "Glow Heaven Atelier",
    genero: Gender.DAMA,
    categoria: "accesorio",
    color: "Verde Oliva",
    material: "Eco-Cuero de Manzana Premium",
    precio: 135,
    stock: 0, // Out of stock to test checkout validation correctly
    imagenUrl: "https://picsum.photos/seed/wallet/400/400",
    activo: true,
    descripcion: "Cartera elegante de solapa con broches magnéticos imperceptibles. Diseñada y producida con fibras bio-basadas de manzana de tacto sedoso y larga duración."
  }
];
