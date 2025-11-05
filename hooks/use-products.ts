import { useState, useEffect, useCallback } from 'react';
import { Product, ProductsResponse } from '@/types/product';

export interface UseProductsOptions {
  category?: string;
  brand?: string;
  gender?: string;
  search?: string;
  minPrice?: number;
  maxPrice?: number;
}

export interface UseProductsReturn {
  products: Product[];
  loading: boolean;
  error: string | null;
  hasMore: boolean;
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;
}

export function useProducts(options: UseProductsOptions = {}): UseProductsReturn {
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
      
      // Build query parameters
      const params = new URLSearchParams();
      params.append('limit', '50');
      params.append('offset', currentOffset.toString());
      
      if (options.category) params.append('category', options.category);
      if (options.brand) params.append('brand', options.brand);
      if (options.gender) params.append('gender', options.gender);
      if (options.search) params.append('search', options.search);
      if (options.minPrice !== undefined) params.append('minPrice', options.minPrice.toString());
      if (options.maxPrice !== undefined) params.append('maxPrice', options.maxPrice.toString());

      const response = await fetch(`/api/products?${params.toString()}`);

      if (!response.ok) {
        throw new Error('Failed to fetch products');
      }

      const data: ProductsResponse = await response.json();

      setProducts(prev => reset ? data.products : [...prev, ...data.products]);
      setHasMore(data.hasMore);
      setOffset(currentOffset + data.products.length);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [offset, options.category, options.brand, options.gender, options.search, options.minPrice, options.maxPrice]);

  useEffect(() => {
    setOffset(0);
    fetchProducts(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options.category, options.brand, options.gender, options.search, options.minPrice, options.maxPrice]);

  const loadMore = useCallback(() => fetchProducts(false), [fetchProducts]);
  const refresh = useCallback(() => {
    setOffset(0);
    return fetchProducts(true);
  }, [fetchProducts]);

  return { products, loading, error, hasMore, loadMore, refresh };
}
