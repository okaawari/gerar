const express = require('express');
const favoriteController = require('../controllers/favoriteController');
const { authenticateUser } = require('../middleware/authMiddleware');

const router = express.Router();

// All favorite routes require authentication
router.use(authenticateUser);

// Get user's favorites
router.get('/', favoriteController.getFavorites);

// Check if product is favorited (must come before parameterized routes)
router.get('/:productId/status', favoriteController.checkFavoriteStatus);

// Add product to favorites
router.post('/', favoriteController.addFavorite);

// Remove product from favorites
router.delete('/:productId', favoriteController.removeFavorite);

module.exports = router;
