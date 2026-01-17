const otpService = require('../services/otpService');

class OTPController {
    /**
     * Send OTP to phone number
     * POST /api/otp/send
     */
    async sendOTP(req, res, next) {
        try {
            const { phoneNumber, purpose } = req.body;

            if (!phoneNumber) {
                return res.status(400).json({
                    success: false,
                    message: 'Phone number is required'
                });
            }

            const result = await otpService.sendOTP(phoneNumber, purpose || 'VERIFICATION');

            res.status(200).json({
                success: true,
                message: result.message,
                data: {
                    expiresAt: result.expiresAt,
                    expiresInMinutes: result.expiresInMinutes
                }
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * Verify OTP code
     * POST /api/otp/verify
     */
    async verifyOTP(req, res, next) {
        try {
            const { phoneNumber, code, purpose } = req.body;

            if (!phoneNumber || !code) {
                return res.status(400).json({
                    success: false,
                    message: 'Phone number and OTP code are required'
                });
            }

            const result = await otpService.verifyOTP(phoneNumber, code, purpose || 'VERIFICATION');

            res.status(200).json({
                success: true,
                message: result.message,
                data: {
                    verified: true
                }
            });
        } catch (error) {
            next(error);
        }
    }
}

module.exports = new OTPController();
