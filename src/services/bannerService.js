const prisma = require('../lib/prisma');

class BannerService {
    validateBanner(data, { requireImages = true } = {}) {
        const errors = [];

        if (data.title !== undefined && data.title !== null) {
            if (typeof data.title !== 'string') {
                errors.push('Title must be a string');
            } else if (data.title.length > 255) {
                errors.push('Title must be 255 characters or less');
            }
        }

        if (data.description !== undefined && data.description !== null) {
            if (typeof data.description !== 'string') {
                errors.push('Description must be a string');
            }
        }

        if (requireImages || data.imageDesktop !== undefined) {
            if (!data.imageDesktop || typeof data.imageDesktop !== 'string' || data.imageDesktop.trim().length === 0) {
                errors.push('Desktop image is required and must be a non-empty string URL');
            }
        }

        if (requireImages || data.imageMobile !== undefined) {
            if (!data.imageMobile || typeof data.imageMobile !== 'string' || data.imageMobile.trim().length === 0) {
                errors.push('Mobile image is required and must be a non-empty string URL');
            }
        }

        if (data.linkUrl !== undefined && data.linkUrl !== null) {
            if (typeof data.linkUrl !== 'string' || data.linkUrl.trim().length === 0) {
                errors.push('Link URL must be a non-empty string');
            } else if (data.linkUrl.length > 1024) {
                errors.push('Link URL must be 1024 characters or less');
            }
        }

        if (data.order !== undefined && data.order !== null) {
            const order = parseInt(data.order);
            if (isNaN(order) || order < 0) {
                errors.push('Order must be a valid non-negative integer');
            }
        }

        if (data.isActive !== undefined && data.isActive !== null) {
            if (typeof data.isActive !== 'boolean' && data.isActive !== 'true' && data.isActive !== 'false') {
                errors.push('isActive must be a boolean');
            }
        }

        if (data.startDate !== undefined && data.startDate !== null) {
            const startDate = new Date(data.startDate);
            if (isNaN(startDate.getTime())) {
                errors.push('startDate must be a valid date');
            }
        }

        if (data.endDate !== undefined && data.endDate !== null) {
            const endDate = new Date(data.endDate);
            if (isNaN(endDate.getTime())) {
                errors.push('endDate must be a valid date');
            }
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }

    async getAllBanners() {
        return await prisma.banner.findMany({
            orderBy: [
                { order: 'asc' },
                { createdAt: 'desc' }
            ]
        });
    }

    async getActiveBanners() {
        const now = new Date();
        return await prisma.banner.findMany({
            where: {
                isActive: true,
                AND: [
                    {
                        OR: [
                            { startDate: null },
                            { startDate: { lte: now } }
                        ]
                    },
                    {
                        OR: [
                            { endDate: null },
                            { endDate: { gte: now } }
                        ]
                    }
                ]
            },
            orderBy: [
                { order: 'asc' },
                { createdAt: 'desc' }
            ]
        });
    }

    async getBannerById(id) {
        const banner = await prisma.banner.findUnique({
            where: { id: parseInt(id) }
        });

        if (!banner) {
            const error = new Error('Banner not found');
            error.statusCode = 404;
            throw error;
        }

        return banner;
    }

    async createBanner(data) {
        const validation = this.validateBanner(data, { requireImages: true });
        if (!validation.isValid) {
            const error = new Error(validation.errors.join(', '));
            error.statusCode = 400;
            throw error;
        }

        const bannerData = {
            title: data.title ? data.title.trim() : null,
            description: data.description ? data.description.trim() : null,
            imageDesktop: data.imageDesktop.trim(),
            imageMobile: data.imageMobile.trim(),
            linkUrl: data.linkUrl ? data.linkUrl.trim() : null,
            order: data.order !== undefined && data.order !== null ? parseInt(data.order) : 0,
            isActive: data.isActive === true || data.isActive === 'true'
        };

        if (data.startDate !== undefined && data.startDate !== null) {
            bannerData.startDate = new Date(data.startDate);
        }
        if (data.endDate !== undefined && data.endDate !== null) {
            bannerData.endDate = new Date(data.endDate);
        }

        if (data.adminId !== undefined && data.adminId !== null) {
            bannerData.createdBy = parseInt(data.adminId);
            bannerData.updatedBy = parseInt(data.adminId);
        }

        return await prisma.banner.create({
            data: bannerData
        });
    }

    async updateBanner(id, data) {
        const validation = this.validateBanner(data, { requireImages: false });
        if (!validation.isValid) {
            const error = new Error(validation.errors.join(', '));
            error.statusCode = 400;
            throw error;
        }

        const existingBanner = await prisma.banner.findUnique({
            where: { id: parseInt(id) }
        });

        if (!existingBanner) {
            const error = new Error('Banner not found');
            error.statusCode = 404;
            throw error;
        }

        const updateData = {};
        if (data.title !== undefined) updateData.title = data.title ? data.title.trim() : null;
        if (data.description !== undefined) updateData.description = data.description ? data.description.trim() : null;
        if (data.imageDesktop !== undefined) updateData.imageDesktop = data.imageDesktop ? data.imageDesktop.trim() : null;
        if (data.imageMobile !== undefined) updateData.imageMobile = data.imageMobile ? data.imageMobile.trim() : null;
        if (data.linkUrl !== undefined) updateData.linkUrl = data.linkUrl ? data.linkUrl.trim() : null;
        if (data.order !== undefined && data.order !== null) updateData.order = parseInt(data.order);
        if (data.isActive !== undefined) updateData.isActive = data.isActive === true || data.isActive === 'true';
        if (data.startDate !== undefined) updateData.startDate = data.startDate ? new Date(data.startDate) : null;
        if (data.endDate !== undefined) updateData.endDate = data.endDate ? new Date(data.endDate) : null;

        if (data.adminId !== undefined && data.adminId !== null) {
            updateData.updatedBy = parseInt(data.adminId);
        }

        return await prisma.banner.update({
            where: { id: parseInt(id) },
            data: updateData
        });
    }

    async deleteBanner(id) {
        const banner = await prisma.banner.findUnique({
            where: { id: parseInt(id) }
        });

        if (!banner) {
            const error = new Error('Banner not found');
            error.statusCode = 404;
            throw error;
        }

        await prisma.banner.delete({
            where: { id: parseInt(id) }
        });

        return banner;
    }
}

module.exports = new BannerService();
