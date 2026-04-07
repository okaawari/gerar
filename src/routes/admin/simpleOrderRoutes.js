const express = require('express');
const simpleOrderController = require('../../controllers/simpleOrderController');
const { authenticateUser, authorizeAdmin } = require('../../middleware/authMiddleware');

const router = express.Router();

// All admin routes require authentication and admin role
router.use(authenticateUser, authorizeAdmin);

/**
 * @route   GET /api/admin/simple-orders/all
 * @desc    Get all simple orders
 * @access  Admin only
 */
router.get('/all', simpleOrderController.getAllOrders);

/**
 * @route   POST /api/admin/simple-orders/:id/status
 * @desc    Update simple order status
 * @access  Admin only
 */
router.post('/:id/status', simpleOrderController.updateOrderStatus);

/**
 * @route   GET /api/admin/simple-orders/:id
 * @desc    Get simple order by id
 * @access  Admin only
 */
router.get('/:id', simpleOrderController.getOrderById);

module.exports = router;
