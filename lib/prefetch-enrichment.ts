/**
 * Prefetch enrichment data for a product
 * This starts the API call immediately, allowing the data to be ready
 * when the product detail drawer opens
 */

import type { EnrichedProductData } from '@/types/enriched-product';

// Cache for in-flight requests to avoid duplicate calls
const inflightRequests = new Map<string, Promise<any>>();

// Cache for completed enrichment data
const enrichmentCache = new Map<string, {
  data: EnrichedProductData;
  cached: boolean;
  enrichedAt: string;
}>();

// Listeners for cache updates (for hooks to subscribe)
type CacheListener = (productUrl: string) => void;
const cacheListeners = new Set<CacheListener>();

/**
 * Subscribe to cache updates
 * Returns an unsubscribe function
 */
export function subscribeToCacheUpdates(listener: CacheListener): () => void {
  cacheListeners.add(listener);
  return () => cacheListeners.delete(listener);
}

/**
 * Notify all listeners that cache has been updated
 */
function notifyCacheUpdate(productUrl: string) {
  console.log('[PREFETCH] 📢 Notifying listeners of cache update', {
    productUrl,
    listenerCount: cacheListeners.size,
  });
  cacheListeners.forEach(listener => listener(productUrl));
}

export async function prefetchProductEnrichment(
  productId: string,
  productUrl: string
): Promise<void> {
  console.log('[PREFETCH] 🎯 Step 1: prefetchProductEnrichment called', {
    productId,
    productUrl,
  });

  if (!productUrl) {
    console.log('[PREFETCH] ⚠️ No productUrl provided, skipping');
    return;
  }

  // Check if data is already cached
  const cacheKey = productUrl;
  if (enrichmentCache.has(cacheKey)) {
    console.log('[PREFETCH] ✅ Step 2: Data already in cache, skipping fetch', {
      cachedData: enrichmentCache.get(cacheKey),
    });
    return; // Already have the data
  }

  // Check if request is already in-flight
  if (inflightRequests.has(cacheKey)) {
    console.log('[PREFETCH] ⏳ Step 2: Request already in-flight, waiting...');
    return inflightRequests.get(cacheKey);
  }

  console.log('[PREFETCH] 🚀 Step 2: Starting new fetch request');

  // Start the request
  const requestPromise = fetch('/api/products/enrich', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      productId,
      productUrl,
    }),
    credentials: 'include',
  })
    .then(response => {
      console.log('[PREFETCH] 📥 Step 3: Received response', {
        status: response.status,
        ok: response.ok,
      });
      return response.json();
    })
    .then(data => {
      console.log('[PREFETCH] 📦 Step 4: Parsed response data', {
        hasEnrichedData: !!data.enrichedData,
        cached: data.cached,
        data,
      });

      // Store the enriched data in cache
      if (data.enrichedData) {
        enrichmentCache.set(cacheKey, {
          data: data.enrichedData,
          cached: data.cached || false,
          enrichedAt: data.enrichedAt,
        });
        console.log('[PREFETCH] ✅ Step 5: Data stored in cache', {
          cacheKey,
          cacheSize: enrichmentCache.size,
        });
        
        // Notify listeners that new data is available
        notifyCacheUpdate(cacheKey);
      } else {
        console.log('[PREFETCH] ⚠️ Step 5: No enrichedData in response, not caching');
      }
      return data;
    })
    .catch(error => {
      console.error('[PREFETCH] ❌ Step 3/4: Error during fetch', error);
    })
    .finally(() => {
      // Clean up in-flight request after completion
      inflightRequests.delete(cacheKey);
      console.log('[PREFETCH] 🧹 Step 6: Cleaned up in-flight request');
    });

  // Store in-flight request
  inflightRequests.set(cacheKey, requestPromise);
  console.log('[PREFETCH] 📝 Step 2b: Stored in-flight request');

  return requestPromise;
}

/**
 * Get cached enrichment data if available
 */
export function getCachedEnrichment(productUrl: string) {
  return enrichmentCache.get(productUrl);
}

/**
 * Clear enrichment cache (useful for testing or manual refresh)
 */
export function clearEnrichmentCache(productUrl?: string) {
  if (productUrl) {
    enrichmentCache.delete(productUrl);
  } else {
    enrichmentCache.clear();
  }
}
