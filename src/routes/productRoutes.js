const express = require('express');
const productController = require('../controllers/productController');
const { authenticateUser, authorizeAdmin } = require('../middleware/authMiddleware');

const router = express.Router();

// Public routes (no authentication required)
router.get('/', productController.getAllProducts);
router.get('/:id', productController.getProductById);

// Admin only routes (require authentication and admin role)
router.post('/', authenticateUser, authorizeAdmin, productController.createProduct);
router.put('/:id', authenticateUser, authorizeAdmin, productController.updateProduct);
router.delete('/:id', authenticateUser, authorizeAdmin, productController.deleteProduct);

module.exports = router;

