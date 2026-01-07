const express = require('express');
const cartController = require('../controllers/cartController');
const { authenticateUser } = require('../middleware/authMiddleware');

const router = express.Router();

// All cart routes require authentication
router.use(authenticateUser);

// Get user's cart
router.get('/', cartController.getCart);

// Add item to cart
router.post('/', cartController.addToCart);

// Clear user's cart (must come before parameterized routes)
router.delete('/', cartController.clearCart);

// Update cart item quantity
router.put('/:productId', cartController.updateCartItem);

// Remove item from cart
router.delete('/:productId', cartController.removeFromCart);

module.exports = router;

