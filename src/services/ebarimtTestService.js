/**
 * Ebarimt Test Service
 * When payment is made, calls QPay ebarimt_v3/create with minimal payload only:
 *   { payment_id, ebarimt_receiver_type: "CITIZEN", ebarimt_receiver }
 * URL: https://merchant.qpay.mn/v2/ebarimt_v3/create
 * Uses QPay Bearer token. Same response shape as ebarimtService.createEbarimtFromPayment.
 */

const axios = require('axios');
const qpayService = require('./qpayService');

const EBARIMT_V3_CREATE_URL = 'https://merchant.qpay.mn/v2/ebarimt_v3/create';

/**
 * Create Ebarimt from payment (test flow): POST to ebarimt_v3/create with only
 * payment_id, ebarimt_receiver_type, ebarimt_receiver.
 *
 * @param {string} paymentId - QPay payment ID
 * @param {Object} [options] - { ebarimtReceiverType: 'CITIZEN'|'COMPANY', ebarimtReceiver: string }
 * @returns {Promise<Object>} Normalized { ebarimt_id, receipt_url, ebarimt_receipt_id, ... }
 */
async function createEbarimtFromPayment(paymentId, options = {}) {
    const receiverType = options.ebarimtReceiverType || 'CITIZEN';
    const ebarimtReceiver = options.ebarimtReceiver != null
        ? String(options.ebarimtReceiver).trim()
        : '80650025';

    const body = {
        payment_id: String(paymentId),
        ebarimt_receiver_type: receiverType,
        ebarimt_receiver: ebarimtReceiver
    };

    let raw = {};
    try {
        const token = await qpayService.getAccessToken();
        const response = await axios.post(EBARIMT_V3_CREATE_URL, body, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            timeout: 15000
        });
        raw = response.data && typeof response.data === 'object' ? response.data : {};
    } catch (err) {
        const msg = err.response?.data?.message ?? err.response?.data?.error ?? err.message;
        throw new Error(`Failed to create Ebarimt receipt (test): ${msg}`);
    }

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

module.exports = {
    createEbarimtFromPayment
};
