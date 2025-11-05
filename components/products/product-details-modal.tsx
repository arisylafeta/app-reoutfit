'use client';

import { useState, useEffect } from 'react';
import { Product, ProductDetailResponse } from '@/types/product';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ExternalLink, Heart, Loader2, Save } from 'lucide-react';
import { toast } from 'sonner';
import posthog from 'posthog-js';
import { cn } from '@/lib/utils';

interface ProductDetailsModalProps {
  product: Product | null;
  open: boolean;
  onClose: () => void;
}

export function ProductDetailsModal({
  product,
  open,
  onClose,
}: ProductDetailsModalProps) {
  const [productDetails, setProductDetails] = useState<ProductDetailResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<any>(null);

  // State for save to wardrobe functionality
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  const fetchProductDetails = async () => {
    if (!product) return;

    setLoading(true);
    try {
      const response = await fetch(`/api/products/${product.id}`);
      const data = await response.json();
      setProductDetails(data);

      // Set default color to first available
      if (data.variants.colors.length > 0) {
        setSelectedColor(data.variants.colors[0].color);
      }
    } catch (error) {
      console.error('Error fetching product details:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (product && open) {
      fetchProductDetails();
      // Reset save state when opening a new product
      setIsSaved(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product?.id, open]);

  useEffect(() => {
    // Update selected variant when color or size changes
    if (selectedColor && selectedSize && productDetails) {
      const colorVariant = productDetails.variants.colors.find(c => c.color === selectedColor);
      const variant = colorVariant?.variants.find(v => v.size === selectedSize);
      setSelectedVariant(variant || null);
    }
  }, [selectedColor, selectedSize, productDetails]);

  const handleBuyNow = () => {
    const url = selectedVariant?.product_url || product?.product_url;
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  // Handle save to wardrobe
  const handleSaveToWardrobe = async () => {
    if (isSaving || isSaved || !product) return;

    try {
      setIsSaving(true);

      // Track click event
      posthog.capture('product_modal_save_to_wardrobe_clicked', {
        product_id: product.id,
        product_name: product.name,
        product_brand: product.brand,
        product_price: product.price,
      });

      // Transform database Product to API-compatible format (Studio Product)
      const productForAPI = {
        id: product.id,
        name: product.name,
        price: product.price || 0,
        currency: product.currency || 'USD',
        brand: product.brand || 'Unknown',
        image: product.image_url || '', // Map image_url to image
        image_full: product.image_url || '',
        product_url: product.product_url,
        description: product.metadata?.description || '',
        rating: product.metadata?.rating,
        reviews: product.metadata?.reviews,
        in_stock: product.available,
        source_icon: product.metadata?.source_icon,
        attributes: {
          category: product.category,
          gender: product.gender,
          size: product.size,
          colors: product.colors,
          fabrics: product.fabrics,
          seasons: product.seasons,
          tags: product.tags,
          dress_codes: product.dress_codes,
          ...product.metadata,
        },
      };

      // Call API to save product
      const response = await fetch('/api/wardrobe/save-product', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ product: productForAPI }),
        credentials: 'include',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to save product');
      }

      const data = await response.json();

      // Track success event
      posthog.capture('product_modal_saved_to_wardrobe_success', {
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
      posthog.capture('product_modal_saved_to_wardrobe_failed', {
        product_id: product.id,
        error: error.message,
      });

      toast.error(error.message || "Failed to save to wardrobe");
    } finally {
      setIsSaving(false);
    }
  };

  if (!product) return null;

  const currentProduct = productDetails?.product || product;
  const selectedColorVariant = productDetails?.variants.colors.find(c => c.color === selectedColor);

  const formatPrice = (price: number | null, currency: string | null) => {
    if (price === null) return 'Price not available';
    const symbol = currency === 'GBP' ? '£' : currency === 'EUR' ? '€' : '$';
    return `${symbol}${price.toFixed(2)}`;
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{product.name}</DialogTitle>
        </DialogHeader>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Product Image */}
          <div className="space-y-4">
            <div className="relative aspect-square overflow-hidden">
              {loading ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              ) : (
                <img
                  src={selectedColorVariant?.image_url || currentProduct.image_url || '/products.png'}
                  alt={currentProduct.name}
                  className="w-full h-full object-cover rounded-lg"
                />
              )}
            </div>
            
            {/* Action Buttons */}
            <div className="space-y-2">
              <Button
                size="lg"
                className="w-full"
                onClick={handleBuyNow}
                disabled={loading}
              >
                <ExternalLink className="mr-2 h-5 w-5" />
                {loading ? 'Loading...' : 'Buy Now'}
              </Button>
              
              <Button
                size="lg"
                variant="outline"
                className={cn(
                  "w-full",
                  isSaved
                    ? "border-green-500 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 cursor-default"
                    : "border-gray-300 dark:border-zinc-600 hover:bg-gray-50 dark:hover:bg-zinc-800",
                  (isSaving || isSaved) && "opacity-75"
                )}
                onClick={handleSaveToWardrobe}
                disabled={isSaving || isSaved || loading}
              >
                <Save className={cn("mr-2 h-5 w-5", isSaved && "fill-current")} />
                {isSaving ? 'Saving...' : isSaved ? 'Saved' : 'Save To Wardrobe'}
              </Button>
            </div>
          </div>

          {/* Product Details */}
          <div className="space-y-4">
            {currentProduct.brand && (
              <div>
                <h4 className="text-sm font-semibold text-muted-foreground">
                  Brand
                </h4>
                <p>{currentProduct.brand}</p>
              </div>
            )}

            <div>
              <h4 className="text-sm font-semibold text-muted-foreground">
                Price
              </h4>
              <p className="text-2xl font-bold">
                {formatPrice(selectedVariant?.price || currentProduct.price, selectedVariant?.currency || currentProduct.currency)}
              </p>
            </div>

            {/* Colors Display */}
            {currentProduct.colors && currentProduct.colors.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-muted-foreground mb-2">
                  Colors
                </h4>
                <div className="flex flex-wrap gap-2">
                  {currentProduct.colors.map((color) => (
                    <span
                      key={color}
                      className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-secondary text-secondary-foreground capitalize"
                    >
                      {color}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Color Selection (for variants) */}
            {productDetails && productDetails.variants.colors.length > 1 && (
              <div>
                <h4 className="text-sm font-semibold text-muted-foreground mb-2">
                  Select Color
                </h4>
                <div className="flex flex-wrap gap-2">
                  {productDetails.variants.colors.map((colorVariant) => (
                    <Button
                      key={colorVariant.color}
                      variant={selectedColor === colorVariant.color ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => {
                        setSelectedColor(colorVariant.color);
                        setSelectedSize(null);
                        setSelectedVariant(null);
                      }}
                    >
                      {colorVariant.color}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {/* Available Sizes */}
            {product.available_sizes && product.available_sizes.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-muted-foreground mb-2">
                  Available Sizes
                </h4>
                <div className="flex flex-wrap gap-2">
                  {product.available_sizes.map((size) => (
                    <span
                      key={size}
                      className="inline-flex items-center px-3 py-1 rounded-md text-sm font-medium border bg-background"
                    >
                      {size}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {currentProduct.category && (
              <div>
                <h4 className="text-sm font-semibold text-muted-foreground">
                  Category
                </h4>
                <p>{currentProduct.category}</p>
              </div>
            )}

            {currentProduct.fabrics && currentProduct.fabrics.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-muted-foreground">
                  Materials
                </h4>
                <p>{currentProduct.fabrics.join(', ')}</p>
              </div>
            )}

            {currentProduct.gender && (
              <div>
                <h4 className="text-sm font-semibold text-muted-foreground">
                  Gender
                </h4>
                <p className="capitalize">{currentProduct.gender}</p>
              </div>
            )}

            {currentProduct.partner_name && (
              <div>
                <h4 className="text-sm font-semibold text-muted-foreground">
                  Sold by
                </h4>
                <p>{currentProduct.partner_name}</p>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
