# QPay QR Code Expiry - Frontend Integration Examples

## Overview

QPay QR codes now expire after **1 hour** from creation. This document provides examples and code snippets for frontend integration.

## API Response Structure

### 1. Initiate Payment Response

**Endpoint:** `POST /api/orders/:id/initiate-payment`

**Success Response (201 Created):**
```json
{
  "success": true,
  "message": "Payment invoice created successfully",
  "data": {
    "orderId": 123,
    "qpayInvoiceId": "f68db12b-260f-427f-afa2-c83064aee76a",
    "qrCode": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...",
    "qrText": "https://qpay.mn/invoice/f68db12b-260f-427f-afa2-c83064aee76a",
    "urls": {
      "web": "https://qpay.mn/invoice/f68db12b-260f-427f-afa2-c83064aee76a",
      "deeplink": "qpay://invoice/f68db12b-260f-427f-afa2-c83064aee76a"
    },
    "paymentStatus": "PENDING",
    "amount": 20000.00,
    "expiryDate": "2026-01-26T15:30:00.000Z",
    "isExpired": false
  }
}
```

**Existing Invoice Response (200 OK):**
```json
{
  "success": true,
  "message": "Payment invoice already exists",
  "data": {
    "orderId": 123,
    "qpayInvoiceId": "f68db12b-260f-427f-afa2-c83064aee76a",
    "paymentStatus": "PENDING",
    "qrCode": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...",
    "qrText": "https://qpay.mn/invoice/f68db12b-260f-427f-afa2-c83064aee76a",
    "urls": {
      "web": "https://qpay.mn/invoice/f68db12b-260f-427f-afa2-c83064aee76a",
      "deeplink": "qpay://invoice/f68db12b-260f-427f-afa2-c83064aee76a"
    },
    "amount": 20000.00,
    "expiryDate": "2026-01-26T15:30:00.000Z",
    "isExpired": false
  }
}
```

### 2. Get Payment Status Response

**Endpoint:** `GET /api/orders/:id/payment-status`

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "orderId": 123,
    "paymentStatus": "PENDING",
    "qpayInvoiceId": "f68db12b-260f-427f-afa2-c83064aee76a",
    "qpayPaymentId": null,
    "paidAt": null,
    "paymentMethod": null,
    "qpayStatus": null,
    "ebarimtId": null,
    "shouldStopPolling": false,
    "message": "Payment pending"
  }
}
```

**Note:** Payment status endpoint doesn't include expiry info. Use the initiate-payment response for expiry details.

---

## Frontend Implementation Examples

### React/Next.js Example

```jsx
import { useState, useEffect } from 'react';

function PaymentQRCode({ orderId }) {
  const [paymentData, setPaymentData] = useState(null);
  const [timeRemaining, setTimeRemaining] = useState(null);
  const [isExpired, setIsExpired] = useState(false);
  const [error, setError] = useState(null);

  // Initiate payment
  const initiatePayment = async () => {
    try {
      const response = await fetch(`/api/orders/${orderId}/initiate-payment`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const result = await response.json();
      
      if (result.success) {
        setPaymentData(result.data);
        setIsExpired(result.data.isExpired);
        
        // Start countdown timer if not expired
        if (!result.data.isExpired && result.data.expiryDate) {
          startCountdown(result.data.expiryDate);
        }
      } else {
        setError(result.message);
      }
    } catch (err) {
      setError('Failed to initiate payment');
      console.error(err);
    }
  };

  // Countdown timer
  const startCountdown = (expiryDate) => {
    const updateTimer = () => {
      const now = new Date();
      const expiry = new Date(expiryDate);
      const diff = expiry - now;

      if (diff <= 0) {
        setIsExpired(true);
        setTimeRemaining(null);
        return;
      }

      const minutes = Math.floor(diff / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);
      setTimeRemaining(`${minutes}:${seconds.toString().padStart(2, '0')}`);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  };

  // Check expiry status
  const checkExpiry = () => {
    if (!paymentData?.expiryDate) return false;
    return new Date(paymentData.expiryDate) < new Date();
  };

  useEffect(() => {
    initiatePayment();
  }, [orderId]);

  if (error) {
    return <div className="error">Error: {error}</div>;
  }

  if (!paymentData) {
    return <div>Loading...</div>;
  }

  if (isExpired || checkExpiry()) {
    return (
      <div className="expired-message">
        <h3>QR Code Expired</h3>
        <p>This payment QR code has expired. Please create a new payment.</p>
        <button onClick={initiatePayment}>Create New Payment</button>
      </div>
    );
  }

  return (
    <div className="payment-qr">
      <h3>Scan QR Code to Pay</h3>
      
      {/* QR Code Image */}
      <img 
        src={paymentData.qrCode} 
        alt="QPay QR Code"
        className="qr-code-image"
      />
      
      {/* Expiry Countdown */}
      {timeRemaining && (
        <div className="expiry-timer">
          <p>⏰ Expires in: {timeRemaining}</p>
        </div>
      )}
      
      {/* Amount */}
      <p className="amount">
        Amount: {paymentData.amount.toLocaleString()} MNT
      </p>
      
      {/* Alternative Links */}
      <div className="payment-links">
        <a 
          href={paymentData.urls?.web} 
          target="_blank" 
          rel="noopener noreferrer"
        >
          Open in Browser
        </a>
        <a href={paymentData.urls?.deeplink}>
          Open in QPay App
        </a>
      </div>
    </div>
  );
}
```

### Vanilla JavaScript Example

```javascript
class PaymentQRManager {
  constructor(orderId, token) {
    this.orderId = orderId;
    this.token = token;
    this.paymentData = null;
    this.countdownInterval = null;
  }

  async initiatePayment() {
    try {
      const response = await fetch(`/api/orders/${this.orderId}/initiate-payment`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json'
        }
      });

      const result = await response.json();
      
      if (result.success) {
        this.paymentData = result.data;
        this.renderQRCode();
        
        if (!result.data.isExpired && result.data.expiryDate) {
          this.startCountdown(result.data.expiryDate);
        }
      } else {
        this.showError(result.message);
      }
    } catch (error) {
      this.showError('Failed to initiate payment');
      console.error(error);
    }
  }

  startCountdown(expiryDate) {
    const updateTimer = () => {
      const now = new Date();
      const expiry = new Date(expiryDate);
      const diff = expiry - now;

      if (diff <= 0) {
        this.handleExpiry();
        return;
      }

      const minutes = Math.floor(diff / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);
      const timeString = `${minutes}:${seconds.toString().padStart(2, '0')}`;
      
      this.updateTimerDisplay(timeString);
    };

    updateTimer();
    this.countdownInterval = setInterval(updateTimer, 1000);
  }

  updateTimerDisplay(timeString) {
    const timerElement = document.getElementById('expiry-timer');
    if (timerElement) {
      timerElement.textContent = `⏰ Expires in: ${timeString}`;
    }
  }

  handleExpiry() {
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
      this.countdownInterval = null;
    }

    const qrContainer = document.getElementById('qr-container');
    if (qrContainer) {
      qrContainer.innerHTML = `
        <div class="expired-message">
          <h3>QR Code Expired</h3>
          <p>This payment QR code has expired. Please create a new payment.</p>
          <button onclick="paymentManager.initiatePayment()">Create New Payment</button>
        </div>
      `;
    }
  }

  renderQRCode() {
    const container = document.getElementById('qr-container');
    if (!container || !this.paymentData) return;

    container.innerHTML = `
      <div class="payment-qr">
        <h3>Scan QR Code to Pay</h3>
        <img src="${this.paymentData.qrCode}" alt="QPay QR Code" class="qr-code-image" />
        <div id="expiry-timer" class="expiry-timer"></div>
        <p class="amount">Amount: ${this.paymentData.amount.toLocaleString()} MNT</p>
        <div class="payment-links">
          <a href="${this.paymentData.urls?.web}" target="_blank">Open in Browser</a>
          <a href="${this.paymentData.urls?.deeplink}">Open in QPay App</a>
        </div>
      </div>
    `;
  }

  showError(message) {
    const container = document.getElementById('qr-container');
    if (container) {
      container.innerHTML = `<div class="error">Error: ${message}</div>`;
    }
  }

  destroy() {
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
    }
  }
}

// Usage
const paymentManager = new PaymentQRManager(123, 'your-auth-token');
paymentManager.initiatePayment();
```

### Vue.js Example

```vue
<template>
  <div class="payment-qr-container">
    <!-- Loading State -->
    <div v-if="loading" class="loading">Loading payment QR code...</div>

    <!-- Error State -->
    <div v-if="error" class="error">
      <p>{{ error }}</p>
      <button @click="initiatePayment">Retry</button>
    </div>

    <!-- Expired State -->
    <div v-if="isExpired" class="expired-message">
      <h3>QR Code Expired</h3>
      <p>This payment QR code has expired. Please create a new payment.</p>
      <button @click="initiatePayment">Create New Payment</button>
    </div>

    <!-- QR Code Display -->
    <div v-if="paymentData && !isExpired" class="payment-qr">
      <h3>Scan QR Code to Pay</h3>
      
      <img 
        :src="paymentData.qrCode" 
        alt="QPay QR Code"
        class="qr-code-image"
      />
      
      <!-- Countdown Timer -->
      <div v-if="timeRemaining" class="expiry-timer">
        <p>⏰ Expires in: {{ timeRemaining }}</p>
      </div>
      
      <p class="amount">
        Amount: {{ formatAmount(paymentData.amount) }} MNT
      </p>
      
      <div class="payment-links">
        <a 
          :href="paymentData.urls?.web" 
          target="_blank" 
          rel="noopener noreferrer"
        >
          Open in Browser
        </a>
        <a :href="paymentData.urls?.deeplink">
          Open in QPay App
        </a>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'PaymentQRCode',
  props: {
    orderId: {
      type: Number,
      required: true
    }
  },
  data() {
    return {
      paymentData: null,
      loading: false,
      error: null,
      isExpired: false,
      timeRemaining: null,
      countdownInterval: null
    };
  },
  mounted() {
    this.initiatePayment();
  },
  beforeUnmount() {
    this.clearCountdown();
  },
  methods: {
    async initiatePayment() {
      this.loading = true;
      this.error = null;

      try {
        const response = await fetch(`/api/orders/${this.orderId}/initiate-payment`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.$store.state.authToken}`,
            'Content-Type': 'application/json'
          }
        });

        const result = await response.json();
        
        if (result.success) {
          this.paymentData = result.data;
          this.isExpired = result.data.isExpired;
          
          if (!result.data.isExpired && result.data.expiryDate) {
            this.startCountdown(result.data.expiryDate);
          }
        } else {
          this.error = result.message;
        }
      } catch (err) {
        this.error = 'Failed to initiate payment';
        console.error(err);
      } finally {
        this.loading = false;
      }
    },

    startCountdown(expiryDate) {
      this.clearCountdown();
      
      const updateTimer = () => {
        const now = new Date();
        const expiry = new Date(expiryDate);
        const diff = expiry - now;

        if (diff <= 0) {
          this.isExpired = true;
          this.timeRemaining = null;
          this.clearCountdown();
          return;
        }

        const minutes = Math.floor(diff / 60000);
        const seconds = Math.floor((diff % 60000) / 1000);
        this.timeRemaining = `${minutes}:${seconds.toString().padStart(2, '0')}`;
      };

      updateTimer();
      this.countdownInterval = setInterval(updateTimer, 1000);
    },

    clearCountdown() {
      if (this.countdownInterval) {
        clearInterval(this.countdownInterval);
        this.countdownInterval = null;
      }
    },

    formatAmount(amount) {
      return amount.toLocaleString();
    }
  }
};
</script>

<style scoped>
.payment-qr-container {
  max-width: 400px;
  margin: 0 auto;
}

.qr-code-image {
  width: 100%;
  max-width: 300px;
  height: auto;
  display: block;
  margin: 20px auto;
}

.expiry-timer {
  text-align: center;
  color: #ff6b6b;
  font-weight: bold;
  margin: 10px 0;
}

.expired-message {
  text-align: center;
  padding: 20px;
  background-color: #ffe0e0;
  border-radius: 8px;
}

.error {
  color: #ff0000;
  text-align: center;
  padding: 20px;
}
</style>
```

---

## Utility Functions

### Check if QR Code is Expired

```javascript
/**
 * Check if QR code has expired
 * @param {string} expiryDate - ISO 8601 date string
 * @returns {boolean} - True if expired, false otherwise
 */
function isQRCodeExpired(expiryDate) {
  if (!expiryDate) return false;
  return new Date(expiryDate) < new Date();
}

/**
 * Get time remaining until expiry
 * @param {string} expiryDate - ISO 8601 date string
 * @returns {Object} - Object with minutes and seconds remaining
 */
function getTimeRemaining(expiryDate) {
  if (!expiryDate) return null;
  
  const now = new Date();
  const expiry = new Date(expiryDate);
  const diff = expiry - now;

  if (diff <= 0) {
    return { minutes: 0, seconds: 0, expired: true };
  }

  return {
    minutes: Math.floor(diff / 60000),
    seconds: Math.floor((diff % 60000) / 1000),
    expired: false
  };
}

/**
 * Format time remaining as MM:SS
 * @param {string} expiryDate - ISO 8601 date string
 * @returns {string} - Formatted time string (e.g., "45:30")
 */
function formatTimeRemaining(expiryDate) {
  const time = getTimeRemaining(expiryDate);
  if (!time || time.expired) return '00:00';
  
  return `${time.minutes.toString().padStart(2, '0')}:${time.seconds.toString().padStart(2, '0')}`;
}
```

---

## CSS Styling Examples

```css
/* QR Code Container */
.payment-qr {
  text-align: center;
  padding: 20px;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

/* QR Code Image */
.qr-code-image {
  width: 100%;
  max-width: 300px;
  height: auto;
  margin: 20px auto;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  padding: 10px;
  background: #fff;
}

/* Expiry Timer */
.expiry-timer {
  font-size: 16px;
  font-weight: 600;
  color: #ff6b6b;
  margin: 15px 0;
  padding: 10px;
  background: #fff5f5;
  border-radius: 6px;
}

/* Expired Message */
.expired-message {
  padding: 30px;
  background: #ffe0e0;
  border: 2px solid #ff6b6b;
  border-radius: 8px;
  text-align: center;
}

.expired-message h3 {
  color: #d32f2f;
  margin-bottom: 10px;
}

.expired-message button {
  margin-top: 15px;
  padding: 10px 20px;
  background: #1976d2;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 16px;
}

.expired-message button:hover {
  background: #1565c0;
}

/* Amount Display */
.amount {
  font-size: 20px;
  font-weight: bold;
  color: #333;
  margin: 15px 0;
}

/* Payment Links */
.payment-links {
  display: flex;
  gap: 10px;
  justify-content: center;
  margin-top: 20px;
}

.payment-links a {
  padding: 10px 20px;
  background: #1976d2;
  color: white;
  text-decoration: none;
  border-radius: 6px;
  transition: background 0.3s;
}

.payment-links a:hover {
  background: #1565c0;
}
```

---

## Important Notes

1. **Expiry Time**: QR codes expire exactly **1 hour** after creation
2. **Timezone**: Expiry dates are in UTC (ISO 8601 format)
3. **Polling**: If you're polling payment status, stop polling when QR code expires
4. **User Experience**: Show clear warnings when QR code is about to expire (e.g., last 5 minutes)
5. **Refresh**: Allow users to create a new payment if QR code expires
6. **Validation**: Always check `isExpired` flag and validate expiry date on the frontend

---

## Testing

### Test Expired QR Code
```javascript
// Simulate expired QR code
const expiredDate = new Date();
expiredDate.setHours(expiredDate.getHours() - 2); // 2 hours ago

const expiredPaymentData = {
  ...paymentData,
  expiryDate: expiredDate.toISOString(),
  isExpired: true
};
```

### Test Countdown Timer
```javascript
// Set expiry to 2 minutes from now for testing
const testExpiry = new Date();
testExpiry.setMinutes(testExpiry.getMinutes() + 2);

const testPaymentData = {
  ...paymentData,
  expiryDate: testExpiry.toISOString(),
  isExpired: false
};
```
