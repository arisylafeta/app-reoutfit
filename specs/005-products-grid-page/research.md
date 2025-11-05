# Phase 0: Research & Technical Decisions

**Feature**: Products Grid Page  
**Date**: 2025-10-28  
**Status**: Complete

## Overview

This document captures technical research and decisions made for implementing the products grid page feature. All decisions prioritize consistency with existing codebase patterns and reuse of established components.

## Technical Decisions

### 1. Page Routing Strategy

**Decision**: Use Next.js App Router with `/app/products/page.tsx`

**Rationale**:
- Project already uses Next.js 15.3.2 with App Router
- Consistent with existing pages (wardrobe, lookbook)
- Provides automatic code splitting and optimized loading
- Server components by default for better performance

**Alternatives Considered**:
- Pages Router: Rejected - project has migrated to App Router
- Client-side routing only: Rejected - loses SEO and SSR benefits

### 2. Data Fetching Pattern

**Decision**: Custom React hook (`use-products.ts`) + API route (`/api/products`)

**Rationale**:
- Matches existing pattern used in `use-wardrobe.ts`
- Separates data fetching logic from UI components
- Enables easy testing and reusability
- API route provides server-side Supabase queries with proper authentication

**Alternatives Considered**:
- Direct Supabase client calls from components: Rejected - exposes credentials, harder to test
- Server components with direct DB access: Rejected - need client interactivity for modals and filters
- React Query/SWR: Rejected - adds new dependency, existing pattern works well

### 3. Component Architecture

**Decision**: Three-component structure (Grid, Card, Modal)

**Rationale**:
- Mirrors successful wardrobe component pattern (`ClothingGrid`, `ClothingItemCard`)
- Clear separation of concerns
- Each component independently testable
- Modal as separate component allows reuse and lazy loading

**Component Breakdown**:
```
ProductGrid (container)
  └─> ProductCard (repeating item)
        └─> ProductDetailsModal (on click)
```

**Alternatives Considered**:
- Single monolithic component: Rejected - harder to test and maintain
- Card with inline details (no modal): Rejected - spec requires modal pattern

### 4. State Management

**Decision**: React useState + custom hook (no global state)

**Rationale**:
- Product data is page-specific, doesn't need global access
- Matches existing wardrobe page pattern
- Simpler than Redux/Zustand for this use case
- Custom hook encapsulates all state logic

**State Structure**:
```typescript
{
  products: Product[],
  loading: boolean,
  error: string | null,
  hasMore: boolean,
  offset: number
}
```

**Alternatives Considered**:
- Zustand global store: Rejected - unnecessary complexity for page-local data
- Context API: Rejected - no need to share state across multiple pages

### 5. Styling Approach

**Decision**: TailwindCSS classes matching wardrobe page patterns

**Rationale**:
- Project uses TailwindCSS throughout
- Wardrobe page provides proven responsive grid pattern
- Reuse existing color scheme and spacing
- No additional CSS files needed

**Key Patterns to Reuse**:
- Grid: `grid grid-cols-2 md:grid-cols-4 2xl:grid-cols-5 gap-6`
- Container: `max-w-9xl mx-auto px-4 sm:px-6 lg:px-8`
- Header with blob background (copy from wardrobe)
- Empty state component structure

**Alternatives Considered**:
- CSS Modules: Rejected - inconsistent with project style
- Styled Components: Rejected - not used in project

### 6. Image Handling

**Decision**: Next.js Image component with placeholder fallback

**Rationale**:
- Automatic optimization and lazy loading
- Built-in placeholder support
- Responsive image sizing
- Already used throughout the project

**Implementation**:
```typescript
<Image
  src={product.image_url || '/placeholder-product.png'}
  alt={product.name}
  fill
  className="object-cover"
  sizes="(max-width: 768px) 50vw, (max-width: 1200px) 25vw, 20vw"
/>
```

**Alternatives Considered**:
- Standard `<img>` tags: Rejected - loses optimization benefits
- External image service: Rejected - adds dependency and latency

### 7. Modal Implementation

**Decision**: shadcn/ui Dialog component

**Rationale**:
- Project already uses shadcn/ui components
- Accessible by default (ARIA, keyboard navigation)
- Handles focus trap and ESC key
- Consistent with existing modals in the app

**Alternatives Considered**:
- Custom modal: Rejected - reinventing the wheel, accessibility concerns
- Headless UI: Rejected - shadcn/ui already provides this functionality

### 8. Pagination Strategy

**Decision**: Offset-based pagination with "Load More" button

**Rationale**:
- Simple to implement with Supabase
- Works well with 10,000 products
- Matches user expectation for product browsing
- Can upgrade to infinite scroll later if needed

**API Parameters**:
```typescript
GET /api/products?limit=50&offset=0
```

**Alternatives Considered**:
- Cursor-based pagination: Rejected - more complex, offset is sufficient for this scale
- Infinite scroll: Rejected - can add later, button is simpler MVP
- Load all products: Rejected - poor performance with 10,000 products

### 9. Error Handling

**Decision**: Toast notifications + inline error states

**Rationale**:
- Project uses Sonner for toast notifications
- Inline errors for permanent issues (no products, network error)
- Toasts for transient actions (add to wardrobe failed)
- Consistent with wardrobe page error handling

**Alternatives Considered**:
- Error boundaries only: Rejected - need user-friendly messages
- Alert dialogs: Rejected - too intrusive for minor errors

### 10. Testing Strategy

**Decision**: Playwright E2E + React Testing Library unit tests

**Rationale**:
- Project already has Playwright setup
- E2E tests verify complete user flows
- Unit tests for individual component logic
- Matches existing test patterns

**Test Coverage**:
- E2E: Navigate to page, click card, open modal, click buy button
- Unit: Product card rendering, empty states, loading states
- Integration: API route responses, Supabase queries

**Alternatives Considered**:
- Jest only: Rejected - need E2E coverage for user flows
- Cypress: Rejected - Playwright already configured

## Database Queries

### Products List Query

```sql
SELECT 
  p.id,
  p.name,
  p.brand,
  p.price,
  p.currency,
  p.image_url,
  p.product_url,
  p.category,
  p.gender,
  p.available,
  partner.name as partner_name
FROM affiliate_products p
LEFT JOIN affiliate_partners partner ON p.partner_id = partner.id
WHERE p.available = true
ORDER BY p.created_at DESC
LIMIT 50 OFFSET 0
```

### Product Detail Query

```sql
SELECT 
  p.*,
  partner.name as partner_name,
  partner.website_url as partner_website
FROM affiliate_products p
LEFT JOIN affiliate_partners partner ON p.partner_id = partner.id
WHERE p.id = $1
```

## Performance Considerations

### Image Optimization
- Use Next.js Image component with automatic WebP conversion
- Lazy load images below the fold
- Placeholder images for missing product images

### Data Loading
- Initial load: 50 products
- Pagination: 50 products per page
- Cache API responses for 5 minutes (stale-while-revalidate)

### Bundle Size
- Product page code-split automatically by Next.js
- Modal lazy-loaded on first click
- Estimated bundle impact: ~15KB gzipped

## Security Considerations

### Affiliate Link Tracking
- Track clicks server-side to prevent manipulation
- Store click events in database for commission reporting
- No sensitive data in client-side tracking

### Data Validation
- Validate all API inputs (limit, offset, filters)
- Sanitize product URLs before rendering
- Use Supabase RLS policies for data access control

## Open Questions

*All technical decisions have been made. No open questions remain.*

## References

- [Next.js App Router Docs](https://nextjs.org/docs/app)
- [Supabase JavaScript Client](https://supabase.com/docs/reference/javascript)
- [shadcn/ui Dialog](https://ui.shadcn.com/docs/components/dialog)
- [Wardrobe Page Implementation](../../app/wardrobe/page.tsx)
- [ClothingGrid Component](../../components/wardrobe/clothing-grid.tsx)
