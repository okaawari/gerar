const express = require('express');
const router = express.Router();
const simpleOrderController = require('../controllers/simpleOrderController');
const { optionallyAuthenticateUser } = require('../middleware/authMiddleware');

/**
 * @route   POST /api/simple-orders/send-otp
 * @desc    Send OTP to phone number for simple order
 * @access  Public
 */
router.post('/send-otp', simpleOrderController.requestOTP);

/**
 * @route   POST /api/simple-orders/create
 * @desc    Create simple order from cart with OTP verification
 * @access  Public (Optional Auth)
 */
router.post('/create', optionallyAuthenticateUser, simpleOrderController.createOrder);

module.exports = router;
