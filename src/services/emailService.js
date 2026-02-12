const nodemailer = require('nodemailer');

class EmailService {
    constructor() {
        // Mail relay (optional): when set, all emails are sent via HTTP POST to this URL instead of SMTP
        this.relayUrl = process.env.EMAIL_RELAY_URL || null;
        this.relayToken = process.env.EMAIL_RELAY_TOKEN || null;
        this.useRelay = !!(this.relayUrl && this.relayToken);

        // Google SMTP configuration (used when relay is not configured)
        this.smtpHost = process.env.SMTP_HOST || 'smtp.gmail.com';
        this.smtpPort = parseInt(process.env.SMTP_PORT || '587');
        this.smtpSecure = process.env.SMTP_SECURE === 'true'; // true for 465, false for other ports
        this.smtpUser = process.env.SMTP_USER; // Your Gmail address
        this.smtpPassword = process.env.SMTP_PASSWORD; // Your Gmail App Password
        this.fromEmail = process.env.SMTP_FROM_EMAIL || this.smtpUser;
        this.fromName = process.env.SMTP_FROM_NAME || 'Ecommerce';

        // Create transporter (only when not using relay)
        this.transporter = null;
        if (!this.useRelay) {
            this.initializeTransporter();
        }
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
     * Verify SMTP connection or relay availability
     * @returns {Promise<Object>} - { success: boolean, message?: string, error?: string }
     */
    async verifyConnection() {
        if (this.useRelay) {
            return {
                success: true,
                message: 'Email relay configured: ' + this.relayUrl
            };
        }
        if (!this.transporter) {
            return {
                success: false,
                error: 'EMAIL_NOT_CONFIGURED',
                message: 'Email service is not configured. Set SMTP_USER and SMTP_PASSWORD, or EMAIL_RELAY_URL and EMAIL_RELAY_TOKEN.'
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

            const htmlBody = html || text.replace(/\n/g, '<br>');

            // Send via HTTP relay when configured (e.g. when hosting blocks SMTP ports)
            if (this.useRelay) {
                if (attachments.length > 0) {
                    throw new Error('Email relay does not support attachments. Disable EMAIL_RELAY_URL to use SMTP with attachments.');
                }
                const res = await fetch(this.relayUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Relay-Token': this.relayToken
                    },
                    body: JSON.stringify({
                        to,
                        subject,
                        html: htmlBody
                    })
                });
                if (!res.ok) {
                    const errText = await res.text();
                    throw new Error(`Relay returned ${res.status}: ${errText || res.statusText}`);
                }
                return {
                    success: true,
                    messageId: `relay-${Date.now()}`,
                    message: 'Email sent successfully via relay'
                };
            }

            if (!this.transporter) {
                throw new Error('Email service is not configured. Please set SMTP_USER and SMTP_PASSWORD, or EMAIL_RELAY_URL and EMAIL_RELAY_TOKEN.');
            }

            // Prepare email options (SMTP)
            const mailOptions = {
                from: `"${this.fromName}" <${this.fromEmail}>`,
                to: to,
                subject: subject,
                text: text,
                html: htmlBody,
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
    /**
 * Send order receipt email (NO ebarimt, Mongolian)
 * @param {string} to
 * @param {Object} orderData
 */
    async sendOrderReceipt(to, orderData) {
        const {
            orderNumber,
            orderDate,
            totalAmount,
            items,
            deliveryDate,
            deliveryTime,
            deliveryAddress
        } = orderData;
    
        const primaryColor = '#0a714e';
        const brandLogoUrl = process.env.BRAND_LOGO_URL || process.env.EMAIL_LOGO_URL || '';
        const brandInitial = (this.fromName || 'E').trim().charAt(0).toUpperCase();
        const safeItems = Array.isArray(items) ? items : [];
        const subject = `Таны захиалгыг амжилттай хүлээн авлаа — №${orderNumber}`;
    
        const text = `
    Сайн байна уу,
    
    Таны захиалгыг амжилттай хүлээн авлаа.
    
    Захиалгын дугаар: ${orderNumber}
    Захиалсан огноо: ${orderDate || ''}
    Нийт дүн: ${totalAmount}
    
    Бараанууд:
    ${safeItems.length
        ? safeItems.map(i => `- ${i.name} x${i.quantity} — ${i.price}`).join('\n')
        : '- Барааны мэдээлэл байхгүй байна.'}
    
    Хүргэлтийн мэдээлэл:
    Огноо: ${deliveryDate || 'Тодорхойгүй'}
    ${deliveryTime ? `Цаг: ${deliveryTime}` : ''}
    ${deliveryAddress ? `Хаяг: ${deliveryAddress}` : ''}
    
    Бид таны захиалгыг бэлтгээд хүргэлтэд гаргахаас өмнө танд дахин мэдэгдэнэ.
    
    Хүндэтгэсэн,
    ${this.fromName}
        `.trim();
    
        const html = `
    <!DOCTYPE html>
    <html lang="mn">
    <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Захиалга хүлээн авлаа</title>
    </head>
    <body style="margin:0;padding:0;background-color:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f5f5f5;">
        <tr>
          <td align="center" style="padding:20px 10px;">
            
            <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
              
              <!-- Header Section -->
              <tr>
                <td style="background:linear-gradient(135deg, ${primaryColor} 0%, #064d37 100%);padding:32px 24px;text-align:center;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td align="center">
                        ${brandLogoUrl
                            ? `<img src="${brandLogoUrl}" alt="${this.fromName}" width="56" height="56" style="border-radius:50%;border:3px solid rgba(255,255,255,0.3);display:block;margin:0 auto 16px;">`
                            : `<div style="width:56px;height:56px;border-radius:50%;background-color:#ffffff;color:${primaryColor};font-size:24px;font-weight:700;line-height:56px;text-align:center;margin:0 auto 16px;border:3px solid rgba(255,255,255,0.3);">${brandInitial}</div>`}
                        <h1 style="margin:0 0 8px;color:#ffffff;font-size:28px;font-weight:700;line-height:1.2;">Баярлалаа!</h1>
                        <p style="margin:0;color:rgba(255,255,255,0.95);font-size:16px;line-height:1.5;">Таны захиалгыг амжилттай хүлээн авлаа</p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
    
              <!-- Order Number Badge -->
              <tr>
                <td align="center" style="padding:24px 24px 0;">
                  <div style="display:inline-block;background-color:#f0fdf4;border:2px solid ${primaryColor};border-radius:24px;padding:8px 20px;">
                    <span style="color:${primaryColor};font-size:14px;font-weight:700;">Захиалга №${orderNumber}</span>
                  </div>
                </td>
              </tr>
    
              <!-- Order Details -->
              <tr>
                <td style="padding:24px;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f9fafb;border-radius:8px;overflow:hidden;">
                    <tr>
                      <td style="padding:16px 20px;">
                        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                          <tr>
                            <td style="padding:8px 0;color:#6b7280;font-size:14px;">Захиалгын дугаар</td>
                            <td align="right" style="padding:8px 0;color:#111827;font-size:14px;font-weight:600;">№${orderNumber}</td>
                          </tr>
                          ${orderDate ? `
                          <tr>
                            <td style="padding:8px 0;border-top:1px solid #e5e7eb;color:#6b7280;font-size:14px;">Захиалсан огноо</td>
                            <td align="right" style="padding:8px 0;border-top:1px solid #e5e7eb;color:#111827;font-size:14px;font-weight:600;">${orderDate}</td>
                          </tr>
                          ` : ''}
                          <tr>
                            <td style="padding:8px 0;border-top:1px solid #e5e7eb;color:#6b7280;font-size:14px;">Төлөв</td>
                            <td align="right" style="padding:8px 0;border-top:1px solid #e5e7eb;">
                              <span style="background-color:#dcfce7;color:#166534;padding:4px 12px;border-radius:12px;font-size:13px;font-weight:600;">Бүртгэгдсэн</span>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
    
              <!-- Items Section -->
              <tr>
                <td style="padding:0 24px 24px;">
                  <h2 style="margin:0 0 16px;color:#111827;font-size:18px;font-weight:700;">Захиалсан бараа</h2>
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
                    <thead>
                      <tr style="background-color:#f9fafb;">
                        <th align="left" style="padding:12px 16px;color:#374151;font-size:13px;font-weight:600;border-bottom:1px solid #e5e7eb;">Бараа</th>
                        <th align="center" style="padding:12px 16px;color:#374151;font-size:13px;font-weight:600;border-bottom:1px solid #e5e7eb;">Тоо</th>
                        <th align="right" style="padding:12px 16px;color:#374151;font-size:13px;font-weight:600;border-bottom:1px solid #e5e7eb;">Үнэ</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${safeItems.length
                        ? safeItems.map((i, idx) => `
                      <tr${idx < safeItems.length - 1 ? ' style="border-bottom:1px solid #f3f4f6;"' : ''}>
                        <td style="padding:14px 16px;color:#111827;font-size:14px;">${i.name}</td>
                        <td align="center" style="padding:14px 16px;color:#6b7280;font-size:14px;">${i.quantity}</td>
                        <td align="right" style="padding:14px 16px;color:#111827;font-size:14px;font-weight:600;">${i.price}</td>
                      </tr>
                      `).join('')
                        : `
                      <tr>
                        <td colspan="3" align="center" style="padding:20px;color:#9ca3af;font-size:14px;">Барааны мэдээлэл байхгүй байна</td>
                      </tr>
                      `}
                    </tbody>
                  </table>
                </td>
              </tr>
    
              <!-- Total -->
              <tr>
                <td style="padding:0 24px 24px;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%);border-radius:8px;border:2px solid ${primaryColor};">
                    <tr>
                      <td style="padding:16px 20px;">
                        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                          <tr>
                            <td style="color:#166534;font-size:16px;font-weight:700;">Нийт дүн</td>
                            <td align="right" style="color:${primaryColor};font-size:22px;font-weight:700;">${totalAmount}</td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
    
              <!-- Delivery Info -->
              <tr>
                <td style="padding:0 24px 24px;">
                  <h2 style="margin:0 0 16px;color:#111827;font-size:18px;font-weight:700;">Хүргэлтийн мэдээлэл</h2>
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#fffbeb;border:1px solid #fcd34d;border-radius:8px;">
                    <tr>
                      <td style="padding:16px 20px;">
                        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                          <tr>
                            <td style="padding:6px 0;color:#92400e;font-size:14px;">📅 Огноо</td>
                            <td align="right" style="padding:6px 0;color:#78350f;font-size:14px;font-weight:600;">${deliveryDate || 'Тодорхойгүй'}</td>
                          </tr>
                          ${deliveryTime ? `
                          <tr>
                            <td style="padding:6px 0;color:#92400e;font-size:14px;">🕐 Цаг</td>
                            <td align="right" style="padding:6px 0;color:#78350f;font-size:14px;font-weight:600;">${deliveryTime}</td>
                          </tr>
                          ` : ''}
                          ${deliveryAddress ? `
                          <tr>
                            <td colspan="2" style="padding:6px 0;color:#92400e;font-size:14px;">📍 Хаяг</td>
                          </tr>
                          <tr>
                            <td colspan="2" style="padding:0 0 6px;color:#78350f;font-size:14px;font-weight:600;">${deliveryAddress}</td>
                          </tr>
                          ` : ''}
                        </table>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
    
              <!-- Helper Message -->
              <tr>
                <td style="padding:0 24px 32px;">
                  <div style="background-color:#f0f9ff;border-left:4px solid #0284c7;padding:16px 20px;border-radius:4px;">
                    <p style="margin:0;color:#0c4a6e;font-size:14px;line-height:1.6;">
                      💡 Бид таны захиалгыг бэлтгэж дуусмагц хүргэлтийн мэдээллийг танд дахин илгээнэ.
                    </p>
                  </div>
                </td>
              </tr>
    
              <!-- Footer -->
              <tr>
                <td style="background-color:#f9fafb;padding:24px;text-align:center;border-top:1px solid #e5e7eb;">
                  <p style="margin:0 0 8px;color:#6b7280;font-size:13px;">Хүндэтгэсэн,</p>
                  <p style="margin:0;color:#111827;font-size:14px;font-weight:600;">${this.fromName}</p>
                </td>
              </tr>
    
            </table>
    
          </td>
        </tr>
      </table>
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
        const ebarimtReceiptId = ebarimtData.ebarimt_receipt_id || ebarimtData.ebarimtReceiptId || null;
        const ebarimtLottery = ebarimtData.ebarimt_lottery || ebarimtData.ebarimtLottery || null;
        const ebarimtAmountRaw = ebarimtData.amount ?? totalAmount ?? null;
        const ebarimtAmount = (ebarimtAmountRaw != null && ebarimtAmountRaw !== '') ? String(ebarimtAmountRaw) : null;
        const receiptUrl = ebarimtData.receipt_url || ebarimtData.url || null;
        const qrImage = ebarimtData.qr_image || ebarimtData.ebarimt_qr_image || null;
        const rawResponseText = this._formatEbarimtResponseForEmail(ebarimtData);
        const safeItems = Array.isArray(items) ? items : [];

        const subject = `Төлбөрийн баримт (И-Баримт) – Захиалга #${orderNumber}`;
        const text = `
Сайн байна уу,

Таны төлбөр амжилттай баталгаажлаа. Доор таны И-Баримтын мэдээллийг хүргэж байна.

Захиалгын дугаар: ${orderNumber}
Нийт дүн: ${totalAmount}₮
${deliveryDate ? `Хүргэлтийн огноо: ${deliveryDate}` : ''}
${deliveryAddress ? `Хүргэлтийн хаяг: ${deliveryAddress}` : ''}

Бараанууд:
- ${safeItems.length
            ? safeItems.map(item => {
                const qty = item.quantity != null ? String(item.quantity) : '';
                const unitPrice = item.unitPrice ?? item.price ?? '';
                const amount = item.amount ?? '';
                const unitPart = unitPrice !== '' ? ` (нэгж: ${unitPrice}₮)` : '';
                const amountPart = amount !== '' ? ` — ${amount}₮` : '';
                return `- ${item.name} x${qty}${unitPart}${amountPart}`;
            }).join('\n')
            : 'Барааны мэдээлэл байхгүй байна.'}

И-Баримтын дугаар: ${ebarimtId || 'Байхгүй'}
И-Баримтын баримтын дугаар: ${ebarimtReceiptId || 'Байхгүй'}
Сугалааны дугаар: ${ebarimtLottery || 'Байхгүй'}
Баримтын дүн: ${ebarimtAmount ? `${ebarimtAmount}₮` : 'Байхгүй'}
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
                ${safeItems.length ? `
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;margin-top:10px;">
                  <thead>
                    <tr style="background-color:#f9fafb;">
                      <th align="left" style="padding:10px 12px;color:#374151;font-size:13px;font-weight:600;border-bottom:1px solid #e5e7eb;">Бараа</th>
                      <th align="center" style="padding:10px 12px;color:#374151;font-size:13px;font-weight:600;border-bottom:1px solid #e5e7eb;">Тоо</th>
                      <th align="right" style="padding:10px 12px;color:#374151;font-size:13px;font-weight:600;border-bottom:1px solid #e5e7eb;">Нэгж үнэ</th>
                      <th align="right" style="padding:10px 12px;color:#374151;font-size:13px;font-weight:600;border-bottom:1px solid #e5e7eb;">Дүн</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${safeItems.map((item, idx) => {
                        const qty = item.quantity != null ? String(item.quantity) : '';
                        const unitPrice = item.unitPrice ?? item.price ?? '';
                        const amount = item.amount ?? '';
                        const border = idx < safeItems.length - 1 ? 'border-bottom:1px solid #f3f4f6;' : '';
                        return `
                    <tr style="${border}">
                      <td style="padding:10px 12px;color:#111827;font-size:14px;">${item.name}</td>
                      <td align="center" style="padding:10px 12px;color:#6b7280;font-size:14px;">${qty}</td>
                      <td align="right" style="padding:10px 12px;color:#111827;font-size:14px;">${unitPrice}${unitPrice !== '' ? '₮' : ''}</td>
                      <td align="right" style="padding:10px 12px;color:#111827;font-size:14px;font-weight:600;">${amount}${amount !== '' ? '₮' : ''}</td>
                    </tr>`;
                    }).join('')}
                  </tbody>
                </table>
                ` : `<p style="margin:8px 0;color:#6b7280;">Барааны мэдээлэл байхгүй байна.</p>`}
                </div>

                <div class="section receipt">
                <p><strong>И-Баримтын дугаар:</strong> ${ebarimtId || 'Байхгүй'}</p>
                <p><strong>И-Баримтын баримтын дугаар:</strong> ${ebarimtReceiptId || 'Байхгүй'}</p>
                <p><strong>Сугалааны дугаар:</strong> ${ebarimtLottery || 'Байхгүй'}</p>
                <p><strong>Баримтын дүн:</strong> ${ebarimtAmount ? `${ebarimtAmount}₮` : 'Байхгүй'}</p>
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
