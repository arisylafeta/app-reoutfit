# Semantic Search Implementation Plan

**Status:** Ready for Implementation
**Date:** 2025-11-08
**Architecture:** Filter-First Hybrid Search with FashionCLIP Embeddings

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Current State](#current-state)
4. [Implementation Steps](#implementation-steps)
5. [Code Specifications](#code-specifications)
6. [Database Schema](#database-schema)
7. [API Contracts](#api-contracts)
8. [Frontend Integration](#frontend-integration)
9. [Testing Strategy](#testing-strategy)
10. [Performance Considerations](#performance-considerations)
11. [Deployment](#deployment)
12. [Monitoring & Metrics](#monitoring--metrics)

---

## Overview

### Goal

Implement semantic search for products using existing FashionCLIP embeddings (512-dimensional vectors) with a filter-first hybrid approach that combines vector similarity and text matching.

### Key Requirements

1. **Filter-First Architecture:** Apply filters (category, brand, gender, price) before semantic search to reduce search space
2. **Hybrid Search:** Automatically blend semantic similarity (60%) and text matching (40%)
3. **Single Search Bar:** Seamless UX - users don't choose between search modes
4. **Text Embedding Service:** Add FashionCLIP text encoder to existing `/agent` backend
5. **Sub-second Latency:** Target < 1 second p95 for search queries

### User Experience

**Before:**
```
User types: "black leather jacket"
System: Text search with ILIKE on product name/brand
Results: May miss visually similar items with different names
```

**After:**
```
User types: "black leather jacket"
System:
  1. Apply filters (if any)
  2. Generate text embedding via FashionCLIP
  3. Vector similarity search on filtered products
  4. Text search on filtered products
  5. Merge results with weighted scoring
Results: Visually similar leather jackets + exact brand matches
```

---

## Architecture

### High-Level Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                         User Interface                          │
│  Search: "black leather jacket" + Filters: {category: "Jackets"}│
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│              Next.js API: /api/products/search                  │
│  1. Parse filters and query                                     │
│  2. Fetch filtered product candidates from DB                   │
│  3. Extract product_group_ids (for semantic search scope)       │
└────────┬────────────────────────────────────┬───────────────────┘
         │                                    │
         ▼                                    ▼
┌──────────────────────┐          ┌─────────────────────────────┐
│   Agent Backend      │          │  Supabase Database          │
│   POST /embed/text   │          │  RPC: get_filtered_products │
│   Returns: vector    │          │  Returns: candidate set     │
└──────────┬───────────┘          └──────────┬──────────────────┘
           │                                  │
           └──────────────┬───────────────────┘
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│              Supabase Database (Parallel)                       │
│  ┌─────────────────────────┐  ┌───────────────────────────┐   │
│  │ RPC: semantic_search    │  │ Text search (ILIKE)       │   │
│  │ Input: embedding,       │  │ Input: query, product_ids │   │
│  │        product_group_ids│  │ Output: text matches      │   │
│  │ Output: similarity      │  └───────────────────────────┘   │
│  │         ranked results  │                                   │
│  └─────────────────────────┘                                   │
└────────┬───────────────────────────────────┬────────────────────┘
         │                                   │
         └──────────────┬────────────────────┘
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│           Next.js API: Hybrid Ranking Logic                     │
│  1. Normalize scores (semantic: 0-1, text: 0-1)                │
│  2. Apply weights (semantic: 0.6, text: 0.4)                   │
│  3. Merge and deduplicate                                       │
│  4. Sort by combined score                                      │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Response to User                             │
│  Products with hybrid scores, sorted by relevance               │
└─────────────────────────────────────────────────────────────────┘
```

### Key Design Decisions

#### 1. Filter-First Strategy

**Rationale:** Apply filters before semantic search to reduce vector comparison space.

**Example:**
```
Total products: 824,000
After filters (category=Jackets, gender=Men): 12,000
Semantic search on: 12,000 products (fast!)
vs. Semantic search on: 824,000 products (slow)
```

**Performance Impact:**
- 98.5% reduction in search space
- HNSW index works best on smaller filtered sets
- Sub-second query times

#### 2. Hybrid Search Weighting

**Semantic Search (60% weight):**
- Captures visual similarity
- Handles natural language queries ("formal business attire")
- Material/style understanding ("wool cashmere sweater")

**Text Search (40% weight):**
- Exact brand matching ("Nike Air Force 1")
- SKU/product name matching
- Catches exact terminology

**Scoring Formula:**
```
hybrid_score = (semantic_similarity * 0.6) + (text_relevance * 0.4)
```

#### 3. Agent Backend for Embeddings

**Why not separate service?**
- Existing FastAPI infrastructure in `/agent`
- Shared deployment pipeline
- Simpler architecture (one less service to manage)
- Agent backend already has Python/ML dependencies

**Trade-offs:**
- ✅ Faster to implement
- ✅ Fewer moving parts
- ✅ Shared monitoring/logging
- ⚠️ Adds ~350MB to agent Docker image
- ⚠️ Model loading on startup (~5-10 seconds)

---

## Current State

### Existing Infrastructure ✅

**Database:**
- `product_embeddings` table with 512-dim FashionCLIP vectors
- HNSW index: `idx_product_embeddings_vector` (m=16, ef_construction=64)
- Cosine similarity operator: `<=>` (pgvector)
- ~824K products embedded

**Embedding Model:**
- FashionCLIP (Marqo/marqo-fashionCLIP)
- Vision Transformer (ViT-B-16)
- 512-dimensional output
- Supports text and image encoding

**Product API:**
- `/api/products` - text/filter-based search
- `/api/products/filters` - dynamic filter options
- Multi-select filters (categories, brands, genders)
- Pagination support

### Missing Components ❌

1. **Text Embedding Service** - No endpoint to convert "black leather jacket" → 512-dim vector
2. **Semantic Search Function** - No database function for vector similarity with filters
3. **Hybrid Search API** - No endpoint combining semantic + text search
4. **Result Ranking Logic** - No weighted score merging

---

## Implementation Steps

### Step 1: Agent Backend - Text Embedding Service

**Location:** `/agent/src/agent_server/`

#### 1.1 Add Dependencies

**File:** `/agent/pyproject.toml`

Add to `[project.dependencies]`:
```toml
open-clip-torch = "^2.24.0"
pillow = "^10.0.0"
```

**Installation:**
```bash
cd /Users/admin/Desktop/AI/Reoutfit/agent
uv sync
```

#### 1.2 Create FashionCLIP Module

**File:** `/agent/src/agent_server/embeddings/__init__.py`

```python
"""Embedding generation services."""
from .fashionclip import FashionCLIPEncoder

__all__ = ["FashionCLIPEncoder"]
```

**File:** `/agent/src/agent_server/embeddings/fashionclip.py`

```python
"""FashionCLIP text and image embedding generation."""

import logging
from typing import Optional

import numpy as np
import open_clip
import torch
from PIL import Image

logger = logging.getLogger(__name__)


class FashionCLIPEncoder:
    """
    FashionCLIP encoder for generating text and image embeddings.

    Uses Marqo's FashionCLIP model (ViT-B-16) to generate 512-dimensional
    embeddings in a shared semantic space for fashion products.
    """

    def __init__(self, device: Optional[str] = None):
        """
        Initialize FashionCLIP model.

        Args:
            device: Device to run model on ('cuda', 'mps', 'cpu').
                   If None, automatically selects best available.
        """
        self.model_name = "hf-hub:Marqo/marqo-fashionCLIP"

        # Auto-select device
        if device is None:
            if torch.cuda.is_available():
                device = "cuda"
            elif torch.backends.mps.is_available():
                device = "mps"
            else:
                device = "cpu"

        self.device = torch.device(device)
        logger.info(f"Initializing FashionCLIP on device: {self.device}")

        # Load model and preprocessor
        try:
            self.model, _, self.preprocess = open_clip.create_model_and_transforms(
                self.model_name
            )
            self.tokenizer = open_clip.get_tokenizer(self.model_name)
            self.model = self.model.to(self.device)
            self.model.eval()
            logger.info("FashionCLIP model loaded successfully")
        except Exception as e:
            logger.error(f"Failed to load FashionCLIP model: {e}")
            raise

    @torch.no_grad()
    def encode_text(self, text: str) -> np.ndarray:
        """
        Generate embedding for text query.

        Args:
            text: Natural language query (e.g., "black leather jacket")

        Returns:
            512-dimensional normalized embedding as numpy array

        Example:
            >>> encoder = FashionCLIPEncoder()
            >>> embedding = encoder.encode_text("wool cashmere sweater")
            >>> embedding.shape
            (512,)
        """
        try:
            # Tokenize and encode
            text_tokens = self.tokenizer([text]).to(self.device)
            text_features = self.model.encode_text(text_tokens, normalize=True)

            # Convert to numpy
            embedding = text_features[0].cpu().numpy().astype(np.float32)

            logger.debug(f"Generated text embedding for query: '{text}'")
            return embedding

        except Exception as e:
            logger.error(f"Failed to encode text '{text}': {e}")
            raise

    @torch.no_grad()
    def encode_image(self, image: Image.Image) -> np.ndarray:
        """
        Generate embedding for image.

        Args:
            image: PIL Image object

        Returns:
            512-dimensional normalized embedding as numpy array
        """
        try:
            # Preprocess and encode
            image_tensor = self.preprocess(image).unsqueeze(0).to(self.device)
            image_features = self.model.encode_image(image_tensor, normalize=True)

            # Convert to numpy
            embedding = image_features[0].cpu().numpy().astype(np.float32)

            logger.debug("Generated image embedding")
            return embedding

        except Exception as e:
            logger.error(f"Failed to encode image: {e}")
            raise

    def get_model_info(self) -> dict:
        """Return model metadata."""
        return {
            "model_name": self.model_name,
            "embedding_dim": 512,
            "device": str(self.device),
            "normalization": "L2",
            "similarity_metric": "cosine"
        }


# Global instance (loaded on startup)
_encoder: Optional[FashionCLIPEncoder] = None


def get_encoder() -> FashionCLIPEncoder:
    """Get or create global encoder instance."""
    global _encoder
    if _encoder is None:
        _encoder = FashionCLIPEncoder()
    return _encoder
```

#### 1.3 Create Embedding Routes

**File:** `/agent/src/agent_server/routes/embeddings.py`

```python
"""API routes for embedding generation."""

import logging
from typing import List

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from ..embeddings.fashionclip import get_encoder

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/embed", tags=["embeddings"])


class TextEmbeddingRequest(BaseModel):
    """Request model for text embedding."""
    query: str = Field(..., min_length=1, max_length=500, description="Text query to embed")


class TextEmbeddingResponse(BaseModel):
    """Response model for text embedding."""
    embedding: List[float] = Field(..., description="512-dimensional embedding vector")
    model: str = Field(default="fashionclip", description="Model used for embedding")
    query: str = Field(..., description="Original query")


class ModelInfoResponse(BaseModel):
    """Response model for model information."""
    model_name: str
    embedding_dim: int
    device: str
    normalization: str
    similarity_metric: str


@router.post("/text", response_model=TextEmbeddingResponse)
async def embed_text(request: TextEmbeddingRequest) -> TextEmbeddingResponse:
    """
    Generate FashionCLIP embedding for text query.

    Example:
        POST /embed/text
        Body: {"query": "black leather jacket"}

        Response: {
            "embedding": [0.123, -0.456, ...],  # 512 floats
            "model": "fashionclip",
            "query": "black leather jacket"
        }
    """
    try:
        encoder = get_encoder()
        embedding = encoder.encode_text(request.query)

        return TextEmbeddingResponse(
            embedding=embedding.tolist(),
            model="fashionclip",
            query=request.query
        )

    except Exception as e:
        logger.error(f"Embedding generation failed: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate embedding: {str(e)}"
        )


@router.get("/model-info", response_model=ModelInfoResponse)
async def get_model_info() -> ModelInfoResponse:
    """Get information about the embedding model."""
    try:
        encoder = get_encoder()
        info = encoder.get_model_info()
        return ModelInfoResponse(**info)

    except Exception as e:
        logger.error(f"Failed to get model info: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get model info: {str(e)}"
        )


@router.get("/health")
async def embedding_health() -> dict:
    """Health check for embedding service."""
    try:
        encoder = get_encoder()
        # Quick test embedding
        test_embedding = encoder.encode_text("test")

        return {
            "status": "healthy",
            "model": encoder.model_name,
            "device": str(encoder.device),
            "embedding_dim": len(test_embedding)
        }

    except Exception as e:
        logger.error(f"Embedding health check failed: {e}")
        return {
            "status": "unhealthy",
            "error": str(e)
        }
```

#### 1.4 Register Routes in Main App

**File:** `/agent/src/agent_server/main.py`

Add after existing route registrations:

```python
from .routes import embeddings

# Register embedding routes
app.include_router(embeddings.router)
```

#### 1.5 Initialize Encoder on Startup

**File:** `/agent/src/agent_server/main.py`

Add startup event:

```python
@app.on_event("startup")
async def startup_event():
    """Initialize services on startup."""
    from .embeddings.fashionclip import get_encoder

    logger.info("Loading FashionCLIP model...")
    try:
        encoder = get_encoder()
        logger.info(f"FashionCLIP loaded on {encoder.device}")
    except Exception as e:
        logger.error(f"Failed to load FashionCLIP: {e}")
        # Don't crash the server, but log the error
```

#### 1.6 Test Locally

```bash
# Start agent backend
cd /Users/admin/Desktop/AI/Reoutfit/agent
uv run uvicorn src.agent_server.main:app --reload --port 8000

# Test embedding endpoint
curl -X POST http://localhost:8000/embed/text \
  -H "Content-Type: application/json" \
  -d '{"query": "black leather jacket"}'

# Should return:
# {
#   "embedding": [0.123, -0.456, ...],  # 512 floats
#   "model": "fashionclip",
#   "query": "black leather jacket"
# }

# Test health check
curl http://localhost:8000/embed/health
```

---

### Step 2: Database - Semantic Search Function

**Location:** `/Users/admin/Desktop/AI/Reoutfit/supabase/migrations/`

#### 2.1 Create Migration File

**File:** `/Users/admin/Desktop/AI/Reoutfit/supabase/migrations/20251108_add_semantic_search.sql`

```sql
-- Semantic search function for FashionCLIP embeddings
-- Migration: 2025-11-08
-- Description: Add vector similarity search with filter support

-- Function: search_products_by_embedding
-- Purpose: Semantic search on pre-filtered product set using FashionCLIP embeddings
--
-- Strategy: Filter-first architecture
--   1. Caller provides product_group_ids from pre-filtered results
--   2. Function only searches embeddings matching those IDs (fast!)
--   3. Returns products ranked by cosine similarity
--
-- Performance: ~100-500ms for 10K filtered products with HNSW index

CREATE OR REPLACE FUNCTION search_products_by_embedding(
  query_embedding vector(512),
  product_group_ids text[],
  similarity_threshold float DEFAULT 0.10,
  p_limit integer DEFAULT 20,
  p_offset integer DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  partner_id uuid,
  external_id text,
  product_group_id text,
  name text,
  category text,
  brand text,
  price numeric,
  currency text,
  product_url text,
  image_url text,
  colors text[],
  fabrics text[],
  seasons text[],
  tags text[],
  dress_codes text[],
  gender text,
  size text,
  metadata jsonb,
  available boolean,
  created_at timestamptz,
  updated_at timestamptz,
  similarity float
) AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT ON (ap.product_group_id)
    ap.id,
    ap.partner_id,
    ap.external_id,
    ap.product_group_id,
    ap.name,
    ap.category,
    ap.brand,
    ap.price,
    ap.currency,
    ap.product_url,
    ap.image_url,
    ap.colors,
    ap.fabrics,
    ap.seasons,
    ap.tags,
    ap.dress_codes,
    ap.gender,
    ap.size,
    ap.metadata,
    ap.available,
    ap.created_at,
    ap.updated_at,
    (1 - (pe.embedding <=> query_embedding))::float AS similarity
  FROM product_embeddings pe
  JOIN affiliate_products ap ON pe.product_group_id = ap.product_group_id
  WHERE
    -- Filter to pre-filtered product set (key optimization!)
    pe.product_group_id = ANY(product_group_ids)

    -- Only available products
    AND ap.available = true

    -- Similarity threshold (0.10 = fair match, 0.15 = good match, 0.20 = excellent)
    AND (1 - (pe.embedding <=> query_embedding)) >= similarity_threshold

  -- Order by similarity (HNSW index accelerates this)
  ORDER BY ap.product_group_id, pe.embedding <=> query_embedding

  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql STABLE;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION search_products_by_embedding TO authenticated, anon;

-- Add function comment
COMMENT ON FUNCTION search_products_by_embedding IS
  'Semantic search using FashionCLIP embeddings on pre-filtered product set. Returns products ranked by cosine similarity.';


-- Helper function: Get filtered product group IDs
-- Used to extract product_group_ids from filtered results before semantic search

CREATE OR REPLACE FUNCTION get_filtered_product_group_ids(
  p_available boolean DEFAULT true,
  p_categories text[] DEFAULT NULL,
  p_brands text[] DEFAULT NULL,
  p_genders text[] DEFAULT NULL,
  p_min_price numeric DEFAULT NULL,
  p_max_price numeric DEFAULT NULL
)
RETURNS text[] AS $$
DECLARE
  result text[];
BEGIN
  SELECT array_agg(DISTINCT product_group_id)
  INTO result
  FROM affiliate_products ap
  WHERE
    ap.available = p_available
    AND ap.product_group_id IS NOT NULL

    -- Multi-select category filter
    AND (
      p_categories IS NULL
      OR array_length(p_categories, 1) IS NULL
      OR ap.category = ANY(p_categories)
    )

    -- Multi-select brand filter
    AND (
      p_brands IS NULL
      OR array_length(p_brands, 1) IS NULL
      OR ap.brand = ANY(p_brands)
    )

    -- Multi-select gender filter
    AND (
      p_genders IS NULL
      OR array_length(p_genders, 1) IS NULL
      OR ap.gender = ANY(p_genders)
    )

    -- Price range filters
    AND (p_min_price IS NULL OR ap.price >= p_min_price)
    AND (p_max_price IS NULL OR ap.price <= p_max_price);

  RETURN COALESCE(result, ARRAY[]::text[]);
END;
$$ LANGUAGE plpgsql STABLE;

GRANT EXECUTE ON FUNCTION get_filtered_product_group_ids TO authenticated, anon;

COMMENT ON FUNCTION get_filtered_product_group_ids IS
  'Extract product_group_ids from filtered product set for semantic search.';
```

#### 2.2 Apply Migration

```bash
cd /Users/admin/Desktop/AI/Reoutfit/supabase
supabase db push

# Or for local development:
supabase db reset
```

#### 2.3 Test Database Function

```sql
-- Test 1: Get filtered product IDs
SELECT get_filtered_product_group_ids(
  p_available := true,
  p_categories := ARRAY['Jackets'],
  p_genders := ARRAY['Men']
);
-- Should return: {product_group_1, product_group_2, ...}

-- Test 2: Semantic search on filtered set
-- (Replace [...] with actual 512-dim vector from /embed/text endpoint)
SELECT
  name,
  brand,
  category,
  similarity
FROM search_products_by_embedding(
  query_embedding := '[...]'::vector(512),
  product_group_ids := (
    SELECT get_filtered_product_group_ids(
      p_categories := ARRAY['Jackets']
    )
  ),
  similarity_threshold := 0.10,
  p_limit := 10
);
-- Should return: Top 10 jackets by similarity
```

---

### Step 3: Next.js API - Unified Search Endpoint

**Location:** `/Users/admin/Desktop/AI/Reoutfit/app-reoutfit/`

#### 3.1 Create Hybrid Ranking Utility

**File:** `/app-reoutfit/lib/search/hybrid-ranking.ts`

```typescript
/**
 * Hybrid search result ranking and merging.
 * Combines semantic similarity and text relevance scores.
 */

import { Product } from '@/types/product';

export interface ScoredProduct extends Product {
  semanticScore?: number;
  textScore?: number;
  hybridScore: number;
}

export interface HybridRankingOptions {
  semanticWeight?: number; // Default: 0.6
  textWeight?: number; // Default: 0.4
  deduplicateBy?: 'product_group_id' | 'id'; // Default: 'product_group_id'
}

/**
 * Merge and rank semantic search and text search results.
 *
 * @param semanticResults - Products from vector similarity search with similarity scores
 * @param textResults - Products from text search (ILIKE matching)
 * @param options - Ranking configuration
 * @returns Merged, deduplicated, and ranked products
 *
 * @example
 * ```ts
 * const semantic = [{...product, similarity: 0.85}];
 * const text = [{...product, textMatch: true}];
 * const merged = mergeAndRankResults(semantic, text);
 * // Result: Products sorted by hybrid score
 * ```
 */
export function mergeAndRankResults(
  semanticResults: (Product & { similarity: number })[],
  textResults: Product[],
  options: HybridRankingOptions = {}
): ScoredProduct[] {
  const {
    semanticWeight = 0.6,
    textWeight = 0.4,
    deduplicateBy = 'product_group_id',
  } = options;

  // Validate weights sum to 1.0
  if (Math.abs(semanticWeight + textWeight - 1.0) > 0.01) {
    throw new Error('Semantic and text weights must sum to 1.0');
  }

  // Create maps for quick lookup
  const semanticMap = new Map<string, number>();
  semanticResults.forEach((product) => {
    const key = deduplicateBy === 'product_group_id'
      ? product.product_group_id || product.id
      : product.id;
    semanticMap.set(key, product.similarity);
  });

  const textSet = new Set<string>();
  textResults.forEach((product) => {
    const key = deduplicateBy === 'product_group_id'
      ? product.product_group_id || product.id
      : product.id;
    textSet.add(key);
  });

  // Collect all unique products
  const allProducts = new Map<string, Product>();

  // Add semantic results
  semanticResults.forEach((product) => {
    const key = deduplicateBy === 'product_group_id'
      ? product.product_group_id || product.id
      : product.id;
    allProducts.set(key, product);
  });

  // Add text results (won't overwrite semantic results)
  textResults.forEach((product) => {
    const key = deduplicateBy === 'product_group_id'
      ? product.product_group_id || product.id
      : product.id;
    if (!allProducts.has(key)) {
      allProducts.set(key, product);
    }
  });

  // Calculate hybrid scores
  const scoredProducts: ScoredProduct[] = [];

  allProducts.forEach((product, key) => {
    // Normalize scores to 0-1 range
    const semanticScore = semanticMap.get(key) || 0;
    const textScore = textSet.has(key) ? 1.0 : 0;

    // Calculate weighted hybrid score
    const hybridScore = (semanticScore * semanticWeight) + (textScore * textWeight);

    scoredProducts.push({
      ...product,
      semanticScore,
      textScore,
      hybridScore,
    });
  });

  // Sort by hybrid score (descending)
  scoredProducts.sort((a, b) => b.hybridScore - a.hybridScore);

  return scoredProducts;
}

/**
 * Normalize similarity scores to 0-1 range.
 * FashionCLIP similarities typically range from 0.05 to 0.25.
 *
 * @param similarity - Raw cosine similarity score
 * @param min - Minimum expected similarity (default: 0.05)
 * @param max - Maximum expected similarity (default: 0.25)
 * @returns Normalized score between 0 and 1
 */
export function normalizeSimilarity(
  similarity: number,
  min: number = 0.05,
  max: number = 0.25
): number {
  return Math.max(0, Math.min(1, (similarity - min) / (max - min)));
}

/**
 * Calibrate similarity threshold based on query type.
 *
 * @param query - Search query
 * @returns Recommended similarity threshold
 *
 * @example
 * ```ts
 * calibrateThreshold("black leather jacket") // 0.10 (visual query)
 * calibrateThreshold("Nike Air Force 1")     // 0.15 (specific product)
 * ```
 */
export function calibrateThreshold(query: string): number {
  const lowerQuery = query.toLowerCase();

  // Brand-specific queries need higher threshold (more precision)
  const brands = ['nike', 'adidas', 'gucci', 'prada', 'zara'];
  if (brands.some((brand) => lowerQuery.includes(brand))) {
    return 0.15; // Higher precision
  }

  // Generic visual queries can use lower threshold (more recall)
  return 0.10; // Balanced
}
```

#### 3.2 Create Search API Endpoint

**File:** `/app-reoutfit/app/api/products/search/route.ts`

```typescript
import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { Product } from '@/types/product';
import {
  mergeAndRankResults,
  calibrateThreshold,
  ScoredProduct
} from '@/lib/search/hybrid-ranking';

const AGENT_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

interface SemanticProduct extends Product {
  similarity: number;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;

  // Parse parameters
  const query = searchParams.get('query') || searchParams.get('search') || '';
  const limit = parseInt(searchParams.get('limit') || '50');
  const offset = parseInt(searchParams.get('offset') || '0');
  const available = searchParams.get('available') !== 'false';

  // Filter parameters (multi-select)
  const categoriesParam = searchParams.get('categories') || searchParams.get('category');
  const categories = categoriesParam ? categoriesParam.split(',').filter(Boolean) : null;

  const brandsParam = searchParams.get('brands') || searchParams.get('brand');
  const brands = brandsParam ? brandsParam.split(',').filter(Boolean) : null;

  const gendersParam = searchParams.get('genders') || searchParams.get('gender');
  const genders = gendersParam ? gendersParam.split(',').filter(Boolean) : null;

  // Price range
  const minPrice = searchParams.get('minPrice');
  const maxPrice = searchParams.get('maxPrice');

  try {
    const supabase = await createClient();

    // If no query, fall back to regular filtered search
    if (!query.trim()) {
      const { data: products, error } = await supabase.rpc('get_distinct_products', {
        p_available: available,
        p_categories: categories?.length ? categories : null,
        p_brands: brands?.length ? brands : null,
        p_genders: genders?.length ? genders : null,
        p_search: null,
        p_min_price: minPrice ? parseFloat(minPrice) : null,
        p_max_price: maxPrice ? parseFloat(maxPrice) : null,
        p_limit: limit,
        p_offset: offset,
      });

      if (error) throw error;

      return NextResponse.json({
        products: products || [],
        total: products?.length || 0,
        hasMore: (products?.length || 0) === limit,
        offset,
        limit,
        searchType: 'filter-only',
      });
    }

    // Step 1: Get filtered product_group_ids (search space)
    console.log('[Search] Getting filtered product IDs...');
    const { data: productGroupIds, error: filterError } = await supabase.rpc(
      'get_filtered_product_group_ids',
      {
        p_available: available,
        p_categories: categories?.length ? categories : null,
        p_brands: brands?.length ? brands : null,
        p_genders: genders?.length ? genders : null,
        p_min_price: minPrice ? parseFloat(minPrice) : null,
        p_max_price: maxPrice ? parseFloat(maxPrice) : null,
      }
    );

    if (filterError) throw filterError;

    // If no products match filters, return early
    if (!productGroupIds || productGroupIds.length === 0) {
      return NextResponse.json({
        products: [],
        total: 0,
        hasMore: false,
        offset,
        limit,
        searchType: 'hybrid',
        message: 'No products match the selected filters',
      });
    }

    console.log(`[Search] Filtered to ${productGroupIds.length} product groups`);

    // Step 2: Generate query embedding (parallel with text search)
    console.log('[Search] Generating embedding...');
    const embeddingPromise = fetch(`${AGENT_URL}/embed/text`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    }).then((res) => {
      if (!res.ok) throw new Error('Embedding generation failed');
      return res.json();
    });

    // Step 3: Text search on filtered set (parallel)
    console.log('[Search] Running text search...');
    const textSearchPromise = supabase.rpc('get_distinct_products', {
      p_available: available,
      p_categories: categories?.length ? categories : null,
      p_brands: brands?.length ? brands : null,
      p_genders: genders?.length ? genders : null,
      p_search: query,
      p_min_price: minPrice ? parseFloat(minPrice) : null,
      p_max_price: maxPrice ? parseFloat(maxPrice) : null,
      p_limit: Math.min(limit * 2, 100), // Get more candidates for merging
      p_offset: 0,
    });

    // Wait for both to complete
    const [embeddingResult, textSearchResult] = await Promise.all([
      embeddingPromise,
      textSearchPromise,
    ]);

    const { embedding } = embeddingResult;
    const { data: textResults, error: textError } = textSearchResult;

    if (textError) throw textError;

    // Step 4: Semantic search on filtered set
    console.log('[Search] Running semantic search...');
    const threshold = calibrateThreshold(query);

    const { data: semanticResults, error: semanticError } = await supabase.rpc(
      'search_products_by_embedding',
      {
        query_embedding: embedding,
        product_group_ids: productGroupIds,
        similarity_threshold: threshold,
        p_limit: Math.min(limit * 2, 100), // Get more candidates for merging
        p_offset: 0,
      }
    );

    if (semanticError) throw semanticError;

    console.log(`[Search] Semantic: ${semanticResults?.length || 0}, Text: ${textResults?.length || 0}`);

    // Step 5: Merge and rank results
    const mergedResults = mergeAndRankResults(
      (semanticResults || []) as SemanticProduct[],
      textResults || [],
      {
        semanticWeight: 0.6,
        textWeight: 0.4,
        deduplicateBy: 'product_group_id',
      }
    );

    // Step 6: Apply pagination to merged results
    const paginatedResults = mergedResults.slice(offset, offset + limit);

    console.log(`[Search] Returning ${paginatedResults.length} hybrid results`);

    return NextResponse.json({
      products: paginatedResults,
      total: mergedResults.length,
      hasMore: mergedResults.length > offset + limit,
      offset,
      limit,
      searchType: 'hybrid',
      breakdown: {
        semanticCount: semanticResults?.length || 0,
        textCount: textResults?.length || 0,
        mergedCount: mergedResults.length,
        threshold,
      },
    });
  } catch (error) {
    console.error('Search error:', error);

    // Fallback to text-only search on error
    try {
      const supabase = await createClient();
      const { data: products, error: fallbackError } = await supabase.rpc(
        'get_distinct_products',
        {
          p_available: available,
          p_categories: categories?.length ? categories : null,
          p_brands: brands?.length ? brands : null,
          p_genders: genders?.length ? genders : null,
          p_search: query,
          p_min_price: minPrice ? parseFloat(minPrice) : null,
          p_max_price: maxPrice ? parseFloat(maxPrice) : null,
          p_limit: limit,
          p_offset: offset,
        }
      );

      if (fallbackError) throw fallbackError;

      return NextResponse.json({
        products: products || [],
        total: products?.length || 0,
        hasMore: (products?.length || 0) === limit,
        offset,
        limit,
        searchType: 'text-fallback',
        warning: 'Semantic search unavailable, using text search',
      });
    } catch (fallbackError) {
      console.error('Fallback search failed:', fallbackError);
      return NextResponse.json(
        {
          error: 'Search failed',
          code: 'SEARCH_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
        { status: 500 }
      );
    }
  }
}
```

---

### Step 4: Frontend Integration

#### 4.1 Update Product Types

**File:** `/app-reoutfit/types/product.ts`

Add after existing `Product` interface:

```typescript
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
```

#### 4.2 Update useProducts Hook

**File:** `/app-reoutfit/hooks/use-products.ts`

Replace with updated version:

```typescript
import { useState, useEffect, useCallback } from 'react';
import { Product, ScoredProduct, SearchResponse } from '@/types/product';

export interface UseProductsOptions {
  categories?: string[];
  brands?: string[];
  genders?: string[];
  search?: string;
  minPrice?: number;
  maxPrice?: number;
  initialLimit?: number;
}

interface UseProductsReturn {
  products: ScoredProduct[];
  loading: boolean;
  error: string | null;
  hasMore: boolean;
  loadMore: () => void;
  refresh: () => void;
  searchType?: 'filter-only' | 'hybrid' | 'text-fallback';
  breakdown?: SearchResponse['breakdown'];
}

export function useProducts(options: UseProductsOptions = {}): UseProductsReturn {
  const [products, setProducts] = useState<ScoredProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const [searchType, setSearchType] = useState<SearchResponse['searchType']>();
  const [breakdown, setBreakdown] = useState<SearchResponse['breakdown']>();

  const limit = options.initialLimit || 50;

  const fetchProducts = useCallback(
    async (append: boolean = false) => {
      setLoading(true);
      setError(null);

      try {
        // Build query parameters
        const params = new URLSearchParams();
        params.append('limit', limit.toString());
        params.append('offset', append ? offset.toString() : '0');

        // Handle array parameters (comma-separated)
        if (options.categories?.length) {
          params.append('categories', options.categories.join(','));
        }
        if (options.brands?.length) {
          params.append('brands', options.brands.join(','));
        }
        if (options.genders?.length) {
          params.append('genders', options.genders.join(','));
        }

        // Search query
        if (options.search) {
          params.append('query', options.search);
        }

        // Price range
        if (options.minPrice !== undefined) {
          params.append('minPrice', options.minPrice.toString());
        }
        if (options.maxPrice !== undefined) {
          params.append('maxPrice', options.maxPrice.toString());
        }

        // Call unified search endpoint
        const response = await fetch(`/api/products/search?${params}`);

        if (!response.ok) {
          throw new Error('Failed to fetch products');
        }

        const data: SearchResponse = await response.json();

        // Update state
        if (append) {
          setProducts((prev) => [...prev, ...data.products]);
        } else {
          setProducts(data.products);
          setOffset(0);
        }

        setHasMore(data.hasMore);
        setSearchType(data.searchType);
        setBreakdown(data.breakdown);

        // Log search type for debugging
        if (data.searchType === 'hybrid' && data.breakdown) {
          console.log(
            `[Hybrid Search] Semantic: ${data.breakdown.semanticCount}, Text: ${data.breakdown.textCount}, Merged: ${data.breakdown.mergedCount}`
          );
        }
      } catch (err) {
        console.error('Error fetching products:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch products');
        setProducts([]);
        setHasMore(false);
      } finally {
        setLoading(false);
      }
    },
    [options, offset, limit]
  );

  const loadMore = useCallback(() => {
    if (!loading && hasMore) {
      setOffset((prev) => prev + limit);
      fetchProducts(true);
    }
  }, [loading, hasMore, limit, fetchProducts]);

  const refresh = useCallback(() => {
    setOffset(0);
    fetchProducts(false);
  }, [fetchProducts]);

  // Fetch products on mount and when options change
  useEffect(() => {
    setOffset(0);
    fetchProducts(false);
  }, [
    options.categories?.join(','),
    options.brands?.join(','),
    options.genders?.join(','),
    options.search,
    options.minPrice,
    options.maxPrice,
  ]);

  return {
    products,
    loading,
    error,
    hasMore,
    loadMore,
    refresh,
    searchType,
    breakdown,
  };
}
```

#### 4.3 Update Environment Variables

**File:** `/app-reoutfit/.env.example`

Add:

```env
# Agent Backend (for embedding service)
NEXT_PUBLIC_API_URL=http://localhost:8000
```

**File:** `/app-reoutfit/.env.local`

Add the same variable.

#### 4.4 Optional: Display Search Type Indicator

**File:** `/app-reoutfit/components/products/product-list.tsx`

Add indicator to show search type:

```typescript
import { Badge } from '@/components/ui/badge';

export function ProductList() {
  const { products, searchType, breakdown } = useProducts({ ... });

  return (
    <div>
      {/* Search type indicator (for debugging) */}
      {searchType && (
        <div className="mb-4 flex items-center gap-2">
          <Badge variant={searchType === 'hybrid' ? 'default' : 'secondary'}>
            {searchType === 'hybrid' && '🔍 Semantic + Text'}
            {searchType === 'filter-only' && '📋 Filters Only'}
            {searchType === 'text-fallback' && '⚠️ Text Only'}
          </Badge>

          {breakdown && (
            <span className="text-xs text-muted-foreground">
              {breakdown.mergedCount} results (semantic: {breakdown.semanticCount}, text: {breakdown.textCount})
            </span>
          )}
        </div>
      )}

      {/* Product grid */}
      {/* ... */}
    </div>
  );
}
```

---

## API Contracts

### 1. Embedding Service API

**Base URL:** `http://localhost:8000` (agent backend)

#### POST /embed/text

Generate text embedding for search query.

**Request:**
```json
{
  "query": "black leather jacket"
}
```

**Response:**
```json
{
  "embedding": [0.123, -0.456, ...], // 512 floats
  "model": "fashionclip",
  "query": "black leather jacket"
}
```

**Status Codes:**
- `200` - Success
- `400` - Invalid request (empty query, too long)
- `500` - Model error

#### GET /embed/health

Check embedding service health.

**Response:**
```json
{
  "status": "healthy",
  "model": "hf-hub:Marqo/marqo-fashionCLIP",
  "device": "mps",
  "embedding_dim": 512
}
```

#### GET /embed/model-info

Get model metadata.

**Response:**
```json
{
  "model_name": "hf-hub:Marqo/marqo-fashionCLIP",
  "embedding_dim": 512,
  "device": "mps",
  "normalization": "L2",
  "similarity_metric": "cosine"
}
```

---

### 2. Search API

**Base URL:** `http://localhost:3000/api` (Next.js)

#### GET /products/search

Unified search endpoint with hybrid ranking.

**Query Parameters:**
- `query` (string) - Search query (natural language)
- `categories` (string) - Comma-separated category filters
- `brands` (string) - Comma-separated brand filters
- `genders` (string) - Comma-separated gender filters
- `minPrice` (number) - Minimum price
- `maxPrice` (number) - Maximum price
- `limit` (number, default: 50) - Results per page
- `offset` (number, default: 0) - Pagination offset

**Example:**
```
GET /api/products/search?query=leather+jacket&categories=Jackets&genders=Men&limit=20
```

**Response:**
```typescript
{
  "products": [
    {
      // Standard Product fields
      "id": "uuid",
      "name": "Black Leather Jacket",
      "brand": "Zara",
      "price": 129.99,
      "category": "Jackets",
      // ... other fields

      // Search scoring
      "semanticScore": 0.85,
      "textScore": 1.0,
      "hybridScore": 0.91
    }
  ],
  "total": 45,
  "hasMore": true,
  "offset": 0,
  "limit": 20,
  "searchType": "hybrid",
  "breakdown": {
    "semanticCount": 30,
    "textCount": 20,
    "mergedCount": 45,
    "threshold": 0.10
  }
}
```

**Search Types:**
- `hybrid` - Semantic + text search (normal operation)
- `filter-only` - No search query, only filters applied
- `text-fallback` - Semantic search failed, fell back to text-only

**Status Codes:**
- `200` - Success
- `400` - Invalid parameters
- `500` - Server error (with fallback to text search if possible)

---

## Database Schema

### Existing Tables

#### affiliate_products

```sql
CREATE TABLE affiliate_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID REFERENCES affiliate_partners(id),
  external_id TEXT NOT NULL,
  product_group_id TEXT,  -- Groups size variants
  name TEXT NOT NULL,
  category TEXT,
  brand TEXT,
  price NUMERIC(12,2),
  currency TEXT CHECK (char_length(currency) = 3),
  product_url TEXT NOT NULL,
  image_url TEXT,
  colors TEXT[],
  fabrics TEXT[],
  seasons TEXT[],
  tags TEXT[],
  dress_codes TEXT[],
  gender TEXT,
  size TEXT,
  metadata JSONB,
  available BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(partner_id, external_id)
);
```

#### product_embeddings

```sql
CREATE TABLE product_embeddings (
  product_group_id TEXT PRIMARY KEY,
  representative_product_id UUID REFERENCES affiliate_products(id) ON DELETE SET NULL,
  embedding vector(512),  -- FashionCLIP 512-dim
  model TEXT NOT NULL DEFAULT 'fashionclip',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- HNSW index for fast cosine similarity search
CREATE INDEX idx_product_embeddings_vector ON product_embeddings
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
```

### New Functions

#### search_products_by_embedding

See [Step 2.1](#21-create-migration-file) for full SQL definition.

**Purpose:** Vector similarity search on pre-filtered product set.

**Parameters:**
- `query_embedding vector(512)` - Text embedding from FashionCLIP
- `product_group_ids text[]` - Pre-filtered product IDs (from filters)
- `similarity_threshold float` - Minimum similarity (default: 0.10)
- `p_limit integer` - Max results (default: 20)
- `p_offset integer` - Pagination offset (default: 0)

**Returns:** Products with similarity scores, ordered by relevance.

#### get_filtered_product_group_ids

**Purpose:** Extract product_group_ids matching filters (for semantic search scope).

**Parameters:**
- `p_available boolean` - Filter available products
- `p_categories text[]` - Category filters
- `p_brands text[]` - Brand filters
- `p_genders text[]` - Gender filters
- `p_min_price numeric` - Min price
- `p_max_price numeric` - Max price

**Returns:** `text[]` array of product_group_ids.

---

## Testing Strategy

### Unit Tests

#### Agent Backend

**File:** `/agent/tests/test_embeddings.py`

```python
import pytest
from src.agent_server.embeddings.fashionclip import FashionCLIPEncoder

def test_encoder_initialization():
    """Test FashionCLIP encoder loads successfully."""
    encoder = FashionCLIPEncoder(device='cpu')
    assert encoder.model is not None
    assert encoder.tokenizer is not None

def test_text_embedding_generation():
    """Test text embedding generation."""
    encoder = FashionCLIPEncoder(device='cpu')
    embedding = encoder.encode_text("black leather jacket")

    assert embedding.shape == (512,)
    assert embedding.dtype == 'float32'
    # Check normalization (L2 norm should be ~1.0)
    import numpy as np
    norm = np.linalg.norm(embedding)
    assert 0.99 <= norm <= 1.01

def test_embedding_determinism():
    """Test that same query produces same embedding."""
    encoder = FashionCLIPEncoder(device='cpu')
    emb1 = encoder.encode_text("wool sweater")
    emb2 = encoder.encode_text("wool sweater")

    import numpy as np
    assert np.allclose(emb1, emb2, atol=1e-6)

def test_embedding_endpoint(client):
    """Test /embed/text API endpoint."""
    response = client.post(
        "/embed/text",
        json={"query": "black leather jacket"}
    )

    assert response.status_code == 200
    data = response.json()
    assert "embedding" in data
    assert len(data["embedding"]) == 512
    assert data["model"] == "fashionclip"
```

#### Database Functions

**File:** SQL test suite

```sql
-- Test get_filtered_product_group_ids
DO $$
DECLARE
  result_ids text[];
BEGIN
  SELECT get_filtered_product_group_ids(
    p_categories := ARRAY['Jackets']
  ) INTO result_ids;

  ASSERT array_length(result_ids, 1) > 0, 'Should return product IDs';
  RAISE NOTICE 'Filtered IDs: %', array_length(result_ids, 1);
END $$;

-- Test search_products_by_embedding
DO $$
DECLARE
  test_embedding vector(512);
  result_count int;
BEGIN
  -- Get a real embedding from database
  SELECT embedding INTO test_embedding
  FROM product_embeddings
  LIMIT 1;

  SELECT COUNT(*) INTO result_count
  FROM search_products_by_embedding(
    query_embedding := test_embedding,
    product_group_ids := (
      SELECT get_filtered_product_group_ids(p_categories := ARRAY['Jackets'])
    ),
    similarity_threshold := 0.10,
    p_limit := 10
  );

  ASSERT result_count > 0, 'Should return results';
  RAISE NOTICE 'Semantic results: %', result_count;
END $$;
```

#### Hybrid Ranking

**File:** `/app-reoutfit/lib/search/__tests__/hybrid-ranking.test.ts`

```typescript
import { describe, it, expect } from '@jest/globals';
import { mergeAndRankResults } from '../hybrid-ranking';
import { Product } from '@/types/product';

describe('mergeAndRankResults', () => {
  const mockProduct1: Product = {
    id: '1',
    product_group_id: 'group1',
    name: 'Black Leather Jacket',
    brand: 'Zara',
    // ... other fields
  };

  const mockProduct2: Product = {
    id: '2',
    product_group_id: 'group2',
    name: 'Nike Jacket',
    brand: 'Nike',
    // ... other fields
  };

  it('should merge semantic and text results', () => {
    const semanticResults = [{ ...mockProduct1, similarity: 0.85 }];
    const textResults = [mockProduct2];

    const merged = mergeAndRankResults(semanticResults, textResults);

    expect(merged).toHaveLength(2);
    expect(merged[0].hybridScore).toBeGreaterThan(merged[1].hybridScore);
  });

  it('should deduplicate by product_group_id', () => {
    const semanticResults = [{ ...mockProduct1, similarity: 0.85 }];
    const textResults = [mockProduct1]; // Same product

    const merged = mergeAndRankResults(semanticResults, textResults);

    expect(merged).toHaveLength(1);
    expect(merged[0].semanticScore).toBe(0.85);
    expect(merged[0].textScore).toBe(1.0);
  });

  it('should apply correct weights', () => {
    const semanticResults = [{ ...mockProduct1, similarity: 0.8 }];
    const textResults = [mockProduct1];

    const merged = mergeAndRankResults(semanticResults, textResults, {
      semanticWeight: 0.6,
      textWeight: 0.4,
    });

    // Expected: (0.8 * 0.6) + (1.0 * 0.4) = 0.88
    expect(merged[0].hybridScore).toBeCloseTo(0.88, 2);
  });
});
```

### Integration Tests

#### End-to-End Search Flow

**File:** `/app-reoutfit/tests/e2e/semantic-search.spec.ts`

```typescript
import { test, expect } from '@playwright/test';

test.describe('Semantic Search', () => {
  test('should perform hybrid search with results', async ({ page }) => {
    await page.goto('/products');

    // Enter search query
    await page.fill('input[placeholder*="Search"]', 'black leather jacket');

    // Wait for debounce (500ms) + API call
    await page.waitForTimeout(600);

    // Check results rendered
    const products = page.locator('[data-testid="product-card"]');
    await expect(products).toHaveCount({ min: 1 });

    // Check search type indicator
    const searchType = page.locator('[data-testid="search-type"]');
    await expect(searchType).toContainText('Semantic + Text');
  });

  test('should combine filters with semantic search', async ({ page }) => {
    await page.goto('/products');

    // Apply category filter
    await page.click('button:has-text("Category")');
    await page.click('text=Jackets');

    // Enter search query
    await page.fill('input[placeholder*="Search"]', 'leather');
    await page.waitForTimeout(600);

    // Verify results are filtered
    const products = page.locator('[data-testid="product-card"]');
    const firstProduct = products.first();

    // Check category is "Jackets"
    await expect(firstProduct).toContainText('Jackets');
  });

  test('should fall back to text search on error', async ({ page }) => {
    // Mock agent backend failure
    await page.route('**/embed/text', (route) => route.abort());

    await page.goto('/products');
    await page.fill('input[placeholder*="Search"]', 'jacket');
    await page.waitForTimeout(600);

    // Should still show results (text fallback)
    const products = page.locator('[data-testid="product-card"]');
    await expect(products).toHaveCount({ min: 1 });

    // Check fallback indicator
    const searchType = page.locator('[data-testid="search-type"]');
    await expect(searchType).toContainText('Text Only');
  });
});
```

### Manual Testing Checklist

#### Visual Similarity Tests

- [ ] Query: "black leather jacket" → Expect: Leather jackets (various brands)
- [ ] Query: "wool sweater" → Expect: Knitwear, sweaters
- [ ] Query: "running shoes" → Expect: Athletic footwear
- [ ] Query: "formal business suit" → Expect: Suits, formal wear
- [ ] Query: "summer dress floral" → Expect: Dresses with floral patterns

#### Brand/Text Matching Tests

- [ ] Query: "Nike Air Force 1" → Expect: Nike brand shoes, high text match
- [ ] Query: "Adidas sneakers" → Expect: Adidas products
- [ ] Query: "Zara jacket" → Expect: Zara brand jackets

#### Filter Combination Tests

- [ ] Filters: Category=Jackets, Gender=Men, Query="leather" → Expect: Men's leather jackets only
- [ ] Filters: Category=Shoes, Price=$50-$100, Query="running" → Expect: Running shoes in price range
- [ ] Filters: Brand=Nike, Query="basketball" → Expect: Nike basketball shoes

#### Performance Tests

- [ ] Search with no filters → Should complete in < 2 seconds
- [ ] Search with category filter → Should complete in < 1 second
- [ ] Load more pagination → Should complete in < 1 second
- [ ] Rapid typing (debounce test) → Should only trigger one API call

#### Error Handling Tests

- [ ] Agent backend offline → Should fall back to text search
- [ ] Empty results → Should show "No products found" message
- [ ] Invalid query (special characters) → Should handle gracefully
- [ ] Network timeout → Should show error message and retry option

---

## Performance Considerations

### 1. Query Latency Budget

**Target:** < 1 second p95

**Breakdown:**
- Filter query: 50-100ms
- Text embedding generation: 200-300ms (agent backend)
- Semantic search (HNSW): 100-300ms
- Text search: 50-100ms
- Hybrid ranking: 10-20ms
- Network overhead: 100-200ms

**Total:** ~600-1000ms

### 2. Optimization Strategies

#### Database Optimizations

**Indexes:**
```sql
-- Already exist
CREATE INDEX idx_affiliate_products_category ON affiliate_products(category);
CREATE INDEX idx_affiliate_products_brand ON affiliate_products(brand);
CREATE INDEX idx_affiliate_products_gender ON affiliate_products(gender);
CREATE INDEX idx_product_embeddings_vector ON product_embeddings USING hnsw (embedding vector_cosine_ops);

-- Additional composite index for filter combinations
CREATE INDEX idx_affiliate_products_filters
  ON affiliate_products(available, category, gender, price)
  WHERE product_group_id IS NOT NULL;
```

**Query Tuning:**
- Use `EXPLAIN ANALYZE` to verify index usage
- Monitor slow query log (queries > 100ms)
- Consider materialized view for popular filter combinations

#### Agent Backend Optimizations

**Model Loading:**
- Pre-load model on startup (not lazy load)
- Use GPU if available (CUDA > MPS > CPU)
- Consider model quantization (FP16) for faster inference

**Caching:**
```python
from functools import lru_cache

@lru_cache(maxsize=1000)
def embed_text_cached(text: str) -> np.ndarray:
    """Cache embeddings for repeated queries."""
    return encoder.encode_text(text)
```

**Connection Pooling:**
- Keep persistent connection to Next.js API
- Use HTTP/2 for multiplexing

#### Frontend Optimizations

**Debouncing:**
```typescript
// Already implemented: 500ms debounce
const debouncedSearch = useDebounce(searchQuery, 500);
```

**Request Deduplication:**
```typescript
// Use React Query or SWR for automatic deduplication
import { useQuery } from '@tanstack/react-query';

export function useProducts(options: UseProductsOptions) {
  return useQuery({
    queryKey: ['products', options],
    queryFn: () => fetchProducts(options),
    staleTime: 60000, // Cache for 1 minute
  });
}
```

**Pagination:**
- Load 50 items initially
- Infinite scroll or "Load More" button
- Virtual scrolling for large result sets

### 3. Monitoring Queries

**Add logging to search endpoint:**

```typescript
// app/api/products/search/route.ts
import { logger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  const startTime = performance.now();

  // ... search logic

  const duration = performance.now() - startTime;
  logger.info('search_query', {
    query,
    filters: { categories, brands, genders },
    searchType,
    duration,
    resultCount: mergedResults.length,
    semanticCount: semanticResults?.length,
    textCount: textResults?.length,
  });

  // ... return response
}
```

**Monitor key metrics:**
- Average query latency
- p95/p99 latency
- Error rate (embedding failures, DB errors)
- Cache hit rate
- Search type distribution (hybrid vs fallback)

### 4. Scaling Considerations

**Current Scale:**
- 824K products, ~12K per category
- HNSW index: ~1.6 GB memory
- Agent backend: ~2-3 GB memory (with model)

**Projected Scale:**
- 1M+ products → Consider sharding by category
- 10M+ products → Consider dedicated vector search engine (Pinecone, Weaviate)
- High traffic → Load balance agent backend (multiple instances)

**Capacity Planning:**
- Agent backend: 100-200 req/sec (single instance)
- Database: 1000+ concurrent connections (Supabase Postgres)
- HNSW index: Scales to 10M+ vectors

---

## Deployment

### Agent Backend Deployment

#### Docker Configuration

**File:** `/agent/Dockerfile`

Add after existing layers:

```dockerfile
# Install OpenCLIP dependencies
RUN uv pip install open-clip-torch==2.24.0 pillow==10.0.0

# Download FashionCLIP model during build (optional, speeds up startup)
RUN python -c "import open_clip; open_clip.create_model_and_transforms('hf-hub:Marqo/marqo-fashionCLIP')"
```

**Build and test:**
```bash
cd /Users/admin/Desktop/AI/Reoutfit/agent
docker build -t reoutfit-agent .
docker run -p 8000:8000 reoutfit-agent
```

#### Environment Variables

**File:** `/agent/.env`

Add:
```env
# Embedding Service
EMBEDDING_MODEL=hf-hub:Marqo/marqo-fashionCLIP
EMBEDDING_DEVICE=cuda  # or 'mps', 'cpu'
```

#### Health Checks

Update Docker Compose:

```yaml
# agent/docker-compose.yml
services:
  aegra:
    # ... existing config
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/embed/health"]
      interval: 30s
      timeout: 5s
      retries: 3
```

### Next.js Deployment

#### Environment Variables

**Production (.env.production):**
```env
NEXT_PUBLIC_API_URL=https://agent.reoutfit.com
```

**Vercel:**
- Set environment variable in Vercel dashboard
- Ensure agent backend URL is accessible from Vercel edge

#### Build Configuration

**File:** `/app-reoutfit/next.config.mjs`

No changes needed - search endpoint is API route (runs on server).

### Database Migration

```bash
# Local development
cd /Users/admin/Desktop/AI/Reoutfit/supabase
supabase db push

# Production
supabase db push --linked
```

### Rollout Plan

#### Phase 1: Staging (1 week)
1. Deploy agent backend to staging
2. Apply database migration
3. Deploy Next.js app to staging
4. Run integration tests
5. Performance testing with realistic load

#### Phase 2: Canary (1 week)
1. Deploy to 10% of production users
2. Monitor error rates, latency, search quality
3. A/B test: hybrid search vs text-only search
4. Collect user feedback

#### Phase 3: Full Rollout (1 week)
1. Deploy to 100% of users
2. Monitor metrics for 48 hours
3. Adjust similarity thresholds based on data
4. Document learnings

### Rollback Plan

**If issues arise:**
1. Disable semantic search in Next.js API (set feature flag)
2. Fall back to text-only search
3. Investigate and fix issues
4. Redeploy with fixes

**Feature Flag Implementation:**

```typescript
// app/api/products/search/route.ts
const ENABLE_SEMANTIC_SEARCH = process.env.ENABLE_SEMANTIC_SEARCH !== 'false';

if (!ENABLE_SEMANTIC_SEARCH || !query.trim()) {
  // Fall back to text-only search
  return textOnlySearch();
}
```

---

## Monitoring & Metrics

### Key Metrics

#### Search Quality
- **Click-Through Rate (CTR):** % of searches with clicks in top 10
- **Null Search Rate:** % of searches with 0 results
- **Average Position Clicked:** Where users click in results
- **Semantic vs Text Preference:** Which results get more clicks

#### Performance
- **Search Latency (p50, p95, p99)**
- **Embedding Generation Time**
- **Database Query Time**
- **Error Rate:** Embedding failures, DB errors

#### Usage
- **Searches per Day**
- **Search Type Distribution:** Hybrid, filter-only, text-fallback
- **Popular Queries:** Top 100 search terms
- **Filter Usage:** Which filters are most common

### Logging

**PostHog Events:**

```typescript
// Log search event
posthog.capture('product_search', {
  query,
  searchType,
  resultCount: products.length,
  semanticCount: breakdown?.semanticCount,
  textCount: breakdown?.textCount,
  duration,
  filters: {
    categories: options.categories,
    brands: options.brands,
    genders: options.genders,
  },
});

// Log result click
posthog.capture('product_search_click', {
  query,
  productId: product.id,
  productName: product.name,
  position: index,
  semanticScore: product.semanticScore,
  hybridScore: product.hybridScore,
});
```

**Sentry Error Tracking:**

```typescript
// app/api/products/search/route.ts
try {
  // ... search logic
} catch (error) {
  Sentry.captureException(error, {
    tags: {
      feature: 'semantic_search',
      query,
    },
    extra: {
      filters: { categories, brands, genders },
      searchType,
    },
  });

  // Fall back to text search
}
```

### Dashboards

**Create PostHog Dashboard:**
1. **Search Overview**
   - Total searches (daily/weekly/monthly)
   - Search type distribution (pie chart)
   - Average latency (line chart)
   - Error rate (line chart)

2. **Search Quality**
   - CTR by search type (hybrid vs text-only)
   - Null search rate
   - Average position clicked
   - Top queries without results

3. **Performance**
   - Latency percentiles (p50, p95, p99)
   - Embedding service health
   - Database query time
   - Fallback rate

**Create Sentry Alerts:**
- Alert if error rate > 5%
- Alert if p95 latency > 2 seconds
- Alert if embedding service down

---

## Success Criteria

### Launch Criteria (Go/No-Go)

Before full rollout, verify:
- [ ] Integration tests passing (100%)
- [ ] p95 latency < 1.5 seconds
- [ ] Error rate < 2%
- [ ] Embedding service uptime > 99%
- [ ] Database migration successful
- [ ] Rollback plan tested

### Post-Launch Metrics (Week 1)

- [ ] CTR improvement: +10% vs baseline (text-only)
- [ ] Null search rate: <5%
- [ ] Average latency: <1 second p95
- [ ] User satisfaction: >4.0/5.0 rating

### Long-Term Metrics (Month 1)

- [ ] Conversion rate: +5% (searches leading to purchases)
- [ ] User engagement: +15% (time on product pages)
- [ ] Search abandonment: -10%
- [ ] Repeat searches: -20% (better first-time results)

---

## Future Enhancements

### Phase 3: Advanced Features

**1. Image-to-Product Search**
- Upload image → find visually similar products
- Use existing FashionCLIP image encoder

**2. Query Expansion**
- "leather jacket" → also search "moto jacket", "biker jacket"
- Use LLM to generate synonyms

**3. Personalized Ranking**
- Factor in user preferences (past purchases, browsing history)
- Adjust hybrid weights per user

**4. Search Result Explanations**
- Show why a product matched ("Similar material", "Matching style")
- Display similarity scores in UI

**5. A/B Testing Framework**
- Experiment with different weights (semantic vs text)
- Test similarity thresholds
- Optimize for conversion

### Phase 4: Scale Optimizations

**1. Vector Database**
- Migrate to dedicated vector DB (Pinecone, Weaviate)
- Support 10M+ products

**2. Distributed Embedding Service**
- Load-balanced agent backend (3+ instances)
- Redis cache for embeddings

**3. Pre-computed Recommendations**
- Daily batch job: "Similar products" for each product
- Cache in database for instant retrieval

---

## Appendix

### A. Similarity Threshold Calibration

Based on analysis of FashionCLIP similarity scores:

| Threshold | Quality | Use Case |
|-----------|---------|----------|
| 0.20+ | Excellent | Exact visual match, same product type |
| 0.15-0.20 | Good | Strong visual similarity, same category |
| 0.10-0.15 | Fair | Acceptable similarity, may include related items |
| 0.05-0.10 | Poor | Weak similarity, mostly noise |
| <0.05 | No match | Unrelated products |

**Recommended Default:** 0.10 (balanced recall/precision)

### B. Example Search Queries

**Visual Queries (high semantic weight):**
- "black leather jacket"
- "wool cashmere sweater"
- "formal business suit"
- "running shoes athletic"

**Brand Queries (high text weight):**
- "Nike Air Force 1"
- "Adidas Ultraboost"
- "Zara coat"

**Hybrid Queries (balanced):**
- "Nike running shoes"
- "Zara leather jacket"
- "Adidas sneakers white"

### C. Code Repositories

**Agent Backend:**
- `/agent/src/agent_server/embeddings/` - Embedding modules
- `/agent/src/agent_server/routes/embeddings.py` - API routes

**Database:**
- `/supabase/migrations/20251108_add_semantic_search.sql` - Migration

**Next.js API:**
- `/app-reoutfit/app/api/products/search/route.ts` - Search endpoint
- `/app-reoutfit/lib/search/hybrid-ranking.ts` - Ranking logic

**Frontend:**
- `/app-reoutfit/hooks/use-products.ts` - Product fetching hook
- `/app-reoutfit/types/product.ts` - TypeScript types

### D. Dependencies

**Agent Backend (Python):**
```toml
[project.dependencies]
open-clip-torch = "^2.24.0"
pillow = "^10.0.0"
torch = "^2.0.0"
```

**Frontend (Node.js):**
- No additional dependencies required
- Uses existing `@langchain/langgraph-sdk` for agent backend communication

### E. References

- **FashionCLIP Model:** [HuggingFace](https://huggingface.co/Marqo/marqo-fashionCLIP)
- **OpenCLIP Library:** [GitHub](https://github.com/mlfoundations/open_clip)
- **pgvector Extension:** [GitHub](https://github.com/pgvector/pgvector)
- **HNSW Algorithm:** [arXiv:1603.09320](https://arxiv.org/abs/1603.09320)

---

**Document Version:** 1.0
**Last Updated:** 2025-11-08
**Status:** Ready for Implementation
**Estimated Effort:** 10-12 hours
**Target Completion:** 1-2 weeks
