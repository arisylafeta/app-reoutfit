"use client";

import React from "react";
import { useStudio } from "@/providers/studio-provider";
import { Button } from "@/components/ui/button";
import { Sparkles, Save, Share2, Shuffle, ShoppingBag } from "lucide-react";
import { toast } from "sonner";
import posthog from "posthog-js";

/**
 * Bottom Actions Component
 * Primary action buttons (Generate, Save, Share, Remix)
 */
export function BottomActions() {
  const { state, setGenerating, setGeneratedLook, setGeneratedLookAndStopGenerating } = useStudio();
  const { currentOutfit, generatedLook, isGenerating, selectedAvatar } = state;

  const canGenerate = currentOutfit.length > 0 && !isGenerating;
  const canSave = generatedLook !== null && !isGenerating;

  const handleGenerate = async () => {
    // Validate outfit has items
    if (currentOutfit.length === 0) {
      toast.error("Please add items to your outfit first");
      return;
    }

    // Validate avatar is selected
    if (!selectedAvatar) {
      toast.error("Please select or create your avatar first");
      return;
    }

    try {
      // Track generation start
      posthog.capture("studio_generate_started", {
        feature: "studio",
        product_count: currentOutfit.length,
        has_avatar: !!selectedAvatar,
      });

      // Set generating state
      setGenerating(true);

      // Prepare request body with URLs and metadata (let backend handle fetching)
      const requestBody = {
        avatarUrl: selectedAvatar.image_url,
        isAvatar: selectedAvatar.isAvatar ?? true, // Default to true if not specified
        products: currentOutfit.map(product => ({
          url: product.image,
          category: product.sourceData?.category || undefined,
          role: product.sourceData?.role || product.sourceData?.category || undefined,
        })),
        // Legacy support - also send productUrls for backward compatibility
        productUrls: currentOutfit.map(product => product.image),
      };

      console.log('🎨 [FRONTEND] Generating look with request body:', {
        avatarUrl: requestBody.avatarUrl,
        isAvatar: requestBody.isAvatar,
        productCount: requestBody.products.length,
        products: requestBody.products,
        selectedAvatar: {
          image_url: selectedAvatar.image_url,
          isAvatar: selectedAvatar.isAvatar,
        },
      });

      // Call generate API
      const response = await fetch('/api/studio/generate-look', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
        credentials: 'include',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Generation failed');
      }

      const data = await response.json();

      console.log('✅ [FRONTEND] Received response from API:', {
        hasGeneratedImage: !!data.generatedImage,
        imageUrlPrefix: data.generatedImage?.substring(0, 50) + '...',
        processingTimeMs: data.processingTimeMs,
      });

      // Use atomic update to set both generatedLook and stop generating in one state update
      setGeneratedLookAndStopGenerating({
        imageUrl: data.generatedImage,
      });

      // Track success
      posthog.capture("studio_look_generated", {
        feature: "studio",
        product_count: currentOutfit.length,
        processing_time_ms: data.processingTimeMs,
      });

      toast.success("Look generated successfully!");

    } catch (error: any) {
      console.error('❌ [FRONTEND] Generation error:', error);
      toast.error(error.message || "Failed to generate look. Please try again.");
      
      // Track failure
      posthog.capture("studio_generation_failed", {
        feature: "studio",
        error: error.message,
      });
      
      // Stop generating on error
      setGenerating(false);
    }
  };

  const handleSave = async () => {
    // Validate generated look exists
    if (!generatedLook) {
      toast.error("Please generate a look first");
      return;
    }

    try {
      // Track save start
      posthog.capture("studio_save_started", {
        feature: "studio",
        product_count: currentOutfit.length,
      });

      // Prepare request body
      const requestBody = {
        title: `Look - ${new Date().toLocaleDateString()}`,
        products: currentOutfit,
        generatedImageBase64: generatedLook.imageUrl,
      };

      // Call save API
      const response = await fetch('/api/studio/save-look', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
        credentials: 'include',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Save failed');
      }

      const data = await response.json();

      // Update generated look with lookbook ID
      setGeneratedLook({
        imageUrl: generatedLook.imageUrl,
        lookbookId: data.lookbook.id,
      });

      // Track success
      posthog.capture("studio_look_saved", {
        feature: "studio",
        lookbook_id: data.lookbook.id,
        lookbook_title: data.lookbook.title,
        product_count: currentOutfit.length,
      });

      toast.success("Look saved to your collection!");

    } catch (error: any) {
      console.error('Save error:', error);
      toast.error(error.message || "Failed to save look. Please try again.");
      
      // Track failure
      posthog.capture("studio_save_failed", {
        feature: "studio",
        error: error.message,
      });
    }
  };

  const handleShare = () => {
    toast.info("Share feature coming soon");
    posthog.capture("studio_share_clicked", {
      feature: "studio",
      action: "share_button_clicked",
    });
  };

  const handleRemix = () => {
    toast.info("Remix feature coming soon");
    posthog.capture("studio_remix_clicked", {
      feature: "studio",
      action: "remix_button_clicked",
    });
  };

  const handleProducts = () => {
    toast.info("Shopping history coming soon");
    posthog.capture("studio_products_clicked", {
      feature: "studio",
      action: "products_button_clicked",
      source: "bottom_actions_mobile",
    });
  };

  return (
    <div className="flex w-full flex-col gap-2 sm:gap-3">
      {/* Primary Action: Generate */}
      <Button
        onClick={handleGenerate}
        disabled={!canGenerate}
        className="h-12 w-full gap-2"
        size="lg"
      >
        <Sparkles className="h-5 w-5" />
        Generate Look
      </Button>

      {/* Secondary Actions */}
      <div className="grid w-full grid-cols-3 gap-2 sm:gap-3">
        <Button
          variant="outline"
          onClick={handleSave}
          disabled={!canSave}
          className="h-10 gap-2"
          size="default"
        >
          <Save className="h-4 w-4" />
          <span className="hidden sm:inline">Save</span>
        </Button>

        <Button
          variant="outline"
          onClick={handleShare}
          className="h-10 gap-2"
          size="default"
        >
          <Share2 className="h-4 w-4" />
          <span className="hidden sm:inline">Share</span>
        </Button>

        <Button
          variant="outline"
          onClick={handleRemix}
          className="h-10 gap-2"
          size="default"
        >
          <Shuffle className="h-4 w-4" />
          <span className="hidden sm:inline">Remix</span>
        </Button>
      </div>

      {/* Products Button - Mobile Only, Below Secondary Actions */}
      <Button
        onClick={handleProducts}
        className="h-12 w-full gap-2 min-[75rem]:hidden"
        size="lg"
      >
        <ShoppingBag className="h-5 w-5" />
        Browse Products
      </Button>
    </div>
  );
}
