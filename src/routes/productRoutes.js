const express = require('express');
const productController = require('../controllers/productController');
const { optionallyAuthenticateUser } = require('../middleware/authMiddleware');

const router = express.Router();

// Public routes with optional authentication (to check favorite status if logged in)
router.get('/', optionallyAuthenticateUser, productController.getAllProducts);
router.get('/sale', optionallyAuthenticateUser, productController.getProductsOnSale);
router.get('/:id', optionallyAuthenticateUser, productController.getProductById);

module.exports = router;

