'use client';

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Search, Filter, Loader2 } from 'lucide-react';
import { useProductFilters } from '@/hooks/use-product-filters';

interface ProductFiltersProps {
  search: string;
  categories: string[];
  genders: string[];
  onSearchChange: (search: string) => void;
  onCategoriesChange: (categories: string[]) => void;
  onGendersChange: (genders: string[]) => void;
  onClearFilters: () => void;
}

export function ProductFilters({
  search,
  categories,
  genders,
  onSearchChange,
  onCategoriesChange,
  onGendersChange,
  onClearFilters,
}: ProductFiltersProps) {
  const { filters, loading: filtersLoading } = useProductFilters();
  const hasActiveFilters = search !== '' || categories.length > 0 || genders.length > 0;

  const toggleCategory = (category: string) => {
    onCategoriesChange(
      categories.includes(category)
        ? categories.filter((c) => c !== category)
        : [...categories, category]
    );
  };

  const toggleGender = (gender: string) => {
    onGendersChange(
      genders.includes(gender)
        ? genders.filter((g) => g !== gender)
        : [...genders, gender]
    );
  };

  return (
    <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
      {/* Search - Left side */}
      <div className="relative w-full sm:w-auto sm:max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          type="text"
          placeholder="Search by name or brand..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Spacer to push filters to the right */}
      <div className="flex-1 hidden sm:block"></div>

      {/* Category, Gender and Clear - Right side */}
      <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap sm:flex-nowrap">
        {/* Category Filter */}
        {(filters.categories?.length ?? 0) > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="default" className="gap-2">
                {filtersLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Filter className="h-4 w-4" />
                )}
                Category
                {categories.length > 0 && (
                  <span className="ml-1 rounded-full bg-accent-2 px-1.5 text-xs text-white">
                    {categories.length}
                  </span>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              <DropdownMenuLabel>Filter by category</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {filters.categories.map((category) => (
                <DropdownMenuCheckboxItem
                  key={category}
                  checked={categories.includes(category)}
                  onCheckedChange={() => toggleCategory(category)}
                >
                  {category}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {/* Gender Filter */}
        {(filters.genders?.length ?? 0) > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="default" className="gap-2">
                {filtersLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Filter className="h-4 w-4" />
                )}
                Gender
                {genders.length > 0 && (
                  <span className="ml-1 rounded-full bg-accent-2 px-1.5 text-xs text-white">
                    {genders.length}
                  </span>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              <DropdownMenuLabel>Filter by gender</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {filters.genders.map((gender) => (
                <DropdownMenuCheckboxItem
                  key={gender}
                  checked={genders.includes(gender)}
                  onCheckedChange={() => toggleGender(gender)}
                >
                  {gender}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {/* Clear filters */}
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearFilters}
            className="flex items-center gap-2 shrink-0"
          >
            Clear filters
          </Button>
        )}
      </div>
    </div>
  );
}
