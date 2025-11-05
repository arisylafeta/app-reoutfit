'use client';

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search, X } from 'lucide-react';

interface ProductFiltersProps {
  search: string;
  category: string;
  gender: string;
  onSearchChange: (search: string) => void;
  onCategoryChange: (category: string) => void;
  onGenderChange: (gender: string) => void;
  onClearFilters: () => void;
}

export function ProductFilters({
  search,
  category,
  gender,
  onSearchChange,
  onCategoryChange,
  onGenderChange,
  onClearFilters,
}: ProductFiltersProps) {
  const hasActiveFilters = search !== '' || category !== 'all' || gender !== 'all';

  return (
    <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
      {/* Search - Left side */}
      <div className="relative w-full sm:w-auto sm:max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          type="text"
          placeholder="Search products..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Spacer to push filters to the right */}
      <div className="flex-1 hidden sm:block"></div>

      {/* Category, Gender and Clear - Right side */}
      <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap sm:flex-nowrap">
        <Select value={category} onValueChange={onCategoryChange}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            <SelectItem value="Tops">Tops</SelectItem>
            <SelectItem value="Bottoms">Bottoms</SelectItem>
            <SelectItem value="Dresses">Dresses</SelectItem>
            <SelectItem value="Footwear">Footwear</SelectItem>
            <SelectItem value="Accessories">Accessories</SelectItem>
            <SelectItem value="Outerwear">Outerwear</SelectItem>
          </SelectContent>
        </Select>

        <Select value={gender} onValueChange={onGenderChange}>
          <SelectTrigger className="w-full sm:w-[140px]">
            <SelectValue placeholder="Gender" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="male">Men</SelectItem>
            <SelectItem value="female">Women</SelectItem>
            <SelectItem value="unisex">Unisex</SelectItem>
          </SelectContent>
        </Select>

        {/* Clear filters */}
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearFilters}
            className="flex items-center gap-2 shrink-0"
          >
            <X className="h-4 w-4" />
            Clear
          </Button>
        )}
      </div>
    </div>
  );
}
