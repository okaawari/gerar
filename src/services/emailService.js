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
            secure: this.smtpSecure, // true for 465, false for 587 (STARTTLS)
            auth: {
                user: this.smtpUser,
                pass: this.smtpPassword
            },
            connectionTimeout: 15000,
            greetingTimeout: 10000
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
                throw new Error('Email service is not configured. Please set SMTP_USER and SMTP_PASSWORD environment variables.');
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
            // Re-throw so callers (e.g. payment confirmation) can log and handle
            if (error.code === 'EAUTH') {
                throw new Error('SMTP authentication failed. Please check SMTP_USER and SMTP_PASSWORD.');
            }
            if (error.code === 'ECONNECTION' || error.code === 'ECONNREFUSED') {
                const hint = this.smtpPort === 587
                    ? ' If this server blocks outbound port 587, try SMTP_PORT=465 and SMTP_SECURE=true, or use a transactional email provider (e.g. SendGrid, Mailgun).'
                    : '';
                throw new Error('Failed to connect to SMTP server (connection refused). Check firewall and SMTP host/port.' + hint);
            }
            if (error.code === 'ETIMEDOUT') {
                throw new Error('SMTP connection timeout. Please try again.');
            }
            throw new Error(error.message || 'Failed to send email');
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
        const subject = 'Манай онлайн дэлгүүрт тавтай морилно уу';

const text = `
Сайн байна уу, ${name},

Манай онлайн дэлгүүрт бүртгүүлсэнд баярлалаа 🎉

Таны мэйл хаяг амжилттай бүртгэгдлээ. Бид танд чанартай үйлчилгээ үзүүлэхэд бэлэн байна.

Хэрэв танд асуух зүйл байвал бидэнтэй хүссэн үедээ холбогдоорой.

Хүндэтгэсэн,
${this.fromName}
`.trim();


const html = `
<!DOCTYPE html>
<html lang="mn">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Тавтай морилно уу</title>
<style>
  body {
    margin: 0;
    background: #f4f6f8;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
    color: #333;
  }
  .container {
    max-width: 640px;
    margin: 0 auto;
    padding: 20px;
  }
  .card {
    background: #ffffff;
    border-radius: 12px;
    box-shadow: 0 6px 18px rgba(0,0,0,0.06);
    overflow: hidden;
  }
  .header {
    background: linear-gradient(135deg, #4CAF50, #66BB6A);
    color: #fff;
    text-align: center;
    padding: 28px 20px;
  }
  .header h1 {
    margin: 0;
    font-size: 22px;
  }
  .content {
    padding: 24px;
    font-size: 15px;
    line-height: 1.6;
  }
  .welcome-box {
    background: #f1f8f4;
    border-left: 4px solid #4CAF50;
    padding: 16px;
    border-radius: 6px;
    margin: 16px 0;
  }
  .footer {
    text-align: center;
    font-size: 12px;
    color: #777;
    padding: 16px;
    background: #fafafa;
  }
</style>
</head>
<body>
  <div class="container">
    <div class="card">
      <div class="header">
        <h1>Тавтай морилно уу 🎉</h1>
      </div>

      <div class="content">
        <p>Сайн байна уу, <strong>${name}</strong>,</p>

        <div class="welcome-box">
          <p>Манай онлайн дэлгүүрт амжилттай бүртгүүллээ.</p>
          <p>Бид танд чанартай бүтээгдэхүүн, найдвартай үйлчилгээг санал болгоход бэлэн байна.</p>
        </div>

        <p>
          Хэрэв танд асуух зүйл, санал хүсэлт байвал бидэнтэй хүссэн үедээ холбогдоорой.
        </p>

        <p>Танд таатай худалдан авалт хүсье 😊</p>
      </div>

      <div class="footer">
        Хүндэтгэсэн,<br />
        ${this.fromName}
      </div>
    </div>
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
        const qrImage = ebarimtData.qr_image || ebarimtData.ebarimt_qr_image || null;
        const rawResponseText = this._formatEbarimtResponseForEmail(ebarimtData);

        const subject = `Төлбөрийн баримт (И-Баримт) – Захиалга #${orderNumber}`;
        const text = `
Сайн байна уу,

Таны төлбөр амжилттай баталгаажлаа. Доор таны И-Баримтын мэдээллийг хүргэж байна.

Захиалгын дугаар: ${orderNumber}
Нийт дүн: ${totalAmount}₮
${deliveryDate ? `Хүргэлтийн огноо: ${deliveryDate}` : ''}
${deliveryAddress ? `Хүргэлтийн хаяг: ${deliveryAddress}` : ''}

Бараанууд:
${items.map(item => `- ${item.name} x${item.quantity} — ${item.price}₮`).join('\n')}

И-Баримтын дугаар: ${ebarimtId || 'Байхгүй'}
${receiptUrl ? `Баримт харах: ${receiptUrl}` : ''}
${qrImage ? 'И-Баримтын QR кодыг имэйлийн HTML хувилбар дээр харна уу.' : ''}


Энэхүү баримтыг цаашид хадгална уу.


Best Хүндэтгэсэн,
${this.fromName}
        `.trim();

        const html = `
        <!DOCTYPE html>
        <html lang="mn">
        <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>И-Баримт</title>
        <style>
        body {
            margin: 0;
            background: #f4f6f8;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
            color: #333;
        }
        .container {
            max-width: 640px;
            margin: 0 auto;
            padding: 20px;
        }
        .card {
            background: #ffffff;
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 6px 18px rgba(0,0,0,0.06);
        }
        .header {
            background: linear-gradient(135deg, #1976D2, #2196F3);
            color: #fff;
            padding: 24px;
            text-align: center;
        }
        .header h1 {
            margin: 0;
            font-size: 22px;
        }
        .content {
            padding: 24px;
        }
        .section {
            margin-bottom: 20px;
        }
        .info-box {
            background: #f8fafc;
            border-radius: 8px;
            padding: 16px;
            font-size: 14px;
        }
        .info-box p {
            margin: 6px 0;
        }
        ul {
            padding-left: 18px;
            margin: 8px 0;
        }
        li {
            margin-bottom: 6px;
            font-size: 14px;
        }
        .receipt {
            background: #E3F2FD;
            border-left: 4px solid #2196F3;
            padding: 14px;
            border-radius: 6px;
            font-size: 14px;
        }
        .receipt a {
            color: #1565C0;
            text-decoration: none;
            font-weight: 500;
        }
        .receipt a:hover {
            text-decoration: underline;
        }
        .footer {
            text-align: center;
            font-size: 12px;
            color: #777;
            padding: 16px;
            background: #fafafa;
        }
        details {
            margin-top: 14px;
            font-size: 12px;
            background: #f5f5f5;
            padding: 10px;
            border-radius: 6px;
        }
        pre {
            white-space: pre-wrap;
            word-break: break-all;
            margin-top: 8px;
        }
        </style>
        </head>
        <body>
        <div class="container">
            <div class="card">
            <div class="header">
                <h1>Төлбөрийн баримт (И-Баримт)</h1>
            </div>

            <div class="content">
                <div class="section">
                <p>Сайн байна уу,</p>
                <p>Таны төлбөр амжилттай баталгаажлаа. Доор таны И-Баримтын мэдээллийг хүргэж байна.</p>
                </div>

                <div class="section info-box">
                <p><strong>Захиалгын дугаар:</strong> #${orderNumber}</p>
                <p><strong>Нийт дүн:</strong> ${totalAmount}₮</p>
                ${deliveryDate ? `<p><strong>Хүргэлтийн огноо:</strong> ${deliveryDate}</p>` : ''}
                ${deliveryAddress ? `<p><strong>Хүргэлтийн хаяг:</strong> ${deliveryAddress}</p>` : ''}
                </div>

                <div class="section">
                <strong>Бараанууд:</strong>
                <ul>
                    ${items.map(item => `<li>${item.name} x${item.quantity} — ${item.price}₮</li>`).join('')}
                </ul>
                </div>

                <div class="section receipt">
                <p><strong>И-Баримтын дугаар:</strong> ${ebarimtId || 'Байхгүй'}</p>
                ${receiptUrl ? `<p><a href="${receiptUrl}" target="_blank">Баримт харах</a></p>` : ''}
                ${qrImage ? `<p style="margin-top:12px;"><strong>И-Баримтын QR код:</strong></p><p><img src="${qrImage}" alt="И-Баримт QR" width="200" height="200" style="display:block;border:1px solid #ddd;border-radius:8px;" /></p>` : ''}
                </div>

                <details>
                <summary><strong>И-Баримт API хариу (debug)</strong></summary>
                <pre>${rawResponseText.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>
                </details>

                <p>Энэхүү баримтыг цаашид хадгална уу.</p>
            </div>

            <div class="footer">
                Хүндэтгэсэн,<br />
                ${this.fromName}
            </div>
            </div>
        </div>
        </body>
        </html>
        `.trim();


        return this.sendEmail(to, subject, text, html);
    }
}

module.exports = new EmailService();
