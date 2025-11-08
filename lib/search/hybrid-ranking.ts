/**
 * Hybrid search result ranking and merging.
 * Combines semantic similarity and text relevance scores.
 */

import { Product } from '@/types/product';

export interface ScoredProduct extends Product {
  semanticScore?: number;
  textScore?: number;
  hybridScore: number;
}

export interface HybridRankingOptions {
  semanticWeight?: number; // Default: 0.6
  textWeight?: number; // Default: 0.4
  deduplicateBy?: 'product_group_id' | 'id'; // Default: 'product_group_id'
}

/**
 * Merge and rank semantic search and text search results.
 *
 * @param semanticResults - Products from vector similarity search with similarity scores
 * @param textResults - Products from text search (ILIKE matching)
 * @param options - Ranking configuration
 * @returns Merged, deduplicated, and ranked products
 *
 * @example
 * ```ts
 * const semantic = [{...product, similarity: 0.85}];
 * const text = [{...product, textMatch: true}];
 * const merged = mergeAndRankResults(semantic, text);
 * // Result: Products sorted by hybrid score
 * ```
 */
export function mergeAndRankResults(
  semanticResults: (Product & { similarity: number })[],
  textResults: Product[],
  options: HybridRankingOptions = {}
): ScoredProduct[] {
  const {
    semanticWeight = 0.6,
    textWeight = 0.4,
    deduplicateBy = 'product_group_id',
  } = options;

  // Validate weights sum to 1.0
  if (Math.abs(semanticWeight + textWeight - 1.0) > 0.01) {
    throw new Error('Semantic and text weights must sum to 1.0');
  }

  // Create maps for quick lookup
  const semanticMap = new Map<string, number>();
  semanticResults.forEach((product) => {
    const key = deduplicateBy === 'product_group_id'
      ? product.product_group_id || product.id
      : product.id;
    semanticMap.set(key, product.similarity);
  });

  const textSet = new Set<string>();
  textResults.forEach((product) => {
    const key = deduplicateBy === 'product_group_id'
      ? product.product_group_id || product.id
      : product.id;
    textSet.add(key);
  });

  // Collect all unique products
  const allProducts = new Map<string, Product>();

  // Add semantic results
  semanticResults.forEach((product) => {
    const key = deduplicateBy === 'product_group_id'
      ? product.product_group_id || product.id
      : product.id;
    allProducts.set(key, product);
  });

  // Add text results (won't overwrite semantic results)
  textResults.forEach((product) => {
    const key = deduplicateBy === 'product_group_id'
      ? product.product_group_id || product.id
      : product.id;
    if (!allProducts.has(key)) {
      allProducts.set(key, product);
    }
  });

  // Calculate hybrid scores
  const scoredProducts: ScoredProduct[] = [];

  allProducts.forEach((product, key) => {
    // Normalize scores to 0-1 range
    const semanticScore = semanticMap.get(key) || 0;
    const textScore = textSet.has(key) ? 1.0 : 0;

    // Calculate weighted hybrid score
    const hybridScore = (semanticScore * semanticWeight) + (textScore * textWeight);

    scoredProducts.push({
      ...product,
      semanticScore,
      textScore,
      hybridScore,
    });
  });

  // Sort by hybrid score (descending)
  scoredProducts.sort((a, b) => b.hybridScore - a.hybridScore);

  return scoredProducts;
}

/**
 * Normalize similarity scores to 0-1 range.
 * FashionCLIP similarities typically range from 0.05 to 0.25.
 *
 * @param similarity - Raw cosine similarity score
 * @param min - Minimum expected similarity (default: 0.05)
 * @param max - Maximum expected similarity (default: 0.25)
 * @returns Normalized score between 0 and 1
 */
export function normalizeSimilarity(
  similarity: number,
  min: number = 0.05,
  max: number = 0.25
): number {
  return Math.max(0, Math.min(1, (similarity - min) / (max - min)));
}

/**
 * Calibrate similarity threshold based on query type.
 *
 * @param query - Search query
 * @returns Recommended similarity threshold
 *
 * @example
 * ```ts
 * calibrateThreshold("black leather jacket") // 0.10 (visual query)
 * calibrateThreshold("Nike Air Force 1")     // 0.15 (specific product)
 * ```
 */
export function calibrateThreshold(query: string): number {
  const lowerQuery = query.toLowerCase();

  // Brand-specific queries need higher threshold (more precision)
  const brands = ['nike', 'adidas', 'gucci', 'prada', 'zara'];
  if (brands.some((brand) => lowerQuery.includes(brand))) {
    return 0.15; // Higher precision
  }

  // Generic visual queries can use lower threshold (more recall)
  return 0.10; // Balanced
}
