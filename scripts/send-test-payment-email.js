// scripts/send-mail.js (өсөхөөр тааж ашиглана)
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const emailService = require('../src/services/emailService');

const TEST_RECIPIENT = 'noxious0510@gmail.com';

async function main() {
  const orderData = {
    orderNumber: 'TEST-001',
    orderDate: '2026-02-09',
    totalAmount: '150,000₮',
    items: [
      { name: 'Test Product A', quantity: 2, price: '50,000₮' },
      { name: 'Test Product B', quantity: 1, price: '50,000₮' }
    ],
    deliveryDate: '2026-02-15',
    deliveryTime: '14:00 - 18:00',
    deliveryAddress: 'Улаанбаатар, Баянзүрх дүүрэг, 1-р хороо, Жигжид 2'
  };

  try {
    console.log('Sending test order receipt to', TEST_RECIPIENT);
    const result = await emailService.sendOrderReceipt(TEST_RECIPIENT, orderData);
    console.log('Sent successfully. MessageId:', result.messageId || result.messageId);
  } catch (err) {
    console.error('Failed to send:', err);
    process.exit(1);
  }
}

main();
