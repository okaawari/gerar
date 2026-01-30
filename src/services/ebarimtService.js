/**
 * Ebarimt (fiscal receipt) service – GERAR API
 * Creates ebarimt using the standard invoice payload structure (invoice_code, lines, etc.).
 * When EB_GERAR_API_URL is QPay (merchant.qpay.mn), uses QPay Bearer token; otherwise Basic auth.
 *
 * createEbarimtFromPayment: QPay simple API (payment_id + ebarimt_receiver_type + ebarimt_receiver).
 * Use this for payment callback flow; response shape matches QPay doc (id, ebarimt_receipt_id, ebarimt_qr_data, etc.).
 */

const axios = require('axios');
const qpayService = require('./qpayService');
const { getMongoliaTimestampISO } = require('../utils/dateUtils');

function getConfig() {
    return {
        client: process.env.EB_GERAR_CLIENT || 'GERAR',
        password: process.env.EB_GERAR_PASSWORD || '',
        invoice: process.env.EB_GERAR_INVOICE || 'EB_GERAR_INVOICE',
        apiUrl: process.env.EB_GERAR_API_URL || '',
        branchCode: process.env.EB_GERAR_BRANCH_CODE || 'TEST_BRANCH',
        districtCode: process.env.EB_GERAR_DISTRICT_CODE || '3505'
    };
}

/**
 * Build ebarimt payload from order (same structure as sample)
 * @param {Object} order - Order with items and product
 * @returns {Object} Payload for GERAR ebarimt API
 */
function buildPayload(order, config) {
    const baseUrl = process.env.API_BASE_URL || 'https://example.com';
    const callbackUrl = process.env.EBARIMT_CALLBACK_URL || `${baseUrl.replace(/\/$/, '')}/api/payments/ebarimt-callback`;

    const lines = (order.items || []).map((item) => {
        const itemPrice = parseFloat(item.price) || 0;
        const itemQuantity = parseFloat(item.quantity) || 1;
        const lineTotal = itemPrice * itemQuantity;
        // 10% VAT inclusive: VAT amount = lineTotal / 11
        const vatAmount = Math.round((lineTotal / 11) * 10000) / 10000;

        const productName = item.product?.name || `Product #${item.productId || 'Unknown'}`;
        const barcode = item.product?.barcode || '';

        return {
            tax_product_code: '',
            line_description: productName,
            barcode: barcode || '',
            line_quantity: itemQuantity.toFixed(2),
            line_unit_price: itemPrice.toFixed(2),
            note: item.product?.description || 'TEST',
            classification_code: '0111100',
            taxes: [
                {
                    tax_code: 'VAT',
                    description: 'НӨАТ',
                    amount: vatAmount,
                    note: 'НӨАТ'
                }
            ]
        };
    });

    return {
        invoice_code: config.invoice,
        sender_invoice_no: String(order.id),
        invoice_receiver_code: '23',
        sender_branch_code: config.branchCode,
        invoice_description: `Order #${order.id}`,
        callback_url: callbackUrl,
        tax_type: '1',
        district_code: config.districtCode,
        lines
    };
}

/**
 * Create Ebarimt from a QPay payment (simple API per QPay doc).
 * Request: payment_id, ebarimt_receiver_type (CITIZEN | COMPANY), optional ebarimt_receiver (phone or register no).
 * Response: id, ebarimt_receipt_id, ebarimt_qr_data, ebarimt_status, etc.
 * @param {string} paymentId - QPay payment ID from check payment
 * @param {Object} [options] - { ebarimtReceiverType: 'CITIZEN'|'COMPANY', ebarimtReceiver: phone or register no }
 * @returns {Promise<Object>} Normalized { ebarimt_id, receipt_url, ebarimt_receipt_id, ebarimt_qr_data, ebarimt_status, ... }
 */
async function createEbarimtFromPayment(paymentId, options = {}) {
    const receiverType = options.ebarimtReceiverType || 'CITIZEN';
    const ebarimtReceiver = options.ebarimtReceiver != null ? String(options.ebarimtReceiver).trim() : null;

    let data;
    try {
        data = await qpayService.createEbarimt(paymentId, receiverType, ebarimtReceiver || undefined);
    } catch (err) {
        const msg = err.message || 'Unknown error';
        throw new Error(`Failed to create Ebarimt receipt: ${msg}`);
    }

    const raw = data && typeof data === 'object' ? data : {};
    const isEmptyBody = Object.keys(raw).length === 0;

    if (isEmptyBody) {
        return {
            ebarimt_id: null,
            receipt_url: null,
            _raw_response: raw,
            _api_status: 200,
            _api_empty_body: true
        };
    }

    // Map QPay doc response: id → ebarimt_id; doc also has ebarimt_receipt_id, ebarimt_qr_data, ebarimt_status (or barimt_status)
    const ebarimtId = raw.id ?? raw.ebarimt_id ?? raw.invoice_id ?? raw.uuid ?? null;
    const receiptUrl = raw.receipt_url ?? raw.url ?? raw.receiptUrl ?? null;
    const ebarimtStatus = raw.ebarimt_status ?? raw.barimt_status ?? null;

    return {
        ebarimt_id: ebarimtId,
        receipt_url: receiptUrl,
        ebarimt_receipt_id: raw.ebarimt_receipt_id ?? null,
        ebarimt_qr_data: raw.ebarimt_qr_data ?? null,
        ebarimt_status: ebarimtStatus,
        ebarimt_lottery: raw.ebarimt_lottery ?? null,
        ...raw,
        _raw_response: raw,
        _api_status: 200,
        _api_empty_body: false
    };
}

/**
 * Create Ebarimt receipt via GERAR API
 * @param {Object} order - Order with items (include product for name, barcode)
 * @param {Object} [options] - For QPay ebarimt_v3: { paymentId, ebarimtReceiverType }
 * @returns {Promise<Object>} Normalized response { ebarimt_id, receipt_url, ... } for email/order update
 */
async function createEbarimt(order, options = {}) {
    const config = getConfig();
    if (!config.apiUrl) {
        throw new Error('EB_GERAR_API_URL is required for ebarimt');
    }

    let payload = buildPayload(order, config);
    const isQPay = config.apiUrl.includes('merchant.qpay.mn');

    if (isQPay) {
        const paymentId = options.paymentId ?? order.qpayPaymentId ?? '';
        payload = {
            ...payload,
            payment_id: paymentId,
            ebarimt_receiver_type: options.ebarimtReceiverType ?? 'CITIZEN'
        };
        if (!paymentId) {
            throw new Error('payment_id is required for QPay ebarimt_v3 (pass options.paymentId or ensure order has qpayPaymentId)');
        }
    }

    let authHeader;
    if (isQPay) {
        const token = await qpayService.getAccessToken();
        authHeader = `Bearer ${token}`;
    } else {
        if (!config.password) {
            throw new Error('EB_GERAR_PASSWORD is required for ebarimt (non-QPay API)');
        }
        const basic = Buffer.from(`${config.client}:${config.password}`).toString('base64');
        authHeader = `Basic ${basic}`;
    }

    try {
        const response = await axios.post(config.apiUrl, payload, {
            headers: {
                'Authorization': authHeader,
                'Content-Type': 'application/json'
            },
            timeout: 15000
        });
        const data = response.data || {};
        const isEmptyBody = Object.keys(data).length === 0;
        if (isEmptyBody) {
            console.warn('[Ebarimt] API returned empty body:', {
                status: response.status,
                statusText: response.statusText,
                headers: response.headers ? { 'content-type': response.headers['content-type'] } : {},
                orderId: order?.id
            });
        }
        const ebarimtId = data.id ?? data.ebarimt_id ?? data.invoice_id ?? data.uuid;
        const receiptUrl = data.url ?? data.receipt_url ?? data.receiptUrl;
        return {
            ebarimt_id: ebarimtId,
            receipt_url: receiptUrl,
            ...data,
            _raw_response: data,
            _api_status: response.status,
            _api_empty_body: isEmptyBody
        };
    } catch (error) {
        console.error('GERAR Create Ebarimt Error:', {
            message: error.message,
            status: error.response?.status,
            data: error.response?.data,
            orderId: order?.id,
            timestamp: getMongoliaTimestampISO()
        });
        const msg = error.response?.data?.message ?? error.response?.data?.error ?? error.message;
        throw new Error(`Failed to create Ebarimt receipt: ${msg}`);
    }
}

module.exports = {
    createEbarimt,
    createEbarimtFromPayment,
    buildPayload
};
