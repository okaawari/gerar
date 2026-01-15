const cartService = require('../services/cartService');

class CartController {
    /**
     * Get user's or guest's cart
     * GET /api/cart
     */
    async getCart(req, res, next) {
        try {
            let cartItems;
            let isGuest = false;
            let sessionToken = null;

            // Check if user is authenticated
            if (req.user && req.user.id) {
                // Authenticated user
                cartItems = await cartService.getCart(req.user.id, null);
            } else {
                // Guest user - get session token from header or body
                sessionToken = req.headers['x-session-token'] || req.body.sessionToken;
                
                if (!sessionToken) {
                    // No session token - return empty cart and generate new token
                    sessionToken = cartService.generateSessionToken();
                    cartItems = [];
                } else {
                    cartItems = await cartService.getCartBySession(sessionToken);
                }
                isGuest = true;
            }

            res.status(200).json({
                success: true,
                message: 'Cart retrieved successfully',
                data: cartItems,
                isGuest: isGuest,
                sessionToken: isGuest ? sessionToken : undefined
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
            const { productId, quantity, sessionToken } = req.body;

            if (!productId || quantity === undefined) {
                const error = new Error('Product ID and quantity are required');
                error.statusCode = 400;
                throw error;
            }

            let cartItem;
            let isGuest = false;
            let returnedSessionToken = null;

            // Check if user is authenticated
            if (req.user && req.user.id) {
                // Authenticated user
                cartItem = await cartService.addToCart(req.user.id, null, productId, quantity);
            } else {
                // Guest user
                const guestSessionToken = sessionToken || req.headers['x-session-token'];
                
                if (!guestSessionToken) {
                    // Generate new session token for first-time guest
                    returnedSessionToken = cartService.generateSessionToken();
                    cartItem = await cartService.addToCartBySession(returnedSessionToken, productId, quantity);
                } else {
                    cartItem = await cartService.addToCartBySession(guestSessionToken, productId, quantity);
                    returnedSessionToken = guestSessionToken;
                }
                isGuest = true;
            }

            res.status(200).json({
                success: true,
                message: 'Item added to cart successfully',
                data: cartItem,
                isGuest: isGuest,
                sessionToken: isGuest ? returnedSessionToken : undefined
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
            const { productId } = req.params;
            const { quantity, sessionToken } = req.body;

            if (quantity === undefined) {
                const error = new Error('Quantity is required');
                error.statusCode = 400;
                throw error;
            }

            let cartItem;
            let isGuest = false;
            let returnedSessionToken = null;

            // Check if user is authenticated
            if (req.user && req.user.id) {
                // Authenticated user
                cartItem = await cartService.updateCartItem(req.user.id, null, productId, quantity);
            } else {
                // Guest user
                const guestSessionToken = sessionToken || req.headers['x-session-token'];
                
                if (!guestSessionToken) {
                    const error = new Error('Session token is required for guest cart operations');
                    error.statusCode = 400;
                    throw error;
                }

                cartItem = await cartService.updateCartItemBySession(guestSessionToken, productId, quantity);
                returnedSessionToken = guestSessionToken;
                isGuest = true;
            }

            res.status(200).json({
                success: true,
                message: 'Cart item updated successfully',
                data: cartItem,
                isGuest: isGuest,
                sessionToken: isGuest ? returnedSessionToken : undefined
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
            const { productId } = req.params;
            const { sessionToken } = req.body;

            let cartItem;
            let isGuest = false;
            let returnedSessionToken = null;

            // Check if user is authenticated
            if (req.user && req.user.id) {
                // Authenticated user
                cartItem = await cartService.removeFromCart(req.user.id, null, productId);
            } else {
                // Guest user
                const guestSessionToken = sessionToken || req.headers['x-session-token'];
                
                if (!guestSessionToken) {
                    const error = new Error('Session token is required for guest cart operations');
                    error.statusCode = 400;
                    throw error;
                }

                cartItem = await cartService.removeFromCartBySession(guestSessionToken, productId);
                returnedSessionToken = guestSessionToken;
                isGuest = true;
            }

            res.status(200).json({
                success: true,
                message: 'Item removed from cart successfully',
                data: cartItem,
                isGuest: isGuest,
                sessionToken: isGuest ? returnedSessionToken : undefined
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * Clear user's or guest's cart
     * POST /api/cart/clear
     */
    async clearCart(req, res, next) {
        try {
            const { sessionToken } = req.body;
            let deletedCount;
            let isGuest = false;
            let returnedSessionToken = null;

            // Check if user is authenticated
            if (req.user && req.user.id) {
                // Authenticated user
                deletedCount = await cartService.clearCart(req.user.id, null);
            } else {
                // Guest user
                const guestSessionToken = sessionToken || req.headers['x-session-token'];
                
                if (!guestSessionToken) {
                    const error = new Error('Session token is required for guest cart operations');
                    error.statusCode = 400;
                    throw error;
                }

                deletedCount = await cartService.clearCartBySession(guestSessionToken);
                returnedSessionToken = guestSessionToken;
                isGuest = true;
            }

            res.status(200).json({
                success: true,
                message: `Cart cleared successfully. ${deletedCount} item(s) removed.`,
                data: { deletedCount },
                isGuest: isGuest,
                sessionToken: isGuest ? returnedSessionToken : undefined
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * Merge guest cart to user cart (after login)
     * POST /api/cart/merge
     */
    async mergeCart(req, res, next) {
        try {
            const userId = req.user.id; // This route requires authentication
            const { sessionToken } = req.body;

            if (!sessionToken) {
                const error = new Error('Session token is required');
                error.statusCode = 400;
                throw error;
            }

            const result = await cartService.mergeGuestCartToUser(sessionToken, userId);

            res.status(200).json({
                success: true,
                message: `Cart merged successfully. ${result.mergedCount} item(s) merged, ${result.skippedCount} item(s) skipped.`,
                data: result
            });
        } catch (error) {
            next(error);
        }
    }
}

module.exports = new CartController();
