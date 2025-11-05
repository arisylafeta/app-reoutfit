# Implementation Plan: Products Grid Page

**Branch**: `005-products-grid-page` | **Date**: 2025-10-28 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/005-products-grid-page/spec.md`

## Summary

Create a new `/products` page that displays affiliate products in a responsive grid layout. Users can browse products, click cards to view detailed information in a modal, and navigate to affiliate partner websites via "Buy Now" buttons. The page follows the same styling patterns as the existing wardrobe page for visual consistency.

**Core Features:**
- Responsive product grid (2/4/5 columns based on screen size)
- Product cards showing image, name, brand, price
- Product detail modal with full information and affiliate link
- Loading states, empty states, and error handling
- Optional filters and "Add to Wardrobe" functionality

## Technical Context

**Language/Version**: TypeScript 5.x, React 18+  
**Primary Dependencies**: Next.js 15.3.2, React, Supabase Client, TailwindCSS, shadcn/ui components  
**Storage**: Supabase PostgreSQL (existing `affiliate_products` and `affiliate_partners` tables)  
**Testing**: Playwright (existing test setup), React Testing Library  
**Target Platform**: Web (responsive: mobile, tablet, desktop)  
**Project Type**: Web application (Next.js App Router)  
**Performance Goals**: <2s initial page load, <1s product detail modal open, smooth 60fps scrolling  
**Constraints**: Must match existing wardrobe page styling, reuse existing UI components, support 10,000+ products  
**Scale/Scope**: 1 new page route, 3-4 new components, 1 API route, ~10,000 products in database

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Status**: ✅ PASSED (No constitution file exists for this project - proceeding with standard Next.js best practices)

## Project Structure

### Documentation (this feature)

```
specs/005-products-grid-page/
├── plan.md              # This file
├── research.md          # Phase 0: Technical research and decisions
├── data-model.md        # Phase 1: Data structures and types
├── quickstart.md        # Phase 1: Development guide
├── contracts/           # Phase 1: API contracts
│   └── products-api.md  # GET /api/products endpoint spec
└── checklists/
    └── requirements.md  # Quality checklist (already created)
```

### Source Code (repository root)

```
app-reoutfit/
├── app/
│   ├── products/
│   │   └── page.tsx                    # NEW: Main products page
│   └── api/
│       └── products/
│           └── route.ts                # NEW: API endpoint for fetching products
│
├── components/
│   └── products/
│       ├── product-grid.tsx            # NEW: Grid container component
│       ├── product-card.tsx            # NEW: Individual product card
│       └── product-details-modal.tsx   # NEW: Product detail modal
│
├── hooks/
│   └── use-products.ts                 # NEW: Custom hook for product data fetching
│
├── types/
│   └── product.ts                      # NEW: Product type definitions
│
├── lib/
│   └── supabase/
│       └── products.ts                 # NEW: Supabase product queries
│
└── tests/
    └── products/
        ├── products-page.spec.ts       # NEW: E2E tests for products page
        └── product-card.test.tsx       # NEW: Unit tests for product card
```

**Structure Decision**: Next.js App Router structure with feature-based organization. New files are isolated to `products/` directories to avoid conflicts with existing code. Reuses existing UI components from `components/ui/` and styling patterns from wardrobe page.

## Complexity Tracking

*No constitution violations - this section is not applicable*

