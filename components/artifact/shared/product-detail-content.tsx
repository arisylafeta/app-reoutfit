"use client";

import React from "react";
import { Star, ShoppingCart, Heart, Search, Save, Package, MessageSquare, Loader2 } from "lucide-react";
import { DrawerTitle } from "@/components/ui/drawer";
import { cn } from "@/lib/utils";
import posthog from "posthog-js";
import { useStudio } from "@/providers/studio-provider";
import type { Product } from "@/types/product";
import { toast } from "sonner";
import { useImmersiveProduct } from "@/hooks/use-immersive-product";

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
  const { removeFromSelected, state: studioState } = useStudio();
  const inStock = product.available;

  // State for save to wardrobe functionality
  const [isSaving, setIsSaving] = React.useState(false);
  const [isSaved, setIsSaved] = React.useState(false);

  // SerpAPI Immersive Product hook - fetches detailed product info
  const {
    data: immersiveData,
    isLoading: isLoadingImmersive,
    error: immersiveError,
  } = useImmersiveProduct(
    product.id,
    product.metadata?.immersive_product_token as string | undefined
  );

  // Use immersive price range or product price
  const displayPrice = product.price ?? 0;
  const displayCurrency = product.currency ?? 'USD';
  const hasDisplayPrice = displayPrice > 0;
  
  // Get first store for "Buy Product" button
  const primaryStore = immersiveData?.stores?.[0];
  const buyLink = primaryStore?.link || product.product_url;

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

  // Loading skeleton
  if (isLoadingImmersive && !immersiveData) {
    return (
      <>
        <DrawerTitle className="sr-only">{product.name}</DrawerTitle>
        <div className="px-4 pb-4 pt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Column - Image Skeleton */}
            <div>
              <div className="bg-gray-200 dark:bg-zinc-800 lg:rounded-lg overflow-hidden lg:h-[60vh] animate-pulse flex items-center justify-center">
                {product.image_url ? (
                  <img
                    src={product.image_url}
                    alt={product.name}
                    className="w-full h-auto lg:h-full object-contain opacity-50"
                  />
                ) : (
                  <Package className="h-24 w-24 text-gray-400" />
                )}
              </div>
            </div>

            {/* Right Column - Content Skeleton */}
            <div className="space-y-4">
              {/* Title */}
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

              {/* Price Skeleton */}
              <div className="h-8 w-32 bg-gray-200 dark:bg-zinc-700 rounded animate-pulse" />

              {/* Buttons Skeleton */}
              <div className="grid grid-cols-2 gap-2">
                <div className="h-10 bg-gray-200 dark:bg-zinc-700 rounded-lg animate-pulse" />
                <div className="h-10 bg-gray-200 dark:bg-zinc-700 rounded-lg animate-pulse" />
                <div className="h-10 bg-gray-200 dark:bg-zinc-700 rounded-lg animate-pulse" />
                <div className="h-10 bg-gray-200 dark:bg-zinc-700 rounded-lg animate-pulse" />
              </div>

              {/* Loading indicator */}
              <div className="flex items-center justify-center gap-2 py-4 text-sm text-gray-500 dark:text-gray-400">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading detailed product information...
              </div>

              {/* Stores Skeleton */}
              <div className="space-y-2">
                <div className="h-4 w-32 bg-gray-200 dark:bg-zinc-700 rounded animate-pulse" />
                <div className="h-20 bg-gray-200 dark:bg-zinc-700 rounded-lg animate-pulse" />
                <div className="h-20 bg-gray-200 dark:bg-zinc-700 rounded-lg animate-pulse" />
                <div className="h-20 bg-gray-200 dark:bg-zinc-700 rounded-lg animate-pulse" />
              </div>

              {/* Description Skeleton */}
              <div className="space-y-2 pt-4 border-t border-gray-200 dark:border-zinc-700">
                <div className="h-4 w-40 bg-gray-200 dark:bg-zinc-700 rounded animate-pulse" />
                <div className="h-3 w-full bg-gray-200 dark:bg-zinc-700 rounded animate-pulse" />
                <div className="h-3 w-full bg-gray-200 dark:bg-zinc-700 rounded animate-pulse" />
                <div className="h-3 w-3/4 bg-gray-200 dark:bg-zinc-700 rounded animate-pulse" />
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
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
                {isLoadingImmersive && !immersiveData ? (
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
                    {immersiveData?.price_range && (
                      <span className="text-xs text-gray-600 dark:text-gray-400">
                        {immersiveData.price_range}
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
                href={buyLink}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => {
                  posthog.capture(`${eventPrefix}_buy_product_clicked`, {
                    product_id: product.id,
                    product_name: product.name,
                    product_brand: product.brand,
                    product_price: product.price,
                    product_url: buyLink,
                    store_name: primaryStore?.name,
                    in_stock: product.available,
                    has_rating: !!immersiveData?.rating,
                    rating: immersiveData?.rating,
                  });
                }}
                className="flex items-center justify-center gap-2 px-4 py-2.5 bg-accent-2 hover:bg-accent-2/90 text-white text-sm font-medium rounded-lg transition-colors"
              >
                <ShoppingCart className="h-4 w-4" />
                {primaryStore ? `Buy at ${primaryStore.name}` : 'Buy Product'}
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
                
                  toast.info("Find Similar Coming Soon...");
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

            {/* Immersive Error - Silent fallback */}
            {immersiveError && (
              <div className="text-xs text-gray-500 dark:text-gray-400 text-center py-2 bg-yellow-50 dark:bg-yellow-900/10 rounded">
                ⚠️ Could not load detailed information. Showing basic info only.
              </div>
            )}

            {/* Store Comparison - From immersive data */}
            {immersiveData?.stores && immersiveData.stores.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
                  Available at {immersiveData.stores.length} store{immersiveData.stores.length > 1 ? 's' : ''}
                </h4>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {immersiveData.stores.slice(0, 5).map((store, idx) => (
                    <a
                      key={idx}
                      href={store.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => {
                        posthog.capture(`${eventPrefix}_store_link_clicked`, {
                          product_id: product.id,
                          store_name: store.name,
                          store_price: store.extracted_price,
                        });
                      }}
                      className="block p-3 border border-gray-200 dark:border-zinc-700 rounded-lg hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          {store.logo && (
                            <img src={store.logo} alt={store.name} className="h-6 w-6 object-contain shrink-0" />
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-sm text-gray-900 dark:text-white truncate">{store.name}</p>
                            {store.shipping && (
                              <p className="text-xs text-gray-500 dark:text-gray-400">{store.shipping}</p>
                            )}
                            {store.rating && store.reviews && (
                              <div className="flex items-center gap-1 mt-0.5">
                                <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                                <span className="text-xs text-gray-600 dark:text-gray-400">
                                  {store.rating} ({store.reviews})
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="text-right shrink-0 ml-3">
                          <p className="font-bold text-gray-900 dark:text-white">{store.price}</p>
                          {store.discount && (
                            <p className="text-xs text-green-600 dark:text-green-400">{store.discount}</p>
                          )}
                        </div>
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Description & Features - From immersive data */}
            {(immersiveData?.about_the_product || immersiveData?.title) && (
              <div className="border-t border-gray-200 dark:border-zinc-700 pt-4">
                <div className="flex items-center gap-2 mb-3">
                  <Package className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                  <h4 className="text-sm font-semibold text-gray-900 dark:text-white">About This Product</h4>
                </div>
                
                {/* Show description from about_the_product or fallback to product name */}
                {immersiveData?.about_the_product?.description ? (
                  <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed mb-4">
                    {immersiveData.about_the_product.description}
                  </p>
                ) : immersiveData?.title && (
                  <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed mb-4">
                    {immersiveData.title}
                  </p>
                )}

                {immersiveData?.about_the_product?.features && immersiveData.about_the_product.features.length > 0 && (
                  <div>
                    <h5 className="text-xs font-semibold text-gray-900 dark:text-white mb-2 uppercase tracking-wide">Key Features</h5>
                    <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
                      {immersiveData.about_the_product.features.map((feature, idx) => (
                        <div key={idx} className="text-xs">
                          <dt className="font-medium text-gray-600 dark:text-gray-400">
                            {feature.title}
                          </dt>
                          <dd className="text-gray-900 dark:text-white mt-0.5">
                            {feature.value}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                )}
              </div>
            )}

            {/* Customer Reviews - From immersive data */}
            {immersiveData?.user_reviews && immersiveData.user_reviews.length > 0 ? (
              <div className="pt-4 border-t border-gray-200 dark:border-zinc-700">
                <div className="flex items-center gap-2 mb-3">
                  <MessageSquare className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                  <h4 className="text-sm font-semibold text-gray-900 dark:text-white">Customer Reviews</h4>
                  {immersiveData.rating && (
                    <div className="flex items-center gap-1 ml-auto">
                      <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                      <span className="text-sm font-medium">{immersiveData.rating}</span>
                      {immersiveData.reviews && (
                        <span className="text-xs text-gray-500 dark:text-gray-400">({immersiveData.reviews})</span>
                      )}
                    </div>
                  )}
                </div>
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {immersiveData.user_reviews.slice(0, 5).map((review, idx) => (
                    <div key={idx} className="p-3 bg-gray-50 dark:bg-zinc-800/50 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="flex">
                          {[...Array(5)].map((_, i) => (
                            <Star
                              key={i}
                              className={cn(
                                "h-3 w-3",
                                i < review.rating
                                  ? "fill-yellow-400 text-yellow-400"
                                  : "text-gray-300 dark:text-gray-600"
                              )}
                            />
                          ))}
                        </div>
                        <span className="text-xs font-medium text-gray-900 dark:text-white">{review.user_name}</span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">{review.date}</span>
                      </div>
                      {review.title && (
                        <p className="text-sm font-medium text-gray-900 dark:text-white mb-1">{review.title}</p>
                      )}
                      <p className="text-xs text-gray-700 dark:text-gray-300 line-clamp-4">{review.text}</p>
                      {review.images && review.images.length > 0 && (
                        <div className="flex gap-2 mt-2">
                          {review.images.slice(0, 3).map((img, imgIdx) => (
                            <img
                              key={imgIdx}
                              src={img}
                              alt="Review"
                              className="h-12 w-12 object-cover rounded"
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
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
