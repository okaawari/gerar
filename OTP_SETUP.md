# OTP Implementation Setup Guide

This document provides setup instructions for the OTP (One-Time Password) functionality using MessagePro SMS API.

## Overview

The OTP system allows you to:
- Send OTP codes via SMS to phone numbers
- Verify OTP codes for authentication/verification purposes
- Support multiple purposes: REGISTRATION, LOGIN, PASSWORD_RESET, VERIFICATION

## Prerequisites

1. **Install Dependencies**
   ```bash
   npm install axios
   ```

2. **Database Migration**
   Run the Prisma migration to create the OTP table:
   ```bash
   npx prisma migrate deploy
   ```
   Or if you're in development:
   ```bash
   npx prisma migrate dev
   ```

## Environment Variables

Add the following environment variables to your `.env` file:

```env
# SMS API Configuration (MessagePro)
SMS_API_URL=https://api.messagepro.mn/send
SMS_API_KEY=1d30c7804f88de642bf24b931c6c5fcf
SMS_FROM_NUMBER=72227410
```

### Environment Variable Details

- **SMS_API_URL**: The MessagePro API endpoint (default: `https://api.messagepro.mn/send`)
- **SMS_API_KEY**: Your MessagePro API key (default: `1d30c7804f88de642bf24b931c6c5fcf`)
- **SMS_FROM_NUMBER**: The sender number/special number (default: `72227410`)

**Note**: The defaults are set to the values provided in the API documentation. You can override them via environment variables if needed.

## API Endpoints

### Send OTP
```
POST /api/otp/send
Body: { phoneNumber: string, purpose?: string }
```

### Verify OTP
```
POST /api/otp/verify
Body: { phoneNumber: string, code: string, purpose?: string }
```

See `API_DOCUMENTATION.md` for detailed API documentation.

## Features

### Rate Limiting
- Maximum 5 OTP requests per phone number per hour
- 60-second cooldown between resend requests
- Automatic rate limiting to comply with MessagePro API (5 requests per second)

### Security
- OTP codes expire after 10 minutes
- OTP codes are single-use (marked as used after verification)
- All unused OTPs for the same phone/purpose are invalidated after successful verification
- Previous unused OTPs are automatically invalidated when a new one is sent

### OTP Purposes
- `REGISTRATION` - For user registration verification
- `LOGIN` - For login verification
- `PASSWORD_RESET` - For password reset verification
- `VERIFICATION` - General verification (default)

## Usage Example

```javascript
// 1. Send OTP
const sendResponse = await fetch('http://localhost:3000/api/otp/send', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    phoneNumber: '12345678',
    purpose: 'REGISTRATION'
  })
});

// 2. User receives SMS with OTP code

// 3. Verify OTP
const verifyResponse = await fetch('http://localhost:3000/api/otp/verify', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    phoneNumber: '12345678',
    code: '123456', // Code from SMS
    purpose: 'REGISTRATION'
  })
});
```

## Maintenance

### Cleanup Expired OTPs

You can periodically clean up expired OTPs by calling:

```javascript
const otpService = require('./src/services/otpService');
await otpService.cleanupExpiredOTPs();
```

Consider setting up a cron job to run this periodically (e.g., daily).

## Error Handling

The SMS service handles various error scenarios:
- `402` - Organization account suspended (payment issues)
- `403` - API key missing or invalid
- `404` - Organization or sender number inactive
- `503` - Rate limit exceeded (more than 5 requests per second)
- Network timeouts and connection errors

All errors are properly formatted and returned to the client with appropriate HTTP status codes.

## Testing

After setup, test the OTP functionality:

1. Send an OTP to a test phone number
2. Check that SMS is received
3. Verify the OTP code
4. Test rate limiting by sending multiple requests
5. Test expired OTP by waiting 10+ minutes

## Troubleshooting

### SMS Not Sending
- Verify API key and sender number are correct
- Check organization account status
- Verify phone number format (must be 8 digits)
- Check rate limiting (max 5 requests per second)

### OTP Verification Failing
- Ensure OTP code is 6 digits
- Check that OTP hasn't expired (10 minutes)
- Verify phone number matches the one used to send OTP
- Ensure purpose matches (if specified)

### Rate Limit Errors
- Wait 60 seconds between resend requests
- Maximum 5 requests per phone per hour
- MessagePro API allows max 5 requests per second globally
