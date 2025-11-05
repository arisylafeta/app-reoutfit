# API Contract: Products API

**Feature**: Products Grid Page  
**Date**: 2025-10-28  
**Version**: 1.0.0

## Overview

This document defines the API contract for the products endpoint. The API provides access to affiliate products with pagination, filtering, and detail retrieval.

## Base URL

```
/api/products
```

## Endpoints

### 1. List Products

Retrieve a paginated list of affiliate products.

#### Request

```http
GET /api/products
```

#### Query Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `limit` | number | No | 50 | Number of products to return (max: 100) |
| `offset` | number | No | 0 | Number of products to skip for pagination |
| `available` | boolean | No | true | Filter by availability status |
| `category` | string | No | - | Filter by category (P2 feature) |
| `brand` | string | No | - | Filter by brand (P2 feature) |
| `gender` | string | No | - | Filter by gender (P2 feature) |
| `search` | string | No | - | Search in product name and brand (P2 feature) |
| `minPrice` | number | No | - | Minimum price filter (P2 feature) |
| `maxPrice` | number | No | - | Maximum price filter (P2 feature) |

#### Response

**Success (200 OK)**

```json
{
  "products": [
    {
      "id": "123e4567-e89b-12d3-a456-426614174000",
      "partner_id": "987fcdeb-51a2-43d7-b123-456789abcdef",
      "external_id": "PROD-12345",
      "name": "Classic Wool Sweater",
      "category": "Men's Tops",
      "brand": "Barbour",
      "price": 89.99,
      "currency": "GBP",
      "product_url": "https://partner.com/products/sweater-12345",
      "image_url": "https://cdn.partner.com/images/sweater.jpg",
      "colors": ["Navy", "Grey", "Black"],
      "fabrics": ["Wool", "Cotton"],
      "seasons": ["Fall", "Winter"],
      "tags": ["casual", "warm"],
      "dress_codes": ["smart-casual"],
      "gender": "male",
      "size": "M",
      "metadata": {
        "weight": "400g",
        "care": "Hand wash only"
      },
      "available": true,
      "created_at": "2025-10-28T12:00:00Z",
      "updated_at": "2025-10-28T12:00:00Z",
      "partner_name": "Barbour Official"
    }
  ],
  "total": 10000,
  "hasMore": true,
  "offset": 0,
  "limit": 50
}
```

**Error (400 Bad Request)**

```json
{
  "error": "Invalid query parameters",
  "code": "INVALID_PARAMS",
  "details": {
    "limit": "Must be between 1 and 100"
  }
}
```

**Error (500 Internal Server Error)**

```json
{
  "error": "Failed to fetch products",
  "code": "DATABASE_ERROR"
}
```

#### Example Requests

**Basic request:**
```bash
curl https://app.example.com/api/products
```

**With pagination:**
```bash
curl https://app.example.com/api/products?limit=20&offset=40
```

**With filters (P2):**
```bash
curl https://app.example.com/api/products?category=Men%27s+Tops&brand=Barbour&minPrice=50&maxPrice=150
```

---

### 2. Get Product Details

Retrieve detailed information for a single product.

#### Request

```http
GET /api/products/[id]
```

#### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string (UUID) | Yes | Product ID |

#### Response

**Success (200 OK)**

```json
{
  "product": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "partner_id": "987fcdeb-51a2-43d7-b123-456789abcdef",
    "external_id": "PROD-12345",
    "name": "Classic Wool Sweater",
    "category": "Men's Tops",
    "brand": "Barbour",
    "price": 89.99,
    "currency": "GBP",
    "product_url": "https://partner.com/products/sweater-12345",
    "image_url": "https://cdn.partner.com/images/sweater.jpg",
    "colors": ["Navy", "Grey", "Black"],
    "fabrics": ["Wool", "Cotton"],
    "seasons": ["Fall", "Winter"],
    "tags": ["casual", "warm"],
    "dress_codes": ["smart-casual"],
    "gender": "male",
    "size": "M",
    "metadata": {
      "weight": "400g",
      "care": "Hand wash only",
      "description": "A timeless wool sweater perfect for layering"
    },
    "available": true,
    "created_at": "2025-10-28T12:00:00Z",
    "updated_at": "2025-10-28T12:00:00Z"
  },
  "partner": {
    "id": "987fcdeb-51a2-43d7-b123-456789abcdef",
    "name": "Barbour Official",
    "api_slug": "barbour_official",
    "website_url": "https://www.barbour.com",
    "commission_rate": 8.5,
    "created_at": "2025-10-01T00:00:00Z",
    "updated_at": "2025-10-01T00:00:00Z"
  }
}
```

**Error (404 Not Found)**

```json
{
  "error": "Product not found",
  "code": "NOT_FOUND"
}
```

**Error (400 Bad Request)**

```json
{
  "error": "Invalid product ID",
  "code": "INVALID_ID"
}
```

#### Example Request

```bash
curl https://app.example.com/api/products/123e4567-e89b-12d3-a456-426614174000
```

---

### 3. Track Product Click (Optional - Future Enhancement)

Track when a user clicks an affiliate link for commission reporting.

#### Request

```http
POST /api/products/[id]/click
```

#### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string (UUID) | Yes | Product ID |

#### Request Body

```json
{
  "referrer": "https://app.example.com/products",
  "user_agent": "Mozilla/5.0..."
}
```

#### Response

**Success (201 Created)**

```json
{
  "success": true,
  "click_id": "abc123-def456-ghi789"
}
```

**Error (404 Not Found)**

```json
{
  "error": "Product not found",
  "code": "NOT_FOUND"
}
```

---

## Data Validation

### Query Parameter Validation

```typescript
// Validation rules for query parameters

const validateListParams = (params: URLSearchParams) => {
  const limit = parseInt(params.get('limit') || '50');
  const offset = parseInt(params.get('offset') || '0');
  
  if (limit < 1 || limit > 100) {
    throw new Error('Limit must be between 1 and 100');
  }
  
  if (offset < 0) {
    throw new Error('Offset must be non-negative');
  }
  
  return { limit, offset };
};
```

### Response Validation

```typescript
// Ensure all products have required fields

const validateProductResponse = (product: any): boolean => {
  return (
    product.id &&
    product.name &&
    product.product_url &&
    typeof product.available === 'boolean'
  );
};
```

## Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `INVALID_PARAMS` | 400 | Invalid query parameters |
| `INVALID_ID` | 400 | Invalid product ID format |
| `NOT_FOUND` | 404 | Product not found |
| `DATABASE_ERROR` | 500 | Database query failed |
| `UNAUTHORIZED` | 401 | User not authenticated |

## Rate Limiting

- **Rate**: 100 requests per minute per user
- **Burst**: 10 requests per second
- **Headers**: 
  - `X-RateLimit-Limit`: Maximum requests per minute
  - `X-RateLimit-Remaining`: Remaining requests
  - `X-RateLimit-Reset`: Unix timestamp when limit resets

## Caching

- **Strategy**: Stale-while-revalidate
- **TTL**: 5 minutes
- **Headers**:
  - `Cache-Control: public, s-maxage=300, stale-while-revalidate=600`

## Authentication

- **Method**: Session-based (Supabase Auth)
- **Required**: Yes (user must be logged in)
- **Header**: Cookie-based session token

## CORS

- **Allowed Origins**: Same-origin only
- **Credentials**: Include

## Implementation Notes

### Database Query Optimization

```sql
-- Optimized query with indexes
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
  p.colors,
  p.fabrics,
  p.seasons,
  p.tags,
  p.dress_codes,
  p.size,
  p.metadata,
  p.created_at,
  p.updated_at,
  partner.name as partner_name
FROM affiliate_products p
LEFT JOIN affiliate_partners partner ON p.partner_id = partner.id
WHERE p.available = true
ORDER BY p.created_at DESC
LIMIT $1 OFFSET $2;
```

### Performance Targets

- **Response Time**: < 200ms (p95)
- **Throughput**: 1000 requests/second
- **Database Connection Pool**: 5-20 connections

## Testing

### Test Cases

1. **List products with default parameters**
   - Request: `GET /api/products`
   - Expected: 50 products, hasMore=true

2. **List products with pagination**
   - Request: `GET /api/products?limit=20&offset=40`
   - Expected: 20 products starting from offset 40

3. **List products with invalid limit**
   - Request: `GET /api/products?limit=200`
   - Expected: 400 error with validation message

4. **Get product details**
   - Request: `GET /api/products/[valid-uuid]`
   - Expected: Product with partner information

5. **Get non-existent product**
   - Request: `GET /api/products/[invalid-uuid]`
   - Expected: 404 error

## Changelog

### Version 1.0.0 (2025-10-28)
- Initial API contract
- List products endpoint
- Get product details endpoint
- Optional click tracking endpoint (future)

## References

- [Supabase JavaScript Client](https://supabase.com/docs/reference/javascript)
- [Next.js API Routes](https://nextjs.org/docs/app/building-your-application/routing/route-handlers)
- [REST API Best Practices](https://restfulapi.net/)
