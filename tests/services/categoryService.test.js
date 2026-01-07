const fc = require('fast-check');

// Mock Prisma before importing anything that uses it
jest.mock('../../src/lib/prisma', () => ({
    category: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
    },
    product: {
        findMany: jest.fn(),
    }
}));

const categoryService = require('../../src/services/categoryService');
const prisma = require('../../src/lib/prisma');

describe('Category Service Tests', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    // **Feature: ecommerce-api, Property 19: Admin category creation**
    // Task 6.3: Property test for category creation
    test('Property 19: Admin category creation', async () => {
        fc.assert(
            fc.asyncProperty(
                fc.record({
                    name: fc.string({ minLength: 1, maxLength: 191 }).filter(s => s.trim().length > 0),
                    description: fc.oneof(
                        fc.constant(null),
                        fc.constant(undefined),
                        fc.string({ minLength: 0, maxLength: 5000 })
                    )
                }),
                async (categoryData) => {
                    // Reset mocks
                    prisma.category.findUnique.mockResolvedValue(null); // No duplicate
                    
                    const mockCategory = {
                        id: 1,
                        name: categoryData.name.trim(),
                        description: categoryData.description ? categoryData.description.trim() : null,
                        createdAt: new Date(),
                        updatedAt: new Date()
                    };

                    prisma.category.create.mockResolvedValue(mockCategory);

                    // Create category
                    const result = await categoryService.createCategory(categoryData);

                    // Verify category was created with correct data
                    expect(prisma.category.findUnique).toHaveBeenCalledWith({
                        where: { name: categoryData.name.trim() }
                    });
                    
                    expect(prisma.category.create).toHaveBeenCalledWith({
                        data: {
                            name: categoryData.name.trim(),
                            description: categoryData.description ? categoryData.description.trim() : null
                        }
                    });

                    // Verify result
                    expect(result).toBeDefined();
                    expect(result.name).toBe(categoryData.name.trim());
                    expect(result.id).toBeDefined();
                    
                    return true;
                }
            ),
            { numRuns: 5 }
        );
    });

    test('getAllCategories returns all categories', async () => {
        const mockCategories = [
            { id: 1, name: 'Electronics', description: 'Electronic items', createdAt: new Date(), updatedAt: new Date() },
            { id: 2, name: 'Clothing', description: 'Clothing items', createdAt: new Date(), updatedAt: new Date() }
        ];

        prisma.category.findMany.mockResolvedValue(mockCategories);

        const result = await categoryService.getAllCategories();

        expect(prisma.category.findMany).toHaveBeenCalledWith({
            orderBy: {
                createdAt: 'desc'
            }
        });
        expect(result).toEqual(mockCategories);
    });

    test('getCategoryById returns category with products', async () => {
        const categoryId = 1;
        const mockCategory = {
            id: categoryId,
            name: 'Electronics',
            description: 'Electronic items',
            createdAt: new Date(),
            updatedAt: new Date(),
            products: [
                { id: 1, name: 'Laptop', price: 999.99, stock: 10, createdAt: new Date() }
            ]
        };

        prisma.category.findUnique.mockResolvedValue(mockCategory);

        const result = await categoryService.getCategoryById(categoryId);

        expect(prisma.category.findUnique).toHaveBeenCalledWith({
            where: { id: categoryId },
            include: {
                products: {
                    select: {
                        id: true,
                        name: true,
                        price: true,
                        stock: true,
                        createdAt: true
                    }
                }
            }
        });
        expect(result).toEqual(mockCategory);
    });

    test('getCategoryById throws 404 when category not found', async () => {
        const categoryId = 999;

        prisma.category.findUnique.mockResolvedValue(null);

        await expect(categoryService.getCategoryById(categoryId)).rejects.toThrow('Category not found');
        
        try {
            await categoryService.getCategoryById(categoryId);
        } catch (error) {
            expect(error.statusCode).toBe(404);
        }
    });

    test('createCategory validates input and rejects invalid data', async () => {
        // Test missing name
        try {
            await categoryService.createCategory({ description: 'Some description' });
            expect(true).toBe(false); // Should not reach here
        } catch (error) {
            expect(error.statusCode).toBe(400);
            expect(error.message).toContain('name');
        }

        // Test empty name
        try {
            await categoryService.createCategory({ name: '' });
            expect(true).toBe(false);
        } catch (error) {
            expect(error.statusCode).toBe(400);
        }

        // Test name too long
        try {
            await categoryService.createCategory({ name: 'a'.repeat(192) });
            expect(true).toBe(false);
        } catch (error) {
            expect(error.statusCode).toBe(400);
        }
    });

    test('createCategory rejects duplicate category names', async () => {
        const categoryData = { name: 'Electronics', description: 'Electronic items' };
        const existingCategory = { id: 1, name: 'Electronics', description: 'Electronic items' };

        prisma.category.findUnique.mockResolvedValue(existingCategory);

        await expect(categoryService.createCategory(categoryData)).rejects.toThrow('already exists');
        
        try {
            await categoryService.createCategory(categoryData);
        } catch (error) {
            expect(error.statusCode).toBe(409);
            expect(error.message).toContain('already exists');
        }
    });

    test('updateCategory updates category successfully', async () => {
        const categoryId = 1;
        const existingCategory = {
            id: categoryId,
            name: 'Electronics',
            description: 'Old description',
            createdAt: new Date(),
            updatedAt: new Date()
        };
        const updateData = { name: 'Updated Electronics', description: 'New description' };

        prisma.category.findUnique
            .mockResolvedValueOnce(existingCategory) // Check exists
            .mockResolvedValueOnce(null); // Check no duplicate name

        const updatedCategory = {
            ...existingCategory,
            ...updateData,
            name: updateData.name.trim(),
            description: updateData.description.trim()
        };
        prisma.category.update.mockResolvedValue(updatedCategory);

        const result = await categoryService.updateCategory(categoryId, updateData);

        expect(prisma.category.update).toHaveBeenCalledWith({
            where: { id: categoryId },
            data: {
                name: updateData.name.trim(),
                description: updateData.description.trim()
            }
        });
        expect(result.name).toBe(updateData.name.trim());
    });

    test('updateCategory throws 404 when category not found', async () => {
        const categoryId = 999;
        const updateData = { name: 'Updated Name' };

        prisma.category.findUnique.mockResolvedValue(null);

        await expect(categoryService.updateCategory(categoryId, updateData)).rejects.toThrow('Category not found');
        
        try {
            await categoryService.updateCategory(categoryId, updateData);
        } catch (error) {
            expect(error.statusCode).toBe(404);
        }
    });

    test('deleteCategory deletes category when no products exist', async () => {
        const categoryId = 1;
        const category = {
            id: categoryId,
            name: 'Electronics',
            description: 'Electronic items',
            products: [], // No products
            createdAt: new Date(),
            updatedAt: new Date()
        };

        prisma.category.findUnique.mockResolvedValue(category);
        prisma.category.delete.mockResolvedValue(category);

        const result = await categoryService.deleteCategory(categoryId);

        expect(prisma.category.delete).toHaveBeenCalledWith({
            where: { id: categoryId }
        });
        expect(result).toEqual(category);
    });

    test('deleteCategory rejects deletion when products exist', async () => {
        const categoryId = 1;
        const category = {
            id: categoryId,
            name: 'Electronics',
            description: 'Electronic items',
            products: [
                { id: 1 },
                { id: 2 }
            ],
            createdAt: new Date(),
            updatedAt: new Date()
        };

        prisma.category.findUnique.mockResolvedValue(category);

        await expect(categoryService.deleteCategory(categoryId)).rejects.toThrow('Cannot delete category');
        
        try {
            await categoryService.deleteCategory(categoryId);
        } catch (error) {
            expect(error.statusCode).toBe(409);
            expect(error.message).toContain('Cannot delete category');
            expect(error.message).toContain('product(s) are associated');
        }

        // Verify delete was not called
        expect(prisma.category.delete).not.toHaveBeenCalled();
    });

    test('getCategoryProducts returns products for valid category', async () => {
        const categoryId = 1;
        const mockCategory = {
            id: categoryId,
            name: 'Electronics',
            description: 'Electronic items'
        };
        const mockProducts = [
            { id: 1, name: 'Laptop', price: 999.99, stock: 10, categoryId, category: { id: 1, name: 'Electronics' } }
        ];

        prisma.category.findUnique.mockResolvedValue(mockCategory);
        prisma.product.findMany.mockResolvedValue(mockProducts);

        const result = await categoryService.getCategoryProducts(categoryId);

        expect(prisma.product.findMany).toHaveBeenCalledWith({
            where: { categoryId },
            include: {
                category: {
                    select: {
                        id: true,
                        name: true
                    }
                }
            },
            orderBy: {
                createdAt: 'desc'
            }
        });
        expect(result).toEqual(mockProducts);
    });

    test('getCategoryProducts throws 404 when category not found', async () => {
        const categoryId = 999;

        prisma.category.findUnique.mockResolvedValue(null);

        await expect(categoryService.getCategoryProducts(categoryId)).rejects.toThrow('Category not found');
        
        try {
            await categoryService.getCategoryProducts(categoryId);
        } catch (error) {
            expect(error.statusCode).toBe(404);
        }
    });
});

