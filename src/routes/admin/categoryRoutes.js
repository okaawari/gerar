const express = require('express');
const categoryController = require('../../controllers/categoryController');
const { authenticateUser, authorizeAdmin } = require('../../middleware/authMiddleware');

const router = express.Router();

// All admin routes require authentication and admin role
router.use(authenticateUser, authorizeAdmin);

// Admin category management routes
router.get('/', categoryController.getAllCategories); // View all categories with subcategories
router.post('/', categoryController.createCategory);
router.post('/:id/update', categoryController.updateCategory);
router.post('/:id/delete', categoryController.deleteCategory);

module.exports = router;
