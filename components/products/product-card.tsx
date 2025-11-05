'use client';

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
      className="cursor-pointer hover:shadow-lg transition-shadow overflow-hidden"
      onClick={() => onClick(product)}
    >
      <CardContent className="p-0">
        <div className="relative aspect-square overflow-hidden">
          <img
            src={product.image_url || '/products.png'}
            alt={product.name}
            className="w-full h-full object-cover"
          />
        </div>
        <div className="p-4 space-y-1">
          <h3 className="font-semibold text-sm line-clamp-2">
            {product.name}
          </h3>
          <p className="text-sm font-bold">
            {formatPrice(product.price, product.currency)}
          </p>
          {product.partner_name && (
            <p className="text-xs text-muted-foreground">
              {product.partner_name}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
