import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getUserCredits, deductCredits, InsufficientCreditsError } from '@/lib/db/credits';

export async function POST(request: NextRequest) {
  try {
    const { page_token } = await request.json();
    
    if (!page_token) {
      return NextResponse.json(
        { error: 'page_token is required' },
        { status: 400 }
      );
    }

    const apiKey = process.env.SERPAPI_API_KEY;
    if (!apiKey) {
      console.error('SERPAPI_API_KEY not configured');
      return NextResponse.json(
        { error: 'SERPAPI_API_KEY not configured' },
        { status: 500 }
      );
    }

    // Authenticate user
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Credit check and deduction (1 credit for immersive product data)
    const COST = 1;
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

      // Deduct credits BEFORE making the API call
      await deductCredits(user.id, COST, 'immersive-product');
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

    // Call SerpAPI Immersive Product endpoint
    const url = `https://serpapi.com/search.json?engine=google_immersive_product&page_token=${encodeURIComponent(page_token)}&api_key=${apiKey}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('SerpAPI error:', response.status, errorText);
      throw new Error(`SerpAPI returned ${response.status}`);
    }

    const data = await response.json();
    
    // Return the product_results section which contains all the detailed info
    return NextResponse.json({
      success: true,
      data: data.product_results || null,
      search_metadata: data.search_metadata,
    });

  } catch (error: any) {
    console.error('Immersive product API error:', error);
    return NextResponse.json(
      { 
        success: false,
        error: error.message || 'Failed to fetch immersive product data' 
      },
      { status: 500 }
    );
  }
}
