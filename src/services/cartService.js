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
        const cartItems = await prisma.cartitem.findMany({
            where: { userId: parseInt(userId) },
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
        return cartItems.map(item => {
            const formatted = { ...item };
            if (item.product) {
                formatted.product = { ...item.product };
                formatted.product.categories = item.product.categories
                    ? item.product.categories.map(pc => pc.category)
                    : [];
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
        const existingCartItem = await prisma.cartitem.findUnique({
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
            const updatedCartItem = await prisma.cartitem.update({
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

            // Format product categories
            const formatted = { ...updatedCartItem };
            if (updatedCartItem.product) {
                formatted.product = { ...updatedCartItem.product };
                if (updatedCartItem.product.categories) {
                    formatted.product.categories = updatedCartItem.product.categories.map(pc => pc.category);
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
        } else {
            // Create new cart item
            const cartItem = await prisma.cartitem.create({
                data: {
                    userId: parseInt(userId),
                    productId: prodId,
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

            // Format product categories
            const formatted = { ...cartItem };
            if (cartItem.product) {
                formatted.product = { ...cartItem.product };
                if (cartItem.product.categories) {
                    formatted.product.categories = cartItem.product.categories.map(pc => pc.category);
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
        const existingCartItem = await prisma.cartitem.findUnique({
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
        const updatedCartItem = await prisma.cartitem.update({
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

        // Format product categories
        const formatted = { ...updatedCartItem };
        if (updatedCartItem.product) {
            formatted.product = { ...updatedCartItem.product };
            if (updatedCartItem.product.categories) {
                formatted.product.categories = updatedCartItem.product.categories.map(pc => pc.category);
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
     * Remove item from cart
     * @param {number} userId - User ID
     * @param {number} productId - Product ID
     * @returns {Object} - Deleted cart item
     */
    async removeFromCart(userId, productId) {
        const prodId = parseInt(productId);

        // Check if cart item exists
        const existingCartItem = await prisma.cartitem.findUnique({
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

        if (!existingCartItem) {
            const error = new Error('Cart item not found');
            error.statusCode = 404;
            throw error;
        }

        // Delete cart item
        await prisma.cartitem.delete({
            where: {
                userId_productId: {
                    userId: parseInt(userId),
                    productId: prodId
                }
            }
        });

        // Format product categories
        const formatted = { ...existingCartItem };
        if (existingCartItem.product) {
            formatted.product = { ...existingCartItem.product };
            if (existingCartItem.product.categories) {
                formatted.product.categories = existingCartItem.product.categories.map(pc => pc.category);
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
     * Clear all items from user's cart
     * @param {number} userId - User ID
     * @returns {number} - Number of items deleted
     */
    async clearCart(userId) {
        const result = await prisma.cartitem.deleteMany({
            where: { userId: parseInt(userId) }
        });

        return result.count;
    }
}

module.exports = new CartService();

