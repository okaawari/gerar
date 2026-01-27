const prisma = require('../lib/prisma');

class AnalyticsService {
    /**
     * Build date filter for Prisma queries
     * @param {string|Date|null} startDate - Start date (ISO string or Date)
     * @param {string|Date|null} endDate - End date (ISO string or Date)
     * @returns {Object} Prisma where clause for date filtering
     */
    buildDateFilter(startDate, endDate) {
        const filter = {};
        
        if (startDate) {
            const start = new Date(startDate);
            start.setHours(0, 0, 0, 0);
            filter.gte = start;
        }
        
        if (endDate) {
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            filter.lte = end;
        }
        
        return Object.keys(filter).length > 0 ? { createdAt: filter } : {};
    }

    /**
     * Calculate percentage growth between two values
     * @param {number} current - Current value
     * @param {number} previous - Previous value
     * @returns {Object} Growth percentage and absolute change
     */
    calculateGrowth(current, previous) {
        if (previous === 0) {
            return {
                percentage: current > 0 ? 100 : 0,
                absolute: current - previous,
                isPositive: current >= 0
            };
        }
        
        const percentage = ((current - previous) / previous) * 100;
        return {
            percentage: Math.round(percentage * 100) / 100,
            absolute: current - previous,
            isPositive: percentage >= 0
        };
    }

    /**
     * Format trend data for consistent response structure
     * @param {Array} data - Raw trend data
     * @param {string} period - Period type (daily, weekly, monthly, yearly)
     * @returns {Array} Formatted trend data
     */
    formatTrendData(data, period) {
        return data.map(item => ({
            date: item.date || item.period,
            revenue: parseFloat(item.revenue || 0),
            orderCount: item.orderCount || 0,
            averageOrderValue: item.orderCount > 0 
                ? parseFloat((item.revenue / item.orderCount).toFixed(2))
                : 0
        }));
    }

    /**
     * Get revenue overview with key metrics
     * @param {Object} filters - Filter options
     * @returns {Promise<Object>} Revenue overview data
     */
    async getRevenueOverview(filters = {}) {
        const { startDate, endDate, compareWithPrevious } = filters;
        
        const dateFilter = this.buildDateFilter(startDate, endDate);
        
        // Get total revenue for all time
        const allTimeStats = await prisma.order.aggregate({
            where: {
                paymentStatus: 'PAID'
            },
            _sum: {
                totalAmount: true
            },
            _count: {
                id: true
            }
        });

        // Get revenue for date range
        const rangeStats = await prisma.order.aggregate({
            where: {
                paymentStatus: 'PAID',
                ...dateFilter
            },
            _sum: {
                totalAmount: true
            },
            _count: {
                id: true
            },
            _avg: {
                totalAmount: true
            }
        });

        // Get revenue by order status
        const revenueByStatus = await prisma.order.groupBy({
            by: ['status'],
            where: dateFilter,
            _sum: {
                totalAmount: true
            },
            _count: {
                id: true
            }
        });

        // Get revenue by payment status
        const revenueByPaymentStatus = await prisma.order.groupBy({
            by: ['paymentStatus'],
            where: dateFilter,
            _sum: {
                totalAmount: true
            },
            _count: {
                id: true
            }
        });

        // Get order counts by status
        const orderCountsByStatus = await prisma.order.groupBy({
            by: ['status'],
            where: dateFilter,
            _count: {
                id: true
            }
        });

        const result = {
            allTime: {
                totalRevenue: parseFloat(allTimeStats._sum.totalAmount || 0),
                totalOrders: allTimeStats._count.id || 0
            },
            period: {
                totalRevenue: parseFloat(rangeStats._sum.totalAmount || 0),
                totalOrders: rangeStats._count.id || 0,
                averageOrderValue: rangeStats._avg.totalAmount 
                    ? parseFloat(rangeStats._avg.totalAmount.toFixed(2))
                    : 0
            },
            revenueByStatus: revenueByStatus.map(item => ({
                status: item.status,
                revenue: parseFloat(item._sum.totalAmount || 0),
                orderCount: item._count.id || 0
            })),
            revenueByPaymentStatus: revenueByPaymentStatus.map(item => ({
                paymentStatus: item.paymentStatus,
                revenue: parseFloat(item._sum.totalAmount || 0),
                orderCount: item._count.id || 0
            })),
            orderCountsByStatus: orderCountsByStatus.map(item => ({
                status: item.status,
                count: item._count.id || 0
            }))
        };

        // Compare with previous period if requested
        if (compareWithPrevious && startDate && endDate) {
            const start = new Date(startDate);
            const end = new Date(endDate);
            const daysDiff = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
            
            const previousStart = new Date(start);
            previousStart.setDate(previousStart.getDate() - daysDiff - 1);
            const previousEnd = new Date(start);
            previousEnd.setDate(previousEnd.getDate() - 1);
            
            const previousFilter = this.buildDateFilter(previousStart, previousEnd);
            const previousStats = await prisma.order.aggregate({
                where: {
                    paymentStatus: 'PAID',
                    ...previousFilter
                },
                _sum: {
                    totalAmount: true
                },
                _count: {
                    id: true
                }
            });

            const previousRevenue = parseFloat(previousStats._sum.totalAmount || 0);
            const currentRevenue = result.period.totalRevenue;
            
            result.comparison = {
                previousPeriod: {
                    startDate: previousStart.toISOString().split('T')[0],
                    endDate: previousEnd.toISOString().split('T')[0],
                    totalRevenue: previousRevenue,
                    totalOrders: previousStats._count.id || 0
                },
                growth: this.calculateGrowth(currentRevenue, previousRevenue)
            };
        }

        return result;
    }

    /**
     * Get revenue trends over time
     * @param {string} period - Period type: daily, weekly, monthly, yearly
     * @param {string|Date} startDate - Start date
     * @param {string|Date} endDate - End date
     * @param {string} groupBy - Optional additional grouping: status, paymentStatus
     * @returns {Promise<Array>} Trend data
     */
    async getRevenueTrends(period, startDate, endDate, groupBy = null) {
        if (!period || !startDate || !endDate) {
            const error = new Error('Period, startDate, and endDate are required');
            error.statusCode = 400;
            throw error;
        }

        const dateFilter = this.buildDateFilter(startDate, endDate);
        
        // For MySQL/MariaDB, we need to use raw queries for date grouping
        // Since Prisma doesn't support date truncation directly, we'll fetch all orders and group in memory
        // For better performance with large datasets, consider using raw SQL queries
        
        const orders = await prisma.order.findMany({
            where: {
                paymentStatus: 'PAID',
                ...dateFilter
            },
            select: {
                createdAt: true,
                totalAmount: true,
                status: true,
                paymentStatus: true
            },
            orderBy: {
                createdAt: 'asc'
            }
        });

        // Group by period
        const grouped = {};
        
        orders.forEach(order => {
            const date = new Date(order.createdAt);
            let key;
            
            switch (period) {
                case 'daily':
                    key = date.toISOString().split('T')[0]; // YYYY-MM-DD
                    break;
                case 'weekly':
                    const weekStart = new Date(date);
                    weekStart.setDate(date.getDate() - date.getDay()); // Start of week (Sunday)
                    key = `W${weekStart.getFullYear()}-${String(Math.floor((weekStart - new Date(weekStart.getFullYear(), 0, 1)) / 86400000 / 7) + 1).padStart(2, '0')}`;
                    break;
                case 'monthly':
                    key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                    break;
                case 'yearly':
                    key = String(date.getFullYear());
                    break;
                default:
                    const error = new Error('Invalid period. Must be: daily, weekly, monthly, yearly');
                    error.statusCode = 400;
                    throw error;
            }
            
            if (groupBy === 'status') {
                key = `${key}_${order.status}`;
            } else if (groupBy === 'paymentStatus') {
                key = `${key}_${order.paymentStatus}`;
            }
            
            if (!grouped[key]) {
                grouped[key] = {
                    date: period === 'daily' ? key : (period === 'weekly' ? key : (period === 'monthly' ? key : key)),
                    revenue: 0,
                    orderCount: 0,
                    ...(groupBy === 'status' && { status: order.status }),
                    ...(groupBy === 'paymentStatus' && { paymentStatus: order.paymentStatus })
                };
            }
            
            grouped[key].revenue += parseFloat(order.totalAmount);
            grouped[key].orderCount += 1;
        });

        const result = Object.values(grouped).sort((a, b) => {
            return a.date.localeCompare(b.date);
        });

        return this.formatTrendData(result, period);
    }

    /**
     * Get revenue breakdown by product
     * @param {Object} filters - Filter options
     * @returns {Promise<Object>} Product revenue data
     */
    async getRevenueByProduct(filters = {}) {
        const { startDate, endDate, limit = 10, sortBy = 'revenue', sortOrder = 'desc' } = filters;
        
        const dateFilter = this.buildDateFilter(startDate, endDate);
        const validLimit = Math.min(Math.max(parseInt(limit) || 10, 1), 100);
        
        // Get order items with date filter
        const orderItems = await prisma.orderitem.findMany({
            where: {
                order: {
                    paymentStatus: 'PAID',
                    ...dateFilter
                }
            },
            include: {
                product: {
                    select: {
                        id: true,
                        name: true,
                        price: true
                    }
                },
                order: {
                    select: {
                        createdAt: true
                    }
                }
            }
        });

        // Group by product
        const productMap = {};
        
        orderItems.forEach(item => {
            const productId = item.productId;
            if (!productMap[productId]) {
                productMap[productId] = {
                    productId: productId,
                    productName: item.product.name,
                    revenue: 0,
                    quantity: 0,
                    orderCount: 0
                };
            }
            
            const itemRevenue = parseFloat(item.price) * item.quantity;
            productMap[productId].revenue += itemRevenue;
            productMap[productId].quantity += item.quantity;
            productMap[productId].orderCount += 1;
        });

        // Convert to array and sort
        let products = Object.values(productMap);
        
        products.sort((a, b) => {
            let aVal, bVal;
            switch (sortBy) {
                case 'revenue':
                    aVal = a.revenue;
                    bVal = b.revenue;
                    break;
                case 'quantity':
                    aVal = a.quantity;
                    bVal = b.quantity;
                    break;
                case 'orders':
                    aVal = a.orderCount;
                    bVal = b.orderCount;
                    break;
                default:
                    aVal = a.revenue;
                    bVal = b.revenue;
            }
            
            return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
        });

        // Apply limit
        products = products.slice(0, validLimit);

        return {
            products: products.map(p => ({
                ...p,
                revenue: parseFloat(p.revenue.toFixed(2)),
                averageOrderValue: p.orderCount > 0 
                    ? parseFloat((p.revenue / p.orderCount).toFixed(2))
                    : 0
            })),
            total: products.length
        };
    }

    /**
     * Get revenue breakdown by category
     * @param {Object} filters - Filter options
     * @returns {Promise<Object>} Category revenue data
     */
    async getRevenueByCategory(filters = {}) {
        const { startDate, endDate, includeSubcategories = false } = filters;
        
        const dateFilter = this.buildDateFilter(startDate, endDate);
        
        // Get order items with categories
        const orderItems = await prisma.orderitem.findMany({
            where: {
                order: {
                    paymentStatus: 'PAID',
                    ...dateFilter
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
                                        parentId: true
                                    }
                                }
                            }
                        }
                    }
                }
            }
        });

        // Group by category
        const categoryMap = {};
        const categoryProductCount = {};
        
        orderItems.forEach(item => {
            const itemRevenue = parseFloat(item.price) * item.quantity;
            
            if (item.product.categories && item.product.categories.length > 0) {
                item.product.categories.forEach(pc => {
                    const category = pc.category;
                    const categoryId = category.id;
                    
                    if (!categoryMap[categoryId]) {
                        categoryMap[categoryId] = {
                            categoryId: categoryId,
                            categoryName: category.name,
                            parentId: category.parentId,
                            revenue: 0,
                            orderCount: 0,
                            productCount: new Set()
                        };
                    }
                    
                    categoryMap[categoryId].revenue += itemRevenue;
                    categoryMap[categoryId].orderCount += 1;
                    categoryMap[categoryId].productCount.add(item.productId);
                });
            }
        });

        // If includeSubcategories, aggregate child categories into parent
        if (includeSubcategories) {
            const parentMap = {};
            
            Object.values(categoryMap).forEach(cat => {
                if (cat.parentId) {
                    const parentId = cat.parentId;
                    if (!parentMap[parentId]) {
                        parentMap[parentId] = {
                            revenue: 0,
                            orderCount: 0,
                            productCount: new Set()
                        };
                    }
                    parentMap[parentId].revenue += cat.revenue;
                    parentMap[parentId].orderCount += cat.orderCount;
                    cat.productCount.forEach(pid => parentMap[parentId].productCount.add(pid));
                }
            });
            
            // Add aggregated data to parent categories
            Object.keys(parentMap).forEach(parentId => {
                if (categoryMap[parentId]) {
                    categoryMap[parentId].revenue += parentMap[parentId].revenue;
                    categoryMap[parentId].orderCount += parentMap[parentId].orderCount;
                    parentMap[parentId].productCount.forEach(pid => 
                        categoryMap[parentId].productCount.add(pid)
                    );
                }
            });
        }

        // Format results
        const categories = Object.values(categoryMap).map(cat => ({
            categoryId: cat.categoryId,
            categoryName: cat.categoryName,
            parentId: cat.parentId,
            revenue: parseFloat(cat.revenue.toFixed(2)),
            orderCount: cat.orderCount,
            productCount: cat.productCount.size,
            averageOrderValue: cat.orderCount > 0 
                ? parseFloat((cat.revenue / cat.orderCount).toFixed(2))
                : 0
        }));

        // Sort by revenue descending
        categories.sort((a, b) => b.revenue - a.revenue);

        return {
            categories,
            total: categories.length
        };
    }

    /**
     * Get revenue breakdown by customer
     * @param {Object} filters - Filter options
     * @returns {Promise<Object>} Customer revenue data
     */
    async getRevenueByCustomer(filters = {}) {
        const { startDate, endDate, limit = 10, sortBy = 'revenue', sortOrder = 'desc' } = filters;
        
        const dateFilter = this.buildDateFilter(startDate, endDate);
        const validLimit = Math.min(Math.max(parseInt(limit) || 10, 1), 100);
        
        // Get orders grouped by user
        const orders = await prisma.order.findMany({
            where: {
                paymentStatus: 'PAID',
                userId: { not: null },
                ...dateFilter
            },
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        phoneNumber: true,
                        email: true
                    }
                }
            }
        });

        // Group by user
        const userMap = {};
        
        orders.forEach(order => {
            const userId = order.userId;
            if (!userMap[userId]) {
                userMap[userId] = {
                    userId: userId,
                    userName: order.user.name,
                    phoneNumber: order.user.phoneNumber,
                    email: order.user.email,
                    totalRevenue: 0,
                    orderCount: 0
                };
            }
            
            userMap[userId].totalRevenue += parseFloat(order.totalAmount);
            userMap[userId].orderCount += 1;
        });

        // Convert to array and sort
        let customers = Object.values(userMap);
        
        customers.sort((a, b) => {
            let aVal, bVal;
            switch (sortBy) {
                case 'revenue':
                    aVal = a.totalRevenue;
                    bVal = b.totalRevenue;
                    break;
                case 'orders':
                    aVal = a.orderCount;
                    bVal = b.orderCount;
                    break;
                case 'avgOrderValue':
                    aVal = a.orderCount > 0 ? a.totalRevenue / a.orderCount : 0;
                    bVal = b.orderCount > 0 ? b.totalRevenue / b.orderCount : 0;
                    break;
                default:
                    aVal = a.totalRevenue;
                    bVal = b.totalRevenue;
            }
            
            return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
        });

        // Apply limit
        customers = customers.slice(0, validLimit);

        return {
            customers: customers.map(c => ({
                ...c,
                totalRevenue: parseFloat(c.totalRevenue.toFixed(2)),
                averageOrderValue: c.orderCount > 0 
                    ? parseFloat((c.totalRevenue / c.orderCount).toFixed(2))
                    : 0
            })),
            total: customers.length
        };
    }

    /**
     * Get revenue breakdown by payment method
     * @param {Object} filters - Filter options
     * @returns {Promise<Object>} Payment method revenue data
     */
    async getRevenueByPaymentMethod(filters = {}) {
        const { startDate, endDate } = filters;
        
        const dateFilter = this.buildDateFilter(startDate, endDate);
        
        // Get revenue grouped by payment method
        const revenueByMethod = await prisma.order.groupBy({
            by: ['paymentMethod'],
            where: {
                paymentStatus: 'PAID',
                ...dateFilter
            },
            _sum: {
                totalAmount: true
            },
            _count: {
                id: true
            }
        });

        // Calculate total revenue for percentage calculation
        const totalRevenue = revenueByMethod.reduce((sum, item) => 
            sum + parseFloat(item._sum.totalAmount || 0), 0
        );

        const methods = revenueByMethod.map(item => {
            const revenue = parseFloat(item._sum.totalAmount || 0);
            return {
                paymentMethod: item.paymentMethod || 'UNKNOWN',
                revenue: revenue,
                orderCount: item._count.id || 0,
                percentage: totalRevenue > 0 
                    ? parseFloat(((revenue / totalRevenue) * 100).toFixed(2))
                    : 0,
                averageOrderValue: item._count.id > 0 
                    ? parseFloat((revenue / item._count.id).toFixed(2))
                    : 0
            };
        });

        // Sort by revenue descending
        methods.sort((a, b) => b.revenue - a.revenue);

        return {
            paymentMethods: methods,
            total: methods.length,
            totalRevenue: totalRevenue
        };
    }

    /**
     * Get dashboard summary with key metrics
     * @returns {Promise<Object>} Dashboard summary data
     */
    async getDashboardSummary() {
        const now = new Date();
        
        // Today
        const todayStart = new Date(now);
        todayStart.setHours(0, 0, 0, 0);
        const todayEnd = new Date(now);
        todayEnd.setHours(23, 59, 59, 999);
        
        // This week (Sunday to Saturday)
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - now.getDay());
        weekStart.setHours(0, 0, 0, 0);
        
        // This month
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        monthStart.setHours(0, 0, 0, 0);
        
        // This year
        const yearStart = new Date(now.getFullYear(), 0, 1);
        yearStart.setHours(0, 0, 0, 0);
        
        // Last 7 days for trend
        const trendStart = new Date(now);
        trendStart.setDate(now.getDate() - 7);
        trendStart.setHours(0, 0, 0, 0);
        
        // Previous periods for comparison
        const yesterdayEnd = new Date(todayStart);
        yesterdayEnd.setDate(yesterdayEnd.getDate() - 1);
        const yesterdayStart = new Date(yesterdayEnd);
        yesterdayStart.setHours(0, 0, 0, 0);
        
        const lastWeekStart = new Date(weekStart);
        lastWeekStart.setDate(lastWeekStart.getDate() - 7);
        const lastWeekEnd = new Date(weekStart);
        lastWeekEnd.setDate(lastWeekEnd.getDate() - 1);
        lastWeekEnd.setHours(23, 59, 59, 999);
        
        const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        lastMonthStart.setHours(0, 0, 0, 0);
        const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
        lastMonthEnd.setHours(23, 59, 59, 999);
        
        const lastYearStart = new Date(now.getFullYear() - 1, 0, 1);
        lastYearStart.setHours(0, 0, 0, 0);
        const lastYearEnd = new Date(now.getFullYear() - 1, 11, 31);
        lastYearEnd.setHours(23, 59, 59, 999);

        // Fetch all metrics in parallel
        const [
            todayStats,
            weekStats,
            monthStats,
            yearStats,
            yesterdayStats,
            lastWeekStats,
            lastMonthStats,
            lastYearStats,
            topProducts,
            topCategories,
            trendData
        ] = await Promise.all([
            // Today
            prisma.order.aggregate({
                where: {
                    paymentStatus: 'PAID',
                    createdAt: { gte: todayStart, lte: todayEnd }
                },
                _sum: { totalAmount: true },
                _count: { id: true }
            }),
            // This week
            prisma.order.aggregate({
                where: {
                    paymentStatus: 'PAID',
                    createdAt: { gte: weekStart }
                },
                _sum: { totalAmount: true },
                _count: { id: true }
            }),
            // This month
            prisma.order.aggregate({
                where: {
                    paymentStatus: 'PAID',
                    createdAt: { gte: monthStart }
                },
                _sum: { totalAmount: true },
                _count: { id: true }
            }),
            // This year
            prisma.order.aggregate({
                where: {
                    paymentStatus: 'PAID',
                    createdAt: { gte: yearStart }
                },
                _sum: { totalAmount: true },
                _count: { id: true }
            }),
            // Yesterday
            prisma.order.aggregate({
                where: {
                    paymentStatus: 'PAID',
                    createdAt: { gte: yesterdayStart, lte: yesterdayEnd }
                },
                _sum: { totalAmount: true },
                _count: { id: true }
            }),
            // Last week
            prisma.order.aggregate({
                where: {
                    paymentStatus: 'PAID',
                    createdAt: { gte: lastWeekStart, lte: lastWeekEnd }
                },
                _sum: { totalAmount: true },
                _count: { id: true }
            }),
            // Last month
            prisma.order.aggregate({
                where: {
                    paymentStatus: 'PAID',
                    createdAt: { gte: lastMonthStart, lte: lastMonthEnd }
                },
                _sum: { totalAmount: true },
                _count: { id: true }
            }),
            // Last year
            prisma.order.aggregate({
                where: {
                    paymentStatus: 'PAID',
                    createdAt: { gte: lastYearStart, lte: lastYearEnd }
                },
                _sum: { totalAmount: true },
                _count: { id: true }
            }),
            // Top 5 products
            this.getRevenueByProduct({ limit: 5 }),
            // Top categories (will limit to 5 after fetch)
            this.getRevenueByCategory({}),
            // Last 7 days trend
            this.getRevenueTrends('daily', trendStart.toISOString().split('T')[0], now.toISOString().split('T')[0])
        ]);

        const todayRevenue = parseFloat(todayStats._sum.totalAmount || 0);
        const weekRevenue = parseFloat(weekStats._sum.totalAmount || 0);
        const monthRevenue = parseFloat(monthStats._sum.totalAmount || 0);
        const yearRevenue = parseFloat(yearStats._sum.totalAmount || 0);
        const yesterdayRevenue = parseFloat(yesterdayStats._sum.totalAmount || 0);
        const lastWeekRevenue = parseFloat(lastWeekStats._sum.totalAmount || 0);
        const lastMonthRevenue = parseFloat(lastMonthStats._sum.totalAmount || 0);
        const lastYearRevenue = parseFloat(lastYearStats._sum.totalAmount || 0);

        return {
            periods: {
                today: {
                    revenue: todayRevenue,
                    orders: todayStats._count.id || 0,
                    comparison: this.calculateGrowth(todayRevenue, yesterdayRevenue)
                },
                thisWeek: {
                    revenue: weekRevenue,
                    orders: weekStats._count.id || 0,
                    comparison: this.calculateGrowth(weekRevenue, lastWeekRevenue)
                },
                thisMonth: {
                    revenue: monthRevenue,
                    orders: monthStats._count.id || 0,
                    comparison: this.calculateGrowth(monthRevenue, lastMonthRevenue)
                },
                thisYear: {
                    revenue: yearRevenue,
                    orders: yearStats._count.id || 0,
                    comparison: this.calculateGrowth(yearRevenue, lastYearRevenue)
                }
            },
            topProducts: topProducts.products || [],
            topCategories: (topCategories.categories || []).slice(0, 5),
            trend: trendData
        };
    }
}

module.exports = new AnalyticsService();
