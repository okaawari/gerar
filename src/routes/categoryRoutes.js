const express = require('express');
const categoryController = require('../controllers/categoryController');

const router = express.Router();

// Public routes (no authentication required)
router.get('/', categoryController.getAllCategories);
router.get('/:id', categoryController.getCategoryById);
router.get('/:id/products', categoryController.getCategoryProducts);

module.exports = router;

