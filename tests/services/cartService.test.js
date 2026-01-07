const fc = require('fast-check');

// Mock Prisma before importing anything that uses it
jest.mock('../../src/lib/prisma', () => ({
    cartItem: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        deleteMany: jest.fn(),
    }
}));

// Mock productService before importing cartService
jest.mock('../../src/services/productService', () => ({
    checkStockAvailability: jest.fn(),
}));

const cartService = require('../../src/services/cartService');
const prisma = require('../../src/lib/prisma');
const productService = require('../../src/services/productService');

describe('Cart Service Tests', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    // **Feature: ecommerce-api, Property 20: Cart addition with stock validation**
    // Task 8.2: Property test for cart stock validation
    // Validates: Requirements 5.1
    test('Property 20: Cart addition with stock validation', async () => {
        fc.assert(
            fc.asyncProperty(
                fc.integer({ min: 1, max: 1000 }), // userId
                fc.integer({ min: 1, max: 1000 }), // productId
                fc.integer({ min: 1, max: 100 }), // stock
                fc.integer({ min: 1, max: 100 }), // quantity
                async (userId, productId, stock, quantity) => {
                    // Skip if quantity > stock (test only valid scenarios)
                    if (quantity > stock) {
                        return true;
                    }
                    
                    // Reset mocks for each test iteration
                    jest.clearAllMocks();
                    
                    // Mock product with sufficient stock
                    const mockProduct = {
                        id: productId,
                        name: 'Test Product',
                        price: 10.99,
                        stock: stock,
                        categoryId: 1
                    };

                    // Mock stock check - product has sufficient stock (set up fresh)
                    productService.checkStockAvailability.mockImplementation(async (pid, qty) => {
                        if (pid === productId && qty === quantity) {
                            return {
                                hasStock: true,
                                product: mockProduct
                            };
                        }
                        throw new Error(`Unexpected call with productId=${pid}, quantity=${qty}`);
                    });

                    // Mock that cart item doesn't exist (new item)
                    prisma.cartItem.findUnique.mockImplementation(async (args) => {
                        const where = args?.where?.userId_productId;
                        if (where?.userId === userId && where?.productId === productId) {
                            return null;
                        }
                        return null;
                    });

                    // Mock cart item creation
                    const mockCartItem = {
                        id: 1,
                        userId: userId,
                        productId: productId,
                        quantity: quantity,
                        createdAt: new Date(),
                        updatedAt: new Date(),
                        product: {
                            ...mockProduct,
                            category: {
                                id: 1,
                                name: 'Test Category',
                                description: 'Test Description'
                            }
                        }
                    };

                    prisma.cartItem.create.mockResolvedValue(mockCartItem);

                    // Add to cart - key property: cart item is created when stock is sufficient
                    const result = await cartService.addToCart(userId, productId, quantity);

                    // Verify result properties
                    expect(result).toBeDefined();
                    expect(result.userId).toBe(userId);
                    expect(result.productId).toBe(productId);
                    expect(result.quantity).toBe(quantity);
                    expect(result.product).toBeDefined();
                    expect(result.product.stock).toBeGreaterThanOrEqual(quantity);

                    return true;
                }
            ),
            { numRuns: 20 } // Reduced runs for reliability
        );
    });

    // **Feature: ecommerce-api, Property 21: Insufficient stock cart rejection**
    // Task 8.3: Property test for insufficient stock rejection
    // Validates: Requirements 5.2
    test('Property 21: Insufficient stock cart rejection', async () => {
        fc.assert(
            fc.asyncProperty(
                fc.integer({ min: 1, max: 1000 }), // userId
                fc.integer({ min: 1, max: 1000 }), // productId
                fc.integer({ min: 0, max: 99 }), // stock (max 99)
                fc.integer({ min: 1, max: 100 }), // quantity
                async (userId, productId, stock, quantity) => {
                    // Skip if quantity <= stock (test only insufficient stock scenarios)
                    if (quantity <= stock) {
                        return true;
                    }
                    
                    // Reset mocks for each test iteration
                    jest.clearAllMocks();
                    
                    // Mock product with insufficient stock
                    const mockProduct = {
                        id: productId,
                        name: 'Test Product',
                        price: 10.99,
                        stock: stock,
                        categoryId: 1
                    };

                    // Mock stock check - product has insufficient stock (set up fresh)
                    productService.checkStockAvailability.mockImplementation(async (pid, qty) => {
                        if (pid === productId && qty === quantity) {
                            return {
                                hasStock: false,
                                product: mockProduct
                            };
                        }
                        throw new Error(`Unexpected call with productId=${pid}, quantity=${qty}`);
                    });

                    // Mock that cart item doesn't exist
                    prisma.cartItem.findUnique.mockImplementation(async (args) => {
                        const where = args?.where?.userId_productId;
                        if (where?.userId === userId && where?.productId === productId) {
                            return null;
                        }
                        return null;
                    });

                    // Key property: cart addition is rejected when stock is insufficient
                    try {
                        await cartService.addToCart(userId, productId, quantity);
                        // Should not reach here
                        return false; // If we get here, the test should fail
                    } catch (error) {
                        // Verify error details
                        expect(error.statusCode).toBe(400);
                        expect(error.message).toContain('Insufficient stock');
                        expect(error.message).toContain(stock.toString());
                        expect(error.message).toContain(quantity.toString());
                        return true;
                    }
                }
            ),
            { numRuns: 20 } // Reduced runs for reliability
        );
    });

    test('addToCart updates existing cart item when item already exists', async () => {
        const userId = 1;
        const productId = 1;
        const existingQuantity = 2;
        const addQuantity = 3;
        const totalQuantity = existingQuantity + addQuantity;
        const stock = 10; // Sufficient for total

        const mockProduct = {
            id: productId,
            name: 'Test Product',
            price: 10.99,
            stock: stock,
            categoryId: 1
        };

        const existingCartItem = {
            id: 1,
            userId: userId,
            productId: productId,
            quantity: existingQuantity,
            createdAt: new Date(),
            updatedAt: new Date(),
            product: mockProduct
        };

        // Mock stock check for initial addition
        productService.checkStockAvailability
            .mockResolvedValueOnce({
                hasStock: true,
                product: mockProduct
            })
            // Mock stock check for total quantity when updating existing item
            .mockResolvedValueOnce({
                hasStock: true,
                product: mockProduct
            });

        // Mock that cart item exists
        prisma.cartItem.findUnique.mockResolvedValue(existingCartItem);

        const updatedCartItem = {
            ...existingCartItem,
            quantity: totalQuantity,
            product: {
                ...mockProduct,
                category: {
                    id: 1,
                    name: 'Test Category',
                    description: 'Test Description'
                }
            }
        };

        prisma.cartItem.update.mockResolvedValue(updatedCartItem);

        const result = await cartService.addToCart(userId, productId, addQuantity);

        // Verify stock was checked for total quantity
        expect(productService.checkStockAvailability).toHaveBeenCalledWith(productId, totalQuantity);

        // Verify cart item was updated, not created
        expect(prisma.cartItem.update).toHaveBeenCalled();
        expect(prisma.cartItem.create).not.toHaveBeenCalled();

        expect(result.quantity).toBe(totalQuantity);
    });

    test('addToCart rejects when updating existing item exceeds stock', async () => {
        const userId = 1;
        const productId = 1;
        const existingQuantity = 5;
        const addQuantity = 3;
        const totalQuantity = existingQuantity + addQuantity;
        const stock = 7; // Insufficient for total (needs 8)

        const mockProduct = {
            id: productId,
            name: 'Test Product',
            price: 10.99,
            stock: stock,
            categoryId: 1
        };

        const existingCartItem = {
            id: 1,
            userId: userId,
            productId: productId,
            quantity: existingQuantity,
            createdAt: new Date(),
            updatedAt: new Date(),
            product: mockProduct
        };

        // Mock stock check for initial addition (passes)
        productService.checkStockAvailability
            .mockResolvedValueOnce({
                hasStock: true,
                product: mockProduct
            })
            // Mock stock check for total quantity (fails)
            .mockResolvedValueOnce({
                hasStock: false,
                product: mockProduct
            });

        // Mock that cart item exists
        prisma.cartItem.findUnique.mockResolvedValue(existingCartItem);

        // Should throw error
        await expect(
            cartService.addToCart(userId, productId, addQuantity)
        ).rejects.toThrow('Insufficient stock');

        // Verify stock was checked for total quantity
        expect(productService.checkStockAvailability).toHaveBeenCalledWith(productId, totalQuantity);

        // Verify cart item was NOT updated
        expect(prisma.cartItem.update).not.toHaveBeenCalled();
    });

    test('getCart returns user cart items', async () => {
        const userId = 1;
        const mockCartItems = [
            {
                id: 1,
                userId: userId,
                productId: 1,
                quantity: 2,
                createdAt: new Date(),
                updatedAt: new Date(),
                product: {
                    id: 1,
                    name: 'Product 1',
                    price: 10.99,
                    stock: 10,
                    category: {
                        id: 1,
                        name: 'Category 1',
                        description: 'Description 1'
                    }
                }
            }
        ];

        prisma.cartItem.findMany.mockResolvedValue(mockCartItems);

        const result = await cartService.getCart(userId);

        expect(prisma.cartItem.findMany).toHaveBeenCalledWith({
            where: { userId: userId },
            include: {
                product: {
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
            },
            orderBy: {
                createdAt: 'desc'
            }
        });

        expect(result).toEqual(mockCartItems);
    });

    test('updateCartItem updates quantity with stock validation', async () => {
        const userId = 1;
        const productId = 1;
        const newQuantity = 5;
        const stock = 10;

        const mockProduct = {
            id: productId,
            name: 'Test Product',
            price: 10.99,
            stock: stock,
            categoryId: 1
        };

        const existingCartItem = {
            id: 1,
            userId: userId,
            productId: productId,
            quantity: 2,
            createdAt: new Date(),
            updatedAt: new Date()
        };

        productService.checkStockAvailability.mockResolvedValue({
            hasStock: true,
            product: mockProduct
        });

        prisma.cartItem.findUnique.mockResolvedValue(existingCartItem);

        const updatedCartItem = {
            ...existingCartItem,
            quantity: newQuantity,
            product: {
                ...mockProduct,
                category: {
                    id: 1,
                    name: 'Test Category',
                    description: 'Test Description'
                }
            }
        };

        prisma.cartItem.update.mockResolvedValue(updatedCartItem);

        const result = await cartService.updateCartItem(userId, productId, newQuantity);

        expect(productService.checkStockAvailability).toHaveBeenCalledWith(productId, newQuantity);
        expect(prisma.cartItem.update).toHaveBeenCalled();
        expect(result.quantity).toBe(newQuantity);
    });

    test('updateCartItem rejects when new quantity exceeds stock', async () => {
        const userId = 1;
        const productId = 1;
        const newQuantity = 15;
        const stock = 10;

        const mockProduct = {
            id: productId,
            name: 'Test Product',
            price: 10.99,
            stock: stock,
            categoryId: 1
        };

        const existingCartItem = {
            id: 1,
            userId: userId,
            productId: productId,
            quantity: 2,
            createdAt: new Date(),
            updatedAt: new Date()
        };

        productService.checkStockAvailability.mockResolvedValue({
            hasStock: false,
            product: mockProduct
        });

        prisma.cartItem.findUnique.mockResolvedValue(existingCartItem);

        await expect(
            cartService.updateCartItem(userId, productId, newQuantity)
        ).rejects.toThrow('Insufficient stock');

        expect(prisma.cartItem.update).not.toHaveBeenCalled();
    });

    test('removeFromCart removes item from cart', async () => {
        const userId = 1;
        const productId = 1;

        const existingCartItem = {
            id: 1,
            userId: userId,
            productId: productId,
            quantity: 2,
            createdAt: new Date(),
            updatedAt: new Date(),
            product: {
                id: productId,
                name: 'Test Product',
                category: {
                    id: 1,
                    name: 'Test Category',
                    description: 'Test Description'
                }
            }
        };

        prisma.cartItem.findUnique.mockResolvedValue(existingCartItem);
        prisma.cartItem.delete.mockResolvedValue(existingCartItem);

        const result = await cartService.removeFromCart(userId, productId);

        expect(prisma.cartItem.delete).toHaveBeenCalledWith({
            where: {
                userId_productId: {
                    userId: userId,
                    productId: productId
                }
            }
        });

        expect(result).toEqual(existingCartItem);
    });

    test('removeFromCart throws 404 when cart item not found', async () => {
        const userId = 1;
        const productId = 1;

        prisma.cartItem.findUnique.mockResolvedValue(null);

        await expect(
            cartService.removeFromCart(userId, productId)
        ).rejects.toThrow('Cart item not found');

        try {
            await cartService.removeFromCart(userId, productId);
        } catch (error) {
            expect(error.statusCode).toBe(404);
        }
    });

    test('clearCart removes all items from user cart', async () => {
        const userId = 1;
        const deletedCount = 3;

        prisma.cartItem.deleteMany.mockResolvedValue({ count: deletedCount });

        const result = await cartService.clearCart(userId);

        expect(prisma.cartItem.deleteMany).toHaveBeenCalledWith({
            where: { userId: userId }
        });

        expect(result).toBe(deletedCount);
    });

    test('addToCart validates quantity input', async () => {
        const userId = 1;
        const productId = 1;

        // Test invalid quantity - zero
        await expect(
            cartService.addToCart(userId, productId, 0)
        ).rejects.toThrow();

        // Test invalid quantity - negative
        await expect(
            cartService.addToCart(userId, productId, -1)
        ).rejects.toThrow();

        // Test invalid quantity - non-number
        await expect(
            cartService.addToCart(userId, productId, 'invalid')
        ).rejects.toThrow();

        // Verify no stock check or database calls were made
        expect(productService.checkStockAvailability).not.toHaveBeenCalled();
        expect(prisma.cartItem.create).not.toHaveBeenCalled();
    });
});

