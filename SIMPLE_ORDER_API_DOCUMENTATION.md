# Simple Order API Documentation

## Overview

The **Simple Order** flow is a streamlined checkout process designed for speed and ease of use. It allows users to place orders using only their **phone number** and **address**, verified via a **4-digit OTP code**. 

### Key Features
- ✅ **2-Step Flow**: Request OTP → Create Order.
- ✅ **4-Digit OTP**: Simple verification (unlike the standard 6-digit flow).
- ✅ **Lightweight Address**: Uses two simple text fields instead of the complex district/khoroo system.
- ✅ **Cart Integration**: Automatically processes items currently in the user's or guest's cart.
- ✅ **Separate Storage**: Orders are stored in a dedicated `simpleorder` table, keeping them separate from complex orders.

---

## The 2-Step Flow

### Step 1: Request OTP

Before creating an order, the frontend must request a 4-digit verification code to be sent to the user's phone.

**Endpoint:** `POST /api/simple-orders/send-otp`

**Authentication:** Public

**Request Body:**
```json
{
  "phoneNumber": "88991122"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Нэг удаагийн код амжилттай илгээгдлээ.",
  "data": {
    "expiresAt": "2026-04-08T03:40:00.000Z",
    "expiresInMinutes": 10
  }
}
```

---

### Step 2: Create Simple Order

Once the user receives the 4-digit code, the frontend sends the order details along with the code to finalize the order.

**Endpoint:** `POST /api/simple-orders/create`

**Authentication:** Optional (Bearer token for logged-in users, Session token for guests)

**Headers:**
```
Authorization: Bearer <jwt-token>  // Optional
X-Session-Token: <session-token>   // Optional (Required for guests)
```

**Request Body:**
```json
{
  "phoneNumber": "88991122",
  "otpCode": "1234",
  "address": "Баянзүрх дүүрэг, 13-р хороолол",
  "addressNote": "24-р байр, 1-р орц, 5 тоот (Домофон: 5#)",
  "sessionToken": "guest-session-token-xyz" // Optional if provided in header
}
```

**What Happens on the Server:**
1. **OTP Verification**: The 4-digit code is verified against the phone number.
2. **Cart Retrieval**: The server gets all items from the current cart (guest or user).
3. **Filtering**: Only **regular products** are included; point-based reward products are ignored.
4. **Stock Validation**: Checks if items are still in stock.
5. **Atomic Transaction**:
   - Creates the order in the `simpleorder` table.
   - Creates order items in the `simpleorderitem` table.
   - Deducts product stock.
   - **Clears the cart** upon success.

**Response:**
```json
{
  "success": true,
  "message": "Захиалга амжилттай хийгдлээ.",
  "data": {
    "id": 1,
    "phoneNumber": "88991122",
    "address": "...",
    "addressNote": "...",
    "totalAmount": "150000.00",
    "status": "PENDING",
    "items": [
      {
        "id": 1,
        "productId": 5,
        "quantity": 2,
        "price": "75000.00",
        "product": { "name": "...", "price": "75000.00", ... }
      }
    ]
  }
}
```

---

## Frontend Implementation Guide

### 1. Handling the Flow (JavaScript Example)

```javascript
// Step 1: User enters phone and clicks "Send Code"
async function handleSendOTP(phone) {
  const response = await fetch('/api/simple-orders/send-otp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phoneNumber: phone })
  });
  const result = await response.json();
  if (result.success) {
    // Show OTP input field to user
  }
}

// Step 2: User enters OTP and address, then clicks "Confirm Order"
async function handleCreateOrder(orderDetails) {
  const { phone, otp, address, note } = orderDetails;
  
  // Get guest session token from localStorage if applicable
  const sessionToken = localStorage.getItem('guest_session_token');
  
  const response = await fetch('/api/simple-orders/create', {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'X-Session-Token': sessionToken 
    },
    body: JSON.stringify({
      phoneNumber: phone,
      otpCode: otp,
      address: address,
      addressNote: note
    })
  });
  
  const result = await response.json();
  if (result.success) {
    // Redirect to success page, clear cart in frontend state
    alert('Захиалга амжилттай!');
  } else {
    alert(result.message); // e.g., "OTP code is incorrect"
  }
}
```

---

## Important Rules & Constraints

1. **Regular Products Only**: The Simple Order flow only processes standard products. If a user has "Point Products" (items paid with loyalty points) in their cart, those items will be ignored during this specific checkout flow.
2. **OTP Usage**: The OTP code is valid for 10 minutes and can only be used once.
3. **Cart Clearing**: Upon successful order creation, the **entire cart** associated with the session/user is cleared.
4. **Guest vs. User**: 
   - If the user is logged in, the order will be linked to their `userId`.
   - If the user is a guest, the order is linked to their `sessionToken` (if provided in headers or body).
5. **Address Separation**: Diligently provide `address` for the primary location and `addressNote` for delivery specifics (door code, floor, landmarks).

---

## Error Codes

| Code | Message | Description |
| :--- | :--- | :--- |
| `400` | Нэг удаагийн код буруу байна. | The OTP code entered does not match or is expired. |
| `400` | Сагс хоосон байна. | The user attempted to checkout with nothing in their cart. |
| `400` | Барааны үлдэгдэл хүрэлцэхгүй байна. | One or more items in the cart are no longer available in the requested quantity. |
| `429` | Хэтэрхий олон удаа хүсэлт илгээсэн байна. | The user has requested too many OTPs in a short period (Rate limited). |
