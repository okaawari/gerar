const featureService = require('../services/featureService');

class FeatureController {
    async getAllFeatures(req, res, next) {
        try {
            const includeProducts = req.query.includeProducts === 'true' || req.query.includeProducts === true;
            const includeHidden = req.user && (req.user.role === 'ADMIN' || req.user.role === 'SUPER_ADMIN');
            const includeDeleted = includeHidden;
            const features = await featureService.getAllFeatures({ includeProducts, includeHidden, includeDeleted });
            res.status(200).json({
                success: true,
                message: 'Features retrieved successfully',
                data: features
            });
        } catch (error) {
            next(error);
        }
    }

    async getFeatureById(req, res, next) {
        try {
            const { id } = req.params;
            const includeHidden = req.user && (req.user.role === 'ADMIN' || req.user.role === 'SUPER_ADMIN');
            const includeDeleted = includeHidden;
            const feature = await featureService.getFeatureById(id, { includeProducts: true, includeHidden, includeDeleted });
            res.status(200).json({
                success: true,
                message: 'Feature retrieved successfully',
                data: feature
            });
        } catch (error) {
            next(error);
        }
    }

    async createFeature(req, res, next) {
        try {
            const { name, description, order } = req.body;
            const adminId = req.user && req.user.id ? req.user.id : null;
            const feature = await featureService.createFeature({
                name,
                description,
                order,
                adminId
            });
            res.status(201).json({
                success: true,
                message: 'Feature created successfully',
                data: feature
            });
        } catch (error) {
            next(error);
        }
    }

    async updateFeature(req, res, next) {
        try {
            const { id } = req.params;
            const { name, description, order } = req.body;
            const adminId = req.user && req.user.id ? req.user.id : null;
            const feature = await featureService.updateFeature(id, {
                name,
                description,
                order,
                adminId
            });
            res.status(200).json({
                success: true,
                message: 'Feature updated successfully',
                data: feature
            });
        } catch (error) {
            next(error);
        }
    }

    async deleteFeature(req, res, next) {
        try {
            const { id } = req.params;
            const feature = await featureService.deleteFeature(id);
            res.status(200).json({
                success: true,
                message: 'Feature deleted successfully',
                data: feature
            });
        } catch (error) {
            next(error);
        }
    }
}

module.exports = new FeatureController();
