import { useState, useEffect, useCallback } from 'react';
import { Product, ScoredProduct, SearchResponse } from '@/types/product';

export interface UseProductsOptions {
  categories?: string[];
  brands?: string[];
  genders?: string[];
  search?: string;
  minPrice?: number;
  maxPrice?: number;
  initialLimit?: number;
}

export interface UseProductsReturn {
  products: ScoredProduct[];
  loading: boolean;
  error: string | null;
  hasMore: boolean;
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;
  searchType?: 'filter-only' | 'hybrid' | 'text-fallback';
  breakdown?: SearchResponse['breakdown'];
}

export function useProducts(options: UseProductsOptions = {}): UseProductsReturn {
  const [products, setProducts] = useState<ScoredProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [searchType, setSearchType] = useState<SearchResponse['searchType']>();
  const [breakdown, setBreakdown] = useState<SearchResponse['breakdown']>();

  const limit = options.initialLimit || 50;

  const fetchProducts = useCallback(async (reset: boolean = false) => {
    try {
      setLoading(true);
      setError(null);

      const currentOffset = reset ? 0 : offset;

      // Build query parameters
      const params = new URLSearchParams();
      params.append('limit', limit.toString());
      params.append('offset', currentOffset.toString());

      // Handle array parameters (comma-separated)
      if (options.categories?.length) {
        params.append('categories', options.categories.join(','));
      }
      if (options.brands?.length) {
        params.append('brands', options.brands.join(','));
      }
      if (options.genders?.length) {
        params.append('genders', options.genders.join(','));
      }

      // Search query
      if (options.search) {
        params.append('query', options.search);
      }

      // Price range
      if (options.minPrice !== undefined) {
        params.append('minPrice', options.minPrice.toString());
      }
      if (options.maxPrice !== undefined) {
        params.append('maxPrice', options.maxPrice.toString());
      }

      // Call unified search endpoint
      const response = await fetch(`/api/products/search?${params.toString()}`);

      if (!response.ok) {
        throw new Error('Failed to fetch products');
      }

      const data: SearchResponse = await response.json();

      // Update state
      setProducts(prev => reset ? data.products : [...prev, ...data.products]);
      setHasMore(data.hasMore);
      setOffset(currentOffset + data.products.length);
      setSearchType(data.searchType);
      setBreakdown(data.breakdown);

      // Log search type for debugging
      if (data.searchType === 'hybrid' && data.breakdown) {
        console.log(
          `[Hybrid Search] Semantic: ${data.breakdown.semanticCount}, Text: ${data.breakdown.textCount}, Merged: ${data.breakdown.mergedCount}`
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [offset, limit, options.categories, options.brands, options.genders, options.search, options.minPrice, options.maxPrice]);

  useEffect(() => {
    setOffset(0);
    fetchProducts(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options.categories?.join(','), options.brands?.join(','), options.genders?.join(','), options.search, options.minPrice, options.maxPrice]);

  const loadMore = useCallback(() => fetchProducts(false), [fetchProducts]);
  const refresh = useCallback(() => {
    setOffset(0);
    return fetchProducts(true);
  }, [fetchProducts]);

  return {
    products,
    loading,
    error,
    hasMore,
    loadMore,
    refresh,
    searchType,
    breakdown
  };
}
