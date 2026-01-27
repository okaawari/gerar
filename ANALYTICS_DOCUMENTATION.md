# Revenue Analytics API Documentation

This document provides comprehensive documentation for the Revenue Analytics API endpoints available in the admin dashboard.

## Table of Contents

- [Overview](#overview)
- [Base URL](#base-url)
- [Authentication](#authentication)
- [Endpoints](#endpoints)
  - [Revenue Overview](#1-revenue-overview)
  - [Revenue Trends](#2-revenue-trends)
  - [Revenue by Product](#3-revenue-by-product)
  - [Revenue by Category](#4-revenue-by-category)
  - [Revenue by Customer](#5-revenue-by-customer)
  - [Revenue by Payment Method](#6-revenue-by-payment-method)
  - [Dashboard Summary](#7-dashboard-summary)
- [Data Models](#data-models)
- [Usage Examples](#usage-examples)
- [Best Practices](#best-practices)
- [Common Use Cases](#common-use-cases)

---

## Overview

The Revenue Analytics API provides comprehensive revenue analysis capabilities for the admin dashboard. It includes:

- **Time-based Analysis**: Daily, weekly, monthly, and yearly revenue trends
- **Multi-dimensional Breakdowns**: Analyze revenue by product, category, customer, and payment method
- **Growth Metrics**: Compare current periods with previous periods
- **Dashboard Metrics**: Quick overview of key performance indicators

All analytics are calculated from orders with `paymentStatus = 'PAID'` to show confirmed revenue, unless otherwise specified.

---

## Base URL

```
Development: http://localhost:3000/api/admin/analytics/revenue
Production: [Your production URL]/api/admin/analytics/revenue
```

---

## Authentication

All analytics endpoints require:
- Valid JWT token in the `Authorization` header
- User role must be `ADMIN`

**Request Headers:**
```
Authorization: Bearer <your-jwt-token>
Content-Type: application/json
```

---

## Endpoints

### 1. Revenue Overview

Get high-level revenue metrics including totals, breakdowns by status, and optional comparison with previous period.

**Endpoint:** `GET /api/admin/analytics/revenue/overview`

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `startDate` | string | No | Start date (ISO 8601: `2026-01-01` or `2026-01-01T00:00:00Z`) |
| `endDate` | string | No | End date (ISO 8601: `2026-01-31` or `2026-01-31T23:59:59Z`) |
| `compareWithPrevious` | boolean | No | Compare with previous period (`true`/`false`) |

**Example Request:**
```bash
GET /api/admin/analytics/revenue/overview?startDate=2026-01-01&endDate=2026-01-31&compareWithPrevious=true
```

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Revenue overview retrieved successfully",
  "data": {
    "allTime": {
      "totalRevenue": 125000.50,
      "totalOrders": 1250
    },
    "period": {
      "totalRevenue": 15000.75,
      "totalOrders": 150,
      "averageOrderValue": 100.01
    },
    "revenueByStatus": [
      {
        "status": "PAID",
        "revenue": 12000.50,
        "orderCount": 120
      },
      {
        "status": "PENDING",
        "revenue": 3000.25,
        "orderCount": 30
      },
      {
        "status": "CANCELLED",
        "revenue": 0.00,
        "orderCount": 0
      }
    ],
    "revenueByPaymentStatus": [
      {
        "paymentStatus": "PAID",
        "revenue": 12000.50,
        "orderCount": 120
      },
      {
        "paymentStatus": "PENDING",
        "revenue": 3000.25,
        "orderCount": 30
      }
    ],
    "orderCountsByStatus": [
      {
        "status": "PAID",
        "count": 120
      },
      {
        "status": "PENDING",
        "count": 30
      }
    ],
    "comparison": {
      "previousPeriod": {
        "startDate": "2025-12-01",
        "endDate": "2025-12-31",
        "totalRevenue": 10000.00,
        "totalOrders": 100
      },
      "growth": {
        "percentage": 50.00,
        "absolute": 5000.75,
        "isPositive": true
      }
    }
  },
  "meta": {
    "startDate": "2026-01-01",
    "endDate": "2026-01-31",
    "compareWithPrevious": true
  }
}
```

**Use Cases:**
- Dashboard overview cards
- Period-over-period comparison
- Revenue health check
- Order status analysis

---

### 2. Revenue Trends

Get time-series revenue data for charts and trend visualization.

**Endpoint:** `GET /api/admin/analytics/revenue/trends`

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `period` | string | Yes | Time grouping: `daily`, `weekly`, `monthly`, `yearly` |
| `startDate` | string | Yes | Start date (ISO 8601 format) |
| `endDate` | string | Yes | End date (ISO 8601 format) |
| `groupBy` | string | No | Additional grouping: `status`, `paymentStatus` |

**Example Requests:**
```bash
# Daily trends for January 2026
GET /api/admin/analytics/revenue/trends?period=daily&startDate=2026-01-01&endDate=2026-01-31

# Monthly trends for 2026
GET /api/admin/analytics/revenue/trends?period=monthly&startDate=2026-01-01&endDate=2026-12-31

# Weekly trends grouped by payment status
GET /api/admin/analytics/revenue/trends?period=weekly&startDate=2026-01-01&endDate=2026-01-31&groupBy=paymentStatus
```

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Revenue trends retrieved successfully",
  "data": [
    {
      "date": "2026-01-01",
      "revenue": 1500.50,
      "orderCount": 15,
      "averageOrderValue": 100.03
    },
    {
      "date": "2026-01-02",
      "revenue": 2000.75,
      "orderCount": 20,
      "averageOrderValue": 100.04
    },
    {
      "date": "2026-01-03",
      "revenue": 1800.25,
      "orderCount": 18,
      "averageOrderValue": 100.01
    }
  ],
  "meta": {
    "period": "daily",
    "startDate": "2026-01-01",
    "endDate": "2026-01-31",
    "groupBy": null
  }
}
```

**When `groupBy` is used:**
```json
{
  "data": [
    {
      "date": "2026-01-01",
      "revenue": 1200.00,
      "orderCount": 12,
      "averageOrderValue": 100.00,
      "paymentStatus": "PAID"
    },
    {
      "date": "2026-01-01",
      "revenue": 300.50,
      "orderCount": 3,
      "averageOrderValue": 100.17,
      "paymentStatus": "PENDING"
    }
  ]
}
```

**Use Cases:**
- Line charts showing revenue over time
- Trend analysis and forecasting
- Identifying peak sales periods
- Comparing revenue by status

---

### 3. Revenue by Product

Get top products by revenue with sorting and pagination.

**Endpoint:** `GET /api/admin/analytics/revenue/products`

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `startDate` | string | No | Start date for filtering |
| `endDate` | string | No | End date for filtering |
| `limit` | number | No | Number of results (default: 10, max: 100) |
| `sortBy` | string | No | Sort field: `revenue`, `quantity`, `orders` (default: `revenue`) |
| `sortOrder` | string | No | Sort direction: `asc`, `desc` (default: `desc`) |

**Example Requests:**
```bash
# Top 10 products by revenue
GET /api/admin/analytics/revenue/products

# Top 20 products by quantity sold
GET /api/admin/analytics/revenue/products?limit=20&sortBy=quantity&sortOrder=desc

# Top products for January 2026
GET /api/admin/analytics/revenue/products?startDate=2026-01-01&endDate=2026-01-31&limit=15
```

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Revenue by product retrieved successfully",
  "data": {
    "products": [
      {
        "productId": 1,
        "productName": "Laptop",
        "revenue": 5000.00,
        "quantity": 5,
        "orderCount": 5,
        "averageOrderValue": 1000.00
      },
      {
        "productId": 2,
        "productName": "Wireless Mouse",
        "revenue": 3000.00,
        "quantity": 30,
        "orderCount": 25,
        "averageOrderValue": 120.00
      },
      {
        "productId": 3,
        "productName": "Keyboard",
        "revenue": 2000.00,
        "quantity": 20,
        "orderCount": 18,
        "averageOrderValue": 111.11
      }
    ],
    "total": 3
  },
  "meta": {
    "startDate": null,
    "endDate": null,
    "limit": 10,
    "sortBy": "revenue",
    "sortOrder": "desc"
  }
}
```

**Use Cases:**
- Best-selling products list
- Product performance analysis
- Inventory planning
- Marketing campaign effectiveness

---

### 4. Revenue by Category

Get revenue breakdown by product categories with optional subcategory aggregation.

**Endpoint:** `GET /api/admin/analytics/revenue/categories`

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `startDate` | string | No | Start date for filtering |
| `endDate` | string | No | End date for filtering |
| `includeSubcategories` | boolean | No | Include child category revenue in parent (`true`/`false`) |

**Example Requests:**
```bash
# All categories with separate revenue
GET /api/admin/analytics/revenue/categories

# Categories with subcategory revenue included in parent
GET /api/admin/analytics/revenue/categories?includeSubcategories=true

# Categories for specific period
GET /api/admin/analytics/revenue/categories?startDate=2026-01-01&endDate=2026-01-31
```

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Revenue by category retrieved successfully",
  "data": {
    "categories": [
      {
        "categoryId": 1,
        "categoryName": "Electronics",
        "parentId": null,
        "revenue": 10000.00,
        "orderCount": 100,
        "productCount": 25,
        "averageOrderValue": 100.00
      },
      {
        "categoryId": 2,
        "categoryName": "Computers",
        "parentId": 1,
        "revenue": 5000.00,
        "orderCount": 50,
        "productCount": 10,
        "averageOrderValue": 100.00
      },
      {
        "categoryId": 3,
        "categoryName": "Accessories",
        "parentId": 1,
        "revenue": 3000.00,
        "orderCount": 30,
        "productCount": 8,
        "averageOrderValue": 100.00
      }
    ],
    "total": 3
  },
  "meta": {
    "startDate": null,
    "endDate": null,
    "includeSubcategories": false
  }
}
```

**When `includeSubcategories=true`:**
Parent categories will include revenue from their child categories in addition to their own direct revenue.

**Use Cases:**
- Category performance dashboard
- Category-based marketing decisions
- Inventory allocation by category
- Category trend analysis

---

### 5. Revenue by Customer

Get top customers by revenue with sorting and pagination.

**Endpoint:** `GET /api/admin/analytics/revenue/customers`

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `startDate` | string | No | Start date for filtering |
| `endDate` | string | No | End date for filtering |
| `limit` | number | No | Number of results (default: 10, max: 100) |
| `sortBy` | string | No | Sort field: `revenue`, `orders`, `avgOrderValue` (default: `revenue`) |
| `sortOrder` | string | No | Sort direction: `asc`, `desc` (default: `desc`) |

**Example Requests:**
```bash
# Top 10 customers by revenue
GET /api/admin/analytics/revenue/customers

# Top 20 customers by number of orders
GET /api/admin/analytics/revenue/customers?limit=20&sortBy=orders&sortOrder=desc

# Top customers for January 2026
GET /api/admin/analytics/revenue/customers?startDate=2026-01-01&endDate=2026-01-31
```

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Revenue by customer retrieved successfully",
  "data": {
    "customers": [
      {
        "userId": 1,
        "userName": "John Doe",
        "phoneNumber": "12345678",
        "email": "john@example.com",
        "totalRevenue": 5000.00,
        "orderCount": 10,
        "averageOrderValue": 500.00
      },
      {
        "userId": 2,
        "userName": "Jane Smith",
        "phoneNumber": "87654321",
        "email": "jane@example.com",
        "totalRevenue": 3000.00,
        "orderCount": 5,
        "averageOrderValue": 600.00
      }
    ],
    "total": 2
  },
  "meta": {
    "startDate": null,
    "endDate": null,
    "limit": 10,
    "sortBy": "revenue",
    "sortOrder": "desc"
  }
}
```

**Notes:**
- Only includes authenticated users (excludes guest orders)
- Email may be `null` for users who didn't provide email during registration

**Use Cases:**
- Customer loyalty programs
- VIP customer identification
- Customer lifetime value analysis
- Personalized marketing campaigns

---

### 6. Revenue by Payment Method

Get revenue breakdown by payment method with percentages.

**Endpoint:** `GET /api/admin/analytics/revenue/payment-methods`

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `startDate` | string | No | Start date for filtering |
| `endDate` | string | No | End date for filtering |

**Example Requests:**
```bash
# All payment methods
GET /api/admin/analytics/revenue/payment-methods

# Payment methods for January 2026
GET /api/admin/analytics/revenue/payment-methods?startDate=2026-01-01&endDate=2026-01-31
```

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Revenue by payment method retrieved successfully",
  "data": {
    "paymentMethods": [
      {
        "paymentMethod": "QPAY",
        "revenue": 10000.00,
        "orderCount": 100,
        "percentage": 80.00,
        "averageOrderValue": 100.00
      },
      {
        "paymentMethod": "CASH",
        "revenue": 2500.00,
        "orderCount": 25,
        "percentage": 20.00,
        "averageOrderValue": 100.00
      }
    ],
    "total": 2,
    "totalRevenue": 12500.00
  },
  "meta": {
    "startDate": null,
    "endDate": null
  }
}
```

**Use Cases:**
- Payment method preference analysis
- Payment processing optimization
- Payment method adoption tracking
- Revenue distribution visualization

---

### 7. Dashboard Summary

Get comprehensive dashboard overview with all key metrics in a single request.

**Endpoint:** `GET /api/admin/analytics/revenue/dashboard`

**No Query Parameters Required**

**Example Request:**
```bash
GET /api/admin/analytics/revenue/dashboard
```

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Dashboard summary retrieved successfully",
  "data": {
    "periods": {
      "today": {
        "revenue": 500.00,
        "orders": 5,
        "comparison": {
          "percentage": 25.00,
          "absolute": 100.00,
          "isPositive": true
        }
      },
      "thisWeek": {
        "revenue": 3500.00,
        "orders": 35,
        "comparison": {
          "percentage": 16.67,
          "absolute": 500.00,
          "isPositive": true
        }
      },
      "thisMonth": {
        "revenue": 15000.00,
        "orders": 150,
        "comparison": {
          "percentage": 50.00,
          "absolute": 5000.00,
          "isPositive": true
        }
      },
      "thisYear": {
        "revenue": 125000.00,
        "orders": 1250,
        "comparison": {
          "percentage": 25.00,
          "absolute": 25000.00,
          "isPositive": true
        }
      }
    },
    "topProducts": [
      {
        "productId": 1,
        "productName": "Laptop",
        "revenue": 5000.00,
        "quantity": 5,
        "orderCount": 5,
        "averageOrderValue": 1000.00
      },
      {
        "productId": 2,
        "productName": "Wireless Mouse",
        "revenue": 3000.00,
        "quantity": 30,
        "orderCount": 25,
        "averageOrderValue": 120.00
      }
    ],
    "topCategories": [
      {
        "categoryId": 1,
        "categoryName": "Electronics",
        "parentId": null,
        "revenue": 10000.00,
        "orderCount": 100,
        "productCount": 25,
        "averageOrderValue": 100.00
      }
    ],
    "trend": [
      {
        "date": "2026-01-20",
        "revenue": 500.00,
        "orderCount": 5,
        "averageOrderValue": 100.00
      },
      {
        "date": "2026-01-21",
        "revenue": 600.00,
        "orderCount": 6,
        "averageOrderValue": 100.00
      }
    ]
  }
}
```

**Use Cases:**
- Main dashboard page
- Executive summary
- Quick performance overview
- Real-time monitoring

---

## Data Models

### Revenue Overview Response
```typescript
interface RevenueOverview {
  allTime: {
    totalRevenue: number;
    totalOrders: number;
  };
  period: {
    totalRevenue: number;
    totalOrders: number;
    averageOrderValue: number;
  };
  revenueByStatus: Array<{
    status: string;
    revenue: number;
    orderCount: number;
  }>;
  revenueByPaymentStatus: Array<{
    paymentStatus: string;
    revenue: number;
    orderCount: number;
  }>;
  orderCountsByStatus: Array<{
    status: string;
    count: number;
  }>;
  comparison?: {
    previousPeriod: {
      startDate: string;
      endDate: string;
      totalRevenue: number;
      totalOrders: number;
    };
    growth: {
      percentage: number;
      absolute: number;
      isPositive: boolean;
    };
  };
}
```

### Trend Data Point
```typescript
interface TrendDataPoint {
  date: string;
  revenue: number;
  orderCount: number;
  averageOrderValue: number;
  status?: string;           // When groupBy='status'
  paymentStatus?: string;    // When groupBy='paymentStatus'
}
```

### Product Revenue
```typescript
interface ProductRevenue {
  productId: number;
  productName: string;
  revenue: number;
  quantity: number;
  orderCount: number;
  averageOrderValue: number;
}
```

### Category Revenue
```typescript
interface CategoryRevenue {
  categoryId: number;
  categoryName: string;
  parentId: number | null;
  revenue: number;
  orderCount: number;
  productCount: number;
  averageOrderValue: number;
}
```

### Customer Revenue
```typescript
interface CustomerRevenue {
  userId: number;
  userName: string;
  phoneNumber: string;
  email: string | null;
  totalRevenue: number;
  orderCount: number;
  averageOrderValue: number;
}
```

### Payment Method Revenue
```typescript
interface PaymentMethodRevenue {
  paymentMethod: string;
  revenue: number;
  orderCount: number;
  percentage: number;
  averageOrderValue: number;
}
```

---

## Usage Examples

### JavaScript (Fetch API)

#### Get Dashboard Summary
```javascript
async function getDashboardSummary() {
  const response = await fetch('http://localhost:3000/api/admin/analytics/revenue/dashboard', {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${yourJwtToken}`,
      'Content-Type': 'application/json'
    }
  });
  
  const data = await response.json();
  
  if (data.success) {
    console.log('Today\'s Revenue:', data.data.periods.today.revenue);
    console.log('Top Products:', data.data.topProducts);
    console.log('Trend:', data.data.trend);
  }
}
```

#### Get Revenue Trends
```javascript
async function getRevenueTrends(startDate, endDate) {
  const url = new URL('http://localhost:3000/api/admin/analytics/revenue/trends');
  url.searchParams.append('period', 'daily');
  url.searchParams.append('startDate', startDate);
  url.searchParams.append('endDate', endDate);
  
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${yourJwtToken}`,
      'Content-Type': 'application/json'
    }
  });
  
  const data = await response.json();
  
  if (data.success) {
    // Use data.data for chart visualization
    return data.data;
  }
}
```

#### Get Top Products
```javascript
async function getTopProducts(limit = 10) {
  const url = new URL('http://localhost:3000/api/admin/analytics/revenue/products');
  url.searchParams.append('limit', limit);
  url.searchParams.append('sortBy', 'revenue');
  url.searchParams.append('sortOrder', 'desc');
  
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${yourJwtToken}`,
      'Content-Type': 'application/json'
    }
  });
  
  const data = await response.json();
  
  if (data.success) {
    return data.data.products;
  }
}
```

### Axios

#### Get Revenue Overview with Comparison
```javascript
import axios from 'axios';

async function getRevenueOverview(startDate, endDate) {
  try {
    const response = await axios.get(
      'http://localhost:3000/api/admin/analytics/revenue/overview',
      {
        params: {
          startDate,
          endDate,
          compareWithPrevious: true
        },
        headers: {
          'Authorization': `Bearer ${yourJwtToken}`
        }
      }
    );
    
    const { data } = response.data;
    
    console.log('Period Revenue:', data.period.totalRevenue);
    console.log('Growth:', data.comparison.growth.percentage + '%');
    
    return data;
  } catch (error) {
    console.error('Error fetching revenue overview:', error);
  }
}
```

### React Hook Example

```javascript
import { useState, useEffect } from 'react';

function useRevenueDashboard() {
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  useEffect(() => {
    async function fetchDashboard() {
      try {
        const response = await fetch(
          'http://localhost:3000/api/admin/analytics/revenue/dashboard',
          {
            headers: {
              'Authorization': `Bearer ${yourJwtToken}`
            }
          }
        );
        
        const data = await response.json();
        
        if (data.success) {
          setDashboard(data.data);
        } else {
          setError('Failed to load dashboard');
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    
    fetchDashboard();
  }, []);
  
  return { dashboard, loading, error };
}

// Usage in component
function Dashboard() {
  const { dashboard, loading, error } = useRevenueDashboard();
  
  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;
  
  return (
    <div>
      <h2>Today's Revenue: ${dashboard.periods.today.revenue}</h2>
      <h3>Top Products</h3>
      <ul>
        {dashboard.topProducts.map(product => (
          <li key={product.productId}>
            {product.productName}: ${product.revenue}
          </li>
        ))}
      </ul>
    </div>
  );
}
```

---

## Best Practices

### 1. Date Formatting
Always use ISO 8601 format for dates:
- ✅ `2026-01-01`
- ✅ `2026-01-01T00:00:00Z`
- ❌ `01/01/2026`
- ❌ `January 1, 2026`

### 2. Caching
- Cache dashboard summary data for 5-15 minutes
- Cache trend data for 1-5 minutes depending on period
- Invalidate cache when new orders are created

### 3. Error Handling
Always check the `success` field before using data:
```javascript
if (response.data.success) {
  // Use response.data.data
} else {
  // Handle error
}
```

### 4. Pagination
- Use appropriate `limit` values (default: 10, max: 100)
- For large datasets, consider implementing frontend pagination

### 5. Performance
- Use dashboard summary endpoint for initial page load
- Load detailed analytics on-demand
- Use date ranges appropriately (avoid very large ranges for daily trends)

### 6. Date Ranges
- **Daily trends**: Max 90 days recommended
- **Weekly trends**: Max 52 weeks (1 year) recommended
- **Monthly trends**: Max 24 months (2 years) recommended
- **Yearly trends**: No practical limit

---

## Common Use Cases

### 1. Dashboard Overview Page
```javascript
// Load dashboard summary on page load
const dashboard = await getDashboardSummary();

// Display:
// - Today/Week/Month/Year revenue cards
// - Top 5 products table
// - Top 5 categories table
// - 7-day trend chart
```

### 2. Revenue Trend Chart
```javascript
// Get last 30 days of daily revenue
const trends = await getRevenueTrends(
  getDate30DaysAgo(),
  getToday()
);

// Render line chart with:
// - X-axis: dates
// - Y-axis: revenue
```

### 3. Product Performance Report
```javascript
// Get top 20 products for current month
const products = await getTopProducts({
  startDate: getMonthStart(),
  endDate: getToday(),
  limit: 20,
  sortBy: 'revenue'
});

// Display in table with sorting options
```

### 4. Category Analysis
```javascript
// Get category breakdown with subcategories
const categories = await getRevenueByCategory({
  startDate: getYearStart(),
  endDate: getToday(),
  includeSubcategories: true
});

// Render pie chart or bar chart
```

### 5. Customer Segmentation
```javascript
// Get top customers by average order value
const customers = await getRevenueByCustomer({
  limit: 50,
  sortBy: 'avgOrderValue',
  sortOrder: 'desc'
});

// Identify VIP customers for special offers
```

### 6. Payment Method Analysis
```javascript
// Get payment method breakdown
const paymentMethods = await getRevenueByPaymentMethod({
  startDate: getMonthStart(),
  endDate: getToday()
});

// Display pie chart showing payment method distribution
```

### 7. Period Comparison
```javascript
// Compare this month with last month
const overview = await getRevenueOverview({
  startDate: getMonthStart(),
  endDate: getToday(),
  compareWithPrevious: true
});

// Display growth percentage and absolute change
```

---

## Error Handling

All endpoints return standard error responses:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Error message"
  },
  "timestamp": "2026-01-27T10:30:00.000Z"
}
```

**Common Error Codes:**
- `401` - Unauthorized (missing or invalid token)
- `403` - Forbidden (user is not admin)
- `400` - Bad Request (invalid parameters)
- `500` - Internal Server Error

**Example Error Handling:**
```javascript
try {
  const response = await fetch(url, options);
  const data = await response.json();
  
  if (!data.success) {
    console.error('API Error:', data.error.message);
    // Handle error appropriately
  }
} catch (error) {
  console.error('Network Error:', error);
  // Handle network error
}
```

---

## Notes

1. **Revenue Calculation**: All revenue values are calculated from orders with `paymentStatus = 'PAID'` unless otherwise specified in the endpoint documentation.

2. **Guest Orders**: Customer analytics exclude guest orders (orders without `userId`).

3. **Date Handling**: All dates are handled in UTC. Ensure your frontend converts to local timezone for display.

4. **Decimal Precision**: Revenue values are returned with 2 decimal places. Use `parseFloat()` when performing calculations.

5. **Empty Results**: Endpoints return empty arrays `[]` when no data matches the criteria, not `null` or errors.

6. **Performance**: For large date ranges, consider:
   - Using weekly/monthly periods instead of daily
   - Limiting result sets with appropriate `limit` values
   - Implementing server-side caching

---

*Last Updated: January 2026*
