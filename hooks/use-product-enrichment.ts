import { useState, useCallback, useEffect } from 'react';
import type {
  EnrichedProductData,
  EnrichmentStatus,
  UseProductEnrichmentReturn,
} from '@/types/enriched-product';
import { getCachedEnrichment, subscribeToCacheUpdates } from '@/lib/prefetch-enrichment';

/**
 * Hook for enriching product data using Firecrawl
 * 
 * @param productId - The product ID
 * @param productUrl - The product URL to scrape
 * @param autoEnrich - Whether to automatically enrich on mount (default: false)
 * 
 * @example
 * ```tsx
 * const { enrichedData, status, enrich, isLoading } = useProductEnrichment(
 *   product.id,
 *   product.product_url
 * );
 * 
 * // Trigger enrichment on user action
 * <button onClick={enrich} disabled={isLoading}>
 *   {isLoading ? 'Loading...' : 'Get More Details'}
 * </button>
 * 
 * // Display enriched data
 * {enrichedData && (
 *   <div>
 *     <p>{enrichedData.description_summary}</p>
 *     <p>Materials: {enrichedData.materials_summary}</p>
 *   </div>
 * )}
 * ```
 */
export function useProductEnrichment(
  productId: string,
  productUrl: string,
  autoEnrich: boolean = false
): UseProductEnrichmentReturn {
  const [enrichedData, setEnrichedData] = useState<EnrichedProductData | null>(null);
  const [status, setStatus] = useState<EnrichmentStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [isCached, setIsCached] = useState(false);
  const [isWaitingForPrefetch, setIsWaitingForPrefetch] = useState(false);

  console.log('[HOOK] 🎣 useProductEnrichment render', {
    productUrl,
    status,
    hasEnrichedData: !!enrichedData,
    isWaitingForPrefetch,
  });

  // Check for prefetched data on mount and when productUrl changes
  useEffect(() => {
    console.log('[HOOK] 🔄 useEffect triggered', {
      productUrl,
      status,
      hasProductUrl: !!productUrl,
      statusIsIdle: status === 'idle',
    });

    if (productUrl && status === 'idle') {
      console.log('[HOOK] 🔍 Checking cache for:', productUrl);
      const cachedData = getCachedEnrichment(productUrl);
      
      if (cachedData) {
        console.log('[HOOK] ✅ Found cached data!', {
          data: cachedData,
          hasData: !!cachedData.data,
        });
        setEnrichedData(cachedData.data);
        setIsCached(cachedData.cached);
        setStatus('success');
        setIsWaitingForPrefetch(false);
      } else {
        console.log('[HOOK] ❌ No cached data found, waiting for prefetch...');
        setIsWaitingForPrefetch(true);
      }
    } else {
      console.log('[HOOK] ⏭️ Skipping cache check', {
        reason: !productUrl ? 'no productUrl' : 'status not idle',
      });
    }
  }, [productUrl, status]);

  // Subscribe to cache updates to get notified when prefetch completes
  useEffect(() => {
    if (!productUrl) return;

    console.log('[HOOK] 🔔 Subscribing to cache updates for:', productUrl);

    const unsubscribe = subscribeToCacheUpdates((updatedUrl) => {
      console.log('[HOOK] 📬 Cache update notification received', {
        updatedUrl,
        currentUrl: productUrl,
        matches: updatedUrl === productUrl,
      });

      // Only update if this is for our product and we don't have data yet
      if (updatedUrl === productUrl && !enrichedData) {
        console.log('[HOOK] 🔄 Fetching newly cached data...');
        const cachedData = getCachedEnrichment(productUrl);
        
        if (cachedData) {
          console.log('[HOOK] ✅ Got data from cache after notification!', {
            data: cachedData,
          });
          setEnrichedData(cachedData.data);
          setIsCached(cachedData.cached);
          setStatus('success');
          setIsWaitingForPrefetch(false);
        }
      }
    });

    return () => {
      console.log('[HOOK] 🔕 Unsubscribing from cache updates');
      unsubscribe();
    };
  }, [productUrl, enrichedData]);

  const enrich = useCallback(async () => {
    if (!productUrl) {
      setError('Product URL is required');
      setStatus('error');
      return;
    }

    // Don't re-fetch if already loading or successfully loaded
    if (status === 'loading' || status === 'success') {
      return;
    }

    setStatus('loading');
    setError(null);

    try {
      const response = await fetch('/api/products/enrich', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          productId,
          productUrl,
        }),
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to enrich product');
      }

      const data = await response.json();
      
      setEnrichedData(data.enrichedData);
      setIsCached(data.cached || false);
      setStatus(data.cached ? 'cached' : 'success');
      setError(null);

    } catch (err: any) {
      console.error('[useProductEnrichment] Error:', err);
      setError(err.message || 'Failed to enrich product');
      setStatus('error');
      setEnrichedData(null);
    }
  }, [productId, productUrl, status]);

  // Auto-enrich on mount if requested
  // useEffect(() => {
  //   if (autoEnrich && status === 'idle') {
  //     enrich();
  //   }
  // }, [autoEnrich, enrich, status]);

  return {
    enrichedData,
    status,
    error,
    enrich,
    isLoading: status === 'loading' || isWaitingForPrefetch,
    isCached,
  };
}
