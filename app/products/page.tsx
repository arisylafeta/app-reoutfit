'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ChatHeader } from '@/components/chat/chat-header';
import { useChatSidebar } from '@/hooks/use-chat-sidebar';
import { ProductGrid } from '@/components/products/product-grid';
import { ProductDetailsModal } from '@/components/products/product-details-modal';
import { ProductFilters } from '@/components/products/product-filters';
import { useProducts } from '@/hooks/use-products';
import { useDebounce } from '@/hooks/use-debounce';
import { Product } from '@/types/product';
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from '@/components/ui/empty';

export default function ProductsPage() {
  const router = useRouter();
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [categories, setCategories] = useState<string[]>([]);
  const [genders, setGenders] = useState<string[]>([]);

  // Debounce search to avoid excessive API calls (500ms delay)
  const debouncedSearch = useDebounce(search, 500);

  const { chatHistoryOpen, toggleSidebar, isLargeScreen } = useChatSidebar();
  const { products, loading, error, hasMore, loadMore } = useProducts({
    categories: categories.length > 0 ? categories : undefined,
    genders: genders.length > 0 ? genders : undefined,
    search: debouncedSearch || undefined,
  });

  const handleProductClick = (product: Product) => {
    setSelectedProduct(product);
    setModalOpen(true);
  };

  const handleModalClose = () => {
    setModalOpen(false);
    setSelectedProduct(null);
  };

  const handleClearFilters = () => {
    setSearch('');
    setCategories([]);
    setGenders([]);
  };

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <ChatHeader
        chatStarted={true}
        isOverlayLayout={false}
        isLargeScreen={isLargeScreen}
        chatHistoryOpen={chatHistoryOpen}
        onToggleSidebar={toggleSidebar}
        onNewThread={() => router.push('/')}
        opened={chatHistoryOpen && isLargeScreen}
      />

      {/* Title Section with Blob Background */}
      <div className="bg-white pt-12 pb-8">
        <div className="max-w-9xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          {/* Blob SVG Background */}
          <div className="absolute inset-0 pointer-events-none opacity-20">
            <svg
              viewBox="0 0 200 200"
              xmlns="http://www.w3.org/2000/svg"
              className="absolute -top-20 -right-10 w-64 h-64"
            >
              <path
                fill="#BFB4DC"
                d="M46.5,-44.6C57.2,-35.9,60.7,-17.9,57.1,-3.6C53.5,10.8,42.9,21.6,32.3,32.7C21.6,43.8,10.8,55.2,-5.3,60.5C-21.4,65.8,-42.7,64.9,-56.7,53.8C-70.7,42.7,-77.3,21.4,-73.8,3.5C-70.3,-14.4,-56.7,-28.7,-42.7,-37.5C-28.7,-46.3,-14.4,-49.6,1.8,-51.3C17.9,-53.1,35.9,-53.4,46.5,-44.6Z"
                transform="translate(100 100)"
              />
            </svg>
          </div>

          <div className="relative z-10">
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-foreground leading-tight mb-3">
              Discover{' '}
              <span className="bg-gradient-to-r from-accent-1 to-accent-2 bg-clip-text text-transparent">
                Products
              </span>
            </h1>
            <p className="text-base sm:text-lg text-muted-foreground">
              Browse fashion items from our affiliate partners
            </p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white">
        <div className="max-w-9xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <ProductFilters
            search={search}
            categories={categories}
            genders={genders}
            onSearchChange={setSearch}
            onCategoriesChange={setCategories}
            onGendersChange={setGenders}
            onClearFilters={handleClearFilters}
          />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto bg-white">
        <div className="max-w-9xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {!loading && products.length === 0 && (
            <Empty className="py-12">
              <EmptyHeader>
                <EmptyMedia>
                  <img
                    src="/products.png"
                    alt="No products"
                    className="w-[200px] h-[200px] opacity-80"
                  />
                </EmptyMedia>
                <EmptyTitle>
                  {search || categories.length > 0 || genders.length > 0
                    ? 'No products match your filters'
                    : 'No products available'}
                </EmptyTitle>
                <EmptyDescription>
                  {search || categories.length > 0 || genders.length > 0
                    ? 'Try adjusting your search or filters to find what you\'re looking for.'
                    : 'Check back later for new fashion items.'}
                </EmptyDescription>
              </EmptyHeader>
              {(search || categories.length > 0 || genders.length > 0) && (
                <Button onClick={handleClearFilters} size="lg">
                  Clear Filters
                </Button>
              )}
            </Empty>
          )}

          <ProductGrid
            products={products}
            loading={loading && products.length === 0}
            onProductClick={handleProductClick}
          />

          {hasMore && !loading && (
            <div className="mt-8 flex justify-center">
              <Button onClick={loadMore} size="lg">
                Load More Products
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Product Details Modal */}
      <ProductDetailsModal
        product={selectedProduct}
        open={modalOpen}
        onClose={handleModalClose}
      />
    </div>
  );
}
