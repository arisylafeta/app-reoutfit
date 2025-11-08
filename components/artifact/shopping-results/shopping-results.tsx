"use client";

import React, { useState, useMemo } from "react";
import { useStreamContext as useReactUIStreamContext } from "@langchain/langgraph-sdk/react-ui";
import { ShoppingBag, AlertCircle, SlidersHorizontal, Package } from "lucide-react";
import { cn } from "@/lib/utils";
import posthog from "posthog-js";
import { ArtifactDrawer } from "@/components/artifact/shared/artifact-drawer";
import { ProductDetailContent } from "@/components/artifact/shared/product-detail-content";
import type { Product } from "@/types/product";

type ShoppingResultsProps = {
  title?: string;
  summary?: string;
  searchQuery?: string;
  products?: Product[];
  modelName?: string;
  isStreaming?: boolean;
  loadedCount?: number;
  totalCount?: number;
  error?: boolean;
  errorMessage?: string;
};

export function ShoppingResults(props: ShoppingResultsProps) {
  const { meta } = useReactUIStreamContext();
  const artifactTuple = (meta as any)?.artifact ?? null;

  let ArtifactComp: any = null;
  let bag: any = null;
  if (Array.isArray(artifactTuple)) {
    [ArtifactComp, bag] = artifactTuple;
  }

  const setOpen = bag?.setOpen ?? (() => {});
  const isOpen = !!bag?.open;
  const products = useMemo(() => props.products || [], [props.products]);
  const hasProducts = products.length > 0;
  const hasError = props.error === true;

  // Filter and sort state
  const [sortBy, setSortBy] = useState<"relevance" | "price-asc" | "price-desc" | "rating">("relevance");
  const [showFilters, setShowFilters] = useState(false);
  const [selectedBrands, setSelectedBrands] = useState<Set<string>>(new Set());
  const [inStockOnly, setInStockOnly] = useState(false);

  // Track search results loaded (using ref to prevent infinite loops)
  const hasTrackedResults = React.useRef(false);
  const hasTrackedError = React.useRef(false);

  React.useEffect(() => {
    if (hasProducts && !props.isStreaming && !hasTrackedResults.current) {
      posthog.capture('shopping_results_loaded', {
        product_count: products.length,
        has_error: hasError,
        search_query: props.searchQuery,
      });
      hasTrackedResults.current = true;
    }
  }, [hasProducts, hasError, products.length, props.isStreaming, props.searchQuery]);

  React.useEffect(() => {
    if (hasError && !hasTrackedError.current) {
      posthog.capture('shopping_error', {
        error_message: props.errorMessage,
        search_query: props.searchQuery,
      });
      hasTrackedError.current = true;
    }
  }, [hasError, props.errorMessage, props.searchQuery]);

  // Reset tracking refs when search query changes
  React.useEffect(() => {
    hasTrackedResults.current = false;
    hasTrackedError.current = false;
  }, [props.searchQuery]);
  
  // Drawer state
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Disable background scroll when drawer is open
  React.useEffect(() => {
    const artifactContent = document.querySelector('[data-artifact-content]');
    if (artifactContent) {
      if (isDrawerOpen) {
        artifactContent.classList.add('overflow-hidden');
      } else {
        artifactContent.classList.remove('overflow-hidden');
      }
    }
  }, [isDrawerOpen]);

  // Get unique brands
  const availableBrands = useMemo(() => {
    const brands = new Set<string>();
    products.forEach(p => {
      if (p.brand) brands.add(p.brand);
    });
    return Array.from(brands).sort();
  }, [products]);

  // Filter and sort products
  const filteredProducts = useMemo(() => {
    let filtered = [...products];

    if (selectedBrands.size > 0) {
      filtered = filtered.filter(p => p.brand && selectedBrands.has(p.brand));
    }
    
    if (inStockOnly) {
      filtered = filtered.filter(p => p.available === true);
    }

    switch (sortBy) {
      case "price-asc":
        filtered.sort((a, b) => (a.price || 0) - (b.price || 0));
        break;
      case "price-desc":
        filtered.sort((a, b) => (b.price || 0) - (a.price || 0));
        break;
      case "rating":
        // Rating not available in database Product type, sort by price instead
        filtered.sort((a, b) => (b.price || 0) - (a.price || 0));
        break;
      case "relevance":
      default:
        // Position not available, maintain current order
        break;
    }

    return filtered;
  }, [products, selectedBrands, inStockOnly, sortBy]);

  return (
    <>
      <div
        onClick={() => setOpen((o: boolean) => !o)}
        className={cn(
          "group w-full min-w-0 cursor-pointer overflow-hidden rounded-2xl border transition-all focus:outline-none focus-visible:ring-2",
          hasError 
            ? "border-red-200 bg-red-50 hover:bg-red-100 focus-visible:ring-red-300"
            : "border-accent-2/30 bg-gradient-to-br from-accent-1/10 to-accent-2/10 hover:from-accent-1/20 hover:to-accent-2/20 focus-visible:ring-accent-2",
          isOpen ? "p-3 md:p-3 rounded-xl shadow-xs hover:shadow-xs" : "p-5 md:p-6 shadow-sm hover:shadow-md",
        )}
        role="button"
        aria-label="Open shopping results"
      >
        <div className="flex w-full min-w-0 items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              {hasError ? (
                <AlertCircle className="h-5 w-5 text-red-500 shrink-0" />
              ) : (
                <ShoppingBag className="h-5 w-5 text-accent-2 shrink-0" />
              )}
              <h3 className={cn(
                "font-semibold tracking-tight truncate",
                hasError ? "text-red-900" : "text-gray-900",
                isOpen ? "text-base md:text-sm" : "text-xl md:text-2xl",
              )}>
                {props.title ?? "Shopping Results"}
              </h3>
            </div>
            {!isOpen && props.summary && (
              <p className={cn(
                "mt-2 text-sm",
                hasError ? "text-red-700" : "text-gray-700"
              )}>
                {props.summary}
              </p>
            )}
            {!isOpen && props.searchQuery && !hasError && (
              <p className="mt-1 text-xs text-gray-500">
                Searched for: <span className="font-medium">{props.searchQuery}</span>
              </p>
            )}
          </div>
          <ShoppingBag
            aria-hidden
            className={cn(
              "h-5 w-5 transition-transform shrink-0",
              hasError ? "text-red-400" : "text-accent-2"
            )}
          />
        </div>

        {!isOpen && hasProducts && (
          <div className="mt-4 grid grid-cols-6 gap-2">
            {products.slice(0, Math.min(products.length, 5)).map((product, idx) => (
              <div
                key={idx}
                className="aspect-square rounded-md overflow-hidden bg-white border border-gray-200 min-w-0 relative group/preview"
              >
                {product.image_url ? (
                  <>
                    <img
                      src={product.image_url}
                      alt={product.name}
                      className="w-full h-full object-cover"
                    />
                    {product.price && product.price > 0 && (
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-1.5 opacity-0 group-hover/preview:opacity-100 transition-opacity">
                        <p className="text-[10px] font-semibold text-white truncate">
                          ${product.price}
                        </p>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gray-50">
                    <Package className="h-6 w-6 text-gray-300" />
                  </div>
                )}
              </div>
            ))}
            {products.length > 6 && (
              <div className="aspect-square rounded-md bg-accent-2/10 border border-accent-2/30 flex items-center justify-center min-w-0">
                <span className="text-xs font-semibold text-accent-2">
                  +{products.length - 6}
                </span>
              </div>
            )}
          </div>
        )}

      </div>

      {ArtifactComp ? (
        <ArtifactComp title={props.title ?? "Shopping Results"}>
          <div className="p-6 md:p-8 relative" data-shopping-results-content>
            {/* Filters and Sort Controls */}
            {hasProducts && !hasError && (
              <div className="mb-6 flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Sort:</label>
                  <select
                    value={sortBy}
                    onChange={(e) => {
                      const newSort = e.target.value as any;
                      setSortBy(newSort);
                      posthog.capture('shopping_sort_changed', {
                        sort_by: newSort,
                        product_count: filteredProducts.length,
                      });
                    }}
                    className="text-sm border border-gray-300 rounded-md px-3 py-1.5 bg-white dark:bg-zinc-800 dark:border-zinc-600 dark:text-white focus:outline-none focus:ring-2 focus:ring-accent-2"
                  >
                    <option value="relevance">Relevance</option>
                    <option value="price-asc">Price: Low to High</option>
                    <option value="price-desc">Price: High to Low</option>
                    <option value="rating">Highest Rated</option>
                  </select>
                </div>

                <button
                  onClick={() => {
                    const newShowFilters = !showFilters;
                    setShowFilters(newShowFilters);
                    if (newShowFilters) {
                      posthog.capture('shopping_filters_opened', {
                        product_count: filteredProducts.length,
                      });
                    }
                  }}
                  className="flex items-center gap-2 text-sm px-3 py-1.5 border border-gray-300 rounded-md bg-white hover:bg-gray-50 dark:bg-zinc-800 dark:border-zinc-600 dark:text-white dark:hover:bg-zinc-700"
                >
                  <SlidersHorizontal className="h-4 w-4" />
                  Filters
                  {(selectedBrands.size > 0 || inStockOnly) && (
                    <span className="ml-1 px-1.5 py-0.5 bg-accent-2 text-white text-xs rounded-full">
                      {selectedBrands.size + (inStockOnly ? 1 : 0)}
                    </span>
                  )}
                </button>

                <span className="text-sm text-gray-600 dark:text-gray-400 ml-auto">
                  {filteredProducts.length} {filteredProducts.length === 1 ? 'result' : 'results'}
                </span>
              </div>
            )}

            {/* Streaming Status */}
            {props.isStreaming && (
              <div className="mb-4 flex items-center gap-2 text-sm text-gray-600">
                <div className="flex gap-1">
                  <div className="h-2 w-2 rounded-full bg-accent-2 animate-pulse"></div>
                  <div className="h-2 w-2 rounded-full bg-accent-2 animate-pulse delay-75"></div>
                  <div className="h-2 w-2 rounded-full bg-accent-2 animate-pulse delay-150"></div>
                </div>
                <span>
                  Loading products... {props.loadedCount || 0}
                  {props.totalCount ? ` / ${props.totalCount}` : ''}
                </span>
              </div>
            )}

            {/* Filter Panel */}
            {showFilters && hasProducts && !hasError && (
              <div className="mb-6 space-y-4 p-4 bg-gray-50 dark:bg-zinc-800/50 rounded-lg">
                {availableBrands.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">Brands</h4>
                      {selectedBrands.size > 0 && (
                        <button
                          onClick={() => setSelectedBrands(new Set())}
                          className="text-xs text-accent-2 hover:text-accent-2/80"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
                      {availableBrands.map(brand => (
                        <button
                          key={brand}
                          onClick={() => {
                            const newSet = new Set(selectedBrands);
                            const isAdding = !selectedBrands.has(brand);
                            if (selectedBrands.has(brand)) {
                              newSet.delete(brand);
                            } else {
                              newSet.add(brand);
                            }
                            setSelectedBrands(newSet);
                            posthog.capture('shopping_brand_filter_toggled', {
                              brand: brand,
                              action: isAdding ? 'added' : 'removed',
                              total_brands_selected: newSet.size,
                            });
                          }}
                          className={cn(
                            "px-3 py-1.5 rounded-full text-sm whitespace-nowrap transition-colors border",
                            selectedBrands.has(brand)
                              ? "bg-accent-2 border-accent-2 text-white"
                              : "bg-white border-gray-300 text-gray-700 hover:bg-gray-50 dark:bg-zinc-800 dark:border-zinc-600 dark:text-white dark:hover:bg-zinc-700"
                          )}
                        >
                          {brand}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {(selectedBrands.size > 0 || inStockOnly) && (
                  <button
                    onClick={() => {
                      setSelectedBrands(new Set());
                      setInStockOnly(false);
                    }}
                    className="text-sm text-accent-2 hover:text-accent-2/80 font-medium"
                  >
                    Clear all filters
                  </button>
                )}
              </div>
            )}

            {/* Error State */}
            {hasError ? (
              <div className="text-center py-8">
                <AlertCircle className="h-12 w-12 mx-auto mb-3 text-red-500" />
                <h4 className="text-lg font-medium text-red-900 mb-2">Search Failed</h4>
                <p className="text-sm text-red-700 max-w-md mx-auto">
                  {props.errorMessage || "Unable to complete the shopping search. Please try again."}
                </p>
              </div>
            ) : filteredProducts.length > 0 ? (
              <div className="grid grid-cols-2 min-[1000px]:grid-cols-3 min-[1200px]:grid-cols-4 min-[1300px]:grid-cols-5 gap-4">
                {filteredProducts.map((product, idx) => (
                  <ProductCard 
                    key={product.id || idx} 
                    product={product}
                    onClick={() => {
                      setSelectedProduct(product);
                      setIsDrawerOpen(true);
                      posthog.capture('shopping_product_clicked', {
                        product_id: product.id,
                        product_name: product.name,
                        product_brand: product.brand,
                        product_price: product.price,
                        product_position: idx + 1,
                      });
                    }}
                  />
                ))}
              </div>
            ) : hasProducts ? (
              <div className="text-center py-8 text-gray-500">
                <Package className="h-12 w-12 mx-auto mb-3 text-gray-400" />
                <p>No products match your filters</p>
                <button
                  onClick={() => {
                    setSelectedBrands(new Set());
                    setInStockOnly(false);
                  }}
                  className="mt-2 text-sm text-accent-2 hover:text-accent-2/80"
                >
                  Clear filters
                </button>
              </div>
            ) : props.isStreaming ? (
              <div className="text-center py-8 text-gray-500">
                <div className="flex gap-1 justify-center mb-3">
                  <div className="h-3 w-3 rounded-full bg-gray-400 animate-pulse"></div>
                  <div className="h-3 w-3 rounded-full bg-gray-400 animate-pulse delay-75"></div>
                  <div className="h-3 w-3 rounded-full bg-gray-400 animate-pulse delay-150"></div>
                </div>
                <p>Searching for products...</p>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <Package className="h-12 w-12 mx-auto mb-3 text-gray-400" />
                <p>No products found</p>
              </div>
            )}
          </div>
          <ArtifactDrawer
            open={isDrawerOpen}
            onOpenChange={setIsDrawerOpen}
            title={selectedProduct?.name || "Product Details"}
          >
            {selectedProduct && (
              <ProductDetailContent
                product={selectedProduct}
                onClose={() => setIsDrawerOpen(false)}
                showReviews={false}
                eventPrefix="shopping"
              />
            )}
          </ArtifactDrawer>
        </ArtifactComp>
      ) : null}
    </>
  );
}

function ProductCard({ product, onClick }: { product: Product; onClick?: () => void }) {
  const hasPrice = product.price !== null && product.price > 0;

  const formatPrice = (price: number, currency: string) => {
    const currencySymbol = currency.replace(/[^$£€¥]/g, '') || '$';
    return `${currencySymbol}${price.toFixed(0)}`;
  };

  return (
    <button
      onClick={onClick}
      className="group block rounded-lg border border-gray-200 bg-white hover:shadow-md hover:border-accent-2/50 transition-all overflow-hidden min-w-[180px] dark:bg-zinc-800 dark:border-zinc-700 text-left w-full"
    >
      <div className="aspect-square bg-gray-100 relative overflow-hidden">
        {product.image_url ? (
          <img
            src={product.image_url}
            alt={product.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Package className="h-16 w-16 text-gray-400" />
          </div>
        )}
        
        {product.available === true && (
          <div className="absolute top-2 right-2">
            <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
              In Stock
            </span>
          </div>
        )}
      </div>

      <div className="p-4">
        {product.brand && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1 truncate">{product.brand}</p>
        )}

        <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2 line-clamp-2 min-h-[2.5rem]">
          {product.name}
        </h4>

        {hasPrice ? (
          <div className="flex items-baseline gap-1">
            <span className="text-lg font-semibold text-gray-900 dark:text-white">
              {formatPrice(product.price!, product.currency || 'USD')}
            </span>
          </div>
        ) : (
          <p className="text-sm text-gray-500 dark:text-gray-400">Price not available</p>
        )}

        {/* Rating not available in database Product type */}
      </div>
    </button>
  );
}
