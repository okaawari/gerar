# Ecommerce API Documentation

This document provides comprehensive API documentation for front-end developers to integrate with the Ecommerce backend API.

## Table of Contents

- [Base Information](#base-information)
- [Authentication](#authentication)
- [Response Format](#response-format)
- [Error Handling](#error-handling)
- [API Endpoints](#api-endpoints)
  - [Authentication](#authentication-endpoints)
  - [Categories](#categories-endpoints)
  - [Products](#products-endpoints)
  - [Cart](#cart-endpoints)
  - [Addresses](#addresses-endpoints)
  - [Orders](#orders-endpoints)
- [Data Models](#data-models)
- [Examples](#examples)

---

## Base Information

### Base URL
```
Development: http://localhost:3000/api
Production: [Your production URL]/api
```

### Health Check
```
GET /
```
Returns server status and API information.

**Response:**
```json
{
  "success": true,
  "message": "Ecommerce API is running",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "version": "1.0.0"
}
```

---

## Authentication

The API uses **JWT (JSON Web Token)** for authentication. Most endpoints require authentication except for public endpoints (like viewing products and categories).

### How to Authenticate

1. **Register** or **Login** to receive a JWT token
2. Include the token in the `Authorization` header for protected endpoints:
   ```
   Authorization: Bearer <your-token-here>
   ```

### Token Format
```
Bearer <jwt-token>
```

### Token Lifetime
Tokens do not expire by default. However, if a user is deleted or modified, the token will become invalid.

---

## Response Format

All API responses follow a consistent format:

### Success Response
```json
{
  "success": true,
  "message": "Operation successful",
  "data": {
    // Response data here
  }
}
```

### Error Response
```json
{
  "success": false,
  "message": "Error message",
  "error": {
    "code": "ERROR_CODE",
    "message": "Error message",
    "details": {} // Optional additional details
  },
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

---

## Error Handling

### HTTP Status Codes

- `200` - Success
- `201` - Created
- `400` - Bad Request (validation errors, invalid input)
- `401` - Unauthorized (missing or invalid token)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found (resource doesn't exist)
- `409` - Conflict (duplicate entry)
- `500` - Internal Server Error

### Error Codes

- `VALIDATION_ERROR` - Request validation failed
- `AUTHENTICATION_ERROR` - Authentication failed
- `INVALID_TOKEN` - Invalid or malformed token
- `TOKEN_EXPIRED` - Token has expired
- `NOT_FOUND` - Resource not found
- `DUPLICATE_ENTRY` - Record already exists
- `DATABASE_ERROR` - Database operation failed
- `INTERNAL_ERROR` - Internal server error

### Example Error Response
```json
{
  "success": false,
  "message": "Validation failed",
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": {
      "errors": [
        "phoneNumber must be exactly 8 digits",
        "pin must be exactly 4 digits"
      ]
    }
  },
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

---

## API Endpoints

## Authentication Endpoints

### Register User

Create a new user account.

**Endpoint:** `POST /api/auth/register`

**Authentication:** Not required

**Request Body:**
```json
{
  "phoneNumber": "12345678",  // Exactly 8 digits
  "pin": "1234",              // Exactly 4 digits
  "name": "John Doe"          // Non-empty string
}
```

**Response:** `201 Created`
```json
{
  "success": true,
  "message": "User registered successfully",
  "data": {
    "user": {
      "id": 1,
      "phoneNumber": "12345678",
      "name": "John Doe",
      "role": "USER",
      "createdAt": "2024-01-15T10:30:00.000Z",
      "updatedAt": "2024-01-15T10:30:00.000Z"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

**Validation Rules:**
- `phoneNumber`: Required, must be exactly 8 digits
- `pin`: Required, must be exactly 4 digits
- `name`: Required, must be a non-empty string

**Errors:**
- `409` - User with this phone number already exists
- `400` - Validation failed

---

### Login

Authenticate and receive a JWT token.

**Endpoint:** `POST /api/auth/login`

**Authentication:** Not required

**Request Body:**
```json
{
  "phoneNumber": "12345678",  // Exactly 8 digits
  "pin": "1234"               // Exactly 4 digits
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "id": 1,
      "phoneNumber": "12345678",
      "name": "John Doe",
      "role": "USER",
      "createdAt": "2024-01-15T10:30:00.000Z",
      "updatedAt": "2024-01-15T10:30:00.000Z"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

**Errors:**
- `401` - Invalid credentials
- `400` - Validation failed

---

### Request Password Reset

Request a password reset code for your account using your phone number.

**Endpoint:** `POST /api/auth/forgot-password`

**Authentication:** Not required

**Request Body:**
```json
{
  "phoneNumber": "12345678"  // Exactly 8 digits
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Reset code generated successfully",
  "data": {
    "resetCode": "456789",
    "resetToken": "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6",
    "expiresAt": "2024-01-15T11:30:00.000Z",
    "resetLink": "http://localhost:3000/reset-password?token=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6&code=456789"
  }
}
```

**Notes:**
- Returns a 6-digit reset code and reset token
- Reset code expires in 1 hour
- The reset link includes both token and code for convenience
- In production, the reset code should be sent via SMS automatically

**Errors:**
- `400` - Invalid phone number format
- `400` - Phone number is required

---

### Reset Password

Reset your password using the reset code received from the forgot-password endpoint.

**Endpoint:** `POST /api/auth/reset-password`

**Authentication:** Not required

**Request Body:**
```json
{
  "phoneNumber": "12345678",  // Exactly 8 digits
  "resetCode": "456789",      // 6-digit code from forgot-password
  "newPin": "5678",           // New 4-digit PIN
  "resetToken": "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6"  // Optional token from forgot-password
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Password reset successfully",
  "data": {
    "user": {
      "id": 1,
      "phoneNumber": "12345678",
      "name": "John Doe",
      "role": "USER",
      "createdAt": "2024-01-15T10:30:00.000Z",
      "updatedAt": "2024-01-15T10:30:00.000Z"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

**Notes:**
- New PIN must be exactly 4 digits
- Returns user data and a new authentication token for automatic login
- The reset code must be valid and not expired (expires in 1 hour)

**Validation:**
- `phoneNumber`: Required, must be exactly 8 digits
- `resetCode`: Required, must be 6 digits
- `newPin`: Required, must be exactly 4 digits
- `resetToken`: Optional, can be included from the reset link

**Errors:**
- `400` - Invalid reset code or user not found
- `400` - Invalid PIN format
- `400` - Phone number, reset code, and new PIN are required

---

## Categories Endpoints

### Get All Categories

Retrieve all product categories.

**Endpoint:** `GET /api/categories`

**Authentication:** Not required

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Categories retrieved successfully",
  "data": [
    {
      "id": 1,
      "name": "Electronics",
      "description": "Electronic devices and gadgets",
      "createdAt": "2024-01-15T10:30:00.000Z",
      "updatedAt": "2024-01-15T10:30:00.000Z"
    }
  ]
}
```

---

### Get Category by ID

Retrieve a specific category by ID.

**Endpoint:** `GET /api/categories/:id`

**Authentication:** Not required

**Parameters:**
- `id` (path) - Category ID

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Category retrieved successfully",
  "data": {
    "id": 1,
    "name": "Electronics",
    "description": "Electronic devices and gadgets",
    "createdAt": "2024-01-15T10:30:00.000Z",
    "updatedAt": "2024-01-15T10:30:00.000Z"
  }
}
```

**Errors:**
- `404` - Category not found

---

### Get Products by Category

Retrieve all products in a specific category. Products are automatically sorted by their display order within the category.

**Endpoint:** `GET /api/categories/:id/products`

**Authentication:** Not required

**Parameters:**
- `id` (path) - Category ID

**Query Parameters:**
- `includeSubcategories` (optional) - Include products from subcategories. Default: `false`. Set to `true` to include products from all child categories.

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Category products retrieved successfully",
  "data": [
    {
      "id": 1,
      "name": "Laptop",
      "description": "High-performance laptop",
      "price": "999.99",
      "originalPrice": "1299.99",
      "images": [
        "https://example.com/laptop-front.jpg"
      ],
      "firstImage": "https://example.com/laptop-front.jpg",
      "hasDiscount": true,
      "discountAmount": "300.00",
      "discountPercentage": 23,
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
      },
      "createdAt": "2024-01-15T10:30:00.000Z",
      "updatedAt": "2024-01-15T10:30:00.000Z"
    }
  ]
}
```

**Notes:**
- Products are automatically sorted by their display order within the category (ascending - lower order numbers appear first), then by creation date (descending - newer first)
- The display order is set when products are assigned to categories
- If `includeSubcategories=true`, products from child categories are also included, but they are not sorted by the parent category's order

**Errors:**
- `404` - Category not found

---

## Products Endpoints

### Get All Products (Advanced Search)

Retrieve all products with advanced filtering, sorting, and pagination.

**Endpoint:** `GET /api/products`

**Authentication:** Not required

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
  - **Note:** When filtering by a single category (`categoryId` or `categoryIds` with one item) and no explicit `sortBy` is provided, products are automatically sorted by their display order within that category (ascending - lower order numbers appear first), then by creation date (descending - newer first)
- `sortOrder` (optional) - Sort order. Valid values: `asc`, `desc`. Default: `desc`

#### Pagination
- `page` (optional) - Page number (integer, starts from 1). Default: `1`
- `limit` (optional) - Number of items per page (integer, max 100). Default: `50`

**Examples:**
```
# Basic search
GET /api/products
GET /api/products?categoryId=1
GET /api/products?search=laptop
GET /api/products?inStock=true

# Advanced search with multiple filters
GET /api/products?categoryIds[]=1&categoryIds[]=2&search=laptop&inStock=true
GET /api/products?minPrice=100&maxPrice=1000&sortBy=price&sortOrder=asc
GET /api/products?categoryId=1&search=gaming&minStock=5&maxStock=50

# Date range filtering
GET /api/products?createdAfter=2024-01-01&createdBefore=2024-12-31

# With pagination
GET /api/products?page=1&limit=20&sortBy=name&sortOrder=asc

# Complex query combining all filters
GET /api/products?categoryIds=1,2&search=laptop&minPrice=500&maxPrice=2000&minStock=1&inStock=true&sortBy=price&sortOrder=asc&page=1&limit=25
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
      "isFavorite": false,
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
  - `discountAmount` - Discount amount saved (string or null)
  - `discountPercentage` - Discount percentage (integer or null)
  - `isFavorite` - Boolean indicating if product is favorited by authenticated user (only present if authenticated)
  - `stock` - Stock quantity
  - `categories` - Array of category objects (product can belong to multiple categories), each with id, name, description
  - `categoryId` - First category ID (for backward compatibility)
  - `category` - First category object (for backward compatibility) with id, name, description
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
- **Automatic sorting by category order:** When filtering by a single category (`categoryId` or `categoryIds` with one item) and no explicit `sortBy` is provided, products are automatically sorted by their display order within that category (ascending - lower order numbers appear first), then by creation date (descending - newer first). If you specify `sortBy` explicitly, the automatic category order sorting is disabled.
- Invalid filter values are ignored (e.g., non-numeric price values)
- Date filters accept ISO 8601 format dates
- Maximum limit per page is 100 items
- Products include `firstImage` field for easy display of the first image in listings
- Discount information is automatically calculated when `originalPrice` is provided and greater than `price`
- `isFavorite` field is only included if user is authenticated (via Authorization header)
- Products can belong to multiple categories, and each category association has its own display order

---

### Get Product by ID

Retrieve a specific product by ID.

**Endpoint:** `GET /api/products/:id`

**Authentication:** Not required

**Parameters:**
- `id` (path) - Product ID

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Product retrieved successfully",
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
    "isFavorite": false,
    "stock": 50,
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
- `isFavorite` field is only included if user is authenticated (via Authorization header)
- Discount information is automatically calculated when `originalPrice` is provided and greater than `price`

**Errors:**
- `404` - Product not found

---


## Favorites Endpoints

All favorites endpoints require authentication.

### Get Favorites

Retrieve the authenticated user's favorite products.

**Endpoint:** `GET /api/favorites`

**Authentication:** Required

**Headers:**
```
Authorization: Bearer <token>
```

**Query Parameters:**
- `page` (optional) - Page number (integer, starts from 1). Default: `1`
- `limit` (optional) - Number of items per page (integer, max 100). Default: `50`

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Favorites retrieved successfully",
  "data": [
    {
      "id": 1,
      "name": "Laptop",
      "description": "High-performance laptop",
      "price": "899.99",
      "originalPrice": "999.99",
      "images": [
        "https://example.com/laptop-front.jpg",
        "https://example.com/laptop-side.jpg"
      ],
      "firstImage": "https://example.com/laptop-front.jpg",
      "hasDiscount": true,
      "discountAmount": "100.00",
      "discountPercentage": 10,
      "isFavorite": true,
      "favoritedAt": "2024-01-15T12:00:00.000Z",
      "stock": 50,
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
    "total": 25,
    "page": 1,
    "limit": 50,
    "totalPages": 1
  }
}
```

**Response Fields:**
- `data` - Array of favorite product objects (includes all product fields plus `favoritedAt`)
- `pagination.total` - Total number of favorite products
- `pagination.page` - Current page number
- `pagination.limit` - Number of items per page
- `pagination.totalPages` - Total number of pages

**Errors:**
- `401` - Authentication required

---

### Add to Favorites

Add a product to the authenticated user's favorites.

**Endpoint:** `POST /api/favorites`

**Authentication:** Required

**Headers:**
```
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "productId": 1
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Product added to favorites successfully",
  "data": {
    "id": 1,
    "name": "Laptop",
    "description": "High-performance laptop",
    "price": "899.99",
    "originalPrice": "999.99",
    "images": [
      "https://example.com/laptop-front.jpg",
      "https://example.com/laptop-side.jpg"
    ],
    "firstImage": "https://example.com/laptop-front.jpg",
    "hasDiscount": true,
    "discountAmount": "100.00",
    "discountPercentage": 10,
    "favoritedAt": "2024-01-15T12:00:00.000Z",
    "stock": 50,
    "categoryId": 1,
    "category": {
      "id": 1,
      "name": "Electronics",
      "description": "Electronic devices"
    }
  }
}
```

**Notes:**
- If the product is already favorited, it returns the existing favorite (no error)

**Errors:**
- `401` - Authentication required
- `400` - Product ID is required
- `404` - Product not found

---

### Remove from Favorites

Remove a product from the authenticated user's favorites.

**Endpoint:** `DELETE /api/favorites/:productId`

**Authentication:** Required

**Headers:**
```
Authorization: Bearer <token>
```

**Parameters:**
- `productId` (path) - Product ID

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Product removed from favorites successfully",
  "data": {
    "id": 1,
    "name": "Laptop",
    "description": "High-performance laptop",
    "price": "899.99",
    "favoritedAt": "2024-01-15T12:00:00.000Z",
    "stock": 50,
    "categoryId": 1,
    "category": {
      "id": 1,
      "name": "Electronics",
      "description": "Electronic devices"
    }
  }
}
```

**Errors:**
- `401` - Authentication required
- `404` - Product is not in favorites

---

### Check Favorite Status

Check if a specific product is favorited by the authenticated user.

**Endpoint:** `GET /api/favorites/:productId/status`

**Authentication:** Required

**Headers:**
```
Authorization: Bearer <token>
```

**Parameters:**
- `productId` (path) - Product ID

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Favorite status retrieved successfully",
  "data": {
    "productId": 1,
    "isFavorited": true
  }
}
```

**Errors:**
- `401` - Authentication required

---

## Cart Endpoints

All cart endpoints require authentication.

### Get Cart

Retrieve the authenticated user's cart items.

**Endpoint:** `GET /api/cart`

**Authentication:** Required

**Headers:**
```
Authorization: Bearer <token>
```

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Cart retrieved successfully",
  "data": [
    {
      "id": 1,
      "userId": 1,
      "productId": 1,
      "quantity": 2,
      "product": {
        "id": 1,
        "name": "Laptop",
        "description": "High-performance laptop",
        "price": "999.99",
        "stock": 50,
        "categoryId": 1
      },
      "createdAt": "2024-01-15T10:30:00.000Z",
      "updatedAt": "2024-01-15T10:30:00.000Z"
    }
  ]
}
```

**Errors:**
- `401` - Authentication required

---

### Add to Cart

Add a product to the user's cart or update quantity if already exists.

**Endpoint:** `POST /api/cart`

**Authentication:** Required

**Headers:**
```
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "productId": 1,  // Required, must exist
  "quantity": 2    // Required, must be > 0
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Item added to cart successfully",
  "data": {
    "id": 1,
    "userId": 1,
    "productId": 1,
    "quantity": 2,
    "product": {
      "id": 1,
      "name": "Laptop",
      "description": "High-performance laptop",
      "price": "999.99",
      "stock": 50,
      "categoryId": 1
    },
    "createdAt": "2024-01-15T10:30:00.000Z",
    "updatedAt": "2024-01-15T10:30:00.000Z"
  }
}
```

**Errors:**
- `401` - Authentication required
- `400` - Product ID and quantity are required
- `404` - Product not found
- `400` - Insufficient stock

---

### Update Cart Item

Update the quantity of an item in the cart.

**Endpoint:** `PUT /api/cart/:productId`

**Authentication:** Required

**Headers:**
```
Authorization: Bearer <token>
```

**Parameters:**
- `productId` (path) - Product ID

**Request Body:**
```json
{
  "quantity": 3  // Required, must be > 0
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Cart item updated successfully",
  "data": {
    "id": 1,
    "userId": 1,
    "productId": 1,
    "quantity": 3,
    "product": {
      "id": 1,
      "name": "Laptop",
      "price": "999.99",
      "stock": 50
    },
    "createdAt": "2024-01-15T10:30:00.000Z",
    "updatedAt": "2024-01-15T11:00:00.000Z"
  }
}
```

**Errors:**
- `401` - Authentication required
- `400` - Quantity is required
- `404` - Cart item not found
- `400` - Insufficient stock

---

### Remove from Cart

Remove a product from the user's cart.

**Endpoint:** `DELETE /api/cart/:productId`

**Authentication:** Required

**Headers:**
```
Authorization: Bearer <token>
```

**Parameters:**
- `productId` (path) - Product ID

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Item removed from cart successfully",
  "data": {
    "id": 1,
    "userId": 1,
    "productId": 1,
    "quantity": 2,
    "createdAt": "2024-01-15T10:30:00.000Z",
    "updatedAt": "2024-01-15T10:30:00.000Z"
  }
}
```

**Errors:**
- `401` - Authentication required
- `404` - Cart item not found

---

### Clear Cart

Remove all items from the user's cart.

**Endpoint:** `DELETE /api/cart`

**Authentication:** Required

**Headers:**
```
Authorization: Bearer <token>
```

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Cart cleared successfully. 3 item(s) removed.",
  "data": {
    "deletedCount": 3
  }
}
```

**Errors:**
- `401` - Authentication required

---

## Orders Endpoints

All order endpoints require authentication.

### Create Order

Create an order from the user's cart. This will:
1. Create an order with all cart items
2. Clear the user's cart
3. Reduce product stock

**Endpoint:** `POST /api/orders`

**Authentication:** Required

**Headers:**
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "addressId": 1,              // Required - Delivery address ID
  "deliveryTimeSlot": "14-18"  // Optional - Delivery time slot: "10-14", "14-18", "18-21", "21-00"
}
```

**Response:** `201 Created`
```json
{
  "success": true,
  "message": "Order created successfully",
  "data": {
    "id": 1,
    "userId": 1,
    "addressId": 1,
    "deliveryTimeSlot": "14-18",
    "totalAmount": "1999.98",
    "status": "PENDING",
    "createdAt": "2024-01-15T10:30:00.000Z",
    "updatedAt": "2024-01-15T10:30:00.000Z",
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
      "label": "Home",
      "isDefault": true
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
          "category": {
            "id": 1,
            "name": "Electronics",
            "description": "Electronic devices"
          }
        },
        "createdAt": "2024-01-15T10:30:00.000Z",
        "updatedAt": "2024-01-15T10:30:00.000Z"
      }
    ]
  }
}
```

**Validation Rules:**
- `addressId`: Required, must be a valid address ID that belongs to the authenticated user
- `deliveryTimeSlot`: Optional, must be one of: `"10-14"`, `"14-18"`, `"18-21"`, `"21-00"`

**Errors:**
- `401` - Authentication required
- `400` - Address ID is required for delivery
- `400` - Cart is empty
- `400` - Insufficient stock for one or more products
- `404` - Address not found or does not belong to user
- `400` - Invalid delivery time slot

---

### Get User Orders

Retrieve the authenticated user's order history.

**Endpoint:** `GET /api/orders`

**Authentication:** Required

**Headers:**
```
Authorization: Bearer <token>
```

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Orders retrieved successfully",
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
      "address": {
        "id": 1,
        "fullName": "John Doe",
        "phoneNumber": "12345678",
        "provinceOrDistrict": "Ulaanbaatar",
        "khorooOrSoum": "Bayangol",
        "street": "Peace Avenue",
        "neighborhood": "Downtown",
        "label": "Home",
        "isDefault": true
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

**Errors:**
- `401` - Authentication required

---

### Get Order by ID

Retrieve a specific order by ID. Users can only view their own orders.

**Endpoint:** `GET /api/orders/:id`

**Authentication:** Required

**Headers:**
```
Authorization: Bearer <token>
```

**Parameters:**
- `id` (path) - Order ID

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Order retrieved successfully",
  "data": {
    "id": 1,
    "userId": 1,
    "addressId": 1,
    "deliveryTimeSlot": "14-18",
    "totalAmount": "1999.98",
    "status": "PENDING",
    "createdAt": "2024-01-15T10:30:00.000Z",
    "updatedAt": "2024-01-15T10:30:00.000Z",
    "address": {
      "id": 1,
      "fullName": "John Doe",
      "phoneNumber": "12345678",
      "provinceOrDistrict": "Ulaanbaatar",
      "khorooOrSoum": "Bayangol",
      "street": "Peace Avenue",
      "neighborhood": "Downtown",
      "label": "Home",
      "isDefault": true
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
          "category": {
            "id": 1,
            "name": "Electronics",
            "description": "Electronic devices"
          }
        }
      }
    ]
  }
}
```

**Errors:**
- `401` - Authentication required
- `403` - Access denied (user trying to view another user's order)
- `404` - Order not found

---

## Addresses Endpoints

All address endpoints require authentication. Users can only manage their own addresses.

### Create Address

Create a new delivery address for the authenticated user.

**Endpoint:** `POST /api/addresses`

**Authentication:** Required

**Headers:**
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "label": "Home",                              // Optional - Address label (e.g., "Home", "Work")
  "fullName": "John Doe",                       // Required - Full name (min 2 characters)
  "phoneNumber": "12345678",                    // Required - Phone number (exactly 8 digits)
  "provinceOrDistrict": "Ulaanbaatar",          // Required - Province or district (min 2 characters)
  "khorooOrSoum": "Bayangol",                   // Required - Khoroo or soum (min 2 characters)
  "street": "Peace Avenue",                     // Optional - Street name
  "neighborhood": "Downtown",                   // Optional - Neighborhood
  "residentialComplex": "Green Complex",        // Optional - Residential complex
  "building": "Building 5",                     // Optional - Building number/name
  "entrance": "Entrance A",                     // Optional - Entrance
  "apartmentNumber": "Apt 12B",                 // Optional - Apartment number
  "addressNote": "Next to the blue gate",       // Optional - Additional notes (max 500 characters)
  "isDefault": true                             // Optional - Set as default address (boolean)
}
```

**Response:** `201 Created`
```json
{
  "success": true,
  "message": "Address created successfully",
  "data": {
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
    "createdAt": "2024-01-15T10:30:00.000Z",
    "updatedAt": "2024-01-15T10:30:00.000Z"
  }
}
```

**Validation Rules:**
- `fullName`: Required, must be at least 2 characters
- `phoneNumber`: Required, must be exactly 8 digits
- `provinceOrDistrict`: Required, must be at least 2 characters
- `khorooOrSoum`: Required, must be at least 2 characters
- `addressNote`: Optional, maximum 500 characters if provided
- `isDefault`: Optional, boolean. If set to `true`, other default addresses will be unset

**Errors:**
- `401` - Authentication required
- `400` - Validation failed

---

### Get User Addresses

Retrieve all addresses for the authenticated user. Addresses are sorted by default status (default first) and creation date (newest first).

**Endpoint:** `GET /api/addresses`

**Authentication:** Required

**Headers:**
```
Authorization: Bearer <token>
```

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Addresses retrieved successfully",
  "data": [
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
      "createdAt": "2024-01-15T10:30:00.000Z",
      "updatedAt": "2024-01-15T10:30:00.000Z"
    }
  ]
}
```

**Errors:**
- `401` - Authentication required

---

### Get Address by ID

Retrieve a specific address by ID. Users can only view their own addresses.

**Endpoint:** `GET /api/addresses/:id`

**Authentication:** Required

**Headers:**
```
Authorization: Bearer <token>
```

**Parameters:**
- `id` (path) - Address ID

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Address retrieved successfully",
  "data": {
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
    "createdAt": "2024-01-15T10:30:00.000Z",
    "updatedAt": "2024-01-15T10:30:00.000Z"
  }
}
```

**Errors:**
- `401` - Authentication required
- `403` - Access denied (trying to view another user's address)
- `404` - Address not found

---

### Update Address

Update an existing address. Users can only update their own addresses.

**Endpoint:** `PUT /api/addresses/:id`

**Authentication:** Required

**Headers:**
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Parameters:**
- `id` (path) - Address ID

**Request Body:** (All fields are optional)
```json
{
  "label": "Work",
  "fullName": "John Doe",
  "phoneNumber": "87654321",
  "provinceOrDistrict": "Ulaanbaatar",
  "khorooOrSoum": "Sukhbaatar",
  "street": "Main Street",
  "neighborhood": "Business District",
  "residentialComplex": null,
  "building": "Office Building",
  "entrance": "Main Entrance",
  "apartmentNumber": "Suite 200",
  "addressNote": "Call when arrived",
  "isDefault": false
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Address updated successfully",
  "data": {
    "id": 1,
    "userId": 1,
    "label": "Work",
    "fullName": "John Doe",
    "phoneNumber": "87654321",
    "provinceOrDistrict": "Ulaanbaatar",
    "khorooOrSoum": "Sukhbaatar",
    "street": "Main Street",
    "neighborhood": "Business District",
    "residentialComplex": null,
    "building": "Office Building",
    "entrance": "Main Entrance",
    "apartmentNumber": "Suite 200",
    "addressNote": "Call when arrived",
    "isDefault": false,
    "createdAt": "2024-01-15T10:30:00.000Z",
    "updatedAt": "2024-01-15T11:00:00.000Z"
  }
}
```

**Errors:**
- `401` - Authentication required
- `403` - Access denied (trying to update another user's address)
- `404` - Address not found
- `400` - Validation failed

---

### Delete Address

Delete an address. Users can only delete their own addresses. Addresses that are used in existing orders cannot be deleted.

**Endpoint:** `DELETE /api/addresses/:id`

**Authentication:** Required

**Headers:**
```
Authorization: Bearer <token>
```

**Parameters:**
- `id` (path) - Address ID

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Address deleted successfully",
  "data": {
    "id": 1,
    "userId": 1,
    "label": "Home",
    "fullName": "John Doe",
    "phoneNumber": "12345678",
    "provinceOrDistrict": "Ulaanbaatar",
    "khorooOrSoum": "Bayangol",
    "isDefault": true,
    "createdAt": "2024-01-15T10:30:00.000Z",
    "updatedAt": "2024-01-15T10:30:00.000Z"
  }
}
```

**Errors:**
- `401` - Authentication required
- `403` - Access denied (trying to delete another user's address)
- `404` - Address not found
- `400` - Cannot delete address that is used in existing orders

---

### Set Default Address

Set an address as the default address for the user. This will automatically unset other default addresses.

**Endpoint:** `PATCH /api/addresses/:id/set-default`

**Authentication:** Required

**Headers:**
```
Authorization: Bearer <token>
```

**Parameters:**
- `id` (path) - Address ID

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Default address updated successfully",
  "data": {
    "id": 1,
    "userId": 1,
    "label": "Home",
    "fullName": "John Doe",
    "phoneNumber": "12345678",
    "provinceOrDistrict": "Ulaanbaatar",
    "khorooOrSoum": "Bayangol",
    "isDefault": true,
    "createdAt": "2024-01-15T10:30:00.000Z",
    "updatedAt": "2024-01-15T11:00:00.000Z"
  }
}
```

**Errors:**
- `401` - Authentication required
- `403` - Access denied (trying to set another user's address as default)
- `404` - Address not found

---

## Data Models

### User
```typescript
{
  id: number;
  phoneNumber: string;  // 8 digits, unique
  name: string;
  role: "USER" | "ADMIN";
  createdAt: string;    // ISO 8601 date
  updatedAt: string;    // ISO 8601 date
}
```

### Category
```typescript
{
  id: number;
  name: string;         // Unique
  description: string | null;
  createdAt: string;    // ISO 8601 date
  updatedAt: string;    // ISO 8601 date
}
```

### Product
```typescript
{
  id: number;
  name: string;
  description: string;
  price: string;             // Decimal as string (e.g., "999.99") - current selling price
  originalPrice: string | null; // Original price before discount (null if no discount)
  images: string[];          // Array of image URLs
  firstImage: string | null; // First image URL for easy access
  hasDiscount: boolean;      // Whether product has a discount
  discountAmount: string | null; // Discount amount saved
  discountPercentage: number | null; // Discount percentage (0-100)
  isFavorite?: boolean;      // Whether product is favorited (only if authenticated)
  stock: number;             // Integer, >= 0
  categories: Category[];    // Array of categories this product belongs to
  categoryId: number | null; // First category ID (for backward compatibility)
  category?: Category;       // First category object (for backward compatibility)
  createdAt: string;         // ISO 8601 date
  updatedAt: string;         // ISO 8601 date
}
```

### CartItem
```typescript
{
  id: number;
  userId: number;
  productId: number;
  quantity: number;
  createdAt: string;    // ISO 8601 date
  updatedAt: string;    // ISO 8601 date
  product?: Product;    // Included in responses
}
```

### Address
```typescript
{
  id: number;
  userId: number;
  label: string | null;
  fullName: string;
  phoneNumber: string;        // 8 digits
  provinceOrDistrict: string;
  khorooOrSoum: string;
  street: string | null;
  neighborhood: string | null;
  residentialComplex: string | null;
  building: string | null;
  entrance: string | null;
  apartmentNumber: string | null;
  addressNote: string | null; // Max 500 characters
  isDefault: boolean;
  createdAt: string;          // ISO 8601 date
  updatedAt: string;          // ISO 8601 date
}
```

### Order
```typescript
{
  id: number;
  userId: number;
  addressId: number | null;
  deliveryTimeSlot: string | null; // "10-14" | "14-18" | "18-21" | "21-00" | null
  totalAmount: string;        // Decimal as string
  status: string;             // Default: "PENDING" (can be "PENDING", "COMPLETED", "CANCELLED", etc.)
  createdAt: string;          // ISO 8601 date
  updatedAt: string;          // ISO 8601 date
  items?: OrderItem[];        // Included in responses
  address?: Address;          // Included in order responses
}
```

### OrderItem
```typescript
{
  id: number;
  orderId: number;
  productId: number;
  quantity: number;
  price: string;             // Decimal as string (snapshot price at time of order)
  createdAt: string;         // ISO 8601 date
  updatedAt: string;         // ISO 8601 date
  product?: Product;         // Included in responses
  product?.category?: Category; // Included in order item product
}
```

---

## Examples

### Complete Authentication Flow

```javascript
// 1. Register
const registerResponse = await fetch('http://localhost:3000/api/auth/register', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    phoneNumber: '12345678',
    pin: '1234',
    name: 'John Doe'
  })
});

const { data } = await registerResponse.json();
const token = data.token; // Save this token!

// 2. Use token for authenticated requests
const productsResponse = await fetch('http://localhost:3000/api/products', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});
```

### Adding Item to Cart

```javascript
const addToCartResponse = await fetch('http://localhost:3000/api/cart', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    productId: 1,
    quantity: 2
  })
});

const result = await addToCartResponse.json();
```

### Creating an Order

```javascript
const createOrderResponse = await fetch('http://localhost:3000/api/orders', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    addressId: 1,
    deliveryTimeSlot: '14-18' // Optional: "10-14", "14-18", "18-21", "21-00"
  })
});

const order = await createOrderResponse.json();
console.log('Order created:', order.data.id);
```

### Managing Addresses

```javascript
// Create a new address
const createAddressResponse = await fetch('http://localhost:3000/api/addresses', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    label: 'Home',
    fullName: 'John Doe',
    phoneNumber: '12345678',
    provinceOrDistrict: 'Ulaanbaatar',
    khorooOrSoum: 'Bayangol',
    street: 'Peace Avenue',
    apartmentNumber: 'Apt 12B',
    isDefault: true
  })
});

// Get all addresses
const addressesResponse = await fetch('http://localhost:3000/api/addresses', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});

// Set default address
const setDefaultResponse = await fetch('http://localhost:3000/api/addresses/1/set-default', {
  method: 'PATCH',
  headers: {
    'Authorization': `Bearer ${token}`
  }
});
```

### Fetching Products with Filters

```javascript
// Get products in category 1 that are in stock
const url = new URL('http://localhost:3000/api/products');
url.searchParams.append('categoryId', '1');
url.searchParams.append('inStock', 'true');
url.searchParams.append('search', 'laptop');

const productsResponse = await fetch(url, {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});

const products = await productsResponse.json();
```

### Error Handling Example

```javascript
try {
  const response = await fetch('http://localhost:3000/api/products/999', {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  const result = await response.json();

  if (!result.success) {
    console.error('Error:', result.error.message);
    console.error('Error code:', result.error.code);
    
    if (result.error.details) {
      console.error('Details:', result.error.details);
    }
  } else {
    console.log('Product:', result.data);
  }
} catch (error) {
  console.error('Network error:', error);
}
```

---

## Important Notes

1. **Token Storage**: Store the JWT token securely (e.g., in localStorage, sessionStorage, or secure cookies). Include it in the `Authorization` header for all protected endpoints.

2. **Price Format**: Prices are returned as strings to preserve decimal precision. When displaying, you may need to parse them: `parseFloat(price)`.

3. **Stock Management**: The API automatically manages stock when orders are created. If a product's stock is insufficient, the order will fail.

4. **Cart Behavior**: When adding a product that already exists in the cart, the quantity will be updated (not duplicated).

5. **Order Status**: Orders are created with status "PENDING" by default.

6. **Address Management**: Users can have multiple addresses. Only one address can be set as default at a time. Addresses used in orders cannot be deleted.

7. **Delivery Time Slots**: Valid time slots are `"10-14"`, `"14-18"`, `"18-21"`, and `"21-00"`. Time slots are optional when creating orders.

8. **CORS**: The API has CORS enabled. Make sure your frontend origin is allowed in the backend configuration.

7. **Rate Limiting**: Currently, there is no rate limiting implemented. Consider implementing client-side throttling if needed.

8. **Phone Number Format**: Phone numbers must be exactly 8 digits (no spaces, dashes, or other characters).

9. **PIN Format**: PINs must be exactly 4 digits.

10. **Address Requirements**: When creating an order, an `addressId` is required. The address must belong to the authenticated user.

---

## Support

For questions or issues, please contact the backend development team or refer to the source code.

**API Version:** 1.0.0  
**Last Updated:** 2025-01-08

