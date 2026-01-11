const express = require('express');
const orderController = require('../controllers/orderController');
const { authenticateUser, optionallyAuthenticateUser } = require('../middleware/authMiddleware');

const router = express.Router();

// Buy now - Guest checkout (optional auth) - must be before authenticated routes
router.post('/buy-now', optionallyAuthenticateUser, orderController.buyNow);

// Finalize order - Convert draft to real order (requires auth) - must be before /:id route
router.post('/finalize', authenticateUser, orderController.finalizeOrder);

// All other order routes require authentication
router.use(authenticateUser);

// Create order from cart
router.post('/', orderController.createOrder);

// Get user's order history
router.get('/', orderController.getUserOrders);

// Get order by ID
router.get('/:id', orderController.getOrderById);

module.exports = router;
