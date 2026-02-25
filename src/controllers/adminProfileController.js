const adminProfileService = require('../services/adminProfileService');
const { sendSuccess } = require('../utils/response');

class AdminProfileController {
    /**
     * GET /admin/profile — Get current admin's profile
     */
    async getProfile(req, res, next) {
        try {
            const user = await adminProfileService.getProfile(req.user.id);
            return sendSuccess(res, user, 'Profile fetched successfully');
        } catch (error) {
            next(error);
        }
    }

    /**
     * POST /admin/profile — Update admin's profile info
     */
    async updateProfile(req, res, next) {
        try {
            const { name, email, phoneNumber } = req.body;
            const user = await adminProfileService.updateProfile(req.user.id, {
                name,
                email,
                phoneNumber,
            });
            return sendSuccess(res, user, 'Profile updated successfully');
        } catch (error) {
            next(error);
        }
    }

    /**
     * POST /admin/profile/change-pin — Change admin's PIN code
     */
    async changePin(req, res, next) {
        try {
            const { currentPin, newPin, confirmPin } = req.body;
            const result = await adminProfileService.changePin(req.user.id, {
                currentPin,
                newPin,
                confirmPin,
            });
            return sendSuccess(res, null, result.message);
        } catch (error) {
            next(error);
        }
    }
}

module.exports = new AdminProfileController();
