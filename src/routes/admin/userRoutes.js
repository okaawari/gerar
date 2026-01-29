const express = require('express');
const userController = require('../../controllers/userController');
const { authenticateUser, authorizeAdmin, authorizeSuperAdmin } = require('../../middleware/authMiddleware');

const router = express.Router();

// All admin routes require authentication and admin role
router.use(authenticateUser, authorizeAdmin);

// Admin user management routes
router.get('/', userController.getAllUsers);
router.get('/:id', userController.getUserById);
router.post('/:id/reset-password', userController.generateResetCode);
router.post('/:id/reset-password/execute', userController.resetPassword);

// Super admin only routes
router.post('/:id/role', authorizeSuperAdmin, userController.updateUserRole);

module.exports = router;
