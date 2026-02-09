const bannerService = require('../services/bannerService');

class BannerController {
    async getAllBanners(req, res, next) {
        try {
            const banners = await bannerService.getAllBanners();
            res.status(200).json({
                success: true,
                message: 'Banners retrieved successfully',
                data: banners
            });
        } catch (error) {
            next(error);
        }
    }

    async getActiveBanners(req, res, next) {
        try {
            const banners = await bannerService.getActiveBanners();
            res.status(200).json({
                success: true,
                message: 'Active banners retrieved successfully',
                data: banners
            });
        } catch (error) {
            next(error);
        }
    }

    async getBannerById(req, res, next) {
        try {
            const { id } = req.params;
            const banner = await bannerService.getBannerById(id);
            res.status(200).json({
                success: true,
                message: 'Banner retrieved successfully',
                data: banner
            });
        } catch (error) {
            next(error);
        }
    }

    async createBanner(req, res, next) {
        try {
            const { title, description, imageDesktop, imageMobile, linkUrl, order, isActive, startDate, endDate } = req.body;
            const adminId = req.user && req.user.id ? req.user.id : null;
            const banner = await bannerService.createBanner({
                title,
                description,
                imageDesktop,
                imageMobile,
                linkUrl,
                order,
                isActive,
                startDate,
                endDate,
                adminId
            });
            res.status(201).json({
                success: true,
                message: 'Banner created successfully',
                data: banner
            });
        } catch (error) {
            next(error);
        }
    }

    async updateBanner(req, res, next) {
        try {
            const { id } = req.params;
            const { title, description, imageDesktop, imageMobile, linkUrl, order, isActive, startDate, endDate } = req.body;
            const adminId = req.user && req.user.id ? req.user.id : null;
            const banner = await bannerService.updateBanner(id, {
                title,
                description,
                imageDesktop,
                imageMobile,
                linkUrl,
                order,
                isActive,
                startDate,
                endDate,
                adminId
            });
            res.status(200).json({
                success: true,
                message: 'Banner updated successfully',
                data: banner
            });
        } catch (error) {
            next(error);
        }
    }

    async deleteBanner(req, res, next) {
        try {
            const { id } = req.params;
            const banner = await bannerService.deleteBanner(id);
            res.status(200).json({
                success: true,
                message: 'Banner deleted successfully',
                data: banner
            });
        } catch (error) {
            next(error);
        }
    }
}

module.exports = new BannerController();
