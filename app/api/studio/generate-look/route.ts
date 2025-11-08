import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { GoogleGenAI } from '@google/genai';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import { uploadImagesToGemini, type UploadedFile } from '@/lib/gemini-files';
import { getUserCredits, deductCredits, InsufficientCreditsError } from '@/lib/db/credits';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GENERATION_TIMEOUT_MS = 30000; // 30 seconds
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const DEBUG_LOGS_DIR = join(process.cwd(), 'debug-logs', 'studio-generation');
const USE_FILES_API = process.env.GEMINI_USE_FILES_API === 'true'; // Enable Files API via env var

/**
 * Helper function to save debug logs (images + prompt) to disk
 */
async function saveDebugLogs(
  avatarBase64: string,
  avatarMimeType: string,
  productImages: Array<{ base64: string; mimeType: string }>,
  promptText: string
) {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const logDir = join(DEBUG_LOGS_DIR, timestamp);

    // Create directory if it doesn't exist
    if (!existsSync(logDir)) {
      await mkdir(logDir, { recursive: true });
    }

    // Save avatar image
    const avatarExt = avatarMimeType.split('/')[1];
    await writeFile(
      join(logDir, `avatar.${avatarExt}`),
      Buffer.from(avatarBase64, 'base64')
    );

    // Save product images (labeled 1, 2, 3, etc.)
    for (let i = 0; i < productImages.length; i++) {
      const productExt = productImages[i].mimeType.split('/')[1];
      await writeFile(
        join(logDir, `${i + 1}.${productExt}`),
        Buffer.from(productImages[i].base64, 'base64')
      );
    }

    // Save prompt text
    await writeFile(
      join(logDir, 'prompt.txt'),
      promptText,
      'utf-8'
    );

    console.log(`✅ Debug logs saved to: ${logDir}`);
  } catch (error) {
    console.error('❌ Failed to save debug logs:', error);
  }
}

/**
 * Helper function to fetch image from URL and convert to base64
 */
async function fetchImageAsBase64(url: string): Promise<{ base64: string; mimeType: string }> {
  const response = await fetch(url);
  
  if (!response.ok) {
    throw new Error(`Failed to fetch image from ${url}: ${response.statusText}`);
  }

  const contentType = response.headers.get('content-type');
  if (!contentType || !ALLOWED_MIME_TYPES.includes(contentType)) {
    throw new Error(`Invalid image type from ${url}. Expected JPEG, PNG, or WebP.`);
  }

  const arrayBuffer = await response.arrayBuffer();
  
  if (arrayBuffer.byteLength > MAX_FILE_SIZE) {
    throw new Error(`Image from ${url} exceeds 10MB size limit`);
  }

  const base64 = Buffer.from(arrayBuffer).toString('base64');
  
  return { base64, mimeType: contentType };
}

/**
 * POST /api/studio/generate-look
 * Generate AI-powered virtual try-on image using Gemini 2.5 Flash Image
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();

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

    // Credit check (3 credits for look generation)
    const COST = 3;
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

      // Deduct credits BEFORE expensive operation
      await deductCredits(user.id, COST, 'generate-look');
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

    // 2. Parse JSON body
    const body = await request.json();
    const { avatarUrl, productUrls, products, isAvatar } = body;

    // Support two formats:
    // 1. Legacy: { avatarUrl, productUrls: string[] }
    // 2. New: { avatarUrl, products: Array<{ url: string, category?: string, role?: string }>, isAvatar?: boolean }
    const productsList = products || productUrls?.map((url: string) => ({ url })) || [];
    const isActualAvatar = isAvatar ?? true; // Default to true if not specified

    // 3. Validate inputs
    if (!avatarUrl || typeof avatarUrl !== 'string') {
      return NextResponse.json(
        { error: 'Invalid request', message: 'Avatar image URL is required' },
        { status: 400 }
      );
    }

    if (!Array.isArray(productsList) || productsList.length === 0) {
      return NextResponse.json(
        { error: 'Invalid request', message: 'At least 1 product image required' },
        { status: 400 }
      );
    }

    if (productsList.length > 6) {
      return NextResponse.json(
        { error: 'Invalid request', message: 'Maximum 6 product images allowed' },
        { status: 400 }
      );
    }

    // 4. Check Gemini API key
    if (!GEMINI_API_KEY) {
      console.error('GEMINI_API_KEY not configured');
      return NextResponse.json(
        { error: 'Configuration error', message: 'AI service not configured' },
        { status: 500 }
      );
    }

    // 5. Fetch images from URLs (server-side to avoid CORS)
    let avatarBase64: string;
    let avatarMimeType: string;
    
    try {
      const avatarData = await fetchImageAsBase64(avatarUrl);
      avatarBase64 = avatarData.base64;
      avatarMimeType = avatarData.mimeType;
    } catch (error: any) {
      console.error('Failed to fetch avatar image:', error);
      return NextResponse.json(
        { error: 'Invalid avatar', message: `Failed to load avatar image: ${error.message}` },
        { status: 400 }
      );
    }

    // 6. Fetch product images with metadata
    const productImages: Array<{ base64: string; mimeType: string; role?: string; category?: string }> = [];
    const failedProducts: number[] = [];

    for (let i = 0; i < productsList.length; i++) {
      try {
        const product = productsList[i];
        const productUrl = typeof product === 'string' ? product : product.url;
        const productData = await fetchImageAsBase64(productUrl);

        productImages.push({
          ...productData,
          role: typeof product === 'object' ? product.role : undefined,
          category: typeof product === 'object' ? product.category : undefined,
        });
      } catch (error: any) {
        console.error(`Failed to fetch product image ${i}:`, error);
        failedProducts.push(i + 1);
      }
    }

    // Check if at least one product image loaded successfully
    if (productImages.length === 0) {
      return NextResponse.json(
        { 
          error: 'Failed to load images', 
          message: `Could not load any product images. Please check the image URLs and try again.` 
        },
        { status: 400 }
      );
    }

    // Warn if some products failed but continue with successful ones
    if (failedProducts.length > 0) {
      console.warn(`Failed to load ${failedProducts.length} product image(s): ${failedProducts.join(', ')}`);
    }

    // 7. Prepare Gemini API request
    const genAI = new GoogleGenAI({
      apiKey: GEMINI_API_KEY || '',
    });

    // 7a. Optionally upload images to Files API for better reliability
    let uploadedFiles: UploadedFile[] | null = null;

    if (USE_FILES_API) {
      console.log('📤 Uploading images to Gemini Files API...');
      try {
        const imagesToUpload = [
          ...productImages.map((img, idx) => ({
            base64: img.base64,
            mimeType: img.mimeType,
            role: img.role || img.category || `product-${idx + 1}`,
            displayName: img.role || img.category || `Product ${idx + 1}`,
          })),
          {
            base64: avatarBase64,
            mimeType: avatarMimeType,
            role: 'avatar',
            displayName: 'Avatar',
          },
        ];

        uploadedFiles = await uploadImagesToGemini(imagesToUpload);
        console.log(`✅ Uploaded ${uploadedFiles.length} images to Files API`);
      } catch (error: any) {
        console.error('⚠️ Files API upload failed, falling back to inline data:', error.message);
        uploadedFiles = null;
      }
    }

    // 7b. Build labeled clothing list for prompt
    const labeledItems: string[] = [];
    productImages.forEach((img, idx) => {
      const label = img.role || img.category || `Clothing item ${idx + 1}`;
      labeledItems.push(label);
    });

    // Construct prompt - optimized for virtual try-on quality with labeled images
    // Different prompts based on whether we're using an actual avatar or a previous look
    const promptText = isActualAvatar
      ? `You are an expert virtual fashion stylist performing a precise virtual try-on task.

INPUT IMAGES (in order):
${labeledItems.map((label, idx) => `${idx + 1}. ${label.toUpperCase()}`).join('\n')}
${labeledItems.length + 1}. AVATAR (the person to dress)

TASK:
Create a photorealistic image showing the person in image ${labeledItems.length + 1} (the avatar) wearing ALL the clothing items from images 1-${labeledItems.length}.

CRITICAL REQUIREMENTS:
1. PRESERVE THE PERSON: Keep the avatar's exact face, facial features, skin tone, hair, body proportions, and pose UNCHANGED
2. CLOTHING ACCURACY: Dress the person in the exact clothing items shown - maintain their original style, color, pattern, and design details
3. NATURAL FIT: Make the clothing fit naturally on the person's body shape
4. LAYERING: If multiple items are provided, layer them appropriately (e.g., shirts under jackets, accessories on top)
5. LIGHTING & REALISM: Match the lighting and environment of the avatar image - ensure realistic shadows, fabric draping, and wrinkles
6. BACKGROUND: Keep the original background from the avatar image
7. QUALITY: Output must be photorealistic with high detail - no cartoon/anime style
8. DIMENSIONS: Match the exact aspect ratio and dimensions of the avatar image

OUTPUT: A single photorealistic image of the person wearing the specified clothing items.`
      : `You are an expert virtual fashion stylist performing a clothing replacement and outfit remix task.

INPUT IMAGES (in order):
${labeledItems.map((label, idx) => `${idx + 1}. ${label.toUpperCase()}`).join('\n')}
${labeledItems.length + 1}. REFERENCE LOOK (existing outfit to modify)

TASK:
Create a photorealistic image showing the person from image ${labeledItems.length + 1} wearing the NEW clothing items from images 1-${labeledItems.length}, REPLACING the clothes they're currently wearing.

CRITICAL REQUIREMENTS:
1. PRESERVE THE PERSON: Keep the person's exact face, facial features, skin tone, hair, body proportions, and pose UNCHANGED
2. REPLACE CLOTHING: Remove the existing clothes from the reference look and dress the person in the NEW clothing items from images 1-${labeledItems.length}
3. CLOTHING ACCURACY: Use the exact clothing items shown in images 1-${labeledItems.length} - maintain their original style, color, pattern, and design details
4. NATURAL FIT: Make the new clothing fit naturally on the person's body shape
5. LAYERING: If multiple new items are provided, layer them appropriately (e.g., shirts under jackets, accessories on top)
6. LIGHTING & REALISM: Match the lighting and environment of the reference look - ensure realistic shadows, fabric draping, and wrinkles
7. BACKGROUND: Keep the original background from the reference look
8. QUALITY: Output must be photorealistic with high detail - no cartoon/anime style
9. DIMENSIONS: Match the exact aspect ratio and dimensions of the reference look

OUTPUT: A single photorealistic image of the person wearing the NEW clothing items, with their original outfit replaced.`;

    // 7c. Prepare prompt parts using Files API URIs or inline data
    let promptParts: any[];

    if (uploadedFiles && uploadedFiles.length > 0) {
      // Use Files API URIs
      console.log('📝 Using Files API URIs in prompt');
      promptParts = [
        { text: promptText },
        ...uploadedFiles.map((file) => ({
          fileData: {
            mimeType: file.mimeType,
            fileUri: file.uri,
          },
        })),
      ];
    } else {
      // Use inline base64 data
      console.log('📝 Using inline base64 data in prompt');
      promptParts = [
        { text: promptText },
        ...productImages.map((product) => ({
          inlineData: {
            mimeType: product.mimeType,
            data: product.base64,
          },
        })),
        {
          inlineData: {
            mimeType: avatarMimeType,
            data: avatarBase64,
          },
        },
      ];
    }

    console.log('Generated prompt with', promptParts.length, 'parts');

    // Save debug logs (images + prompt) to disk
    await saveDebugLogs(avatarBase64, avatarMimeType, productImages, promptText);

    // 8. Call Gemini API with timeout
    const generationPromise = genAI.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: promptParts,
    });
    
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Generation timeout')), GENERATION_TIMEOUT_MS);
    });

    const result = await Promise.race([generationPromise, timeoutPromise]) as any;

    // Enhanced error handling and response validation
    if (!result) {
      console.error('❌ No response from Gemini API');
      throw new Error('No response from Gemini API');
    }

    // Log full response structure for debugging
    console.log('📋 Gemini API Response Structure:', JSON.stringify({
      hasCandidates: !!result.candidates,
      candidatesLength: result.candidates?.length,
      firstCandidateExists: !!result.candidates?.[0],
      hasContent: !!result.candidates?.[0]?.content,
      hasParts: !!result.candidates?.[0]?.content?.parts,
      partsLength: result.candidates?.[0]?.content?.parts?.length,
      partTypes: result.candidates?.[0]?.content?.parts?.map((p: any) =>
        Object.keys(p).join(',')
      ),
      finishReason: result.candidates?.[0]?.finishReason,
      safetyRatings: result.candidates?.[0]?.safetyRatings,
    }, null, 2));

    // Check for API errors
    if (result.error) {
      console.error('❌ Gemini API returned error:', result.error);
      throw new Error(`Gemini API error: ${JSON.stringify(result.error)}`);
    }

    // Check for safety blocks
    if (result.candidates?.[0]?.finishReason === 'SAFETY') {
      console.error('❌ Content blocked by safety filters:', result.candidates[0].safetyRatings);
      throw new Error('Content generation blocked by safety filters');
    }

    // Extract the generated image from response
    let generatedImageDataUrl = `data:${avatarMimeType};base64,${avatarBase64}`; // Fallback to avatar
    let imageFound = false;

    if (result.candidates && result.candidates[0]?.content?.parts) {
      const parts = result.candidates[0].content.parts;
      console.log(`🔍 Checking ${parts.length} parts for inline image data...`);

      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        console.log(`  Part ${i + 1}:`, {
          hasInlineData: !!part.inlineData,
          hasText: !!part.text,
          keys: Object.keys(part),
        });

        if (part.inlineData) {
          const generatedImageData = part.inlineData.data;
          const mimeType = part.inlineData.mimeType || avatarMimeType;

          if (generatedImageData) {
            generatedImageDataUrl = `data:${mimeType};base64,${generatedImageData}`;
            imageFound = true;
            console.log(`✅ Successfully extracted generated image from part ${i + 1}`);
            console.log(`   MIME type: ${mimeType}`);
            console.log(`   Data length: ${generatedImageData.length} characters`);
            break;
          } else {
            console.warn(`⚠️ Part ${i + 1} has inlineData but no data field`);
          }
        }
      }

      if (!imageFound) {
        console.error('❌ No image found in any response parts');
        console.error('Full response:', JSON.stringify(result, null, 2));
      }
    } else {
      console.error('❌ Invalid response structure - missing candidates/content/parts');
      console.error('Full response:', JSON.stringify(result, null, 2));
    }

    if (!imageFound) {
      console.warn('⚠️ No generated image in response, using avatar as fallback');
    }

    const processingTimeMs = Date.now() - startTime;

    return NextResponse.json({
      generatedImage: generatedImageDataUrl,
      processingTimeMs,
    });

  } catch (error: any) {
    console.error('Generate look error:', error);

    if (error.message === 'Generation timeout') {
      return NextResponse.json(
        { error: 'Timeout', message: 'Image generation timed out after 30 seconds' },
        { status: 504 }
      );
    }

    return NextResponse.json(
      { error: 'Generation failed', message: 'Failed to generate look image' },
      { status: 500 }
    );
  }
}
