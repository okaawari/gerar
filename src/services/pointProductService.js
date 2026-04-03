const prisma = require('../lib/prisma');

class PointProductService {
    /**
     * Normalize image URLs
     */
    normalizeImageUrl(url) {
        if (!url || typeof url !== 'string') {
            return url || null;
        }
        const apiBaseUrl = process.env.API_BASE_URL || process.env.BASE_URL;
        if (apiBaseUrl && url.includes('localhost:3000')) {
            const baseUrl = apiBaseUrl.replace(/\/api$/, '');
            return url.replace(/http:\/\/localhost:3000/g, baseUrl);
        }
        if (apiBaseUrl && url.includes('127.0.0.1:3000')) {
            const baseUrl = apiBaseUrl.replace(/\/api$/, '');
            return url.replace(/http:\/\/127\.0\.0\.1:3000/g, baseUrl);
        }
        return url;
    }

    /**
     * Validate point product data
     */
    validatePointProduct(data) {
        const errors = [];
        if (data.name !== undefined && (!data.name || typeof data.name !== 'string' || data.name.trim().length === 0)) {
            errors.push('Name is required');
        }
        if (data.pointsPrice !== undefined) {
            const pointsPrice = parseInt(data.pointsPrice);
            if (isNaN(pointsPrice) || pointsPrice < 0) {
                errors.push('Points price must be a non-negative integer');
            }
        }
        if (data.stock !== undefined) {
            const stock = parseInt(data.stock);
            if (isNaN(stock) || stock < 0) {
                errors.push('Stock must be a non-negative integer');
            }
        }
        if (data.images !== undefined && !Array.isArray(data.images)) {
            errors.push('Images must be an array of strings');
        }

        return { isValid: errors.length === 0, errors };
    }

    /**
     * Format point product
     */
    formatPointProduct(product) {
        const formatted = { ...product };
        if (!formatted.images || !Array.isArray(formatted.images)) {
            formatted.images = [];
        }
        formatted.images = formatted.images.map(img => this.normalizeImageUrl(img)).filter(Boolean);
        formatted.firstImage = formatted.images.length > 0 ? this.normalizeImageUrl(formatted.images[0]) : null;
        return formatted;
    }

    /**
     * Get all point products
     */
    async getAllPointProducts(filters = {}) {
        const where = {};
        if (!filters.includeHidden) {
            where.isHidden = false;
        }
        if (filters.search) {
            where.OR = [
                { name: { contains: filters.search } },
                { description: { contains: filters.search } }
            ];
        }

        const page = parseInt(filters.page) || 1;
        const limit = parseInt(filters.limit) || 50;
        const skip = (page - 1) * limit;

        const [total, products] = await Promise.all([
            prisma.pointproduct.count({ where }),
            prisma.pointproduct.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' }
            })
        ]);

        return {
            products: products.map(p => this.formatPointProduct(p)),
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit)
            }
        };
    }

    /**
     * Get point product by ID
     */
    async getPointProductById(id) {
        const product = await prisma.pointproduct.findUnique({
            where: { id: parseInt(id) }
        });
        if (!product) {
            const error = new Error('Point product not found');
            error.statusCode = 404;
            throw error;
        }
        return this.formatPointProduct(product);
    }

    /**
     * Create point product
     */
    async createPointProduct(data) {
        const validation = this.validatePointProduct(data);
        if (!validation.isValid) {
            const error = new Error(validation.errors.join(', '));
            error.statusCode = 400;
            throw error;
        }

        return await prisma.pointproduct.create({
            data: {
                name: data.name.trim(),
                description: data.description || '',
                pointsPrice: parseInt(data.pointsPrice),
                stock: parseInt(data.stock || 0),
                images: Array.isArray(data.images) ? data.images : [],
                isHidden: data.isHidden === true || data.isHidden === 'true'
            }

        });
    }

    /**
     * Update point product
     */
    async updatePointProduct(id, data) {
        const updateData = {};
        if (data.name !== undefined) updateData.name = data.name.trim();
        if (data.description !== undefined) updateData.description = data.description;
        if (data.pointsPrice !== undefined) updateData.pointsPrice = parseInt(data.pointsPrice);
        if (data.stock !== undefined) updateData.stock = parseInt(data.stock);
        if (data.images !== undefined) updateData.images = data.images;
        if (data.isHidden !== undefined) updateData.isHidden = data.isHidden === true || data.isHidden === 'true';

        return await prisma.pointproduct.update({
            where: { id: parseInt(id) },
            data: updateData
        });
    }

    /**
     * Delete point product
     */
    async deletePointProduct(id) {
        return await prisma.pointproduct.delete({
            where: { id: parseInt(id) }
        });
    }

    /**
     * Check stock for point product
     */
    async checkPointStock(id, quantity) {
        const product = await prisma.pointproduct.findUnique({
            where: { id: parseInt(id) }
        });
        if (!product) return { hasStock: false };
        return {
            hasStock: product.stock >= quantity,
            product
        };
    }
}

module.exports = new PointProductService();
