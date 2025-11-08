import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const available = searchParams.get('available') !== 'false';

  try {
    const supabase = await createClient();

    // Call RPC function to get dynamic filter options
    const { data, error } = await supabase.rpc('get_product_filter_options', {
      p_available: available,
    });

    if (error) {
      console.error('Supabase RPC error:', error);
      throw error;
    }

    // Ensure arrays are never null (SQL jsonb_agg returns null for empty results)
    const result = {
      categories: data?.categories || [],
      brands: data?.brands || [],
      genders: data?.genders || [],
      price_range: data?.price_range || { min: 0, max: 0 }
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching filter options:', error);
    return NextResponse.json(
      { error: 'Failed to fetch filter options', code: 'DATABASE_ERROR' },
      { status: 500 }
    );
  }
}
