# Quickstart Guide: Products Grid Page

**Feature**: Products Grid Page  
**Date**: 2025-10-28  
**For**: Developers implementing this feature

## Overview

This guide provides step-by-step instructions for implementing the products grid page feature. Follow the phases in order for a smooth implementation.

## Prerequisites

- Node.js 18+ installed
- pnpm package manager
- Supabase project configured
- ~10,000 products loaded in `affiliate_products` table
- Existing app-reoutfit codebase cloned

## Quick Start (5 minutes)

```bash
# 1. Ensure you're on the feature branch
git checkout 005-products-grid-page

# 2. Install dependencies (if needed)
cd app-reoutfit
pnpm install

# 3. Start development server
pnpm dev

# 4. Open browser
open http://localhost:3000/products
```

## Implementation Phases

### Phase 1: Type Definitions (15 minutes)

Create the TypeScript types for products.

**File**: `types/product.ts`

```typescript
export interface Product {
  id: string;
  partner_id: string;
  external_id: string;
  name: string;
  category: string | null;
  brand: string | null;
  price: number | null;
  currency: string | null;
  product_url: string;
  image_url: string | null;
  colors: string[] | null;
  fabrics: string[] | null;
  seasons: string[] | null;
  tags: string[] | null;
  dress_codes: string[] | null;
  gender: string | null;
  size: string | null;
  metadata: Record<string, any> | null;
  available: boolean;
  created_at: string;
  updated_at: string;
  partner_name?: string;
}

export interface ProductsResponse {
  products: Product[];
  total: number;
  hasMore: boolean;
  offset: number;
  limit: number;
}
```

**Verification**:
```bash
# Type check
pnpm tsc --noEmit
```

---

### Phase 2: API Route (30 minutes)

Create the API endpoint for fetching products.

**File**: `app/api/products/route.ts`

```typescript
import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
  const offset = parseInt(searchParams.get('offset') || '0');
  const available = searchParams.get('available') !== 'false';

  try {
    const supabase = await createClient();

    // Query products with partner information
    const { data: products, error, count } = await supabase
      .from('affiliate_products')
      .select(`
        *,
        partner:affiliate_partners(name, website_url)
      `, { count: 'exact' })
      .eq('available', available)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    // Flatten partner data
    const formattedProducts = products?.map(p => ({
      ...p,
      partner_name: p.partner?.name,
      partner_website: p.partner?.website_url,
    })) || [];

    return NextResponse.json({
      products: formattedProducts,
      total: count || 0,
      hasMore: (offset + limit) < (count || 0),
      offset,
      limit,
    });
  } catch (error) {
    console.error('Error fetching products:', error);
    return NextResponse.json(
      { error: 'Failed to fetch products' },
      { status: 500 }
    );
  }
}
```

**Verification**:
```bash
# Test API endpoint
curl http://localhost:3000/api/products?limit=5
```

---

### Phase 3: Custom Hook (20 minutes)

Create a React hook for data fetching.

**File**: `hooks/use-products.ts`

```typescript
import { useState, useEffect, useCallback } from 'react';
import { Product, ProductsResponse } from '@/types/product';

export function useProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);

  const fetchProducts = useCallback(async (reset: boolean = false) => {
    try {
      setLoading(true);
      setError(null);

      const currentOffset = reset ? 0 : offset;
      const response = await fetch(
        `/api/products?limit=50&offset=${currentOffset}`
      );

      if (!response.ok) throw new Error('Failed to fetch products');

      const data: ProductsResponse = await response.json();

      setProducts(prev => reset ? data.products : [...prev, ...data.products]);
      setHasMore(data.hasMore);
      setOffset(currentOffset + data.products.length);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [offset]);

  useEffect(() => {
    fetchProducts(true);
  }, []);

  const loadMore = useCallback(() => fetchProducts(false), [fetchProducts]);
  const refresh = useCallback(() => fetchProducts(true), [fetchProducts]);

  return { products, loading, error, hasMore, loadMore, refresh };
}
```

**Verification**:
```typescript
// In a component
const { products, loading } = useProducts();
console.log('Products:', products.length);
```

---

### Phase 4: Product Card Component (30 minutes)

Create the individual product card component.

**File**: `components/products/product-card.tsx`

```typescript
'use client';

import Image from 'next/image';
import { Product } from '@/types/product';
import { Card, CardContent } from '@/components/ui/card';

interface ProductCardProps {
  product: Product;
  onClick: (product: Product) => void;
}

export function ProductCard({ product, onClick }: ProductCardProps) {
  const formatPrice = (price: number | null, currency: string | null) => {
    if (price === null) return 'Price not available';
    const symbol = currency === 'GBP' ? '£' : currency === 'EUR' ? '€' : '$';
    return `${symbol}${price.toFixed(2)}`;
  };

  return (
    <Card
      className="cursor-pointer hover:shadow-lg transition-shadow"
      onClick={() => onClick(product)}
    >
      <CardContent className="p-0">
        <div className="relative aspect-square">
          <Image
            src={product.image_url || '/placeholder-product.png'}
            alt={product.name}
            fill
            className="object-cover rounded-t-lg"
            sizes="(max-width: 768px) 50vw, (max-width: 1200px) 25vw, 20vw"
          />
        </div>
        <div className="p-4">
          <h3 className="font-semibold text-sm line-clamp-2 mb-1">
            {product.name}
          </h3>
          {product.brand && (
            <p className="text-xs text-muted-foreground mb-2">
              {product.brand}
            </p>
          )}
          <p className="text-sm font-bold">
            {formatPrice(product.price, product.currency)}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
```

**Verification**:
```bash
# Visual check in browser
# Should see product cards with images, names, brands, prices
```

---

### Phase 5: Product Grid Component (20 minutes)

Create the grid container component.

**File**: `components/products/product-grid.tsx`

```typescript
'use client';

import { Product } from '@/types/product';
import { ProductCard } from './product-card';
import { Loader2 } from 'lucide-react';

interface ProductGridProps {
  products: Product[];
  loading?: boolean;
  onProductClick: (product: Product) => void;
}

export function ProductGrid({
  products,
  loading = false,
  onProductClick,
}: ProductGridProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-accent-2" />
      </div>
    );
  }

  if (products.length === 0) {
    return null;
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 2xl:grid-cols-5 gap-6">
      {products.map((product) => (
        <ProductCard
          key={product.id}
          product={product}
          onClick={onProductClick}
        />
      ))}
    </div>
  );
}
```

---

### Phase 6: Product Details Modal (45 minutes)

Create the modal for product details.

**File**: `components/products/product-details-modal.tsx`

```typescript
'use client';

import { Product } from '@/types/product';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ExternalLink } from 'lucide-react';
import Image from 'next/image';

interface ProductDetailsModalProps {
  product: Product | null;
  open: boolean;
  onClose: () => void;
}

export function ProductDetailsModal({
  product,
  open,
  onClose,
}: ProductDetailsModalProps) {
  if (!product) return null;

  const handleBuyNow = () => {
    // Track click (optional - future enhancement)
    window.open(product.product_url, '_blank', 'noopener,noreferrer');
  };

  const formatPrice = (price: number | null, currency: string | null) => {
    if (price === null) return 'Price not available';
    const symbol = currency === 'GBP' ? '£' : currency === 'EUR' ? '€' : '$';
    return `${symbol}${price.toFixed(2)}`;
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{product.name}</DialogTitle>
        </DialogHeader>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Product Image */}
          <div className="relative aspect-square">
            <Image
              src={product.image_url || '/placeholder-product.png'}
              alt={product.name}
              fill
              className="object-cover rounded-lg"
              sizes="(max-width: 768px) 100vw, 50vw"
            />
          </div>

          {/* Product Details */}
          <div className="space-y-4">
            {product.brand && (
              <div>
                <h4 className="text-sm font-semibold text-muted-foreground">
                  Brand
                </h4>
                <p>{product.brand}</p>
              </div>
            )}

            <div>
              <h4 className="text-sm font-semibold text-muted-foreground">
                Price
              </h4>
              <p className="text-2xl font-bold">
                {formatPrice(product.price, product.currency)}
              </p>
            </div>

            {product.category && (
              <div>
                <h4 className="text-sm font-semibold text-muted-foreground">
                  Category
                </h4>
                <p>{product.category}</p>
              </div>
            )}

            {product.colors && product.colors.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-muted-foreground">
                  Available Colors
                </h4>
                <p>{product.colors.join(', ')}</p>
              </div>
            )}

            {product.partner_name && (
              <div>
                <h4 className="text-sm font-semibold text-muted-foreground">
                  Sold by
                </h4>
                <p>{product.partner_name}</p>
              </div>
            )}

            <Button
              size="lg"
              className="w-full"
              onClick={handleBuyNow}
            >
              <ExternalLink className="mr-2 h-5 w-5" />
              Buy Now
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

---

### Phase 7: Products Page (30 minutes)

Create the main products page.

**File**: `app/products/page.tsx`

```typescript
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ChatHeader } from '@/components/chat/chat-header';
import { useChatSidebar } from '@/hooks/use-chat-sidebar';
import { ProductGrid } from '@/components/products/product-grid';
import { ProductDetailsModal } from '@/components/products/product-details-modal';
import { useProducts } from '@/hooks/use-products';
import { Product } from '@/types/product';
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from '@/components/ui/empty';

export default function ProductsPage() {
  const router = useRouter();
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const { chatHistoryOpen, toggleSidebar, isLargeScreen } = useChatSidebar();
  const { products, loading, error, hasMore, loadMore } = useProducts();

  const handleProductClick = (product: Product) => {
    setSelectedProduct(product);
    setModalOpen(true);
  };

  const handleModalClose = () => {
    setModalOpen(false);
    setSelectedProduct(null);
  };

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <ChatHeader
        chatStarted={true}
        isOverlayLayout={false}
        isLargeScreen={isLargeScreen}
        chatHistoryOpen={chatHistoryOpen}
        onToggleSidebar={toggleSidebar}
        onNewThread={() => router.push('/')}
        opened={chatHistoryOpen && isLargeScreen}
      />

      {/* Title Section with Blob Background */}
      <div className="bg-white pt-12 pb-8">
        <div className="max-w-9xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          {/* Blob SVG Background */}
          <div className="absolute inset-0 pointer-events-none opacity-20">
            <svg
              viewBox="0 0 200 200"
              xmlns="http://www.w3.org/2000/svg"
              className="absolute -top-20 -right-10 w-64 h-64"
            >
              <path
                fill="#BFB4DC"
                d="M46.5,-44.6C57.2,-35.9,60.7,-17.9,57.1,-3.6C53.5,10.8,42.9,21.6,32.3,32.7C21.6,43.8,10.8,55.2,-5.3,60.5C-21.4,65.8,-42.7,64.9,-56.7,53.8C-70.7,42.7,-77.3,21.4,-73.8,3.5C-70.3,-14.4,-56.7,-28.7,-42.7,-37.5C-28.7,-46.3,-14.4,-49.6,1.8,-51.3C17.9,-53.1,35.9,-53.4,46.5,-44.6Z"
                transform="translate(100 100)"
              />
            </svg>
          </div>

          <div className="relative z-10">
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-foreground leading-tight mb-3">
              Discover{' '}
              <span className="bg-gradient-to-r from-accent-1 to-accent-2 bg-clip-text text-transparent">
                Products
              </span>
            </h1>
            <p className="text-base sm:text-lg text-muted-foreground">
              Browse fashion items from our affiliate partners
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto bg-white">
        <div className="max-w-9xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {!loading && products.length === 0 && (
            <Empty className="py-12">
              <EmptyHeader>
                <EmptyMedia>
                  <img
                    src="/wardrobe.png"
                    alt="No products"
                    className="w-[200px] h-[200px] opacity-80"
                  />
                </EmptyMedia>
                <EmptyTitle>No products available</EmptyTitle>
                <EmptyDescription>
                  Check back later for new fashion items.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}

          <ProductGrid
            products={products}
            loading={loading && products.length === 0}
            onProductClick={handleProductClick}
          />

          {hasMore && !loading && (
            <div className="mt-8 flex justify-center">
              <Button onClick={loadMore} size="lg">
                Load More Products
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Modal */}
      <ProductDetailsModal
        product={selectedProduct}
        open={modalOpen}
        onClose={handleModalClose}
      />
    </div>
  );
}
```

---

## Testing

### Manual Testing Checklist

```bash
# 1. Start dev server
pnpm dev

# 2. Navigate to products page
open http://localhost:3000/products

# 3. Verify grid displays
# ✓ Products show in grid
# ✓ Images load correctly
# ✓ Names, brands, prices visible

# 4. Test product click
# ✓ Modal opens
# ✓ Product details displayed
# ✓ "Buy Now" button works

# 5. Test responsive design
# ✓ Mobile: 2 columns
# ✓ Tablet: 4 columns
# ✓ Desktop: 5 columns

# 6. Test pagination
# ✓ "Load More" button appears
# ✓ Clicking loads more products
```

### Automated Tests

```bash
# Run E2E tests
pnpm test:e2e tests/products/

# Run unit tests
pnpm test tests/products/
```

---

## Troubleshooting

### Products not loading

```bash
# Check API endpoint
curl http://localhost:3000/api/products

# Check Supabase connection
# Verify .env.local has correct SUPABASE_URL and SUPABASE_ANON_KEY
```

### Images not displaying

```bash
# Add image domains to next.config.js
images: {
  domains: ['cdn.partner.com', 'images.partner.com'],
}
```

### Type errors

```bash
# Regenerate types from Supabase
npx supabase gen types typescript --project-id <project-id> > types/supabase.ts
```

---

## Next Steps

After completing the basic implementation:

1. **Add filters** (P2): Category, brand, price range
2. **Add search** (P2): Text search in product names
3. **Add to wardrobe** (P3): Save products to user's wardrobe
4. **Click tracking**: Implement affiliate click tracking
5. **Performance optimization**: Add caching, optimize images

---

## Resources

- [Specification](./spec.md)
- [Data Model](./data-model.md)
- [API Contract](./contracts/products-api.md)
- [Research](./research.md)
- [Next.js Docs](https://nextjs.org/docs)
- [Supabase Docs](https://supabase.com/docs)

---

**Estimated Total Time**: 3-4 hours for P1 features (Browse Grid + View Details)

**Questions?** Check the research.md and data-model.md documents for detailed technical decisions.
