const prisma = require('../lib/prisma');
const cartService = require('./cartService');
const productService = require('./productService');
const addressService = require('./addressService');
const otpService = require('./otpService');
const smsService = require('./smsService');
const { isValidDeliveryTimeSlot } = require('../constants/deliveryTimeSlots');
const { getMongoliaDateParts } = require('../utils/dateUtils');

/** Status value that triggers "delivery started" SMS to user */
const STATUS_DELIVERY_STARTED = 'DELIVERY_STARTED';

/** Status for orders cancelled via admin SMS confirmation (user confirmed with 4-digit code) */
const STATUS_CANCELLED_BY_ADMIN = 'CANCELLED_BY_ADMIN';

/** Status values that mean the order is cancelled (for checks) */
const CANCELLED_STATUSES = ['CANCELLED', STATUS_CANCELLED_BY_ADMIN];

function isOrderCancelled(order) {
    return CANCELLED_STATUSES.includes(order.status) || order.paymentStatus === 'CANCELLED';
}

class OrderService {
    /**
     * Generate custom order ID in format YYMMDDNNN
     * Format: YY (year last 2 digits) + MM (month) + DD (day) + NNN (random number from 001-999)
     * Example: 260126247 for January 26, 2026, with random suffix 247
     * @returns {Promise<string>} - Generated order ID
     */
    async generateOrderId() {
        const { year, month, day } = getMongoliaDateParts();
        const yearShort = year.slice(-2); // Last 2 digits of year
        const datePrefix = `${yearShort}${month}${day}`; // YYMMDD format (Mongolian timezone)

        const maxAttempts = 100; // Maximum attempts to find a unique random ID
        let attempts = 0;

        while (attempts < maxAttempts) {
            // Generate random number from 1 to 999
            const randomSequence = Math.floor(Math.random() * 999) + 1;
            const sequenceStr = String(randomSequence).padStart(3, '0');
            const candidateId = `${datePrefix}${sequenceStr}`;

            // Check if this order ID already exists
            const existingOrder = await prisma.order.findUnique({
                where: {
                    id: candidateId
                },
                select: {
                    id: true
                }
            });

            // If ID doesn't exist, return it
            if (!existingOrder) {
                return candidateId;
            }

            attempts++;
        }

        // Fallback: if we couldn't find a unique random ID after maxAttempts,
        // throw an error (this should be extremely rare - only if there are 999+ orders in a single day)
        throw new Error(`Unable to generate unique order ID after ${maxAttempts} attempts. Too many orders today.`);
    }

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
     * Calculate delivery date based on current date or user-provided date
     * If user provided a date, use it (but validate it's reasonable)
     * Otherwise, calculate next day as fallback
     * @param {string|Date|null|undefined} deliveryDateFromRequest - Optional delivery date from request
     * @returns {Date} - Delivery date
     */
    calculateDeliveryDate(deliveryDateFromRequest = null) {
        // If user provided a date, use it (but validate it's reasonable)
        if (deliveryDateFromRequest) {
            const requestedDate = new Date(deliveryDateFromRequest);
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            // Validate: date should be today or in the future (within reasonable range)
            if (requestedDate >= today) {
                requestedDate.setHours(0, 0, 0, 0);
                return requestedDate;
            }
        }

        // Fallback: calculate next day if no date provided or invalid
        const nextDay = new Date();
        nextDay.setDate(nextDay.getDate() + 1);
        nextDay.setHours(0, 0, 0, 0);
        return nextDay;
    }

    /**
     * Create order from user's cart or guest cart
     * @param {number|null} userId - User ID (for authenticated users)
     * @param {string|null} sessionToken - Session token (for guest users)
     * @param {number|null} addressId - Delivery address ID (for authenticated users)
     * @param {Object|null} address - Address object (for guest users)
     * @param {string} deliveryTimeSlot - Delivery time slot (optional)
     * @param {string|Date|null} deliveryDate - Delivery date (optional, will calculate if not provided)
     * @param {Object|null} contact - Contact info { fullName, phoneNumber, email } from order create form
     * @returns {Object} - Created order with items
     */
    async createOrderFromCart(userId = null, sessionToken = null, addressId = null, address = null, deliveryTimeSlot = null, deliveryDate = null, contact = null) {
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
                    `Барааны үлдэгдэл хүрэлцэхгүй байна. Барааны нэр: "${cartItem.product.name}". Байгаа: ${stockCheck.product.stock}, Авах гэсэн: ${cartItem.quantity}`
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

        // Generate custom order ID before transaction
        const orderId = await this.generateOrderId();

        // Calculate delivery date (use provided date or calculate fallback)
        const calculatedDeliveryDate = this.calculateDeliveryDate(deliveryDate);

        // Use transaction to ensure atomicity
        // Create order, order items, reduce stock, and clear cart in one transaction
        const order = await prisma.$transaction(async (tx) => {
            // Create order (use relation connect syntax for Prisma 7+)
            const orderData = {
                id: orderId,
                ...(userId ? { user: { connect: { id: parseInt(userId) } } } : {}),
                ...(finalAddressId ? { address: { connect: { id: finalAddressId } } } : {}),
                deliveryTimeSlot: deliveryTimeSlot || null,
                deliveryDate: calculatedDeliveryDate,
                totalAmount: totalAmount,
                status: 'PENDING',
                ...(contact ? {
                    contactFullName: contact.fullName,
                    contactPhoneNumber: contact.phoneNumber,
                    contactEmail: contact.email
                } : {})
            };

            let newOrder = await tx.order.create({
                data: orderData
            });

            // Set sessionToken for guest orders (separate update in case create input omits it)
            if (sessionToken) {
                newOrder = await tx.order.update({
                    where: { id: newOrder.id },
                    data: { sessionToken }
                });
            }

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

        await this.recordOrderActivity(order.id, { type: 'ORDER_CREATED', title: 'Order placed', toValue: 'PENDING' });
        return orderWithDetails;
    }

    /**
     * Buy now - Create order directly from a single product (bypasses cart)
     * @param {number} userId - User ID
     * @param {number} productId - Product ID
     * @param {number} quantity - Quantity to purchase
     * @param {number} addressId - Delivery address ID (required)
     * @param {string} deliveryTimeSlot - Delivery time slot (optional)
     * @param {string|Date|null} deliveryDate - Delivery date (optional, will calculate if not provided)
     * @param {Object|null} contact - Contact info { fullName, phoneNumber, email } from order create form
     * @returns {Object} - Created order with items
     */
    async buyNow(userId, productId, quantity, addressId, deliveryTimeSlot = null, deliveryDate = null, contact = null) {
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
                `Барааны үлдэгдэл хүрэлцэхгүй байна. Барааны нэр: "${stockCheck.product.name}". Байгаа: ${stockCheck.product.stock}, Авах гэсэн: ${qty}`
            );
            error.statusCode = 400;
            throw error;
        }

        // Calculate total amount from product price
        const price = parseFloat(stockCheck.product.price);
        const totalAmount = price * qty;

        // Generate custom order ID before transaction
        const orderId = await this.generateOrderId();

        // Calculate delivery date (use provided date or calculate fallback)
        const calculatedDeliveryDate = this.calculateDeliveryDate(deliveryDate);

        // Use transaction to ensure atomicity
        // Create order, order item, and reduce stock in one transaction
        const order = await prisma.$transaction(async (tx) => {
            // Create order (use relation connect syntax for Prisma 7+)
            const newOrder = await tx.order.create({
                data: {
                    id: orderId,
                    user: { connect: { id: userIdInt } },
                    address: { connect: { id: parseInt(addressId) } },
                    deliveryTimeSlot: deliveryTimeSlot || null,
                    deliveryDate: calculatedDeliveryDate,
                    totalAmount: totalAmount,
                    status: 'PENDING',
                    ...(contact ? {
                        contactFullName: contact.fullName,
                        contactPhoneNumber: contact.phoneNumber,
                        contactEmail: contact.email
                    } : {})
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

        await this.recordOrderActivity(order.id, { type: 'ORDER_CREATED', title: 'Order placed', toValue: 'PENDING' });
        return orderWithDetails;
    }

    /**
     * Finalize order from draft order (guest checkout -> authenticated order)
     * @param {number} userId - User ID (must be authenticated)
     * @param {Object} draftOrder - Draft order object
     * @param {number} addressId - Optional existing address ID
     * @param {Object} address - Optional new address object to create
     * @param {string} deliveryTimeSlot - Delivery time slot (optional)
     * @param {string|Date|null} deliveryDate - Delivery date (optional, will calculate if not provided)
     * @param {Object|null} contact - Contact info { fullName, phoneNumber, email } from order create form
     * @returns {Object} - Created order with items
     */
    async finalizeOrderFromDraft(userId, draftOrder, addressId = null, address = null, deliveryTimeSlot = null, deliveryDate = null, contact = null) {
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
                `Барааны үлдэгдэл хүрэлцэхгүй байна. Барааны нэр: "${stockCheck.product.name}". Байгаа: ${stockCheck.product.stock}, Авах гэсэн: ${qty}`
            );
            error.statusCode = 400;
            throw error;
        }

        // Generate custom order ID before transaction
        const orderId = await this.generateOrderId();

        // Calculate delivery date (use provided date or calculate fallback)
        const calculatedDeliveryDate = this.calculateDeliveryDate(deliveryDate);

        // Use transaction to ensure atomicity
        const order = await prisma.$transaction(async (tx) => {
            // Create order (use relation connect syntax for Prisma 7+)
            const newOrder = await tx.order.create({
                data: {
                    id: orderId,
                    user: { connect: { id: userIdInt } },
                    ...(finalAddressId ? { address: { connect: { id: parseInt(finalAddressId) } } } : {}),
                    deliveryTimeSlot: deliveryTimeSlot || null,
                    deliveryDate: calculatedDeliveryDate,
                    totalAmount: draftOrder.totalAmount,
                    status: 'PENDING',
                    ...(contact ? {
                        contactFullName: contact.fullName,
                        contactPhoneNumber: contact.phoneNumber,
                        contactEmail: contact.email
                    } : {})
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

        await this.recordOrderActivity(order.id, { type: 'ORDER_CREATED', title: 'Order placed', toValue: 'PENDING' });
        return orderWithDetails;
    }

    /**
     * Get order by ID
     * @param {string} orderId - Order ID (custom format: YYMMDDNNN)
     * @param {number|undefined} userId - User ID (for access control; undefined for guests)
     * @param {boolean} isAdmin - Whether user is admin
     * @param {string|undefined} sessionToken - X-Session-Token for guest access (order must belong to this session)
     * @returns {Object} - Order with items
     */
    async getOrderById(orderId, userId, isAdmin = false, sessionToken = undefined) {
        const order = await prisma.order.findUnique({
            where: { id: String(orderId) },
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
                        name: true,
                        email: true
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
        // Guest orders: allow only when X-Session-Token matches order.sessionToken
        if (!isAdmin) {
            if (order.userId === null) {
                // Guest order - allow only when sessionToken matches
                if (sessionToken && order.sessionToken === sessionToken) {
                    // Allowed: guest presenting correct session token
                } else if (userId != null && userId !== undefined) {
                    const error = new Error('Access denied. Guest orders can only be viewed with the correct session token.');
                    error.statusCode = 403;
                    throw error;
                } else {
                    const error = new Error('Access denied. Provide X-Session-Token to view this order.');
                    error.statusCode = 403;
                    throw error;
                }
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
     * Format order items (extract categories from product)
     * @param {Array} orders - Orders with items
     * @returns {Array} - Orders with formatted items
     */
    formatOrdersWithCategories(orders) {
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

        return this.formatOrdersWithCategories(orders);
    }

    /**
     * Search orders with advanced filters (admin only)
     * @param {Object} filters - {
     *   orderId?, status?, paymentStatus?, dateFrom?, dateTo?, deliveryDateFrom?, deliveryDateTo?,
     *   phone?, name?, totalMin?, totalMax?, deliveryTimeSlot?, page?, limit?, sortBy?, sortOrder?
     * }
     * @returns {Object} - { orders, total, page, limit, totalPages }
     */
    async searchOrders(filters = {}) {
        const where = {};

        // Order ID (contains - custom format YYMMDDNNN)
        if (filters.orderId && String(filters.orderId).trim()) {
            where.id = { contains: String(filters.orderId).trim() };
        }

        // Status (exact)
        if (filters.status && String(filters.status).trim()) {
            where.status = String(filters.status).trim();
        }

        // Payment status (exact)
        if (filters.paymentStatus && String(filters.paymentStatus).trim()) {
            where.paymentStatus = String(filters.paymentStatus).trim();
        }

        // Created date range
        if (filters.dateFrom || filters.dateTo) {
            where.createdAt = {};
            if (filters.dateFrom) {
                const d = new Date(filters.dateFrom);
                if (!isNaN(d.getTime())) where.createdAt.gte = d;
            }
            if (filters.dateTo) {
                const d = new Date(filters.dateTo);
                if (!isNaN(d.getTime())) {
                    d.setHours(23, 59, 59, 999);
                    where.createdAt.lte = d;
                }
            }
        }

        // Delivery date range
        if (filters.deliveryDateFrom || filters.deliveryDateTo) {
            where.deliveryDate = {};
            if (filters.deliveryDateFrom) {
                const d = new Date(filters.deliveryDateFrom);
                if (!isNaN(d.getTime())) where.deliveryDate.gte = d;
            }
            if (filters.deliveryDateTo) {
                const d = new Date(filters.deliveryDateTo);
                if (!isNaN(d.getTime())) {
                    d.setHours(23, 59, 59, 999);
                    where.deliveryDate.lte = d;
                }
            }
        }

        // Phone: user.phoneNumber OR address.phoneNumber (for guest orders)
        if (filters.phone && String(filters.phone).trim()) {
            const phoneTerm = String(filters.phone).trim();
            where.OR = where.OR || [];
            where.OR.push(
                { user: { phoneNumber: { contains: phoneTerm } } },
                { address: { phoneNumber: { contains: phoneTerm } } }
            );
        }

        // Name: user.name (registered users only)
        if (filters.name && String(filters.name).trim()) {
            const nameTerm = String(filters.name).trim();
            where.user = where.user || {};
            where.user.name = { contains: nameTerm };
        }

        // Total amount range
        if (filters.totalMin !== undefined && filters.totalMin !== '') {
            const min = parseFloat(filters.totalMin);
            if (!isNaN(min)) {
                where.totalAmount = where.totalAmount || {};
                where.totalAmount.gte = min;
            }
        }
        if (filters.totalMax !== undefined && filters.totalMax !== '') {
            const max = parseFloat(filters.totalMax);
            if (!isNaN(max)) {
                where.totalAmount = where.totalAmount || {};
                where.totalAmount.lte = max;
            }
        }

        // Delivery time slot (exact)
        if (filters.deliveryTimeSlot && String(filters.deliveryTimeSlot).trim()) {
            where.deliveryTimeSlot = String(filters.deliveryTimeSlot).trim();
        }

        const page = Math.max(1, parseInt(filters.page) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(filters.limit) || 50));
        const skip = (page - 1) * limit;

        const sortBy = filters.sortBy || 'createdAt';
        const sortOrder = (filters.sortOrder === 'asc' || filters.sortOrder === 'ASC') ? 'asc' : 'desc';
        const validSortFields = ['createdAt', 'updatedAt', 'totalAmount', 'status', 'paymentStatus', 'deliveryDate'];
        const orderByField = validSortFields.includes(sortBy) ? sortBy : 'createdAt';

        const [orders, total] = await Promise.all([
            prisma.order.findMany({
                where,
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
                orderBy: { [orderByField]: sortOrder },
                skip,
                take: limit
            }),
            prisma.order.count({ where })
        ]);

        const totalPages = Math.ceil(total / limit);

        return {
            orders: this.formatOrdersWithCategories(orders),
            total,
            page,
            limit,
            totalPages
        };
    }

    /**
     * Update order payment status
     * @param {string} orderId - Order ID (custom format: YYMMDDNNN)
     * @param {Object} paymentData - Payment data (qpayInvoiceId, qpayPaymentId, paymentStatus, paymentMethod, paidAt, ebarimtId)
     * @returns {Promise<Object>} Updated order
     */
    async updatePaymentStatus(orderId, paymentData) {
        const updateData = {};
        
        if (paymentData.qpayInvoiceId !== undefined) {
            updateData.qpayInvoiceId = paymentData.qpayInvoiceId;
        }
        if (paymentData.qpayPaymentId !== undefined) {
            updateData.qpayPaymentId = paymentData.qpayPaymentId;
        }
        if (paymentData.paymentStatus !== undefined) {
            updateData.paymentStatus = paymentData.paymentStatus;
        }
        if (paymentData.paymentMethod !== undefined) {
            updateData.paymentMethod = paymentData.paymentMethod;
        }
        if (paymentData.paidAt !== undefined) {
            updateData.paidAt = paymentData.paidAt;
        }
        if (paymentData.ebarimtId !== undefined) {
            updateData.ebarimtId = paymentData.ebarimtId;
        }
        // Update order status if payment is completed
        if (paymentData.paymentStatus === 'PAID') {
            updateData.status = 'PAID';
            if (!updateData.paidAt) {
                updateData.paidAt = new Date();
            }
        }

        const updatedOrder = await prisma.order.update({
            where: { id: String(orderId) },
            data: updateData,
            include: {
                items: {
                    include: {
                        product: true
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

        return updatedOrder;
    }

    /**
     * Cancel expired pending orders (older than 1 hour)
     * This method finds all pending orders created more than 1 hour ago,
     * cancels them, restores stock, and cancels QPAY invoices if they exist
     * @returns {Promise<Object>} Summary of cancelled orders
     */
    async cancelExpiredPendingOrders() {
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000); // 1 hour ago

        // Find all pending orders older than 1 hour
        const expiredOrders = await prisma.order.findMany({
            where: {
                status: 'PENDING',
                paymentStatus: 'PENDING',
                createdAt: {
                    lt: oneHourAgo
                }
            },
            include: {
                items: {
                    include: {
                        product: true
                    }
                }
            }
        });

        if (expiredOrders.length === 0) {
            return {
                cancelled: 0,
                orders: []
            };
        }

        const qpayService = require('./qpayService');
        const cancelledOrders = [];

        // Process each expired order
        for (const order of expiredOrders) {
            try {
                // Use transaction to ensure atomicity
                await prisma.$transaction(async (tx) => {
                    // Cancel QPAY invoice if it exists
                    if (order.qpayInvoiceId) {
                        try {
                            await qpayService.cancelInvoice(order.qpayInvoiceId);
                            console.log(`Cancelled QPAY invoice ${order.qpayInvoiceId} for order ${order.id}`);
                        } catch (error) {
                            // Log error but continue with order cancellation
                            // Invoice might already be cancelled or paid
                            console.error(`Failed to cancel QPAY invoice ${order.qpayInvoiceId} for order ${order.id}:`, error.message);
                        }
                    }

                    // Restore stock for all items in the order
                    for (const item of order.items) {
                        await tx.product.update({
                            where: { id: item.productId },
                            data: {
                                stock: {
                                    increment: item.quantity
                                }
                            }
                        });
                    }

                    // Update order status to CANCELLED
                    await tx.order.update({
                        where: { id: order.id },
                        data: {
                            status: 'CANCELLED',
                            paymentStatus: 'CANCELLED'
                        }
                    });
                });

                cancelledOrders.push({
                    orderId: order.id,
                    cancelledAt: new Date()
                });

                console.log(`Cancelled expired pending order ${order.id} (created at ${order.createdAt})`);
            } catch (error) {
                // Log error but continue with other orders
                console.error(`Failed to cancel expired order ${order.id}:`, error.message);
            }
        }

        return {
            cancelled: cancelledOrders.length,
            orders: cancelledOrders
        };
    }

    /**
     * Request order cancellation - Generate 4-digit code and send to user's phone (admin only)
     * @param {string} orderId - Order ID
     * @returns {Promise<Object>} - Cancellation request info
     */
    async requestCancellation(orderId) {
        const order = await prisma.order.findUnique({
            where: { id: String(orderId) },
            include: {
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

        // Check if order is paid/completed
        if (order.paymentStatus !== 'PAID' && order.status !== 'COMPLETED' && order.status !== 'PROCESSING') {
            const error = new Error('Order cancellation can only be requested for paid/completed orders');
            error.statusCode = 400;
            throw error;
        }

        // Check if order is already cancelled
        if (isOrderCancelled(order)) {
            const error = new Error('Order is already cancelled');
            error.statusCode = 400;
            throw error;
        }

        // Check if user exists (not a guest order)
        if (!order.user || !order.user.phoneNumber) {
            const error = new Error('Cannot cancel guest orders. User phone number is required.');
            error.statusCode = 400;
            throw error;
        }

        // Generate 4-digit cancellation code
        const cancellationCode = Math.floor(1000 + Math.random() * 9000).toString(); // 4-digit code

        // Store cancellation code in OTP table with purpose 'ORDER_CANCELLATION'
        const expiresAt = new Date();
        expiresAt.setMinutes(expiresAt.getMinutes() + 10); // Valid for 10 minutes

        // Invalidate any existing cancellation codes for this order
        await prisma.otp.updateMany({
            where: {
                phoneNumber: order.user.phoneNumber,
                purpose: 'ORDER_CANCELLATION',
                isUsed: false
            },
            data: {
                isUsed: true // Mark as used to invalidate
            }
        });

        // Create new cancellation code
        await prisma.otp.create({
            data: {
                phoneNumber: order.user.phoneNumber,
                code: cancellationCode,
                purpose: 'ORDER_CANCELLATION',
                expiresAt: expiresAt,
                isUsed: false
            }
        });

        let smsSent = false;
        try {
            const smsService = require('./smsService');
            const smsResult = await smsService.sendOTP(order.user.phoneNumber, cancellationCode, 'ORDER_CANCELLATION');
            smsSent = smsResult.success;
            if (!smsResult.success) {
                console.error(`Failed to send cancellation SMS to ${order.user.phoneNumber}:`, smsResult.error);
            } else {
                await this.recordOrderActivity(order.id, {
                    type: 'MESSAGE_SENT',
                    title: 'Cancellation code sent to user',
                    description: '4-digit code sent via SMS',
                    channel: 'sms',
                    toValue: order.user.phoneNumber
                });
            }
        } catch (smsError) {
            console.error(`Error sending cancellation SMS:`, smsError.message);
        }

        return {
            success: true,
            message: 'Cancellation code sent to user\'s phone',
            orderId: order.id,
            userPhone: order.user.phoneNumber,
            expiresAt: expiresAt.toISOString(),
            expiresInMinutes: 10,
            smsSent
        };
    }

    /**
     * Confirm order cancellation with 4-digit code (admin only)
     * @param {string} orderId - Order ID
     * @param {string} code - 4-digit cancellation code
     * @param {number|null} performedBy - Admin user ID who confirmed (for timeline)
     * @returns {Promise<Object>} - Cancelled order info
     */
    async confirmCancellation(orderId, code, performedBy = null) {
        const order = await prisma.order.findUnique({
            where: { id: String(orderId) },
            include: {
                user: {
                    select: {
                        id: true,
                        phoneNumber: true,
                        name: true
                    }
                },
                items: {
                    include: {
                        product: {
                            select: {
                                id: true,
                                stock: true
                            }
                        }
                    }
                }
            }
        });

        if (!order) {
            const error = new Error('Order not found');
            error.statusCode = 404;
            throw error;
        }

        // Check if order is already cancelled
        if (isOrderCancelled(order)) {
            const error = new Error('Order is already cancelled');
            error.statusCode = 400;
            throw error;
        }

        // Check if user exists
        if (!order.user || !order.user.phoneNumber) {
            const error = new Error('Cannot cancel guest orders. User phone number is required.');
            error.statusCode = 400;
            throw error;
        }

        // Validate cancellation code
        const otpRecord = await prisma.otp.findFirst({
            where: {
                phoneNumber: order.user.phoneNumber,
                code: code,
                purpose: 'ORDER_CANCELLATION',
                isUsed: false,
                expiresAt: {
                    gt: new Date()
                }
            }
        });

        if (!otpRecord) {
            const error = new Error('Invalid or expired cancellation code');
            error.statusCode = 400;
            throw error;
        }

        // Use transaction to ensure atomicity
        const cancelledOrder = await prisma.$transaction(async (tx) => {
            // Mark OTP as used
            await tx.otp.update({
                where: { id: otpRecord.id },
                data: { isUsed: true }
            });

            // Restore stock for all items in the order
            for (const item of order.items) {
                await tx.product.update({
                    where: { id: item.productId },
                    data: {
                        stock: {
                            increment: item.quantity
                        }
                    }
                });
            }

            // Update order status to CANCELLED_BY_ADMIN (user confirmed via admin SMS code)
            const updatedOrder = await tx.order.update({
                where: { id: order.id },
                data: {
                    status: STATUS_CANCELLED_BY_ADMIN,
                    paymentStatus: 'CANCELLED'
                },
                include: {
                    user: {
                        select: {
                            id: true,
                            phoneNumber: true,
                            name: true
                        }
                    },
                    items: {
                        include: {
                            product: {
                                select: {
                                    id: true,
                                    name: true,
                                    price: true
                                }
                            }
                        }
                    }
                }
            });

            return updatedOrder;
        });

        await this.recordOrderActivity(order.id, {
            type: 'STATUS_CHANGED',
            title: 'Order cancelled',
            fromValue: order.status,
            toValue: STATUS_CANCELLED_BY_ADMIN,
            description: 'User confirmed cancellation with code',
            performedBy: performedBy != null && performedBy !== '' ? parseInt(performedBy) : null
        });

        return {
            success: true,
            message: 'Order cancelled successfully',
            order: cancelledOrder
        };
    }

    /**
     * Update order status (admin only)
     * @param {string} orderId - Order ID
     * @param {string} status - New order status
     * @param {number|null} performedBy - Admin user ID who changed status (for timeline)
     * @returns {Promise<Object>} Updated order
     */
    async updateOrderStatus(orderId, status, performedBy = null) {
        const order = await prisma.order.findUnique({
            where: { id: String(orderId) },
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
                        name: true,
                        email: true
                    }
                }
            }
        });

        if (!order) {
            const error = new Error('Order not found');
            error.statusCode = 404;
            throw error;
        }

        // Validate status is not empty
        const newStatus = status && typeof status === 'string' ? status.trim() : '';
        if (!newStatus) {
            const error = new Error('Order status is required');
            error.statusCode = 400;
            throw error;
        }

        // Record status change for timeline (before update so we have old status)
        await this.recordOrderActivity(orderId, {
            type: 'STATUS_CHANGED',
            title: 'Status updated',
            fromValue: order.status,
            toValue: newStatus,
            performedBy: performedBy != null && performedBy !== '' ? parseInt(performedBy) : null
        });

        // Update order status
        const updatedOrder = await prisma.order.update({
            where: { id: String(orderId) },
            data: {
                status: newStatus
            },
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
                        name: true,
                        email: true
                    }
                }
            }
        });

        // When status changes to DELIVERY_STARTED (e.g. from PAID/COMPLETED), send SMS to contact/user phone
        const deliveryPhone = order.contactPhoneNumber || order.address?.phoneNumber || order.user?.phoneNumber;
        if (newStatus.toUpperCase() === STATUS_DELIVERY_STARTED && deliveryPhone) {
            const message = `Таны #${order.id} дугаартай захиалга хүргэлтэд гарлаа.`;
            try {
                const smsResult = await smsService.sendSMS(deliveryPhone, message);
                if (!smsResult.success) {
                    console.error(`Failed to send delivery-started SMS to ${deliveryPhone}:`, smsResult.error);
                } else {
                    await this.recordOrderActivity(orderId, {
                        type: 'MESSAGE_SENT',
                        title: 'Delivery started SMS sent',
                        description: 'User notified that delivery has started',
                        channel: 'sms',
                        toValue: deliveryPhone,
                        performedBy: performedBy != null && performedBy !== '' ? parseInt(performedBy) : null
                    });
                }
            } catch (smsError) {
                console.error('Error sending delivery-started SMS:', smsError.message);
            }
        }

        // Format products to extract categories
        if (updatedOrder && updatedOrder.items) {
            updatedOrder.items = updatedOrder.items.map(item => {
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

        return updatedOrder;
    }

    /**
     * Record an order activity for the timeline (status changes, messages sent, etc.)
     * @param {string} orderId - Order ID
     * @param {Object} data - { type, title?, description?, fromValue?, toValue?, channel?, performedBy? }
     * @returns {Promise<Object>} Created activity
     */
    async recordOrderActivity(orderId, data = {}) {
        const { type, title, description, fromValue, toValue, channel, performedBy } = data;
        if (!type || typeof type !== 'string') return null;
        try {
            return await prisma.orderactivity.create({
                data: {
                    orderId: String(orderId),
                    type: type.trim(),
                    ...(title != null && { title: String(title).slice(0, 255) }),
                    ...(description != null && { description: String(description) }),
                    ...(fromValue != null && { fromValue: String(fromValue).slice(0, 100) }),
                    ...(toValue != null && { toValue: String(toValue).slice(0, 100) }),
                    ...(channel != null && { channel: String(channel).slice(0, 20) }),
                    ...(performedBy != null && performedBy !== '' && { performedBy: parseInt(performedBy) })
                }
            });
        } catch (err) {
            console.error('[OrderService] recordOrderActivity failed:', err.message);
            return null;
        }
    }

    /**
     * Get order timeline (activities) for admin dashboard
     * @param {string} orderId - Order ID
     * @returns {Promise<Array>} Activities sorted by createdAt desc, with optional synthetic "Order created" event
     */
    async getOrderTimeline(orderId) {
        const order = await prisma.order.findUnique({
            where: { id: String(orderId) },
            select: { id: true, createdAt: true, status: true, paymentStatus: true, paidAt: true }
        });
        if (!order) {
            const error = new Error('Order not found');
            error.statusCode = 404;
            throw error;
        }

        const activities = await prisma.orderactivity.findMany({
            where: { orderId: String(orderId) },
            include: {
                performer: {
                    select: { id: true, name: true }
                }
            },
            orderBy: { createdAt: 'asc' }
        });

        // Prepend synthetic "Order created" so timeline always has a start
        const syntheticCreated = {
            id: 0,
            orderId: order.id,
            type: 'ORDER_CREATED',
            title: 'Order placed',
            description: null,
            fromValue: null,
            toValue: 'PENDING',
            channel: null,
            performedBy: null,
            createdAt: order.createdAt,
            performer: null,
            _synthetic: true
        };

        const list = [syntheticCreated, ...activities.map(a => ({
            ...a,
            createdAt: a.createdAt,
            performer: a.performer ? { id: a.performer.id, name: a.performer.name } : null
        }))];

        // Sort by createdAt asc for timeline display (oldest first)
        list.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
        return list;
    }

    /**
     * Get ebarimt (receipt) info for an order – for admin print.
     * @param {string} orderId - Order ID
     * @returns {Promise<{ ebarimtId: string|null, receiptUrl: string|null }>}
     */
    async getOrderEbarimtForPrint(orderId) {
        const order = await prisma.order.findUnique({
            where: { id: String(orderId) },
            select: { ebarimtId: true, ebarimtReceiptUrl: true }
        });
        if (!order) {
            const error = new Error('Order not found');
            error.statusCode = 404;
            throw error;
        }
        return {
            ebarimtId: order.ebarimtId ?? null,
            receiptUrl: order.ebarimtReceiptUrl ?? null
        };
    }
}

module.exports = new OrderService();
