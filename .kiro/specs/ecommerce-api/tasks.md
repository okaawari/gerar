# Implementation Plan

- [-] 1. Set up project structure and core configuration



  - Create directory structure for models, services, controllers, routes, and middleware
  - Set up environment configuration with dotenv
  - Configure Express app with CORS and JSON parsing
  - Set up global error handling middleware
  - _Requirements: 7.1, 7.4, 8.1, 8.2_

- [x] 2. Configure database and Prisma setup
  - [x] 2.1 Create Prisma schema with User, Product, Category, Cart, and Order models
    - Define User model with phoneNumber, pin, name, role fields
    - Define Category model with name and description
    - Define Product model with name, price, description, stock, categoryId
    - Define CartItem model linking users and products
    - Define Order and OrderItem models for purchase tracking
    - _Requirements: 1.1, 3.1, 4.1, 5.1, 6.1_

  - [x] 2.2 Write property test for User model validation
    - **Property 1: User registration with valid data creates account**
    - **Validates: Requirements 1.1**

  - [x] 2.3 Write property test for duplicate phone number rejection
    - **Property 2: Duplicate phone number registration rejection**
    - **Validates: Requirements 1.2**

  - [x] 2.4 Generate Prisma client and run initial migration
    - Generate database migration files
    - Apply migrations to create database schema
    - _Requirements: 1.1, 3.1, 4.1, 5.1, 6.1_

- [x] 3. Implement authentication system
  - [x] 3.1 Create JWT utility functions
    - Implement token generation and verification
    - Configure JWT secret and expiration
    - _Requirements: 1.4, 2.1, 2.3, 2.4_

  - [x] 3.2 Implement password/PIN hashing utilities
    - Create bcrypt hash and compare functions
    - Add PIN format validation (4 digits)
    - Add phone number validation (8 digits)
    - _Requirements: 1.5, 2.1, 2.2_

  - [ ]* 3.3 Write property test for PIN encryption
    - **Property 5: PIN encryption with bcrypt**
    - **Validates: Requirements 1.5**

  - [x] 3.4 Create authentication middleware
    - Implement JWT token extraction and validation
    - Add user role checking for admin operations
    - _Requirements: 2.3, 2.4, 4.6_

  - [ ]* 3.5 Write property test for JWT validation
    - **Property 8: JWT token validation and user extraction**
    - **Validates: Requirements 2.3**

- [x] 4. Build authentication endpoints
  - [x] 4.1 Implement user registration
    - Create auth service for user registration
    - Create auth controller for registration endpoint
    - Create auth routes for POST /api/auth/register
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

  - [ ]* 4.2 Write property test for registration validation
    - **Property 3: Invalid registration data validation**
    - **Validates: Requirements 1.3**

  - [x] 4.3 Implement user login
    - Create auth service for user login
    - Create auth controller for login endpoint
    - Create auth routes for POST /api/auth/login
    - _Requirements: 2.1, 2.2_

  - [ ]* 4.4 Write property test for login authentication
    - **Property 6: Valid login credentials authentication**
    - **Validates: Requirements 2.1**

  - [ ]* 4.5 Write property test for invalid credentials
    - **Property 7: Invalid credentials rejection**
    - **Validates: Requirements 2.2**

- [x] 5. Checkpoint - Ensure authentication tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 6. Implement category management system
  - [ ] 6.1 Create category service layer
    - Implement CRUD operations for categories
    - Add category validation functions
    - _Requirements: 4.4, 4.5, 4.7_

  - [ ] 6.2 Create category controller and routes
    - Create category controller with CRUD endpoints
    - Create category routes for /api/categories
    - Add admin authorization middleware
    - _Requirements: 4.4, 4.5, 4.6, 4.7_

  - [ ]* 6.3 Write property test for category creation
    - **Property 19: Admin category creation**
    - **Validates: Requirements 4.4**

  - [ ]* 6.4 Write property test for non-admin category rejection
    - **Property 21: Non-admin category management rejection**
    - **Validates: Requirements 4.6**

- [ ] 7. Implement product management system
  - [ ] 7.1 Create product service layer
    - Implement CRUD operations for products
    - Add product validation and stock checking
    - Add category relationship handling
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 4.1, 4.2, 4.3_

  - [ ]* 7.2 Write property test for product listing
    - **Property 10: Product listing completeness**
    - **Validates: Requirements 3.1**

  - [ ]* 7.3 Write property test for category filtering
    - **Property 12: Product category filtering**
    - **Validates: Requirements 3.3**

  - [ ] 7.4 Create product controller and routes
    - Create product controller with CRUD and search endpoints
    - Create product routes for /api/products
    - Add admin authorization for management operations
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 4.1, 4.2, 4.3, 4.6_

  - [ ]* 7.5 Write property test for product search
    - **Property 11: Product search accuracy**
    - **Validates: Requirements 3.2**

  - [ ]* 7.6 Write property test for stock filtering
    - **Property 15: In-stock product filtering**
    - **Validates: Requirements 3.6**

- [x] 8. Implement shopping cart system
  - [x] 8.1 Create cart service layer
    - Implement cart operations (add, update, remove, clear)
    - Add stock validation for cart operations
    - _Requirements: 5.1, 5.2_

  - [x] 8.2 Write property test for cart stock validation
    - **Property 20: Cart addition with stock validation**
    - **Validates: Requirements 5.1**

  - [x] 8.3 Write property test for insufficient stock rejection
    - **Property 21: Insufficient stock cart rejection**
    - **Validates: Requirements 5.2**

  - [x] 8.4 Create cart controller and routes
    - Create cart controller with cart management endpoints
    - Create cart routes for /api/cart
    - Add user authentication middleware
    - _Requirements: 5.1, 5.2_

- [ ] 9. Implement order processing system
  - [ ] 9.1 Create order service layer
    - Implement order creation from cart
    - Add order total calculation
    - Add stock reduction logic
    - Add order history retrieval
    - _Requirements: 5.3, 5.4, 5.5, 6.1, 6.2, 6.3, 6.4, 6.5_

  - [ ]* 9.2 Write property test for order creation
    - **Property 22: Order creation and stock reduction**
    - **Validates: Requirements 5.3**

  - [ ]* 9.3 Write property test for order total calculation
    - **Property 23: Order total calculation and storage**
    - **Validates: Requirements 5.4**

  - [ ] 9.4 Create order controller and routes
    - Create order controller with order management endpoints
    - Create order routes for /api/orders
    - Add user authentication and authorization
    - _Requirements: 5.3, 5.4, 5.5, 6.1, 6.2, 6.3, 6.4, 6.5_

  - [ ]* 9.5 Write property test for order access control
    - **Property 28: Order access control**
    - **Validates: Requirements 6.4**

- [ ] 10. Implement response formatting and validation
  - [ ] 10.1 Create response utility functions
    - Implement consistent success and error response formatters
    - Add pagination utilities
    - Add timestamp formatting (ISO 8601)
    - _Requirements: 8.1, 8.2, 8.3, 8.4_

  - [ ]* 10.2 Write property test for response consistency
    - **Property 32: Success response format consistency**
    - **Validates: Requirements 8.1**

  - [ ]* 10.3 Write property test for error response consistency
    - **Property 33: Error response format consistency**
    - **Validates: Requirements 8.2**

  - [ ] 10.4 Create input validation middleware
    - Implement request validation for all endpoints
    - Add JSON parsing error handling
    - Add missing field validation
    - _Requirements: 7.2, 7.3, 8.5_

  - [ ]* 10.5 Write property test for data sanitization
    - **Property 36: User data sanitization**
    - **Validates: Requirements 8.5**

- [ ] 11. Integrate all components and create main server
  - [ ] 11.1 Create main Express application
    - Set up Express app with all routes
    - Configure middleware stack
    - Set up database connection
    - _Requirements: 7.1, 7.4_

  - [ ] 11.2 Create server entry point
    - Create server.js with port configuration
    - Add graceful shutdown handling
    - Add startup logging
    - _Requirements: 7.1_

  - [ ]* 11.3 Write integration tests for key workflows
    - Test complete user registration and login flow
    - Test product browsing and cart operations
    - Test order placement end-to-end
    - _Requirements: 1.1, 2.1, 3.1, 5.1, 5.3_

- [ ] 12. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.