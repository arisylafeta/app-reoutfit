'use client';

import { Product } from '@/types/product';
import { Card } from '@/components/ui/card';

interface ProductsDrawerGridProps {
  products: Product[];
  loading?: boolean;
  onProductClick?: (product: Product) => void;
}

/**
 * Responsive grid for drawer display of products
 * Uses container queries to adapt to actual container width
 * Automatically flows from 2 → 3 → 4 → 5 columns based on available space
 * Container-aware: works in full-screen mobile drawer OR desktop sidebar
 * Cards are fully clickable to add products to studio
 */
export function ProductsDrawerGrid({
  products,
  loading = false,
  onProductClick,
}: ProductsDrawerGridProps) {
  if (loading) {
    return (
      <div className="grid auto-rows-max grid-cols-2 gap-4 @[32rem]:grid-cols-3 @[48rem]:grid-cols-4 @[64rem]:grid-cols-5">
        {Array.from({ length: 10 }).map((_, i) => (
          <Card key={i} className="bg-white-soft p-0 gap-0">
            {/* Skeleton Image */}
            <div className="relative aspect-square overflow-hidden bg-gray-200 dark:bg-zinc-700 animate-pulse" />

            {/* Skeleton Content */}
            <div className="px-4 py-3 space-y-2">
              {/* Title skeleton - 2 lines */}
              <div className="space-y-2">
                <div className="h-4 bg-gray-200 dark:bg-zinc-700 rounded animate-pulse w-full" />
                <div className="h-4 bg-gray-200 dark:bg-zinc-700 rounded animate-pulse w-3/4" />
              </div>

              {/* Brand skeleton */}
              <div className="h-3 bg-gray-200 dark:bg-zinc-700 rounded animate-pulse w-1/2" />

              {/* Price skeleton */}
              <div className="h-4 bg-gray-200 dark:bg-zinc-700 rounded animate-pulse w-1/3 mt-1" />
            </div>
          </Card>
        ))}
      </div>
    );
  }

  // Don't show anything if empty - let the parent handle empty state
  if (products.length === 0) {
    return null;
  }

  const formatPrice = (price: number | null, currency: string | null) => {
    if (price === null) return 'Price not available';
    const symbol = currency === 'GBP' ? '£' : currency === 'EUR' ? '€' : '$';
    return `${symbol}${price.toFixed(2)}`;
  };

  return (
    <div className="grid auto-rows-max grid-cols-2 gap-4 @[32rem]:grid-cols-3 @[48rem]:grid-cols-4 @[64rem]:grid-cols-5">
      {products.map((product) => (
        <Card
          key={product.product_group_id || product.id}
          className="group relative overflow-hidden transition-all hover:shadow-lg bg-white-soft p-0 gap-0 cursor-pointer"
          onClick={() => onProductClick?.(product)}
        >
          {/* Product Image */}
          <div className="relative aspect-square overflow-hidden bg-gray-soft">
            {product.image_url ? (
              <img
                src={product.image_url}
                alt={product.name}
                className="w-full h-full object-cover transition-transform group-hover:scale-105"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-gray-400">
                <div className="text-center p-4">
                  <p className="text-xs">No image</p>
                </div>
              </div>
            )}
          </div>

          {/* Content */}
          <div className="px-4 py-3">
            {/* Title */}
            <h3 className="text-sm font-semibold text-black-soft line-clamp-2">
              {product.name}
            </h3>

            {/* Brand */}
            {product.brand && (
              <p className="text-xs text-gray-600 line-clamp-1">{product.brand}</p>
            )}

            {/* Price */}
            <p className="text-sm font-bold mt-1">
              {formatPrice(product.price, product.currency)}
            </p>
          </div>
        </Card>
      ))}
    </div>
  );
}
