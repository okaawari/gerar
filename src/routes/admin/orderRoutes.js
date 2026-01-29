const express = require('express');
const orderController = require('../../controllers/orderController');
const { authenticateUser, authorizeAdmin } = require('../../middleware/authMiddleware');

const router = express.Router();

// All admin routes require authentication and admin role
router.use(authenticateUser, authorizeAdmin);

// Admin order management routes
router.get('/all', orderController.getAllOrders);
// More specific routes must come before /:id
router.post('/:id/request-cancellation', orderController.requestCancellation);
router.post('/:id/confirm-cancellation', orderController.confirmCancellation);
router.post('/:id/status', orderController.updateOrderStatus);
// Get order by ID (must be last to avoid matching /:id/* routes)
router.get('/:id', orderController.getOrderById);

module.exports = router;
