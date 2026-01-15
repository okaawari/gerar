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
     * Create order from user's cart or guest cart
     * @param {number|null} userId - User ID (for authenticated users)
     * @param {string|null} sessionToken - Session token (for guest users)
     * @param {number|null} addressId - Delivery address ID (for authenticated users)
     * @param {Object|null} address - Address object (for guest users)
     * @param {string} deliveryTimeSlot - Delivery time slot (optional)
     * @returns {Object} - Created order with items
     */
    async createOrderFromCart(userId = null, sessionToken = null, addressId = null, address = null, deliveryTimeSlot = null) {
        // Validate that either userId or sessionToken is provided
        if (!userId && !sessionToken) {
            const error = new Error('Either userId or sessionToken must be provided');
            error.statusCode = 400;
            throw error;
        }

        // Validate address is provided (either addressId for authenticated or address object for guest)
        if (userId && !addressId) {
            const error = new Error('Address ID is required for authenticated users');
            error.statusCode = 400;
            throw error;
        }

        if (sessionToken && !address) {
            const error = new Error('Address object is required for guest checkout');
            error.statusCode = 400;
            throw error;
        }

        // Validate delivery time slot if provided
        if (deliveryTimeSlot && !this.validateDeliveryTimeSlot(deliveryTimeSlot)) {
            const error = new Error('Invalid delivery time slot. Must be one of: "10-14", "14-18", "18-21", "21-00"');
            error.statusCode = 400;
            throw error;
        }

        // Get cart items
        const cartItems = userId 
            ? await cartService.getCart(userId, null)
            : await cartService.getCartBySession(sessionToken);

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

        // Handle address for guest orders
        let finalAddressId = addressId;
        if (sessionToken && address) {
            // Validate guest address
            const validation = addressService.validateAddress(address);
            if (!validation.isValid) {
                const error = new Error(`Invalid address: ${validation.errors.join(', ')}`);
                error.statusCode = 400;
                throw error;
            }

            // Create guest address (userId will be null)
            const guestAddress = await addressService.createGuestAddress(address);
            finalAddressId = guestAddress.id;
        } else if (userId && addressId) {
            // Validate address belongs to user
            const userIdInt = parseInt(userId);
            const addressExists = await addressService.validateAddressOwnership(addressId, userIdInt);
            if (!addressExists) {
                const error = new Error('Address not found or does not belong to user');
                error.statusCode = 404;
                throw error;
            }
            finalAddressId = parseInt(addressId);
        }

        // Use transaction to ensure atomicity
        // Create order, order items, reduce stock, and clear cart in one transaction
        const order = await prisma.$transaction(async (tx) => {
            // Create order
            const orderData = {
                userId: userId ? parseInt(userId) : null,
                addressId: finalAddressId,
                deliveryTimeSlot: deliveryTimeSlot || null,
                totalAmount: totalAmount,
                status: 'PENDING'
            };

            const newOrder = await tx.order.create({
                data: orderData
            });

            // Create order items and reduce stock
            const orderItems = [];
            for (const cartItem of cartItems) {
                // Create order item
                const orderItem = await tx.orderitem.create({
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
            const cartWhereClause = userId
                ? { userId: parseInt(userId) }
                : { sessionToken: sessionToken };
            
            await tx.cartitem.deleteMany({
                where: cartWhereClause
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
     * Buy now - Create order directly from a single product (bypasses cart)
     * @param {number} userId - User ID
     * @param {number} productId - Product ID
     * @param {number} quantity - Quantity to purchase
     * @param {number} addressId - Delivery address ID (required)
     * @param {string} deliveryTimeSlot - Delivery time slot (optional)
     * @returns {Object} - Created order with items
     */
    async buyNow(userId, productId, quantity, addressId, deliveryTimeSlot = null) {
        const userIdInt = parseInt(userId);
        const prodId = parseInt(productId);
        const qty = parseInt(quantity);

        // Validate required fields
        if (!productId) {
            const error = new Error('Product ID is required');
            error.statusCode = 400;
            throw error;
        }

        if (!quantity || qty <= 0) {
            const error = new Error('Quantity must be a positive number');
            error.statusCode = 400;
            throw error;
        }

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

        // Validate stock availability (also validates product exists)
        const stockCheck = await productService.checkStockAvailability(prodId, qty);
        if (!stockCheck.hasStock) {
            const error = new Error(
                `Insufficient stock for product "${stockCheck.product.name}". Available: ${stockCheck.product.stock}, Requested: ${qty}`
            );
            error.statusCode = 400;
            throw error;
        }

        // Calculate total amount from product price
        const price = parseFloat(stockCheck.product.price);
        const totalAmount = price * qty;

        // Use transaction to ensure atomicity
        // Create order, order item, and reduce stock in one transaction
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

            // Create order item
            const orderItem = await tx.orderitem.create({
                data: {
                    orderId: newOrder.id,
                    productId: prodId,
                    quantity: qty,
                    price: price
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
                where: { id: prodId },
                data: {
                    stock: {
                        decrement: qty
                    }
                }
            });

            // Format order item to extract categories
            const formattedItem = { ...orderItem };
            if (orderItem.product && orderItem.product.categories) {
                formattedItem.product = { ...orderItem.product };
                formattedItem.product.categories = orderItem.product.categories.map(pc => pc.category);
                formattedItem.product.categoryId = formattedItem.product.categories.length > 0 
                    ? formattedItem.product.categories[0].id 
                    : null;
                formattedItem.product.category = formattedItem.product.categories.length > 0 
                    ? formattedItem.product.categories[0] 
                    : null;
            }

            // Return order with items
            return {
                ...newOrder,
                items: [formattedItem]
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
     * Finalize order from draft order (guest checkout -> authenticated order)
     * @param {number} userId - User ID (must be authenticated)
     * @param {Object} draftOrder - Draft order object
     * @param {number} addressId - Optional existing address ID
     * @param {Object} address - Optional new address object to create
     * @param {string} deliveryTimeSlot - Delivery time slot (optional)
     * @returns {Object} - Created order with items
     */
    async finalizeOrderFromDraft(userId, draftOrder, addressId = null, address = null, deliveryTimeSlot = null) {
        const userIdInt = parseInt(userId);
        const prodId = draftOrder.productId;
        const qty = draftOrder.quantity;

        // Validate that either addressId or address object is provided
        if (!addressId && !address) {
            const error = new Error('Either addressId or address object is required');
            error.statusCode = 400;
            throw error;
        }

        // If address object is provided, create it first
        let finalAddressId = addressId;
        if (address && !addressId) {
            const validation = addressService.validateAddress(address);
            if (!validation.isValid) {
                const error = new Error(`Invalid address: ${validation.errors.join(', ')}`);
                error.statusCode = 400;
                throw error;
            }

            const newAddress = await addressService.createAddress(userIdInt, address);
            finalAddressId = newAddress.id;
        }

        // Validate address belongs to user
        if (finalAddressId) {
            const addressExists = await addressService.validateAddressOwnership(finalAddressId, userIdInt);
            if (!addressExists) {
                const error = new Error('Address not found or does not belong to user');
                error.statusCode = 404;
                throw error;
            }
        }

        // Validate delivery time slot if provided
        if (deliveryTimeSlot && !this.validateDeliveryTimeSlot(deliveryTimeSlot)) {
            const error = new Error('Invalid delivery time slot. Must be one of: "10-14", "14-18", "18-21", "21-00"');
            error.statusCode = 400;
            throw error;
        }

        // Re-validate stock availability (stock may have changed since draft was created)
        const stockCheck = await productService.checkStockAvailability(prodId, qty);
        if (!stockCheck.hasStock) {
            const error = new Error(
                `Insufficient stock for product "${stockCheck.product.name}". Available: ${stockCheck.product.stock}, Requested: ${qty}`
            );
            error.statusCode = 400;
            throw error;
        }

        // Use transaction to ensure atomicity
        const order = await prisma.$transaction(async (tx) => {
            // Create order
            const newOrder = await tx.order.create({
                data: {
                    userId: userIdInt,
                    addressId: finalAddressId ? parseInt(finalAddressId) : null,
                    deliveryTimeSlot: deliveryTimeSlot || null,
                    totalAmount: draftOrder.totalAmount,
                    status: 'PENDING'
                }
            });

            // Create order item
            const orderItem = await tx.orderitem.create({
                data: {
                    orderId: newOrder.id,
                    productId: prodId,
                    quantity: qty,
                    price: parseFloat(draftOrder.product.price)
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
                where: { id: prodId },
                data: {
                    stock: {
                        decrement: qty
                    }
                }
            });

            // Format order item to extract categories
            const formattedItem = { ...orderItem };
            if (orderItem.product && orderItem.product.categories) {
                formattedItem.product = { ...orderItem.product };
                formattedItem.product.categories = orderItem.product.categories.map(pc => pc.category);
                formattedItem.product.categoryId = formattedItem.product.categories.length > 0 
                    ? formattedItem.product.categories[0].id 
                    : null;
                formattedItem.product.category = formattedItem.product.categories.length > 0 
                    ? formattedItem.product.categories[0] 
                    : null;
            }

            // Return order with items
            return {
                ...newOrder,
                items: [formattedItem]
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
        // Guest orders (userId is null) can only be viewed by admins
        if (!isAdmin) {
            if (order.userId === null) {
                // Guest order - only admins can view
                const error = new Error('Access denied. Guest orders can only be viewed by administrators.');
                error.statusCode = 403;
                throw error;
            } else if (order.userId !== parseInt(userId)) {
                // User order - must belong to the requesting user
                const error = new Error('Access denied. You can only view your own orders.');
                error.statusCode = 403;
                throw error;
            }
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
