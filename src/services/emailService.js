const nodemailer = require('nodemailer');

class EmailService {
    constructor() {
        // Google SMTP configuration
        this.smtpHost = process.env.SMTP_HOST || 'smtp.gmail.com';
        this.smtpPort = parseInt(process.env.SMTP_PORT || '587');
        this.smtpSecure = process.env.SMTP_SECURE === 'true'; // true for 465, false for other ports
        this.smtpUser = process.env.SMTP_USER; // Your Gmail address
        this.smtpPassword = process.env.SMTP_PASSWORD; // Your Gmail App Password
        this.fromEmail = process.env.SMTP_FROM_EMAIL || this.smtpUser;
        this.fromName = process.env.SMTP_FROM_NAME || 'Ecommerce';

        // Create transporter
        this.transporter = null;
        this.initializeTransporter();
    }

    /**
     * Initialize the nodemailer transporter
     */
    initializeTransporter() {
        if (!this.smtpUser || !this.smtpPassword) {
            console.warn('Email service not configured: SMTP_USER and SMTP_PASSWORD are required');
            return;
        }

        this.transporter = nodemailer.createTransport({
            host: this.smtpHost,
            port: this.smtpPort,
            secure: this.smtpSecure, // true for 465, false for other ports
            auth: {
                user: this.smtpUser,
                pass: this.smtpPassword
            }
        });
    }

    /**
     * Verify SMTP connection
     * @returns {Promise<Object>} - { success: boolean, message?: string, error?: string }
     */
    async verifyConnection() {
        if (!this.transporter) {
            return {
                success: false,
                error: 'EMAIL_NOT_CONFIGURED',
                message: 'Email service is not configured. Please set SMTP_USER and SMTP_PASSWORD environment variables.'
            };
        }

        try {
            await this.transporter.verify();
            return {
                success: true,
                message: 'SMTP connection verified successfully'
            };
        } catch (error) {
            return {
                success: false,
                error: error.code || 'VERIFICATION_FAILED',
                message: error.message || 'Failed to verify SMTP connection'
            };
        }
    }

    /**
     * Send email via Google SMTP
     * @param {string} to - Recipient email address
     * @param {string} subject - Email subject
     * @param {string} text - Plain text email body
     * @param {string} html - HTML email body (optional)
     * @param {Array} attachments - Array of attachment objects (optional)
     * @returns {Promise<Object>} - { success: boolean, messageId?: string, error?: string }
     */
    async sendEmail(to, subject, text, html = null, attachments = []) {
        try {
            // Validate inputs
            if (!to || !subject || !text) {
                throw new Error('Recipient email, subject, and text are required');
            }

            // Validate email format
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(to)) {
                throw new Error('Invalid recipient email format');
            }

            if (!this.transporter) {
                return {
                    success: false,
                    error: 'EMAIL_NOT_CONFIGURED',
                    message: 'Email service is not configured. Please set SMTP_USER and SMTP_PASSWORD environment variables.'
                };
            }

            // Prepare email options
            const mailOptions = {
                from: `"${this.fromName}" <${this.fromEmail}>`,
                to: to,
                subject: subject,
                text: text,
                html: html || text.replace(/\n/g, '<br>'), // Convert newlines to <br> if no HTML provided
                attachments: attachments
            };

            // Send email
            const info = await this.transporter.sendMail(mailOptions);

            return {
                success: true,
                messageId: info.messageId,
                message: 'Email sent successfully'
            };

        } catch (error) {
            // Handle different error scenarios
            if (error.code === 'EAUTH') {
                return {
                    success: false,
                    error: 'AUTHENTICATION_FAILED',
                    message: 'SMTP authentication failed. Please check your credentials.'
                };
            } else if (error.code === 'ECONNECTION') {
                return {
                    success: false,
                    error: 'CONNECTION_FAILED',
                    message: 'Failed to connect to SMTP server. Please check your network and SMTP settings.'
                };
            } else if (error.code === 'ETIMEDOUT') {
                return {
                    success: false,
                    error: 'TIMEOUT',
                    message: 'SMTP connection timeout. Please try again.'
                };
            }

            return {
                success: false,
                error: error.code || 'UNKNOWN_ERROR',
                message: error.message || 'Failed to send email'
            };
        }
    }

    /**
     * Send order confirmation email
     * @param {string} to - Recipient email address
     * @param {Object} orderData - Order information
     * @returns {Promise<Object>} - { success: boolean, messageId?: string, error?: string }
     */
    async sendOrderConfirmation(to, orderData) {
        const { orderNumber, totalAmount, items, deliveryDate, deliveryAddress } = orderData;

        const subject = `Order Confirmation - #${orderNumber}`;
        const text = `
Dear Customer,

Thank you for your order!

Order Number: ${orderNumber}
Total Amount: ${totalAmount} MNT
Delivery Date: ${deliveryDate || 'TBD'}
${deliveryAddress ? `Delivery Address: ${deliveryAddress}` : ''}

Items:
${items.map(item => `- ${item.name} x${item.quantity} - ${item.price} MNT`).join('\n')}

We will process your order shortly.

Best regards,
${this.fromName}
        `.trim();

        const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #4CAF50; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; background-color: #f9f9f9; }
        .order-info { background-color: white; padding: 15px; margin: 15px 0; border-radius: 5px; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Order Confirmation</h1>
        </div>
        <div class="content">
            <p>Dear Customer,</p>
            <p>Thank you for your order!</p>
            
            <div class="order-info">
                <p><strong>Order Number:</strong> #${orderNumber}</p>
                <p><strong>Total Amount:</strong> ${totalAmount} MNT</p>
                ${deliveryDate ? `<p><strong>Delivery Date:</strong> ${deliveryDate}</p>` : ''}
                ${deliveryAddress ? `<p><strong>Delivery Address:</strong> ${deliveryAddress}</p>` : ''}
            </div>

            <h3>Items:</h3>
            <ul>
                ${items.map(item => `<li>${item.name} x${item.quantity} - ${item.price} MNT</li>`).join('')}
            </ul>

            <p>We will process your order shortly.</p>
        </div>
        <div class="footer">
            <p>Best regards,<br>${this.fromName}</p>
        </div>
    </div>
</body>
</html>
        `.trim();

        return this.sendEmail(to, subject, text, html);
    }

    /**
     * Send password reset email
     * @param {string} to - Recipient email address
     * @param {string} resetCode - Password reset code
     * @returns {Promise<Object>} - { success: boolean, messageId?: string, error?: string }
     */
    async sendPasswordReset(to, resetCode) {
        const subject = 'Password Reset Request';
        const text = `
Dear User,

You have requested to reset your password.

Your reset code is: ${resetCode}

This code will expire in 10 minutes.

If you did not request this, please ignore this email.

Best regards,
${this.fromName}
        `.trim();

        const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .code { background-color: #f0f0f0; padding: 15px; text-align: center; font-size: 24px; font-weight: bold; margin: 20px 0; border-radius: 5px; }
    </style>
</head>
<body>
    <div class="container">
        <p>Dear User,</p>
        <p>You have requested to reset your password.</p>
        <div class="code">${resetCode}</div>
        <p>This code will expire in 10 minutes.</p>
        <p>If you did not request this, please ignore this email.</p>
        <p>Best regards,<br>${this.fromName}</p>
    </div>
</body>
</html>
        `.trim();

        return this.sendEmail(to, subject, text, html);
    }

    /**
     * Send welcome email
     * @param {string} to - Recipient email address
     * @param {string} name - User's name
     * @returns {Promise<Object>} - { success: boolean, messageId?: string, error?: string }
     */
    async sendWelcomeEmail(to, name) {
        const subject = 'Welcome to Our Ecommerce Platform';
        const text = `
Dear ${name},

Welcome to our ecommerce platform!

Thank you for registering with us. We're excited to have you as a customer.

If you have any questions, please don't hesitate to contact us.

Best regards,
${this.fromName}
        `.trim();

        const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    </style>
</head>
<body>
    <div class="container">
        <p>Dear ${name},</p>
        <p>Welcome to our ecommerce platform!</p>
        <p>Thank you for registering with us. We're excited to have you as a customer.</p>
        <p>If you have any questions, please don't hesitate to contact us.</p>
        <p>Best regards,<br>${this.fromName}</p>
    </div>
</body>
</html>
        `.trim();

        return this.sendEmail(to, subject, text, html);
    }

    /**
     * Format ebarimt API response or error for inclusion in email (for debugging)
     * @param {Object} ebarimtData - Ebarimt response or { ebarimt_error: { message, response } }
     * @returns {string} Readable string (JSON, truncated if needed)
     */
    _formatEbarimtResponseForEmail(ebarimtData) {
        if (!ebarimtData || typeof ebarimtData !== 'object') {
            return String(ebarimtData);
        }
        const copy = {};
        for (const key of Object.keys(ebarimtData)) {
            let val = ebarimtData[key];
            if (key === 'qr_image' && typeof val === 'string' && val.length > 80) {
                val = `[base64, ${val.length} chars]`;
            }
            copy[key] = val === undefined ? null : val;
        }
        let out;
        try {
            out = JSON.stringify(copy, null, 2);
        } catch {
            return String(ebarimtData);
        }
        if (out === '{}') {
            const keys = Object.keys(ebarimtData);
            return '(empty JSON – API may have returned no body or only undefined values)\nKeys present: ' + (keys.length ? keys.join(', ') : 'none');
        }
        return out;
    }

    /**
     * Send Ebarimt (fiscal receipt) email after payment is confirmed
     * @param {string} to - Recipient email address
     * @param {Object} orderData - Order information { orderNumber, totalAmount, items: [{ name, quantity, price }], deliveryDate?, deliveryAddress? }
     * @param {Object} ebarimtData - Ebarimt API response (e.g. ebarimt_id, receipt_url, qr_image, etc.) or error info
     * @returns {Promise<Object>} - { success: boolean, messageId?: string, error?: string }
     */
    async sendEbarimtReceipt(to, orderData, ebarimtData) {
        const { orderNumber, totalAmount, items, deliveryDate, deliveryAddress } = orderData;
        const ebarimtId = ebarimtData.ebarimt_id || ebarimtData.ebarimtId || null;
        const receiptUrl = ebarimtData.receipt_url || ebarimtData.url || null;
        const rawResponseText = this._formatEbarimtResponseForEmail(ebarimtData);

        const subject = `Payment Receipt (Ebarimt) - Order #${orderNumber}`;
        const text = `
Dear Customer,

Your payment has been confirmed. Please find your fiscal receipt (Ebarimt) details below.

Order Number: ${orderNumber}
Total Amount: ${totalAmount} MNT
${deliveryDate ? `Delivery Date: ${deliveryDate}` : ''}
${deliveryAddress ? `Delivery Address: ${deliveryAddress}` : ''}

Items:
${items.map(item => `- ${item.name} x${item.quantity} - ${item.price} MNT`).join('\n')}

Ebarimt Receipt ID: ${ebarimtId || 'N/A'}
${receiptUrl ? `View receipt: ${receiptUrl}` : ''}

--- Ebarimt API response (for debugging) ---
${rawResponseText}
-------------------------------------------

Please keep this receipt for your records.

Best regards,
${this.fromName}
        `.trim();

        const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #2196F3; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; background-color: #f9f9f9; }
        .order-info { background-color: white; padding: 15px; margin: 15px 0; border-radius: 5px; }
        .receipt-box { background-color: #E3F2FD; padding: 15px; margin: 15px 0; border-radius: 5px; border-left: 4px solid #2196F3; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Payment Receipt (Ebarimt)</h1>
        </div>
        <div class="content">
            <p>Dear Customer,</p>
            <p>Your payment has been confirmed. Please find your fiscal receipt (Ebarimt) details below.</p>
            
            <div class="order-info">
                <p><strong>Order Number:</strong> #${orderNumber}</p>
                <p><strong>Total Amount:</strong> ${totalAmount} MNT</p>
                ${deliveryDate ? `<p><strong>Delivery Date:</strong> ${deliveryDate}</p>` : ''}
                ${deliveryAddress ? `<p><strong>Delivery Address:</strong> ${deliveryAddress}</p>` : ''}
            </div>

            <h3>Items:</h3>
            <ul>
                ${items.map(item => `<li>${item.name} x${item.quantity} - ${item.price} MNT</li>`).join('')}
            </ul>

            <div class="receipt-box">
                <p><strong>Ebarimt Receipt ID:</strong> ${ebarimtId || 'N/A'}</p>
                ${receiptUrl ? `<p><a href="${receiptUrl}">View receipt</a></p>` : ''}
            </div>

            <details style="margin-top: 15px; padding: 10px; background: #f5f5f5; border-radius: 5px;">
                <summary style="cursor: pointer;"><strong>Ebarimt API response (for debugging)</strong></summary>
                <pre style="white-space: pre-wrap; word-break: break-all; font-size: 11px; margin: 10px 0 0;">${rawResponseText.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>
            </details>

            <p>Please keep this receipt for your records.</p>
        </div>
        <div class="footer">
            <p>Best regards,<br>${this.fromName}</p>
        </div>
    </div>
</body>
</html>
        `.trim();

        return this.sendEmail(to, subject, text, html);
    }
}

module.exports = new EmailService();
