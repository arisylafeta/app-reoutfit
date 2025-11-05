# Tasks: Products Grid Page

**Input**: Design documents from `/specs/005-products-grid-page/`  
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, US4)
- Include exact file paths in descriptions

## Path Conventions
- **Web app (Next.js)**: `app/`, `components/`, `hooks/`, `types/`, `lib/`, `tests/`
- All paths relative to `app-reoutfit/` directory

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and type definitions

- [ ] T001 Create TypeScript type definitions in `types/product.ts` (Product, ProductsResponse, AffiliatePartner interfaces)
- [ ] T002 [P] Create placeholder product image at `public/placeholder-product.png`
- [ ] T003 [P] Verify Supabase client configuration in `lib/supabase/server.ts` and `lib/supabase/client.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core API and data fetching infrastructure that ALL user stories depend on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T004 Create API route `app/api/products/route.ts` with GET endpoint for listing products
- [ ] T005 Implement Supabase query in API route with pagination (limit, offset) and partner join
- [ ] T006 Add error handling and response formatting to API route
- [ ] T007 Create custom React hook `hooks/use-products.ts` for data fetching with state management
- [ ] T008 Implement pagination logic in useProducts hook (loadMore, refresh functions)

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Browse Products Grid (Priority: P1) 🎯 MVP

**Goal**: Display affiliate products in a responsive grid with images, names, brands, and prices

**Independent Test**: Navigate to /products and verify product cards display in grid layout with all information visible

### Implementation for User Story 1

- [ ] T009 [P] [US1] Create ProductCard component in `components/products/product-card.tsx`
- [ ] T010 [P] [US1] Implement card layout with Image, name, brand, price display in ProductCard
- [ ] T011 [P] [US1] Add hover effects and click handler to ProductCard
- [ ] T012 [P] [US1] Create ProductGrid component in `components/products/product-grid.tsx`
- [ ] T013 [US1] Implement responsive grid layout (2/4/5 columns) in ProductGrid
- [ ] T014 [US1] Add loading state with spinner to ProductGrid
- [ ] T015 [US1] Create products page at `app/products/page.tsx`
- [ ] T016 [US1] Integrate ChatHeader component in products page
- [ ] T017 [US1] Add title section with blob SVG background (copy from wardrobe page)
- [ ] T018 [US1] Integrate ProductGrid with useProducts hook in products page
- [ ] T019 [US1] Add empty state component when no products available
- [ ] T020 [US1] Add error state display in products page
- [ ] T021 [US1] Implement "Load More" button with pagination
- [ ] T022 [US1] Add price formatting utility function in ProductCard
- [ ] T023 [US1] Handle missing product images with placeholder in ProductCard

**Checkpoint**: At this point, User Story 1 should be fully functional - users can browse products in a grid

---

## Phase 4: User Story 2 - View Product Details (Priority: P1) 🎯 MVP

**Goal**: Show detailed product information in a modal with "Buy Now" button linking to affiliate site

**Independent Test**: Click any product card and verify modal opens with full details and functional "Buy Now" button

### Implementation for User Story 2

- [ ] T024 [US2] Create ProductDetailsModal component in `components/products/product-details-modal.tsx`
- [ ] T025 [US2] Integrate shadcn/ui Dialog component in ProductDetailsModal
- [ ] T026 [US2] Implement modal layout with product image and details sections
- [ ] T027 [US2] Add product information display (name, brand, price, category, colors, partner)
- [ ] T028 [US2] Implement "Buy Now" button with external link handler
- [ ] T029 [US2] Add modal close functionality (X button, ESC key, click outside)
- [ ] T030 [US2] Add modal state management to products page (selectedProduct, modalOpen)
- [ ] T031 [US2] Connect ProductCard onClick to open modal with selected product
- [ ] T032 [US2] Handle products with no price (display "Price not available", disable button)
- [ ] T033 [US2] Add responsive modal layout for mobile devices
- [ ] T034 [US2] Implement image display with proper sizing in modal
- [ ] T035 [US2] Add partner information display in modal

**Checkpoint**: At this point, User Stories 1 AND 2 should both work - users can browse and view product details

---

## Phase 5: User Story 3 - Filter and Search Products (Priority: P2)

**Goal**: Allow users to filter products by category, brand, price, gender, and search by keywords

**Independent Test**: Apply various filters and verify grid updates to show only matching products

### Implementation for User Story 3

- [ ] T036 [P] [US3] Add filter query parameters to API route (category, brand, gender, minPrice, maxPrice, search)
- [ ] T037 [P] [US3] Implement filter logic in Supabase query in API route
- [ ] T038 [US3] Create ProductFilters component in `components/products/product-filters.tsx`
- [ ] T039 [US3] Add category filter dropdown in ProductFilters
- [ ] T040 [US3] Add brand filter dropdown in ProductFilters
- [ ] T041 [US3] Add gender filter dropdown in ProductFilters
- [ ] T042 [US3] Add price range inputs in ProductFilters
- [ ] T043 [US3] Add search input field in ProductFilters
- [ ] T044 [US3] Add "Clear Filters" button in ProductFilters
- [ ] T045 [US3] Add filter state management to products page
- [ ] T046 [US3] Integrate ProductFilters component in products page
- [ ] T047 [US3] Update useProducts hook to accept filter parameters
- [ ] T048 [US3] Implement filter change handlers to refresh products
- [ ] T049 [US3] Add empty state for "no products match filters"
- [ ] T050 [US3] Add filter indicators showing active filters

**Checkpoint**: All P1 and P2 user stories complete - users can browse, view details, and filter products

---

## Phase 6: User Story 4 - Add Product to Wardrobe (Priority: P3)

**Goal**: Allow users to save affiliate products to their personal wardrobe collection

**Independent Test**: Click "Add to Wardrobe" on a product and verify it appears in wardrobe page

### Implementation for User Story 4

- [ ] T051 [P] [US4] Create API route `app/api/wardrobe/from-product/route.ts` for adding affiliate products
- [ ] T052 [US4] Implement Supabase insert logic with source='affiliate_product' in API route
- [ ] T053 [US4] Add "Add to Wardrobe" button to ProductDetailsModal
- [ ] T054 [US4] Implement addToWardrobe handler in ProductDetailsModal
- [ ] T055 [US4] Add loading state for "Add to Wardrobe" button
- [ ] T056 [US4] Add success toast notification on successful add
- [ ] T057 [US4] Add error toast notification on failure
- [ ] T058 [US4] Check if product already in wardrobe and show "In Wardrobe" state
- [ ] T059 [US4] Query wardrobe items to determine if product exists
- [ ] T060 [US4] Update button text based on wardrobe status
- [ ] T061 [US4] Link affiliate_product_id foreign key when creating wardrobe item

**Checkpoint**: All user stories complete - full product discovery and wardrobe integration working

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [ ] T062 [P] Add loading skeletons for product cards during initial load
- [ ] T063 [P] Optimize images with Next.js Image component lazy loading
- [ ] T064 [P] Add image domain configuration to `next.config.mjs` for affiliate partner CDNs
- [ ] T065 [P] Implement click tracking for affiliate links (optional - future enhancement)
- [ ] T066 [P] Add analytics events for product views and clicks
- [ ] T067 [P] Add accessibility improvements (ARIA labels, keyboard navigation)
- [ ] T068 [P] Add error boundary for products page
- [ ] T069 [P] Performance optimization - memoize expensive computations
- [ ] T070 [P] Add meta tags for SEO on products page
- [ ] T071 Code cleanup and remove console.logs
- [ ] T072 Update documentation with implementation notes
- [ ] T073 Run quickstart.md validation and manual testing checklist

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-6)**: All depend on Foundational phase completion
  - User Story 1 (P1): Can start after Foundational - No dependencies on other stories
  - User Story 2 (P1): Can start after Foundational - Integrates with US1 but independently testable
  - User Story 3 (P2): Can start after Foundational - Enhances US1 but independently testable
  - User Story 4 (P3): Can start after Foundational - Integrates with US2 but independently testable
- **Polish (Phase 7)**: Depends on desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Independent - Browse products grid
- **User Story 2 (P1)**: Integrates with US1 (uses ProductCard onClick) - View details modal
- **User Story 3 (P2)**: Enhances US1 (adds filters to grid) - Filter and search
- **User Story 4 (P3)**: Integrates with US2 (adds button to modal) - Add to wardrobe

### Within Each User Story

- Components can be built in parallel (marked with [P])
- Page integration happens after components are ready
- Each story should be independently testable at its checkpoint

### Parallel Opportunities

- All Setup tasks (T001-T003) can run in parallel
- All Foundational tasks (T004-T008) can run sequentially (API before hook)
- Within User Story 1: T009-T012 (components) can run in parallel
- Within User Story 2: T024-T027 (modal structure) can run in parallel
- Within User Story 3: T036-T037 (API updates) can run in parallel with T038-T044 (UI components)
- Within User Story 4: T051-T052 (API) can run in parallel with T053-T057 (UI)
- All Polish tasks (T062-T070) can run in parallel

---

## Parallel Example: User Story 1

```bash
# Launch all component tasks for User Story 1 together:
Task: "Create ProductCard component in components/products/product-card.tsx"
Task: "Implement card layout with Image, name, brand, price display in ProductCard"
Task: "Add hover effects and click handler to ProductCard"
Task: "Create ProductGrid component in components/products/product-grid.tsx"

# Then integrate sequentially:
Task: "Implement responsive grid layout in ProductGrid"
Task: "Create products page at app/products/page.tsx"
Task: "Integrate ProductGrid with useProducts hook"
```

---

## Implementation Strategy

### MVP First (User Stories 1 & 2 Only)

1. Complete Phase 1: Setup (T001-T003) - ~15 minutes
2. Complete Phase 2: Foundational (T004-T008) - ~45 minutes
3. Complete Phase 3: User Story 1 (T009-T023) - ~2 hours
4. Complete Phase 4: User Story 2 (T024-T035) - ~1.5 hours
5. **STOP and VALIDATE**: Test browsing and viewing products independently
6. Deploy/demo if ready

**Total MVP Time**: ~4-5 hours

### Incremental Delivery

1. **Foundation** (Phases 1-2): API + hooks ready
2. **MVP** (Phases 3-4): Browse + View Details → Deploy/Demo
3. **Enhanced** (Phase 5): Add Filters → Deploy/Demo
4. **Complete** (Phase 6): Add to Wardrobe → Deploy/Demo
5. **Polished** (Phase 7): Performance + UX improvements → Final Deploy

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together (~1 hour)
2. Once Foundational is done:
   - **Developer A**: User Story 1 (Browse Grid)
   - **Developer B**: User Story 2 (View Details Modal)
   - **Developer C**: User Story 3 (Filters) - can start in parallel
3. Stories complete and integrate independently
4. Developer D can work on Polish tasks in parallel with stories

---

## Task Summary

- **Total Tasks**: 73
- **Setup**: 3 tasks
- **Foundational**: 5 tasks (blocking)
- **User Story 1 (P1)**: 15 tasks - Browse Products Grid
- **User Story 2 (P1)**: 12 tasks - View Product Details
- **User Story 3 (P2)**: 15 tasks - Filter and Search
- **User Story 4 (P3)**: 11 tasks - Add to Wardrobe
- **Polish**: 12 tasks

**Parallel Opportunities**: 35 tasks marked [P] can run in parallel with other tasks

**MVP Scope**: Phases 1-4 (35 tasks) = Browse + View Details functionality

**Estimated Time**:
- MVP (P1 stories): 4-5 hours
- With Filters (P2): 6-7 hours
- Complete (P3): 8-9 hours
- Polished: 10-11 hours

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Reuse existing components from `components/ui/` (Button, Dialog, Card, etc.)
- Follow wardrobe page patterns for consistency
- No database migrations required - uses existing tables
