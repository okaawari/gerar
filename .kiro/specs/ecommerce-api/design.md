# Design Document: Ecommerce Backend API

## Overview

The Ecommerce Backend API is a RESTful service built with Node.js, Express, and Prisma ORM, using MySQL as the database. The system provides core ecommerce functionality including user authentication via phone number (8-digit Mongolian format) and 4-digit PIN for easy mobile access, product management, shopping cart operations, and order processing. Users register with their phone number and PIN initially, with optional email verification to be added in future iterations for SMS-based authentication. The architecture follows a layered approach with clear separation between routes, controllers, services, and data access layers.

## Architecture

### Technology Stack
- **Runtime**: Node.js
- **Framework**: Express.js 5.x
- **Database**: MySQL
- **ORM**: Prisma 7.x
- **Authentication**: JWT (jsonwebtoken)
- **Password Hashing**: bcrypt
- **Environment Configuration**: dotenv

### Layered Architecture

```
┌─────────────────────────────────────┐
│         API Routes Layer            │
│  (Express Routes & Middleware)      │
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│       Controllers Layer             │
│  (Request/Response Handling)        │
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│        Services Layer               │
│   (Business Logic)                  │
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│      Data Access Layer              │
│    (Prisma Client)                  │
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│         MySQL Database              │
└─────────────────────────────────────┘
```

### Directory Structure

```
/
├── src/
│   ├── config/
│   │   └── database.js          # Database configuration
│   ├── middleware/
│   │   ├── auth.js              # JWT authentication middleware
│   │   ├── errorHandler.js      # Global error handling
│   │   └── validation.js        # Request validation
│   ├── routes/
│   │   ├── auth.routes.js       # Authentication endpoints
│   │   ├── product.routes.js    # Product endpoints
│   │   ├── category.routes.js   # Category endpoints
│   │   ├── cart.routes.js       # Cart endpoints
│   │   └── order.routes.js      # Order endpoints
│   ├── controllers/
│   │   ├── auth.controller.js
│   │   ├── product.controller.js
│   │   ├── category.controller.js
│   │   ├── cart.controller.js
│   │   └── order.controller.js
│   ├── services/
│   │   ├── auth.service.js
│   │   ├── product.service.js
│   │   ├── category.service.js
│   │   ├── cart.service.js
│   │   └── order.service.js
│   ├── utils/
│   │   ├── jwt.js               # JWT utilities
│   │   └── response.js          # Response formatters
│   └── app.js                   # Express app setup
├── prisma/
│   └── schema.prisma            # Database schema
├── .env                         # Environment variables
└── server.js                    # Entry point
```

## Components and Interfaces

### 1. Authentication System

**Components:**
- `auth.routes.js`: Defines `/api/auth/register`, `/api/auth/login`, `/api/auth/logout` endpoints
- `auth.controller.js`: Handles authentication request/response logic
- `auth.service.js`: Implements authentication business logic
- `auth.js` middleware: Validates JWT tokens and protects routes

**Key Functions:**
- `register(phoneNumber, pin, name)`: Creates new user with hashed PIN
- `login(phoneNumber, pin)`: Validates credentials and returns JWT
- `verifyToken(token)`: Validates JWT and extracts user data
- `hashPin(pin)`: Hashes 4-digit PIN using bcrypt
- `comparePin(plain, hashed)`: Verifies PIN against hash
- `validatePhoneNumber(phone)`: Validates 8-digit Mongolian phone number format
- `validatePin(pin)`: Validates 4-digit PIN format

### 2. Product Management System

**Components:**
- `product.routes.js`: Defines product CRUD endpoints
- `product.controller.js`: Handles product request/response logic
- `product.service.js`: Implements product business logic

**Key Functions:**
- `getAllProducts(filters)`: Retrieves products with optional filtering by category
- `getProductById(id)`: Retrieves single product
- `searchProducts(query)`: Searches products by name
- `getProductsByCategory(categoryId)`: Retrieves products by category
- `createProduct(data)`: Creates new product (admin only)
- `updateProduct(id, data)`: Updates product (admin only)
- `deleteProduct(id)`: Deletes product (admin only)
- `checkStock(productId, quantity)`: Verifies stock availability
- `getAllCategories()`: Retrieves all product categories
- `createCategory(data)`: Creates new category (admin only)
- `updateCategory(id, data)`: Updates category (admin only)
- `deleteCategory(id)`: Deletes category (admin only)

### 3. Category Management System

**Components:**
- `category.routes.js`: Defines category CRUD endpoints
- `category.controller.js`: Handles category request/response logic
- `category.service.js`: Implements category business logic

**Key Functions:**
- `getAllCategories()`: Retrieves all categories
- `getCategoryById(id)`: Retrieves single category with products
- `createCategory(name, description)`: Creates new category (admin only)
- `updateCategory(id, data)`: Updates category (admin only)
- `deleteCategory(id)`: Deletes category and handles product reassignment (admin only)
- `getCategoryProducts(categoryId)`: Retrieves products in specific category

### 4. Shopping Cart System

**Components:**
- `cart.routes.js`: Defines cart operation endpoints
- `cart.controller.js`: Handles cart request/response logic
- `cart.service.js`: Implements cart business logic

**Key Functions:**
- `addToCart(userId, productId, quantity)`: Adds item to cart with stock validation
- `getCart(userId)`: Retrieves user's cart
- `updateCartItem(userId, productId, quantity)`: Updates cart item quantity
- `removeFromCart(userId, productId)`: Removes item from cart
- `clearCart(userId)`: Empties user's cart

### 5. Order Processing System

**Components:**
- `order.routes.js`: Defines order endpoints
- `order.controller.js`: Handles order request/response logic
- `order.service.js`: Implements order business logic

**Key Functions:**
- `createOrder(userId, cartItems)`: Creates order from cart, reduces stock
- `getOrderById(userId, orderId)`: Retrieves specific order
- `getUserOrders(userId)`: Retrieves user's order history
- `getAllOrders()`: Retrieves all orders (admin only)
- `calculateOrderTotal(items)`: Calculates order total amount

### 6. Middleware Components

**Authentication Middleware:**
- Extracts JWT from Authorization header
- Validates token and attaches user to request object
- Returns 401 for invalid/missing tokens

**Authorization Middleware:**
- Checks user role (admin vs regular user)
- Returns 403 for insufficient permissions

**Error Handler Middleware:**
- Catches all errors
- Formats error responses consistently
- Logs errors for debugging
- Prevents sensitive data exposure

**Validation Middleware:**
- Validates request body, params, and query
- Returns 400 for invalid input
- Provides specific validation error messages

## Data Models

### Prisma Schema

```prisma
```prisma
model User {
  id          Int      @id @default(autoincrement())
  phoneNumber String   @unique @db.VarChar(8)
  email       String?  @unique
  pin         String   @db.VarChar(60) // bcrypt hash length
  name        String
  role        Role     @default(USER)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  cart        CartItem[]
  orders      Order[]
}

enum Role {
  USER
  ADMIN
}

model Product {
  id          Int      @id @default(autoincrement())
  name        String
  description String?  @db.Text
  price       Decimal  @db.Decimal(10, 2)
  stock       Int      @default(0)
  categoryId  Int
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  category    Category @relation(fields: [categoryId], references: [id])
  cartItems   CartItem[]
  orderItems  OrderItem[]
}

model Category {
  id          Int      @id @default(autoincrement())
  name        String   @unique
  description String?  @db.Text
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  products    Product[]
}

model CartItem {
  id        Int      @id @default(autoincrement())
  userId    Int
  productId Int
  quantity  Int
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  product   Product  @relation(fields: [productId], references: [id], onDelete: Cascade)
  
  @@unique([userId, productId])
}

model Order {
  id          Int         @id @default(autoincrement())
  userId      Int
  totalAmount Decimal     @db.Decimal(10, 2)
  status      OrderStatus @default(PENDING)
  createdAt   DateTime    @default(now())
  updatedAt   DateTime    @updatedAt
  
  user        User        @relation(fields: [userId], references: [id])
  items       OrderItem[]
}

enum OrderStatus {
  PENDING
  COMPLETED
  CANCELLED
}

model OrderItem {
  id        Int     @id @default(autoincrement())
  orderId   Int
  productId Int
  quantity  Int
  price     Decimal @db.Decimal(10, 2)
  
  order     Order   @relation(fields: [orderId], references: [id], onDelete: Cascade)
  product   Product @relation(fields: [productId], references: [id])
}
```

### API Response Formats

**Success Response:**
```json
{
  "success": true,
  "data": { ... },
  "message": "Operation successful"
}
```

**Error Response:**
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable error message"
  }
}
```

**List Response:**
```json
{
  "success": true,
  "data": [...],
  "pagination": {
    "total": 100,
    "page": 1,
    "limit": 10
  }
}
```

## 
Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

**Property 1: User registration with valid data creates account**
*For any* valid registration data (8-digit phone number, 4-digit PIN, name), the system should create a new user account with encrypted PIN
**Validates: Requirements 1.1**

**Property 2: Duplicate phone number registration rejection**
*For any* existing user phone number, attempting to register with the same phone number should be rejected with appropriate error
**Validates: Requirements 1.2**

**Property 3: Invalid registration data validation**
*For any* invalid registration data (missing fields, invalid phone format, invalid PIN format), the system should return specific validation errors
**Validates: Requirements 1.3**

**Property 4: Successful registration returns JWT**
*For any* successful user registration, the system should return a valid JWT authentication token
**Validates: Requirements 1.4**

**Property 5: PIN encryption with bcrypt**
*For any* user registration, the stored PIN should be bcrypt hashed, not plain text
**Validates: Requirements 1.5**

**Property 6: Valid login credentials authentication**
*For any* valid login credentials (phone number and PIN), the system should authenticate the user and return a JWT token
**Validates: Requirements 2.1**

**Property 7: Invalid credentials rejection**
*For any* invalid login credentials, the system should reject authentication with appropriate error
**Validates: Requirements 2.2**

**Property 8: JWT token validation and user extraction**
*For any* valid JWT token in requests, the system should validate the token and extract user information
**Validates: Requirements 2.3**

**Property 9: Invalid JWT token rejection**
*For any* invalid or expired JWT token, the system should reject the request with authorization error
**Validates: Requirements 2.4**

**Property 10: Product listing completeness**
*For any* product list request, the system should return all available products with complete details (name, price, description, stock, category)
**Validates: Requirements 3.1**

**Property 11: Product search accuracy**
*For any* product search query, the system should return only products matching the search criteria
**Validates: Requirements 3.2**

**Property 12: Product category filtering**
*For any* category filter request, the system should return only products from the specified category
**Validates: Requirements 3.3**

**Property 13: Product retrieval by valid ID**
*For any* existing product ID, the system should return the complete product details including category
**Validates: Requirements 3.4**

**Property 14: Non-existent product error handling**
*For any* non-existent product ID, the system should return a not found error
**Validates: Requirements 3.5**

**Property 15: In-stock product filtering**
*For any* product display, the system should only show products with stock quantity greater than zero
**Validates: Requirements 3.6**

**Property 16: Admin product creation with category**
*For any* valid product data with category and admin user, the system should successfully create and add the product to catalog
**Validates: Requirements 4.1**

**Property 17: Admin product updates maintain integrity**
*For any* existing product and valid update data from admin, the system should modify product details while maintaining data integrity
**Validates: Requirements 4.2**

**Property 18: Admin product deletion with referential integrity**
*For any* existing product deletion by admin, the system should remove it from catalog while properly handling order references
**Validates: Requirements 4.3**

**Property 19: Admin category creation**
*For any* valid category data and admin user, the system should successfully create the category
**Validates: Requirements 4.4**

**Property 20: Admin category management with product handling**
*For any* category update or deletion by admin, the system should handle products in that category appropriately
**Validates: Requirements 4.5**

**Property 21: Non-admin category management rejection**
*For any* product or category management operation by non-admin user, the system should reject with authorization error
**Validates: Requirements 4.6**

**Property 22: Product and category data validation**
*For any* invalid product or category data (negative price, empty name, invalid category), the system should validate input and return appropriate errors
**Validates: Requirements 4.7**

**Property 20: Cart addition with stock validation**
*For any* valid cart addition request, the system should store the cart item and verify stock availability
**Validates: Requirements 5.1**

**Property 21: Insufficient stock cart rejection**
*For any* cart addition request exceeding available stock, the system should reject with stock error
**Validates: Requirements 5.2**

**Property 22: Order creation and stock reduction**
*For any* order placement from cart, the system should create order record and reduce product stock quantities accordingly
**Validates: Requirements 5.3**

**Property 23: Order total calculation and storage**
*For any* order placement, the system should calculate correct total amount and store order details with timestamp
**Validates: Requirements 5.4**

**Property 24: Insufficient stock order rejection**
*For any* order with insufficient stock, the system should reject the order and maintain original stock levels
**Validates: Requirements 5.5**

**Property 25: User order history retrieval**
*For any* user order history request, the system should return all orders associated with their account
**Validates: Requirements 6.1**

**Property 26: Order detail completeness**
*For any* order display, the system should include order ID, date, products, quantities, and total amount
**Validates: Requirements 6.2**

**Property 27: User order access by ID**
*For any* user requesting their own order by ID, the system should return the order details
**Validates: Requirements 6.3**

**Property 28: Order access control**
*For any* user attempting to access another user's order, the system should reject with authorization error
**Validates: Requirements 6.4**

**Property 29: Admin all-orders access**
*For any* admin requesting all orders, the system should return orders from all users
**Validates: Requirements 6.5**

**Property 30: Invalid JSON error handling**
*For any* request with malformed JSON, the system should return appropriate malformed request error
**Validates: Requirements 7.2**

**Property 31: Missing field validation**
*For any* request with missing required fields, the system should return validation errors specifying missing fields
**Validates: Requirements 7.3**

**Property 32: Success response format consistency**
*For any* successful API operation, the system should return responses with consistent JSON structure including success status
**Validates: Requirements 8.1**

**Property 33: Error response format consistency**
*For any* failed API operation, the system should return error responses with consistent structure including error codes and messages
**Validates: Requirements 8.2**

**Property 34: Pagination format consistency**
*For any* list data response, the system should use consistent pagination and metadata format
**Validates: Requirements 8.3**

**Property 35: Timestamp format consistency**
*For any* response containing timestamps, the system should use ISO 8601 format consistently
**Validates: Requirements 8.4**

**Property 36: User data sanitization**
*For any* user data response, the system should exclude sensitive information like PIN hashes
**Validates: Requirements 8.5**

## Error Handling

### Error Categories

**Authentication Errors (401):**
- Invalid or missing JWT tokens
- Expired tokens
- Invalid login credentials

**Authorization Errors (403):**
- Non-admin users attempting admin operations
- Users accessing other users' private data

**Validation Errors (400):**
- Missing required fields
- Invalid data formats
- Business rule violations (e.g., negative prices)

**Not Found Errors (404):**
- Non-existent products, orders, or users
- Invalid resource IDs

**Conflict Errors (409):**
- Duplicate email registration
- Insufficient stock for operations

**Server Errors (500):**
- Database connection failures
- Unexpected system errors

### Error Response Format

All errors follow a consistent structure:

```json
{
  "success": false,
  "error": {
    "code": "SPECIFIC_ERROR_CODE",
    "message": "Human readable error message",
    "details": { /* Additional context when applicable */ }
  }
}
```

### Error Handling Strategy

1. **Input Validation**: Validate all inputs at the controller level before processing
2. **Business Logic Errors**: Handle business rule violations in service layer
3. **Database Errors**: Catch and transform database errors into user-friendly messages
4. **Global Error Handler**: Centralized error handling middleware for consistent responses
5. **Logging**: Log all errors with appropriate detail levels for debugging
6. **Security**: Never expose internal system details or stack traces to clients

## Testing Strategy

### Dual Testing Approach

The system will use both unit testing and property-based testing to ensure comprehensive coverage:

- **Unit tests** verify specific examples, edge cases, and error conditions
- **Property tests** verify universal properties that should hold across all inputs
- Together they provide comprehensive coverage: unit tests catch concrete bugs, property tests verify general correctness

### Unit Testing

Unit tests will cover:
- Specific examples that demonstrate correct behavior
- Integration points between components
- Error conditions and edge cases
- Authentication and authorization flows

**Testing Framework**: Jest
**Coverage Target**: 80% code coverage minimum

### Property-Based Testing

**Framework**: fast-check (JavaScript property-based testing library)
**Configuration**: Minimum 100 iterations per property test
**Tagging**: Each property-based test must include a comment with format: `**Feature: ecommerce-api, Property {number}: {property_text}**`

Property-based tests will verify:
- Authentication properties across various user inputs
- Product management operations with generated data
- Cart and order operations with random valid inputs
- API response format consistency
- Data validation across input ranges

Each correctness property from the design document will be implemented by a single property-based test.

### Integration Testing

Integration tests will verify:
- End-to-end API workflows
- Database integration
- Authentication middleware integration
- Error handling across system boundaries

### Test Data Management

- Use database transactions for test isolation
- Generate realistic test data using factories
- Clean up test data after each test run
- Use separate test database configuration

### Continuous Testing

- Run unit tests on every code change
- Run property-based tests in CI/CD pipeline
- Generate test coverage reports
- Fail builds on test failures or coverage drops