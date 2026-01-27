const express = require('express');
const { authenticateUser, authorizeAdmin } = require('../../middleware/authMiddleware');
const analyticsController = require('../../controllers/analyticsController');

const router = express.Router();

// All admin routes require authentication and admin role
router.use(authenticateUser, authorizeAdmin);

// Revenue analytics endpoints
router.get('/revenue/overview', analyticsController.getRevenueOverview);
router.get('/revenue/trends', analyticsController.getRevenueTrends);
router.get('/revenue/products', analyticsController.getRevenueByProduct);
router.get('/revenue/categories', analyticsController.getRevenueByCategory);
router.get('/revenue/customers', analyticsController.getRevenueByCustomer);
router.get('/revenue/payment-methods', analyticsController.getRevenueByPaymentMethod);
router.get('/revenue/dashboard', analyticsController.getDashboardSummary);

module.exports = router;
