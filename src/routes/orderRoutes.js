const express = require('express');
const orderController = require('../controllers/orderController');
const { authenticateUser, optionallyAuthenticateUser } = require('../middleware/authMiddleware');

const router = express.Router();

// Buy now - Guest checkout (optional auth) - must be before authenticated routes
router.post('/buy-now', optionallyAuthenticateUser, orderController.buyNow);

// Create order from cart - Supports both authenticated and guest checkout
router.post('/', optionallyAuthenticateUser, orderController.createOrder);

// Finalize order - Convert draft to real order (requires auth) - must be before /:id route
router.post('/finalize', authenticateUser, orderController.finalizeOrder);

// All other order routes require authentication
router.use(authenticateUser);

// Get user's order history (authenticated only)
router.get('/', orderController.getUserOrders);

// Get order by ID
router.get('/:id', orderController.getOrderById);

module.exports = router;
