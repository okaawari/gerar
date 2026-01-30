/**
 * Ebarimt v3 API test script
 * Calls https://merchant.qpay.mn/v2/ebarimt_v3/create with the sample payload,
 * saves the response to ebarimt_test_response.json, and emails it to noxious0510@gmail.com
 *
 * Requires: EBARIMT_TEST_PAYMENT_ID in .env (a real QPay payment ID from a completed payment)
 * Optional: EBARIMT_RECEIVER_TYPE (default: CITIZEN)
 *
 * Run from project root: node scripts/test-ebarimt-v3.js
 */

const path = require('path');
const fs = require('fs');
const axios = require('axios');

// Load .env from project root
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const EBARIMT_V3_URL = 'https://merchant.qpay.mn/v2/ebarimt_v3/create';
const RESPONSE_FILE = path.join(__dirname, '..', 'ebarimt_test_response.json');
const EMAIL_TO = 'noxious0510@gmail.com';

/** Build full payload: QPay sample + required payment_id and ebarimt_receiver_type */
function buildEbarimtPayload() {
    const paymentId = process.env.EBARIMT_TEST_PAYMENT_ID;
    if (!paymentId) {
        throw new Error(
            'EBARIMT_TEST_PAYMENT_ID is required. Add it to .env with a real QPay payment ID from a completed payment.'
        );
    }
    return {
        payment_id: paymentId,
        ebarimt_receiver_type: process.env.EBARIMT_RECEIVER_TYPE || 'CITIZEN',
        invoice_code: "TEST_INVOICE",
        sender_invoice_no: "TEST_INVOICE_16",
        invoice_receiver_code: "23",
        sender_branch_code: "TEST_BRANCH",
        invoice_description: "Test invoice",
        callback_url: "https://example.com/callback",
        tax_type: "1",
        district_code: "3505",
        lines: [
        {
            tax_product_code: "",
            line_description: "Улаан буудайн үр",
            barcode: "8434165457768",
            line_quantity: "1.00",
            line_unit_price: "50.00",
            note: "TEST",
            classification_code: "0111100",
            taxes: [
                {
                    tax_code: "VAT",
                    description: "НӨАТ",
                    amount: 4.5454,
                    note: "НӨАТ"
                }
            ]
        },
        {
            tax_product_code: "",
            line_description: "Улаан буудайн үр",
            barcode: "8434165457768",
            line_quantity: "1.00",
            line_unit_price: "100.00",
            note: "TEST",
            classification_code: "0111100",
            taxes: [
                {
                    tax_code: "VAT",
                    description: "НӨАТ",
                    amount: 9.0909,
                    note: "НӨАТ"
                }
            ]
        }
    ]
    };
}

async function getQPayToken() {
    const apiUrl = process.env.QPAY_API_URL || 'https://merchant.qpay.mn/v2';
    const username = process.env.QPAY_USERNAME;
    const password = process.env.QPAY_PASSWORD;
    if (!username || !password) {
        throw new Error('QPAY_USERNAME and QPAY_PASSWORD must be set in .env');
    }
    const credentials = Buffer.from(`${username}:${password}`).toString('base64');
    const response = await axios.post(
        `${apiUrl}/auth/token`,
        {},
        {
            headers: {
                'Authorization': `Basic ${credentials}`,
                'Content-Type': 'application/json'
            },
            timeout: 10000
        }
    );
    if (!response.data || !response.data.access_token) {
        throw new Error('Invalid token response from QPAY API');
    }
    return response.data.access_token;
}

async function createEbarimtV3(token, payload) {
    const response = await axios.post(EBARIMT_V3_URL, payload, {
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        timeout: 15000,
        validateStatus: () => true // accept any status so we can save error responses too
    });
    return { status: response.status, data: response.data };
}

function saveResponse(result, payload) {
    const toSave = {
        timestamp: new Date().toISOString(),
        request: { url: EBARIMT_V3_URL, payload },
        response: result
    };
    fs.writeFileSync(RESPONSE_FILE, JSON.stringify(toSave, null, 2), 'utf8');
    console.log('Response saved to:', RESPONSE_FILE);
    return toSave;
}

async function sendEmail(saved) {
    const emailService = require(path.join(__dirname, '..', 'src', 'services', 'emailService.js'));
    const bodyText = `Ebarimt v3 test result\n\nStatus: ${saved.response.status}\n\nFull response:\n${JSON.stringify(saved.response, null, 2)}`;
    const result = await emailService.sendEmail(
        EMAIL_TO,
        `Ebarimt v3 test – ${saved.response.status} – ${new Date().toISOString()}`,
        bodyText,
        `<pre>${bodyText.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>`,
        [
            {
                filename: 'ebarimt_test_response.json',
                content: JSON.stringify(saved, null, 2)
            }
        ]
    );
    if (result.success) {
        console.log('Email sent to', EMAIL_TO);
    } else {
        console.warn('Email failed:', result.message || result.error);
    }
    return result;
}

async function main() {
    console.log('Ebarimt v3 test – calling', EBARIMT_V3_URL);
    try {
        const payload = buildEbarimtPayload();
        console.log('Payload: payment_id =', payload.payment_id, ', ebarimt_receiver_type =', payload.ebarimt_receiver_type);
        const token = await getQPayToken();
        console.log('QPay token obtained');
        const result = await createEbarimtV3(token, payload);
        console.log('API response status:', result.status);
        const saved = saveResponse(result, payload);
        await sendEmail(saved);
        console.log('Done.');
    } catch (err) {
        let errorPayload = null;
        try { errorPayload = buildEbarimtPayload(); } catch (_) {}
        const errorResult = {
            timestamp: new Date().toISOString(),
            request: { url: EBARIMT_V3_URL, payload: errorPayload },
            error: err.message,
            response: err.response ? { status: err.response.status, data: err.response.data } : undefined
        };
        fs.writeFileSync(RESPONSE_FILE, JSON.stringify(errorResult, null, 2), 'utf8');
        console.error('Error:', err.message);
        const emailService = require(path.join(__dirname, '..', 'src', 'services', 'emailService.js'));
        await emailService.sendEmail(
            EMAIL_TO,
            `Ebarimt v3 test – ERROR – ${new Date().toISOString()}`,
            `Ebarimt v3 test failed.\n\nError: ${err.message}\n\nSaved response file content:\n${JSON.stringify(errorResult, null, 2)}`
        );
        process.exit(1);
    }
}

main();
