const express = require('express');
const categoryController = require('../controllers/categoryController');
const { authenticateUser, authorizeAdmin } = require('../middleware/authMiddleware');

const router = express.Router();

// Public routes (no authentication required)
router.get('/', categoryController.getAllCategories);
router.get('/:id', categoryController.getCategoryById);
router.get('/:id/products', categoryController.getCategoryProducts);

// Admin only routes (require authentication and admin role)
router.post('/', authenticateUser, authorizeAdmin, categoryController.createCategory);
router.put('/:id', authenticateUser, authorizeAdmin, categoryController.updateCategory);
router.delete('/:id', authenticateUser, authorizeAdmin, categoryController.deleteCategory);

module.exports = router;

