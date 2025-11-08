'use client';

import React, { useState, useMemo } from 'react';
import { ArtifactDrawer } from '@/components/artifact/shared/artifact-drawer';
import { ProductsDrawerGrid } from '@/components/products/products-drawer-grid';
import { useProducts } from '@/hooks/use-products';
import { useProductFilters } from '@/hooks/use-product-filters';
import { useDebounce } from '@/hooks/use-debounce';
import { useStudio } from '@/providers/studio-provider';
import { Product } from '@/types/product';
import { toast } from 'sonner';
import posthog from 'posthog-js';
import { getProductRole, OutfitRole } from '@/types/outfit-roles';
import { Input } from '@/components/ui/input';
import { Search, Filter, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface StudioProductDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Studio Product Drawer Component
 * Displays products that can be added to the studio for outfit composition
 * Features smart suggestions based on missing outfit roles, search, and filters
 */
export function StudioProductDrawer({
  open,
  onOpenChange,
}: StudioProductDrawerProps) {
  const { addToSelected, state } = useStudio();

  // Search and filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedGenders, setSelectedGenders] = useState<string[]>([]);

  // Debounce search to avoid excessive API calls (500ms delay)
  const debouncedSearchQuery = useDebounce(searchQuery, 500);

  // Fetch products with server-side filtering
  const { products, loading, hasMore, loadMore } = useProducts({
    search: debouncedSearchQuery || undefined,
    categories: selectedCategories.length > 0 ? selectedCategories : undefined,
    genders: selectedGenders.length > 0 ? selectedGenders : undefined,
  });

  // Calculate missing outfit roles for smart suggestions
  const missingRoles = useMemo(() => {
    const { currentOutfit } = state;

    // Count current roles
    const roleCounts: Record<string, number> = {};
    currentOutfit.forEach((product) => {
      const role = getProductRole(product.sourceData);
      roleCounts[role] = (roleCounts[role] || 0) + 1;
    });

    // Determine which roles are still needed
    const missing: OutfitRole[] = [];

    // Check for missing core items (mutually exclusive groups)
    const hasTop = roleCounts['top'] > 0;
    const hasBottom = roleCounts['bottom'] > 0;
    const hasDress = roleCounts['dress'] > 0;
    const hasFullbody = roleCounts['fullbody'] > 0;

    // If no core item (top+bottom, dress, or fullbody), suggest all core options
    if (!hasTop && !hasDress && !hasFullbody) {
      missing.push('top');
    }
    if (!hasBottom && !hasDress && !hasFullbody) {
      missing.push('bottom');
    }
    if (!hasDress && !hasTop && !hasBottom && !hasFullbody) {
      missing.push('dress', 'fullbody');
    }

    // Check for missing layer items
    if (!roleCounts['outerwear']) {
      missing.push('outerwear');
    }
    if (!roleCounts['footwear']) {
      missing.push('footwear');
    }
    if ((roleCounts['accessory'] || 0) < 3) {
      missing.push('accessory');
    }

    return missing;
  }, [state]);

  // Get dynamic filter options from database
  const { filters: availableFilters, loading: filtersLoading } = useProductFilters();

  // Sort products by relevance: missing roles first (client-side optimization)
  const sortedProducts = useMemo(() => {
    if (products.length === 0) return products;

    const sorted = [...products];
    sorted.sort((a, b) => {
      const roleA = getProductRole({ category: a.category || undefined });
      const roleB = getProductRole({ category: b.category || undefined });

      const aIsMissing = missingRoles.includes(roleA);
      const bIsMissing = missingRoles.includes(roleB);

      // Prioritize products that match missing roles
      if (aIsMissing && !bIsMissing) return -1;
      if (!aIsMissing && bIsMissing) return 1;

      return 0;
    });

    return sorted;
  }, [products, missingRoles]);

  // Toggle category filter
  const toggleCategory = (category: string) => {
    setSelectedCategories((prev) =>
      prev.includes(category)
        ? prev.filter((c) => c !== category)
        : [...prev, category]
    );
  };

  // Toggle gender filter
  const toggleGender = (gender: string) => {
    setSelectedGenders((prev) =>
      prev.includes(gender)
        ? prev.filter((g) => g !== gender)
        : [...prev, gender]
    );
  };

  // Clear all filters
  const clearFilters = () => {
    setSearchQuery('');
    setSelectedCategories([]);
    setSelectedGenders([]);
  };

  const hasActiveFilters =
    searchQuery.trim() ||
    selectedCategories.length > 0 ||
    selectedGenders.length > 0;

  const handleProductClick = (product: Product) => {
    // Transform database Product to Studio Product format
    const studioProduct = {
      id: product.id,
      title: product.name,
      brand: product.brand || 'Unknown',
      image: product.image_url || '',
      sourceData: {
        ...product,
        // Map fields for consistency with artifact products
        image: product.image_url,
        image_full: product.image_url,
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
      } as Record<string, any>,
    };

    // Add to selected products
    addToSelected(studioProduct);

    // Close the drawer
    onOpenChange(false);

    // Show success message
    toast.success(`Added "${product.name}" to selected items`);

    // Track the event
    posthog.capture('studio_product_selected', {
      feature: 'studio',
      product_id: product.id,
      product_name: product.name,
      product_brand: product.brand,
      product_price: product.price,
    });
  };

  return (
    <ArtifactDrawer
      open={open}
      onOpenChange={onOpenChange}
      title="Browse Products"
    >
      <div className="@container flex flex-col h-full">
        {/* Header with smart suggestions hint */}
        <div className="px-6 pt-6 pb-4 border-b border-gray-soft">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold mb-1">Browse Products</h2>
              {missingRoles.length > 0 && state.currentOutfit.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  Showing suggestions for:{' '}
                  <span className="font-medium text-accent-2">
                    {missingRoles
                      .slice(0, 3)
                      .map((role) => role.charAt(0).toUpperCase() + role.slice(1))
                      .join(', ')}
                    {missingRoles.length > 3 && ', ...'}
                  </span>
                </p>
              )}
            </div>
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="text-xs"
              >
                Clear filters
              </Button>
            )}
          </div>

          {/* Search and filters in same row */}
          <div className="flex gap-3">
            {/* Search bar */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                type="text"
                placeholder="Search by name or brand..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Category filter */}
            {(availableFilters.categories?.length ?? 0) > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="default" className="gap-2">
                    {filtersLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Filter className="h-4 w-4" />
                    )}
                    Category
                    {selectedCategories.length > 0 && (
                      <span className="ml-1 rounded-full bg-accent-2 px-1.5 text-xs text-white">
                        {selectedCategories.length}
                      </span>
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-56">
                  <DropdownMenuLabel>Filter by category</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {availableFilters.categories.map((category) => (
                    <DropdownMenuCheckboxItem
                      key={category}
                      checked={selectedCategories.includes(category)}
                      onCheckedChange={() => toggleCategory(category)}
                    >
                      {category}
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {/* Gender filter */}
            {(availableFilters.genders?.length ?? 0) > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="default" className="gap-2">
                    {filtersLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Filter className="h-4 w-4" />
                    )}
                    Gender
                    {selectedGenders.length > 0 && (
                      <span className="ml-1 rounded-full bg-accent-2 px-1.5 text-xs text-white">
                        {selectedGenders.length}
                      </span>
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-56">
                  <DropdownMenuLabel>Filter by gender</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {availableFilters.genders.map((gender) => (
                    <DropdownMenuCheckboxItem
                      key={gender}
                      checked={selectedGenders.includes(gender)}
                      onCheckedChange={() => toggleGender(gender)}
                    >
                      {gender}
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>

        {/* Products grid */}
        <div className="flex-1 overflow-y-auto p-6">
          {!loading && sortedProducts.length === 0 && (
            <div className="text-center py-12">
              <p className="text-sm text-gray-500 mb-2">
                {hasActiveFilters
                  ? 'No products match your filters'
                  : 'No products available at the moment'}
              </p>
              {hasActiveFilters && (
                <Button variant="outline" size="sm" onClick={clearFilters}>
                  Clear filters
                </Button>
              )}
            </div>
          )}

          <ProductsDrawerGrid
            products={sortedProducts}
            loading={loading && sortedProducts.length === 0}
            onProductClick={handleProductClick}
          />

          {/* Load More Button */}
          {hasMore && !loading && sortedProducts.length > 0 && (
            <div className="mt-6 flex justify-center">
              <Button onClick={loadMore} variant="outline" size="default">
                Load More Products
              </Button>
            </div>
          )}
        </div>
      </div>
    </ArtifactDrawer>
  );
}
