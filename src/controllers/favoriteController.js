const favoriteService = require('../services/favoriteService');

class FavoriteController {
    /**
     * Get user's favorite products
     * GET /api/favorites?page=1&limit=20
     */
    async getFavorites(req, res, next) {
        try {
            const userId = req.user.id;
            const { page, limit } = req.query;

            const result = await favoriteService.getFavorites(userId, { page, limit });

            res.status(200).json({
                success: true,
                message: 'Favorites retrieved successfully',
                data: result.products,
                pagination: result.pagination
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * Add product to favorites
     * POST /api/favorites
     * Body: { productId }
     */
    async addFavorite(req, res, next) {
        try {
            const userId = req.user.id;
            const { productId } = req.body;

            if (!productId) {
                const error = new Error('Product ID is required');
                error.statusCode = 400;
                throw error;
            }

            const product = await favoriteService.addFavorite(userId, productId);

            res.status(200).json({
                success: true,
                message: 'Product added to favorites successfully',
                data: product,
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * Remove product from favorites
     * DELETE /api/favorites/:productId
     */
    async removeFavorite(req, res, next) {
        try {
            const userId = req.user.id;
            const { productId } = req.params;

            const product = await favoriteService.removeFavorite(userId, productId);

            res.status(200).json({
                success: true,
                message: 'Product removed from favorites successfully',
                data: product,
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * Check if product is favorited
     * GET /api/favorites/:productId/status
     */
    async checkFavoriteStatus(req, res, next) {
        try {
            const userId = req.user.id;
            const { productId } = req.params;

            const isFavorited = await favoriteService.isFavorited(userId, productId);

            res.status(200).json({
                success: true,
                message: 'Favorite status retrieved successfully',
                data: {
                    productId: parseInt(productId),
                    isFavorited
                },
            });
        } catch (error) {
            next(error);
        }
    }
}

module.exports = new FavoriteController();
