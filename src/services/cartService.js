const prisma = require('../lib/prisma');
const productService = require('./productService');
const crypto = require('crypto');

class CartService {
    /**
     * Generate a unique session token for guest checkout
     * @returns {string} - Unique session token
     */
    generateSessionToken() {
        return crypto.randomBytes(32).toString('hex');
    }

    /**
     * Format product categories for response
     * @param {Object} item - Cart item with product
     * @returns {Object} - Formatted item
     */
    formatProductCategories(item) {
        const formatted = { ...item };
        if (item.product) {
            formatted.product = { ...item.product };
            if (item.product.categories) {
                formatted.product.categories = item.product.categories.map(pc => pc.category);
                formatted.product.categoryId = formatted.product.categories.length > 0 
                    ? formatted.product.categories[0].id 
                    : null;
                formatted.product.category = formatted.product.categories.length > 0 
                    ? formatted.product.categories[0] 
                    : null;
            } else {
                formatted.product.categories = [];
                formatted.product.categoryId = null;
                formatted.product.category = null;
            }
        }
        return formatted;
    }

    /**
     * Validate quantity input
     * @param {number} quantity - Quantity to validate
     * @returns {Object} - { isValid, error }
     */
    validateQuantity(quantity) {
        const qty = parseInt(quantity);
        if (isNaN(qty) || qty <= 0) {
            return {
                isValid: false,
                error: 'Quantity must be a valid positive integer'
            };
        }
        return { isValid: true };
    }

    /**
     * Validate that either userId or sessionToken is provided (not both, not neither)
     * @param {number|null} userId - User ID
     * @param {string|null} sessionToken - Session token
     * @throws {Error} - If validation fails
     */
    validateCartIdentifier(userId, sessionToken) {
        if (userId && sessionToken) {
            const error = new Error('Cannot specify both userId and sessionToken');
            error.statusCode = 400;
            throw error;
        }
        if (!userId && !sessionToken) {
            const error = new Error('Either userId or sessionToken must be provided');
            error.statusCode = 400;
            throw error;
        }
    }

    /**
     * Get user's or guest's cart with product details
     * @param {number|null} userId - User ID (for authenticated users)
     * @param {string|null} sessionToken - Session token (for guest users)
     * @returns {Array} - Cart items with product information
     */
    async getCart(userId = null, sessionToken = null) {
        this.validateCartIdentifier(userId, sessionToken);

        const whereClause = userId 
            ? { userId: parseInt(userId) }
            : { sessionToken: sessionToken };

        const cartItems = await prisma.cartitem.findMany({
            where: whereClause,
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
            },
            orderBy: {
                createdAt: 'desc'
            }
        });

        // Format products to extract categories
        return cartItems.map(item => this.formatProductCategories(item));
    }

    /**
     * Get guest cart by session token
     * @param {string} sessionToken - Session token
     * @returns {Array} - Cart items with product information
     */
    async getCartBySession(sessionToken) {
        return this.getCart(null, sessionToken);
    }

    /**
     * Add item to cart or update quantity if already exists
     * Supports both authenticated and guest carts
     * @param {number|null} userId - User ID (for authenticated users)
     * @param {string|null} sessionToken - Session token (for guest users)
     * @param {number} productId - Product ID
     * @param {number} quantity - Quantity to add
     * @returns {Object} - Cart item with product information
     */
    async addToCart(userId = null, sessionToken = null, productId, quantity) {
        this.validateCartIdentifier(userId, sessionToken);

        // Validate quantity
        const quantityValidation = this.validateQuantity(quantity);
        if (!quantityValidation.isValid) {
            const error = new Error(quantityValidation.error);
            error.statusCode = 400;
            throw error;
        }

        const qty = parseInt(quantity);
        const prodId = parseInt(productId);

        // Check if product exists and has sufficient stock
        const stockCheck = await productService.checkStockAvailability(prodId, qty);
        if (!stockCheck.hasStock) {
            const error = new Error(`Барааны үлдэгдэл хүрэлцэхгүй байна. Байгаа: ${stockCheck.product.stock}, Авах гэсэн: ${qty}`);
            error.statusCode = 400;
            throw error;
        }

        // Check if cart item already exists
        // For authenticated users, use compound unique constraint
        // For guest users, use findFirst since compound unique with nullable fields may not work with findUnique
        let existingCartItem;
        if (userId) {
            existingCartItem = await prisma.cartitem.findUnique({
                where: {
                    userId_productId: {
                        userId: parseInt(userId),
                        productId: prodId
                    }
                },
                include: {
                    product: true
                }
            });
        } else {
            existingCartItem = await prisma.cartitem.findFirst({
                where: {
                    sessionToken: sessionToken,
                    productId: prodId
                },
                include: {
                    product: true
                }
            });
        }

        if (existingCartItem) {
            // Update quantity: check if total quantity (existing + new) exceeds stock
            const totalQuantity = existingCartItem.quantity + qty;
            const stockCheckForUpdate = await productService.checkStockAvailability(prodId, totalQuantity);
            if (!stockCheckForUpdate.hasStock) {
                const error = new Error(`Барааны үлдэгдэл хүрэлцэхгүй байна. Байгаа: ${stockCheckForUpdate.product.stock}, Авах гэсэн: ${totalQuantity}`);
                error.statusCode = 400;
                throw error;
            }

            // Update existing cart item
            const updateWhere = userId
                ? { userId_productId: { userId: parseInt(userId), productId: prodId } }
                : { id: existingCartItem.id }; // Use id for guest cart items since we can't use compound unique

            const updatedCartItem = await prisma.cartitem.update({
                where: updateWhere,
                data: {
                    quantity: totalQuantity
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

            return this.formatProductCategories(updatedCartItem);
        } else {
            // Create new cart item
            const cartItemData = {
                productId: prodId,
                quantity: qty
            };

            if (userId) {
                cartItemData.userId = parseInt(userId);
            } else {
                cartItemData.sessionToken = sessionToken;
            }

            const cartItem = await prisma.cartitem.create({
                data: cartItemData,
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

            return this.formatProductCategories(cartItem);
        }
    }

    /**
     * Add item to guest cart by session token
     * @param {string} sessionToken - Session token
     * @param {number} productId - Product ID
     * @param {number} quantity - Quantity to add
     * @returns {Object} - Cart item with product information
     */
    async addToCartBySession(sessionToken, productId, quantity) {
        return this.addToCart(null, sessionToken, productId, quantity);
    }

    /**
     * Update cart item quantity
     * Supports both authenticated and guest carts
     * @param {number|null} userId - User ID (for authenticated users)
     * @param {string|null} sessionToken - Session token (for guest users)
     * @param {number} productId - Product ID
     * @param {number} quantity - New quantity
     * @returns {Object} - Updated cart item
     */
    async updateCartItem(userId = null, sessionToken = null, productId, quantity) {
        this.validateCartIdentifier(userId, sessionToken);

        // Validate quantity
        const quantityValidation = this.validateQuantity(quantity);
        if (!quantityValidation.isValid) {
            const error = new Error(quantityValidation.error);
            error.statusCode = 400;
            throw error;
        }

        const qty = parseInt(quantity);
        const prodId = parseInt(productId);

        // Check if cart item exists
        // For authenticated users, use compound unique constraint
        // For guest users, use findFirst since compound unique with nullable fields may not work with findUnique
        let existingCartItem;
        if (userId) {
            existingCartItem = await prisma.cartitem.findUnique({
                where: {
                    userId_productId: {
                        userId: parseInt(userId),
                        productId: prodId
                    }
                }
            });
        } else {
            existingCartItem = await prisma.cartitem.findFirst({
                where: {
                    sessionToken: sessionToken,
                    productId: prodId
                }
            });
        }

        if (!existingCartItem) {
            const error = new Error('Cart item not found');
            error.statusCode = 404;
            throw error;
        }

        // Check if product has sufficient stock for new quantity
        const stockCheck = await productService.checkStockAvailability(prodId, qty);
        if (!stockCheck.hasStock) {
            const error = new Error(`Барааны үлдэгдэл хүрэлцэхгүй байна. Байгаа: ${stockCheck.product.stock}, Авах гэсэн: ${qty}`);
            error.statusCode = 400;
            throw error;
        }

        // Update cart item
        const updateWhere = userId
            ? { userId_productId: { userId: parseInt(userId), productId: prodId } }
            : { id: existingCartItem.id }; // Use id for guest cart items since we can't use compound unique

        const updatedCartItem = await prisma.cartitem.update({
            where: updateWhere,
            data: {
                quantity: qty
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

        return this.formatProductCategories(updatedCartItem);
    }

    /**
     * Update guest cart item quantity
     * @param {string} sessionToken - Session token
     * @param {number} productId - Product ID
     * @param {number} quantity - New quantity
     * @returns {Object} - Updated cart item
     */
    async updateCartItemBySession(sessionToken, productId, quantity) {
        return this.updateCartItem(null, sessionToken, productId, quantity);
    }

    /**
     * Remove item from cart
     * Supports both authenticated and guest carts
     * @param {number|null} userId - User ID (for authenticated users)
     * @param {string|null} sessionToken - Session token (for guest users)
     * @param {number} productId - Product ID
     * @returns {Object} - Deleted cart item
     */
    async removeFromCart(userId = null, sessionToken = null, productId) {
        this.validateCartIdentifier(userId, sessionToken);

        const prodId = parseInt(productId);

        // Check if cart item exists
        // For authenticated users, use compound unique constraint
        // For guest users, use findFirst since compound unique with nullable fields may not work with findUnique
        let existingCartItem;
        if (userId) {
            existingCartItem = await prisma.cartitem.findUnique({
                where: {
                    userId_productId: {
                        userId: parseInt(userId),
                        productId: prodId
                    }
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
        } else {
            existingCartItem = await prisma.cartitem.findFirst({
                where: {
                    sessionToken: sessionToken,
                    productId: prodId
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
        }

        if (!existingCartItem) {
            const error = new Error('Cart item not found');
            error.statusCode = 404;
            throw error;
        }

        // Delete cart item - use id since we already found it
        await prisma.cartitem.delete({
            where: { id: existingCartItem.id }
        });

        return this.formatProductCategories(existingCartItem);
    }

    /**
     * Remove item from guest cart
     * @param {string} sessionToken - Session token
     * @param {number} productId - Product ID
     * @returns {Object} - Deleted cart item
     */
    async removeFromCartBySession(sessionToken, productId) {
        return this.removeFromCart(null, sessionToken, productId);
    }

    /**
     * Clear all items from user's or guest's cart
     * @param {number|null} userId - User ID (for authenticated users)
     * @param {string|null} sessionToken - Session token (for guest users)
     * @returns {number} - Number of items deleted
     */
    async clearCart(userId = null, sessionToken = null) {
        this.validateCartIdentifier(userId, sessionToken);

        const whereClause = userId
            ? { userId: parseInt(userId) }
            : { sessionToken: sessionToken };

        const result = await prisma.cartitem.deleteMany({
            where: whereClause
        });

        return result.count;
    }

    /**
     * Clear guest cart by session token
     * @param {string} sessionToken - Session token
     * @returns {number} - Number of items deleted
     */
    async clearCartBySession(sessionToken) {
        return this.clearCart(null, sessionToken);
    }

    /**
     * Merge guest cart into user's cart
     * When a guest logs in, merge their guest cart items into their user cart
     * @param {string} guestSessionToken - Guest session token
     * @param {number} userId - User ID to merge into
     * @returns {Object} - { mergedCount, skippedCount } - Number of items merged and skipped
     */
    async mergeGuestCartToUser(guestSessionToken, userId) {
        if (!guestSessionToken) {
            return { mergedCount: 0, skippedCount: 0 };
        }

        const userIdInt = parseInt(userId);

        // Get guest cart items
        const guestCartItems = await prisma.cartitem.findMany({
            where: { sessionToken: guestSessionToken },
            include: {
                product: true
            }
        });

        if (!guestCartItems || guestCartItems.length === 0) {
            return { mergedCount: 0, skippedCount: 0 };
        }

        let mergedCount = 0;
        let skippedCount = 0;

        // Process each guest cart item
        for (const guestItem of guestCartItems) {
            try {
                // Check if user already has this product in cart
                const existingUserCartItem = await prisma.cartitem.findUnique({
                    where: {
                        userId_productId: {
                            userId: userIdInt,
                            productId: guestItem.productId
                        }
                    }
                });

                if (existingUserCartItem) {
                    // Merge quantities: add guest quantity to user cart quantity
                    const totalQuantity = existingUserCartItem.quantity + guestItem.quantity;

                    // Validate stock availability for merged quantity
                    const stockCheck = await productService.checkStockAvailability(
                        guestItem.productId,
                        totalQuantity
                    );

                    if (stockCheck.hasStock) {
                        // Update user cart item with merged quantity
                        await prisma.cartitem.update({
                            where: {
                                userId_productId: {
                                    userId: userIdInt,
                                    productId: guestItem.productId
                                }
                            },
                            data: {
                                quantity: totalQuantity
                            }
                        });
                        mergedCount++;
                    } else {
                        // Skip if insufficient stock
                        skippedCount++;
                    }
                } else {
                    // User doesn't have this product, add it to user cart
                    // Validate stock availability
                    const stockCheck = await productService.checkStockAvailability(
                        guestItem.productId,
                        guestItem.quantity
                    );

                    if (stockCheck.hasStock) {
                        // Create new cart item for user
                        await prisma.cartitem.create({
                            data: {
                                userId: userIdInt,
                                productId: guestItem.productId,
                                quantity: guestItem.quantity
                            }
                        });
                        mergedCount++;
                    } else {
                        // Skip if insufficient stock
                        skippedCount++;
                    }
                }
            } catch (error) {
                // Skip item if there's an error (e.g., product deleted, stock issue)
                skippedCount++;
            }
        }

        // Clear guest cart after successful merge
        if (mergedCount > 0) {
            await prisma.cartitem.deleteMany({
                where: { sessionToken: guestSessionToken }
            });
        }

        return { mergedCount, skippedCount };
    }
}

module.exports = new CartService();
