const express = require('express');
const adminProfileController = require('../../controllers/adminProfileController');
const { authenticateUser, authorizeAdmin } = require('../../middleware/authMiddleware');
const { validateRequiredFields } = require('../../middleware/validation');

const router = express.Router();

// All admin profile routes require authentication and admin role
router.use(authenticateUser, authorizeAdmin);

// GET /admin/profile — Get current admin's profile
router.get('/', adminProfileController.getProfile);

// POST /admin/profile — Update admin's profile info
router.post('/', validateRequiredFields(['name']), adminProfileController.updateProfile);

// POST /admin/profile/change-pin — Change admin's PIN code
router.post(
    '/change-pin',
    validateRequiredFields(['currentPin', 'newPin', 'confirmPin']),
    adminProfileController.changePin
);

module.exports = router;
