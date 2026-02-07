const axios = require('axios');
const fs = require('fs');
const path = require('path');

/**
 * QPAY Service
 * Handles all QPAY API interactions including authentication, invoice creation,
 * payment verification, and Ebarimt receipt generation.
 */
class QPayService {
    constructor() {
        this.apiUrl = process.env.QPAY_API_URL || 'https://merchant.qpay.mn/v2';
        this.username = process.env.QPAY_USERNAME;
        this.password = process.env.QPAY_PASSWORD;
        this.invoiceCode = process.env.QPAY_INVOICE_CODE;
        /** Ebarimt/VAT invoice code from QPay (НӨАТ-ийн мэдээлэлтэй нэхэмжлэхийн код). Falls back to QPAY_INVOICE_CODE. */
        this.ebarimtInvoiceCode = process.env.QPAY_EBARIMT_INVOICE_CODE || process.env.QPAY_INVOICE_CODE;
        this.callbackBaseUrl = process.env.QPAY_CALLBACK_BASE_URL;
        /** District code for ebarimt invoice (Төлбөрийн баримтын байршлын код). */
        this.districtCode = process.env.QPAY_DISTRICT_CODE || process.env.EB_GERAR_DISTRICT_CODE || '3505';

        // Token cache - critical: one token per timestamp
        this.tokenCache = {
            token: null,
            timestamp: null,
            expiresAt: null
        };

        // TEST MODE: Simple counter for sender_invoice_no to test if order ID format is causing QR code issues
        this.testInvoiceCounter = 1;
    }

    /**
     * Retry helper with exponential backoff
     * @param {Function} fn - Function to retry
     * @param {number} maxRetries - Maximum number of retries
     * @param {number} delay - Initial delay in ms
     * @returns {Promise} Result of function
     */
    async retryWithBackoff(fn, maxRetries = 3, delay = 1000) {
        let lastError;
        for (let i = 0; i < maxRetries; i++) {
            try {
                return await fn();
            } catch (error) {
                lastError = error;
                // Don't retry on 4xx errors (client errors)
                if (error.response && error.response.status >= 400 && error.response.status < 500) {
                    throw error;
                }
                // Wait before retrying (exponential backoff)
                if (i < maxRetries - 1) {
                    const waitTime = delay * Math.pow(2, i);
                    console.log(`QPAY API call failed, retrying in ${waitTime}ms... (attempt ${i + 1}/${maxRetries})`);
                    await new Promise(resolve => setTimeout(resolve, waitTime));
                }
            }
        }
        throw lastError;
    }

    /**
     * SAFE retry helper for invoice creation - ONLY retries on definite network failures
     * CRITICAL: Invoice creation is NOT idempotent on QPay side. If QPay received the request,
     * retrying will create duplicate invoices which corrupts ebarimt state.
     * 
     * Only retry when we are CERTAIN the request never reached QPay:
     * - ECONNRESET, ECONNREFUSED, ETIMEDOUT, ENOTFOUND (network layer failures)
     * - NO response object (request definitely didn't complete)
     * 
     * DO NOT retry if:
     * - Any HTTP response was received (even 5xx - QPay may have processed it)
     * - Timeout occurred (request may have reached QPay)
     * - Unclear error state
     * 
     * @param {Function} fn - Function to execute (should be invoice creation)
     * @param {string} orderId - Order ID for logging
     * @returns {Promise} Result of function
     */
    async safeInvoiceRequest(fn, orderId) {
        // Network errors that definitively mean request never reached QPay
        const SAFE_TO_RETRY_CODES = ['ECONNREFUSED', 'ENOTFOUND', 'ECONNRESET'];

        try {
            return await fn();
        } catch (error) {
            // If we got ANY response from QPay, DO NOT retry - the invoice may exist
            if (error.response) {
                console.error(`[QPAY IDEMPOTENCY] Order ${orderId}: Got HTTP ${error.response.status} - NOT retrying (invoice may exist)`);
                throw error;
            }

            // Only retry on specific network errors where we KNOW request didn't reach QPay
            if (error.code && SAFE_TO_RETRY_CODES.includes(error.code)) {
                console.log(`[QPAY IDEMPOTENCY] Order ${orderId}: Network error ${error.code} - safe to retry once`);
                // Single retry after 2 seconds
                await new Promise(resolve => setTimeout(resolve, 2000));
                return await fn();
            }

            // For timeout or unknown errors, DO NOT retry - request may have reached QPay
            console.error(`[QPAY IDEMPOTENCY] Order ${orderId}: Error '${error.code || error.message}' - NOT retrying (uncertain state)`);
            throw error;
        }
    }

    /**
     * Get access token with timestamp-based caching
     * CRITICAL: Only fetch one token per timestamp as per QPAY requirements
     * @returns {Promise<string>} Access token
     */
    async getAccessToken() {
        // Use permanent token if available
        if (process.env.QPAY_PERMANENT_TOKEN) {
            return process.env.QPAY_PERMANENT_TOKEN;
        }

        const currentTimestamp = Math.floor(Date.now() / 1000);

        // Check if we have a valid cached token (use it if not expired, regardless of timestamp)
        if (this.tokenCache.token &&
            this.tokenCache.expiresAt &&
            Date.now() < this.tokenCache.expiresAt) {
            // Token is still valid, use cached token
            return this.tokenCache.token;
        }

        // If we have a token but it's from a different timestamp and expired, we need a new one
        // CRITICAL: Only fetch one token per timestamp as per QPAY requirements
        // If timestamp changed, we must fetch a new token even if old one hasn't expired yet
        if (this.tokenCache.timestamp && this.tokenCache.timestamp !== currentTimestamp) {
            // Timestamp changed, need new token (QPAY requirement)
            this.tokenCache = {
                token: null,
                timestamp: null,
                expiresAt: null
            };
        }

        try {
            // Validate QPAY credentials are configured
            if (!this.username || !this.password) {
                throw new Error('QPAY credentials not configured. Please set QPAY_USERNAME and QPAY_PASSWORD environment variables.');
            }

            // Create Basic Auth header
            const credentials = Buffer.from(`${this.username}:${this.password}`).toString('base64');

            // Only log if we don't have a cached token (to reduce log noise)
            if (!this.tokenCache.token) {
                console.log(`Fetching QPAY access token from ${this.apiUrl}/auth/token...`);
            }

            const response = await this.retryWithBackoff(async () => {
                return await axios.post(
                    `${this.apiUrl}/auth/token`,
                    {},
                    {
                        headers: {
                            'Authorization': `Basic ${credentials}`,
                            'Content-Type': 'application/json'
                        },
                        timeout: 10000 // 10 second timeout
                    }
                );
            });

            if (!response.data || !response.data.access_token) {
                throw new Error('Invalid token response from QPAY API - access_token missing');
            }

            const token = response.data.access_token;
            const expiresIn = response.data.expires_in || 3600; // Default to 1 hour

            // Cache the token with current timestamp
            this.tokenCache = {
                token: token,
                timestamp: currentTimestamp,
                expiresAt: Date.now() + (expiresIn * 1000) - 60000 // Subtract 1 minute for safety
            };

            if (!this.tokenCache.token) {
                console.log('QPAY access token obtained successfully');
            }
            return token;
        } catch (error) {
            console.error('QPAY Token Error:', {
                message: error.message,
                status: error.response?.status,
                statusText: error.response?.statusText,
                data: error.response?.data,
                code: error.code,
                apiUrl: this.apiUrl,
                timestamp: new Date().toISOString()
            });

            // Provide more helpful error messages
            if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
                throw new Error(`Cannot connect to QPAY API at ${this.apiUrl}. Please check your network connection and QPAY_API_URL configuration.`);
            } else if (error.response?.status === 401) {
                throw new Error('QPAY authentication failed. Please check QPAY_USERNAME and QPAY_PASSWORD credentials.');
            } else if (error.response?.status === 404) {
                throw new Error(`QPAY API endpoint not found: ${this.apiUrl}/auth/token. Please check QPAY_API_URL configuration.`);
            }

            throw new Error(`Failed to get QPAY access token: ${error.message}`);
        }
    }

    /**
     * Create QPAY invoice (detailed with tax lines)
     * @param {Object} order - Order object
     * @param {Object} invoiceData - Additional invoice data (receiver info, lines, etc.)
     * @returns {Promise<Object>} Invoice response with invoice_id and QR code
     */
    async createInvoice(order, invoiceData = {}) {
        try {
            // ═══════════════════════════════════════════════════════════════════
            // IDEMPOTENCY CHECK: If order already has an invoice, DO NOT create another
            // This is the CRITICAL guard against duplicate invoice creation
            // ═══════════════════════════════════════════════════════════════════
            const existingInvoiceId = order.qpayInvoiceId || order.qpay_invoice_id;
            console.log(`[QPAY IDEMPOTENCY] Creating invoice for order ${order.id}, existingInvoiceId: ${existingInvoiceId || 'null'}`);

            if (existingInvoiceId) {
                console.warn(`[QPAY IDEMPOTENCY] ⚠️ Order ${order.id} ALREADY has invoice ${existingInvoiceId} - ABORTING creation`);
                throw new Error(`Order ${order.id} already has invoice ${existingInvoiceId}. Cannot create duplicate.`);
            }

            const token = await this.getAccessToken();

            // Build callback URL (strip trailing slash from base to avoid // in path)
            const base = (this.callbackBaseUrl || '').replace(/\/$/, '');
            const callbackUrl = `${base}/orders/${order.id}/payment-callback`;
            console.log(`📞 Callback URL for QPAY: ${callbackUrl}`);
            console.log(`🌐 QPAY API URL: ${this.apiUrl}/invoice`);

            // TEMPORARY TEST MODE: Use simple sequential integer (1, 2, 3...) for sender_invoice_no
            // This tests if the order ID format change (from INT to VARCHAR like "260126010") is causing QR code scanning issues
            // TODO: Remove this test mode after confirming if order ID format is the issue
            const senderInvoiceNo = String(this.testInvoiceCounter++);
            console.log(`🧪 TEST MODE: Using simple sender_invoice_no: ${senderInvoiceNo} (original order.id: ${order.id})`);
            console.log(`[QPAY] Creating invoice with sender_invoice_no: ${senderInvoiceNo} (type: ${typeof senderInvoiceNo}, length: ${senderInvoiceNo.length})`);

            const invoicePayload = {
                invoice_code: this.invoiceCode,
                sender_invoice_no: senderInvoiceNo,
                invoice_receiver_code: invoiceData.receiverCode,
                sender_branch_code: invoiceData.branchCode || 'GERAR_ONLINE',
                invoice_description: invoiceData.description || `Order #${order.id} - ${parseFloat(order.totalAmount).toFixed(2)} MNT`,
                allow_partial: invoiceData.allowPartial || false,
                minimum_amount: invoiceData.minimumAmount || null,
                allow_exceed: invoiceData.allowExceed || false,
                maximum_amount: invoiceData.maximumAmount || null,
                amount: parseFloat(order.totalAmount),
                callback_url: callbackUrl,
                sender_staff_code: invoiceData.staffCode || 'gerar_online',
                note: invoiceData.note || null
            };

            // Add receiver data if provided
            if (invoiceData.receiverData) {
                invoicePayload.invoice_receiver_data = invoiceData.receiverData;
            }

            // Add invoice lines if provided (for detailed invoice)
            if (invoiceData.lines && invoiceData.lines.length > 0) {
                invoicePayload.lines = invoiceData.lines;
            }

            // ═══════════════════════════════════════════════════════════════════
            // CRITICAL: Use safe invoice request - NO blind retries on invoice creation!
            // QPay does NOT support idempotent invoice creation. Retrying can create
            // duplicate invoices which causes tenant errors during ebarimt.
            // ═══════════════════════════════════════════════════════════════════
            const response = await this.safeInvoiceRequest(async () => {
                return await axios.post(
                    `${this.apiUrl}/invoice`,
                    invoicePayload,
                    {
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'application/json'
                        },
                        timeout: 15000
                    }
                );
            }, order.id);

            // Log full QPAY response to see what fields are returned
            console.log('QPAY API Response Keys:', Object.keys(response.data));
            console.log('QPAY API Response Sample:', {
                invoice_id: response.data.invoice_id,
                qr_image: response.data.qr_image ? `Present (${response.data.qr_image.length} bytes)` : 'MISSING',
                qr_code: response.data.qr_code ? `Present (${response.data.qr_code.length} bytes)` : 'MISSING',
            });

            return response.data;
        } catch (error) {
            console.error('QPAY Create Invoice Error:', {
                message: error.message,
                status: error.response?.status,
                data: error.response?.data,
                orderId: order.id,
                timestamp: new Date().toISOString()
            });
            const errorMessage = error.response?.data?.message || error.message;
            throw new Error(`Failed to create QPAY invoice: ${errorMessage}`);
        }
    }

    /**
     * Create QPAY invoice with ebarimt (VAT) data – same POST /v2/invoice with ebarimt payload.
     * Uses: invoice_code (VAT invoice code), tax_type, district_code, invoice_receiver_data, lines with taxes.
     * No amount/allow_partial; total is derived from lines.
     * @param {Object} order - Order object
     * @param {Object} invoiceData - { receiverCode, receiverData, description, branchCode, taxType, districtCode, lines }
     * @returns {Promise<Object>} Invoice response (invoice_id, qr_text, qr_image, qPay_shortUrl, urls)
     */
    async createEbarimtInvoice(order, invoiceData = {}) {
        try {
            // ═══════════════════════════════════════════════════════════════════
            // IDEMPOTENCY CHECK: If order already has an invoice, DO NOT create another
            // This is the CRITICAL guard against duplicate invoice creation
            // ═══════════════════════════════════════════════════════════════════
            const existingInvoiceId = order.qpayInvoiceId || order.qpay_invoice_id;
            console.log(`[QPAY IDEMPOTENCY] Creating invoice for order ${order.id}, existingInvoiceId: ${existingInvoiceId || 'null'}`);

            if (existingInvoiceId) {
                console.warn(`[QPAY IDEMPOTENCY] ⚠️ Order ${order.id} ALREADY has invoice ${existingInvoiceId} - ABORTING creation`);
                throw new Error(`Order ${order.id} already has invoice ${existingInvoiceId}. Cannot create duplicate.`);
            }

            const token = await this.getAccessToken();
            const base = (this.callbackBaseUrl || '').replace(/\/$/, '');
            const callbackUrl = `${base}/orders/${order.id}/payment-callback`;
            console.log(`📞 Callback URL for QPAY: ${callbackUrl}`);
            console.log(`🌐 QPAY API URL: ${this.apiUrl}/invoice`);

            const senderInvoiceNo = String(order.id).replace(/[^\w\-]/g, '');
            const districtCode = invoiceData.districtCode || this.districtCode;
            const taxType = invoiceData.taxType || '1';
            const receiver = invoiceData.receiverData || {};
            const receiverPhone = (receiver.phone != null ? String(receiver.phone) : '') || (receiver.phoneNumber != null ? String(receiver.phoneNumber) : '');
            const invoiceReceiverCode = receiverPhone || (order.userId != null ? String(order.userId) : '') || `RECV-${senderInvoiceNo}`;
            console.log(`[QPAY] Creating ebarimt invoice for order ${order.id}, sender_invoice_no: ${senderInvoiceNo} (type: ${typeof senderInvoiceNo}, length: ${senderInvoiceNo.length}), district: ${districtCode}`);

            const branchCode = invoiceData.branchCode != null ? String(invoiceData.branchCode) : 'GERAR_BRANCH';
            const payload = {
                invoice_code: this.ebarimtInvoiceCode,
                sender_invoice_no: senderInvoiceNo,
                invoice_receiver_code: invoiceReceiverCode,
                invoice_description: (invoiceData.description || `Order #${order.id}`).substring(0, 255),
                tax_type: taxType,
                district_code: districtCode,
                callback_url: callbackUrl,
                sender_branch_code: branchCode,
                lines: invoiceData.lines || []
            };

            if (invoiceData.staffCode != null) payload.sender_staff_code = invoiceData.staffCode;

            payload.invoice_receiver_data = {
                register: receiver.register != null ? String(receiver.register) : '',
                name: receiver.name != null ? String(receiver.name) : 'Customer',
                email: receiver.email != null ? String(receiver.email) : '',
                phone: receiver.phone != null ? String(receiver.phone) : (receiver.phoneNumber != null ? String(receiver.phoneNumber) : '')
            };

            if (!payload.lines.length) {
                throw new Error('Ebarimt invoice requires at least one line item');
            }

            // Save exact request and response to file (for debugging)
            const requestUrl = `${this.apiUrl}/invoice`;
            const outPath = path.join(__dirname, '..', '..', 'ebarimt_invoice_request_sent.json');
            const requestToSave = {
                _comment: 'Exact request and response when creating QPAY ebarimt invoice. Saved on each create.',
                savedAt: new Date().toISOString(),
                orderId: order.id,
                method: 'POST',
                url: requestUrl,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: payload
            };

            // ═══════════════════════════════════════════════════════════════════
            // CRITICAL: Use safe invoice request - NO blind retries on invoice creation!
            // QPay does NOT support idempotent invoice creation. Retrying can create
            // duplicate invoices which causes tenant errors during ebarimt.
            // ═══════════════════════════════════════════════════════════════════
            const response = await this.safeInvoiceRequest(async () => {
                return await axios.post(
                    requestUrl,
                    payload,
                    {
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'application/json'
                        },
                        timeout: 15000
                    }
                );
            }, order.id);

            requestToSave.response = {
                status: response.status,
                statusText: response.statusText,
                data: response.data
            };
            try {
                fs.writeFileSync(outPath, JSON.stringify(requestToSave, null, 2), 'utf8');
                console.log('[QPAY] Ebarimt invoice request and response saved to', outPath);
            } catch (writeErr) {
                console.warn('[QPAY] Could not save request/response to file:', writeErr.message);
            }

            // Log full QPAY response to see what fields are returned
            console.log('QPAY Ebarimt Invoice Response Keys:', Object.keys(response.data));
            console.log('QPAY Ebarimt Invoice Response Sample:', {
                invoice_id: response.data.invoice_id,
                qr_image: response.data.qr_image ? `Present (${response.data.qr_image.length} bytes)` : 'MISSING',
                qr_code: response.data.qr_code ? `Present (${response.data.qr_code.length} bytes)` : 'MISSING',
            });
            // Return token so controller can store on order; ebarimt-from-invoice will reuse same token
            return {
                ...response.data,
                _token: token,
                _tokenExpiresAt: this.tokenCache.expiresAt
            };
        } catch (error) {
            console.error('QPAY Create Ebarimt Invoice Error:', {
                message: error.message,
                status: error.response?.status,
                data: error.response?.data,
                orderId: order.id,
                timestamp: new Date().toISOString()
            });
            const errorMessage = error.response?.data?.message || error.message;
            throw new Error(`Failed to create QPAY ebarimt invoice: ${errorMessage}`);
        }
    }

    /**
     * Check payment status for an invoice
     * @param {string} invoiceId - QPAY invoice ID
     * @returns {Promise<Object>} Payment status information
     */
    async checkPayment(invoiceId) {
        try {
            const token = await this.getAccessToken();

            const response = await this.retryWithBackoff(async () => {
                return await axios.post(
                    `${this.apiUrl}/payment/check`,
                    {
                        object_type: 'INVOICE',
                        object_id: invoiceId,
                        offset: {
                            page_number: 1,
                            page_limit: 100
                        }
                    },
                    {
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'application/json'
                        },
                        timeout: 10000
                    }
                );
            });

            return response.data;
        } catch (error) {
            console.error('QPAY Check Payment Error:', {
                message: error.message,
                status: error.response?.status,
                data: error.response?.data,
                invoiceId: invoiceId,
                timestamp: new Date().toISOString()
            });
            const errorMessage = error.response?.data?.message || error.message;
            throw new Error(`Failed to check QPAY payment: ${errorMessage}`);
        }
    }

    /**
     * Get payment details by payment ID
     * @param {string} paymentId - QPAY payment ID
     * @returns {Promise<Object>} Payment details
     */
    async getPayment(paymentId) {
        try {
            const token = await this.getAccessToken();

            const response = await this.retryWithBackoff(async () => {
                return await axios.get(
                    `${this.apiUrl}/payment/${paymentId}`,
                    {
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'application/json'
                        },
                        timeout: 10000
                    }
                );
            });

            return response.data;
        } catch (error) {
            console.error('QPAY Get Payment Error:', {
                message: error.message,
                status: error.response?.status,
                data: error.response?.data,
                paymentId: paymentId,
                timestamp: new Date().toISOString()
            });
            const errorMessage = error.response?.data?.message || error.message;
            throw new Error(`Failed to get QPAY payment: ${errorMessage}`);
        }
    }

    /**
     * Cancel unpaid invoice
     * @param {string} invoiceId - QPAY invoice ID
     * @returns {Promise<Object>} Cancellation response
     */
    async cancelInvoice(invoiceId) {
        try {
            const token = await this.getAccessToken();

            const response = await this.retryWithBackoff(async () => {
                return await axios.delete(
                    `${this.apiUrl}/invoice/${invoiceId}`,
                    {
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'application/json'
                        },
                        timeout: 10000
                    }
                );
            });

            return response.data || {};
        } catch (error) {
            console.error('QPAY Cancel Invoice Error:', {
                message: error.message,
                status: error.response?.status,
                data: error.response?.data,
                invoiceId: invoiceId,
                timestamp: new Date().toISOString()
            });
            const errorMessage = error.response?.data?.message || error.message;
            throw new Error(`Failed to cancel QPAY invoice: ${errorMessage}`);
        }
    }

    /**
     * Cancel payment (for paid invoices)
     * @param {string} paymentId - QPAY payment ID
     * @param {Object} cancelData - Cancel data (callback_url, note)
     * @returns {Promise<Object>} Cancellation response
     */
    async cancelPayment(paymentId, cancelData = {}) {
        try {
            const token = await this.getAccessToken();

            const response = await this.retryWithBackoff(async () => {
                return await axios.delete(
                    `${this.apiUrl}/payment/cancel/${paymentId}`,
                    {
                        data: {
                            callback_url: cancelData.callbackUrl || null,
                            note: cancelData.note || 'Payment cancellation'
                        },
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'application/json'
                        },
                        timeout: 10000
                    }
                );
            });

            return response.data || {};
        } catch (error) {
            console.error('QPAY Cancel Payment Error:', {
                message: error.message,
                status: error.response?.status,
                data: error.response?.data,
                paymentId: paymentId,
                timestamp: new Date().toISOString()
            });
            const errorMessage = error.response?.data?.message || error.message;
            throw new Error(`Failed to cancel QPAY payment: ${errorMessage}`);
        }
    }

    /**
     * Refund payment
     * @param {string} paymentId - QPAY payment ID
     * @returns {Promise<Object>} Refund response
     */
    async refundPayment(paymentId) {
        try {
            const token = await this.getAccessToken();

            const response = await this.retryWithBackoff(async () => {
                return await axios.delete(
                    `${this.apiUrl}/payment/refund/${paymentId}`,
                    {
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'application/json'
                        },
                        timeout: 10000
                    }
                );
            });

            return response.data || {};
        } catch (error) {
            console.error('QPAY Refund Payment Error:', {
                message: error.message,
                status: error.response?.status,
                data: error.response?.data,
                paymentId: paymentId,
                timestamp: new Date().toISOString()
            });
            const errorMessage = error.response?.data?.message || error.message;
            throw new Error(`Failed to refund QPAY payment: ${errorMessage}`);
        }
    }

    /**
     * Create Ebarimt receipt (simple API: payment_id + ebarimt_receiver_type + optional ebarimt_receiver)
     * @param {string} paymentId - QPAY payment ID
     * @param {string} receiverType - Receiver type (default: 'CITIZEN'); COMPANY for AAN
     * @param {string} [ebarimtReceiver] - Optional: phone for CITIZEN, register no for COMPANY
     * @returns {Promise<Object>} Raw Ebarimt API response
     */
    async createEbarimt(paymentId, receiverType = 'CITIZEN', ebarimtReceiver = null) {
        try {
            const token = await this.getAccessToken();
            const body = {
                payment_id: paymentId,
                ebarimt_receiver_type: receiverType
            };
            if (ebarimtReceiver != null && ebarimtReceiver !== '') {
                body.ebarimt_receiver = String(ebarimtReceiver);
            }
            const requestUrl = `${this.apiUrl}/ebarimt/create`;
            const requestToSave = {
                _comment: 'Exact request sent when taking ebarimt from paid invoice (ebarimt/create). Saved on each create.',
                savedAt: new Date().toISOString(),
                paymentId,
                method: 'POST',
                url: requestUrl,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body
            };
            const outPath = path.join(__dirname, '..', '..', 'ebarimt_from_invoice_request_sent.json');
            try {
                fs.writeFileSync(outPath, JSON.stringify(requestToSave, null, 2), 'utf8');
                console.log('[QPAY] Ebarimt-from-invoice request saved to', outPath);
            } catch (writeErr) {
                console.warn('[QPAY] Could not save ebarimt-from-invoice request to file:', writeErr.message);
            }
            const response = await this.retryWithBackoff(async () => {
                return await axios.post(
                    `${this.apiUrl}/ebarimt/create`,
                    body,
                    {
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'application/json'
                        },
                        timeout: 15000
                    }
                );
            });

            return response.data;
        } catch (error) {
            console.error('QPAY Create Ebarimt Error:', {
                message: error.message,
                status: error.response?.status,
                data: error.response?.data,
                paymentId,
                receiverType,
                ebarimtReceiver: ebarimtReceiver ?? undefined,
                timestamp: new Date().toISOString()
            });
            const errorMessage = error.response?.data?.message || error.response?.data?.error || error.message;
            throw new Error(`Failed to create Ebarimt receipt: ${errorMessage}`);
        }
    }

    /**
     * Clear token cache (useful for testing or forced refresh)
     */
    clearTokenCache() {
        this.tokenCache = {
            token: null,
            timestamp: null,
            expiresAt: null
        };
    }
}

// Export singleton instance
module.exports = new QPayService();
