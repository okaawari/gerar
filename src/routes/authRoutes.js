const express = require('express');
const authController = require('../controllers/authController');
const { validateUserRegistration, validateUserLogin, validateProfileUpdate } = require('../middleware/validation');
const { authenticateUser } = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/register', validateUserRegistration, authController.register);
router.post('/login', validateUserLogin, authController.login);
router.post('/forgot-password', authController.requestPasswordReset);
router.post('/reset-password', authController.resetPassword);

// Profile (authenticated) - must be before any :id routes
// NOTE: Use POST only where possible — see IMPORTANT_NOTE.md. GET /me and POST /me both return profile.
router.get('/me', authenticateUser, authController.getMe);
router.post('/me', authenticateUser, authController.getMe); // POST for environments that allow only POST
router.post('/me/update', authenticateUser, validateProfileUpdate, authController.updateProfile);

module.exports = router;
