const express = require('express');
const orderController = require('../../controllers/orderController');
const { authenticateUser, authorizeAdmin } = require('../../middleware/authMiddleware');

const router = express.Router();

// All admin routes require authentication and admin role
router.use(authenticateUser, authorizeAdmin);

// Admin order management routes
router.get('/all', orderController.getAllOrders);

module.exports = router;
