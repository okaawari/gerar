const prisma = require('../lib/prisma');
const productService = require('./productService');

class CartService {
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
     * Get user's cart with product details
     * @param {number} userId - User ID
     * @returns {Array} - Cart items with product information
     */
    async getCart(userId) {
        const cartItems = await prisma.cartItem.findMany({
            where: { userId: parseInt(userId) },
            include: {
                product: {
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
            },
            orderBy: {
                createdAt: 'desc'
            }
        });

        return cartItems;
    }

    /**
     * Add item to cart or update quantity if already exists
     * @param {number} userId - User ID
     * @param {number} productId - Product ID
     * @param {number} quantity - Quantity to add
     * @returns {Object} - Cart item with product information
     */
    async addToCart(userId, productId, quantity) {
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
            const error = new Error(`Insufficient stock. Available: ${stockCheck.product.stock}, Requested: ${qty}`);
            error.statusCode = 400;
            throw error;
        }

        // Check if cart item already exists
        const existingCartItem = await prisma.cartItem.findUnique({
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

        if (existingCartItem) {
            // Update quantity: check if total quantity (existing + new) exceeds stock
            const totalQuantity = existingCartItem.quantity + qty;
            const stockCheckForUpdate = await productService.checkStockAvailability(prodId, totalQuantity);
            if (!stockCheckForUpdate.hasStock) {
                const error = new Error(`Insufficient stock. Available: ${stockCheckForUpdate.product.stock}, Requested total: ${totalQuantity}`);
                error.statusCode = 400;
                throw error;
            }

            // Update existing cart item
            const updatedCartItem = await prisma.cartItem.update({
                where: {
                    userId_productId: {
                        userId: parseInt(userId),
                        productId: prodId
                    }
                },
                data: {
                    quantity: totalQuantity
                },
                include: {
                    product: {
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
            });

            return updatedCartItem;
        } else {
            // Create new cart item
            const cartItem = await prisma.cartItem.create({
                data: {
                    userId: parseInt(userId),
                    productId: prodId,
                    quantity: qty
                },
                include: {
                    product: {
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
            });

            return cartItem;
        }
    }

    /**
     * Update cart item quantity
     * @param {number} userId - User ID
     * @param {number} productId - Product ID
     * @param {number} quantity - New quantity
     * @returns {Object} - Updated cart item
     */
    async updateCartItem(userId, productId, quantity) {
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
        const existingCartItem = await prisma.cartItem.findUnique({
            where: {
                userId_productId: {
                    userId: parseInt(userId),
                    productId: prodId
                }
            }
        });

        if (!existingCartItem) {
            const error = new Error('Cart item not found');
            error.statusCode = 404;
            throw error;
        }

        // Check if product has sufficient stock for new quantity
        const stockCheck = await productService.checkStockAvailability(prodId, qty);
        if (!stockCheck.hasStock) {
            const error = new Error(`Insufficient stock. Available: ${stockCheck.product.stock}, Requested: ${qty}`);
            error.statusCode = 400;
            throw error;
        }

        // Update cart item
        const updatedCartItem = await prisma.cartItem.update({
            where: {
                userId_productId: {
                    userId: parseInt(userId),
                    productId: prodId
                }
            },
            data: {
                quantity: qty
            },
            include: {
                product: {
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
        });

        return updatedCartItem;
    }

    /**
     * Remove item from cart
     * @param {number} userId - User ID
     * @param {number} productId - Product ID
     * @returns {Object} - Deleted cart item
     */
    async removeFromCart(userId, productId) {
        const prodId = parseInt(productId);

        // Check if cart item exists
        const existingCartItem = await prisma.cartItem.findUnique({
            where: {
                userId_productId: {
                    userId: parseInt(userId),
                    productId: prodId
                }
            },
            include: {
                product: {
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
        });

        if (!existingCartItem) {
            const error = new Error('Cart item not found');
            error.statusCode = 404;
            throw error;
        }

        // Delete cart item
        await prisma.cartItem.delete({
            where: {
                userId_productId: {
                    userId: parseInt(userId),
                    productId: prodId
                }
            }
        });

        return existingCartItem;
    }

    /**
     * Clear all items from user's cart
     * @param {number} userId - User ID
     * @returns {number} - Number of items deleted
     */
    async clearCart(userId) {
        const result = await prisma.cartItem.deleteMany({
            where: { userId: parseInt(userId) }
        });

        return result.count;
    }
}

module.exports = new CartService();

