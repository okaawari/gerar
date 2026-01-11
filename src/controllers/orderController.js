const orderService = require('../services/orderService');
const draftOrderService = require('../services/draftOrderService');

class OrderController {
    /**
     * Create order from user's cart
     * POST /api/orders
     */
    async createOrder(req, res, next) {
        try {
            const userId = req.user.id;
            const { addressId, deliveryTimeSlot } = req.body;
            
            const order = await orderService.createOrderFromCart(userId, addressId, deliveryTimeSlot);

            res.status(201).json({
                success: true,
                message: 'Order created successfully',
                data: order
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * Buy now - Create draft order (works for both authenticated and guest users)
     * POST /api/orders/buy-now
     */
    async buyNow(req, res, next) {
        try {
            const { productId, quantity, sessionToken } = req.body;
            
            // Validate required fields
            if (!productId || !quantity) {
                const error = new Error('Product ID and quantity are required');
                error.statusCode = 400;
                throw error;
            }

            // Create draft order (works for both authenticated and guest users)
            const draftOrder = await draftOrderService.createDraftOrder(productId, quantity, sessionToken);

            // Determine if authentication is required
            // If user is not authenticated, they'll need to authenticate to finalize
            const requiresAuth = !req.user || !req.user.id;

            res.status(201).json({
                success: true,
                message: 'Draft order created successfully. Please finalize order with address.',
                data: {
                    draftOrder,
                    sessionToken: draftOrder.sessionToken,
                    requiresAuth: requiresAuth,
                    nextStep: 'finalize-order'
                }
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * Finalize order - Convert draft order to real order (requires authentication)
     * POST /api/orders/finalize
     */
    async finalizeOrder(req, res, next) {
        try {
            const userId = req.user.id;
            const { sessionToken, addressId, deliveryTimeSlot, address } = req.body;

            if (!sessionToken) {
                const error = new Error('Session token is required');
                error.statusCode = 400;
                throw error;
            }

            // Get draft order
            const draftOrder = await draftOrderService.getDraftOrder(sessionToken);

            // Finalize the order (convert draft to real order)
            const order = await orderService.finalizeOrderFromDraft(
                userId,
                draftOrder,
                addressId,
                address,
                deliveryTimeSlot
            );

            // Delete draft order after successful conversion
            await draftOrderService.deleteDraftOrder(sessionToken);

            res.status(201).json({
                success: true,
                message: 'Order finalized successfully',
                data: order
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * Get user's order history
     * GET /api/orders
     */
    async getUserOrders(req, res, next) {
        try {
            const userId = req.user.id;
            const orders = await orderService.getUserOrders(userId);

            res.status(200).json({
                success: true,
                message: 'Orders retrieved successfully',
                data: orders
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * Get all orders (admin only)
     * GET /api/orders/all
     */
    async getAllOrders(req, res, next) {
        try {
            const orders = await orderService.getAllOrders();

            res.status(200).json({
                success: true,
                message: 'All orders retrieved successfully',
                data: orders
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * Get order by ID
     * GET /api/orders/:id
     */
    async getOrderById(req, res, next) {
        try {
            const userId = req.user.id;
            const isAdmin = req.user.role === 'ADMIN';
            const { id } = req.params;

            const order = await orderService.getOrderById(id, userId, isAdmin);

            res.status(200).json({
                success: true,
                message: 'Order retrieved successfully',
                data: order
            });
        } catch (error) {
            next(error);
        }
    }
}

module.exports = new OrderController();
