# Phase 1: Data Model

**Feature**: Products Grid Page  
**Date**: 2025-10-28  
**Status**: Complete

## Overview

This document defines the TypeScript types and data structures for the products grid feature. All types are derived from the existing Supabase database schema.

## Type Definitions

### Product Type

```typescript
// types/product.ts

export interface Product {
  // Core identification
  id: string;                          // UUID from database
  partner_id: string;                  // Foreign key to affiliate_partners
  external_id: string;                 // Partner's product ID
  
  // Product information
  name: string;                        // Product name/title
  category: string | null;             // e.g., "Men's Tops", "Women's Footwear"
  brand: string | null;                // Brand name
  
  // Pricing
  price: number | null;                // Numeric price value
  currency: string | null;             // ISO currency code (e.g., "USD", "GBP")
  
  // Media
  product_url: string;                 // Affiliate link to product page
  image_url: string | null;            // Product image URL
  
  // Attributes (arrays)
  colors: string[] | null;             // Available colors
  fabrics: string[] | null;            // Fabric types
  seasons: string[] | null;            // Seasonal tags
  tags: string[] | null;               // General tags
  dress_codes: string[] | null;        // Dress code categories
  
  // Classification
  gender: string | null;               // "male", "female", "unisex", null
  size: string | null;                 // Size information
  
  // Metadata
  metadata: Record<string, any> | null; // Additional JSON data
  available: boolean;                   // Stock availability
  
  // Timestamps
  created_at: string;                  // ISO timestamp
  updated_at: string;                  // ISO timestamp
  
  // Joined data (from affiliate_partners)
  partner_name?: string;               // Partner display name
  partner_website?: string;            // Partner website URL
}
```

### Affiliate Partner Type

```typescript
// types/product.ts

export interface AffiliatePartner {
  id: string;                          // UUID
  name: string;                        // Partner name
  api_slug: string;                    // URL-friendly identifier
  website_url: string | null;          // Partner website
  commission_rate: number | null;      // Commission percentage
  created_at: string;                  // ISO timestamp
  updated_at: string;                  // ISO timestamp
}
```

### API Response Types

```typescript
// types/product.ts

export interface ProductsResponse {
  products: Product[];                 // Array of products
  total: number;                       // Total count in database
  hasMore: boolean;                    // More products available
  offset: number;                      // Current offset
  limit: number;                       // Items per page
}

export interface ProductDetailResponse {
  product: Product;                    // Single product with full details
  partner: AffiliatePartner;           // Partner information
}

export interface ProductsError {
  error: string;                       // Error message
  code?: string;                       // Error code
}
```

### Component Props Types

```typescript
// Component prop types

export interface ProductCardProps {
  product: Product;
  onClick: (product: Product) => void;
}

export interface ProductGridProps {
  products: Product[];
  loading?: boolean;
  onProductClick: (product: Product) => void;
}

export interface ProductDetailsModalProps {
  product: Product | null;
  open: boolean;
  onClose: () => void;
  onBuyNow: (product: Product) => void;
  onAddToWardrobe?: (product: Product) => void;
}
```

### Hook Return Types

```typescript
// hooks/use-products.ts return type

export interface UseProductsReturn {
  products: Product[];
  loading: boolean;
  error: string | null;
  hasMore: boolean;
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;
}
```

## Data Validation Rules

### Product Validation

```typescript
// Validation rules derived from functional requirements

export const validateProduct = (product: Product): boolean => {
  // FR-002: Must have image, name, brand, and price
  if (!product.name) return false;
  if (!product.image_url) return false;
  if (!product.brand) return false;
  if (product.price === null) return false;
  
  // FR-014: Must have availability status
  if (typeof product.available !== 'boolean') return false;
  
  // FR-005: Must have valid product URL
  if (!product.product_url || !isValidUrl(product.product_url)) return false;
  
  return true;
};

const isValidUrl = (url: string): boolean => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};
```

### Price Formatting

```typescript
// Utility for price display

export const formatPrice = (price: number | null, currency: string | null): string => {
  if (price === null) return 'Price not available';
  
  const currencySymbol = getCurrencySymbol(currency);
  return `${currencySymbol}${price.toFixed(2)}`;
};

const getCurrencySymbol = (currency: string | null): string => {
  const symbols: Record<string, string> = {
    'USD': '$',
    'GBP': '£',
    'EUR': '€',
    'JPY': '¥',
  };
  return symbols[currency || 'USD'] || currency || '$';
};
```

## State Management

### Page-Level State

```typescript
// app/products/page.tsx state structure

interface ProductsPageState {
  // Data
  products: Product[];
  selectedProduct: Product | null;
  
  // UI state
  loading: boolean;
  error: string | null;
  modalOpen: boolean;
  
  // Pagination
  hasMore: boolean;
  offset: number;
  
  // Filters (P2 - optional)
  filters: {
    category: string | null;
    brand: string | null;
    gender: string | null;
    minPrice: number | null;
    maxPrice: number | null;
    search: string | null;
  };
}
```

### Modal State

```typescript
// Product detail modal state

interface ModalState {
  open: boolean;
  product: Product | null;
  loading: boolean;
  error: string | null;
}
```

## Database Schema Reference

### Existing Tables (No Changes Required)

```sql
-- affiliate_partners table (existing)
CREATE TABLE affiliate_partners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  api_slug TEXT UNIQUE NOT NULL,
  website_url TEXT,
  commission_rate NUMERIC(5,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- affiliate_products table (existing)
CREATE TABLE affiliate_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID NOT NULL REFERENCES affiliate_partners(id) ON DELETE CASCADE,
  external_id TEXT NOT NULL,
  name TEXT NOT NULL,
  category TEXT,
  brand TEXT,
  price NUMERIC(12,2),
  currency TEXT CHECK (char_length(currency) = 3),
  product_url TEXT NOT NULL,
  image_url TEXT,
  colors TEXT[],
  fabrics TEXT[],
  seasons TEXT[],
  tags TEXT[],
  dress_codes TEXT[],
  gender TEXT,
  size TEXT,
  metadata JSONB,
  available BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(partner_id, external_id)
);

-- Indexes (existing)
CREATE INDEX idx_affiliate_products_partner_id ON affiliate_products(partner_id);
CREATE INDEX idx_affiliate_products_category ON affiliate_products(category);
CREATE INDEX idx_affiliate_products_available ON affiliate_products(available);
CREATE INDEX idx_affiliate_products_created_at ON affiliate_products(created_at DESC);
```

### Optional: Click Tracking Table (Future Enhancement)

```sql
-- For FR-006: Track affiliate link clicks
-- This can be added later for commission tracking

CREATE TABLE affiliate_clicks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  product_id UUID NOT NULL REFERENCES affiliate_products(id),
  clicked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_agent TEXT,
  referrer TEXT
);

CREATE INDEX idx_affiliate_clicks_product_id ON affiliate_clicks(product_id);
CREATE INDEX idx_affiliate_clicks_user_id ON affiliate_clicks(user_id);
CREATE INDEX idx_affiliate_clicks_clicked_at ON affiliate_clicks(clicked_at DESC);
```

## Data Flow

### Product List Flow

```
User visits /products
    ↓
Page component loads
    ↓
useProducts hook called
    ↓
Fetch /api/products?limit=50&offset=0
    ↓
API route queries Supabase
    ↓
Return ProductsResponse
    ↓
Update state, render ProductGrid
    ↓
ProductCard components render
```

### Product Detail Flow

```
User clicks ProductCard
    ↓
onClick handler fires
    ↓
Set selectedProduct state
    ↓
Open ProductDetailsModal
    ↓
Modal displays product data
    ↓
User clicks "Buy Now"
    ↓
Track click (optional)
    ↓
Open product_url in new tab
```

## Type Guards

```typescript
// Type guard utilities

export const isProduct = (obj: any): obj is Product => {
  return (
    typeof obj === 'object' &&
    typeof obj.id === 'string' &&
    typeof obj.name === 'string' &&
    typeof obj.product_url === 'string'
  );
};

export const isProductsResponse = (obj: any): obj is ProductsResponse => {
  return (
    typeof obj === 'object' &&
    Array.isArray(obj.products) &&
    typeof obj.total === 'number' &&
    typeof obj.hasMore === 'boolean'
  );
};
```

## Summary

- **No database migrations required** - uses existing tables
- **7 TypeScript types defined** - Product, Partner, API responses, component props
- **Validation rules** - ensure data quality before rendering
- **State management** - page-level state with React hooks
- **Optional enhancement** - click tracking table for future implementation

All types are derived from existing database schema and functional requirements from the specification.
