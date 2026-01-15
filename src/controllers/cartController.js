const cartService = require('../services/cartService');

class CartController {
    /**
     * Get user's cart
     * GET /api/cart
     */
    async getCart(req, res, next) {
        try {
            const userId = req.user.id;
            const cartItems = await cartService.getCart(userId);

            res.status(200).json({
                success: true,
                message: 'Cart retrieved successfully',
                data: cartItems,
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * Add item to cart
     * POST /api/cart
     */
    async addToCart(req, res, next) {
        try {
            const userId = req.user.id;
            const { productId, quantity } = req.body;

            if (!productId || quantity === undefined) {
                const error = new Error('Product ID and quantity are required');
                error.statusCode = 400;
                throw error;
            }

            const cartItem = await cartService.addToCart(userId, productId, quantity);

            res.status(200).json({
                success: true,
                message: 'Item added to cart successfully',
                data: cartItem,
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * Update cart item quantity
     * POST /api/cart/:productId/update
     */
    async updateCartItem(req, res, next) {
        try {
            const userId = req.user.id;
            const { productId } = req.params;
            const { quantity } = req.body;

            if (quantity === undefined) {
                const error = new Error('Quantity is required');
                error.statusCode = 400;
                throw error;
            }

            const cartItem = await cartService.updateCartItem(userId, productId, quantity);

            res.status(200).json({
                success: true,
                message: 'Cart item updated successfully',
                data: cartItem,
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * Remove item from cart
     * POST /api/cart/:productId/remove
     */
    async removeFromCart(req, res, next) {
        try {
            const userId = req.user.id;
            const { productId } = req.params;

            const cartItem = await cartService.removeFromCart(userId, productId);

            res.status(200).json({
                success: true,
                message: 'Item removed from cart successfully',
                data: cartItem,
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * Clear user's cart
     * POST /api/cart/clear
     */
    async clearCart(req, res, next) {
        try {
            const userId = req.user.id;
            const deletedCount = await cartService.clearCart(userId);

            res.status(200).json({
                success: true,
                message: `Cart cleared successfully. ${deletedCount} item(s) removed.`,
                data: { deletedCount },
            });
        } catch (error) {
            next(error);
        }
    }
}

module.exports = new CartController();

