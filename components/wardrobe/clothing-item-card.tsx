'use client';

import { ClothingItem } from '@/types/wardrobe';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Edit2, Trash2, MoreHorizontal } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface ClothingItemCardProps {
  item: ClothingItem;
  onEdit?: (item: ClothingItem) => void;
  onDelete?: (item: ClothingItem) => void;
}

export function ClothingItemCard({
  item,
  onEdit,
  onDelete,
}: ClothingItemCardProps) {
  return (
    <Card className="group relative overflow-hidden transition-all hover:shadow-lg bg-white-soft p-0 gap-0">
      {/* Image */}
      <div className="relative aspect-square overflow-hidden bg-gray-soft">
        {item.image_url ? (
          <img
            src={item.image_url}
            alt={item.name}
            className="absolute inset-0 h-full w-full object-cover transition-transform group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-gray-400">
            No image
          </div>
        )}
        
        {/* Three-dot menu - visible on mobile, hover on desktop */}
        <div className="absolute top-2 right-2 z-10 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="sm"
                variant="outline"
                className="h-8 w-8 p-0 bg-white-soft/90 hover:bg-white-soft backdrop-blur-sm"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {onEdit && (
                <DropdownMenuItem onClick={() => onEdit(item)}>
                  <Edit2 className="h-4 w-4 mr-2" />
                  Edit
                </DropdownMenuItem>
              )}
              {onDelete && (
                <DropdownMenuItem 
                  onClick={() => onDelete(item)}
                  className="text-red-600 focus:text-red-600"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Content - Only Title, Brand, Category */}
      <div className="px-4 py-3">
        {/* Title */}
        <h3 className="text-sm font-semibold text-black-soft line-clamp-2">
          {item.name}
        </h3>

        {/* Brand */}
        {item.brand && (
          <p className="text-xs text-gray-600 line-clamp-1">{item.brand}</p>
        )}

        {/* Category badge - moved to bottom */}
        <div className="mt-2">
          <Badge variant="secondary" className="capitalize text-xs px-2 py-0.5">
            {item.category}
          </Badge>
        </div>
      </div>
    </Card>
  );
}
