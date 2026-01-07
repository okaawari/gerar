const express = require('express');
const orderController = require('../controllers/orderController');
const { authenticateUser, authorizeAdmin } = require('../middleware/authMiddleware');

const router = express.Router();

// All order routes require authentication
router.use(authenticateUser);

// Create order from cart
router.post('/', orderController.createOrder);

// Get user's order history
router.get('/', orderController.getUserOrders);

// Get all orders (admin only) - must come before /:id route
router.get('/all', authorizeAdmin, orderController.getAllOrders);

// Get order by ID
router.get('/:id', orderController.getOrderById);

module.exports = router;
