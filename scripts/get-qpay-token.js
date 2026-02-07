/**
 * Fetch a new QPay access token from the API.
 * Uses QPAY_USERNAME and QPAY_PASSWORD from .env.
 *
 * Run from project root: node scripts/get-qpay-token.js
 */

const path = require('path');
const axios = require('axios');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const apiUrl = process.env.QPAY_API_URL || 'https://merchant.qpay.mn/v2';
const username = process.env.QPAY_USERNAME;
const password = process.env.QPAY_PASSWORD;

async function getToken() {
    if (!username || !password) {
        console.error('Missing QPAY_USERNAME or QPAY_PASSWORD in .env');
        process.exit(1);
    }

    const credentials = Buffer.from(`${username}:${password}`).toString('base64');
    const url = `${apiUrl}/auth/token`;

    try {
        const response = await axios.post(
            url,
            {},
            {
                headers: {
                    Authorization: `Basic ${credentials}`,
                    'Content-Type': 'application/json',
                },
                timeout: 10000,
            }
        );

        const data = response.data;
        if (!data.access_token) {
            console.error('Response missing access_token:', data);
            process.exit(1);
        }

        const token = data.access_token;
        const expiresIn = data.expires_in ?? 3600;

        console.log('QPay access token obtained successfully.\n');
        console.log('access_token:', token);
        console.log('expires_in:', expiresIn, 'seconds');
        console.log('\nTo use this as a permanent token in .env, add or update:');
        console.log('QPAY_PERMANENT_TOKEN=' + token);
    } catch (error) {
        console.error('QPay token error:', {
            message: error.message,
            status: error.response?.status,
            data: error.response?.data,
        });
        process.exit(1);
    }
}

getToken();
