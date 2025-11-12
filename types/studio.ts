/**
 * Studio Feature Type Definitions
 * 
 * Unified types for the Virtual Try-On Studio feature, including product
 * normalization, state management, and API contracts.
 */

import { Avatar, Lookbook } from './lookbook';

/**
 * Product type from search results (lens-results, shopping-results)
 */
export interface Product {
  id: string;
  name: string;
  price: number;
  image: string;
  image_full?: string;
  brand: string;
  currency: string;
  description: string;
  product_url: string;
  rating?: number;
  reviews?: number;
  in_stock?: boolean;
  source_icon?: string;
  position?: number;
  attributes: Record<string, any>;
}

/**
 * Unified product interface for Studio
 * Normalizes products from different sources (search results, wardrobe items)
 */
export interface StudioProduct {
  /** Unique product identifier */
  id: string;
  /** Product name/title */
  title: string;
  /** Brand name */
  brand: string;
  /** High-quality image URL (prefers image_full if available) */
  image: string;
  /** Original product data stored as JSONB for flexibility */
  sourceData: Record<string, any>;
}

/**
 * Global Studio state managed via React Context
 */
export interface StudioState {
  /** Products marked for try-on (from lens-results, shopping-results, wardrobe) */
  selectedProducts: StudioProduct[];
  /** Current outfit composition (max 6 items) */
  currentOutfit: StudioProduct[];
  /** Generated look result */
  generatedLook: GeneratedLook | null;
  /** Loading state during AI generation */
  isGenerating: boolean;
  /** Currently active drawer (for future features) */
  activeDrawer: 'wardrobe' | 'shopping' | 'looks' | null;
  /** Selected avatar for try-on (from lookbook system) */
  selectedAvatar: Avatar | null;
  /** Loading state for avatar from database */
  isLoadingAvatar: boolean;
}

/**
 * Generated look data
 */
export interface GeneratedLook {
  /** Image URL (base64 data URL or Supabase Storage URL) */
  imageUrl: string;
  /** Lookbook ID (set after save) */
  lookbookId?: string;
}

/**
 * Request payload for generating a virtual try-on look
 */
export interface GenerateLookRequest {
  /** User's avatar image URL */
  avatarUrl: string;
  /** Array of product image URLs (max 6) */
  productImages: string[];
}

/**
 * Response from generate look API
 */
export interface GenerateLookResponse {
  /** Generated image as base64 data URL */
  generatedImage: string;
  /** Processing time in milliseconds */
  processingTimeMs: number;
}

/**
 * Request payload for saving a look to database
 */
export interface SaveLookRequest {
  /** Optional lookbook title */
  title?: string;
  /** Products in the outfit */
  products: StudioProduct[];
  /** Generated image as base64 data URL */
  generatedImageBase64: string;
}

/**
 * Response from save look API
 * Extends Lookbook type from lookbook system
 */
export interface SaveLookResponse {
  /** Created lookbook */
  lookbook: Lookbook;
  /** Public Supabase Storage URL */
  imageUrl: string;
}

/**
 * Type guard to check if a product has sourceData
 */
export function hasSourceData(product: StudioProduct): boolean {
  return product.sourceData && Object.keys(product.sourceData).length > 0;
}

/**
 * Convert a Product (from search results) to StudioProduct
 * Uses high-quality image field if available
 */
export function toStudioProduct(product: Product): StudioProduct {
  return {
    id: product.id,
    title: product.name,
    brand: product.brand || 'Unknown',
    image: (product as any).image_full || product.image || '',
    sourceData: product as Record<string, any>,
  };
}

/**
 * Convert a WardrobeItem to StudioProduct
 */
export interface WardrobeItem {
  id: string;
  name: string;
  brand?: string;
  image_url?: string;
  metadata?: Record<string, any>;
  [key: string]: any;
}

export function wardrobeToStudioProduct(item: WardrobeItem): StudioProduct {
  return {
    id: item.id,
    title: item.name,
    brand: item.brand || 'Unknown',
    image: item.image_url || '',
    sourceData: item.metadata || (item as Record<string, any>),
  };
}
