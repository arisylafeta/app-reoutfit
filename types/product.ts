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
  image_url: string | null;
  
  // Attributes (arrays)
  colors: string[] | null;
  fabrics: string[] | null;
  seasons: string[] | null;
  tags: string[] | null;
  dress_codes: string[] | null;
  
  // Classification
  gender: string | null;
  size: string | null;
  
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
