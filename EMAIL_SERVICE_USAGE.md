# Email Service Usage Guide

This guide explains how to use the email service with Google SMTP.

## Setup

### 1. Install Dependencies
The email service uses `nodemailer` which is already installed:
```bash
npm install nodemailer
```

### 2. Configure Environment Variables

Add the following to your `.env` file:

```env
# Email Service Configuration (Google SMTP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password-here
SMTP_FROM_EMAIL=your-email@gmail.com
SMTP_FROM_NAME=Ecommerce
```

### 3. Get Gmail App Password

**Important**: You cannot use your regular Gmail password. You need to create an App Password:

1. Go to your Google Account: https://myaccount.google.com/
2. Enable **2-Step Verification** (if not already enabled)
3. Go to **Security** → **2-Step Verification** → **App passwords**
4. Generate a new App Password for "Mail"
5. Use this 16-character password as `SMTP_PASSWORD`

## Usage Examples

### Basic Email Service Import

```javascript
const emailService = require('./src/services/emailService');
```

### 1. Send a Simple Email

```javascript
const result = await emailService.sendEmail(
    'recipient@example.com',
    'Subject Line',
    'Plain text email body'
);

if (result.success) {
    console.log('Email sent:', result.messageId);
} else {
    console.error('Failed to send email:', result.error);
}
```

### 2. Send HTML Email

```javascript
const result = await emailService.sendEmail(
    'recipient@example.com',
    'Subject Line',
    'Plain text fallback',
    '<h1>HTML Content</h1><p>This is an HTML email.</p>'
);
```

### 3. Send Order Confirmation Email

```javascript
const orderData = {
    orderNumber: 'ORD-12345',
    totalAmount: 50000,
    items: [
        { name: 'Product 1', quantity: 2, price: 25000 },
        { name: 'Product 2', quantity: 1, price: 25000 }
    ],
    deliveryDate: '2026-01-30',
    deliveryAddress: '123 Main St, City'
};

const result = await emailService.sendOrderConfirmation(
    'customer@example.com',
    orderData
);
```

### 4. Send Password Reset Email

```javascript
const result = await emailService.sendPasswordReset(
    'user@example.com',
    '123456' // Reset code
);
```

### 5. Send Welcome Email

```javascript
const result = await emailService.sendWelcomeEmail(
    'newuser@example.com',
    'John Doe'
);
```

### 6. Verify SMTP Connection

```javascript
const result = await emailService.verifyConnection();
if (result.success) {
    console.log('SMTP connection verified');
} else {
    console.error('SMTP verification failed:', result.error);
}
```

## Integration Examples

### In Order Controller

```javascript
const emailService = require('../services/emailService');

// After order creation
if (order.user?.email) {
    await emailService.sendOrderConfirmation(order.user.email, {
        orderNumber: order.orderNumber,
        totalAmount: order.totalAmount,
        items: order.items,
        deliveryDate: order.deliveryDate,
        deliveryAddress: order.deliveryAddress
    });
}
```

### In Auth Service

```javascript
const emailService = require('../services/emailService');

// After user registration
if (user.email) {
    await emailService.sendWelcomeEmail(user.email, user.name);
}

// For password reset
if (user.email) {
    await emailService.sendPasswordReset(user.email, resetCode);
}
```

## Error Handling

The email service returns a consistent response format:

```javascript
{
    success: boolean,
    messageId?: string,  // Present on success
    message?: string,    // Human-readable message
    error?: string       // Error code (present on failure)
}
```

Common error codes:
- `EMAIL_NOT_CONFIGURED`: SMTP credentials not set
- `AUTHENTICATION_FAILED`: Invalid credentials
- `CONNECTION_FAILED`: Cannot connect to SMTP server
- `TIMEOUT`: Connection timeout

## SMTP Configuration Options

- **SMTP_HOST**: SMTP server hostname (default: `smtp.gmail.com`)
- **SMTP_PORT**: SMTP port (default: `587` for TLS, use `465` for SSL)
- **SMTP_SECURE**: Use SSL (default: `false`, set to `true` for port 465)
- **SMTP_USER**: Your Gmail address
- **SMTP_PASSWORD**: Gmail App Password (not regular password)
- **SMTP_FROM_EMAIL**: Sender email (defaults to SMTP_USER)
- **SMTP_FROM_NAME**: Sender name (defaults to "Ecommerce")

## Notes

- The service gracefully handles missing configuration (logs warning, returns error on use)
- All emails include both plain text and HTML versions
- The service follows the same pattern as the existing SMS service
- Emails are sent asynchronously - handle errors appropriately
