// Affiliate product type matching database schema
export interface Product {
  // Core identification
  id: string;
  partner_id: string;
  external_id: string;
  product_group_id: string | null; // NEW: Groups size variants together
  
  // Product information
  name: string;
  category: string | null;
  brand: string | null;
  
  // Pricing
  price: number | null;
  currency: string | null;
  
  // Media
  product_url: string;
  image: string | null;
  image_url?: string; // Alias for image (used by agent search results)
  
  // Reviews & Ratings (from search results)
  rating?: number;
  reviews?: number;
  source_icon?: string;
  
  // Attributes (arrays)
  colors: string[] | null;
  fabrics: string[] | null;
  seasons: string[] | null;
  tags: string[] | null;
  dress_codes: string[] | null;
  
  // Classification
  gender: string | null;
  size: string | null;
  role?: string; // Product role/type from AI categorization
  
  // Metadata
  metadata: Record<string, any> | null;
  available: boolean;
  
  // Timestamps
  created_at: string;
  updated_at: string;
  
  // Joined data (from affiliate_partners)
  partner_name?: string;
  partner_website?: string;
  
  // Variant information (added by API)
  available_sizes?: string[]; // NEW: All available sizes for this product
  variant_count?: number; // NEW: Total number of size variants
  
  // SerpAPI Immersive Product Integration
  immersive_product_token?: string; // Token for immersive API call
  immersive_data?: ImmersiveProductData; // Cached immersive data
}

export interface AffiliatePartner {
  id: string;
  name: string;
  api_slug: string;
  website_url: string | null;
  commission_rate: number | null;
  created_at: string;
  updated_at: string;
}

export interface ProductsResponse {
  products: Product[];
  total: number;
  hasMore: boolean;
  offset: number;
  limit: number;
}

export interface ProductVariant {
  id: string;
  size: string | null;
  price: number | null;
  currency: string | null;
  product_url: string;
  available: boolean;
}

export interface ColorVariant {
  color: string;
  image_url: string | null;
  product_group_id: string | null;
  available_sizes: string[];
  variants: ProductVariant[];
}

export interface ProductVariants {
  colors: ColorVariant[];
  all_sizes: string[];
  all_colors: string[];
  total_variants: number;
}

export interface ProductDetailResponse {
  product: Product;
  variants: ProductVariants;
}

export interface ProductsError {
  error: string;
  code?: string;
}

/**
 * Product with search scoring information
 */
export interface ScoredProduct extends Product {
  semanticScore?: number;
  textScore?: number;
  hybridScore?: number;
}

/**
 * Search API response
 */
export interface SearchResponse {
  products: ScoredProduct[];
  total: number;
  hasMore: boolean;
  offset: number;
  limit: number;
  searchType: 'filter-only' | 'hybrid' | 'text-fallback';
  breakdown?: {
    semanticCount: number;
    textCount: number;
    mergedCount: number;
    threshold: number;
  };
  warning?: string;
}

/**
 * SerpAPI Immersive Product Data Types
 */

export interface ImmersiveProductData {
  // Product Details
  title: string;
  brand?: string;
  description?: string;
  rating?: number;
  reviews?: number;
  price_range?: string;
  
  // Store Information
  stores: ProductStore[];
  stores_next_page_token?: string;
  
  // Reviews
  user_reviews?: UserReview[];
  critic_ratings?: CriticRating[];
  ratings?: RatingDistribution[];
  
  // Media
  thumbnails?: string[];
  videos?: ProductVideo[];
  reviews_images?: string[];
  
  // Additional Info
  about_the_product?: AboutProduct;
  top_insights?: TopInsight[];
  variants?: ProductVariantInfo[];
  discussions_and_forums?: DiscussionForum[];
  related_searches?: RelatedSearch[];
}

export interface ProductStore {
  name: string;
  logo: string;
  link: string; // Direct retailer link
  title: string;
  rating?: number;
  reviews?: number;
  price: string;
  extracted_price: number;
  original_price?: string;
  extracted_original_price?: number;
  discount?: string;
  shipping?: string;
  shipping_extracted?: number;
  estimated_tax?: string;
  extracted_estimated_tax?: number;
  total?: string;
  extracted_total?: number;
  payment_methods?: string;
  details_and_offers?: string[];
}

export interface UserReview {
  title: string;
  text: string;
  user_name: string;
  source: string;
  rating: number;
  date: string;
  icon?: string;
  images?: string[];
}

export interface CriticRating {
  link: string;
  name: string;
  rating: string;
}

export interface RatingDistribution {
  stars: number;
  amount: number;
}

export interface ProductVideo {
  title: string;
  link: string;
  source: string;
  channel?: string;
  duration?: string;
  thumbnail: string;
  preview?: string;
}

export interface AboutProduct {
  title: string;
  link: string;
  displayed_link?: string;
  icon?: string;
  description: string;
  features?: Array<{ title: string; value: string }>;
}

export interface TopInsight {
  title: string;
  subtitle?: string;
  items: InsightItem[];
}

export interface InsightItem {
  snippet?: string;
  key_point?: string;
  pros?: string[];
  cons?: string[];
  icon?: string;
  link?: string;
  source?: string;
  title?: string;
  date?: string;
  timestamp?: string;
  thumbnail?: string;
  user?: string;
}

export interface ProductVariantInfo {
  title: string;
  items: Array<{
    name: string;
    selected?: boolean;
    available?: boolean;
    serpapi_link?: string;
  }>;
}

export interface DiscussionForum {
  title: string;
  link: string;
  source: string;
  icon?: string;
  date?: string;
  items?: Array<{
    snippet: string;
    link: string;
  }>;
}

export interface RelatedSearch {
  query: string;
  link: string;
}
