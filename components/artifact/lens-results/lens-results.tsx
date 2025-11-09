"use client";

import React, { useState, useMemo } from "react";
import { useStreamContext as useReactUIStreamContext } from "@langchain/langgraph-sdk/react-ui";
import { Package, AlertCircle, SlidersHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import posthog from "posthog-js";
import { ArtifactDrawer } from "@/components/artifact/shared/artifact-drawer";
import { ProductDetailContent } from "@/components/artifact/shared/product-detail-content";
import type { Product } from "@/types/product";
import { prefetchProductEnrichment } from "@/lib/prefetch-enrichment";

type LensResultsProps = {
  title?: string;
  summary?: string;
  imageUrl?: string;
  products?: Product[];           // Backward compatibility (retail products)
  retailProducts?: Product[];     // NEW: Explicit retail products list
  resaleProducts?: Product[];     // NEW: Explicit resale products list
  modelName?: string;
  isStreaming?: boolean;
  loadedCount?: number;
  totalCount?: number;
  error?: boolean;
  errorMessage?: string;
};

export function LensResults(props: LensResultsProps) {
  // Access meta passed via LoadExternalComponent
  const { meta } = useReactUIStreamContext();
  const artifactTuple = (meta as any)?.artifact ?? null;

  let ArtifactComp: any = null;
  let bag: any = null;
  if (Array.isArray(artifactTuple)) {
    [ArtifactComp, bag] = artifactTuple;
  }

  const setOpen = bag?.setOpen ?? (() => {});
  const isOpen = !!bag?.open;
  
  // Use new fields if available, fallback to products for backward compatibility
  const retailProducts = useMemo(
    () => props.retailProducts || props.products || [],
    [props.retailProducts, props.products]
  );
  const resaleProducts = useMemo(
    () => props.resaleProducts || [],
    [props.resaleProducts]
  );
  
  const hasRetail = retailProducts.length > 0;
  const hasResale = resaleProducts.length > 0;
  const hasProducts = hasRetail || hasResale;
  const hasError = props.error === true;

  // Tab state - default to retail if available, otherwise resale
  const [activeTab, setActiveTab] = useState<"retail" | "resale">(
    hasRetail ? "retail" : "resale"
  );
  
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
      posthog.capture('search_results_loaded', {
        product_count: retailProducts.length + resaleProducts.length,
        retail_count: retailProducts.length,
        resale_count: resaleProducts.length,
        has_error: hasError,
        search_title: props.title,
      });
      hasTrackedResults.current = true;
    }
  }, [hasProducts, hasError, retailProducts.length, resaleProducts.length, props.isStreaming, props.title]);

  React.useEffect(() => {
    if (hasError && !hasTrackedError.current) {
      posthog.capture('search_error', {
        error_message: props.errorMessage,
        search_title: props.title,
      });
      hasTrackedError.current = true;
    }
  }, [hasError, props.errorMessage, props.title]);

  // Reset tracking refs when title changes (new search)
  React.useEffect(() => {
    hasTrackedResults.current = false;
    hasTrackedError.current = false;
  }, [props.title]);
  
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

  // Get unique brands based on active tab
  const availableBrands = useMemo(() => {
    const brands = new Set<string>();
    const productsToCheck = activeTab === "retail" ? retailProducts : resaleProducts;
    productsToCheck.forEach((p: Product) => {
      if (p.brand) brands.add(p.brand);
    });
    return Array.from(brands).sort();
  }, [retailProducts, resaleProducts, activeTab]);

  // Convert Set to Array for stable dependency
  const selectedBrandsArray = useMemo(() => Array.from(selectedBrands), [selectedBrands]);
  
  // Filter and sort retail and resale products separately
  const filteredRetailProducts = useMemo(() => {
    let filtered = [...retailProducts];

    // Apply filters
    if (selectedBrandsArray.length > 0) {
      const brandsSet = new Set(selectedBrandsArray);
      filtered = filtered.filter(p => p.brand && brandsSet.has(p.brand));
    }
    
    if (inStockOnly) {
      filtered = filtered.filter(p => p.available === true);
    }

    // Sort products
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
        // Sort by position (lower position = more relevant)
        // For ranked products, use _score if available
        filtered.sort((a, b) => {
          const scoreA = (a as any)._score;
          const scoreB = (b as any)._score;
          if (scoreA !== undefined && scoreB !== undefined) {
            return scoreB - scoreA; // Higher score first
          }
          // Position not available, maintain current order
          return 0;
        });
        break;
    }

    return filtered;
  }, [retailProducts, selectedBrandsArray, inStockOnly, sortBy]);
  
  const filteredResaleProducts = useMemo(() => {
    let filtered = [...resaleProducts];

    // Apply filters
    if (selectedBrandsArray.length > 0) {
      const brandsSet = new Set(selectedBrandsArray);
      filtered = filtered.filter(p => p.brand && brandsSet.has(p.brand));
    }
    
    if (inStockOnly) {
      filtered = filtered.filter(p => p.available === true);
    }

    // Sort products
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
        // Sort by position (lower position = more relevant)
        // For ranked products, use _score if available
        filtered.sort((a, b) => {
          const scoreA = (a as any)._score;
          const scoreB = (b as any)._score;
          if (scoreA !== undefined && scoreB !== undefined) {
            return scoreB - scoreA; // Higher score first
          }
          // Position not available, maintain current order
          return 0;
        });
        break;
    }

    return filtered;
  }, [resaleProducts, selectedBrandsArray, inStockOnly, sortBy]);

  return (
    <>
      <div
        onClick={() => setOpen((o: boolean) => !o)}
        className={cn(
          "group w-full min-w-0 cursor-pointer overflow-hidden rounded-2xl border transition-all focus:outline-none focus-visible:ring-2",
          hasError 
            ? "border-red-200 bg-red-50 hover:bg-red-100 focus-visible:ring-red-300"
            : "border-gray-200 bg-white-soft hover:bg-gray-soft focus-visible:ring-gray-300",
          isOpen ? "p-3 md:p-3 rounded-xl shadow-xs hover:shadow-xs" : "p-5 md:p-6 shadow-sm hover:shadow-md",
        )}
        role="button"
        aria-label="Open lens search results"
      >
        <div className="flex w-full min-w-0 items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              {hasError ? (
                <AlertCircle className="h-5 w-5 text-red-500 shrink-0" />
              ) : (
                <Package className="h-5 w-5 text-gray-500 shrink-0" />
              )}
              <h3 className={cn(
                "font-semibold tracking-tight truncate",
                hasError ? "text-red-900" : "text-gray-900",
                isOpen ? "text-base md:text-sm" : "text-xl md:text-2xl",
              )}>
                {props.title ?? "Visual Search Results"}
              </h3>
            </div>
            {!isOpen && props.summary && (
              <p className={cn(
                "mt-2 text-sm",
                hasError ? "text-red-700" : "text-gray-600"
              )}>
                {props.summary}
              </p>
            )}
          </div>
          <Package
            aria-hidden
            className={cn(
              "h-5 w-5 text-gray-400 transition-transform shrink-0",
            )}
          />
        </div>

        {!isOpen && hasProducts && (
          <div className="mt-4 flex gap-2">
            {[...retailProducts, ...resaleProducts].slice(0, 5).map((product: Product, idx: number) => (
              <div
                key={idx}
                className="flex-1 aspect-square rounded-lg overflow-hidden bg-gray-100 border border-gray-200 min-w-0"
              >
                {product.image ? (
                  <img
                    src={product.image}
                    alt={product.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Package className="h-8 w-8 text-gray-400" />
                  </div>
                )}
              </div>
            ))}
            {(retailProducts.length + resaleProducts.length) > 5 && (
              <div className="flex-1 aspect-square rounded-lg bg-gray-100 border border-gray-200 flex items-center justify-center min-w-0">
                <span className="text-sm font-medium text-gray-600">
                  +{(retailProducts.length + resaleProducts.length) - 5}
                </span>
              </div>
            )}
          </div>
        )}

      </div>

      {ArtifactComp ? (
        <ArtifactComp title={props.title ?? "Visual Search Results"}>
          <div className="p-6 md:p-8 relative" data-lens-results-content>
            {/* Tabs */}
            {hasProducts && !hasError && (
              <div className="mb-6 border-b border-gray-200 dark:border-zinc-700">
                <div className="flex gap-1">
                  <button
                    onClick={() => {
                      setActiveTab("retail");
                      // Reset filters when switching tabs
                      setSelectedBrands(new Set());
                      setInStockOnly(false);
                      posthog.capture('tab_switched', {
                        tab: 'retail',
                        product_count: filteredRetailProducts.length,
                      });
                    }}
                    className={cn(
                      "px-4 py-2 text-sm font-medium border-b-2 transition-colors",
                      activeTab === "retail"
                        ? "border-blue-500 text-blue-600 dark:text-blue-400"
                        : "border-transparent text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200"
                    )}
                  >
                    New & Retail
                    <span className="ml-2 px-2 py-0.5 bg-gray-100 dark:bg-zinc-700 text-gray-700 dark:text-gray-300 text-xs rounded-full">
                      {filteredRetailProducts.length}
                    </span>
                  </button>
                  <button
                    onClick={() => {
                      setActiveTab("resale");
                      // Reset filters when switching tabs
                      setSelectedBrands(new Set());
                      setInStockOnly(false);
                      posthog.capture('tab_switched', {
                        tab: 'resale',
                        product_count: filteredResaleProducts.length,
                      });
                    }}
                    className={cn(
                      "px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2",
                      activeTab === "resale"
                        ? "border-blue-500 text-blue-600 dark:text-blue-400"
                        : "border-transparent text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200"
                    )}
                  >
                    Pre-Owned & Vintage
                    <span className="px-2 py-0.5 bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-200 text-xs rounded-full">
                      {filteredResaleProducts.length}
                    </span>
                  </button>
                </div>
              </div>
            )}

            {/* Filters and Sort Controls */}
            {hasProducts && !hasError && (
              <div className="mb-6 flex flex-wrap items-center gap-3">
                {/* Sort Dropdown */}
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Sort:</label>
                  <select
                    value={sortBy}
                    onChange={(e) => {
                      const newSort = e.target.value as any;
                      setSortBy(newSort);
                      posthog.capture('sort_changed', {
                        sort_by: newSort,
                        tab: activeTab,
                        product_count: activeTab === "retail" ? filteredRetailProducts.length : filteredResaleProducts.length,
                      });
                    }}
                    className="text-sm border border-gray-300 rounded-md px-3 py-1.5 bg-white dark:bg-zinc-800 dark:border-zinc-600 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="relevance">Relevance</option>
                    <option value="price-asc">Price: Low to High</option>
                    <option value="price-desc">Price: High to Low</option>
                    <option value="rating">Highest Rated</option>
                  </select>
                </div>

                {/* Filter Toggle */}
                <button
                  onClick={() => {
                    const newShowFilters = !showFilters;
                    setShowFilters(newShowFilters);
                    if (newShowFilters) {
                      posthog.capture('filters_opened', {
                        tab: activeTab,
                        product_count: activeTab === "retail" ? filteredRetailProducts.length : filteredResaleProducts.length,
                      });
                    }
                  }}
                  className="flex items-center gap-2 text-sm px-3 py-1.5 border border-gray-300 rounded-md bg-white hover:bg-gray-50 dark:bg-zinc-800 dark:border-zinc-600 dark:text-white dark:hover:bg-zinc-700"
                >
                  <SlidersHorizontal className="h-4 w-4" />
                  Filters
                  {(selectedBrands.size > 0 || inStockOnly) && (
                    <span className="ml-1 px-1.5 py-0.5 bg-blue-500 text-white text-xs rounded-full">
                      {selectedBrands.size + (inStockOnly ? 1 : 0)}
                    </span>
                  )}
                </button>

                {/* Results Count */}
                <span className="text-sm text-gray-600 dark:text-gray-400 ml-auto">
                  {activeTab === "retail" ? filteredRetailProducts.length : filteredResaleProducts.length} {((activeTab === "retail" ? filteredRetailProducts.length : filteredResaleProducts.length) === 1) ? 'result' : 'results'}
                </span>
              </div>
            )}

            {/* Streaming Status */}
            {props.isStreaming && (
              <div className="mb-4 flex items-center gap-2 text-sm text-gray-600">
                <div className="flex gap-1">
                  <div className="h-2 w-2 rounded-full bg-blue-500 animate-pulse"></div>
                  <div className="h-2 w-2 rounded-full bg-blue-500 animate-pulse delay-75"></div>
                  <div className="h-2 w-2 rounded-full bg-blue-500 animate-pulse delay-150"></div>
                </div>
                <span>
                  Loading products... {props.loadedCount || 0}
                  {props.totalCount ? ` / ${props.totalCount}` : ''}
                </span>
              </div>
            )}

            {/* Filter Panel */}
            {showFilters && hasProducts && !hasError && (
              <div className="mb-6 space-y-4">
                {/* Brand Filter */}
                {availableBrands.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">Brands</h4>
                      {selectedBrands.size > 0 && (
                        <button
                          onClick={() => setSelectedBrands(new Set())}
                          className="text-xs text-blue-600 hover:text-blue-700"
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
                            posthog.capture('brand_filter_toggled', {
                              brand: brand,
                              action: isAdding ? 'added' : 'removed',
                              total_brands_selected: newSet.size,
                            });
                          }}
                          className={cn(
                            "px-3 py-1.5 rounded-full text-sm whitespace-nowrap transition-colors border",
                            selectedBrands.has(brand)
                              ? "bg-blue-100 border-blue-300 text-blue-700 dark:bg-blue-900 dark:border-blue-700 dark:text-blue-200"
                              : "bg-white border-gray-300 text-gray-700 hover:bg-gray-50 dark:bg-zinc-800 dark:border-zinc-600 dark:text-white dark:hover:bg-zinc-700"
                          )}
                        >
                          {brand}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Availability Filter */}
                <div>
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Availability</h4>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        const newValue = !inStockOnly;
                        setInStockOnly(newValue);
                        posthog.capture('in_stock_filter_toggled', {
                          enabled: newValue,
                        });
                      }}
                      className={cn(
                        "px-3 py-1.5 rounded-full text-sm whitespace-nowrap transition-colors border",
                        inStockOnly
                          ? "bg-blue-100 border-blue-300 text-blue-700 dark:bg-blue-900 dark:border-blue-700 dark:text-blue-200"
                          : "bg-white border-gray-300 text-gray-700 hover:bg-gray-50 dark:bg-zinc-800 dark:border-zinc-600 dark:text-white dark:hover:bg-zinc-700"
                      )}
                    >
                      In stock only
                    </button>
                  </div>
                </div>

                {/* Clear All Filters */}
                {(selectedBrands.size > 0 || inStockOnly) && (
                  <button
                    onClick={() => {
                      setSelectedBrands(new Set());
                      setInStockOnly(false);
                    }}
                    className="text-sm text-blue-600 hover:text-blue-700 font-medium"
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
                  {props.errorMessage || "Unable to complete the visual search. Please try again."}
                </p>
                {props.imageUrl && (
                  <div className="mt-4">
                    <p className="text-xs text-gray-500 mb-2">Searched image:</p>
                    <div className="rounded-lg overflow-hidden border border-red-200 bg-gray-50 max-w-xs mx-auto">
                      <img
                        src={props.imageUrl}
                        alt="Search reference"
                        className="w-full h-auto"
                      />
                    </div>
                  </div>
                )}
              </div>
            ) : (filteredRetailProducts.length > 0 || filteredResaleProducts.length > 0) ? (
              <>
                {/* Active Tab Content */}
                {activeTab === "retail" ? (
                  filteredRetailProducts.length > 0 ? (
                    <div className="grid grid-cols-2 min-[1000px]:grid-cols-3 min-[1200px]:grid-cols-4 min-[1300px]:grid-cols-5 gap-4">
                      {filteredRetailProducts.map((product: Product, idx: number) => (
                        <ProductCard 
                          key={product.id || `retail-${idx}`} 
                          product={product}
                          onClick={() => {
                            console.log('[LENS] 🖱️ Product card clicked', {
                              productId: product.id,
                              productUrl: product.product_url,
                              productName: product.name,
                            });
                            
                            // Prefetch enrichment data immediately
                            console.log('[LENS] 📞 Calling prefetchProductEnrichment...');
                            prefetchProductEnrichment(product.id, product.product_url);
                            
                            console.log('[LENS] 🚪 Opening drawer...');
                            setSelectedProduct(product);
                            setIsDrawerOpen(true);
                            
                            posthog.capture('product_card_clicked', {
                              product_id: product.id,
                              product_name: product.name,
                              product_brand: product.brand,
                              product_price: product.price,
                              product_position: idx + 1,
                              product_category: 'retail',
                              in_stock: product.available,
                            });
                          }}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      <Package className="h-12 w-12 mx-auto mb-3 text-gray-400" />
                      <p>No retail products match your filters</p>
                      <button
                        onClick={() => {
                          setSelectedBrands(new Set());
                          setInStockOnly(false);
                        }}
                        className="mt-2 text-sm text-blue-600 hover:text-blue-700"
                      >
                        Clear filters
                      </button>
                    </div>
                  )
                ) : (
                  filteredResaleProducts.length > 0 ? (
                    <div className="grid grid-cols-2 min-[1000px]:grid-cols-3 min-[1200px]:grid-cols-4 min-[1300px]:grid-cols-5 gap-4">
                      {filteredResaleProducts.map((product: Product, idx: number) => (
                        <ProductCard 
                          key={product.id || `resale-${idx}`} 
                          product={product}
                          onClick={() => {
                            // Prefetch enrichment data immediately
                            prefetchProductEnrichment(product.id, product.product_url);
                            
                            setSelectedProduct(product);
                            setIsDrawerOpen(true);
                            posthog.capture('product_card_clicked', {
                              product_id: product.id,
                              product_name: product.name,
                              product_brand: product.brand,
                              product_price: product.price,
                              product_position: idx + 1,
                              product_category: 'resale',
                              in_stock: product.available,
                            });
                          }}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      <Package className="h-12 w-12 mx-auto mb-3 text-gray-400" />
                      <p>No pre-owned products match your filters</p>
                      <button
                        onClick={() => {
                          setSelectedBrands(new Set());
                          setInStockOnly(false);
                        }}
                        className="mt-2 text-sm text-blue-600 hover:text-blue-700"
                      >
                        Clear filters
                      </button>
                    </div>
                  )
                )}
              </>
            ) : hasProducts ? (
              <div className="text-center py-8 text-gray-500">
                <Package className="h-12 w-12 mx-auto mb-3 text-gray-400" />
                <p>No products match your filters</p>
                <button
                  onClick={() => {
                    setSelectedBrands(new Set());
                    setInStockOnly(false);
                  }}
                  className="mt-2 text-sm text-blue-600 hover:text-blue-700"
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
                <p>Searching for similar products...</p>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <Package className="h-12 w-12 mx-auto mb-3 text-gray-400" />
                <p>No products found</p>
              </div>
            )}
          </div>
          {/* Product Detail Drawer */}
          <ArtifactDrawer
            open={isDrawerOpen}
            onOpenChange={setIsDrawerOpen}
            title={selectedProduct?.name || "Product Details"}
          >
            {selectedProduct && (
              <ProductDetailContent
                product={selectedProduct}
                onClose={() => setIsDrawerOpen(false)}
                showReviews={true}
                eventPrefix="lens"
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
  const inStock = product.available;

  // Format price with currency symbol
  const formatPrice = (price: number, currency: string) => {
    // Standardize currency display
    const currencySymbol = currency.replace(/[^$£€¥]/g, '') || '$';
    return `${currencySymbol}${price.toFixed(0)}`;
  };

  return (
    <button
      onClick={onClick}
      className="group block rounded-lg border border-gray-200 bg-white hover:shadow-md transition-shadow overflow-hidden min-w-[180px] dark:bg-zinc-800 dark:border-zinc-700 text-left w-full"
    >
      {/* Product Image */}
      <div className="aspect-square bg-gray-100 relative overflow-hidden">
        {product.image ? (
          <img
            src={product.image}
            alt={product.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Package className="h-16 w-16 text-gray-400" />
          </div>
        )}
        
        {/* Stock badge overlay - only show if explicitly true or false */}
        {inStock === true && (
          <div className="absolute top-2 right-2">
            <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
              In Stock
            </span>
          </div>
        )}
        {inStock === false && (
          <div className="absolute top-2 right-2">
            <span className="px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">
              Out of Stock
            </span>
          </div>
        )}
      </div>

      {/* Product Info */}
      <div className="p-4">
        {/* Brand */}
        {product.brand && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1 truncate">{product.brand}</p>
        )}

        {/* Name */}
        <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2 line-clamp-2 min-h-[2.5rem]">
          {product.name}
        </h4>

        {/* Price */}
        {hasPrice && product.price && (
          <div className="text-lg font-bold text-gray-900">
            {formatPrice(product.price, product.currency || 'USD')}
          </div>
        )}
      </div>
    </button>
  );
}
