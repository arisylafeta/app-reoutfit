import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { Product } from '@/types/product';
import {
  mergeAndRankResults,
  calibrateThreshold
} from '@/lib/search/hybrid-ranking';

const AGENT_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

interface SemanticProduct extends Product {
  similarity: number;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;

  // Parse parameters
  const query = searchParams.get('query') || searchParams.get('search') || '';
  const limit = parseInt(searchParams.get('limit') || '50');
  const offset = parseInt(searchParams.get('offset') || '0');
  const available = searchParams.get('available') !== 'false';

  // Filter parameters (multi-select)
  const categoriesParam = searchParams.get('categories') || searchParams.get('category');
  const categories = categoriesParam ? categoriesParam.split(',').filter(Boolean) : null;

  const brandsParam = searchParams.get('brands') || searchParams.get('brand');
  const brands = brandsParam ? brandsParam.split(',').filter(Boolean) : null;

  const gendersParam = searchParams.get('genders') || searchParams.get('gender');
  const genders = gendersParam ? gendersParam.split(',').filter(Boolean) : null;

  // Price range
  const minPrice = searchParams.get('minPrice');
  const maxPrice = searchParams.get('maxPrice');

  try {
    const supabase = await createClient();

    // If no query, fall back to regular filtered search
    if (!query.trim()) {
      const { data: products, error } = await supabase.rpc('get_distinct_products', {
        p_available: available,
        p_categories: categories?.length ? categories : null,
        p_brands: brands?.length ? brands : null,
        p_genders: genders?.length ? genders : null,
        p_search: null,
        p_min_price: minPrice ? parseFloat(minPrice) : null,
        p_max_price: maxPrice ? parseFloat(maxPrice) : null,
        p_limit: limit,
        p_offset: offset,
      });

      if (error) throw error;

      return NextResponse.json({
        products: products || [],
        total: products?.length || 0,
        hasMore: (products?.length || 0) === limit,
        offset,
        limit,
        searchType: 'filter-only',
      });
    }

    // Step 1: Get filtered product_group_ids (search space)
    console.log('[Search] Getting filtered product IDs...');
    const { data: productGroupIds, error: filterError } = await supabase.rpc(
      'get_filtered_product_group_ids',
      {
        p_available: available,
        p_categories: categories?.length ? categories : null,
        p_brands: brands?.length ? brands : null,
        p_genders: genders?.length ? genders : null,
        p_min_price: minPrice ? parseFloat(minPrice) : null,
        p_max_price: maxPrice ? parseFloat(maxPrice) : null,
      }
    );

    if (filterError) throw filterError;

    // If no products match filters, return early
    if (!productGroupIds || productGroupIds.length === 0) {
      return NextResponse.json({
        products: [],
        total: 0,
        hasMore: false,
        offset,
        limit,
        searchType: 'hybrid',
        message: 'No products match the selected filters',
      });
    }

    console.log(`[Search] Filtered to ${productGroupIds.length} product groups`);

    // Step 2: Generate query embedding (parallel with text search)
    console.log('[Search] Generating embedding...');
    const embeddingPromise = fetch(`${AGENT_URL}/embed/text`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    }).then((res) => {
      if (!res.ok) throw new Error('Embedding generation failed');
      return res.json();
    });

    // Step 3: Text search on filtered set (parallel)
    console.log('[Search] Running text search...');
    const textSearchPromise = supabase.rpc('get_distinct_products', {
      p_available: available,
      p_categories: categories?.length ? categories : null,
      p_brands: brands?.length ? brands : null,
      p_genders: genders?.length ? genders : null,
      p_search: query,
      p_min_price: minPrice ? parseFloat(minPrice) : null,
      p_max_price: maxPrice ? parseFloat(maxPrice) : null,
      p_limit: Math.min(limit * 2, 100), // Get more candidates for merging
      p_offset: 0,
    });

    // Wait for both to complete
    const [embeddingResult, textSearchResult] = await Promise.all([
      embeddingPromise,
      textSearchPromise,
    ]);

    const { embedding } = embeddingResult;
    const { data: textResults, error: textError } = textSearchResult;

    if (textError) throw textError;

    // Step 4: Semantic search on filtered set
    console.log('[Search] Running semantic search...');
    const threshold = calibrateThreshold(query);

    const { data: semanticResults, error: semanticError } = await supabase.rpc(
      'search_products_by_embedding',
      {
        query_embedding: embedding,
        product_group_ids: productGroupIds,
        similarity_threshold: threshold,
        p_limit: Math.min(limit * 2, 100), // Get more candidates for merging
        p_offset: 0,
      }
    );

    if (semanticError) throw semanticError;

    console.log(`[Search] Semantic: ${semanticResults?.length || 0}, Text: ${textResults?.length || 0}`);

    // Step 5: Merge and rank results
    const mergedResults = mergeAndRankResults(
      (semanticResults || []) as SemanticProduct[],
      textResults || [],
      {
        semanticWeight: 0.6,
        textWeight: 0.4,
        deduplicateBy: 'product_group_id',
      }
    );

    // Step 6: Apply pagination to merged results
    const paginatedResults = mergedResults.slice(offset, offset + limit);

    console.log(`[Search] Returning ${paginatedResults.length} hybrid results`);

    return NextResponse.json({
      products: paginatedResults,
      total: mergedResults.length,
      hasMore: mergedResults.length > offset + limit,
      offset,
      limit,
      searchType: 'hybrid',
      breakdown: {
        semanticCount: semanticResults?.length || 0,
        textCount: textResults?.length || 0,
        mergedCount: mergedResults.length,
        threshold,
      },
    });
  } catch (error) {
    console.error('Search error:', error);

    // Fallback to text-only search on error
    try {
      const supabase = await createClient();
      const { data: products, error: fallbackError } = await supabase.rpc(
        'get_distinct_products',
        {
          p_available: available,
          p_categories: categories?.length ? categories : null,
          p_brands: brands?.length ? brands : null,
          p_genders: genders?.length ? genders : null,
          p_search: query,
          p_min_price: minPrice ? parseFloat(minPrice) : null,
          p_max_price: maxPrice ? parseFloat(maxPrice) : null,
          p_limit: limit,
          p_offset: offset,
        }
      );

      if (fallbackError) throw fallbackError;

      return NextResponse.json({
        products: products || [],
        total: products?.length || 0,
        hasMore: (products?.length || 0) === limit,
        offset,
        limit,
        searchType: 'text-fallback',
        warning: 'Semantic search unavailable, using text search',
      });
    } catch (fallbackError) {
      console.error('Fallback search failed:', fallbackError);
      return NextResponse.json(
        {
          error: 'Search failed',
          code: 'SEARCH_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
        { status: 500 }
      );
    }
  }
}
