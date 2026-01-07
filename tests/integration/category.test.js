const categoryService = require('../../src/services/categoryService');
const prisma = require('../../src/lib/prisma');

// Mock Prisma
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

describe('Category Integration Test', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('Complete category CRUD flow', async () => {
        const categoryData = {
            name: 'Electronics',
            description: 'Electronic items and gadgets'
        };

        // 1. Create Category
        const mockCategory = {
            id: 1,
            name: categoryData.name,
            description: categoryData.description,
            createdAt: new Date(),
            updatedAt: new Date()
        };

        prisma.category.findUnique.mockResolvedValueOnce(null); // No duplicate
        prisma.category.create.mockResolvedValueOnce(mockCategory);

        const createdCategory = await categoryService.createCategory(categoryData);

        expect(createdCategory).toBeDefined();
        expect(createdCategory.name).toBe(categoryData.name);
        expect(createdCategory.description).toBe(categoryData.description);
        expect(createdCategory.id).toBe(1);

        // 2. Get Category by ID
        const categoryWithProducts = {
            ...mockCategory,
            products: []
        };
        prisma.category.findUnique.mockResolvedValueOnce(categoryWithProducts);

        const retrievedCategory = await categoryService.getCategoryById(1);

        expect(retrievedCategory).toBeDefined();
        expect(retrievedCategory.id).toBe(1);
        expect(retrievedCategory.name).toBe(categoryData.name);
        expect(retrievedCategory.products).toBeDefined();

        // 3. Update Category
        const updateData = {
            name: 'Updated Electronics',
            description: 'Updated description'
        };

        prisma.category.findUnique
            .mockResolvedValueOnce(mockCategory) // Check exists
            .mockResolvedValueOnce(null); // Check no duplicate name

        const updatedCategory = {
            ...mockCategory,
            name: updateData.name,
            description: updateData.description,
            updatedAt: new Date()
        };
        prisma.category.update.mockResolvedValueOnce(updatedCategory);

        const result = await categoryService.updateCategory(1, updateData);

        expect(result.name).toBe(updateData.name);
        expect(result.description).toBe(updateData.description);

        // 4. Delete Category (no products)
        const categoryForDeletion = {
            ...updatedCategory,
            products: []
        };
        prisma.category.findUnique.mockResolvedValueOnce(categoryForDeletion);
        prisma.category.delete.mockResolvedValueOnce(categoryForDeletion);

        const deletedCategory = await categoryService.deleteCategory(1);

        expect(deletedCategory).toBeDefined();
        expect(prisma.category.delete).toHaveBeenCalledWith({
            where: { id: 1 }
        });
    });

    test('Category deletion fails when products exist', async () => {
        const categoryId = 1;
        const category = {
            id: categoryId,
            name: 'Electronics',
            description: 'Electronic items',
            products: [
                { id: 1 },
                { id: 2 },
                { id: 3 }
            ],
            createdAt: new Date(),
            updatedAt: new Date()
        };

        prisma.category.findUnique.mockResolvedValue(category);

        try {
            await categoryService.deleteCategory(categoryId);
            expect(true).toBe(false); // Should not reach here
        } catch (error) {
            expect(error.statusCode).toBe(409);
            expect(error.message).toContain('Cannot delete category');
            expect(error.message).toContain('3 product(s)');
        }

        // Verify delete was not called
        expect(prisma.category.delete).not.toHaveBeenCalled();
    });

    test('Get all categories returns list', async () => {
        const mockCategories = [
            { id: 1, name: 'Electronics', description: 'Electronic items', createdAt: new Date(), updatedAt: new Date() },
            { id: 2, name: 'Clothing', description: 'Clothing items', createdAt: new Date(), updatedAt: new Date() },
            { id: 3, name: 'Food', description: null, createdAt: new Date(), updatedAt: new Date() }
        ];

        prisma.category.findMany.mockResolvedValue(mockCategories);

        const categories = await categoryService.getAllCategories();

        expect(categories).toHaveLength(3);
        expect(categories[0].name).toBe('Electronics');
        expect(categories[1].name).toBe('Clothing');
        expect(categories[2].name).toBe('Food');
    });

    test('Get category products returns products in category', async () => {
        const categoryId = 1;
        const mockCategory = {
            id: categoryId,
            name: 'Electronics',
            description: 'Electronic items'
        };
        const mockProducts = [
            {
                id: 1,
                name: 'Laptop',
                price: 999.99,
                stock: 10,
                categoryId,
                category: { id: 1, name: 'Electronics' },
                createdAt: new Date()
            },
            {
                id: 2,
                name: 'Phone',
                price: 599.99,
                stock: 5,
                categoryId,
                category: { id: 1, name: 'Electronics' },
                createdAt: new Date()
            }
        ];

        prisma.category.findUnique.mockResolvedValue(mockCategory);
        prisma.product.findMany.mockResolvedValue(mockProducts);

        const products = await categoryService.getCategoryProducts(categoryId);

        expect(products).toHaveLength(2);
        expect(products[0].name).toBe('Laptop');
        expect(products[1].name).toBe('Phone');
        expect(products[0].category.name).toBe('Electronics');
    });
});

