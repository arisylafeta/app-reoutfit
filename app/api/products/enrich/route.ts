import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getUserCredits, deductCredits, InsufficientCreditsError } from '@/lib/db/credits';

/**
 * POST /api/products/enrich
 * 
 * Enriches product data using Firecrawl API
 * Implements caching to minimize API costs
 */
export async function POST(request: NextRequest) {
  try {
    const { productId, productUrl } = await request.json();

    if (!productUrl) {
      return NextResponse.json(
        { error: 'Product URL is required' },
        { status: 400 }
      );
    }

    // Check if Firecrawl API key is configured
    const firecrawlApiKey = process.env.FIRECRAWL_API_KEY;
    if (!firecrawlApiKey) {
      return NextResponse.json(
        { error: 'Firecrawl API key not configured' },
        { status: 500 }
      );
    }

    const supabase = await createClient();

    // Run auth and cache check in parallel for speed
    const [authResult, cacheResult] = await Promise.all([
      supabase.auth.getUser(),
      supabase
        .from('enriched_products')
        .select('enriched_data, enriched_at')
        .eq('product_url', productUrl)
        .gt('expires_at', new Date().toISOString())
        .single()
    ]);

    const { data: { user }, error: authError } = authResult;
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Credit check (2 credits for enrichment, regardless of cache)
    const COST = 2;
    try {
      const balance = await getUserCredits(user.id);
      if (balance < COST) {
        return NextResponse.json(
          {
            error: 'Insufficient credits',
            required: COST,
            available: balance,
          },
          { status: 402 }
        );
      }

      // Deduct credits (even if we return cached data)
      await deductCredits(user.id, COST, 'enrich-product');
    } catch (error) {
      if (error instanceof InsufficientCreditsError) {
        return NextResponse.json(
          {
            error: 'Insufficient credits',
            required: error.required,
            available: error.available,
          },
          { status: 402 }
        );
      }
      throw error;
    }

    const { data: cachedData, error: cacheError } = cacheResult;

    if (cachedData && !cacheError) {
      console.log('[Enrich] Cache hit for:', productUrl);
      return NextResponse.json({
        enrichedData: cachedData.enriched_data,
        cached: true,
        enrichedAt: cachedData.enriched_at,
      });
    }

    console.log('[Enrich] Cache miss, fetching from Firecrawl:', productUrl);

    // Call Firecrawl API
    const firecrawlResponse = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${firecrawlApiKey}`,
      },
      body: JSON.stringify({
        url: productUrl,
        formats: ['extract'],
        timeout: 15000, // 15s timeout for faster failures
        extract: {
          prompt: `Extract the following information from this product page:
1. Current price (as a number, null if not available)
2. Currency code (USD, EUR, GBP, etc.)
3. A concise 2-3 sentence summary of the product description
4. Materials and fabric composition summary
5. Sizing information and fit details
6. A summary of customer reviews highlighting key pros and cons

Return as JSON with keys: price, currency, description_summary, materials_summary, sizing_info, reviews_summary`,
          schema: {
            type: 'object',
            properties: {
              price: { type: ['number', 'null'] },
              currency: { type: ['string', 'null'] },
              description_summary: { type: ['string', 'null'] },
              materials_summary: { type: ['string', 'null'] },
              sizing_info: { type: ['string', 'null'] },
              reviews_summary: { type: ['string', 'null'] },
            },
          },
        },
      }),
    });

    if (!firecrawlResponse.ok) {
      const errorData = await firecrawlResponse.json().catch(() => ({}));
      console.error('[Enrich] Firecrawl API error:', errorData);
      return NextResponse.json(
        { error: 'Failed to enrich product data', details: errorData },
        { status: firecrawlResponse.status }
      );
    }

    const firecrawlData = await firecrawlResponse.json();
    const enrichedData = firecrawlData.data?.extract || firecrawlData.data;

    // Validate enriched data
    if (!enrichedData) {
      console.error('[Enrich] Invalid response from Firecrawl:', enrichedData);
      return NextResponse.json(
        { error: 'Invalid enrichment data received' },
        { status: 500 }
      );
    }

    // Return response immediately, cache in background
    const now = new Date().toISOString();
    const response = NextResponse.json({
      enrichedData,
      cached: false,
      enrichedAt: now,
    });

    // Cache asynchronously (don't await)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);
    
    supabase
      .from('enriched_products')
      .upsert({
        product_id: productId,
        product_url: productUrl,
        enriched_data: enrichedData,
        enriched_at: now,
        expires_at: expiresAt.toISOString(),
        user_id: user.id,
      }, {
        onConflict: 'product_url',
      })
      .then(({ error }) => {
        if (error) {
          console.error('[Enrich] Failed to cache enriched data:', error);
        }
      });

    return response;

  } catch (error: any) {
    console.error('[Enrich] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    );
  }
}
