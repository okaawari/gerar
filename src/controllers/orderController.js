const orderService = require('../services/orderService');
const draftOrderService = require('../services/draftOrderService');
const addressService = require('../services/addressService');

class OrderController {
    /**
     * Create order from user's cart or guest cart
     * POST /api/orders
     */
    async createOrder(req, res, next) {
        try {
            const { addressId, address, deliveryTimeSlot, deliveryDate, sessionToken } = req.body;
            
            let order;
            let isGuest = false;

            // Check if user is authenticated
            if (req.user && req.user.id) {
                // Authenticated user - use addressId
                if (!addressId) {
                    const error = new Error('Address ID is required for authenticated users');
                    error.statusCode = 400;
                    throw error;
                }
                order = await orderService.createOrderFromCart(req.user.id, null, addressId, null, deliveryTimeSlot, deliveryDate);
            } else {
                // Guest user - use address object and sessionToken
                const guestSessionToken = sessionToken || req.headers['x-session-token'];
                
                if (!guestSessionToken) {
                    const error = new Error('Session token is required for guest checkout');
                    error.statusCode = 400;
                    throw error;
                }

                if (!address) {
                    const error = new Error('Address object is required for guest checkout');
                    error.statusCode = 400;
                    throw error;
                }

                order = await orderService.createOrderFromCart(null, guestSessionToken, null, address, deliveryTimeSlot, deliveryDate);
                isGuest = true;
            }

            res.status(201).json({
                success: true,
                message: 'Захиалга амжилттай үүслээ',
                data: order,
                isGuest: isGuest
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * Buy now - Smart routing:
     * - Authenticated user with addressId → Direct order creation (1-step)
     * - Authenticated user without addressId → Draft order (2-step, choose address)
     * - Guest user → Draft order (2-step, guest checkout)
     * POST /api/orders/buy-now
     */
    async buyNow(req, res, next) {
        try {
            const { productId, quantity, sessionToken, addressId, deliveryTimeSlot, deliveryDate } = req.body;
            
            // Validate required fields
            if (!productId || !quantity) {
                const error = new Error('Product ID and quantity are required');
                error.statusCode = 400;
                throw error;
            }

            // If user is authenticated AND provided addressId → create direct order (1-step checkout)
            if (req.user && req.user.id && addressId) {
                const order = await orderService.buyNow(
                    req.user.id, 
                    productId, 
                    quantity, 
                    addressId, 
                    deliveryTimeSlot,
                    deliveryDate
                );
                
                return res.status(201).json({
                    success: true,
                    message: 'Order created successfully',
                    data: order
                });
            }

            // Otherwise, create draft order (for both authenticated users without addressId and guests)
            const draftOrder = await draftOrderService.createDraftOrder(productId, quantity, sessionToken);

            // Determine if authentication is required
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
            const { sessionToken, addressId, deliveryTimeSlot, deliveryDate, address } = req.body;

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
                deliveryTimeSlot,
                deliveryDate
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
     * Get all orders (admin only). Supports advanced search via query params.
     * GET /api/admin/orders/all
     * Query params: orderId, status, paymentStatus, dateFrom, dateTo, deliveryDateFrom, deliveryDateTo,
     *   phone, name, totalMin, totalMax, deliveryTimeSlot, page, limit, sortBy, sortOrder
     */
    async getAllOrders(req, res, next) {
        try {
            const {
                orderId,
                status,
                paymentStatus,
                dateFrom,
                dateTo,
                deliveryDateFrom,
                deliveryDateTo,
                phone,
                name,
                totalMin,
                totalMax,
                deliveryTimeSlot,
                page,
                limit,
                sortBy,
                sortOrder
            } = req.query;

            const hasFilters = orderId || status || paymentStatus || dateFrom || dateTo ||
                deliveryDateFrom || deliveryDateTo || phone || name || totalMin !== undefined ||
                totalMax !== undefined || deliveryTimeSlot || page || limit || sortBy || sortOrder;

            if (hasFilters) {
                const filters = {
                    orderId,
                    status,
                    paymentStatus,
                    dateFrom,
                    dateTo,
                    deliveryDateFrom,
                    deliveryDateTo,
                    phone,
                    name,
                    totalMin,
                    totalMax,
                    deliveryTimeSlot,
                    page,
                    limit,
                    sortBy,
                    sortOrder
                };
                const result = await orderService.searchOrders(filters);

                res.status(200).json({
                    success: true,
                    message: 'Orders retrieved successfully',
                    data: result.orders,
                    pagination: {
                        total: result.total,
                        page: result.page,
                        limit: result.limit,
                        totalPages: result.totalPages
                    }
                });
            } else {
                const orders = await orderService.getAllOrders();

                res.status(200).json({
                    success: true,
                    message: 'All orders retrieved successfully',
                    data: orders
                });
            }
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
            const isAdmin = req.user.role === 'ADMIN' || req.user.role === 'SUPER_ADMIN';
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

    /**
     * Request order cancellation - Generate 4-digit code and send to user's phone (admin only)
     * POST /api/admin/orders/:id/request-cancellation
     */
    async requestCancellation(req, res, next) {
        try {
            const { id } = req.params;

            const result = await orderService.requestCancellation(id);

            res.status(200).json({
                success: true,
                message: result.message,
                data: {
                    orderId: result.orderId,
                    userPhone: result.userPhone,
                    expiresAt: result.expiresAt,
                    expiresInMinutes: result.expiresInMinutes,
                    smsSent: result.smsSent
                }
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * Confirm order cancellation with 4-digit code (admin only)
     * POST /api/admin/orders/:id/confirm-cancellation
     */
    async confirmCancellation(req, res, next) {
        try {
            const { id } = req.params;
            const { code } = req.body;

            if (!code) {
                const error = new Error('Cancellation code is required');
                error.statusCode = 400;
                throw error;
            }

            const result = await orderService.confirmCancellation(id, code);

            res.status(200).json({
                success: true,
                message: result.message,
                data: {
                    order: result.order
                }
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * Update order status (admin only)
     * POST /api/admin/orders/:id/status
     */
    async updateOrderStatus(req, res, next) {
        try {
            const { id } = req.params;
            const { status } = req.body;

            if (!status) {
                const error = new Error('Order status is required');
                error.statusCode = 400;
                throw error;
            }

            const order = await orderService.updateOrderStatus(id, status);

            res.status(200).json({
                success: true,
                message: 'Order status updated successfully',
                data: order
            });
        } catch (error) {
            next(error);
        }
    }
}

module.exports = new OrderController();
