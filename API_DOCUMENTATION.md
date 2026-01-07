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

Retrieve all products in a specific category.

**Endpoint:** `GET /api/categories/:id/products`

**Authentication:** Not required

**Parameters:**
- `id` (path) - Category ID

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
      "stock": 50,
      "categoryId": 1,
      "category": {
        "id": 1,
        "name": "Electronics"
      },
      "createdAt": "2024-01-15T10:30:00.000Z",
      "updatedAt": "2024-01-15T10:30:00.000Z"
    }
  ]
}
```

**Errors:**
- `404` - Category not found

---

### Create Category (Admin Only)

Create a new product category.

**Endpoint:** `POST /api/categories`

**Authentication:** Required (Admin only)

**Headers:**
```
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "name": "Electronics",           // Required, unique
  "description": "Electronic devices" // Optional
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
    "createdAt": "2024-01-15T10:30:00.000Z",
    "updatedAt": "2024-01-15T10:30:00.000Z"
  }
}
```

**Errors:**
- `401` - Authentication required
- `403` - Admin privileges required
- `409` - Category with this name already exists
- `400` - Validation failed

---

### Update Category (Admin Only)

Update an existing category.

**Endpoint:** `PUT /api/categories/:id`

**Authentication:** Required (Admin only)

**Headers:**
```
Authorization: Bearer <token>
```

**Parameters:**
- `id` (path) - Category ID

**Request Body:**
```json
{
  "name": "Updated Electronics",    // Optional
  "description": "Updated description" // Optional
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
    "createdAt": "2024-01-15T10:30:00.000Z",
    "updatedAt": "2024-01-15T11:00:00.000Z"
  }
}
```

**Errors:**
- `401` - Authentication required
- `403` - Admin privileges required
- `404` - Category not found
- `409` - Category with this name already exists

---

### Delete Category (Admin Only)

Delete a category.

**Endpoint:** `DELETE /api/categories/:id`

**Authentication:** Required (Admin only)

**Headers:**
```
Authorization: Bearer <token>
```

**Parameters:**
- `id` (path) - Category ID

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Category deleted successfully",
  "data": {
    "id": 1,
    "name": "Electronics",
    "description": "Electronic devices",
    "createdAt": "2024-01-15T10:30:00.000Z",
    "updatedAt": "2024-01-15T10:30:00.000Z"
  }
}
```

**Errors:**
- `401` - Authentication required
- `403` - Admin privileges required
- `404` - Category not found

---

## Products Endpoints

### Get All Products

Retrieve all products with optional filtering.

**Endpoint:** `GET /api/products`

**Authentication:** Not required

**Query Parameters:**
- `categoryId` (optional) - Filter by category ID
- `search` (optional) - Search products by name
- `inStock` (optional) - Filter by stock availability (`true`/`false`)

**Examples:**
```
GET /api/products
GET /api/products?categoryId=1
GET /api/products?search=laptop
GET /api/products?inStock=true
GET /api/products?categoryId=1&search=laptop&inStock=true
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
      "price": "999.99",
      "stock": 50,
      "categoryId": 1,
      "category": {
        "id": 1,
        "name": "Electronics"
      },
      "createdAt": "2024-01-15T10:30:00.000Z",
      "updatedAt": "2024-01-15T10:30:00.000Z"
    }
  ]
}
```

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
    "price": "999.99",
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

**Errors:**
- `404` - Product not found

---

### Create Product (Admin Only)

Create a new product.

**Endpoint:** `POST /api/products`

**Authentication:** Required (Admin only)

**Headers:**
```
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "name": "Laptop",              // Required
  "description": "High-performance laptop", // Required
  "price": 999.99,               // Required, decimal
  "stock": 50,                   // Required, integer
  "categoryId": 1                // Required, must exist
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
    "price": "999.99",
    "stock": 50,
    "categoryId": 1,
    "createdAt": "2024-01-15T10:30:00.000Z",
    "updatedAt": "2024-01-15T10:30:00.000Z"
  }
}
```

**Errors:**
- `401` - Authentication required
- `403` - Admin privileges required
- `400` - Validation failed (e.g., category doesn't exist)
- `404` - Category not found

---

### Update Product (Admin Only)

Update an existing product.

**Endpoint:** `PUT /api/products/:id`

**Authentication:** Required (Admin only)

**Headers:**
```
Authorization: Bearer <token>
```

**Parameters:**
- `id` (path) - Product ID

**Request Body:**
```json
{
  "name": "Updated Laptop",      // Optional
  "description": "Updated description", // Optional
  "price": 899.99,               // Optional
  "stock": 40,                   // Optional
  "categoryId": 1                // Optional
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
    "price": "899.99",
    "stock": 40,
    "categoryId": 1,
    "createdAt": "2024-01-15T10:30:00.000Z",
    "updatedAt": "2024-01-15T11:00:00.000Z"
  }
}
```

**Errors:**
- `401` - Authentication required
- `403` - Admin privileges required
- `404` - Product not found
- `400` - Validation failed (e.g., category doesn't exist)

---

### Delete Product (Admin Only)

Delete a product.

**Endpoint:** `DELETE /api/products/:id`

**Authentication:** Required (Admin only)

**Headers:**
```
Authorization: Bearer <token>
```

**Parameters:**
- `id` (path) - Product ID

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
```

**Response:** `201 Created`
```json
{
  "success": true,
  "message": "Order created successfully",
  "data": {
    "id": 1,
    "userId": 1,
    "totalAmount": "1999.98",
    "status": "COMPLETED",
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
          "name": "Laptop",
          "description": "High-performance laptop"
        },
        "createdAt": "2024-01-15T10:30:00.000Z",
        "updatedAt": "2024-01-15T10:30:00.000Z"
      }
    ]
  }
}
```

**Errors:**
- `401` - Authentication required
- `400` - Cart is empty
- `400` - Insufficient stock for one or more products

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
      "totalAmount": "1999.98",
      "status": "COMPLETED",
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
            "name": "Laptop"
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

### Get All Orders (Admin Only)

Retrieve all orders from all users.

**Endpoint:** `GET /api/orders/all`

**Authentication:** Required (Admin only)

**Headers:**
```
Authorization: Bearer <token>
```

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "All orders retrieved successfully",
  "data": [
    {
      "id": 1,
      "userId": 1,
      "totalAmount": "1999.98",
      "status": "COMPLETED",
      "user": {
        "id": 1,
        "phoneNumber": "12345678",
        "name": "John Doe"
      },
      "createdAt": "2024-01-15T10:30:00.000Z",
      "updatedAt": "2024-01-15T10:30:00.000Z",
      "items": [...]
    }
  ]
}
```

**Errors:**
- `401` - Authentication required
- `403` - Admin privileges required

---

### Get Order by ID

Retrieve a specific order by ID. Users can only view their own orders, while admins can view any order.

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
    "totalAmount": "1999.98",
    "status": "COMPLETED",
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
          "name": "Laptop",
          "description": "High-performance laptop"
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
  price: string;        // Decimal as string (e.g., "999.99")
  stock: number;
  categoryId: number;
  createdAt: string;    // ISO 8601 date
  updatedAt: string;    // ISO 8601 date
  category?: Category;  // Included in some responses
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

### Order
```typescript
{
  id: number;
  userId: number;
  totalAmount: string;  // Decimal as string
  status: string;       // Default: "COMPLETED"
  createdAt: string;    // ISO 8601 date
  updatedAt: string;    // ISO 8601 date
  items?: OrderItem[];  // Included in responses
  user?: User;          // Included in admin responses
}
```

### OrderItem
```typescript
{
  id: number;
  orderId: number;
  productId: number;
  quantity: number;
  price: string;        // Decimal as string (snapshot price at time of order)
  createdAt: string;    // ISO 8601 date
  updatedAt: string;    // ISO 8601 date
  product?: Product;    // Included in responses
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
    'Authorization': `Bearer ${token}`
  }
});

const order = await createOrderResponse.json();
console.log('Order created:', order.data.id);
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

5. **Order Status**: Currently, all orders are created with status "COMPLETED". This may change in future versions.

6. **CORS**: The API has CORS enabled. Make sure your frontend origin is allowed in the backend configuration.

7. **Rate Limiting**: Currently, there is no rate limiting implemented. Consider implementing client-side throttling if needed.

8. **Phone Number Format**: Phone numbers must be exactly 8 digits (no spaces, dashes, or other characters).

9. **PIN Format**: PINs must be exactly 4 digits.

---

## Support

For questions or issues, please contact the backend development team or refer to the source code.

**API Version:** 1.0.0  
**Last Updated:** 2024-01-15

