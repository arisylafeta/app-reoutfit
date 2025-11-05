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
          key={product.product_group_id || product.id}
          product={product}
          onClick={onProductClick}
        />
      ))}
    </div>
  );
}
