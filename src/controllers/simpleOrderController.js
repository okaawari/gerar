const simpleOrderService = require('../services/simpleOrderService');

class SimpleOrderController {
    /**
     * Request OTP for simple order
     * POST /api/simple-orders/send-otp
     */
    async requestOTP(req, res, next) {
        try {
            const { phoneNumber } = req.body;

            if (!phoneNumber) {
                return res.status(400).json({
                    success: false,
                    message: 'Утасны дугаар оруулна уу.'
                });
            }

            const result = await simpleOrderService.sendOTP(phoneNumber);

            res.status(200).json({
                success: true,
                message: result.message,
                data: {
                    expiresAt: result.expiresAt,
                    expiresInMinutes: result.expiresInMinutes
                }
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * Create simple order
     * POST /api/simple-orders/create
     */
    async createOrder(req, res, next) {
        try {
            const { phoneNumber, address, addressNote, otpCode, sessionToken } = req.body;
            const userId = req.user ? req.user.id : null;
            const guestSessionToken = sessionToken || req.headers['x-session-token'];

            if (!phoneNumber || !address || !otpCode) {
                return res.status(400).json({
                    success: false,
                    message: 'Утасны дугаар, хаяг, баталгаажуулах код заавал шаардлагатай.'
                });
            }

            const order = await simpleOrderService.createOrder({
                phoneNumber,
                address,
                addressNote,
                otpCode,
                userId,
                sessionToken: guestSessionToken
            });

            res.status(201).json({
                success: true,
                message: 'Захиалга амжилттай хийгдлээ.',
                data: order
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * Get all simple orders (Admin only)
     * GET /api/simple-orders/all
     */
    async getAllOrders(req, res, next) {
        try {
            const orders = await simpleOrderService.getAllOrders();

            res.status(200).json({
                success: true,
                message: 'Бүх simple захиалгыг авлаа.',
                data: orders
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * Get simple order by ID
     * GET /api/simple-orders/:id
     */
    async getOrderById(req, res, next) {
        try {
            const { id } = req.params;
            const order = await simpleOrderService.getOrderById(id);

            res.status(200).json({
                success: true,
                message: 'Захиалгын дэлгэрэнгүйг авлаа.',
                data: order
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * Update simple order status (Admin only)
     * POST /api/admin/simple-orders/:id/status
     */
    async updateOrderStatus(req, res, next) {
        try {
            const { id } = req.params;
            const { status } = req.body;

            if (!status) {
                return res.status(400).json({
                    success: false,
                    message: 'Захиалгын төлөв оруулна уу.'
                });
            }

            const order = await simpleOrderService.updateOrderStatus(id, status);

            res.status(200).json({
                success: true,
                message: 'Захиалгын төлөв амжилттай шинэчлэгдлээ.',
                data: order
            });
        } catch (error) {
            next(error);
        }
    }
}

module.exports = new SimpleOrderController();
