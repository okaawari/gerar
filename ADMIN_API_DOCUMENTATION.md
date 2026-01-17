# Admin API Documentation

This document provides comprehensive API documentation for admin endpoints to build the frontend admin dashboard.

## Table of Contents

- [Base Information](#base-information)
- [Authentication](#authentication)
- [Admin API Endpoints](#admin-api-endpoints)
  - [Categories](#categories-endpoints)
  - [Products](#products-endpoints)
  - [File Upload](#file-upload-endpoints)
  - [Constants](#constants-endpoints)
  - [Orders](#orders-endpoints)
  - [Users](#users-endpoints)
- [Data Models](#data-models)
- [Error Handling](#error-handling)
- [Example Requests](#example-requests)

---

## Base Information

### Base URL
```
Development: http://localhost:3000/api/admin
Production: [Your production URL]/api/admin
```

### Important Notes
- **All admin endpoints require authentication and admin role**
- Admin routes are prefixed with `/api/admin`
- All requests must include JWT token in the `Authorization` header
- User must have `role: "ADMIN"` to access these endpoints

---

## Authentication

### Authentication Requirements
All admin endpoints require:
1. Valid JWT token in the `Authorization` header
2. User role must be `ADMIN`

### Request Headers
```
Authorization: Bearer <your-jwt-token>
Content-Type: application/json
```

### Getting an Admin Token
1. Register or login through `/api/auth/register` or `/api/auth/login`
2. The user account must have `role: "ADMIN"` (typically set in database)
3. Use the returned token in subsequent requests

### Error Responses
- `401 Unauthorized` - Missing or invalid token
- `403 Forbidden` - User doesn't have admin privileges

---

## Admin API Endpoints

## Categories Endpoints

All category management endpoints are under `/api/admin/categories`.

### Get All Categories (with Subcategories)

Retrieve all categories with nested subcategories. This endpoint shows the hierarchical structure of categories.

**Endpoint:** `GET /api/admin/categories`

**Authentication:** Required (Admin only)

**Query Parameters:**
- `includeSubcategories` (optional) - Default is `true`. Set to `false` to get a flat list of all categories.

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Categories retrieved successfully",
  "data": [
    {
      "id": 1,
      "name": "Гэр ахуйн бараа",
      "description": "Гэр ахуйн бараа бүтээгдэхүүнүүд",
      "parentId": null,
      "createdAt": "2026-01-08T19:59:08.611Z",
      "updatedAt": "2026-01-08T19:59:13.011Z",
      "children": [
        {
          "id": 2,
          "name": "Гал тогоо",
          "description": "Гал тогооны хэрэгслүүд",
          "parentId": 1,
          "createdAt": "2026-01-08T19:59:26.106Z",
          "updatedAt": "2026-01-08T19:59:26.106Z",
          "children": []
        }
      ]
    }
  ]
}
```

**Notes:**
- Categories are returned with top-level categories first
- Subcategories are nested inside the `children` array of their parent category
- Each category object includes all its child categories recursively
- Empty `children` arrays indicate categories with no subcategories
- If `includeSubcategories=false`, returns a flat list of all categories (both parents and children)

**Errors:**
- `401` - Authentication required
- `403` - Admin privileges required

---

### Create Category

Create a new category or subcategory.

**Endpoint:** `POST /api/admin/categories`

**Authentication:** Required (Admin only)

**Request Body:**
```json
{
  "name": "Electronics",              // Required, string, unique per parent
  "description": "Electronic devices", // Optional, string
  "parentId": null                    // Optional, number | null (null for top-level categories)
}
```

**Example - Top-level Category:**
```json
{
  "name": "Electronics",
  "description": "Electronic devices and gadgets"
}
```

**Example - Subcategory:**
```json
{
  "name": "Laptops",
  "description": "Portable computers",
  "parentId": 1
}
```

**Response:** `201 Created`
```json
{
  "success": true,
  "message": "Category created successfully",
  "data": {
    "id": 1,
    "name": "Electronics",
    "description": "Electronic devices",
    "parentId": null,
    "createdAt": "2024-01-15T10:30:00.000Z",
    "updatedAt": "2024-01-15T10:30:00.000Z"
  }
}
```

**Errors:**
- `400` - Validation failed (invalid data format)
- `401` - Authentication required
- `403` - Admin privileges required
- `404` - Parent category not found (if parentId provided)
- `409` - Category with this name already exists under the same parent
- `400` - Circular reference detected (category cannot be its own parent)

---

### Update Category

Update an existing category.

**Endpoint:** `POST /api/admin/categories/:id/update`

**Authentication:** Required (Admin only)

**Parameters:**
- `id` (path) - Category ID (integer)

**Request Body:**
```json
{
  "name": "Updated Electronics",      // Optional, string
  "description": "Updated description", // Optional, string
  "parentId": null                    // Optional, number | null
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Category updated successfully",
  "data": {
    "id": 1,
    "name": "Updated Electronics",
    "description": "Updated description",
    "parentId": null,
    "createdAt": "2024-01-15T10:30:00.000Z",
    "updatedAt": "2024-01-15T11:00:00.000Z"
  }
}
```

**Errors:**
- `400` - Validation failed
- `401` - Authentication required
- `403` - Admin privileges required
- `404` - Category not found
- `404` - Parent category not found (if parentId provided)
- `409` - Category with this name already exists under the same parent
- `400` - Circular reference detected (cannot set category as its own parent)

---

### Delete Category

Delete a category. Note: Categories with products or subcategories may have restrictions.

**Endpoint:** `POST /api/admin/categories/:id/delete`

**Authentication:** Required (Admin only)

**Parameters:**
- `id` (path) - Category ID (integer)

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Category deleted successfully",
  "data": {
    "id": 1,
    "name": "Electronics",
    "description": "Electronic devices",
    "parentId": null,
    "createdAt": "2024-01-15T10:30:00.000Z",
    "updatedAt": "2024-01-15T10:30:00.000Z"
  }
}
```

**Errors:**
- `401` - Authentication required
- `403` - Admin privileges required
- `404` - Category not found
- `400` - Cannot delete category (may have products or subcategories)

---

## Products Endpoints

All product management endpoints are under `/api/admin/products`.

### Get All Products (Advanced Search)

Retrieve all products with advanced filtering, sorting, and pagination. This endpoint includes all the same advanced search features as the public products endpoint.

**Endpoint:** `GET /api/admin/products`

**Authentication:** Required (Admin only)

**Query Parameters:**

#### Basic Filters
- `categoryId` (optional) - Filter by single category ID (for backward compatibility)
- `categoryIds[]` (optional) - Filter by multiple category IDs (array format: `categoryIds[]=1&categoryIds[]=2` or comma-separated: `categoryIds=1,2`)
- `search` (optional) - Search products by name and/or description (case-insensitive)
- `inStock` (optional) - Filter by stock availability (`true`/`false`)

#### Price Filters
- `minPrice` (optional) - Minimum price (decimal number, e.g., `100.00`)
- `maxPrice` (optional) - Maximum price (decimal number, e.g., `1000.00`)

#### Stock Range Filters
- `minStock` (optional) - Minimum stock quantity (integer, e.g., `1`)
- `maxStock` (optional) - Maximum stock quantity (integer, e.g., `100`)

#### Date Range Filters
- `createdAfter` (optional) - Filter products created after this date (ISO 8601 format: `2024-01-01` or `2024-01-01T00:00:00Z`)
- `createdBefore` (optional) - Filter products created before this date (ISO 8601 format: `2024-12-31` or `2024-12-31T23:59:59Z`)

#### Sorting
- `sortBy` (optional) - Field to sort by. Valid values: `name`, `price`, `stock`, `createdAt`, `updatedAt`. Default: `createdAt`
- `sortOrder` (optional) - Sort order. Valid values: `asc`, `desc`. Default: `desc`

#### Pagination
- `page` (optional) - Page number (integer, starts from 1). Default: `1`
- `limit` (optional) - Number of items per page (integer, max 100). Default: `50`

**Examples:**
```
# Basic search
GET /api/admin/products
GET /api/admin/products?categoryId=1
GET /api/admin/products?search=laptop
GET /api/admin/products?inStock=true

# Advanced search with multiple filters
GET /api/admin/products?categoryIds[]=1&categoryIds[]=2&search=laptop&inStock=true
GET /api/admin/products?minPrice=100&maxPrice=1000&sortBy=price&sortOrder=asc
GET /api/admin/products?categoryId=1&search=gaming&minStock=5&maxStock=50

# Date range filtering
GET /api/admin/products?createdAfter=2024-01-01&createdBefore=2024-12-31

# With pagination
GET /api/admin/products?page=1&limit=20&sortBy=name&sortOrder=asc

# Complex query combining all filters
GET /api/admin/products?categoryIds=1,2&search=laptop&minPrice=500&maxPrice=2000&minStock=1&inStock=true&sortBy=price&sortOrder=asc&page=1&limit=25
```

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Products retrieved successfully",
  "data": [
    {
      "id": 1,
      "name": "Laptop",
      "description": "High-performance laptop",
      "price": "899.99",
      "originalPrice": "999.99",
      "images": [
        "https://example.com/laptop-front.jpg",
        "https://example.com/laptop-side.jpg",
        "https://example.com/laptop-back.jpg"
      ],
      "firstImage": "https://example.com/laptop-front.jpg",
      "hasDiscount": true,
      "discountAmount": "100.00",
      "discountPercentage": 10,
      "stock": 50,
      "categories": [
        {
          "id": 1,
          "name": "Electronics",
          "description": "Electronic devices"
        },
        {
          "id": 2,
          "name": "Gaming",
          "description": "Gaming products"
        }
      ],
      "categoryId": 1,
      "category": {
        "id": 1,
        "name": "Electronics",
        "description": "Electronic devices"
      },
      "createdAt": "2024-01-15T10:30:00.000Z",
      "updatedAt": "2024-01-15T10:30:00.000Z"
    }
  ],
  "pagination": {
    "total": 150,
    "page": 1,
    "limit": 50,
    "totalPages": 3
  }
}
```

**Response Fields:**
- `data` - Array of product objects, each containing:
  - `id` - Product ID
  - `name` - Product name
  - `description` - Product description
  - `price` - Current selling price (string)
  - `originalPrice` - Original price before discount (string or null)
  - `images` - Array of image URLs (strings)
  - `firstImage` - First image URL for easy access in listings (string or null)
  - `hasDiscount` - Boolean indicating if product has a discount
  - `discountAmount` - Discount amount (string or null)
  - `discountPercentage` - Discount percentage (integer or null)
  - `stock` - Stock quantity
  - `categories` - Array of category objects (each with id, name, description)
  - `categoryId` - First category ID (for backward compatibility)
  - `category` - First category object (for backward compatibility)
  - `createdAt` - Creation timestamp
  - `updatedAt` - Last update timestamp
- `pagination.total` - Total number of products matching the filters
- `pagination.page` - Current page number
- `pagination.limit` - Number of items per page
- `pagination.totalPages` - Total number of pages

**Notes:**
- All filters can be combined together
- Search term searches in both product `name` and `description` fields
- When using `categoryIds`, if you provide `categoryId` as well, only `categoryIds` will be used
- **Automatic sorting by category order:** When filtering by a single category (`categoryId` or `categoryIds` with one item) and no explicit `sortBy` is provided, products are automatically sorted by their `order` field within that category (ascending - lower numbers appear first), then by creation date (descending - newer first)
- If you specify `sortBy` explicitly, the automatic category order sorting is disabled
- Invalid filter values are ignored (e.g., non-numeric price values)
- Date filters accept ISO 8601 format dates
- Maximum limit per page is 100 items
- Products include `firstImage` field for easy display of the first image in listings
- Discount information is automatically calculated when `originalPrice` is provided and greater than `price`

**Errors:**
- `401` - Authentication required
- `403` - Admin privileges required

---

### Create Product

Create a new product.

**Endpoint:** `POST /api/admin/products`

**Authentication:** Required (Admin only)

**Request Body:**
```json
{
  "name": "Laptop",                    // Required, string
  "description": "High-performance laptop", // Required, string
  "price": 899.99,                     // Required, number (decimal) - current selling price
  "originalPrice": 999.99,             // Optional, number (decimal) - original price before discount
  "images": [                          // Optional, array of image URLs (strings)
    "https://example.com/laptop-front.jpg",
    "https://example.com/laptop-side.jpg",
    "https://example.com/laptop-back.jpg"
  ],
  "stock": 50,                         // Required, integer (>= 0)
  "categoryIds": [1, 2, 5],           // Required, array of integers - at least one category ID (must exist)
  // OR for backward compatibility:
  // "categoryId": 1,                  // Single category ID (will be converted to array)
  "categoryOrders": {                 // Optional, object mapping categoryId to order number
    "1": 0,                           // Product order in category 1 (lower = shows first, default: 0)
    "2": 1,                           // Product order in category 2
    "5": 2                            // Product order in category 5
  }
  // OR as array format:
  // "categoryOrders": [
  //   {"categoryId": 1, "order": 0},
  //   {"categoryId": 2, "order": 1},
  //   {"categoryId": 5, "order": 2}
  // ]
}
```

**Response:** `201 Created`
```json
{
  "success": true,
  "message": "Product created successfully",
  "data": {
    "id": 1,
    "name": "Laptop",
    "description": "High-performance laptop",
    "price": "899.99",
    "originalPrice": "999.99",
    "images": [
      "https://example.com/laptop-front.jpg",
      "https://example.com/laptop-side.jpg",
      "https://example.com/laptop-back.jpg"
    ],
    "firstImage": "https://example.com/laptop-front.jpg",
    "hasDiscount": true,
    "discountAmount": "100.00",
    "discountPercentage": 10,
    "stock": 50,
    "categories": [
      {
        "id": 1,
        "name": "Electronics",
        "description": "Electronic devices"
      },
      {
        "id": 2,
        "name": "Gaming",
        "description": "Gaming products"
      }
    ],
    "categoryId": 1,
    "category": {
      "id": 1,
      "name": "Electronics",
      "description": "Electronic devices"
    },
    "createdAt": "2024-01-15T10:30:00.000Z",
    "updatedAt": "2024-01-15T10:30:00.000Z"
  }
}
```

**Notes:**
- `price` is the current selling price (required)
- `originalPrice` is optional - if provided and greater than `price`, discount will be automatically calculated
- `images` is optional - provide an array of image URL strings
- `categoryIds` is required - provide an array of category IDs (at least one required)
- For backward compatibility, you can also use `categoryId` (single ID) which will be converted to an array
- `categoryOrders` is optional - controls the display order of products within each category
  - Lower order numbers appear first in the category listing
  - Default order is `0` if not specified
  - Can be provided as an object `{categoryId: order}` or array `[{categoryId, order}]`
  - If a category in `categoryIds` doesn't have an order specified, it defaults to `0`
- The first image in the array will be available as `firstImage` in the response for easy access in listings
- Products can belong to multiple categories - use `categoryIds` array to assign multiple categories
- When products are filtered by a single category, they are automatically sorted by order (ascending), then by creation date (descending)

**Errors:**
- `400` - Validation failed (missing required fields, invalid data types)
- `401` - Authentication required
- `403` - Admin privileges required
- `404` - One or more categories not found
- `400` - At least one category ID is required
- `400` - Invalid price (must be positive) or stock (must be >= 0)
- `400` - Original price must be greater than or equal to current price
- `400` - Images must be an array of non-empty string URLs
- `400` - Category IDs must be an array

---

### Update Product

Update an existing product.

**Endpoint:** `POST /api/admin/products/:id/update`

**Authentication:** Required (Admin only)

**Parameters:**
- `id` (path) - Product ID (integer)

**Request Body:**
```json
{
  "name": "Updated Laptop",            // Optional, string
  "description": "Updated description", // Optional, string
  "price": 799.99,                     // Optional, number (decimal) - current selling price
  "originalPrice": 899.99,             // Optional, number (decimal) or null - original price before discount
  "images": [                          // Optional, array of image URLs (strings) or null to clear
    "https://example.com/updated-front.jpg",
    "https://example.com/updated-back.jpg"
  ],
  "stock": 40,                         // Optional, integer (>= 0)
  "categoryIds": [1, 3],              // Optional, array of integers - replaces all existing categories
  // OR for backward compatibility:
  // "categoryId": 1,                  // Single category ID (will replace all categories)
  "categoryOrders": {                 // Optional, object mapping categoryId to order number
    "1": 0,                           // Product order in category 1 (lower = shows first, default: 0)
    "3": 1                            // Product order in category 3
  }
  // OR as array format:
  // "categoryOrders": [
  //   {"categoryId": 1, "order": 0},
  //   {"categoryId": 3, "order": 1}
  // ]
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Product updated successfully",
  "data": {
    "id": 1,
    "name": "Updated Laptop",
    "description": "Updated description",
    "price": "799.99",
    "originalPrice": "899.99",
    "images": [
      "https://example.com/updated-front.jpg",
      "https://example.com/updated-back.jpg"
    ],
    "firstImage": "https://example.com/updated-front.jpg",
    "hasDiscount": true,
    "discountAmount": "100.00",
    "discountPercentage": 11,
    "stock": 40,
    "categories": [
      {
        "id": 1,
        "name": "Electronics",
        "description": "Electronic devices"
      },
      {
        "id": 3,
        "name": "Computers",
        "description": "Computer products"
      }
    ],
    "categoryId": 1,
    "category": {
      "id": 1,
      "name": "Electronics",
      "description": "Electronic devices"
    },
    "createdAt": "2024-01-15T10:30:00.000Z",
    "updatedAt": "2024-01-15T11:00:00.000Z"
  }
}
```

**Notes:**
- All fields are optional - only include fields you want to update
- `originalPrice` can be set to `null` to remove discount
- `images` can be set to `null` or empty array `[]` to clear all images
- `categoryIds` replaces ALL existing categories with the new ones provided
- For backward compatibility, `categoryId` (single ID) will replace all categories with just that one
- `categoryOrders` is optional - controls the display order of products within each category
  - Lower order numbers appear first in the category listing
  - Default order is `0` if not specified
  - Can be provided as an object `{categoryId: order}` or array `[{categoryId, order}]`
  - Can be provided alone (without `categoryIds`) to update orders for existing categories
  - If provided with `categoryIds`, sets orders for the new categories
- If `originalPrice` is provided and greater than `price`, discount will be automatically calculated
- To remove discount, set `originalPrice` to `null`
- To update categories, provide `categoryIds` array with all desired category IDs (existing ones will be removed)
- When products are filtered by a single category, they are automatically sorted by order (ascending), then by creation date (descending)

**Errors:**
- `400` - Validation failed
- `401` - Authentication required
- `403` - Admin privileges required
- `404` - Product not found
- `404` - One or more categories not found (if categoryIds provided)
- `400` - At least one category ID is required (if categoryIds provided)
- `400` - Category IDs must be an array (if categoryIds provided)
- `400` - Invalid price or stock values
- `400` - Original price must be greater than or equal to current price

---

### Delete Product

Delete a product.

**Endpoint:** `POST /api/admin/products/:id/delete`

**Authentication:** Required (Admin only)

**Parameters:**
- `id` (path) - Product ID (integer)

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Product deleted successfully",
  "data": {
    "id": 1,
    "name": "Laptop",
    "description": "High-performance laptop",
    "price": "999.99",
    "stock": 50,
    "categories": [
      {
        "id": 1,
        "name": "Electronics",
        "description": "Electronic devices"
      }
    ],
    "categoryId": 1,
    "createdAt": "2024-01-15T10:30:00.000Z",
    "updatedAt": "2024-01-15T10:30:00.000Z"
  }
}
```

**Errors:**
- `401` - Authentication required
- `403` - Admin privileges required
- `404` - Product not found

---

## File Upload Endpoints

All file upload endpoints are under `/api/admin/upload`.

### Upload Single Image

Upload a single product image file.

**Endpoint:** `POST /api/admin/upload`

**Authentication:** Required (Admin only)

**Request:**
- Content-Type: `multipart/form-data`
- Field name: `file` or `image` (both are accepted)
- File types: JPEG, PNG, GIF, WebP
- Maximum file size: 10MB

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "url": "https://api.gerar.mn/uploads/product-1234567890-987654321.jpg"
  },
  "url": "https://api.gerar.mn/uploads/product-1234567890-987654321.jpg",
  "imageUrl": "https://api.gerar.mn/uploads/product-1234567890-987654321.jpg",
  "path": "/uploads/product-1234567890-987654321.jpg"
}
```

**Notes:**
- The endpoint accepts files with field name `file` or `image`
- Returns multiple response formats for compatibility:
  - `data.url` - Standard format
  - `url` - Alternative format
  - `imageUrl` - Alternative format
  - `path` - Relative path
- Files are stored in `public/uploads/` directory
- Files are accessible at `/uploads/{filename}`
- Filenames are automatically generated with timestamp and random number to prevent conflicts

**Errors:**
- `400` - No file uploaded
- `400` - Invalid file type (only JPEG, PNG, GIF, WebP allowed)
- `400` - File too large (maximum 10MB)
- `401` - Authentication required
- `403` - Admin privileges required

---

### Upload Multiple Images

Upload multiple product image files at once.

**Endpoint:** `POST /api/admin/upload/multiple`

**Authentication:** Required (Admin only)

**Request:**
- Content-Type: `multipart/form-data`
- Field name: `files` (array)
- File types: JPEG, PNG, GIF, WebP
- Maximum file size per file: 10MB
- Maximum number of files: 10

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "files": [
      {
        "url": "https://api.gerar.mn/uploads/product-1234567890-987654321.jpg",
        "filename": "product-1234567890-987654321.jpg",
        "originalname": "product-image.jpg",
        "size": 245678,
        "mimetype": "image/jpeg"
      },
      {
        "url": "https://api.gerar.mn/uploads/product-1234567891-123456789.jpg",
        "filename": "product-1234567891-123456789.jpg",
        "originalname": "product-image-2.jpg",
        "size": 189234,
        "mimetype": "image/png"
      }
    ],
    "urls": [
      "https://api.gerar.mn/uploads/product-1234567890-987654321.jpg",
      "https://api.gerar.mn/uploads/product-1234567891-123456789.jpg"
    ]
  },
  "files": [
    {
      "url": "https://api.gerar.mn/uploads/product-1234567890-987654321.jpg",
      "filename": "product-1234567890-987654321.jpg",
      "originalname": "product-image.jpg",
      "size": 245678,
      "mimetype": "image/jpeg"
    }
  ]
}
```

**Notes:**
- Returns array of file objects with detailed information
- `data.urls` provides a simple array of URLs for easy use
- All files are validated individually
- If any file fails validation, the entire request fails

**Errors:**
- `400` - No files uploaded
- `400` - Invalid file type (only JPEG, PNG, GIF, WebP allowed)
- `400` - File too large (maximum 10MB per file)
- `400` - Too many files (maximum 10 files)
- `401` - Authentication required
- `403` - Admin privileges required

---

### Delete Image

Delete an uploaded image file from the server.

**Endpoint:** `POST /api/admin/upload/delete`

**Authentication:** Required (Admin only)

**Request Body:**
```json
{
  "imageUrl": "https://api.gerar.mn/uploads/product-1234567890-987654321.jpg",
  "path": "/uploads/product-1234567890-987654321.jpg"
}
```

**Notes:**
- Either `imageUrl` or `path` is required (both can be provided)
- The endpoint extracts the filename from the provided URL or path
- If the file doesn't exist, returns success (idempotent operation)
- Only files in the `/uploads/` directory can be deleted (security check)
- Prevents directory traversal attacks

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Image deleted successfully",
  "data": {
    "filename": "product-1234567890-987654321.jpg",
    "deleted": true
  }
}
```

**Response (if file doesn't exist):** `200 OK`
```json
{
  "success": true,
  "message": "Image deleted successfully (file did not exist)",
  "data": {
    "filename": "product-1234567890-987654321.jpg",
    "deleted": false,
    "reason": "File not found"
  }
}
```

**Errors:**
- `400` - Neither imageUrl nor path provided
- `400` - Invalid filename (contains invalid characters)
- `403` - Permission denied or invalid file path
- `401` - Authentication required
- `403` - Admin privileges required

**Use Cases:**
- Delete images that were uploaded but not used in product creation
- Remove images when editing products and removing image URLs
- Clean up orphaned images from failed uploads
- Prevent storage bloat by removing unused images

---

## Constants Endpoints

All constants management endpoints are under `/api/admin/constants`.

These endpoints allow admins to update the configuration files:
- `src/constants/deliveryTimeSlots.js`
- `src/constants/districts.js`

Updates are validated and written to disk, so changes persist across server restarts.

### Get Delivery Time Slots

Retrieve the current delivery time slots.

**Endpoint:** `GET /api/admin/constants/delivery-time-slots`

**Authentication:** Required (Admin only)

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "slots": {
      "MORNING": "10-14",
      "AFTERNOON": "14-18",
      "EVENING": "18-21",
      "NIGHT": "21-00"
    },
    "validSlots": ["10-14", "14-18", "18-21", "21-00"]
  }
}
```

**Notes:**
- `validSlots` is derived from the values in `slots`
- Slot values follow the `HH-HH` format (24h clock)

---

### Update Delivery Time Slots

Replace all delivery time slots.

**Endpoint:** `POST /api/admin/constants/delivery-time-slots`

**Authentication:** Required (Admin only)

**Request Body:**
```json
{
  "slots": {
    "MORNING": "10-14",
    "AFTERNOON": "14-18",
    "EVENING": "18-21",
    "NIGHT": "21-00"
  }
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Delivery time slots updated successfully.",
  "data": {
    "slots": {
      "MORNING": "10-14",
      "AFTERNOON": "14-18",
      "EVENING": "18-21",
      "NIGHT": "21-00"
    },
    "validSlots": ["10-14", "14-18", "18-21", "21-00"]
  }
}
```

**Validation Rules:**
- `slots` must be a non-empty object
- Keys must be non-empty strings
- Values must match `HH-HH` format with hours between 0 and 24

**Errors:**
- `400` - Validation failed
- `401` - Authentication required
- `403` - Admin privileges required

---

### Get Districts

Retrieve the current districts map.

**Endpoint:** `GET /api/admin/constants/districts`

**Authentication:** Required (Admin only)

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "districts": {
      "Баянзүрх дүүрэг": 25,
      "Сүхбаатар дүүрэг": 20
    }
  }
}
```

---

### Update Districts

Replace all districts and their khoroo counts.

**Endpoint:** `POST /api/admin/constants/districts`

**Authentication:** Required (Admin only)

**Request Body:**
```json
{
  "districts": {
    "Баянзүрх дүүрэг": 25,
    "Сүхбаатар дүүрэг": 20
  }
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Districts updated successfully.",
  "data": {
    "districts": {
      "Баянзүрх дүүрэг": 25,
      "Сүхбаатар дүүрэг": 20
    }
  }
}
```

**Validation Rules:**
- `districts` must be a non-empty object
- Keys must be non-empty strings
- Values must be positive integers (khoroo count)

**Errors:**
- `400` - Validation failed
- `401` - Authentication required
- `403` - Admin privileges required

---

## Orders Endpoints

All order management endpoints are under `/api/admin/orders`.

### Get All Orders

Retrieve all orders from all users with full details.

**Endpoint:** `GET /api/admin/orders/all`

**Authentication:** Required (Admin only)

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "All orders retrieved successfully",
  "data": [
    {
      "id": 1,
      "userId": 1,
      "addressId": 1,
      "deliveryTimeSlot": "14-18",
      "totalAmount": "1999.98",
      "status": "PENDING",
      "createdAt": "2024-01-15T10:30:00.000Z",
      "updatedAt": "2024-01-15T10:30:00.000Z",
      "user": {
        "id": 1,
        "phoneNumber": "12345678",
        "email": "user@example.com",
        "name": "John Doe"
      },
      "address": {
        "id": 1,
        "fullName": "John Doe",
        "phoneNumber": "12345678",
        "provinceOrDistrict": "Ulaanbaatar",
        "khorooOrSoum": "Bayangol",
        "street": "Peace Avenue",
        "neighborhood": "Downtown",
        "residentialComplex": "Green Complex",
        "building": "Building 5",
        "entrance": "Entrance A",
        "apartmentNumber": "Apt 12B",
        "addressNote": "Next to the blue gate, call when arrived",
        "label": "Home"
      },
      "items": [
        {
          "id": 1,
          "orderId": 1,
          "productId": 1,
          "quantity": 2,
          "price": "999.99",
          "product": {
            "id": 1,
            "name": "Laptop",
            "description": "High-performance laptop",
            "price": "999.99",
            "stock": 50,
            "categories": [
              {
                "id": 1,
                "name": "Electronics",
                "description": "Electronic devices"
              }
            ],
            "categoryId": 1,
            "category": {
              "id": 1,
              "name": "Electronics",
              "description": "Electronic devices"
            }
          }
        }
      ]
    }
  ]
}
```

**Notes:**
- Orders are sorted by `createdAt` in descending order (newest first)
- Each order includes full user information (with email if provided)
- Each order includes delivery address information
- Each order includes delivery time slot if selected (`"10-14"`, `"14-18"`, `"18-21"`, `"21-00"` or `null`)
- Default order status is `"PENDING"` (can be `"PENDING"`, `"COMPLETED"`, `"CANCELLED"`, etc.)
- Each order item includes full product and category information

**Delivery Time Slot Format:**
- `"10-14"` - 10:00 to 14:00
- `"14-18"` - 14:00 to 18:00
- `"18-21"` - 18:00 to 21:00
- `"21-00"` - 21:00 to 00:00 (midnight)
- `null` - No time slot selected

**Errors:**
- `401` - Authentication required
- `403` - Admin privileges required

---

## Users Endpoints

All user management endpoints are under `/api/admin/users`.

### Get All Users

Retrieve all users with summary statistics (order count, address count, etc.).

**Endpoint:** `GET /api/admin/users`

**Authentication:** Required (Admin only)

**Query Parameters:**
- `search` (optional) - Search by name, phone number, or email
- `role` (optional) - Filter by role (`USER` or `ADMIN`)
- `page` (optional) - Page number (default: 1)
- `limit` (optional) - Items per page (default: 50)

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Users retrieved successfully",
  "data": [
    {
      "id": 1,
      "phoneNumber": "12345678",
      "email": "user@example.com",
      "name": "John Doe",
      "role": "USER",
      "createdAt": "2024-01-15T10:30:00.000Z",
      "updatedAt": "2024-01-15T10:30:00.000Z",
      "_count": {
        "orders": 5,
        "addresses": 2,
        "favorites": 12,
        "cartItems": 3
      }
    },
    {
      "id": 2,
      "phoneNumber": "87654321",
      "email": null,
      "name": "Jane Smith",
      "role": "USER",
      "createdAt": "2024-01-16T14:20:00.000Z",
      "updatedAt": "2024-01-16T14:20:00.000Z",
      "_count": {
        "orders": 2,
        "addresses": 1,
        "favorites": 5,
        "cartItems": 0
      }
    }
  ],
  "pagination": {
    "total": 2,
    "page": 1,
    "limit": 50,
    "totalPages": 1
  }
}
```

**Notes:**
- Users are sorted by `createdAt` in descending order (newest first)
- The `_count` object provides statistics about user activity
- Email may be `null` if user didn't provide one
- Pagination info is included in the response

**Errors:**
- `401` - Authentication required
- `403` - Admin privileges required

---

### Get User by ID

Retrieve detailed information about a specific user, including all orders, addresses, and statistics.

**Endpoint:** `GET /api/admin/users/:id`

**Authentication:** Required (Admin only)

**URL Parameters:**
- `id` (required) - User ID

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "User retrieved successfully",
  "data": {
    "id": 1,
    "phoneNumber": "12345678",
    "email": "user@example.com",
    "name": "John Doe",
    "role": "USER",
    "createdAt": "2024-01-15T10:30:00.000Z",
    "updatedAt": "2024-01-15T10:30:00.000Z",
    "addresses": [
      {
        "id": 1,
        "userId": 1,
        "label": "Home",
        "fullName": "John Doe",
        "phoneNumber": "12345678",
        "provinceOrDistrict": "Ulaanbaatar",
        "khorooOrSoum": "Bayangol",
        "street": "Peace Avenue",
        "neighborhood": "Downtown",
        "residentialComplex": "Green Complex",
        "building": "Building 5",
        "entrance": "Entrance A",
        "apartmentNumber": "Apt 12B",
        "addressNote": "Next to the blue gate",
        "isDefault": true,
        "createdAt": "2024-01-15T10:35:00.000Z",
        "updatedAt": "2024-01-15T10:35:00.000Z"
      }
    ],
    "orders": [
      {
        "id": 1,
        "status": "PENDING",
        "totalAmount": "1999.98",
        "deliveryTimeSlot": "14-18",
        "address": {
          "id": 1,
          "fullName": "John Doe",
          "phoneNumber": "12345678",
          "provinceOrDistrict": "Ulaanbaatar",
          "khorooOrSoum": "Bayangol",
          "street": "Peace Avenue",
          "neighborhood": "Downtown",
          "residentialComplex": "Green Complex",
          "building": "Building 5",
          "entrance": "Entrance A",
          "apartmentNumber": "Apt 12B",
          "addressNote": "Next to the blue gate",
          "label": "Home"
        },
        "createdAt": "2024-01-15T10:40:00.000Z",
        "updatedAt": "2024-01-15T10:40:00.000Z",
        "items": [
          {
            "id": 1,
            "quantity": 2,
            "price": "999.99",
            "product": {
              "id": 1,
              "name": "Laptop",
              "description": "High-performance laptop",
              "price": "999.99",
              "originalPrice": "1299.99",
              "images": [
                "https://example.com/laptop-front.jpg",
                "https://example.com/laptop-side.jpg"
              ],
              "categories": [
                {
                  "id": 1,
                  "name": "Electronics"
                },
                {
                  "id": 2,
                  "name": "Computers"
                }
              ]
            }
          }
        ]
      }
    ],
    "_count": {
      "orders": 5,
      "addresses": 2,
      "favorites": 12,
      "cartItems": 3
    }
  }
}
```

**Notes:**
- Returns complete user profile with all related data
- Orders are sorted by `createdAt` in descending order (newest first)
- Each order includes full product information with categories
- Addresses are sorted by `isDefault` (default address first)
- The `_count` object provides statistics

**Errors:**
- `401` - Authentication required
- `403` - Admin privileges required
- `404` - User not found
- `400` - Invalid user ID

---

### Generate Password Reset Code

Generate a password reset code and link for a user. This allows admins to help users reset their passwords.

**Endpoint:** `POST /api/admin/users/:id/reset-password`

**Authentication:** Required (Admin only)

**URL Parameters:**
- `id` (required) - User ID

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Password reset code generated successfully",
  "data": {
    "userId": 1,
    "userPhone": "12345678",
    "userEmail": "user@example.com",
    "userName": "John Doe",
    "resetCode": "456789",
    "resetToken": "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6",
    "expiresAt": "2024-01-15T11:30:00.000Z",
    "resetLink": "http://localhost:3000/reset-password?token=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6&code=456789",
    "message": "Reset code generated for user: John Doe (12345678)"
  }
}
```

**Notes:**
- Returns a 6-digit reset code and a reset token
- Reset code expires in 1 hour
- The reset link can be sent to the user via email or SMS
- Admin can share the reset code or link with the user
- In production, consider sending the code via SMS/email automatically

**Errors:**
- `401` - Authentication required
- `403` - Admin privileges required
- `404` - User not found
- `400` - Invalid user ID

---

### Reset User Password (Admin)

Reset a user's password directly. This bypasses the reset code verification and allows admins to set a new PIN for users.

**Endpoint:** `POST /api/admin/users/:id/reset-password/execute`

**Authentication:** Required (Admin only)

**URL Parameters:**
- `id` (required) - User ID

**Request Body:**
```json
{
  "newPin": "5678",
  "resetCode": "456789",
  "resetToken": "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6"
}
```

**Request Body Fields:**
- `newPin` (required) - New 4-digit PIN for the user
- `resetCode` (optional) - Reset code from generate endpoint (for logging/verification)
- `resetToken` (optional) - Reset token from generate endpoint (for logging/verification)

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Password reset successfully",
  "data": {
    "userId": 1
  }
}
```

**Notes:**
- Admin can reset password for any user
- New PIN must be exactly 4 digits
- The PIN is immediately updated and the user can log in with the new PIN
- `resetCode` and `resetToken` are optional and used for audit/logging purposes

**Validation:**
- `newPin`: Required, must be exactly 4 digits

**Errors:**
- `401` - Authentication required
- `403` - Admin privileges required
- `404` - User not found
- `400` - Invalid user ID or PIN format

---

## Data Models

### Category
```typescript
interface Category {
  id: number;
  name: string;              // Unique per parent category
  description: string | null;
  parentId: number | null;   // null for top-level categories
  createdAt: string;         // ISO 8601 date string
  updatedAt: string;         // ISO 8601 date string
  children?: Category[];     // Subcategories nested in this field (NOT "subcategories")
}
```

**Important:** When categories are fetched with subcategories, they appear in a `children` array field, not `subcategories`. For example:
- Top-level category "Household goods" will have `children: [ { id: 2, name: "Kitchen", ... } ]`
- The "Kitchen" subcategory will have `parentId: 1` and `children: []` (empty if no further subcategories)

### Product
```typescript
interface Product {
  id: number;
  name: string;
  description: string;
  price: string;             // Decimal as string (e.g., "999.99")
  originalPrice: string | null; // Original price before discount (null if no discount)
  images: string[];          // Array of image URLs
  firstImage: string | null; // First image URL for easy access
  hasDiscount: boolean;      // Whether product has a discount
  discountAmount: string | null; // Discount amount saved
  discountPercentage: number | null; // Discount percentage (0-100)
  stock: number;             // Integer, >= 0
  categories: Category[];    // Array of categories this product belongs to
  categoryId: number | null; // First category ID (for backward compatibility)
  category?: Category;       // First category object (for backward compatibility)
  createdAt: string;         // ISO 8601 date string
  updatedAt: string;         // ISO 8601 date string
}
```

### Order
```typescript
interface Order {
  id: number;
  userId: number;
  addressId: number | null;
  deliveryTimeSlot: string | null; // "10-14" | "14-18" | "18-21" | "21-00" | null
  totalAmount: string;       // Decimal as string
  status: "PENDING" | "COMPLETED" | "CANCELLED" | string;
  createdAt: string;         // ISO 8601 date string
  updatedAt: string;         // ISO 8601 date string
  address?: Address;         // Included in order responses
  user?: {                   // Included in admin responses
    id: number;
    phoneNumber: string;
    email: string | null;
    name: string;
  };
  items: OrderItem[];        // Array of order items
}

interface OrderItem {
  id: number;
  orderId: number;
  productId: number;
  quantity: number;
  price: string;             // Decimal as string
  product?: Product;         // Included in order responses
}

interface Address {
  id: number;
  userId: number;
  label: string | null;
  fullName: string;
  phoneNumber: string;
  provinceOrDistrict: string;
  khorooOrSoum: string;
  street: string | null;
  neighborhood: string | null;
  residentialComplex: string | null;
  building: string | null;
  entrance: string | null;
  apartmentNumber: string | null;
  addressNote: string | null;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}
```

### ProductCategory
```typescript
interface ProductCategory {
  id: number;
  productId: number;
  categoryId: number;
  order: number;           // Display order within this category (lower = shows first, default: 0)
  createdAt: string;       // ISO 8601 date string
}
```

**Important:** The `ProductCategory` model is a junction table that links products to categories with an ordering field. The `order` field controls the display order of products within each category. Lower order numbers appear first when viewing products in a category.

### User
```typescript
interface User {
  id: number;
  phoneNumber: string;       // 8 digits, unique
  email: string | null;      // Optional, unique if provided
  name: string;
  role: "USER" | "ADMIN";
  createdAt: string;         // ISO 8601 date string
  updatedAt: string;         // ISO 8601 date string
}
```

---

## Error Handling

All error responses follow this format:

```json
{
  "success": false,
  "message": "Error message description",
  "error": {
    "code": "ERROR_CODE",
    "message": "Detailed error message",
    "details": {} // Optional additional error details
  },
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### Common Error Codes

| Status Code | Description |
|------------|-------------|
| `400` | Bad Request - Validation failed or invalid input |
| `401` | Unauthorized - Missing or invalid authentication token |
| `403` | Forbidden - User doesn't have admin privileges |
| `404` | Not Found - Resource doesn't exist |
| `409` | Conflict - Resource already exists (e.g., duplicate category name) |
| `500` | Internal Server Error - Server-side error |

---

## Example Requests

### Using cURL

#### Create Category
```bash
curl -X POST http://localhost:3000/api/admin/categories \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Electronics",
    "description": "Electronic devices"
  }'
```

#### Update Product
```bash
# Update price and stock
curl -X POST http://localhost:3000/api/admin/products/1/update \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "price": 899.99,
    "stock": 40
  }'

# Update categories (replaces all existing categories)
curl -X POST http://localhost:3000/api/admin/products/1/update \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "categoryIds": [1, 2, 5]
  }'
```

#### Get All Categories (with Subcategories)
```bash
curl -X GET http://localhost:3000/api/admin/categories \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

#### Get All Orders
```bash
curl -X GET http://localhost:3000/api/admin/orders/all \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Using JavaScript (Fetch API)

#### Create Product
```javascript
const createProduct = async (productData, token) => {
  const response = await fetch('http://localhost:3000/api/admin/products', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(productData)
  });
  
  const data = await response.json();
  return data;
};

// Usage with multiple categories and ordering
const product = await createProduct({
  name: "Gaming Laptop",
  description: "High-performance gaming laptop",
  price: 1299.99,
  originalPrice: 1499.99,
  images: [
    "https://example.com/laptop-front.jpg",
    "https://example.com/laptop-side.jpg"
  ],
  stock: 50,
  categoryIds: [1, 2, 5],  // Multiple categories
  categoryOrders: {        // Set display order within each category (lower = shows first)
    1: 0,                  // First product in category 1
    2: 1,                  // Second product in category 2
    5: 0                   // First product in category 5
  }
}, 'YOUR_JWT_TOKEN');

// Usage with single category (backward compatible)
const productSingle = await createProduct({
  name: "Laptop",
  description: "High-performance laptop",
  price: 999.99,
  stock: 50,
  categoryId: 1  // Single category - still works
}, 'YOUR_JWT_TOKEN');
```

#### Update Category
```javascript
const updateCategory = async (categoryId, updates, token) => {
  const response = await fetch(`http://localhost:3000/api/admin/categories/${categoryId}/update`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(updates)
  });
  
  const data = await response.json();
  return data;
};
```

#### Get All Categories
```javascript
const getAllCategories = async (token) => {
  const response = await fetch('http://localhost:3000/api/admin/categories', {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  const data = await response.json();
  return data.data; // Returns array of categories with nested subcategories in 'children' field
};
```

#### Get All Orders
```javascript
const getAllOrders = async (token) => {
  const response = await fetch('http://localhost:3000/api/admin/orders/all', {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  const data = await response.json();
  return data.data; // Returns array of orders
};
```

#### Get All Users
```javascript
const getAllUsers = async (token, filters = {}) => {
  const params = new URLSearchParams();
  if (filters.search) params.append('search', filters.search);
  if (filters.role) params.append('role', filters.role);
  if (filters.page) params.append('page', filters.page);
  if (filters.limit) params.append('limit', filters.limit);
  
  const response = await fetch(`http://localhost:3000/api/admin/users?${params}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  const data = await response.json();
  return {
    users: data.data,
    pagination: data.pagination
  };
};
```

#### Get User by ID
```javascript
const getUserById = async (userId, token) => {
  const response = await fetch(`http://localhost:3000/api/admin/users/${userId}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  const data = await response.json();
  return data.data; // Returns user with orders, addresses, and statistics
};
```

#### Generate Password Reset Code
```javascript
const generateResetCode = async (userId, token) => {
  const response = await fetch(`http://localhost:3000/api/admin/users/${userId}/reset-password`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });
  
  const data = await response.json();
  return data.data; // Returns reset code, token, and link
};
```

#### Reset User Password
```javascript
const resetUserPassword = async (userId, newPin, token, resetCode = null, resetToken = null) => {
  const response = await fetch(`http://localhost:3000/api/admin/users/${userId}/reset-password/execute`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      newPin,
      resetCode,
      resetToken
    })
  });
  
  const data = await response.json();
  return data;
};
```

### Using Axios

```javascript
import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:3000/api/admin',
  headers: {
    'Content-Type': 'application/json'
  }
});

// Add token to requests
api.interceptors.request.use(config => {
  const token = localStorage.getItem('adminToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Get all categories (with nested subcategories)
const getAllCategories = () => {
  return api.get('/categories');
};

// Create category
const createCategory = (categoryData) => {
  return api.post('/categories', categoryData);
};

// Update product
const updateProduct = (productId, updates) => {
  return api.post(`/products/${productId}/update`, updates);
};

// Example: Update product with multiple categories
updateProduct(1, {
  categoryIds: [1, 3, 5]  // Replaces all existing categories
});

// Delete product
const deleteProduct = (productId) => {
  return api.post(`/products/${productId}/delete`, {});
};

// Get all orders
const getAllOrders = () => {
  return api.get('/orders/all');
};

// Get all users with optional filters
const getAllUsers = (filters = {}) => {
  return api.get('/users', { params: filters });
};

// Get user by ID with full details
const getUserById = (userId) => {
  return api.get(`/users/${userId}`);
};

// Generate password reset code for user
const generateResetCode = (userId) => {
  return api.post(`/users/${userId}/reset-password`);
};

// Reset user password (admin)
const resetUserPassword = (userId, newPin, resetCode = null, resetToken = null) => {
  return api.post(`/users/${userId}/reset-password/execute`, {
    newPin,
    resetCode,
    resetToken
  });
};
```

---

## Public Endpoints Reference

While not admin-specific, admins can also use these public endpoints for viewing data:

- `GET /api/categories` - Get all categories (with nested subcategories in `children` field)
- `GET /api/categories/:id` - Get category by ID (includes subcategories in `children` field)
- `GET /api/products` - Get all products (with filters)
- `GET /api/products/:id` - Get product by ID
- `GET /api/orders/:id` - Get order by ID (admins can view any order)

**Note:** The public `GET /api/categories` endpoint returns categories with subcategories nested in a `children` array. Subcategories are not shown as separate top-level items - they appear only inside their parent category's `children` array.

---

## Notes for Frontend Development

1. **Token Management**: Store JWT token securely (e.g., localStorage, httpOnly cookie)
2. **Error Handling**: Always check `success` field in responses and handle errors appropriately
3. **Loading States**: Show loading indicators during API calls
4. **Validation**: Implement client-side validation before API calls
5. **Refresh Token**: Consider implementing token refresh logic if tokens expire
6. **Category Hierarchy**: When displaying categories, handle nested subcategories properly. Subcategories are returned in the `children` field (not `subcategories`). Display them as nested/indented under their parent categories in the UI.
7. **Price Formatting**: Prices are returned as strings, format them for display
8. **Date Formatting**: All dates are ISO 8601 strings, format them for display
9. **Stock Management**: Show stock alerts when stock is low (e.g., < 10)
10. **Order Status**: Display order status with appropriate colors/badges (default is "PENDING")
11. **Delivery Time Slots**: Format time slots for display (e.g., "10:00 - 14:00" instead of "10-14")
12. **Address Display**: Show full delivery address in order details, handle null/optional fields gracefully
13. **Email Display**: Handle optional email field - may be null for users who didn't provide email during registration

---

## Quick Reference

### Category Endpoints
- `GET /api/admin/categories` - Get all categories with nested subcategories
- `POST /api/admin/categories` - Create category
- `POST /api/admin/categories/:id/update` - Update category
- `POST /api/admin/categories/:id/delete` - Delete category

### User Endpoints
- `GET /api/admin/users` - Get all users (with pagination and filters)
- `GET /api/admin/users/:id` - Get user by ID (with orders, addresses, statistics)
- `POST /api/admin/users/:id/reset-password` - Generate password reset code
- `POST /api/admin/users/:id/reset-password/execute` - Reset user password

### Product Endpoints
- `POST /api/admin/products` - Create product
- `POST /api/admin/products/:id/update` - Update product
- `POST /api/admin/products/:id/delete` - Delete product

### Order Endpoints
- `GET /api/admin/orders/all` - Get all orders

### Constants Endpoints
- `GET /api/admin/constants/delivery-time-slots` - Get delivery time slots
- `POST /api/admin/constants/delivery-time-slots` - Update delivery time slots
- `GET /api/admin/constants/districts` - Get districts
- `POST /api/admin/constants/districts` - Update districts

---

*Last Updated: January 2026*
