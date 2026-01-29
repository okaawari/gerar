const prisma = require('../lib/prisma');

class ProductService {
    /**
     * Normalize image URLs - replace localhost with network IP if API_BASE_URL is set
     * This ensures Next.js can access images when running on network IP
     * @param {string|null|undefined} url - Image URL to normalize
     * @returns {string|null} - Normalized URL or null
     */
    normalizeImageUrl(url) {
        if (!url || typeof url !== 'string') {
            return url || null;
        }

        // If API_BASE_URL is set and URL contains localhost, replace with network IP
        const apiBaseUrl = process.env.API_BASE_URL || process.env.BASE_URL;
        if (apiBaseUrl && url.includes('localhost:3000')) {
            // Extract the base URL without /api if present
            const baseUrl = apiBaseUrl.replace(/\/api$/, '');
            return url.replace(/http:\/\/localhost:3000/g, baseUrl);
        }

        // Also handle 127.0.0.1
        if (apiBaseUrl && url.includes('127.0.0.1:3000')) {
            const baseUrl = apiBaseUrl.replace(/\/api$/, '');
            return url.replace(/http:\/\/127\.0\.0\.1:3000/g, baseUrl);
        }

        return url;
    }

    /**
     * Validate product data
     * @param {Object} data - { name, description, price, originalPrice, images, stock, categoryId }
     * @returns {Object} - { isValid, errors }
     */
    validateProduct(data) {
        const errors = [];

        if (data.name !== undefined) {
            if (!data.name || typeof data.name !== 'string' || data.name.trim().length === 0) {
                errors.push('Product name is required and must be a non-empty string');
            }

            if (data.name && data.name.length > 191) {
                errors.push('Product name must be 191 characters or less');
            }
        }

        if (data.description !== undefined) {
            if (!data.description || typeof data.description !== 'string' || data.description.trim().length === 0) {
                errors.push('Product description is required and must be a non-empty string');
            }
        }

        if (data.price !== undefined) {
            const price = parseFloat(data.price);
            if (isNaN(price) || price < 0) {
                errors.push('Product price must be a valid non-negative number');
            }
        }

        if (data.originalPrice !== undefined && data.originalPrice !== null) {
            const originalPrice = parseFloat(data.originalPrice);
            if (isNaN(originalPrice) || originalPrice < 0) {
                errors.push('Original price must be a valid non-negative number');
            }
            // If originalPrice is provided, it should be greater than or equal to price
            if (data.price !== undefined) {
                const price = parseFloat(data.price);
                if (!isNaN(price) && !isNaN(originalPrice) && originalPrice < price) {
                    errors.push('Original price must be greater than or equal to the current price');
                }
            }
        }

        if (data.images !== undefined && data.images !== null) {
            if (!Array.isArray(data.images)) {
                errors.push('Images must be an array of image URLs');
            } else {
                // Validate each image URL
                data.images.forEach((image, index) => {
                    if (typeof image !== 'string' || image.trim().length === 0) {
                        errors.push(`Image at index ${index} must be a non-empty string URL`);
                    }
                });
            }
        }

        if (data.stock !== undefined) {
            const stock = parseInt(data.stock);
            if (isNaN(stock) || stock < 0) {
                errors.push('Product stock must be a valid non-negative integer');
            }
        }

        // Validate categoryIds (array) - at least one category is required
        if (data.categoryIds !== undefined && data.categoryIds !== null) {
            if (!Array.isArray(data.categoryIds)) {
                errors.push('Category IDs must be an array');
            } else if (data.categoryIds.length === 0) {
                errors.push('At least one category ID is required');
            } else {
                // Validate each category ID
                data.categoryIds.forEach((categoryId, index) => {
                    const id = parseInt(categoryId);
                    if (isNaN(id) || id <= 0) {
                        errors.push(`Category ID at index ${index} must be a valid positive integer`);
                    }
                });
            }
        } else if (data.categoryId !== undefined && data.categoryId !== null) {
            // Backward compatibility: allow single categoryId and convert to array
            const categoryId = parseInt(data.categoryId);
            if (isNaN(categoryId) || categoryId <= 0) {
                errors.push('Category ID must be a valid positive integer');
            }
        } else if (data.categoryIds === undefined) {
            // If neither categoryIds nor categoryId is provided during creation, it's an error
            // But we'll check this in the create/update methods
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }

    /**
     * Format product with discount information
     * @param {Object} product - Product object from database
     * @param {boolean} isFavorite - Optional favorite status
     * @returns {Object} - Formatted product with discount info
     */
    formatProductWithDiscount(product, isFavorite = false) {
        const formatted = { ...product };
        const price = parseFloat(product.price);
        const originalPrice = product.originalPrice ? parseFloat(product.originalPrice) : null;

        // Ensure images is an array (Prisma Json type should already be parsed)
        if (!formatted.images || !Array.isArray(formatted.images)) {
            formatted.images = [];
        }

        // Normalize image URLs to use network IP instead of localhost
        formatted.images = formatted.images.map(img => this.normalizeImageUrl(img)).filter(Boolean);

        // Add firstImage for easy access (useful for product listings)
        formatted.firstImage = formatted.images.length > 0 ? this.normalizeImageUrl(formatted.images[0]) : null;

        // Calculate discount information
        if (originalPrice && originalPrice > price) {
            formatted.hasDiscount = true;
            formatted.originalPrice = originalPrice.toString();
            formatted.discountAmount = (originalPrice - price).toFixed(2);
            formatted.discountPercentage = Math.round(((originalPrice - price) / originalPrice) * 100);
        } else {
            formatted.hasDiscount = false;
            formatted.originalPrice = null;
            formatted.discountAmount = null;
            formatted.discountPercentage = null;
        }

        // Add favorite status
        formatted.isFavorite = isFavorite;

        // Ensure price is a string for consistency
        formatted.price = price.toString();

        return formatted;
    }

    /**
     * Get all products with optional filters (Advanced Search)
     * @param {Object} filters - { 
     *   categoryId?, categoryIds[], search?, inStock?, 
     *   minPrice?, maxPrice?, minStock?, maxStock?,
     *   createdAfter?, createdBefore?,
     *   sortBy?, sortOrder?, page?, limit?,
     *   userId? (optional - to include favorite status)
     * }
     * @returns {Object} - { products, pagination: { total, page, limit, totalPages } }
     */
    async getAllProducts(filters = {}) {
        const userId = filters.userId;
        const includeHidden = filters.includeHidden === true || filters.includeHidden === 'true';
        const includeDeleted = filters.includeDeleted === true || filters.includeDeleted === 'true';
        const where = {};

        // Filter out deleted products (soft delete) - unless includeDeleted is true for admin
        if (!includeDeleted) {
            where.deletedAt = null;
        }

        // Filter out hidden products for public endpoints (unless includeHidden is true for admin)
        if (!includeHidden) {
            where.isHidden = false;
        }

        // Filter by single category or multiple categories
        if (filters.categoryIds && Array.isArray(filters.categoryIds)) {
            // Multiple categories - filter products that have ANY of these categories
            const categoryIds = filters.categoryIds
                .map(id => parseInt(id))
                .filter(id => !isNaN(id) && id > 0);
            if (categoryIds.length > 0) {
                where.categories = {
                    some: {
                        categoryId: {
                            in: categoryIds
                        }
                    }
                };
            }
        } else if (filters.categoryId) {
            // Single category (backward compatibility)
            where.categories = {
                some: {
                    categoryId: parseInt(filters.categoryId)
                }
            };
        }

        // Advanced search: search in name and/or description
        if (filters.search) {
            const searchTerm = filters.search.trim();
            if (searchTerm.length > 0) {
                where.OR = [
                    {
                        name: {
                            contains: searchTerm
                        }
                    },
                    {
                        description: {
                            contains: searchTerm
                        }
                    }
                ];
            }
        }

        // Price range filtering
        if (filters.minPrice !== undefined) {
            const minPrice = parseFloat(filters.minPrice);
            if (!isNaN(minPrice) && minPrice >= 0) {
                where.price = where.price || {};
                where.price.gte = minPrice;
            }
        }

        if (filters.maxPrice !== undefined) {
            const maxPrice = parseFloat(filters.maxPrice);
            if (!isNaN(maxPrice) && maxPrice >= 0) {
                where.price = where.price || {};
                where.price.lte = maxPrice;
            }
        }

        // Stock filtering - handle inStock and minStock/maxStock together
        // Priority: minStock/maxStock > inStock > no filter
        const hasStockRange = filters.minStock !== undefined || filters.maxStock !== undefined;
        
        if (hasStockRange) {
            // Stock range filtering takes precedence
            const stockFilter = {};
            
            if (filters.minStock !== undefined) {
                const minStock = parseInt(filters.minStock);
                if (!isNaN(minStock) && minStock >= 0) {
                    // If inStock is true and minStock is specified, ensure minStock is at least 1
                    const effectiveMinStock = (filters.inStock === 'true' || filters.inStock === true) 
                        ? Math.max(minStock, 1) 
                        : minStock;
                    stockFilter.gte = effectiveMinStock;
                }
            } else if (filters.inStock === 'true' || filters.inStock === true) {
                // No minStock but inStock=true, so stock must be > 0
                stockFilter.gt = 0;
            }
            
            if (filters.maxStock !== undefined) {
                const maxStock = parseInt(filters.maxStock);
                if (!isNaN(maxStock) && maxStock >= 0) {
                    stockFilter.lte = maxStock;
                }
            }
            
            if (Object.keys(stockFilter).length > 0) {
                where.stock = stockFilter;
            }
        } else if (filters.inStock !== undefined) {
            // Only inStock filter (no range)
            if (filters.inStock === 'true' || filters.inStock === true) {
                where.stock = { gt: 0 };
            } else if (filters.inStock === 'false' || filters.inStock === false) {
                where.stock = 0;
            }
        }

        // Date range filtering
        if (filters.createdAfter) {
            const createdAfter = new Date(filters.createdAfter);
            if (!isNaN(createdAfter.getTime())) {
                where.createdAt = where.createdAt || {};
                where.createdAt.gte = createdAfter;
            }
        }

        if (filters.createdBefore) {
            const createdBefore = new Date(filters.createdBefore);
            if (!isNaN(createdBefore.getTime())) {
                where.createdAt = where.createdAt || {};
                where.createdAt.lte = createdBefore;
            }
        }

        // Sorting options
        // If filtering by a single category without explicit sortBy, sort by category order
        // Otherwise, use the specified sortBy or default to createdAt
        let orderBy;
        let shouldSortByCategoryOrder = false;
        let singleCategoryId = null;
        
        if ((filters.categoryId || (filters.categoryIds && filters.categoryIds.length === 1)) && !filters.sortBy) {
            // Single category filter without explicit sortBy - we'll sort by category order in post-processing
            shouldSortByCategoryOrder = true;
            singleCategoryId = parseInt(filters.categoryId || filters.categoryIds[0]);
            // Still order by createdAt as fallback, then sort by order after
            orderBy = {
                createdAt: 'desc'
            };
        } else {
            const sortBy = filters.sortBy || 'createdAt';
            const validSortFields = ['name', 'price', 'stock', 'createdAt', 'updatedAt'];
            const sortField = validSortFields.includes(sortBy) ? sortBy : 'createdAt';
            
            const sortOrder = (filters.sortOrder === 'asc' || filters.sortOrder === 'ASC') ? 'asc' : 'desc';
            
            orderBy = {
                [sortField]: sortOrder
            };
        }

        // Pagination
        const page = parseInt(filters.page) || 1;
        const limit = parseInt(filters.limit) || 50;
        const skip = (page - 1) * limit;

        // Ensure page and limit are valid
        const validPage = page > 0 ? page : 1;
        const validLimit = limit > 0 && limit <= 100 ? limit : 50; // Max 100 items per page

        // Get total count for pagination
        const total = await prisma.product.count({ where });

        // Get products with pagination
        let products = await prisma.product.findMany({
            where,
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
                },
                creator: {
                    select: {
                        id: true,
                        name: true,
                        phoneNumber: true,
                        email: true
                    }
                },
                updater: {
                    select: {
                        id: true,
                        name: true,
                        phoneNumber: true,
                        email: true
                    }
                }
            },
            orderBy,
            skip: (validPage - 1) * validLimit,
            take: shouldSortByCategoryOrder ? undefined : validLimit // Fetch all if sorting by order, then paginate after
        });

        // If sorting by category order, sort products now and then paginate
        if (shouldSortByCategoryOrder && singleCategoryId) {
            products = products.sort((a, b) => {
                const aCategory = a.categories.find(pc => pc.categoryId === singleCategoryId);
                const bCategory = b.categories.find(pc => pc.categoryId === singleCategoryId);
                
                const aOrder = aCategory ? (aCategory.order || 0) : 999999;
                const bOrder = bCategory ? (bCategory.order || 0) : 999999;
                
                if (aOrder !== bOrder) {
                    return aOrder - bOrder; // Lower order number = appears first
                }
                // If order is same, sort by createdAt (newer first)
                return new Date(b.createdAt) - new Date(a.createdAt);
            });
            
            // Apply pagination after sorting
            products = products.slice((validPage - 1) * validLimit, validPage * validLimit);
        }

        const totalPages = Math.ceil(total / validLimit);

        // Get favorite statuses if userId is provided
        let favoriteStatuses = {};
        if (userId) {
            const favoriteService = require('./favoriteService');
            const productIds = products.map(p => p.id);
            favoriteStatuses = await favoriteService.getFavoriteStatuses(userId, productIds);
        }

        // Format products with discount information and favorite status
        const formattedProducts = products.map(product => {
            const isFavorite = favoriteStatuses[product.id] || false;
            const formatted = this.formatProductWithDiscount(product, isFavorite);
            // Extract categories from ProductCategory junction table
            formatted.categories = product.categories
                ? product.categories.map(pc => pc.category)
                : [];
            // Include categoryOrders mapping (categoryId -> order)
            formatted.categoryOrders = {};
            if (product.categories) {
                product.categories.forEach(pc => {
                    formatted.categoryOrders[pc.categoryId] = pc.order;
                });
            }
            // For backward compatibility, keep categoryId as first category if exists
            formatted.categoryId = formatted.categories.length > 0 ? formatted.categories[0].id : null;
            formatted.category = formatted.categories.length > 0 ? formatted.categories[0] : null;
            return formatted;
        });

        return {
            products: formattedProducts,
            pagination: {
                total,
                page: validPage,
                limit: validLimit,
                totalPages
            }
        };
    }

    /**
     * Get product by ID
     * @param {number} id - Product ID
     * @param {number} userId - Optional user ID to include favorite status
     * @param {boolean} includeHidden - If true, allows fetching hidden products (admin only)
     * @param {boolean} includeDeleted - If true, allows fetching deleted products (admin only)
     * @returns {Object} - Product with category
     */
    async getProductById(id, userId = null, includeHidden = false, includeDeleted = false) {
        const where = { id: parseInt(id) };
        
        // Filter out deleted products unless includeDeleted is true
        if (!includeDeleted) {
            where.deletedAt = null;
        }
        
        const product = await prisma.product.findUnique({
            where,
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
                },
                creator: {
                    select: {
                        id: true,
                        name: true,
                        phoneNumber: true,
                        email: true
                    }
                },
                updater: {
                    select: {
                        id: true,
                        name: true,
                        phoneNumber: true,
                        email: true
                    }
                }
            }
        });

        if (!product) {
            const error = new Error('Product not found');
            error.statusCode = 404;
            throw error;
        }

        // Check if product is deleted (for public access)
        if (!includeDeleted && product.deletedAt) {
            const error = new Error('Product not found');
            error.statusCode = 404;
            throw error;
        }

        // Check if product is hidden (for public access)
        if (!includeHidden && product.isHidden) {
            const error = new Error('Product not found');
            error.statusCode = 404;
            throw error;
        }

        // Get favorite status if userId is provided
        let isFavorite = false;
        if (userId) {
            const favoriteService = require('./favoriteService');
            isFavorite = await favoriteService.isFavorited(userId, id);
        }

        // Format product with discount information and favorite status
        const formatted = this.formatProductWithDiscount(product, isFavorite);
        // Extract categories from ProductCategory junction table
        formatted.categories = product.categories
            ? product.categories.map(pc => pc.category)
            : [];
        // Include categoryOrders mapping (categoryId -> order)
        formatted.categoryOrders = {};
        if (product.categories) {
            product.categories.forEach(pc => {
                formatted.categoryOrders[pc.categoryId] = pc.order;
            });
        }
        // For backward compatibility, keep categoryId as first category if exists
        formatted.categoryId = formatted.categories.length > 0 ? formatted.categories[0].id : null;
        formatted.category = formatted.categories.length > 0 ? formatted.categories[0] : null;
        return formatted;
    }

    /**
     * Create a new product
     * @param {Object} data - { name, description, price, stock, categoryIds[] or categoryId }
     * @returns {Object} - Created product
     */
    async createProduct(data) {
        // Validate input
        const validation = this.validateProduct(data);
        if (!validation.isValid) {
            const error = new Error(validation.errors.join(', '));
            error.statusCode = 400;
            throw error;
        }

        // Get category IDs - support both categoryIds array and single categoryId (backward compatibility)
        let categoryIds = [];
        if (data.categoryIds && Array.isArray(data.categoryIds)) {
            categoryIds = data.categoryIds.map(id => parseInt(id)).filter(id => !isNaN(id) && id > 0);
        } else if (data.categoryId) {
            // Backward compatibility: convert single categoryId to array
            categoryIds = [parseInt(data.categoryId)];
        }

        if (categoryIds.length === 0) {
            const error = new Error('At least one category ID is required');
            error.statusCode = 400;
            throw error;
        }

        // Verify all categories exist
        const categories = await prisma.category.findMany({
            where: {
                id: {
                    in: categoryIds
                }
            }
        });

        if (categories.length !== categoryIds.length) {
            const error = new Error('One or more categories not found');
            error.statusCode = 404;
            throw error;
        }

        // Handle category orders - accept array [{categoryId, order}] or object {categoryId: order}
        const categoryOrders = data.categoryOrders || {};
        const getOrderForCategory = (categoryId) => {
            if (Array.isArray(categoryOrders)) {
                const entry = categoryOrders.find(co => parseInt(co.categoryId) === parseInt(categoryId));
                return entry ? parseInt(entry.order) || 0 : 0;
            } else if (typeof categoryOrders === 'object' && categoryOrders !== null) {
                return parseInt(categoryOrders[categoryId]) || 0;
            }
            return 0;
        };

        // Prepare product data (without categories - will create junction records separately)
        const productData = {
            name: data.name.trim(),
            description: data.description.trim(),
            price: parseFloat(data.price),
            stock: parseInt(data.stock)
        };

        // Add originalPrice if provided
        if (data.originalPrice !== undefined && data.originalPrice !== null) {
            productData.originalPrice = parseFloat(data.originalPrice);
        }

        // Add images if provided (store as JSON)
        if (data.images !== undefined && data.images !== null) {
            if (Array.isArray(data.images) && data.images.length > 0) {
                productData.images = data.images;
            }
        }

        // Add admin tracking if provided
        if (data.adminId !== undefined && data.adminId !== null) {
            productData.createdBy = parseInt(data.adminId);
            productData.updatedBy = parseInt(data.adminId);
        }

        // Create product first (without categories)
        const product = await prisma.product.create({
            data: productData
        });

        // Create ProductCategory junction records with order field
        await prisma.productcategory.createMany({
            data: categoryIds.map(categoryId => ({
                productId: product.id,
                categoryId: categoryId,
                order: getOrderForCategory(categoryId)
            }))
        });

        // Fetch product with categories
        const productWithCategories = await prisma.product.findUnique({
            where: { id: product.id },
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
                },
                creator: {
                    select: {
                        id: true,
                        name: true,
                        phoneNumber: true,
                        email: true
                    }
                },
                updater: {
                    select: {
                        id: true,
                        name: true,
                        phoneNumber: true,
                        email: true
                    }
                }
            }
        });

        // Format product with discount information
        const formatted = this.formatProductWithDiscount(product);
        // Extract categories from ProductCategory junction table
        formatted.categories = product.categories
            ? product.categories.map(pc => pc.category)
            : [];
        // Include categoryOrders mapping (categoryId -> order)
        formatted.categoryOrders = {};
        if (product.categories) {
            product.categories.forEach(pc => {
                formatted.categoryOrders[pc.categoryId] = pc.order;
            });
        }
        formatted.categoryId = formatted.categories.length > 0 ? formatted.categories[0].id : null;
        formatted.category = formatted.categories.length > 0 ? formatted.categories[0] : null;
        return formatted;
    }

    /**
     * Update a product
     * @param {number} id - Product ID
     * @param {Object} data - { name?, description?, price?, stock?, categoryId? }
     * @returns {Object} - Updated product
     */
    async updateProduct(id, data) {
        // Validate input (only validate fields that are provided)
        const validation = this.validateProduct(data);
        if (!validation.isValid) {
            const error = new Error(validation.errors.join(', '));
            error.statusCode = 400;
            throw error;
        }

        // Check if product exists and is not deleted
        const existingProduct = await prisma.product.findUnique({
            where: { id: parseInt(id) }
        });

        if (!existingProduct) {
            const error = new Error('Product not found');
            error.statusCode = 404;
            throw error;
        }

        // Prevent updating deleted products
        if (existingProduct.deletedAt) {
            const error = new Error('Cannot update deleted product. Please restore it first.');
            error.statusCode = 409;
            throw error;
        }

        // Handle category updates
        let categoryIds = null;
        if (data.categoryIds !== undefined && data.categoryIds !== null) {
            if (Array.isArray(data.categoryIds)) {
                categoryIds = data.categoryIds.map(id => parseInt(id)).filter(id => !isNaN(id) && id > 0);
            } else {
                const error = new Error('Category IDs must be an array');
                error.statusCode = 400;
                throw error;
            }
        } else if (data.categoryId !== undefined && data.categoryId !== null) {
            // Backward compatibility: convert single categoryId to array
            categoryIds = [parseInt(data.categoryId)];
        }

        // Verify all categories exist if updating
        if (categoryIds !== null) {
            if (categoryIds.length === 0) {
                const error = new Error('At least one category ID is required');
                error.statusCode = 400;
                throw error;
            }

            const categories = await prisma.category.findMany({
                where: {
                    id: {
                        in: categoryIds
                    }
                }
            });

            if (categories.length !== categoryIds.length) {
                const error = new Error('One or more categories not found');
                error.statusCode = 404;
                throw error;
            }
        }

        // Build update data
        const updateData = {};
        if (data.name !== undefined) {
            updateData.name = data.name.trim();
        }
        if (data.description !== undefined) {
            updateData.description = data.description.trim();
        }
        if (data.price !== undefined) {
            updateData.price = parseFloat(data.price);
        }
        if (data.originalPrice !== undefined) {
            // Allow null to remove discount
            if (data.originalPrice === null || data.originalPrice === '') {
                updateData.originalPrice = null;
            } else {
                updateData.originalPrice = parseFloat(data.originalPrice);
            }
        }
        if (data.images !== undefined) {
            // Allow null to clear images, or set array of images
            if (data.images === null || data.images === '') {
                updateData.images = null;
            } else if (Array.isArray(data.images)) {
                updateData.images = data.images.length > 0 ? data.images : null;
            }
        }
        if (data.stock !== undefined) {
            updateData.stock = parseInt(data.stock);
        }
        if (data.isHidden !== undefined) {
            // Allow boolean or string 'true'/'false'
            updateData.isHidden = data.isHidden === true || data.isHidden === 'true';
        }

        // Add admin tracking if provided
        if (data.adminId !== undefined && data.adminId !== null) {
            updateData.updatedBy = parseInt(data.adminId);
        }

        // Handle category updates - delete existing and create new
        // Note: We handle this separately because Prisma doesn't support setting junction table fields in nested create
        let categoryUpdateNeeded = false;
        let categoryOrdersData = {};
        let categoryIdsForUpdate = [];
        let categoryOrdersOnly = false;

        // Handle category orders - accept array [{categoryId, order}] or object {categoryId: order}
        const categoryOrders = data.categoryOrders;
        const getOrderForCategory = (categoryId) => {
            if (!categoryOrders) return null;
            if (Array.isArray(categoryOrders)) {
                const entry = categoryOrders.find(co => parseInt(co.categoryId) === parseInt(categoryId));
                return entry ? parseInt(entry.order) : null;
            } else if (typeof categoryOrders === 'object' && categoryOrders !== null) {
                // Try both string and number keys
                const value = categoryOrders[categoryId] !== undefined 
                    ? categoryOrders[categoryId] 
                    : categoryOrders[String(categoryId)];
                return value !== undefined ? parseInt(value) : null;
            }
            return null;
        };

        if (categoryIds !== null) {
            // Updating categories (and possibly their orders)
            categoryUpdateNeeded = true;
            categoryIdsForUpdate = categoryIds;
            
            // Store order data for later use
            categoryOrdersData = categoryIdsForUpdate.reduce((acc, categoryId) => {
                const order = getOrderForCategory(categoryId);
                acc[categoryId] = order !== null ? order : 0;
                return acc;
            }, {});
        } else if (categoryOrders !== undefined && categoryOrders !== null) {
            // Only updating category orders without changing categories
            categoryOrdersOnly = true;
            
            // Get existing product categories
            const existingCategories = await prisma.productcategory.findMany({
                where: { productId: parseInt(id) },
                select: { categoryId: true }
            });
            
            if (existingCategories.length === 0) {
                const error = new Error('Product has no categories. Please provide categoryIds when setting categoryOrders.');
                error.statusCode = 400;
                throw error;
            }
            
            // Prepare order updates for existing categories
            const orderUpdates = [];
            for (const pc of existingCategories) {
                const order = getOrderForCategory(pc.categoryId);
                if (order !== null) {
                    orderUpdates.push({
                        productId: parseInt(id),
                        categoryId: pc.categoryId,
                        order: order
                    });
                }
            }
            
            if (orderUpdates.length === 0) {
                // No valid orders provided, skip update
                categoryOrdersOnly = false;
            }
            
            // Store for batch update
            categoryOrdersData = { orderUpdates };
        }

        // Update product (without categories)
        const product = await prisma.product.update({
            where: { id: parseInt(id) },
            data: updateData
        });

        // Handle category updates separately using ProductCategory table directly
        if (categoryUpdateNeeded) {
            // Delete all existing category associations
            await prisma.productcategory.deleteMany({
                where: { productId: parseInt(id) }
            });

            // Create new category associations with order field
            await prisma.productcategory.createMany({
                data: categoryIdsForUpdate.map(categoryId => ({
                    productId: parseInt(id),
                    categoryId: categoryId,
                    order: categoryOrdersData[categoryId] || 0
                }))
            });
        } else if (categoryOrdersOnly && categoryOrdersData.orderUpdates) {
            // Update only the order field for existing categories
            await Promise.all(
                categoryOrdersData.orderUpdates.map(({ productId, categoryId, order }) =>
                    prisma.productcategory.update({
                        where: {
                            productId_categoryId: {
                                productId: productId,
                                categoryId: categoryId
                            }
                        },
                        data: { order: order }
                    })
                )
            );
        }

        // Fetch product with categories
        const productWithCategories = await prisma.product.findUnique({
            where: { id: parseInt(id) },
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
                },
                creator: {
                    select: {
                        id: true,
                        name: true,
                        phoneNumber: true,
                        email: true
                    }
                },
                updater: {
                    select: {
                        id: true,
                        name: true,
                        phoneNumber: true,
                        email: true
                    }
                }
            }
        });

        // Format product with discount information
        const formatted = this.formatProductWithDiscount(productWithCategories);
        // Extract categories from ProductCategory junction table
        formatted.categories = productWithCategories.categories
            ? productWithCategories.categories.map(pc => pc.category)
            : [];
        formatted.categoryId = formatted.categories.length > 0 ? formatted.categories[0].id : null;
        formatted.category = formatted.categories.length > 0 ? formatted.categories[0] : null;
        return formatted;
    }

    /**
     * Delete a product (soft delete - sets deletedAt timestamp)
     * Products are soft deleted to preserve order history. The product remains in the database
     * but is filtered out from normal queries. Order history is fully preserved.
     * @param {number} id - Product ID
     * @returns {Object} - Soft deleted product
     */
    async deleteProduct(id) {
        // Check if product exists and is not already deleted
        const product = await prisma.product.findUnique({
            where: { id: parseInt(id) },
            include: {
                cartItems: {
                    select: {
                        id: true
                    }
                },
                orderItems: {
                    select: {
                        id: true,
                        orderId: true
                    }
                }
            }
        });

        if (!product) {
            const error = new Error('Product not found');
            error.statusCode = 404;
            throw error;
        }

        // Check if already deleted
        if (product.deletedAt) {
            const error = new Error('Product is already deleted');
            error.statusCode = 409;
            throw error;
        }

        // Delete cart items first (they're temporary and can be safely removed)
        // This prevents users from ordering deleted products
        if (product.cartItems && product.cartItems.length > 0) {
            await prisma.cartitem.deleteMany({
                where: { productId: parseInt(id) }
            });
        }

        // Soft delete: Set deletedAt timestamp instead of actually deleting
        // This preserves order history while hiding the product from normal queries
        const deletedProduct = await prisma.product.update({
            where: { id: parseInt(id) },
            data: {
                deletedAt: new Date()
            }
        });

        return deletedProduct;
    }

    /**
     * Restore a soft-deleted product
     * @param {number} id - Product ID
     * @param {number} adminId - Admin user ID for tracking
     * @returns {Object} - Restored product
     */
    async restoreProduct(id, adminId = null) {
        // Check if product exists
        const product = await prisma.product.findUnique({
            where: { id: parseInt(id) }
        });

        if (!product) {
            const error = new Error('Product not found');
            error.statusCode = 404;
            throw error;
        }

        // Check if product is actually deleted
        if (!product.deletedAt) {
            const error = new Error('Product is not deleted');
            error.statusCode = 409;
            throw error;
        }

        // Restore product by setting deletedAt to null
        const updateData = {
            deletedAt: null
        };

        if (adminId) {
            updateData.updatedBy = parseInt(adminId);
        }

        const restoredProduct = await prisma.product.update({
            where: { id: parseInt(id) },
            data: updateData,
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
        });

        // Format product with discount information
        const formatted = this.formatProductWithDiscount(restoredProduct, false);
        formatted.categories = restoredProduct.categories
            ? restoredProduct.categories.map(pc => pc.category)
            : [];
        formatted.categoryId = formatted.categories.length > 0 ? formatted.categories[0].id : null;
        formatted.category = formatted.categories.length > 0 ? formatted.categories[0] : null;

        return formatted;
    }

    /**
     * Hide a product (set isHidden to true)
     * @param {number} id - Product ID
     * @param {number} adminId - Admin user ID for tracking
     * @returns {Object} - Updated product
     */
    async hideProduct(id, adminId = null) {
        const product = await prisma.product.findUnique({
            where: { id: parseInt(id) }
        });

        if (!product) {
            const error = new Error('Product not found');
            error.statusCode = 404;
            throw error;
        }

        // Cannot hide deleted products
        if (product.deletedAt) {
            const error = new Error('Cannot hide deleted product. Please restore it first.');
            error.statusCode = 409;
            throw error;
        }

        const updateData = {
            isHidden: true
        };

        if (adminId) {
            updateData.updatedBy = parseInt(adminId);
        }

        const updatedProduct = await prisma.product.update({
            where: { id: parseInt(id) },
            data: updateData,
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
        });

        // Format product with discount information
        const formatted = this.formatProductWithDiscount(updatedProduct, false);
        formatted.categories = updatedProduct.categories
            ? updatedProduct.categories.map(pc => pc.category)
            : [];
        formatted.categoryId = formatted.categories.length > 0 ? formatted.categories[0].id : null;
        formatted.category = formatted.categories.length > 0 ? formatted.categories[0] : null;

        return formatted;
    }

    /**
     * Unhide a product (set isHidden to false)
     * @param {number} id - Product ID
     * @param {number} adminId - Admin user ID for tracking
     * @returns {Object} - Updated product
     */
    async unhideProduct(id, adminId = null) {
        const product = await prisma.product.findUnique({
            where: { id: parseInt(id) }
        });

        if (!product) {
            const error = new Error('Product not found');
            error.statusCode = 404;
            throw error;
        }

        // Cannot unhide deleted products
        if (product.deletedAt) {
            const error = new Error('Cannot unhide deleted product. Please restore it first.');
            error.statusCode = 409;
            throw error;
        }

        const updateData = {
            isHidden: false
        };

        if (adminId) {
            updateData.updatedBy = parseInt(adminId);
        }

        const updatedProduct = await prisma.product.update({
            where: { id: parseInt(id) },
            data: updateData,
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
        });

        // Format product with discount information
        const formatted = this.formatProductWithDiscount(updatedProduct, false);
        formatted.categories = updatedProduct.categories
            ? updatedProduct.categories.map(pc => pc.category)
            : [];
        formatted.categoryId = formatted.categories.length > 0 ? formatted.categories[0].id : null;
        formatted.category = formatted.categories.length > 0 ? formatted.categories[0] : null;

        return formatted;
    }

    /**
     * Check if product has sufficient stock
     * @param {number} productId - Product ID
     * @param {number} quantity - Required quantity
     * @returns {Object} - { hasStock, product }
     */
    async checkStockAvailability(productId, quantity) {
        const product = await prisma.product.findUnique({
            where: { 
                id: parseInt(productId),
                deletedAt: null // Only check stock for non-deleted products
            }
        });

        if (!product) {
            const error = new Error('Product not found');
            error.statusCode = 404;
            throw error;
        }

        return {
            hasStock: product.stock >= quantity,
            product
        };
    }

    /**
     * Reduce product stock by quantity
     * @param {number} productId - Product ID
     * @param {number} quantity - Quantity to reduce
     * @returns {Object} - Updated product
     */
    async reduceStock(productId, quantity) {
        const product = await prisma.product.findUnique({
            where: { 
                id: parseInt(productId),
                deletedAt: null // Only reduce stock for non-deleted products
            }
        });

        if (!product) {
            const error = new Error('Product not found');
            error.statusCode = 404;
            throw error;
        }

        const qty = parseInt(quantity);
        const newStock = product.stock - qty;

        if (newStock < 0) {
            const error = new Error(`Insufficient stock. Available: ${product.stock}, Requested: ${qty}`);
            error.statusCode = 400;
            throw error;
        }

        return await prisma.product.update({
            where: { id: parseInt(productId) },
            data: {
                stock: newStock
            }
        });
    }
}

module.exports = new ProductService();

