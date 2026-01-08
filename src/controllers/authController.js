const authService = require('../services/authService');

class AuthController {
    /**
     * Handle user registration
     * POST /api/auth/register
     */
    async register(req, res, next) {
        try {
            const { phoneNumber, pin, name, email } = req.body;

            const result = await authService.register({ phoneNumber, pin, name, email });

            res.status(201).json({
                success: true,
                message: 'User registered successfully',
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
                message: 'Login successful',
                data: result,
            });
        } catch (error) {
            next(error);
        }
    }
}

module.exports = new AuthController();
