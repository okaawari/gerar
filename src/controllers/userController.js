const userService = require('../services/userService');

class UserController {
    /**
     * Get all users (Admin only)
     * GET /api/admin/users
     */
    async getAllUsers(req, res, next) {
        try {
            const filters = {
                search: req.query.search,
                role: req.query.role,
                page: parseInt(req.query.page) || 1,
                limit: parseInt(req.query.limit) || 50,
            };

            const result = await userService.getAllUsers(filters);

            res.status(200).json({
                success: true,
                message: 'Users retrieved successfully',
                data: result.users,
                pagination: result.pagination,
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * Get user by ID with full details (Admin only)
     * GET /api/admin/users/:id
     */
    async getUserById(req, res, next) {
        try {
            const { id } = req.params;

            const user = await userService.getUserById(id);

            res.status(200).json({
                success: true,
                message: 'User retrieved successfully',
                data: user,
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * Generate password reset code/link for user (Admin only)
     * POST /api/admin/users/:id/reset-password
     */
    async generateResetCode(req, res, next) {
        try {
            const { id } = req.params;

            const result = await userService.generatePasswordResetCode(id);

            res.status(200).json({
                success: true,
                message: 'Password reset code generated successfully',
                data: result,
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * Reset user password (Admin can reset for any user)
     * POST /api/admin/users/:id/reset-password/execute
     */
    async resetPassword(req, res, next) {
        try {
            const { id } = req.params;
            const { resetCode, newPin, resetToken } = req.body;

            if (!newPin) {
                const error = new Error('New PIN is required');
                error.statusCode = 400;
                throw error;
            }

            const result = await userService.resetUserPassword(
                id,
                resetCode,
                newPin,
                resetToken
            );

            res.status(200).json({
                success: true,
                message: result.message,
                data: { userId: result.userId },
            });
        } catch (error) {
            next(error);
        }
    }
}

module.exports = new UserController();
