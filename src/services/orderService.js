const prisma = require('../lib/prisma');
const cartService = require('./cartService');
const productService = require('./productService');
const addressService = require('./addressService');
const { isValidDeliveryTimeSlot } = require('../constants/deliveryTimeSlots');

class OrderService {
    /**
     * Calculate total amount from cart items
     * @param {Array} cartItems - Array of cart items with product information
     * @returns {number} - Total amount
     */
    calculateOrderTotal(cartItems) {
        if (!cartItems || cartItems.length === 0) {
            return 0;
        }

        return cartItems.reduce((total, item) => {
            const price = parseFloat(item.product.price);
            const quantity = parseInt(item.quantity);
            return total + (price * quantity);
        }, 0);
    }

    /**
     * Validate delivery time slot
     * @param {string} timeSlot - Delivery time slot
     * @returns {boolean} - True if valid
     */
    validateDeliveryTimeSlot(timeSlot) {
        if (!timeSlot) return true; // Optional field
        return isValidDeliveryTimeSlot(timeSlot);
    }

    /**
     * Create order from user's cart
     * @param {number} userId - User ID
     * @param {number} addressId - Delivery address ID (required)
     * @param {string} deliveryTimeSlot - Delivery time slot (optional)
     * @returns {Object} - Created order with items
     */
    async createOrderFromCart(userId, addressId, deliveryTimeSlot = null) {
        const userIdInt = parseInt(userId);

        // Validate addressId is provided
        if (!addressId) {
            const error = new Error('Address ID is required for delivery');
            error.statusCode = 400;
            throw error;
        }

        // Validate address belongs to user
        const addressExists = await addressService.validateAddressOwnership(addressId, userIdInt);
        if (!addressExists) {
            const error = new Error('Address not found or does not belong to user');
            error.statusCode = 404;
            throw error;
        }

        // Validate delivery time slot if provided
        if (deliveryTimeSlot && !this.validateDeliveryTimeSlot(deliveryTimeSlot)) {
            const error = new Error('Invalid delivery time slot. Must be one of: "10-14", "14-18", "18-21", "21-00"');
            error.statusCode = 400;
            throw error;
        }

        // Get user's cart
        const cartItems = await cartService.getCart(userIdInt);

        if (!cartItems || cartItems.length === 0) {
            const error = new Error('Cart is empty. Cannot create order.');
            error.statusCode = 400;
            throw error;
        }

        // Validate stock availability for all items before creating order
        // This prevents partial order creation
        for (const cartItem of cartItems) {
            const stockCheck = await productService.checkStockAvailability(
                cartItem.productId,
                cartItem.quantity
            );

            if (!stockCheck.hasStock) {
                const error = new Error(
                    `Insufficient stock for product "${cartItem.product.name}". Available: ${stockCheck.product.stock}, Requested: ${cartItem.quantity}`
                );
                error.statusCode = 400;
                throw error;
            }
        }

        // Calculate total amount
        const totalAmount = this.calculateOrderTotal(cartItems);

        // Use transaction to ensure atomicity
        // Create order, order items, reduce stock, and clear cart in one transaction
        const order = await prisma.$transaction(async (tx) => {
            // Create order
            const newOrder = await tx.order.create({
                data: {
                    userId: userIdInt,
                    addressId: parseInt(addressId),
                    deliveryTimeSlot: deliveryTimeSlot || null,
                    totalAmount: totalAmount,
                    status: 'PENDING'
                }
            });

            // Create order items and reduce stock
            const orderItems = [];
            for (const cartItem of cartItems) {
                // Create order item
                const orderItem = await tx.orderItem.create({
                    data: {
                        orderId: newOrder.id,
                        productId: cartItem.productId,
                        quantity: cartItem.quantity,
                        price: cartItem.product.price
                    },
                    include: {
                        product: {
                            include: {
                                categories: {
                                    include: {
                                        category: {
                                            select: {
                                                id: true,
                                                name: true,
                                                description: true
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                });

                // Reduce stock
                await tx.product.update({
                    where: { id: cartItem.productId },
                    data: {
                        stock: {
                            decrement: cartItem.quantity
                        }
                    }
                });

                orderItems.push(orderItem);
            }

            // Clear cart after successful order creation
            await tx.cartItem.deleteMany({
                where: { userId: userIdInt }
            });

            // Format order items to extract categories
            const formattedItems = orderItems.map(item => {
                const formatted = { ...item };
                if (item.product && item.product.categories) {
                    formatted.product = { ...item.product };
                    formatted.product.categories = item.product.categories.map(pc => pc.category);
                    formatted.product.categoryId = formatted.product.categories.length > 0 
                        ? formatted.product.categories[0].id 
                        : null;
                    formatted.product.category = formatted.product.categories.length > 0 
                        ? formatted.product.categories[0] 
                        : null;
                }
                return formatted;
            });

            // Return order with items
            return {
                ...newOrder,
                items: formattedItems
            };
        });

        // Fetch order with full details including user and address
        const orderWithDetails = await prisma.order.findUnique({
            where: { id: order.id },
            include: {
                items: {
                    include: {
                        product: {
                            include: {
                                categories: {
                                    include: {
                                        category: {
                                            select: {
                                                id: true,
                                                name: true,
                                                description: true
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                },
                address: true,
                user: {
                    select: {
                        id: true,
                        phoneNumber: true,
                        name: true
                    }
                }
            }
        });

        // Format products to extract categories
        if (orderWithDetails && orderWithDetails.items) {
            orderWithDetails.items = orderWithDetails.items.map(item => {
                const formatted = { ...item };
                if (item.product && item.product.categories) {
                    formatted.product = { ...item.product };
                    formatted.product.categories = item.product.categories.map(pc => pc.category);
                    formatted.product.categoryId = formatted.product.categories.length > 0 
                        ? formatted.product.categories[0].id 
                        : null;
                    formatted.product.category = formatted.product.categories.length > 0 
                        ? formatted.product.categories[0] 
                        : null;
                }
                return formatted;
            });
        }

        return orderWithDetails;
    }

    /**
     * Get order by ID
     * @param {number} orderId - Order ID
     * @param {number} userId - User ID (for access control)
     * @param {boolean} isAdmin - Whether user is admin
     * @returns {Object} - Order with items
     */
    async getOrderById(orderId, userId, isAdmin = false) {
        const order = await prisma.order.findUnique({
            where: { id: parseInt(orderId) },
            include: {
                items: {
                    include: {
                        product: {
                            include: {
                                categories: {
                                    include: {
                                        category: {
                                            select: {
                                                id: true,
                                                name: true,
                                                description: true
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                },
                address: true,
                user: {
                    select: {
                        id: true,
                        phoneNumber: true,
                        name: true
                    }
                }
            }
        });

        if (!order) {
            const error = new Error('Order not found');
            error.statusCode = 404;
            throw error;
        }

        // Check access control: users can only see their own orders, admins can see all
        if (!isAdmin && order.userId !== parseInt(userId)) {
            const error = new Error('Access denied. You can only view your own orders.');
            error.statusCode = 403;
            throw error;
        }

        // Format products to extract categories
        if (order && order.items) {
            order.items = order.items.map(item => {
                const formatted = { ...item };
                if (item.product && item.product.categories) {
                    formatted.product = { ...item.product };
                    formatted.product.categories = item.product.categories.map(pc => pc.category);
                    formatted.product.categoryId = formatted.product.categories.length > 0 
                        ? formatted.product.categories[0].id 
                        : null;
                    formatted.product.category = formatted.product.categories.length > 0 
                        ? formatted.product.categories[0] 
                        : null;
                }
                return formatted;
            });
        }

        return order;
    }

    /**
     * Get user's order history
     * @param {number} userId - User ID
     * @returns {Array} - List of orders
     */
    async getUserOrders(userId) {
        const orders = await prisma.order.findMany({
            where: { userId: parseInt(userId) },
            include: {
                items: {
                    include: {
                        product: {
                            include: {
                                categories: {
                                    include: {
                                        category: {
                                            select: {
                                                id: true,
                                                name: true,
                                                description: true
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                },
                address: true
            },
            orderBy: {
                createdAt: 'desc'
            }
        });

        // Format products to extract categories
        return orders.map(order => {
            const formatted = { ...order };
            if (formatted.items) {
                formatted.items = formatted.items.map(item => {
                    const formattedItem = { ...item };
                    if (item.product && item.product.categories) {
                        formattedItem.product = { ...item.product };
                        formattedItem.product.categories = item.product.categories.map(pc => pc.category);
                        formattedItem.product.categoryId = formattedItem.product.categories.length > 0 
                            ? formattedItem.product.categories[0].id 
                            : null;
                        formattedItem.product.category = formattedItem.product.categories.length > 0 
                            ? formattedItem.product.categories[0] 
                            : null;
                    }
                    return formattedItem;
                });
            }
            return formatted;
        });
    }

    /**
     * Get all orders (admin only)
     * @returns {Array} - List of all orders
     */
    async getAllOrders() {
        const orders = await prisma.order.findMany({
            include: {
                items: {
                    include: {
                        product: {
                            include: {
                                categories: {
                                    include: {
                                        category: {
                                            select: {
                                                id: true,
                                                name: true,
                                                description: true
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                },
                address: true,
                user: {
                    select: {
                        id: true,
                        phoneNumber: true,
                        name: true
                    }
                }
            },
            orderBy: {
                createdAt: 'desc'
            }
        });

        // Format products to extract categories
        return orders.map(order => {
            const formatted = { ...order };
            if (formatted.items) {
                formatted.items = formatted.items.map(item => {
                    const formattedItem = { ...item };
                    if (item.product && item.product.categories) {
                        formattedItem.product = { ...item.product };
                        formattedItem.product.categories = item.product.categories.map(pc => pc.category);
                        formattedItem.product.categoryId = formattedItem.product.categories.length > 0 
                            ? formattedItem.product.categories[0].id 
                            : null;
                        formattedItem.product.category = formattedItem.product.categories.length > 0 
                            ? formattedItem.product.categories[0] 
                            : null;
                    }
                    return formattedItem;
                });
            }
            return formatted;
        });
    }
}

module.exports = new OrderService();
