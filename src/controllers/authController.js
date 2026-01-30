const authService = require('../services/authService');
const userService = require('../services/userService');

class AuthController {
    /**
     * Handle user registration (requires OTP verification)
     * POST /api/auth/register
     */
    async register(req, res, next) {
        try {
            const { phoneNumber, pin, name, email, otpCode } = req.body;

            const result = await authService.register({ phoneNumber, pin, name, email, otpCode });

            res.status(201).json({
                success: true,
                message: 'Хэрэглэгч амжилттай бүртгэгдлээ',
                data: result,
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * Handle user login
     * POST /api/auth/login
     */
    async login(req, res, next) {
        try {
            const { phoneNumber, pin } = req.body;

            const result = await authService.login({ phoneNumber, pin });

            res.status(200).json({
                success: true,
                message: 'Нэвтрэх амжилттай',
                data: result,
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * Request password reset
     * POST /api/auth/forgot-password
     */
    async requestPasswordReset(req, res, next) {
        try {
            const { phoneNumber } = req.body;

            const result = await authService.requestPasswordReset(phoneNumber);

            res.status(200).json({
                success: true,
                message: result.message,
                data: {
                    // In production, don't return resetCode - send via SMS
                    resetCode: result.resetCode,
                    resetToken: result.resetToken,
                    expiresAt: result.expiresAt,
                    resetLink: result.resetLink,
                },
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * Reset password using code
     * POST /api/auth/reset-password
     */
    async resetPassword(req, res, next) {
        try {
            const { phoneNumber, resetCode, newPin, resetToken } = req.body;

            const result = await authService.resetPassword({
                phoneNumber,
                resetCode,
                newPin,
                resetToken,
            });

            res.status(200).json({
                success: true,
                message: result.message,
                data: {
                    user: result.user,
                    token: result.token,
                },
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * Get current user profile (authenticated)
     * GET /api/auth/me
     */
    async getMe(req, res, next) {
        try {
            const user = await userService.getCurrentUser(req.user.id);

            res.status(200).json({
                success: true,
                message: 'Profile retrieved successfully',
                data: user,
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * Update current user profile (name and/or email)
     * PATCH /api/auth/me
     */
    async updateProfile(req, res, next) {
        try {
            const { name, email } = req.body;

            const user = await userService.updateProfile(req.user.id, { name, email });

            res.status(200).json({
                success: true,
                message: 'Profile updated successfully',
                data: user,
            });
        } catch (error) {
            next(error);
        }
    }
}

module.exports = new AuthController();
