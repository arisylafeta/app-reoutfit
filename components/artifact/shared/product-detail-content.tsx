"use client";

import React from "react";
import { Star, ShoppingCart, Heart, Search, Save, Package, MessageSquare, Ruler, Loader2 } from "lucide-react";
import { DrawerTitle } from "@/components/ui/drawer";
import { cn } from "@/lib/utils";
import posthog from "posthog-js";
import { useStudio } from "@/providers/studio-provider";
import type { Product } from "@/types/product";
import { toast } from "sonner";
import { useProductEnrichment } from "@/hooks/use-product-enrichment";

type ProductDetailContentProps = {
  product: Product;
  onClose?: () => void;
  showReviews?: boolean;
  eventPrefix?: string;
};

/**
 * Product detail drawer content component.
 *
 * Displays product information in a two-column layout:
 * - Left: Product image (full size if available)
 * - Right: Product details, pricing, actions, description, attributes
 *
 * Props:
 * - `product`: Product data to display
 * - `onClose`: Optional callback when drawer should close
 * - `showReviews`: Whether to show fake reviews section (default: false)
 * - `eventPrefix`: Prefix for PostHog events (default: 'product')
 *
 * Usage:
 * ```tsx
 * <ArtifactDrawer open={isOpen} onOpenChange={setIsOpen}>
 *   <ProductDetailContent
 *     product={selectedProduct}
 *     onClose={() => setIsOpen(false)}
 *     showReviews={true}
 *     eventPrefix="lens"
 *   />
 * </ArtifactDrawer>
 * ```
 */
export function ProductDetailContent({
  product,
  onClose,
  showReviews = false,
  eventPrefix = "product",
}: ProductDetailContentProps) {
  const { addToSelected, removeFromSelected, state: studioState } = useStudio();
  const inStock = product.available;

  // State for save to wardrobe functionality
  const [isSaving, setIsSaving] = React.useState(false);
  const [isSaved, setIsSaved] = React.useState(false);

  // Firecrawl enrichment hook - triggered by prefetch on click
  const {
    enrichedData,
    status: enrichmentStatus,
    error: enrichmentError,
    enrich: _enrich,
    isLoading: isEnriching,
    isCached,
  } = useProductEnrichment(product.id, product.product_url);

  // NOTE: Enrichment is prefetched when product card is clicked (see lens-results.tsx)
  // We don't auto-trigger here to avoid duplicate API calls and credit deductions
  // The prefetch cache in prefetch-enrichment.ts handles deduplication
  
  // Auto-trigger enrichment when component mounts (if not already prefetched)
  // DISABLED to prevent duplicate credit charges
  // React.useEffect(() => {
  //   if (product.product_url && enrichmentStatus === 'idle') {
  //     enrich();
  //   }
  // }, [product.product_url, enrichmentStatus, enrich]);

  // Use enriched price if available, fallback to product price
  const displayPrice = enrichedData?.price ?? product.price ?? 0;
  const displayCurrency = enrichedData?.currency ?? product.currency ?? 'USD';
  const hasDisplayPrice = displayPrice > 0;

  // Format price with currency symbol
  const formatPrice = (price: number, currency: string) => {
    const currencySymbol = currency.replace(/[^$£€¥]/g, '') || '$';
    return `${currencySymbol}${price.toFixed(0)}`;
  };

  // Handle save to wardrobe
  const handleSaveToWardrobe = async () => {
    if (isSaving || isSaved) return;

    try {
      setIsSaving(true);

      // Track click event
      posthog.capture(`${eventPrefix}_save_to_wardrobe_clicked`, {
        product_id: product.id,
        product_name: product.name,
        product_brand: product.brand,
        product_price: product.price,
      });

      // Call API to save product
      const response = await fetch('/api/wardrobe/save-product', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ product }),
        credentials: 'include',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to save product');
      }

      const data = await response.json();

      // Track success event
      posthog.capture(`${eventPrefix}_saved_to_wardrobe_success`, {
        product_id: product.id,
        product_name: product.name,
        wardrobe_item_id: data.wardrobeItemId,
        already_exists: data.alreadyExists,
      });

      setIsSaved(true);

      if (data.alreadyExists) {
        toast.success("This item is already in your wardrobe");
      } else {
        toast.success("Saved to wardrobe!");
      }

    } catch (error: any) {
      console.error('Save to wardrobe error:', error);

      // Track failure event
      posthog.capture(`${eventPrefix}_saved_to_wardrobe_failed`, {
        product_id: product.id,
        error: error.message,
      });

      toast.error(error.message || "Failed to save to wardrobe");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      {/* Visually Hidden Title for Accessibility */}
      <DrawerTitle className="sr-only">{product.name}</DrawerTitle>

      <div className="px-4 pb-4 pt-4">
        {/* Two Column Layout on Large Screens */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column - Product Image Only */}
          <div>
            <div className="bg-white dark:bg-zinc-900 lg:rounded-lg overflow-hidden lg:sticky lg:top-0 flex items-center justify-center lg:h-[60vh]">
              {product.image_url ? (
                <img
                  src={product.image_url}
                  alt={product.name}
                  className="w-full h-auto lg:h-full object-contain"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Package className="h-24 w-24 text-gray-400" />
                </div>
              )}
            </div>
          </div>

          {/* Right Column - ALL Product Info */}
          <div className="space-y-4">
            {/* Title and Brand */}
            <div>
              <h3 className="text-sm lg:text-lg font-semibold text-gray-900 dark:text-white line-clamp-2">
                {product.name}
              </h3>
              {product.brand && (
                <p className="text-xs lg:text-sm text-gray-600 dark:text-gray-400 mt-1">
                  {product.brand}
                </p>
              )}
            </div>

            {/* Price and Stock */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {isEnriching && !enrichedData ? (
                  // Skeleton with fallback to existing price
                  <div className="flex items-center gap-2">
                    {product.price && product.price > 0 ? (
                      <div className="text-2xl font-bold text-gray-400 dark:text-gray-500 animate-pulse">
                        {formatPrice(product.price, product.currency || 'USD')}
                      </div>
                    ) : (
                      <div className="h-8 w-24 bg-gray-200 dark:bg-zinc-700 rounded animate-pulse" />
                    )}
                  </div>
                ) : hasDisplayPrice ? (
                  <div className="flex items-center gap-2">
                    <div className="text-2xl font-bold text-gray-900 dark:text-white">
                      {formatPrice(displayPrice, displayCurrency)}
                    </div>
                    {enrichedData?.price && enrichedData.price !== product.price && (
                      <span className="text-xs text-green-600 dark:text-green-400 font-medium">
                        Updated
                      </span>
                    )}
                  </div>
                ) : (
                  <p className="text-lg text-gray-500 dark:text-gray-400">Price not available</p>
                )}
              </div>
              {inStock === true && (
                <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                  In Stock
                </span>
              )}
              {inStock === false && showReviews && (
                <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                  Out of Stock
                </span>
              )}
            </div>

            {/* Rating - Not available in database Product type */}

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-2">
              <a
                href={product.product_url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => {
                  posthog.capture(`${eventPrefix}_buy_product_clicked`, {
                    product_id: product.id,
                    product_name: product.name,
                    product_brand: product.brand,
                    product_price: product.price,
                    product_url: product.product_url,
                    in_stock: product.available,
                    has_rating: false,
                    rating: null,
                  });
                }}
                className="flex items-center justify-center gap-2 px-4 py-2.5 bg-accent-2 hover:bg-accent-2/90 text-white text-sm font-medium rounded-lg transition-colors"
              >
                <ShoppingCart className="h-4 w-4" />
                Buy Product
              </a>
              <button
                onClick={() => {
                  const isSelected = studioState.selectedProducts.some(p => p.id === product.id);

                  if (isSelected) {
                    // Remove product from Studio
                    removeFromSelected(product.id);

                    // Track removal event
                    posthog.capture(`${eventPrefix}_product_removed_from_studio`, {
                      product_id: product.id,
                      product_name: product.name,
                      product_brand: product.brand,
                      product_price: product.price,
                    });
                  } else {
                    // Add product to Studio
    
                    // Track addition event
                    posthog.capture(`${eventPrefix}_product_selected_for_studio`, {
                      product_id: product.id,
                      product_name: product.name,
                      product_brand: product.brand,
                      product_price: product.price,
                    });
                  }
                }}
                className={cn(
                  "flex items-center justify-center gap-2 px-4 py-2.5 border text-sm font-medium rounded-lg transition-colors",
                  studioState.selectedProducts.some(p => p.id === product.id)
                    ? "border-accent-2 bg-accent-2/10 text-accent-2 dark:bg-accent-2/20"
                    : "border-gray-300 dark:border-zinc-600 hover:bg-gray-50 dark:hover:bg-zinc-800 text-gray-700 dark:text-gray-300"
                )}
              >
                <Heart className={cn(
                  "h-4 w-4",
                  studioState.selectedProducts.some(p => p.id === product.id) && "fill-current"
                )} />
                {studioState.selectedProducts.some(p => p.id === product.id) ? "Selected" : "Select To Try"}
              </button>
              <button
                onClick={() => {
                  posthog.capture(`${eventPrefix}_find_similar_clicked`, {
                    product_id: product.id,
                    product_name: product.name,
                    product_brand: product.brand,
                    product_url: product.product_url,
                    in_stock: inStock,
                  });
                
                  // Convert to studio product format
                  const studioProduct = {
                    id: product.id,
                    title: product.name,
                    brand: product.brand || 'Unknown',
                    image: product.image_url || '',
                    sourceData: product as Record<string, any>,
                  };
                
                  addToSelected(studioProduct);
                }}
                className="flex items-center justify-center gap-2 px-4 py-2.5 border border-gray-300 dark:border-zinc-600 hover:bg-gray-50 dark:hover:bg-zinc-800 text-gray-700 dark:text-gray-300 text-sm font-medium rounded-lg transition-colors"
              >
                <Search className="h-4 w-4" />
                Find Similar
              </button>
              <button
                onClick={handleSaveToWardrobe}
                disabled={isSaving || isSaved}
                className={cn(
                  "flex items-center justify-center gap-2 px-4 py-2.5 border text-sm font-medium rounded-lg transition-colors",
                  isSaved
                    ? "border-green-500 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 cursor-default"
                    : "border-gray-300 dark:border-zinc-600 hover:bg-gray-50 dark:hover:bg-zinc-800 text-gray-700 dark:text-gray-300",
                  (isSaving || isSaved) && "opacity-75"
                )}
              >
                <Save className={cn("h-4 w-4", isSaved && "fill-current")} />
                {isSaving ? "Saving..." : isSaved ? "Saved" : "Save To Wardrobe"}
              </button>
            </div>

            {/* Enrichment Loading Indicator */}
            {isEnriching && !enrichedData && (
              <div className="flex items-center justify-center gap-2 py-2 text-xs text-gray-500 dark:text-gray-400">
                <Loader2 className="h-3 w-3 animate-spin" />
                Loading detailed info...
              </div>
            )}

            {/* Enrichment Error - Silent fallback with optional retry */}
            {enrichmentStatus === 'error' && enrichmentError && (
              <div className="text-xs text-gray-500 dark:text-gray-400 text-center py-1">
                Showing basic info only
              </div>
            )}

            {/* Description - Enhanced with enriched summary */}
            {(isEnriching && !enrichedData) ? (
              // Skeleton for description
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Package className="h-4 w-4 text-gray-400 dark:text-gray-500" />
                  <div className="h-4 w-24 bg-gray-200 dark:bg-zinc-700 rounded animate-pulse" />
                </div>
                <div className="space-y-2">
                  <div className="h-3 bg-gray-200 dark:bg-zinc-700 rounded animate-pulse w-full" />
                  <div className="h-3 bg-gray-200 dark:bg-zinc-700 rounded animate-pulse w-5/6" />
                  <div className="h-3 bg-gray-200 dark:bg-zinc-700 rounded animate-pulse w-4/6" />
                </div>
              </div>
            ) : enrichedData?.description_summary && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Package className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                  <h4 className="text-sm font-semibold text-gray-900 dark:text-white">Description</h4>
                  {isCached && enrichedData?.description_summary && (
                    <span className="text-xs text-gray-500 dark:text-gray-400">✓</span>
                  )}
                </div>
                <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                  {enrichedData?.description_summary}
                </p>
              </div>
            )}

            {/* Materials - From enriched data */}
            {isEnriching && !enrichedData ? (
              // Skeleton for materials
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Package className="h-4 w-4 text-gray-400 dark:text-gray-500" />
                  <div className="h-4 w-20 bg-gray-200 dark:bg-zinc-700 rounded animate-pulse" />
                </div>
                <div className="h-3 bg-gray-200 dark:bg-zinc-700 rounded animate-pulse w-3/4" />
              </div>
            ) : enrichedData?.materials_summary && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Package className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                  <h4 className="text-sm font-semibold text-gray-900 dark:text-white">Materials</h4>
                </div>
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  {enrichedData.materials_summary}
                </p>
              </div>
            )}

            {/* Sizing Info - From enriched data */}
            {isEnriching && !enrichedData ? (
              // Skeleton for sizing
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Ruler className="h-4 w-4 text-gray-400 dark:text-gray-500" />
                  <div className="h-4 w-24 bg-gray-200 dark:bg-zinc-700 rounded animate-pulse" />
                </div>
                <div className="h-3 bg-gray-200 dark:bg-zinc-700 rounded animate-pulse w-2/3" />
              </div>
            ) : enrichedData?.sizing_info && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Ruler className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                  <h4 className="text-sm font-semibold text-gray-900 dark:text-white">Sizing & Fit</h4>
                </div>
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  {enrichedData.sizing_info}
                </p>
              </div>
            )}

            {/* Attributes from metadata */}
            {product.metadata && Object.keys(product.metadata).length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Details</h4>
                <dl className="grid grid-cols-2 gap-2">
                  {Object.entries(product.metadata).map(([key, value]) => (
                    value && (
                      <div key={key} className="text-xs">
                        <dt className="font-medium text-gray-600 dark:text-gray-400 capitalize">
                          {key.replace(/_/g, ' ')}
                        </dt>
                        <dd className="text-gray-900 dark:text-white mt-0.5">
                          {String(value)}
                        </dd>
                      </div>
                    )
                  ))}
                </dl>
              </div>
            )}

            {/* Customer Reviews - Enhanced with enriched summary */}
            {isEnriching && !enrichedData ? (
              // Skeleton for reviews
              <div className="pt-4 border-t border-gray-200 dark:border-zinc-700">
                <div className="flex items-center gap-2 mb-3">
                  <MessageSquare className="h-5 w-5 text-gray-400 dark:text-gray-500" />
                  <div className="h-4 w-32 bg-gray-200 dark:bg-zinc-700 rounded animate-pulse" />
                </div>
                <div className="p-3 bg-gray-100 dark:bg-zinc-800 rounded-lg space-y-2">
                  <div className="h-3 bg-gray-200 dark:bg-zinc-700 rounded animate-pulse w-full" />
                  <div className="h-3 bg-gray-200 dark:bg-zinc-700 rounded animate-pulse w-5/6" />
                  <div className="h-3 bg-gray-200 dark:bg-zinc-700 rounded animate-pulse w-4/6" />
                </div>
              </div>
            ) : enrichedData?.reviews_summary ? (
              <div className="pt-4 border-t border-gray-200 dark:border-zinc-700">
                <div className="flex items-center gap-2 mb-3">
                  <MessageSquare className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                  <h4 className="text-sm font-semibold text-gray-900 dark:text-white">Customer Reviews</h4>
                </div>
                <div className="p-3 bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-lg border border-purple-100 dark:border-purple-800">
                  <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                    {enrichedData.reviews_summary}
                  </p>
                </div>
              </div>
            ) : showReviews && (
              <div className="pt-4 border-t border-gray-200 dark:border-zinc-700">
                <div className="flex items-center gap-2 mb-3">
                  <MessageSquare className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                  <h4 className="text-sm font-semibold text-gray-900 dark:text-white">What People Are Saying</h4>
                </div>
                <div className="space-y-3">
                  <div className="p-3 bg-gray-50 dark:bg-zinc-800/50 rounded-lg">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="flex">
                        {[...Array(5)].map((_, i) => (
                          <Star key={i} className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                        ))}
                      </div>
                      <span className="text-xs font-medium text-gray-900 dark:text-white">Sarah M.</span>
                    </div>
                    <p className="text-xs text-gray-700 dark:text-gray-300">
                      "Absolutely love this! The quality exceeded my expectations and it fits perfectly."
                    </p>
                  </div>
                  <div className="p-3 bg-gray-50 dark:bg-zinc-800/50 rounded-lg">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="flex">
                        {[...Array(4)].map((_, i) => (
                          <Star key={i} className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                        ))}
                        <Star className="h-3 w-3 text-gray-300" />
                      </div>
                      <span className="text-xs font-medium text-gray-900 dark:text-white">Mike R.</span>
                    </div>
                    <p className="text-xs text-gray-700 dark:text-gray-300">
                      "Great value for money. Shipping was fast and the product matches the description."
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
