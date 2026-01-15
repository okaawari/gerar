const express = require('express');
const cartController = require('../controllers/cartController');
const { authenticateUser, optionallyAuthenticateUser } = require('../middleware/authMiddleware');

const router = express.Router();

// Cart merge route (requires authentication) - must come before other routes
router.post('/merge', authenticateUser, cartController.mergeCart);

// All other cart routes support both authenticated and guest users
router.use(optionallyAuthenticateUser);

// Get user's or guest's cart
router.get('/', cartController.getCart);

// Add item to cart
router.post('/', cartController.addToCart);

// Clear user's or guest's cart (must come before parameterized routes)
router.post('/clear', cartController.clearCart);

// Update cart item quantity
router.post('/:productId/update', cartController.updateCartItem);

// Remove item from cart
router.post('/:productId/remove', cartController.removeFromCart);

module.exports = router;
