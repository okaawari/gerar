const analyticsService = require('../services/analyticsService');

class AnalyticsController {
    /**
     * Get revenue overview
     * GET /api/admin/analytics/revenue/overview
     */
    async getRevenueOverview(req, res, next) {
        try {
            const { startDate, endDate, compareWithPrevious } = req.query;
            
            const filters = {
                startDate: startDate || null,
                endDate: endDate || null,
                compareWithPrevious: compareWithPrevious === 'true' || compareWithPrevious === true
            };
            
            const data = await analyticsService.getRevenueOverview(filters);
            
            res.status(200).json({
                success: true,
                message: 'Revenue overview retrieved successfully',
                data: data,
                meta: {
                    startDate: startDate || null,
                    endDate: endDate || null,
                    compareWithPrevious: filters.compareWithPrevious
                }
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * Get revenue trends
     * GET /api/admin/analytics/revenue/trends
     */
    async getRevenueTrends(req, res, next) {
        try {
            const { period, startDate, endDate, groupBy } = req.query;
            
            if (!period || !startDate || !endDate) {
                const error = new Error('Period, startDate, and endDate are required');
                error.statusCode = 400;
                throw error;
            }
            
            if (!['daily', 'weekly', 'monthly', 'yearly'].includes(period)) {
                const error = new Error('Invalid period. Must be: daily, weekly, monthly, yearly');
                error.statusCode = 400;
                throw error;
            }
            
            const data = await analyticsService.getRevenueTrends(period, startDate, endDate, groupBy || null);
            
            res.status(200).json({
                success: true,
                message: 'Revenue trends retrieved successfully',
                data: data,
                meta: {
                    period: period,
                    startDate: startDate,
                    endDate: endDate,
                    groupBy: groupBy || null
                }
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * Get revenue by product
     * GET /api/admin/analytics/revenue/products
     */
    async getRevenueByProduct(req, res, next) {
        try {
            const { startDate, endDate, limit, sortBy, sortOrder } = req.query;
            
            const filters = {
                startDate: startDate || null,
                endDate: endDate || null,
                limit: limit || 10,
                sortBy: sortBy || 'revenue',
                sortOrder: sortOrder || 'desc'
            };
            
            // Validate sortBy
            if (filters.sortBy && !['revenue', 'quantity', 'orders'].includes(filters.sortBy)) {
                const error = new Error('Invalid sortBy. Must be: revenue, quantity, orders');
                error.statusCode = 400;
                throw error;
            }
            
            // Validate sortOrder
            if (filters.sortOrder && !['asc', 'desc'].includes(filters.sortOrder)) {
                const error = new Error('Invalid sortOrder. Must be: asc, desc');
                error.statusCode = 400;
                throw error;
            }
            
            const data = await analyticsService.getRevenueByProduct(filters);
            
            res.status(200).json({
                success: true,
                message: 'Revenue by product retrieved successfully',
                data: data,
                meta: {
                    startDate: startDate || null,
                    endDate: endDate || null,
                    limit: parseInt(filters.limit),
                    sortBy: filters.sortBy,
                    sortOrder: filters.sortOrder
                }
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * Get revenue by category
     * GET /api/admin/analytics/revenue/categories
     */
    async getRevenueByCategory(req, res, next) {
        try {
            const { startDate, endDate, includeSubcategories } = req.query;
            
            const filters = {
                startDate: startDate || null,
                endDate: endDate || null,
                includeSubcategories: includeSubcategories === 'true' || includeSubcategories === true
            };
            
            const data = await analyticsService.getRevenueByCategory(filters);
            
            res.status(200).json({
                success: true,
                message: 'Revenue by category retrieved successfully',
                data: data,
                meta: {
                    startDate: startDate || null,
                    endDate: endDate || null,
                    includeSubcategories: filters.includeSubcategories
                }
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * Get revenue by customer
     * GET /api/admin/analytics/revenue/customers
     */
    async getRevenueByCustomer(req, res, next) {
        try {
            const { startDate, endDate, limit, sortBy, sortOrder } = req.query;
            
            const filters = {
                startDate: startDate || null,
                endDate: endDate || null,
                limit: limit || 10,
                sortBy: sortBy || 'revenue',
                sortOrder: sortOrder || 'desc'
            };
            
            // Validate sortBy
            if (filters.sortBy && !['revenue', 'orders', 'avgOrderValue'].includes(filters.sortBy)) {
                const error = new Error('Invalid sortBy. Must be: revenue, orders, avgOrderValue');
                error.statusCode = 400;
                throw error;
            }
            
            // Validate sortOrder
            if (filters.sortOrder && !['asc', 'desc'].includes(filters.sortOrder)) {
                const error = new Error('Invalid sortOrder. Must be: asc, desc');
                error.statusCode = 400;
                throw error;
            }
            
            const data = await analyticsService.getRevenueByCustomer(filters);
            
            res.status(200).json({
                success: true,
                message: 'Revenue by customer retrieved successfully',
                data: data,
                meta: {
                    startDate: startDate || null,
                    endDate: endDate || null,
                    limit: parseInt(filters.limit),
                    sortBy: filters.sortBy,
                    sortOrder: filters.sortOrder
                }
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * Get revenue by payment method
     * GET /api/admin/analytics/revenue/payment-methods
     */
    async getRevenueByPaymentMethod(req, res, next) {
        try {
            const { startDate, endDate } = req.query;
            
            const filters = {
                startDate: startDate || null,
                endDate: endDate || null
            };
            
            const data = await analyticsService.getRevenueByPaymentMethod(filters);
            
            res.status(200).json({
                success: true,
                message: 'Revenue by payment method retrieved successfully',
                data: data,
                meta: {
                    startDate: startDate || null,
                    endDate: endDate || null
                }
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * Get dashboard summary
     * GET /api/admin/analytics/revenue/dashboard
     */
    async getDashboardSummary(req, res, next) {
        try {
            const data = await analyticsService.getDashboardSummary();
            
            res.status(200).json({
                success: true,
                message: 'Dashboard summary retrieved successfully',
                data: data
            });
        } catch (error) {
            next(error);
        }
    }
}

module.exports = new AnalyticsController();
