const express = require('express');
const otpController = require('../controllers/otpController');

const router = express.Router();

/**
 * @route   POST /api/otp/send
 * @desc    Send OTP to phone number
 * @access  Public
 * @body    { phoneNumber: string, purpose?: string }
 */
router.post('/send', otpController.sendOTP);

/**
 * @route   POST /api/otp/verify
 * @desc    Verify OTP code
 * @access  Public
 * @body    { phoneNumber: string, code: string, purpose?: string }
 */
router.post('/verify', otpController.verifyOTP);

module.exports = router;
