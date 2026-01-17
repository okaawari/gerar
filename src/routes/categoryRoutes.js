const express = require('express');
const categoryController = require('../controllers/categoryController');
const { optionallyAuthenticateUser } = require('../middleware/authMiddleware');

const router = express.Router();

// Public routes with optional authentication (to check favorite status if logged in)
router.get('/', categoryController.getAllCategories);
router.get('/:id', categoryController.getCategoryById);
router.get('/:id/products', optionallyAuthenticateUser, categoryController.getCategoryProducts);

module.exports = router;

