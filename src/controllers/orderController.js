const orderService = require('../services/orderService');

class OrderController {
    /**
     * Create order from user's cart
     * POST /api/orders
     */
    async createOrder(req, res, next) {
        try {
            const userId = req.user.id;
            const order = await orderService.createOrderFromCart(userId);

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
