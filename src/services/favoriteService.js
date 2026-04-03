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
                        categories: {
                            include: {
                                category: {
                                    select: { id: true, name: true, description: true }
                                }
                            }
                        }
                    }
                },
                pointProduct: true
            },

            orderBy: {
                createdAt: 'desc'
            },
            skip,
            take: validLimit
        });

        // Format items
        const products = favorites.map(favorite => {
            let formatted;
            if (favorite.pointProductId) {
                formatted = { ...favorite.pointProduct };
                formatted.isPointProduct = true;
            } else {
                formatted = productService.formatProductWithDiscount(favorite.product);
                formatted.isPointProduct = false;
                // Extract categories from ProductCategory junction table
                if (favorite.product && favorite.product.categories && favorite.product.categories.length > 0) {
                    formatted.categories = favorite.product.categories.map(pc => pc.category);
                    formatted.categoryId = formatted.categories.length > 0 ? formatted.categories[0].id : null;
                    formatted.category = formatted.categories.length > 0 ? formatted.categories[0] : null;
                } else {
                    formatted.categories = [];
                    formatted.categoryId = null;
                    formatted.category = null;
                }
            }
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
    async addFavorite(userId, productId, isPointProduct = false) {
        const prodId = parseInt(productId);
        const uid = parseInt(userId);

        if (isPointProduct) {
            const pointProductService = require('./pointProductService');
            await pointProductService.getPointProductById(prodId);
        } else {
            await productService.getProductById(prodId);
        }

        // Check if already favorited
        const where = isPointProduct 
            ? { userId_pointProductId: { userId: uid, pointProductId: prodId } }
            : { userId_productId: { userId: uid, productId: prodId } };

        const existingFavorite = await prisma.favorite.findUnique({
            where: where
        });

        if (existingFavorite) {
            return this._getFormattedFavorite(uid, prodId, isPointProduct);
        }

        // Create new favorite
        await prisma.favorite.create({
            data: {
                userId: uid,
                [isPointProduct ? 'pointProductId' : 'productId']: prodId
            }
        });

        return this._getFormattedFavorite(uid, prodId, isPointProduct);
    }

    /**
     * Internal helper to fetch and format a single favorite
     */
    async _getFormattedFavorite(userId, productId, isPointProduct) {
        const where = isPointProduct 
            ? { userId_pointProductId: { userId, pointProductId: productId } }
            : { userId_productId: { userId, productId } };

        const favorite = await prisma.favorite.findUnique({
            where: where,
            include: {
                product: {
                    include: {
                        categories: {
                            include: {
                                category: {
                                    select: { id: true, name: true, description: true }
                                }
                            }
                        }
                    }
                },
                pointProduct: true
            }
        });

        if (!favorite) return null;

        let formatted;
        if (isPointProduct) {
            formatted = { ...favorite.pointProduct };
            formatted.isPointProduct = true;
        } else {
            formatted = productService.formatProductWithDiscount(favorite.product);
            formatted.isPointProduct = false;
            if (favorite.product && favorite.product.categories && favorite.product.categories.length > 0) {
                formatted.categories = favorite.product.categories.map(pc => pc.category);
                formatted.categoryId = formatted.categories.length > 0 ? formatted.categories[0].id : null;
                formatted.category = formatted.categories.length > 0 ? formatted.categories[0] : null;
            } else {
                formatted.categories = [];
                formatted.categoryId = null;
                formatted.category = null;
            }
        }
        formatted.favoritedAt = favorite.createdAt;
        return formatted;
    }


    /**
     * Remove product from favorites
     * @param {number} userId - User ID
     * @param {number} productId - Product ID
     * @returns {Object} - Removed favorite with product information
     */
    async removeFavorite(userId, productId, isPointProduct = false) {
        const prodId = parseInt(productId);
        const uid = parseInt(userId);

        const where = isPointProduct 
            ? { userId_pointProductId: { userId: uid, pointProductId: prodId } }
            : { userId_productId: { userId: uid, productId: prodId } };

        const formatted = await this._getFormattedFavorite(uid, prodId, isPointProduct);

        if (!formatted) {
            const error = new Error('Item is not in favorites');
            error.statusCode = 404;
            throw error;
        }

        // Delete favorite
        await prisma.favorite.delete({
            where: where
        });

        return formatted;
    }


    /**
     * Check if a product is favorited by user
     * @param {number} userId - User ID
     * @param {number} productId - Product ID
     * @returns {boolean} - True if favorited, false otherwise
     */
    async isFavorited(userId, productId, isPointProduct = false) {
        const where = isPointProduct 
            ? { userId_pointProductId: { userId: parseInt(userId), pointProductId: parseInt(productId) } }
            : { userId_productId: { userId: parseInt(userId), productId: parseInt(productId) } };

        const favorite = await prisma.favorite.findUnique({
            where: where
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
