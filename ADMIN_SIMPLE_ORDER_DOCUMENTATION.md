# Admin Simple Order API Documentation

## Overview

Administrators have full access to manage the **Simple Order** flow. This includes viewing a consolidated list of all simple orders, checking individual order details, and updating their status.

The routes for admin management are sequestered under the `/api/admin/simple-orders/` prefix to ensure security and logical separation.

---

## Admin API Endpoints

### 1. Get All Simple Orders

Retrieve a complete list of all simple orders placed through the system, including their items and associated products.

**Endpoint:** `GET /api/admin/simple-orders/all`

**Authentication:** Required (Admin Role)

**Response:**
```json
{
  "success": true,
  "message": "Бүх simple захиалгыг авлаа.",
  "data": [
    {
      "id": 5,
      "phoneNumber": "88991122",
      "address": "...",
      "totalAmount": "45000.00",
      "status": "PENDING",
      "createdAt": "2026-04-08T03:30:00.000Z",
      "items": [
        {
          "productId": 10,
          "quantity": 1,
          "price": "45000.00",
          "product": { "name": "Example Product", ... }
        }
      ]
    },
    // ... more orders
  ]
}
```

---

### 2. Get Single Order Details

Get detailed information for a specific simple order by its ID.

**Endpoint:** `GET /api/admin/simple-orders/:id`

**Authentication:** Required (Admin Role)

**Response:**
```json
{
  "success": true,
  "message": "Захиалгын дэлгэрэнгүйг авлаа.",
  "data": {
    "id": 5,
    "phoneNumber": "88991122",
    "address": "...",
    "addressNote": "Added via frontend note field",
    "totalAmount": "45000.00",
    "status": "PENDING",
    "createdAt": "...",
    "items": [ ... ]
  }
}
```

---

### 3. Update Order Status

Update the status of a simple order as it moves through the fulfillment process.

**Endpoint:** `POST /api/admin/simple-orders/:id/status`

**Authentication:** Required (Admin Role)

**Request Body:**
```json
{
  "status": "DELIVERED"
}
```

**Common Status Values:**
- `PENDING`: Initial state after creation.
- `PROCESSING`: Order is being prepared.
- `DELIVERING`: Order is out for delivery.
- `DELIVERED`: Order has been successfully completed.
- `CANCELLED`: Order was aborted.

**Response:**
```json
{
  "success": true,
  "message": "Захиалгын төлөв амжилттай шинэчлэгдлээ.",
  "data": {
    "id": 5,
    "status": "DELIVERED",
    // ... updated order details
  }
}
```

---

## Best Practices for Admin Dashboard

1. **Auto-Refresh**: Monitor the `/all` endpoint or use a polling mechanism to alert staff when a new `PENDING` simple order arrives.
2. **Contacting Users**: Use the `phoneNumber` field to call or SMS the customer if there are questions about the `address` or `addressNote`.
3. **Fulfillment**: Once an order is delivered, diligently update the status to `DELIVERED` to keep the order list clean and reports accurate.

---

## Error Handling

| Code | Message | Description |
| :--- | :--- | :--- |
| `401` | Authentication required | Admin token is missing or invalid. |
| `403` | Access denied. Admin privileges required. | User is authenticated but does not have the ADMIN or SUPER_ADMIN role. |
| `404` | Захиалга олдсонгүй. | The specified order ID does not exist in the `simpleorder` table. |
