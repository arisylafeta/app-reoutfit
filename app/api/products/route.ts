import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
  const offset = parseInt(searchParams.get('offset') || '0');
  const available = searchParams.get('available') !== 'false';

  // Filter parameters - support both single values and comma-separated arrays
  const categoriesParam = searchParams.get('categories') || searchParams.get('category');
  const categories = categoriesParam ? categoriesParam.split(',').filter(Boolean) : null;

  const brandsParam = searchParams.get('brands') || searchParams.get('brand');
  const brands = brandsParam ? brandsParam.split(',').filter(Boolean) : null;

  const gendersParam = searchParams.get('genders') || searchParams.get('gender');
  const genders = gendersParam ? gendersParam.split(',').filter(Boolean) : null;

  const search = searchParams.get('search');
  const minPrice = searchParams.get('minPrice');
  const maxPrice = searchParams.get('maxPrice');

  // Validate parameters
  if (limit < 1 || limit > 100) {
    return NextResponse.json(
      { error: 'Limit must be between 1 and 100', code: 'INVALID_PARAMS' },
      { status: 400 }
    );
  }

  if (offset < 0) {
    return NextResponse.json(
      { error: 'Offset must be non-negative', code: 'INVALID_PARAMS' },
      { status: 400 }
    );
  }

  try {
    const supabase = await createClient();

    // Use RPC function to get distinct products at database level
    const { data: products, error } = await supabase.rpc('get_distinct_products', {
      p_available: available,
      p_categories: categories?.length ? categories : null,
      p_brands: brands?.length ? brands : null,
      p_genders: genders?.length ? genders : null,
      p_search: search || null,
      p_min_price: minPrice ? parseFloat(minPrice) : null,
      p_max_price: maxPrice ? parseFloat(maxPrice) : null,
      p_limit: limit,
      p_offset: offset
    });

    if (error) {
      console.error('Supabase RPC error:', error);
      throw error;
    }

    // Fetch partner information and variants for each product
    const productsWithVariants = await Promise.all(
      (products || []).map(async (product: any) => {
        // Get partner info
        const { data: partner } = await supabase
          .from('affiliate_partners')
          .select('name, website_url')
          .eq('id', product.partner_id)
          .single();

        if (!product.product_group_id) {
          return {
            ...product,
            partner_name: partner?.name,
            partner_website: partner?.website_url,
            available_sizes: product.size ? [product.size] : [],
            variant_count: 1,
          };
        }

        // Get all variants for this product group
        const { data: variants } = await supabase
          .from('affiliate_products')
          .select('id, size, available, price')
          .eq('product_group_id', product.product_group_id)
          .eq('available', true);

        const availableSizes = variants
          ?.filter(v => v.size)
          .map(v => v.size)
          .sort() || [];

        return {
          ...product,
          partner_name: partner?.name,
          partner_website: partner?.website_url,
          available_sizes: availableSizes,
          variant_count: variants?.length || 1,
        };
      })
    );

    return NextResponse.json({
      products: productsWithVariants,
      total: products?.length || 0,
      hasMore: products?.length === limit,
      offset,
      limit,
    });
  } catch (error) {
    console.error('Error fetching products:', error);
    return NextResponse.json(
      { error: 'Failed to fetch products', code: 'DATABASE_ERROR' },
      { status: 500 }
    );
  }
}
