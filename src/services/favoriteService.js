const prisma = require('../lib/prisma');
const productService = require('./productService');

class FavoriteService {
    /**
     * Get user's favorite products
     * @param {number} userId - User ID
     * @param {Object} options - Pagination and sorting options
     * @returns {Object} - { products, pagination }
     */
    async getFavorites(userId, options = {}) {
        const page = parseInt(options.page) || 1;
        const limit = parseInt(options.limit) || 50;
        const validPage = page > 0 ? page : 1;
        const validLimit = limit > 0 && limit <= 100 ? limit : 50;

        const skip = (validPage - 1) * validLimit;

        // Get total count
        const total = await prisma.favorite.count({
            where: { userId: parseInt(userId) }
        });

        // Get favorites with product details
        const favorites = await prisma.favorite.findMany({
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
            },
            skip,
            take: validLimit
        });

        // Format products with discount information
        const products = favorites.map(favorite => {
            const formatted = productService.formatProductWithDiscount(favorite.product);
            formatted.favoritedAt = favorite.createdAt;
            return formatted;
        });

        const totalPages = Math.ceil(total / validLimit);

        return {
            products,
            pagination: {
                total,
                page: validPage,
                limit: validLimit,
                totalPages
            }
        };
    }

    /**
     * Add product to favorites
     * @param {number} userId - User ID
     * @param {number} productId - Product ID
     * @returns {Object} - Favorite with product information
     */
    async addFavorite(userId, productId) {
        const prodId = parseInt(productId);
        const uid = parseInt(userId);

        // Verify product exists
        await productService.getProductById(prodId);

        // Check if already favorited
        const existingFavorite = await prisma.favorite.findUnique({
            where: {
                userId_productId: {
                    userId: uid,
                    productId: prodId
                }
            }
        });

        if (existingFavorite) {
            // Already favorited, return existing favorite
            const favorite = await prisma.favorite.findUnique({
                where: {
                    userId_productId: {
                        userId: uid,
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

            const formatted = productService.formatProductWithDiscount(favorite.product);
            formatted.favoritedAt = favorite.createdAt;
            return formatted;
        }

        // Create new favorite
        const favorite = await prisma.favorite.create({
            data: {
                userId: uid,
                productId: prodId
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

        const formatted = productService.formatProductWithDiscount(favorite.product);
        formatted.favoritedAt = favorite.createdAt;
        return formatted;
    }

    /**
     * Remove product from favorites
     * @param {number} userId - User ID
     * @param {number} productId - Product ID
     * @returns {Object} - Removed favorite with product information
     */
    async removeFavorite(userId, productId) {
        const prodId = parseInt(productId);
        const uid = parseInt(userId);

        // Check if favorite exists
        const existingFavorite = await prisma.favorite.findUnique({
            where: {
                userId_productId: {
                    userId: uid,
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

        if (!existingFavorite) {
            const error = new Error('Product is not in favorites');
            error.statusCode = 404;
            throw error;
        }

        // Delete favorite
        await prisma.favorite.delete({
            where: {
                userId_productId: {
                    userId: uid,
                    productId: prodId
                }
            }
        });

        const formatted = productService.formatProductWithDiscount(existingFavorite.product);
        formatted.favoritedAt = existingFavorite.createdAt;
        return formatted;
    }

    /**
     * Check if a product is favorited by user
     * @param {number} userId - User ID
     * @param {number} productId - Product ID
     * @returns {boolean} - True if favorited, false otherwise
     */
    async isFavorited(userId, productId) {
        const favorite = await prisma.favorite.findUnique({
            where: {
                userId_productId: {
                    userId: parseInt(userId),
                    productId: parseInt(productId)
                }
            }
        });

        return !!favorite;
    }

    /**
     * Get favorite status for multiple products
     * @param {number} userId - User ID
     * @param {Array<number>} productIds - Array of product IDs
     * @returns {Object} - Map of productId to boolean (favorited or not)
     */
    async getFavoriteStatuses(userId, productIds) {
        if (!productIds || productIds.length === 0) {
            return {};
        }

        const favorites = await prisma.favorite.findMany({
            where: {
                userId: parseInt(userId),
                productId: {
                    in: productIds.map(id => parseInt(id))
                }
            },
            select: {
                productId: true
            }
        });

        const favoriteMap = {};
        productIds.forEach(id => {
            favoriteMap[id] = false;
        });

        favorites.forEach(favorite => {
            favoriteMap[favorite.productId] = true;
        });

        return favoriteMap;
    }
}

module.exports = new FavoriteService();
