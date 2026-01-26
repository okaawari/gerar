const express = require('express');
const paymentController = require('../controllers/paymentController');
const { authenticateUser, optionallyAuthenticateUser } = require('../middleware/authMiddleware');

const router = express.Router();

// Public callback endpoint - QPAY will call this without authentication
router.post('/orders/:id/payment-callback', paymentController.paymentCallback);

// Payment initiation - requires authentication (user or admin can initiate their own orders)
router.post('/orders/:id/initiate-payment', optionallyAuthenticateUser, paymentController.initiatePayment);

// Get payment status - requires authentication
router.get('/orders/:id/payment-status', optionallyAuthenticateUser, paymentController.getPaymentStatus);

// Cancel payment - requires authentication
router.post('/orders/:id/cancel-payment', optionallyAuthenticateUser, paymentController.cancelPayment);

// Refund payment - admin only
router.post('/orders/:id/refund', authenticateUser, paymentController.refundPayment);

module.exports = router;
