import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!id) {
    return NextResponse.json(
      { error: 'Product ID is required', code: 'INVALID_PARAMS' },
      { status: 400 }
    );
  }

  try {
    const supabase = await createClient();

    // Get the main product
    const { data: product, error: productError } = await supabase
      .from('affiliate_products')
      .select(`
        *,
        partner:affiliate_partners(name, website_url)
      `)
      .eq('id', id)
      .single();

    if (productError || !product) {
      console.error('Product not found:', productError);
      return NextResponse.json(
        { error: 'Product not found', code: 'NOT_FOUND' },
        { status: 404 }
      );
    }

    // Get the base product name (without size/color indicators)
    const baseName = product.name
      .replace(/\s*-\s*(UK\s*)?\d+\s*$/, '')  // Remove "- UK 12" or "- 12"
      .replace(/\s*-\s*Size\s+[A-Z0-9]+\s*$/i, '')  // Remove "- Size M"
      .replace(/\s*-\s*[XS|S|M|L|XL|XXL|XXXL]+\s*$/i, '')  // Remove "- XL"
      .trim();

    console.log('[API /products/:id] Product:', product.id);
    console.log('[API /products/:id] Base name:', baseName);
    console.log('[API /products/:id] Partner ID:', product.partner_id);

    // Get all variants with the same base name from the same merchant
    // Use exact name match since all variants have identical names
    const { data: allVariants, error: variantsError } = await supabase
      .from('affiliate_products')
      .select('id, name, size, colors, price, currency, product_url, image_url, available, product_group_id')
      .eq('partner_id', product.partner_id)
      .eq('available', true)
      .eq('name', product.name);  // Exact match since names are identical

    console.log('[API /products/:id] Found variants:', allVariants?.length);
    console.log('[API /products/:id] Variants:', allVariants?.map(v => ({
      id: v.id,
      size: v.size,
      colors: v.colors,
      product_group_id: v.product_group_id
    })));

    if (variantsError) {
      console.error('Error fetching variants:', variantsError);
    }

    // Group variants by color
    const colorVariants = new Map<string, any[]>();
    
    allVariants?.forEach(variant => {
      // Use first color from colors array, or 'Default'
      const color = (variant.colors && variant.colors.length > 0) ? variant.colors[0] : 'Default';
      if (!colorVariants.has(color)) {
        colorVariants.set(color, []);
      }
      colorVariants.get(color)!.push(variant);
    });

    // Format color variants with available sizes
    const formattedColorVariants = Array.from(colorVariants.entries()).map(([color, variants]) => {
      // Sort sizes
      const sizes = variants
        .map(v => v.size)
        .filter(Boolean)
        .sort((a, b) => {
          // Try to sort numerically if possible
          const numA = parseInt(a);
          const numB = parseInt(b);
          if (!isNaN(numA) && !isNaN(numB)) {
            return numA - numB;
          }
          return a.localeCompare(b);
        });

      return {
        color,
        image_url: variants[0].image_url,
        product_group_id: variants[0].product_group_id,
        available_sizes: sizes,
        variants: variants.map(v => ({
          id: v.id,
          size: v.size,
          price: v.price,
          currency: v.currency,
          product_url: v.product_url,
          available: v.available,
        })),
      };
    });

    // Get all unique sizes across all colors
    const allSizes = [...new Set(
      allVariants
        ?.map(v => v.size)
        .filter(Boolean) || []
    )].sort((a, b) => {
      const numA = parseInt(a);
      const numB = parseInt(b);
      if (!isNaN(numA) && !isNaN(numB)) {
        return numA - numB;
      }
      return a.localeCompare(b);
    });

    // Get all unique colors
    const allColors = [...new Set(
      allVariants
        ?.flatMap(v => v.colors || [])
        .filter(Boolean) || []
    )];

    return NextResponse.json({
      product: {
        ...product,
        partner_name: product.partner?.name,
        partner_website: product.partner?.website_url,
      },
      variants: {
        colors: formattedColorVariants,
        all_sizes: allSizes,
        all_colors: allColors,
        total_variants: allVariants?.length || 0,
      },
    });
  } catch (error) {
    console.error('Error fetching product details:', error);
    return NextResponse.json(
      { error: 'Failed to fetch product details', code: 'DATABASE_ERROR' },
      { status: 500 }
    );
  }
}
