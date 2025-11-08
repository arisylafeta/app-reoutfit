import { useState, useEffect } from 'react';

export interface ProductFilterOptions {
  categories: string[];
  brands: string[];
  genders: string[];
  price_range: {
    min: number;
    max: number;
  };
}

export interface UseProductFiltersReturn {
  filters: ProductFilterOptions;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useProductFilters(): UseProductFiltersReturn {
  const [filters, setFilters] = useState<ProductFilterOptions>({
    categories: [],
    brands: [],
    genders: [],
    price_range: { min: 0, max: 0 },
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchFilters = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/products/filters');

      if (!response.ok) {
        throw new Error('Failed to fetch filter options');
      }

      const data: ProductFilterOptions = await response.json();
      setFilters(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFilters();
  }, []);

  return {
    filters,
    loading,
    error,
    refresh: fetchFilters,
  };
}
