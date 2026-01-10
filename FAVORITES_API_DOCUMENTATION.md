# Favorites API Documentation

All favorites endpoints require user authentication and return complete product details with categories.

**Authentication:** All endpoints require `Authorization: Bearer <token>` header.

---

## Get User's Favorites

Retrieve the authenticated user's favorite products with complete product details.

**Endpoint:** `GET /api/favorites`

**Query Parameters:**
- `page` (optional) - Page number. Default: `1`
- `limit` (optional) - Items per page (max 100). Default: `50`

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Favorites retrieved successfully",
  "data": [
    {
      "id": 1,
      "name": "Premium Laptop",
      "description": "High-performance laptop",
      "price": "899.99",
      "originalPrice": "999.99",
      "images": [
        "https://example.com/images/laptop-front.jpg",
        "https://example.com/images/laptop-side.jpg"
      ],
      "firstImage": "https://example.com/images/laptop-front.jpg",
      "hasDiscount": true,
      "discountAmount": "100.00",
      "discountPercentage": 10,
      "isFavorite": true,
      "favoritedAt": "2024-01-15T12:00:00.000Z",
      "stock": 50,
      "categories": [
        {
          "id": 1,
          "name": "Electronics",
          "description": "Electronic devices and gadgets"
        },
        {
          "id": 5,
          "name": "Computers",
          "description": "Computer hardware"
        }
      ],
      "categoryId": 1,
      "category": {
        "id": 1,
        "name": "Electronics",
        "description": "Electronic devices and gadgets"
      },
      "createdAt": "2024-01-10T10:30:00.000Z",
      "updatedAt": "2024-01-12T15:45:00.000Z"
    }
  ],
  "pagination": {
    "total": 25,
    "page": 1,
    "limit": 20,
    "totalPages": 2
  }
}
```

**Errors:**
- `401` - Authentication required

---

## Add Product to Favorites

Add a product to the authenticated user's favorites.

**Endpoint:** `POST /api/favorites`

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
    "name": "Premium Laptop",
    "description": "High-performance laptop",
    "price": "899.99",
    "originalPrice": "999.99",
    "images": [
      "https://example.com/images/laptop-front.jpg",
      "https://example.com/images/laptop-side.jpg"
    ],
    "firstImage": "https://example.com/images/laptop-front.jpg",
    "hasDiscount": true,
    "discountAmount": "100.00",
    "discountPercentage": 10,
    "isFavorite": true,
    "favoritedAt": "2024-01-15T12:00:00.000Z",
    "stock": 50,
    "categories": [
      {
        "id": 1,
        "name": "Electronics",
        "description": "Electronic devices and gadgets"
      },
      {
        "id": 5,
        "name": "Computers",
        "description": "Computer hardware"
      }
    ],
    "categoryId": 1,
    "category": {
      "id": 1,
      "name": "Electronics",
      "description": "Electronic devices and gadgets"
    },
    "createdAt": "2024-01-10T10:30:00.000Z",
    "updatedAt": "2024-01-12T15:45:00.000Z"
  }
}
```

**Notes:**
- If already favorited, returns existing favorite (no error)

**Errors:**
- `400` - Product ID is required
- `401` - Authentication required
- `404` - Product not found

---

## Remove Product from Favorites

Remove a product from the authenticated user's favorites.

**Endpoint:** `DELETE /api/favorites/:productId`

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Product removed from favorites successfully",
  "data": {
    "id": 1,
    "name": "Premium Laptop",
    "description": "High-performance laptop",
    "price": "899.99",
    "originalPrice": "999.99",
    "images": [
      "https://example.com/images/laptop-front.jpg",
      "https://example.com/images/laptop-side.jpg"
    ],
    "firstImage": "https://example.com/images/laptop-front.jpg",
    "hasDiscount": true,
    "discountAmount": "100.00",
    "discountPercentage": 10,
    "isFavorite": true,
    "favoritedAt": "2024-01-15T12:00:00.000Z",
    "stock": 50,
    "categories": [
      {
        "id": 1,
        "name": "Electronics",
        "description": "Electronic devices and gadgets"
      },
      {
        "id": 5,
        "name": "Computers",
        "description": "Computer hardware"
      }
    ],
    "categoryId": 1,
    "category": {
      "id": 1,
      "name": "Electronics",
      "description": "Electronic devices and gadgets"
    },
    "createdAt": "2024-01-10T10:30:00.000Z",
    "updatedAt": "2024-01-12T15:45:00.000Z"
  }
}
```

**Errors:**
- `401` - Authentication required
- `404` - Product is not in favorites

---

## Check Favorite Status

Check if a specific product is favorited by the authenticated user.

**Endpoint:** `GET /api/favorites/:productId/status`

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
