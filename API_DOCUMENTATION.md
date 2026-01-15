# Frontend API Documentation

This document provides comprehensive API documentation for frontend developers to integrate with the Ecommerce backend API. **This documentation covers only frontend endpoints - no admin endpoints are included.**

## Table of Contents

- [Base Information](#base-information)
- [Understanding HTTP Methods: GET vs POST](#understanding-http-methods-get-vs-post)
- [Authentication](#authentication)
- [Response Format](#response-format)
- [Error Handling](#error-handling)
- [API Endpoints](#api-endpoints)
  - [Authentication](#authentication-endpoints)
  - [Categories](#categories-endpoints)
  - [Products](#products-endpoints)
  - [Cart](#cart-endpoints)
  - [Orders](#orders-endpoints)
  - [Addresses](#addresses-endpoints)
  - [Favorites](#favorites-endpoints)

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

## Understanding HTTP Methods: GET vs POST

### 🔵 GET Requests
- **Purpose**: Retrieve/read data from the server
- **Request Body**: **NONE** - GET requests should NOT include a request body
- **Data Location**: Query parameters (e.g., `?page=1&limit=10`) or URL path parameters (e.g., `/api/products/:id`)
- **Idempotent**: Yes - making the same GET request multiple times returns the same data
- **Example**: Fetching a list of products, getting user cart, viewing order details

**GET Request Format:**
```javascript
// ✅ CORRECT - No body, data in URL/query
fetch('http://localhost:3000/api/products?category=1&page=1', {
  method: 'GET',
  headers: {
    'Authorization': 'Bearer <token>'
  }
  // NO body property
})

// ❌ WRONG - Don't send body with GET
fetch('http://localhost:3000/api/products', {
  method: 'GET',
  body: JSON.stringify({ category: 1 }) // ❌ WRONG!
})
```

### 🟢 POST Requests
- **Purpose**: Create new resources or perform actions that modify server state
- **Request Body**: **REQUIRED** - POST requests MUST include a JSON body with data
- **Data Location**: Request body (JSON format)
- **Idempotent**: No - making the same POST request multiple times may create duplicates or have side effects
- **Example**: Registering a user, adding items to cart, creating orders

**POST Request Format:**
```javascript
// ✅ CORRECT - Data in body
fetch('http://localhost:3000/api/cart', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer <token>'
  },
  body: JSON.stringify({
    productId: 123,
    quantity: 2
  })
})

// ❌ WRONG - Missing body
fetch('http://localhost:3000/api/cart', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer <token>'
  }
  // ❌ Missing body!
})
```

### Quick Reference

| Method | Request Body? | When to Use |
|--------|--------------|-------------|
| **GET** | ❌ **NO** | Retrieve data, fetch resources |
| **POST** | ✅ **YES** | Create new resources, submit forms, update/delete (all modifications use POST) |
| **PATCH** | ✅ **YES** | Partial update of resources |

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
  "message": "Error description",
  "error": "Detailed error information"
}
```

---

## Error Handling

### HTTP Status Codes

- `200 OK` - Successful GET, POST, PATCH requests
- `201 Created` - Successful POST request that created a resource
- `400 Bad Request` - Invalid request data or missing required fields
- `401 Unauthorized` - Missing or invalid authentication token
- `403 Forbidden` - User doesn't have permission (not used in frontend endpoints)
- `404 Not Found` - Resource not found
- `500 Internal Server Error` - Server error

### Common Error Scenarios

1. **Missing Authentication**
   - Status: `401`
   - Solution: Include `Authorization: Bearer <token>` header

2. **Invalid Request Data**
   - Status: `400`
   - Solution: Check request body matches required format

3. **Resource Not Found**
   - Status: `404`
   - Solution: Verify resource ID exists

---

## API Endpoints

## Authentication Endpoints

### Register User

**Method**: `POST` (creates a new user account)

**Endpoint**: `POST /api/auth/register`

**Authentication**: Not required (public endpoint)

**Request Body** (JSON):
```json
{
  "phoneNumber": "12345678",
  "pin": "1234",
  "name": "John Doe",
  "email": "john@example.com" // Optional
}
```

**Required Fields**:
- `phoneNumber` (string): User's phone number
- `pin` (string): 4-digit PIN for authentication
- `name` (string): User's full name

**Optional Fields**:
- `email` (string): User's email address

**Response**: `201 Created`
```json
{
  "success": true,
  "message": "User registered successfully",
  "data": {
    "user": {
      "id": 1,
      "phoneNumber": "12345678",
      "name": "John Doe",
      "email": "john@example.com",
      "role": "USER",
      "createdAt": "2024-01-15T10:30:00.000Z"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

**Error Responses**:
- `400` - Missing required fields or invalid data
- `409` - Phone number already registered

---

### Login User

**Method**: `POST` (authenticates user and returns token)

**Endpoint**: `POST /api/auth/login`

**Authentication**: Not required (public endpoint)

**Request Body** (JSON):
```json
{
  "phoneNumber": "12345678",
  "pin": "1234"
}
```

**Required Fields**:
- `phoneNumber` (string): User's phone number
- `pin` (string): User's 4-digit PIN

**Response**: `200 OK`
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "id": 1,
      "phoneNumber": "12345678",
      "name": "John Doe",
      "email": "john@example.com",
      "role": "USER"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

**Error Responses**:
- `400` - Missing phone number or PIN
- `401` - Invalid credentials

---

### Request Password Reset

**Method**: `POST` (initiates password reset process)

**Endpoint**: `POST /api/auth/forgot-password`

**Authentication**: Not required (public endpoint)

**Request Body** (JSON):
```json
{
  "phoneNumber": "12345678"
}
```

**Required Fields**:
- `phoneNumber` (string): User's phone number

**Response**: `200 OK`
```json
{
  "success": true,
  "message": "Password reset code sent successfully",
  "data": {
    "resetCode": "123456",
    "resetToken": "reset_token_here",
    "expiresAt": "2024-01-15T11:30:00.000Z",
    "resetLink": "reset_link_here"
  }
}
```

**Note**: In production, `resetCode` should be sent via SMS, not returned in response.

---

### Reset Password

**Method**: `POST` (resets user password using reset code)

**Endpoint**: `POST /api/auth/reset-password`

**Authentication**: Not required (public endpoint)

**Request Body** (JSON):
```json
{
  "phoneNumber": "12345678",
  "resetCode": "123456",
  "newPin": "5678",
  "resetToken": "reset_token_here" // Optional, can use resetCode alone
}
```

**Required Fields**:
- `phoneNumber` (string): User's phone number
- `newPin` (string): New 4-digit PIN
- Either `resetCode` OR `resetToken` (string)

**Response**: `200 OK`
```json
{
  "success": true,
  "message": "Password reset successfully",
  "data": {
    "user": {
      "id": 1,
      "phoneNumber": "12345678",
      "name": "John Doe"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

**Error Responses**:
- `400` - Missing required fields
- `401` - Invalid or expired reset code/token

---

## Categories Endpoints

### Get All Categories

**Method**: `GET` (retrieves list of categories - **NO request body**)

**Endpoint**: `GET /api/categories`

**Authentication**: Not required (public endpoint)

**Query Parameters** (optional, added to URL):
- `includeSubcategories` (boolean): Default `true`. Set to `false` for flat list.

**Example Request**:
```
GET /api/categories?includeSubcategories=true
```

**Response**: `200 OK`
```json
{
  "success": true,
  "message": "Categories retrieved successfully",
  "data": [
    {
      "id": 1,
      "name": "Electronics",
      "slug": "electronics",
      "description": "Electronic devices",
      "parentId": null,
      "order": 1,
      "createdAt": "2024-01-15T10:30:00.000Z",
      "children": [
        {
          "id": 2,
          "name": "Mobile Phones",
          "slug": "mobile-phones",
          "parentId": 1,
          "order": 1,
          "children": []
        }
      ]
    }
  ]
}
```

---

### Get Category by ID

**Method**: `GET` (retrieves single category - **NO request body**)

**Endpoint**: `GET /api/categories/:id`

**Authentication**: Not required (public endpoint)

**Path Parameters**:
- `id` (number): Category ID

**Example Request**:
```
GET /api/categories/1
```

**Response**: `200 OK`
```json
{
  "success": true,
  "message": "Category retrieved successfully",
  "data": {
    "id": 1,
    "name": "Electronics",
    "slug": "electronics",
    "description": "Electronic devices",
    "parentId": null,
    "order": 1,
    "children": [
      {
        "id": 2,
        "name": "Mobile Phones",
        "slug": "mobile-phones",
        "parentId": 1,
        "order": 1,
        "children": []
      }
    ]
  }
}
```

**Error Responses**:
- `404` - Category not found

---

### Get Products by Category

**Method**: `GET` (retrieves products in a category - **NO request body**)

**Endpoint**: `GET /api/categories/:id/products`

**Authentication**: Not required (public endpoint)

**Path Parameters**:
- `id` (number): Category ID

**Query Parameters** (optional, added to URL):
- `includeSubcategories` (boolean): Default `false`. Include products from subcategories.
- `page` (number): Page number for pagination (default: 1)
- `limit` (number): Items per page (default: 20)

**Example Request**:
```
GET /api/categories/1/products?includeSubcategories=true&page=1&limit=20
```

**Response**: `200 OK`
```json
{
  "success": true,
  "message": "Products retrieved successfully",
  "data": [
    {
      "id": 1,
      "name": "iPhone 15",
      "description": "Latest iPhone model",
      "price": "999.99",
      "discount": "10.00",
      "stock": 50,
      "images": ["image1.jpg", "image2.jpg"],
      "categories": [
        {
          "id": 1,
          "name": "Electronics",
          "order": 1
        }
      ]
    }
  ]
}
```

---

## Products Endpoints

### Get All Products

**Method**: `GET` (retrieves list of products - **NO request body**)

**Endpoint**: `GET /api/products`

**Authentication**: Optional (if authenticated, returns favorite status for each product)

**Query Parameters** (optional, added to URL):
- `category` (number): Filter by category ID
- `page` (number): Page number (default: 1)
- `limit` (number): Items per page (default: 20)
- `search` (string): Search query
- `minPrice` (number): Minimum price filter
- `maxPrice` (number): Maximum price filter
- `sortBy` (string): Sort field (e.g., "price", "name", "createdAt")
- `sortOrder` (string): "asc" or "desc" (default: "asc")

**Example Request**:
```
GET /api/products?category=1&page=1&limit=20&sortBy=price&sortOrder=asc
```

**Response**: `200 OK`
```json
{
  "success": true,
  "message": "Products retrieved successfully",
  "data": [
    {
      "id": 1,
      "name": "iPhone 15",
      "description": "Latest iPhone model",
      "price": "999.99",
      "discount": "10.00",
      "stock": 50,
      "images": ["image1.jpg", "image2.jpg"],
      "categories": [
        {
          "id": 1,
          "name": "Electronics",
          "order": 1
        }
      ],
      "isFavorite": false // Only included if user is authenticated
    }
  ]
}
```

---

### Get Product by ID

**Method**: `GET` (retrieves single product - **NO request body**)

**Endpoint**: `GET /api/products/:id`

**Authentication**: Optional (if authenticated, returns favorite status)

**Path Parameters**:
- `id` (number): Product ID

**Example Request**:
```
GET /api/products/1
```

**Response**: `200 OK`
```json
{
  "success": true,
  "message": "Product retrieved successfully",
  "data": {
    "id": 1,
    "name": "iPhone 15",
    "description": "Latest iPhone model",
    "price": "999.99",
    "discount": "10.00",
    "stock": 50,
    "images": ["image1.jpg", "image2.jpg"],
    "categories": [
      {
        "id": 1,
        "name": "Electronics",
        "order": 1
      }
    ],
    "isFavorite": false // Only included if user is authenticated
  }
}
```

**Error Responses**:
- `404` - Product not found

---

## Cart Endpoints

All cart endpoints require authentication.

### Get User's Cart

**Method**: `GET` (retrieves user's cart items - **NO request body**)

**Endpoint**: `GET /api/cart`

**Authentication**: Required

**Headers**:
```
Authorization: Bearer <token>
```

**Example Request**:
```
GET /api/cart
Authorization: Bearer <token>
```

**Response**: `200 OK`
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
        "name": "iPhone 15",
        "price": "999.99",
        "discount": "10.00",
        "images": ["image1.jpg"]
      }
    }
  ]
}
```

**Error Responses**:
- `401` - Authentication required

---

### Add Item to Cart

**Method**: `POST` (adds item to cart - **REQUIRES request body**)

**Endpoint**: `POST /api/cart`

**Authentication**: Required

**Headers**:
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body** (JSON):
```json
{
  "productId": 1,
  "quantity": 2
}
```

**Required Fields**:
- `productId` (number): Product ID to add
- `quantity` (number): Quantity to add

**Response**: `200 OK`
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
      "name": "iPhone 15",
      "price": "999.99",
      "images": ["image1.jpg"]
    }
  }
}
```

**Error Responses**:
- `400` - Missing productId or quantity
- `401` - Authentication required
- `404` - Product not found

---

### Update Cart Item Quantity

**Method**: `POST` (updates quantity - **REQUIRES request body**)

**Endpoint**: `POST /api/cart/:productId/update`

**Authentication**: Required

**Path Parameters**:
- `productId` (number): Product ID in cart

**Headers**:
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body** (JSON):
```json
{
  "quantity": 5
}
```

**Required Fields**:
- `quantity` (number): New quantity

**Response**: `200 OK`
```json
{
  "success": true,
  "message": "Cart item updated successfully",
  "data": {
    "id": 1,
    "userId": 1,
    "productId": 1,
    "quantity": 5,
    "product": {
      "id": 1,
      "name": "iPhone 15",
      "price": "999.99"
    }
  }
}
```

**Error Responses**:
- `400` - Missing quantity
- `401` - Authentication required
- `404` - Cart item not found

---

### Remove Item from Cart

**Method**: `POST` (removes item from cart - **REQUIRES request body**)

**Endpoint**: `POST /api/cart/:productId/remove`

**Authentication**: Required

**Path Parameters**:
- `productId` (number): Product ID to remove

**Headers**:
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body** (JSON - can be empty object):
```json
{}
```

**Example Request**:
```
POST /api/cart/1/remove
Authorization: Bearer <token>
Content-Type: application/json
```

**Response**: `200 OK`
```json
{
  "success": true,
  "message": "Item removed from cart successfully",
  "data": null
}
```

**Error Responses**:
- `401` - Authentication required
- `404` - Cart item not found

---

### Clear Cart

**Method**: `POST` (removes all items from cart - **REQUIRES request body**)

**Endpoint**: `POST /api/cart/clear`

**Authentication**: Required

**Headers**:
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body** (JSON - can be empty object):
```json
{}
```

**Example Request**:
```
POST /api/cart/clear
Authorization: Bearer <token>
Content-Type: application/json
```

**Response**: `200 OK`
```json
{
  "success": true,
  "message": "Cart cleared successfully",
  "data": null
}
```

**Error Responses**:
- `401` - Authentication required

---

## Orders Endpoints

### Create Order from Cart

**Method**: `POST` (creates order from cart - **REQUIRES request body**)

**Endpoint**: `POST /api/orders`

**Authentication**: Required

**Headers**:
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body** (JSON):
```json
{
  "addressId": 1,
  "deliveryTimeSlot": "10-14"
}
```

**Required Fields**:
- `addressId` (number): Delivery address ID
- `deliveryTimeSlot` (string): Delivery time slot. Valid values:
  - `"10-14"` (Morning: 10:00 - 14:00)
  - `"14-18"` (Afternoon: 14:00 - 18:00)
  - `"18-21"` (Evening: 18:00 - 21:00)
  - `"21-00"` (Night: 21:00 - 00:00)

**Response**: `201 Created`
```json
{
  "success": true,
  "message": "Order created successfully",
  "data": {
    "id": 1,
    "userId": 1,
    "totalAmount": "1999.98",
    "status": "PENDING",
    "deliveryTimeSlot": "10-14",
    "createdAt": "2024-01-15T10:30:00.000Z",
    "items": [
      {
        "id": 1,
        "productId": 1,
        "quantity": 2,
        "price": "999.99",
        "product": {
          "id": 1,
          "name": "iPhone 15"
        }
      }
    ],
    "address": {
      "id": 1,
      "street": "123 Main St",
      "city": "City",
      "state": "State",
      "zipCode": "12345"
    }
  }
}
```

**Error Responses**:
- `400` - Missing required fields, invalid time slot, empty cart, or invalid address
- `401` - Authentication required
- `404` - Address not found

---

### Buy Now (Smart Checkout Flow)

**Method**: `POST` (creates order or draft order - **REQUIRES request body**)

**Endpoint**: `POST /api/orders/buy-now`

**Authentication**: Optional (works for both authenticated and guest users)

**Headers**:
```
Authorization: Bearer <token> // Optional - included if user is authenticated
Content-Type: application/json
```

**Smart Routing Behavior:**
- ✅ **Authenticated user with `addressId`** → Creates order directly (1-step, instant checkout)
- ⚠️ **Authenticated user without `addressId`** → Creates draft order (2-step, choose address)
- ⚠️ **Guest user** → Creates draft order (2-step, guest checkout)

**Request Body for Direct Order (Authenticated with address)**:
```json
{
  "productId": 1,
  "quantity": 2,
  "addressId": 1,
  "deliveryTimeSlot": "10-14"
}
```

**Request Body for Draft Order (Authenticated without address OR Guest)**:
```json
{
  "productId": 1,
  "quantity": 2,
  "sessionToken": "guest_session_token" // Optional, generated client-side (recommended for guests)
}
```

**Required Fields**:
- `productId` (number): Product ID to purchase
- `quantity` (number): Quantity to purchase

**Optional Fields** (for direct order):
- `addressId` (number): Delivery address ID (if provided and user is authenticated, creates direct order)
- `deliveryTimeSlot` (string): Valid time slot (required if creating direct order)

**Optional Fields** (for draft order):
- `sessionToken` (string): Session token for tracking draft order (recommended for guest checkout)

**Response (Direct Order - if authenticated with addressId)**: `201 Created`
```json
{
  "success": true,
  "message": "Order created successfully",
  "data": {
    "id": 1,
    "userId": 1,
    "totalAmount": "1999.98",
    "status": "PENDING",
    "deliveryTimeSlot": "10-14",
    "items": [
      {
        "id": 1,
        "productId": 1,
        "quantity": 2,
        "price": "999.99",
        "product": {
          "id": 1,
          "name": "iPhone 15"
        }
      }
    ],
    "address": {
      "id": 1,
      "street": "123 Main St",
      "city": "City",
      "state": "State",
      "zipCode": "12345"
    }
  }
}
```

**Response (Draft Order - if no addressId or guest)**: `201 Created`
```json
{
  "success": true,
  "message": "Draft order created successfully. Please finalize order with address.",
  "data": {
    "draftOrder": {
      "id": 1,
      "sessionToken": "guest_session_token",
      "productId": 1,
      "quantity": 2,
      "totalAmount": "1999.98",
      "product": {
        "id": 1,
        "name": "iPhone 15",
        "price": "999.99",
        "images": ["image1.jpg"]
      },
      "createdAt": "2024-01-15T10:30:00.000Z",
      "expiresAt": "2024-01-16T10:30:00.000Z"
    },
    "sessionToken": "guest_session_token",
    "requiresAuth": false, // false if user is authenticated, true if guest
    "nextStep": "finalize-order"
  }
}
```

**Response Fields (Draft Order)**:
- `draftOrder`: The draft order object with product details
- `sessionToken`: Token to use when finalizing the order (save this!)
- `requiresAuth`: 
  - `false` if user is already authenticated
  - `true` if user is a guest (will need to authenticate before finalizing)
- `nextStep`: Always `"finalize-order"` - indicates you need to call `/finalize` endpoint

**Error Responses**:
- `400` - Missing required fields (productId, quantity) or insufficient stock
- `404` - Product not found

---

### Finalize Order (Convert Draft to Real Order)

**Method**: `POST` (converts draft order to real order - **REQUIRES request body**)

**Endpoint**: `POST /api/orders/finalize`

**Authentication**: Required (both authenticated users and guests must authenticate before finalizing)

**Note**: This endpoint is called after `/buy-now` to complete the order with address and delivery details. Use the `sessionToken` returned from the buy-now response.

**Headers**:
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body** (JSON):
```json
{
  "sessionToken": "guest_session_token",
  "addressId": 1,
  "deliveryTimeSlot": "10-14"
}
```

**OR with inline address**:
```json
{
  "sessionToken": "guest_session_token",
  "address": {
    "street": "123 Main St",
    "city": "City",
    "state": "State",
    "zipCode": "12345",
    "isDefault": false
  },
  "deliveryTimeSlot": "10-14"
}
```

**Required Fields**:
- `sessionToken` (string): Session token from draft order
- `deliveryTimeSlot` (string): Valid time slot
- Either `addressId` OR `address` object

**Response**: `201 Created`
```json
{
  "success": true,
  "message": "Order finalized successfully",
  "data": {
    "id": 1,
    "userId": 1,
    "totalAmount": "1999.98",
    "status": "PENDING",
    "items": [...],
    "address": {...}
  }
}
```

**Error Responses**:
- `400` - Missing required fields or invalid data
- `401` - Authentication required
- `404` - Draft order or address not found

---

### Get User's Orders

**Method**: `GET` (retrieves user's order history - **NO request body**)

**Endpoint**: `GET /api/orders`

**Authentication**: Required

**Headers**:
```
Authorization: Bearer <token>
```

**Example Request**:
```
GET /api/orders
Authorization: Bearer <token>
```

**Response**: `200 OK`
```json
{
  "success": true,
  "message": "Orders retrieved successfully",
  "data": [
    {
      "id": 1,
      "userId": 1,
      "totalAmount": "1999.98",
      "status": "COMPLETED",
      "deliveryTimeSlot": "10-14",
      "createdAt": "2024-01-15T10:30:00.000Z",
      "updatedAt": "2024-01-15T10:30:00.000Z",
      "items": [
        {
          "id": 1,
          "orderId": 1,
          "productId": 1,
          "quantity": 2,
          "price": "999.99",
          "product": {
            "id": 1,
            "name": "iPhone 15"
          }
        }
      ],
      "address": {
        "id": 1,
        "street": "123 Main St",
        "city": "City",
        "state": "State",
        "zipCode": "12345"
      }
    }
  ]
}
```

**Error Responses**:
- `401` - Authentication required

---

### Get Order by ID

**Method**: `GET` (retrieves specific order - **NO request body**)

**Endpoint**: `GET /api/orders/:id`

**Authentication**: Required (users can only view their own orders)

**Path Parameters**:
- `id` (number): Order ID

**Headers**:
```
Authorization: Bearer <token>
```

**Example Request**:
```
GET /api/orders/1
Authorization: Bearer <token>
```

**Response**: `200 OK`
```json
{
  "success": true,
  "message": "Order retrieved successfully",
  "data": {
    "id": 1,
    "userId": 1,
    "totalAmount": "1999.98",
    "status": "PENDING",
    "deliveryTimeSlot": "10-14",
    "createdAt": "2024-01-15T10:30:00.000Z",
    "items": [
      {
        "id": 1,
        "orderId": 1,
        "productId": 1,
        "quantity": 2,
        "price": "999.99",
        "product": {
          "id": 1,
          "name": "iPhone 15",
          "images": ["image1.jpg"]
        }
      }
    ],
    "address": {
      "id": 1,
      "street": "123 Main St",
      "city": "City",
      "state": "State",
      "zipCode": "12345"
    }
  }
}
```

**Error Responses**:
- `401` - Authentication required
- `403` - Not authorized to view this order
- `404` - Order not found

---

## Addresses Endpoints

All address endpoints require authentication.

### Create Address

**Method**: `POST` (creates new address - **REQUIRES request body**)

**Endpoint**: `POST /api/addresses`

**Authentication**: Required

**Headers**:
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body** (JSON):
```json
{
  "street": "123 Main Street",
  "city": "New York",
  "state": "NY",
  "zipCode": "10001",
  "isDefault": false
}
```

**Required Fields**:
- `street` (string): Street address
- `city` (string): City
- `state` (string): State/Province
- `zipCode` (string): ZIP/Postal code

**Optional Fields**:
- `isDefault` (boolean): Set as default address (default: false)

**Response**: `201 Created`
```json
{
  "success": true,
  "message": "Address created successfully",
  "data": {
    "id": 1,
    "userId": 1,
    "street": "123 Main Street",
    "city": "New York",
    "state": "NY",
    "zipCode": "10001",
    "isDefault": false,
    "createdAt": "2024-01-15T10:30:00.000Z"
  }
}
```

**Error Responses**:
- `400` - Missing required fields or invalid data
- `401` - Authentication required

---

### Get User's Addresses

**Method**: `GET` (retrieves all user addresses - **NO request body**)

**Endpoint**: `GET /api/addresses`

**Authentication**: Required

**Headers**:
```
Authorization: Bearer <token>
```

**Example Request**:
```
GET /api/addresses
Authorization: Bearer <token>
```

**Response**: `200 OK`
```json
{
  "success": true,
  "message": "Addresses retrieved successfully",
  "data": [
    {
      "id": 1,
      "userId": 1,
      "street": "123 Main Street",
      "city": "New York",
      "state": "NY",
      "zipCode": "10001",
      "isDefault": true,
      "createdAt": "2024-01-15T10:30:00.000Z"
    }
  ]
}
```

**Error Responses**:
- `401` - Authentication required

---

### Get Address by ID

**Method**: `GET` (retrieves single address - **NO request body**)

**Endpoint**: `GET /api/addresses/:id`

**Authentication**: Required (users can only view their own addresses)

**Path Parameters**:
- `id` (number): Address ID

**Headers**:
```
Authorization: Bearer <token>
```

**Example Request**:
```
GET /api/addresses/1
Authorization: Bearer <token>
```

**Response**: `200 OK`
```json
{
  "success": true,
  "message": "Address retrieved successfully",
  "data": {
    "id": 1,
    "userId": 1,
    "street": "123 Main Street",
    "city": "New York",
    "state": "NY",
    "zipCode": "10001",
    "isDefault": true,
    "createdAt": "2024-01-15T10:30:00.000Z"
  }
}
```

**Error Responses**:
- `401` - Authentication required
- `403` - Not authorized to view this address
- `404` - Address not found

---

### Update Address

**Method**: `POST` (updates address - **REQUIRES request body**)

**Endpoint**: `POST /api/addresses/:id/update`

**Authentication**: Required (users can only update their own addresses)

**Path Parameters**:
- `id` (number): Address ID

**Headers**:
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body** (JSON):
```json
{
  "street": "456 New Street",
  "city": "Los Angeles",
  "state": "CA",
  "zipCode": "90001",
  "isDefault": false
}
```

**All Fields Optional** (only include fields to update):
- `street` (string): Street address
- `city` (string): City
- `state` (string): State/Province
- `zipCode` (string): ZIP/Postal code
- `isDefault` (boolean): Set as default address

**Response**: `200 OK`
```json
{
  "success": true,
  "message": "Address updated successfully",
  "data": {
    "id": 1,
    "userId": 1,
    "street": "456 New Street",
    "city": "Los Angeles",
    "state": "CA",
    "zipCode": "90001",
    "isDefault": false,
    "updatedAt": "2024-01-15T11:30:00.000Z"
  }
}
```

**Error Responses**:
- `400` - Invalid data
- `401` - Authentication required
- `403` - Not authorized to update this address
- `404` - Address not found

---

### Delete Address

**Method**: `POST` (deletes address - **REQUIRES request body**)

**Endpoint**: `POST /api/addresses/:id/delete`

**Authentication**: Required (users can only delete their own addresses)

**Path Parameters**:
- `id` (number): Address ID

**Headers**:
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body** (JSON - can be empty object):
```json
{}
```

**Example Request**:
```
POST /api/addresses/1/delete
Authorization: Bearer <token>
Content-Type: application/json
```

**Response**: `200 OK`
```json
{
  "success": true,
  "message": "Address deleted successfully",
  "data": null
}
```

**Error Responses**:
- `401` - Authentication required
- `403` - Not authorized to delete this address
- `404` - Address not found

---

### Set Default Address

**Method**: `PATCH` (sets address as default - **NO request body needed, but can include empty body**)

**Endpoint**: `PATCH /api/addresses/:id/set-default`

**Authentication**: Required (users can only set their own addresses as default)

**Path Parameters**:
- `id` (number): Address ID to set as default

**Headers**:
```
Authorization: Bearer <token>
```

**Example Request**:
```
PATCH /api/addresses/1/set-default
Authorization: Bearer <token>
```

**Response**: `200 OK`
```json
{
  "success": true,
  "message": "Default address set successfully",
  "data": {
    "id": 1,
    "userId": 1,
    "street": "123 Main Street",
    "city": "New York",
    "state": "NY",
    "zipCode": "10001",
    "isDefault": true,
    "updatedAt": "2024-01-15T11:30:00.000Z"
  }
}
```

**Error Responses**:
- `401` - Authentication required
- `403` - Not authorized
- `404` - Address not found

---

## Favorites Endpoints

All favorites endpoints require authentication.

### Get User's Favorites

**Method**: `GET` (retrieves all favorite products - **NO request body**)

**Endpoint**: `GET /api/favorites`

**Authentication**: Required

**Headers**:
```
Authorization: Bearer <token>
```

**Example Request**:
```
GET /api/favorites
Authorization: Bearer <token>
```

**Response**: `200 OK`
```json
{
  "success": true,
  "message": "Favorites retrieved successfully",
  "data": [
    {
      "id": 1,
      "userId": 1,
      "productId": 1,
      "product": {
        "id": 1,
        "name": "iPhone 15",
        "price": "999.99",
        "discount": "10.00",
        "images": ["image1.jpg"],
        "stock": 50
      },
      "createdAt": "2024-01-15T10:30:00.000Z"
    }
  ]
}
```

**Error Responses**:
- `401` - Authentication required

---

### Check Favorite Status

**Method**: `GET` (checks if product is favorited - **NO request body**)

**Endpoint**: `GET /api/favorites/:productId/status`

**Authentication**: Required

**Path Parameters**:
- `productId` (number): Product ID to check

**Headers**:
```
Authorization: Bearer <token>
```

**Example Request**:
```
GET /api/favorites/1/status
Authorization: Bearer <token>
```

**Response**: `200 OK`
```json
{
  "success": true,
  "message": "Favorite status retrieved successfully",
  "data": {
    "productId": 1,
    "isFavorite": true,
    "favoriteId": 1
  }
}
```

**Error Responses**:
- `401` - Authentication required
- `404` - Product not found

---

### Add to Favorites

**Method**: `POST` (adds product to favorites - **REQUIRES request body**)

**Endpoint**: `POST /api/favorites`

**Authentication**: Required

**Headers**:
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body** (JSON):
```json
{
  "productId": 1
}
```

**Required Fields**:
- `productId` (number): Product ID to add to favorites

**Response**: `201 Created`
```json
{
  "success": true,
  "message": "Product added to favorites successfully",
  "data": {
    "id": 1,
    "userId": 1,
    "productId": 1,
    "product": {
      "id": 1,
      "name": "iPhone 15",
      "price": "999.99",
      "images": ["image1.jpg"]
    },
    "createdAt": "2024-01-15T10:30:00.000Z"
  }
}
```

**Error Responses**:
- `400` - Missing productId or product already in favorites
- `401` - Authentication required
- `404` - Product not found

---

### Remove from Favorites

**Method**: `POST` (removes product from favorites - **REQUIRES request body**)

**Endpoint**: `POST /api/favorites/:productId/remove`

**Authentication**: Required

**Path Parameters**:
- `productId` (number): Product ID to remove from favorites

**Headers**:
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body** (JSON - can be empty object):
```json
{}
```

**Example Request**:
```
POST /api/favorites/1/remove
Authorization: Bearer <token>
Content-Type: application/json
```

**Response**: `200 OK`
```json
{
  "success": true,
  "message": "Product removed from favorites successfully",
  "data": null
}
```

**Error Responses**:
- `401` - Authentication required
- `404` - Favorite not found

---

## Summary: GET vs POST Quick Reference

### When to Use GET
- ✅ Fetching data (products, categories, cart, orders)
- ✅ Viewing resources (single product, order details)
- ✅ Checking status (favorite status)
- ❌ **Never send a request body with GET**

### When to Use POST
- ✅ Creating new resources (register, add to cart, create order)
- ✅ Performing actions (login, password reset)
- ✅ Submitting forms
- ✅ **Always include JSON body with POST**

### Example JavaScript Usage

```javascript
// ✅ GET Request - No body
const getProducts = async () => {
  const response = await fetch('http://localhost:3000/api/products?page=1', {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  return response.json();
};

// ✅ POST Request - With body
const addToCart = async (productId, quantity) => {
  const response = await fetch('http://localhost:3000/api/cart', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      productId: productId,
      quantity: quantity
    })
  });
  return response.json();
};
```

---

## Notes for Frontend Development

1. **Token Management**: Store JWT token securely (e.g., localStorage, httpOnly cookie)
2. **Error Handling**: Always check `success` field in responses and handle errors appropriately
3. **Loading States**: Show loading indicators during API calls
4. **Validation**: Implement client-side validation before API calls
5. **Content-Type Header**: Always include `Content-Type: application/json` for POST/PATCH requests
6. **Price Formatting**: Prices are returned as strings, format them for display
7. **Date Formatting**: All dates are ISO 8601 strings, format them for display
8. **Delivery Time Slots**: Format time slots for display (e.g., "10:00 - 14:00" instead of "10-14")
9. **Address Display**: Show full delivery address in order details, handle null/optional fields gracefully
10. **Category Hierarchy**: Categories may have nested subcategories in the `children` field
11. **Guest Checkout**: Use `buy-now` endpoint for guest checkout, then `finalize` after authentication
12. **Pagination**: Use `page` and `limit` query parameters for paginated endpoints

---

**Last Updated**: 2024-01-15
