# Guest Checkout API Documentation

## Overview

The e-commerce API now supports **guest checkout**, allowing users to browse products, add items to cart, and place orders without requiring authentication. Users can have a full shopping experience as guests, with the ability to merge their guest cart into their user account when they log in.

### Key Features
- ✅ Add items to cart without logging in
- ✅ Update/remove cart items as guest
- ✅ Place orders without authentication
- ✅ Session token-based cart persistence
- ✅ Automatic cart merging on login
- ❌ Favorites still require authentication (as designed)

---

## Session Token Management

### What is a Session Token?

A **session token** is a unique identifier (64-character hex string) that identifies a guest user's session. It's similar to a session ID and is used to:
- Track guest cart items
- Persist cart across browser sessions
- Merge guest cart with user cart on login

### How to Handle Session Tokens

1. **First Cart Action (Guest)**
   - When a guest adds their first item to cart, the API will return a `sessionToken` in the response
   - **Store this token** in `localStorage` or a cookie
   - Include it in subsequent requests

2. **Including Session Token in Requests**
   - **Option 1 (Recommended)**: Include in request header
     ```
     X-Session-Token: <session-token>
     ```
   - **Option 2**: Include in request body
     ```json
     {
       "productId": 1,
       "quantity": 2,
       "sessionToken": "<session-token>"
     }
     ```

3. **Token Persistence**
   - Store token in `localStorage` for persistence across browser sessions
   - Token remains valid until cart is cleared or merged on login
   - No expiration (but can be cleaned up server-side if needed)

---

## API Endpoints

### Cart Endpoints

All cart endpoints now support both **authenticated** and **guest** users.

#### 1. Get Cart

**Endpoint:** `GET /api/cart`

**Authentication:** Optional (Bearer token for authenticated, session token for guest)

**Headers:**
```
Authorization: Bearer <jwt-token>  // Optional - for authenticated users
X-Session-Token: <session-token>   // Optional - for guest users
```

**Request Body:** None

**Response (Authenticated User):**
```json
{
  "success": true,
  "message": "Cart retrieved successfully",
  "data": [
    {
      "id": 1,
      "userId": 123,
      "productId": 5,
      "quantity": 2,
      "product": {
        "id": 5,
        "name": "Product Name",
        "price": "29.99",
        // ... other product fields
      }
    }
  ],
  "isGuest": false
}
```

**Response (Guest User - No Token):**
```json
{
  "success": true,
  "message": "Cart retrieved successfully",
  "data": [],
  "isGuest": true,
  "sessionToken": "a1b2c3d4e5f6..." // New token generated
}
```

**Response (Guest User - With Token):**
```json
{
  "success": true,
  "message": "Cart retrieved successfully",
  "data": [
    {
      "id": 1,
      "sessionToken": "a1b2c3d4e5f6...",
      "productId": 5,
      "quantity": 2,
      "product": {
        // ... product details
      }
    }
  ],
  "isGuest": true,
  "sessionToken": "a1b2c3d4e5f6..."
}
```

---

#### 2. Add Item to Cart

**Endpoint:** `POST /api/cart`

**Authentication:** Optional

**Headers:**
```
Authorization: Bearer <jwt-token>  // Optional
X-Session-Token: <session-token>   // Optional for guest
```

**Request Body (Authenticated):**
```json
{
  "productId": 5,
  "quantity": 2
}
```

**Request Body (Guest):**
```json
{
  "productId": 5,
  "quantity": 2,
  "sessionToken": "a1b2c3d4e5f6..."  // Optional if in header
}
```

**Response (Authenticated):**
```json
{
  "success": true,
  "message": "Item added to cart successfully",
  "data": {
    "id": 1,
    "userId": 123,
    "productId": 5,
    "quantity": 2,
    "product": { /* product details */ }
  },
  "isGuest": false
}
```

**Response (Guest - First Time):**
```json
{
  "success": true,
  "message": "Item added to cart successfully",
  "data": {
    "id": 1,
    "sessionToken": "a1b2c3d4e5f6...",
    "productId": 5,
    "quantity": 2,
    "product": { /* product details */ }
  },
  "isGuest": true,
  "sessionToken": "a1b2c3d4e5f6..."  // ⚠️ IMPORTANT: Save this token!
}
```

**Response (Guest - Existing Token):**
```json
{
  "success": true,
  "message": "Item added to cart successfully",
  "data": { /* cart item */ },
  "isGuest": true,
  "sessionToken": "a1b2c3d4e5f6..."  // Same token as provided
}
```

**Error Responses:**
```json
{
  "success": false,
  "message": "Insufficient stock. Available: 5, Requested: 10",
  "error": { /* error details */ }
}
```

---

#### 3. Update Cart Item Quantity

**Endpoint:** `POST /api/cart/:productId/update`

**Authentication:** Optional

**Headers:**
```
Authorization: Bearer <jwt-token>  // Optional
X-Session-Token: <session-token>   // Required for guest
```

**Request Body:**
```json
{
  "quantity": 5,
  "sessionToken": "a1b2c3d4e5f6..."  // Required for guest (if not in header)
}
```

**Response:**
```json
{
  "success": true,
  "message": "Cart item updated successfully",
  "data": { /* updated cart item */ },
  "isGuest": true,  // or false
  "sessionToken": "a1b2c3d4e5f6..."  // For guest users
}
```

---

#### 4. Remove Item from Cart

**Endpoint:** `POST /api/cart/:productId/remove`

**Authentication:** Optional

**Headers:**
```
Authorization: Bearer <jwt-token>  // Optional
X-Session-Token: <session-token>   // Required for guest
```

**Request Body (Guest):**
```json
{
  "sessionToken": "a1b2c3d4e5f6..."  // Required for guest (if not in header)
}
```

**Response:**
```json
{
  "success": true,
  "message": "Item removed from cart successfully",
  "data": { /* removed cart item */ },
  "isGuest": true,
  "sessionToken": "a1b2c3d4e5f6..."
}
```

---

#### 5. Clear Cart

**Endpoint:** `POST /api/cart/clear`

**Authentication:** Optional

**Headers:**
```
Authorization: Bearer <jwt-token>  // Optional
X-Session-Token: <session-token>   // Required for guest
```

**Request Body (Guest):**
```json
{
  "sessionToken": "a1b2c3d4e5f6..."  // Required for guest (if not in header)
}
```

**Response:**
```json
{
  "success": true,
  "message": "Cart cleared successfully. 3 item(s) removed.",
  "data": {
    "deletedCount": 3
  },
  "isGuest": true,
  "sessionToken": "a1b2c3d4e5f6..."
}
```

---

#### 6. Merge Guest Cart to User Cart

**Endpoint:** `POST /api/cart/merge`

**Authentication:** Required (Bearer token)

**Headers:**
```
Authorization: Bearer <jwt-token>  // Required
```

**Request Body:**
```json
{
  "sessionToken": "a1b2c3d4e5f6..."  // Guest session token to merge
}
```

**When to Use:**
- Call this endpoint **after successful login/registration**
- Merges all guest cart items into the user's cart
- If user already has the same product, quantities are added together
- Guest cart is cleared after successful merge

**Response:**
```json
{
  "success": true,
  "message": "Cart merged successfully. 3 item(s) merged, 0 item(s) skipped.",
  "data": {
    "mergedCount": 3,
    "skippedCount": 0
  }
}
```

**Note:** Items may be skipped if:
- Insufficient stock for merged quantity
- Product no longer exists
- Other validation errors

---

### Order Endpoints

#### 1. Create Order from Cart

**Endpoint:** `POST /api/orders`

**Authentication:** Optional

**Headers:**
```
Authorization: Bearer <jwt-token>  // Optional
X-Session-Token: <session-token>   // Required for guest
```

**Request Body (Authenticated User):**
```json
{
  "addressId": 5,
  "deliveryTimeSlot": "10-14"  // Optional: "10-14", "14-18", "18-21", "21-00"
}
```

**Request Body (Guest User):**
```json
{
  "sessionToken": "a1b2c3d4e5f6...",
  "address": {
    "fullName": "John Doe",
    "phoneNumber": "12345678",
    "provinceOrDistrict": "Ulaanbaatar",
    "khorooOrSoum": "Bayanzurkh",
    "street": "Main Street",
    "neighborhood": "Downtown",
    "residentialComplex": "Complex Name",
    "building": "Building 5",
    "entrance": "Entrance A",
    "apartmentNumber": "Apt 101",
    "addressNote": "Ring the doorbell",
    "label": "Home"  // Optional
  },
  "deliveryTimeSlot": "10-14"  // Optional
}
```

**Address Fields (Guest Checkout):**

| Field | Required | Type | Description |
|-------|----------|------|-------------|
| `fullName` | ✅ Yes | string | Recipient's full name |
| `phoneNumber` | ✅ Yes | string | 8-digit phone number |
| `provinceOrDistrict` | ✅ Yes | string | Province or district name |
| `khorooOrSoum` | ✅ Yes | string | Khoroo or soum name |
| `street` | ❌ No | string | Street name |
| `neighborhood` | ❌ No | string | Neighborhood name |
| `residentialComplex` | ❌ No | string | Residential complex name |
| `building` | ❌ No | string | Building number/name |
| `entrance` | ❌ No | string | Entrance number/letter |
| `apartmentNumber` | ❌ No | string | Apartment number |
| `addressNote` | ❌ No | string | Additional delivery notes (max 500 chars) |
| `label` | ❌ No | string | Address label (e.g., "Home", "Work") |

**Response:**
```json
{
  "success": true,
  "message": "Order created successfully",
  "data": {
    "id": 100,
    "userId": null,  // null for guest orders
    "addressId": 50,
    "totalAmount": "59.98",
    "status": "PENDING",
    "deliveryTimeSlot": "10-14",
    "items": [
      {
        "id": 1,
        "productId": 5,
        "quantity": 2,
        "price": "29.99",
        "product": { /* product details */ }
      }
    ],
    "address": { /* address details */ },
    "user": null  // null for guest orders
  },
  "isGuest": true  // or false for authenticated
}
```

**Error Responses:**
```json
{
  "success": false,
  "message": "Cart is empty. Cannot create order.",
  "error": { /* error details */ }
}
```

```json
{
  "success": false,
  "message": "Address object is required for guest checkout",
  "error": { /* error details */ }
}
```

---

#### 2. Buy Now (Already Supports Guest)

**Endpoint:** `POST /api/orders/buy-now`

**Status:** ✅ Already supports guest checkout (no changes needed)

**Request Body (Guest):**
```json
{
  "productId": 5,
  "quantity": 2,
  "sessionToken": "a1b2c3d4e5f6..."  // Optional - creates draft order if not authenticated
}
```

**Note:** This endpoint creates a draft order for guests. Use `POST /api/orders/finalize` to complete the order (requires authentication).

---

#### 3. Get Order History

**Endpoint:** `GET /api/orders`

**Authentication:** Required (Bearer token)

**Status:** ❌ Guest orders are not included in order history (by design)

**Note:** Guest users cannot view their order history. They would need to create an account and link their orders (future enhancement).

---

#### 4. Get Order by ID

**Endpoint:** `GET /api/orders/:id`

**Authentication:** Required (Bearer token)

**Note:** 
- Authenticated users can only view their own orders
- Guest orders can only be viewed by administrators
- Regular users cannot view guest orders even if they know the order ID

---

## Frontend Implementation Guide

### 1. Session Token Storage

```javascript
// Store session token in localStorage
const GUEST_SESSION_KEY = 'guest_session_token';

// Get session token
function getSessionToken() {
  return localStorage.getItem(GUEST_SESSION_KEY);
}

// Save session token
function saveSessionToken(token) {
  localStorage.setItem(GUEST_SESSION_KEY, token);
}

// Clear session token
function clearSessionToken() {
  localStorage.removeItem(GUEST_SESSION_KEY);
}
```

### 2. Making Authenticated vs Guest Requests

```javascript
// Check if user is authenticated
function isAuthenticated() {
  return !!localStorage.getItem('auth_token'); // or however you store JWT
}

// Get request headers
function getRequestHeaders() {
  const headers = {
    'Content-Type': 'application/json'
  };

  // Add authentication token if available
  const authToken = localStorage.getItem('auth_token');
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  // Add session token for guest users
  const sessionToken = getSessionToken();
  if (sessionToken && !authToken) {
    headers['X-Session-Token'] = sessionToken;
  }

  return headers;
}
```

### 3. Add to Cart Example

```javascript
async function addToCart(productId, quantity) {
  const isAuth = isAuthenticated();
  const body = {
    productId,
    quantity
  };

  // Add session token for guest users
  if (!isAuth) {
    const sessionToken = getSessionToken();
    if (sessionToken) {
      body.sessionToken = sessionToken;
    }
  }

  const response = await fetch('/api/cart', {
    method: 'POST',
    headers: getRequestHeaders(),
    body: JSON.stringify(body)
  });

  const data = await response.json();

  // Save session token if returned (for first-time guests)
  if (data.isGuest && data.sessionToken) {
    saveSessionToken(data.sessionToken);
  }

  return data;
}
```

### 4. Get Cart Example

```javascript
async function getCart() {
  const response = await fetch('/api/cart', {
    method: 'GET',
    headers: getRequestHeaders()
  });

  const data = await response.json();

  // Save session token if returned (for first-time guests)
  if (data.isGuest && data.sessionToken) {
    saveSessionToken(data.sessionToken);
  }

  return data.data; // Array of cart items
}
```

### 5. Guest Checkout Example

```javascript
async function createOrder(address, deliveryTimeSlot) {
  const isAuth = isAuthenticated();
  const body = {};

  if (isAuth) {
    // Authenticated user - use addressId
    body.addressId = address.id;
  } else {
    // Guest user - use full address object
    body.sessionToken = getSessionToken();
    body.address = {
      fullName: address.fullName,
      phoneNumber: address.phoneNumber,
      provinceOrDistrict: address.provinceOrDistrict,
      khorooOrSoum: address.khorooOrSoum,
      street: address.street,
      neighborhood: address.neighborhood,
      residentialComplex: address.residentialComplex,
      building: address.building,
      entrance: address.entrance,
      apartmentNumber: address.apartmentNumber,
      addressNote: address.addressNote,
      label: address.label
    };
  }

  if (deliveryTimeSlot) {
    body.deliveryTimeSlot = deliveryTimeSlot;
  }

  const response = await fetch('/api/orders', {
    method: 'POST',
    headers: getRequestHeaders(),
    body: JSON.stringify(body)
  });

  return await response.json();
}
```

### 6. Cart Merging on Login

```javascript
async function handleLogin(authToken) {
  // Save auth token
  localStorage.setItem('auth_token', authToken);

  // Get guest session token
  const guestSessionToken = getSessionToken();

  if (guestSessionToken) {
    try {
      // Merge guest cart into user cart
      const response = await fetch('/api/cart/merge', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          sessionToken: guestSessionToken
        })
      });

      const data = await response.json();
      console.log(`Merged ${data.data.mergedCount} items`);

      // Clear guest session token after successful merge
      clearSessionToken();
    } catch (error) {
      console.error('Failed to merge cart:', error);
      // Don't block login if merge fails
    }
  }

  // Redirect to dashboard or cart
}
```

### 7. Complete Flow Example

```javascript
// User flow: Guest browsing → Add to cart → Checkout → Login → Merge cart

// Step 1: Guest adds item to cart
const addResult = await addToCart(5, 2);
// Response includes sessionToken - save it!

// Step 2: Guest views cart
const cart = await getCart();
// Cart items are returned

// Step 3: Guest proceeds to checkout
const order = await createOrder({
  fullName: "John Doe",
  phoneNumber: "12345678",
  provinceOrDistrict: "Ulaanbaatar",
  khorooOrSoum: "Bayanzurkh",
  // ... other address fields
}, "10-14");

// Step 4: User decides to create account (optional)
// After successful registration/login:
await handleLogin(newAuthToken);
// Cart is automatically merged
```

---

## Error Handling

### Common Error Scenarios

1. **Missing Session Token (Guest)**
   ```json
   {
     "success": false,
     "message": "Session token is required for guest cart operations",
     "error": { /* details */ }
   }
   ```
   **Solution:** Generate new session token or retrieve from localStorage

2. **Insufficient Stock**
   ```json
   {
     "success": false,
     "message": "Insufficient stock. Available: 5, Requested: 10",
     "error": { /* details */ }
   }
   ```
   **Solution:** Show error message, update quantity, or remove item

3. **Empty Cart**
   ```json
   {
     "success": false,
     "message": "Cart is empty. Cannot create order.",
     "error": { /* details */ }
   }
   ```
   **Solution:** Redirect to products page

4. **Invalid Address (Guest Checkout)**
   ```json
   {
     "success": false,
     "message": "Invalid address: Phone number must be exactly 8 digits, Invalid province or district",
     "error": { /* details */ }
   }
   ```
   **Solution:** Show validation errors, highlight invalid fields

---

## Best Practices

### 1. Session Token Management
- ✅ Always save session token when returned in API response
- ✅ Include session token in headers (preferred) or request body
- ✅ Clear session token after successful cart merge on login
- ✅ Don't expose session token in URLs or logs

### 2. User Experience
- ✅ Show "Guest" indicator in cart UI
- ✅ Prompt user to create account for order tracking
- ✅ Automatically merge cart on login (don't ask user)
- ✅ Show merge success message after login

### 3. Error Handling
- ✅ Handle "session token required" errors gracefully
- ✅ Validate address fields before submitting guest checkout
- ✅ Show clear error messages for stock issues
- ✅ Handle network errors and retry logic

### 4. Security
- ✅ Never store sensitive data in session token
- ✅ Use HTTPS for all API requests
- ✅ Validate address data on frontend before submission
- ✅ Don't trust client-side data - server validates everything

---

## Testing Checklist

### Guest Cart Flow
- [ ] Add item to cart as guest (no auth)
- [ ] Verify session token is returned and saved
- [ ] Add multiple items to cart
- [ ] Update item quantity
- [ ] Remove item from cart
- [ ] Clear entire cart
- [ ] Verify cart persists after page refresh

### Guest Checkout Flow
- [ ] Add items to cart as guest
- [ ] Proceed to checkout
- [ ] Fill in address form
- [ ] Submit order
- [ ] Verify order is created successfully
- [ ] Verify order has `userId: null` (guest order)

### Cart Merging Flow
- [ ] Add items to cart as guest
- [ ] Save session token
- [ ] Login/register
- [ ] Verify cart merge endpoint is called
- [ ] Verify guest cart items appear in user cart
- [ ] Verify quantities are merged correctly
- [ ] Verify guest session token is cleared

### Edge Cases
- [ ] Guest adds item, then logs in (cart merge)
- [ ] User adds item, logs out, adds as guest, logs back in
- [ ] Guest checkout with invalid address
- [ ] Guest checkout with insufficient stock
- [ ] Empty cart checkout attempt
- [ ] Multiple browser tabs with same session token

---

## Migration Notes

### Breaking Changes
- ❌ None - All changes are backward compatible
- ✅ Existing authenticated user flows work unchanged
- ✅ All existing API endpoints remain functional

### New Features
- ✅ Guest cart support
- ✅ Guest checkout support
- ✅ Cart merging functionality
- ✅ Session token management

---

## Support & Questions

For questions or issues with the guest checkout implementation, please refer to:
- Main API Documentation: `API_DOCUMENTATION.md`
- Admin API Documentation: `ADMIN_API_DOCUMENTATION.md`
- This document: `GUEST_CHECKOUT_API_DOCUMENTATION.md`

---

**Last Updated:** January 16, 2025
**API Version:** 1.0.0
