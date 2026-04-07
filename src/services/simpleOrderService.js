const prisma = require('../lib/prisma');
const cartService = require('./cartService');
const otpService = require('./otpService');
const productService = require('./productService');

class SimpleOrderService {
    /**
     * Send OTP for simple order
     * @param {string} phoneNumber - Phone number to send OTP to
     * @returns {Promise<Object>} - OTP result
     */
    async sendOTP(phoneNumber) {
        return await otpService.sendOTP(phoneNumber, 'SIMPLE_ORDER');
    }

    /**
     * Create simple order from cart
     * @param {Object} data - { phoneNumber, address, addressNote, otpCode, userId, sessionToken }
     * @returns {Promise<Object>} - Created order
     */
    async createOrder(data) {
        const { phoneNumber, address, addressNote, otpCode, userId, sessionToken } = data;

        // 1. Verify OTP
        await otpService.verifyOTP(phoneNumber, otpCode, 'SIMPLE_ORDER');

        // 2. Get cart items - use userId if authenticated, otherwise sessionToken
        const cartItems = userId 
            ? await cartService.getCart(userId, null) 
            : await cartService.getCartBySession(sessionToken);

        if (!cartItems || cartItems.length === 0) {
            const error = new Error('Сагс хоосон байна. Захиалга хийх боломжгүй.');
            error.statusCode = 400;
            throw error;
        }

        // 3. Filter for regular products only (simple order doesn't support point products)
        const productItems = cartItems.filter(item => item.productId !== null);

        if (productItems.length === 0) {
            const error = new Error('Сагсанд энгийн бараа байхгүй байна. Simple Order зөвхөн энгийн бараанд зориулагдсан.');
            error.statusCode = 400;
            throw error;
        }

        // 4. Validate stock and calculate total
        let totalAmount = 0;
        for (const item of productItems) {
            const stockCheck = await productService.checkStockAvailability(item.productId, item.quantity);
            if (!stockCheck.hasStock) {
                const error = new Error(`Барааны үлдэгдэл хүрэлцэхгүй байна: ${item.product.name}`);
                error.statusCode = 400;
                throw error;
            }
            totalAmount += parseFloat(item.product.price) * item.quantity;
        }

        // 5. Create order in transaction
        const order = await prisma.$transaction(async (tx) => {
            // Create simple order
            const newOrder = await tx.simpleorder.create({
                data: {
                    userId: userId ? parseInt(userId) : null,
                    phoneNumber,
                    address,
                    addressNote,
                    totalAmount,
                    status: 'PENDING'
                }
            });

            // Create order items and reduce stock
            for (const item of productItems) {
                await tx.simpleorderitem.create({
                    data: {
                        simpleOrderId: newOrder.id,
                        productId: item.productId,
                        quantity: item.quantity,
                        price: item.product.price
                    }
                });

                // Reduce stock
                await tx.product.update({
                    where: { id: item.productId },
                    data: { stock: { decrement: item.quantity } }
                });
            }

            // Clear cart (only the items we processed? No, clear all usually, but for simple order maybe just products?)
            // We'll clear the whole cart as it's a "checkout"
            const cartWhereClause = userId
                ? { userId: parseInt(userId) }
                : { sessionToken: sessionToken };
            
            await tx.cartitem.deleteMany({
                where: cartWhereClause
            });

            return newOrder;
        });

        // Return order with items
        return await prisma.simpleorder.findUnique({
            where: { id: order.id },
            include: {
                items: {
                    include: {
                        product: true
                    }
                }
            }
        });
    }

    /**
     * Get all simple orders (for admin)
     * @returns {Promise<Array>} - List of simple orders
     */
    async getAllOrders() {
        return await prisma.simpleorder.findMany({
            include: {
                items: {
                    include: {
                        product: true
                    }
                }
            },
            orderBy: {
                createdAt: 'desc'
            }
        });
    }

    /**
     * Get simple order by ID
     * @param {number} id - Order ID
     * @returns {Promise<Object>} - Order details
     */
    async getOrderById(id) {
        const order = await prisma.simpleorder.findUnique({
            where: { id: parseInt(id) },
            include: {
                items: {
                    include: {
                        product: true
                    }
                }
            }
        });

        if (!order) {
            const error = new Error('Захиалга олдсонгүй.');
            error.statusCode = 404;
            throw error;
        }

        return order;
    }

    /**
     * Update simple order status (Admin only)
     * @param {number} id - Order ID
     * @param {string} status - New status
     * @returns {Promise<Object>} - Updated order
     */
    async updateOrderStatus(id, status) {
        const order = await prisma.simpleorder.findUnique({
            where: { id: parseInt(id) }
        });

        if (!order) {
            const error = new Error('Захиалга олдсонгүй.');
            error.statusCode = 404;
            throw error;
        }

        return await prisma.simpleorder.update({
            where: { id: parseInt(id) },
            data: { status },
            include: {
                items: {
                    include: {
                        product: true
                    }
                }
            }
        });
    }
}

module.exports = new SimpleOrderService();
