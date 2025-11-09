import { useState, useEffect, useCallback } from 'react';
import type { ImmersiveProductData } from '@/types/product';

interface UseImmersiveProductReturn {
  data: ImmersiveProductData | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  isCached: boolean;
}

// In-memory cache to prevent duplicate API calls
const immersiveCache = new Map<string, ImmersiveProductData>();

/**
 * Hook to fetch and cache SerpAPI Immersive Product data
 * 
 * @param productId - Unique product identifier for caching
 * @param immersiveToken - SerpAPI page token from initial search
 * @returns Immersive product data, loading state, and error
 */
export function useImmersiveProduct(
  productId: string,
  immersiveToken?: string
): UseImmersiveProductReturn {
  const [data, setData] = useState<ImmersiveProductData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCached, setIsCached] = useState(false);

  const fetchImmersiveData = useCallback(async () => {
    if (!immersiveToken) {
      setError('No immersive token available');
      return;
    }

    // Check cache first
    const cached = immersiveCache.get(productId);
    if (cached) {
      setData(cached);
      setIsCached(true);
      return;
    }

    setIsLoading(true);
    setError(null);
    setIsCached(false);

    try {
      const response = await fetch('/api/serp/immersive-product', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ page_token: immersiveToken }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        
        // Handle insufficient credits error
        if (response.status === 402) {
          throw new Error(`Insufficient credits: ${errorData.required} required, ${errorData.available} available`);
        }
        
        throw new Error(errorData.error || 'Failed to fetch immersive product data');
      }

      const result = await response.json();
      
      if (result.success && result.data) {
        // Cache the result
        immersiveCache.set(productId, result.data);
        setData(result.data);
        setIsCached(false);
      } else {
        throw new Error(result.error || 'Invalid response from API');
      }
    } catch (err: any) {
      console.error('Immersive product fetch error:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [productId, immersiveToken]);

  useEffect(() => {
    if (immersiveToken && !data && !isLoading && !error) {
      fetchImmersiveData();
    }
  }, [immersiveToken, data, isLoading, error, fetchImmersiveData]);

  return {
    data,
    isLoading,
    error,
    refetch: fetchImmersiveData,
    isCached,
  };
}
