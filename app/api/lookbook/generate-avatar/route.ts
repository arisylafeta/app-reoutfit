import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import type { GenerateAvatarResponse, AvatarMeasurements } from '@/types/lookbook';
import { getUserCredits, deductCredits, InsufficientCreditsError } from '@/lib/db/credits';

const genAI = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || '',
});

const GENERATION_TIMEOUT = 30000; // 30 seconds

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Verify authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Credit check (5 credits for avatar generation)
    const COST = 5;
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
      await deductCredits(user.id, COST, 'generate-avatar');
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

    // Check if Gemini API key is configured
    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        { error: 'Avatar generation service not configured' },
        { status: 503 }
      );
    }

    // Parse form data
    const formData = await request.formData();
    const headImage = formData.get('headImage') as File;
    const bodyImage = formData.get('bodyImage') as File;
    const measurementsStr = formData.get('measurements') as string;
    const regenerationNote = formData.get('regenerationNote') as string | null;

    // Validate required fields
    if (!headImage) {
      return NextResponse.json(
        { error: 'Head image is required' },
        { status: 400 }
      );
    }

    if (!bodyImage) {
      return NextResponse.json(
        { error: 'Body image is required' },
        { status: 400 }
      );
    }

    if (!measurementsStr) {
      return NextResponse.json(
        { error: 'Measurements are required' },
        { status: 400 }
      );
    }

    // Parse and validate measurements
    let measurements: AvatarMeasurements;
    try {
      measurements = JSON.parse(measurementsStr);
    } catch {
      return NextResponse.json(
        { error: 'Invalid measurements format' },
        { status: 400 }
      );
    }

    // Validate required measurements
    if (!measurements.height_cm || !measurements.weight_kg) {
      return NextResponse.json(
        { error: 'Height and weight are required measurements' },
        { status: 400 }
      );
    }

    // Validate image files
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    
    if (!allowedTypes.includes(headImage.type)) {
      return NextResponse.json(
        { error: 'Invalid head image type. Only JPEG, PNG, and WebP are allowed.' },
        { status: 400 }
      );
    }

    if (!allowedTypes.includes(bodyImage.type)) {
      return NextResponse.json(
        { error: 'Invalid body image type. Only JPEG, PNG, and WebP are allowed.' },
        { status: 400 }
      );
    }

    if (headImage.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'Head image size exceeds 10MB limit' },
        { status: 400 }
      );
    }

    if (bodyImage.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'Body image size exceeds 10MB limit' },
        { status: 400 }
      );
    }

    // Convert images to base64
    const headImageBuffer = await headImage.arrayBuffer();
    const headImageBase64 = Buffer.from(headImageBuffer).toString('base64');
    const headImageDataUrl = `data:${headImage.type};base64,${headImageBase64}`;

    const bodyImageBuffer = await bodyImage.arrayBuffer();
    const bodyImageBase64 = Buffer.from(bodyImageBuffer).toString('base64');
    const bodyImageDataUrl = `data:${bodyImage.type};base64,${bodyImageBase64}`;

    try {
      // Construct Gemini prompt for avatar generation
      let promptText = `Create a realistic full-body avatar by combining this head photo and body photo. `;
      promptText += `Maintain accurate proportions based on these measurements: `;
      promptText += `Height: ${measurements.height_cm}cm, Weight: ${measurements.weight_kg}kg`;
      
      if (measurements.body_shape) {
        promptText += `, Body shape: ${measurements.body_shape}`;
      }
      
      if (measurements.chest_cm || measurements.waist_cm || measurements.hips_cm) {
        promptText += `. Additional measurements: `;
        const details = [];
        if (measurements.chest_cm) details.push(`Chest: ${measurements.chest_cm}cm`);
        if (measurements.waist_cm) details.push(`Waist: ${measurements.waist_cm}cm`);
        if (measurements.hips_cm) details.push(`Hips: ${measurements.hips_cm}cm`);
        if (measurements.shoulder_width_cm) details.push(`Shoulders: ${measurements.shoulder_width_cm}cm`);
        if (measurements.inseam_cm) details.push(`Inseam: ${measurements.inseam_cm}cm`);
        promptText += details.join(', ');
      }
      
      promptText += `. The avatar should be front-facing, well-lit, against a neutral background. `;
      promptText += `IMPORTANT: Change all clothing to pure white (shirt, pants, dress, etc.). `;
      promptText += `Enhance the image by: slightly cleaning up and smoothing the skin for a polished look, `;
      promptText += `adjusting the stance to be more upright with good posture and shoulders back. `;
      promptText += `Style: photorealistic, professional, clean.`;
      
      if (regenerationNote) {
        promptText += ` User feedback: ${regenerationNote}`;
      }

      const prompt = [
        {
          text: promptText,
        },
        {
          text: 'Head photo:',
        },
        {
          inlineData: {
            mimeType: headImage.type,
            data: headImageBase64,
          },
        },
        {
          text: 'Body photo:',
        },
        {
          inlineData: {
            mimeType: bodyImage.type,
            data: bodyImageBase64,
          },
        },
      ];

      // Create timeout promise
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Avatar generation timeout')), GENERATION_TIMEOUT);
      });

      // Generate avatar with timeout
      const generationPromise = genAI.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: prompt,
      });

      const response: any = await Promise.race([generationPromise, timeoutPromise]);

      // Extract the generated image from response
      let avatarImageDataUrl = headImageDataUrl; // Fallback to head image
      
      if (response.candidates && response.candidates[0]?.content?.parts) {
        for (const part of response.candidates[0].content.parts) {
          if (part.inlineData) {
            const generatedImageData = part.inlineData.data;
            const mimeType = part.inlineData.mimeType || 'image/png';
            avatarImageDataUrl = `data:${mimeType};base64,${generatedImageData}`;
            break;
          }
        }
      }

      const avatarResponse: GenerateAvatarResponse = {
        avatarImage: avatarImageDataUrl,
        headImage: headImageDataUrl,
        bodyImage: bodyImageDataUrl,
      };

      return NextResponse.json(avatarResponse);
    } catch (aiError: any) {
      console.error('Gemini API error:', aiError);

      if (aiError.message === 'Avatar generation timeout') {
        return NextResponse.json(
          { error: 'Avatar generation timed out. Please try again.' },
          { status: 504 }
        );
      }

      return NextResponse.json(
        { error: 'Avatar generation service is temporarily unavailable. Please try again later.' },
        { status: 503 }
      );
    }
  } catch (error) {
    console.error('Unexpected error in POST /api/lookbook/generate-avatar:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
