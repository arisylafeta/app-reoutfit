import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getProductRole } from '@/types/outfit-roles';
import type { Product } from '@/types/product';

const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB

export type SaveProductRequest = {
  product: Product;
};

export type SaveProductResponse = {
  wardrobeItemId: string;
  alreadyExists: boolean;
};

/**
 * POST /api/wardrobe/save-product
 * Save a single product to user's wardrobe
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Validate authentication
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Authentication required' },
        { status: 401 }
      );
    }

    // 2. Parse request body
    const body: SaveProductRequest = await request.json();
    const { product } = body;

    // 3. Validate input
    if (!product || !product.image_url || !product.name) {
      return NextResponse.json(
        { error: 'Invalid request', message: 'Product with image and name is required' },
        { status: 400 }
      );
    }

    // 4. Extract category and role
    const productMetadata = product.metadata as any;
    const productCategory = productMetadata?.category || 'other';
    const productRole = productMetadata?.role || getProductRole(productMetadata) || 'accessory';

    // 5. Check for duplicates by product URL
    let existingItem = null;
    const productUrl = product.product_url;

    if (productUrl) {
      const { data: itemByUrl } = await supabase
        .from('wardrobe_items')
        .select('id, category, role')
        .eq('user_id', user.id)
        .filter('metadata->>product_url', 'eq', productUrl)
        .maybeSingle();

      if (itemByUrl) {
        existingItem = itemByUrl;
      }
    }

    // If item already exists, return its ID
    if (existingItem) {
      const response: SaveProductResponse = {
        wardrobeItemId: existingItem.id,
        alreadyExists: true,
      };
      return NextResponse.json(response, { status: 200 });
    }

    // 6. Download external image and upload to storage
    let uploadedImageUrl = product.image_url;

    try {
      // Fetch the external image
      const imageResponse = await fetch(product.image_url);
      if (!imageResponse.ok) {
        throw new Error(`Failed to fetch image: ${imageResponse.status}`);
      }

      // Get the image buffer
      const imageBuffer = await imageResponse.arrayBuffer();

      // Check size
      if (imageBuffer.byteLength > MAX_IMAGE_SIZE) {
        return NextResponse.json(
          { error: 'File too large', message: 'Image size must be less than 10MB' },
          { status: 400 }
        );
      }

      // Determine file extension from content-type or URL
      const contentType = imageResponse.headers.get('content-type') || 'image/jpeg';
      const fileExt = contentType.split('/')[1] || 'jpg';

      // Generate unique filename
      const fileName = `${user.id}/${crypto.randomUUID()}.${fileExt}`;

      // Upload to Supabase Storage
      const { error: storageError } = await supabase.storage
        .from('clothing-images')
        .upload(fileName, imageBuffer, {
          contentType,
          cacheControl: '3600',
          upsert: false,
        });

      if (storageError) {
        console.error('Failed to upload image to storage:', storageError);
        // Fall back to using the original external URL
      } else {
        // Get public URL for the uploaded image
        const { data: { publicUrl } } = supabase.storage
          .from('clothing-images')
          .getPublicUrl(fileName);

        uploadedImageUrl = publicUrl;
      }
    } catch (imageError) {
      console.error('Error downloading/uploading image:', imageError);
      // Fall back to using the original external URL
    }

    // 7. Create new wardrobe item
    const metadata = {
      product_url: product.product_url,
      price: product.price,
      currency: product.currency,
      available: product.available,
      category: productCategory,
      role: productRole,
      ...productMetadata,
    };

    const { data: wardrobeItem, error: wardrobeError } = await supabase
      .from('wardrobe_items')
      .insert({
        user_id: user.id,
        name: product.name,
        brand: product.brand || 'Unknown',
        category: productCategory,
        role: productRole,
        image_url: uploadedImageUrl,
        source: 'search_result',
        metadata: metadata,
      })
      .select()
      .single();

    if (wardrobeError) {
      console.error('Failed to create wardrobe item:', wardrobeError);
      return NextResponse.json(
        { error: 'Save failed', message: 'Failed to save product to wardrobe' },
        { status: 500 }
      );
    }

    // 8. Return success response
    const response: SaveProductResponse = {
      wardrobeItemId: wardrobeItem.id,
      alreadyExists: false,
    };

    return NextResponse.json(response, { status: 201 });

  } catch (error: any) {
    console.error('Save product error:', error);
    return NextResponse.json(
      { error: 'Save failed', message: 'Failed to save product to wardrobe' },
      { status: 500 }
    );
  }
}
