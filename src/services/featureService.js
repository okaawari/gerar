const prisma = require('../lib/prisma');

class FeatureService {
    validateFeature(data) {
        const errors = [];

        if (data.name !== undefined) {
            if (!data.name || typeof data.name !== 'string' || data.name.trim().length === 0) {
                errors.push('Feature name is required and must be a non-empty string');
            }
            if (data.name && data.name.length > 191) {
                errors.push('Feature name must be 191 characters or less');
            }
        }

        if (data.description !== undefined && data.description !== null) {
            if (typeof data.description !== 'string') {
                errors.push('Feature description must be a string');
            }
        }

        if (data.order !== undefined && data.order !== null) {
            const order = parseInt(data.order);
            if (isNaN(order) || order < 0) {
                errors.push('Order must be a valid non-negative integer');
            }
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }

    async getAllFeatures({ includeProducts = false, includeHidden = false, includeDeleted = false } = {}) {
        if (!includeProducts) {
            return await prisma.feature.findMany({
                orderBy: [
                    { order: 'asc' },
                    { createdAt: 'desc' }
                ]
            });
        }

        const productWhere = {};
        if (!includeHidden) productWhere.isHidden = false;
        if (!includeDeleted) productWhere.deletedAt = null;

        const features = await prisma.feature.findMany({
            include: {
                products: {
                    include: {
                        product: true
                    },
                    orderBy: {
                        order: 'asc'
                    }
                }
            },
            orderBy: [
                { order: 'asc' },
                { createdAt: 'desc' }
            ]
        });

        return features.map(feature => ({
            ...feature,
            products: feature.products
                .filter(pf => {
                    const product = pf.product;
                    if (!includeHidden && product.isHidden) return false;
                    if (!includeDeleted && product.deletedAt) return false;
                    return true;
                })
                .map(pf => pf.product)
        }));
    }

    async getFeatureById(id, { includeProducts = true, includeHidden = false, includeDeleted = false } = {}) {
        const feature = await prisma.feature.findUnique({
            where: { id: parseInt(id) },
            include: includeProducts
                ? {
                    products: {
                        include: {
                            product: true
                        },
                        orderBy: {
                            order: 'asc'
                        }
                    }
                }
                : undefined
        });

        if (!feature) {
            const error = new Error('Feature not found');
            error.statusCode = 404;
            throw error;
        }

        if (!includeProducts) {
            return feature;
        }

        const filteredProducts = feature.products
            .filter(pf => {
                const product = pf.product;
                if (!includeHidden && product.isHidden) return false;
                if (!includeDeleted && product.deletedAt) return false;
                return true;
            })
            .map(pf => pf.product);

        return {
            ...feature,
            products: filteredProducts
        };
    }

    async createFeature(data) {
        const validation = this.validateFeature(data);
        if (!validation.isValid) {
            const error = new Error(validation.errors.join(', '));
            error.statusCode = 400;
            throw error;
        }

        const existingFeature = await prisma.feature.findFirst({
            where: { name: data.name.trim() }
        });

        if (existingFeature) {
            const error = new Error('Feature with this name already exists');
            error.statusCode = 409;
            throw error;
        }

        const featureData = {
            name: data.name.trim(),
            description: data.description ? data.description.trim() : null,
            order: data.order !== undefined && data.order !== null ? parseInt(data.order) : 0
        };

        if (data.adminId !== undefined && data.adminId !== null) {
            featureData.createdBy = parseInt(data.adminId);
            featureData.updatedBy = parseInt(data.adminId);
        }

        return await prisma.feature.create({
            data: featureData
        });
    }

    async updateFeature(id, data) {
        const validation = this.validateFeature(data);
        if (!validation.isValid) {
            const error = new Error(validation.errors.join(', '));
            error.statusCode = 400;
            throw error;
        }

        const existingFeature = await prisma.feature.findUnique({
            where: { id: parseInt(id) }
        });

        if (!existingFeature) {
            const error = new Error('Feature not found');
            error.statusCode = 404;
            throw error;
        }

        if (data.name !== undefined) {
            const duplicate = await prisma.feature.findFirst({
                where: {
                    name: data.name.trim(),
                    id: { not: parseInt(id) }
                }
            });
            if (duplicate) {
                const error = new Error('Feature with this name already exists');
                error.statusCode = 409;
                throw error;
            }
        }

        const updateData = {};
        if (data.name !== undefined) updateData.name = data.name.trim();
        if (data.description !== undefined) updateData.description = data.description ? data.description.trim() : null;
        if (data.order !== undefined && data.order !== null) updateData.order = parseInt(data.order);

        if (data.adminId !== undefined && data.adminId !== null) {
            updateData.updatedBy = parseInt(data.adminId);
        }

        return await prisma.feature.update({
            where: { id: parseInt(id) },
            data: updateData
        });
    }

    async deleteFeature(id) {
        const feature = await prisma.feature.findUnique({
            where: { id: parseInt(id) },
            include: {
                products: {
                    select: { id: true }
                }
            }
        });

        if (!feature) {
            const error = new Error('Feature not found');
            error.statusCode = 404;
            throw error;
        }

        if (feature.products && feature.products.length > 0) {
            const error = new Error(`Cannot delete feature. ${feature.products.length} product(s) are associated with this feature. Please remove products first.`);
            error.statusCode = 409;
            throw error;
        }

        await prisma.feature.delete({
            where: { id: parseInt(id) }
        });

        return feature;
    }
}

module.exports = new FeatureService();
