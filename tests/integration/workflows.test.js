/**
 * Integration tests for key workflows
 * Task 11.3: Write integration tests for key workflows
 * Validates: Requirements 1.1, 2.1, 3.1, 5.1, 5.3
 */

// Set JWT_SECRET before importing app so jwtUtils uses the correct secret
process.env.JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_do_not_use_in_production';

const request = require('supertest');

// Mock Prisma before importing app
jest.mock('../../src/lib/prisma', () => {
    const mockPrisma = {
        user: {
            create: jest.fn(),
            findUnique: jest.fn(),
        },
        product: {
            findMany: jest.fn(),
            findUnique: jest.fn(),
            update: jest.fn(),
        },
        category: {
            findMany: jest.fn(),
            findUnique: jest.fn(),
        },
        cartItem: {
            findMany: jest.fn(),
            findUnique: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
            deleteMany: jest.fn(),
            upsert: jest.fn(),
        },
        order: {
            create: jest.fn(),
            findMany: jest.fn(),
            findUnique: jest.fn(),
        },
        orderItem: {
            create: jest.fn(),
        },
        $transaction: jest.fn(),
    };
    return mockPrisma;
});

jest.mock('../../src/config/database', () => ({
    prisma: require('../../src/lib/prisma'),
    connectDatabase: jest.fn(),
    disconnectDatabase: jest.fn(),
}));

const app = require('../../src/app');
const prisma = require('../../src/lib/prisma');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

describe('Integration Tests - Key Workflows', () => {
    let authToken;
    let userId;
    let productId;
    let categoryId;

    // Set JWT_SECRET for tests to match jwtUtils default or env
    const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_do_not_use_in_production';

    beforeEach(() => {
        jest.clearAllMocks();
        
        // Set default test values
        userId = 1;
        productId = 1;
        categoryId = 1;
        authToken = jwt.sign(
            { id: userId, role: 'USER' },
            JWT_SECRET,
            { expiresIn: '1h' }
        );

        // Default mock for prisma.user.findUnique
        // This handles auth middleware queries and can be overridden by tests
        prisma.user.findUnique.mockImplementation((query) => {
            // If querying by id (auth middleware), return user with that id
            if (query && query.where && query.where.id) {
                const id = query.where.id;
                return Promise.resolve({
                    id: id,
                    phoneNumber: `phone${id}`,
                    name: 'Test User',
                    role: 'USER'
                });
            }
            // Otherwise return null (tests will override with mockResolvedValueOnce)
            return Promise.resolve(null);
        });
    });

    describe('Workflow 1: User Registration and Login Flow', () => {
        test('Complete user registration and login workflow', async () => {
            const phoneNumber = '12345678';
            const pin = '1234';
            const name = 'Test User';
            const hashedPin = await bcrypt.hash(pin, 10);

            // Step 1: Register a new user
            prisma.user.findUnique.mockResolvedValueOnce(null); // No existing user
            prisma.user.create.mockResolvedValueOnce({
                id: userId,
                phoneNumber,
                pin: hashedPin,
                name,
                role: 'USER',
                createdAt: new Date(),
                updatedAt: new Date(),
            });

            const registerResponse = await request(app)
                .post('/api/auth/register')
                .send({
                    phoneNumber,
                    pin,
                    name,
                })
                .expect(201);

            expect(registerResponse.body.success).toBe(true);
            expect(registerResponse.body.data).toHaveProperty('token');
            expect(registerResponse.body.data.user.phoneNumber).toBe(phoneNumber);
            expect(registerResponse.body.data.user.name).toBe(name);
            expect(prisma.user.create).toHaveBeenCalledTimes(1);

            // Extract token from registration
            const registrationToken = registerResponse.body.data.token;

            // Step 2: Login with registered credentials
            prisma.user.findUnique.mockResolvedValueOnce({
                id: userId,
                phoneNumber,
                pin: hashedPin,
                name,
                role: 'USER',
            });

            const loginResponse = await request(app)
                .post('/api/auth/login')
                .send({
                    phoneNumber,
                    pin,
                })
                .expect(200);

            expect(loginResponse.body.success).toBe(true);
            expect(loginResponse.body.data).toHaveProperty('token');
            expect(loginResponse.body.data.user.phoneNumber).toBe(phoneNumber);
            expect(prisma.user.findUnique).toHaveBeenCalledWith({
                where: { phoneNumber },
            });
        });

        test('Registration fails with duplicate phone number', async () => {
            const phoneNumber = '12345678';
            const pin = '1234';
            const name = 'Test User';

            // Mock existing user
            prisma.user.findUnique.mockResolvedValueOnce({
                id: userId,
                phoneNumber,
                pin: 'hashed',
                name: 'Existing User',
            });

            const response = await request(app)
                .post('/api/auth/register')
                .send({
                    phoneNumber,
                    pin,
                    name,
                })
                .expect(409);

            expect(response.body.success).toBe(false);
            expect(response.body.message).toContain('already exists');
        });

        test('Login fails with invalid credentials', async () => {
            const phoneNumber = '12345678';
            const wrongPin = '9999';
            const hashedPin = await bcrypt.hash('1234', 10);

            // Mock user exists but wrong PIN
            prisma.user.findUnique.mockResolvedValueOnce({
                id: userId,
                phoneNumber,
                pin: hashedPin,
                name: 'Test User',
            });

            const response = await request(app)
                .post('/api/auth/login')
                .send({
                    phoneNumber,
                    pin: wrongPin,
                })
                .expect(401);

            expect(response.body.success).toBe(false);
            expect(response.body.message).toContain('Invalid credentials');
        });
    });

    describe('Workflow 2: Product Browsing and Cart Operations', () => {
        beforeEach(() => {
            // Preserve auth middleware mock (handle any user id)
            prisma.user.findUnique.mockImplementation((query) => {
                if (query && query.where && query.where.id) {
                    const id = query.where.id;
                    return Promise.resolve({
                        id: id,
                        phoneNumber: `phone${id}`,
                        name: 'Test User',
                        role: 'USER'
                    });
                }
                return Promise.resolve(null);
            });

            // Setup category and products
            categoryId = 1;
            productId = 1;

            prisma.category.findMany.mockResolvedValue([
                {
                    id: categoryId,
                    name: 'Electronics',
                    description: 'Electronic items',
                    createdAt: new Date(),
                    updatedAt: new Date(),
                },
            ]);

            prisma.product.findMany.mockResolvedValue([
                {
                    id: productId,
                    name: 'Laptop',
                    description: 'High-performance laptop',
                    price: 999.99,
                    stock: 10,
                    categoryId,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    category: {
                        id: categoryId,
                        name: 'Electronics',
                    },
                },
                {
                    id: 2,
                    name: 'Phone',
                    description: 'Smartphone',
                    price: 699.99,
                    stock: 5,
                    categoryId,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    category: {
                        id: categoryId,
                        name: 'Electronics',
                    },
                },
            ]);
        });

        test('Complete product browsing and cart workflow', async () => {
            // Step 1: Browse all products
            const productsResponse = await request(app)
                .get('/api/products')
                .expect(200);

            expect(productsResponse.body.success).toBe(true);
            expect(productsResponse.body.data).toBeInstanceOf(Array);
            expect(productsResponse.body.data.length).toBeGreaterThan(0);
            expect(productsResponse.body.data[0]).toHaveProperty('name');
            expect(productsResponse.body.data[0]).toHaveProperty('price');
            expect(productsResponse.body.data[0]).toHaveProperty('stock');

            // Step 2: Get categories
            const categoriesResponse = await request(app)
                .get('/api/categories')
                .expect(200);

            expect(categoriesResponse.body.success).toBe(true);
            expect(categoriesResponse.body.data).toBeInstanceOf(Array);

            // Step 3: Get a specific product
            prisma.product.findUnique.mockResolvedValueOnce({
                id: productId,
                name: 'Laptop',
                description: 'High-performance laptop',
                price: 999.99,
                stock: 10,
                categoryId,
                createdAt: new Date(),
                updatedAt: new Date(),
                category: {
                    id: categoryId,
                    name: 'Electronics',
                },
            });

            const productResponse = await request(app)
                .get(`/api/products/${productId}`)
                .expect(200);

            expect(productResponse.body.success).toBe(true);
            expect(productResponse.body.data.id).toBe(productId);
            expect(productResponse.body.data.name).toBe('Laptop');

            // Step 4: Add product to cart (requires authentication)
            prisma.product.findUnique.mockResolvedValueOnce({
                id: productId,
                name: 'Laptop',
                price: 999.99,
                stock: 10,
                categoryId,
            });

            prisma.cartItem.findUnique.mockResolvedValueOnce(null); // Cart item doesn't exist yet
            prisma.cartItem.findMany.mockResolvedValueOnce([]);
            prisma.cartItem.upsert.mockResolvedValueOnce({
                id: 1,
                userId,
                productId,
                quantity: 2,
                createdAt: new Date(),
                updatedAt: new Date(),
                product: {
                    id: productId,
                    name: 'Laptop',
                    price: 999.99,
                    stock: 10,
                },
            });

            const addToCartResponse = await request(app)
                .post('/api/cart')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    productId,
                    quantity: 2,
                })
                .expect(200);

            expect(addToCartResponse.body.success).toBe(true);
            expect(addToCartResponse.body.data).toHaveProperty('productId');
            expect(addToCartResponse.body.data).toHaveProperty('quantity');

            // Step 5: Get cart contents
            prisma.cartItem.findMany.mockResolvedValueOnce([
                {
                    id: 1,
                    userId,
                    productId,
                    quantity: 2,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    product: {
                        id: productId,
                        name: 'Laptop',
                        price: 999.99,
                        stock: 10,
                    },
                },
            ]);

            const getCartResponse = await request(app)
                .get('/api/cart')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(getCartResponse.body.success).toBe(true);
            expect(getCartResponse.body.data).toBeInstanceOf(Array);
            expect(getCartResponse.body.data.length).toBe(1);
            expect(getCartResponse.body.data[0].quantity).toBe(2);

            // Step 6: Update cart item quantity
            prisma.product.findUnique.mockResolvedValueOnce({
                id: productId,
                stock: 10,
            });

            prisma.cartItem.findMany.mockResolvedValueOnce([
                {
                    id: 1,
                    userId,
                    productId,
                    quantity: 2,
                },
            ]);

            prisma.cartItem.update.mockResolvedValueOnce({
                id: 1,
                userId,
                productId,
                quantity: 3,
                updatedAt: new Date(),
                product: {
                    id: productId,
                    name: 'Laptop',
                    price: 999.99,
                },
            });

            const updateCartResponse = await request(app)
                .put(`/api/cart/${productId}`)
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    quantity: 3,
                })
                .expect(200);

            expect(updateCartResponse.body.success).toBe(true);
        });

        test('Cart operations fail when stock is insufficient', async () => {
            const quantity = 20; // More than available stock (10)

            prisma.product.findUnique.mockResolvedValueOnce({
                id: productId,
                name: 'Laptop',
                price: 999.99,
                stock: 10, // Only 10 in stock
                categoryId,
            });

            const response = await request(app)
                .post('/api/cart')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    productId,
                    quantity,
                })
                .expect(400);

            expect(response.body.success).toBe(false);
            expect(response.body.message).toContain('stock');
        });
    });

    describe('Workflow 3: Order Placement End-to-End', () => {
        beforeEach(() => {
            // Preserve auth middleware mock (handle any user id)
            prisma.user.findUnique.mockImplementation((query) => {
                if (query && query.where && query.where.id) {
                    const id = query.where.id;
                    return Promise.resolve({
                        id: id,
                        phoneNumber: `phone${id}`,
                        name: 'Test User',
                        role: 'USER'
                    });
                }
                return Promise.resolve(null);
            });

            // Setup mock cart items
            prisma.cartItem.findMany.mockResolvedValue([
                {
                    id: 1,
                    userId,
                    productId: 1,
                    quantity: 2,
                    product: {
                        id: 1,
                        name: 'Laptop',
                        price: 999.99,
                        stock: 10,
                    },
                },
                {
                    id: 2,
                    userId,
                    productId: 2,
                    quantity: 1,
                    product: {
                        id: 2,
                        name: 'Phone',
                        price: 699.99,
                        stock: 5,
                    },
                },
            ]);
        });

        test('Complete order placement workflow', async () => {
            const orderId = 1;
            const expectedTotal = (999.99 * 2) + (699.99 * 1); // 2699.97

            // Override findMany for this test to ensure fresh cart data
            prisma.cartItem.findMany.mockResolvedValueOnce([
                {
                    id: 1,
                    userId,
                    productId: 1,
                    quantity: 2,
                    product: {
                        id: 1,
                        name: 'Laptop',
                        price: 999.99,
                        stock: 10,
                    },
                },
                {
                    id: 2,
                    userId,
                    productId: 2,
                    quantity: 1,
                    product: {
                        id: 2,
                        name: 'Phone',
                        price: 699.99,
                        stock: 5,
                    },
                },
            ]);

            // Mock product.findUnique for stock checks (called before transaction)
            prisma.product.findUnique
                .mockResolvedValueOnce({ id: 1, stock: 10, name: 'Laptop', price: 999.99 }) // Stock check for product 1
                .mockResolvedValueOnce({ id: 2, stock: 5, name: 'Phone', price: 699.99 }); // Stock check for product 2

            // Mock order creation transaction
            prisma.$transaction.mockImplementation(async (callback) => {
                const mockTransactionPrisma = {
                    order: {
                        create: jest.fn().mockResolvedValue({
                            id: orderId,
                            userId,
                            totalAmount: expectedTotal,
                            status: 'COMPLETED',
                            createdAt: new Date(),
                            updatedAt: new Date(),
                        }),
                    },
                    orderItem: {
                        create: jest.fn().mockImplementation((args) => {
                            return Promise.resolve({
                                id: 1,
                                orderId: args.data.orderId,
                                productId: args.data.productId,
                                quantity: args.data.quantity,
                                price: args.data.price,
                                product: {
                                    id: args.data.productId,
                                    name: args.data.productId === 1 ? 'Laptop' : 'Phone',
                                    price: args.data.price,
                                    category: { id: 1, name: 'Electronics', description: 'Electronic items' }
                                }
                            });
                        }),
                    },
                    product: {
                        update: jest.fn().mockResolvedValue({}),
                    },
                    cartItem: {
                        deleteMany: jest.fn().mockResolvedValue({ count: 2 }),
                    },
                };
                return await callback(mockTransactionPrisma);
            });

            // Mock order.findUnique that's called after transaction to fetch full order details
            prisma.order.findUnique.mockResolvedValueOnce({
                id: orderId,
                userId,
                totalAmount: expectedTotal,
                status: 'COMPLETED',
                createdAt: new Date(),
                updatedAt: new Date(),
                items: [
                    {
                        id: 1,
                        orderId,
                        productId: 1,
                        quantity: 2,
                        price: 999.99,
                        product: {
                            id: 1,
                            name: 'Laptop',
                            price: 999.99,
                            category: { id: 1, name: 'Electronics', description: 'Electronic items' }
                        }
                    },
                    {
                        id: 2,
                        orderId,
                        productId: 2,
                        quantity: 1,
                        price: 699.99,
                        product: {
                            id: 2,
                            name: 'Phone',
                            price: 699.99,
                            category: { id: 1, name: 'Electronics', description: 'Electronic items' }
                        }
                    }
                ]
            });

            // Step 1: Create order from cart
            const createOrderResponse = await request(app)
                .post('/api/orders')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(201);

            expect(createOrderResponse.body.success).toBe(true);
            expect(createOrderResponse.body.data).toHaveProperty('id');
            expect(createOrderResponse.body.data.totalAmount.toString()).toBe(expectedTotal.toString());
            expect(createOrderResponse.body.data.status).toBe('COMPLETED');

            // Step 2: Get user orders
            prisma.order.findMany.mockResolvedValue([
                {
                    id: orderId,
                    userId,
                    totalAmount: expectedTotal,
                    status: 'COMPLETED',
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    items: [
                        {
                            id: 1,
                            productId: 1,
                            quantity: 2,
                            price: 999.99,
                        },
                        {
                            id: 2,
                            productId: 2,
                            quantity: 1,
                            price: 699.99,
                        },
                    ],
                },
            ]);

            const getOrdersResponse = await request(app)
                .get('/api/orders')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(getOrdersResponse.body.success).toBe(true);
            expect(getOrdersResponse.body.data).toBeInstanceOf(Array);
            expect(getOrdersResponse.body.data.length).toBe(1);
            expect(getOrdersResponse.body.data[0].id).toBe(orderId);

            // Step 3: Get specific order by ID
            prisma.order.findUnique.mockResolvedValueOnce({
                id: orderId,
                userId,
                totalAmount: expectedTotal,
                status: 'COMPLETED',
                createdAt: new Date(),
                updatedAt: new Date(),
                items: [
                    {
                        id: 1,
                        productId: 1,
                        quantity: 2,
                        price: 999.99,
                        product: {
                            id: 1,
                            name: 'Laptop',
                        },
                    },
                ],
            });

            const getOrderResponse = await request(app)
                .get(`/api/orders/${orderId}`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(getOrderResponse.body.success).toBe(true);
            expect(getOrderResponse.body.data.id).toBe(orderId);
            expect(getOrderResponse.body.data.items).toBeInstanceOf(Array);
        });

        test('Order creation fails when cart is empty', async () => {
            // Override the beforeEach mock for this test - mock empty cart
            prisma.cartItem.findMany.mockResolvedValueOnce([]);

            const response = await request(app)
                .post('/api/orders')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(400);

            expect(response.body.success).toBe(false);
            expect(response.body.message.toLowerCase()).toContain('cart');
        });
    });

    describe('Workflow 4: Complete User Journey', () => {
        test('Complete user journey: Register -> Browse -> Add to Cart -> Place Order', async () => {
            const phoneNumber = '87654321';
            const pin = '5678';
            const name = 'Journey User';
            const hashedPin = await bcrypt.hash(pin, 10);
            const testUserId = 99;
            const testProductId = 99;
            const testCategoryId = 99;

            // Step 1: Register
            prisma.user.findUnique.mockResolvedValueOnce(null);
            prisma.user.create.mockResolvedValueOnce({
                id: testUserId,
                phoneNumber,
                pin: hashedPin,
                name,
                role: 'USER',
                createdAt: new Date(),
                updatedAt: new Date(),
            });

            const registerResponse = await request(app)
                .post('/api/auth/register')
                .send({ phoneNumber, pin, name })
                .expect(201);

            const userToken = registerResponse.body.data.token;

            // Step 2: Browse products
            prisma.product.findMany.mockResolvedValueOnce([
                {
                    id: testProductId,
                    name: 'Test Product',
                    description: 'Test Description',
                    price: 99.99,
                    stock: 10,
                    categoryId: testCategoryId,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    category: { id: testCategoryId, name: 'Test Category' },
                },
            ]);

            const productsResponse = await request(app)
                .get('/api/products')
                .expect(200);

            expect(productsResponse.body.data.length).toBeGreaterThan(0);

            // Step 3: Add to cart
            prisma.product.findUnique.mockResolvedValueOnce({
                id: testProductId,
                stock: 10,
            });
            prisma.cartItem.findMany.mockResolvedValueOnce([]);
            prisma.cartItem.upsert.mockResolvedValueOnce({
                id: 1,
                userId: testUserId,
                productId: testProductId,
                quantity: 1,
                createdAt: new Date(),
                updatedAt: new Date(),
                product: {
                    id: testProductId,
                    name: 'Test Product',
                    price: 99.99,
                },
            });

            const addCartResponse = await request(app)
                .post('/api/cart')
                .set('Authorization', `Bearer ${userToken}`)
                .send({ productId: testProductId, quantity: 1 })
                .expect(200);

            expect(addCartResponse.body.success).toBe(true);

            // Step 4: Place order
            prisma.cartItem.findMany.mockResolvedValueOnce([
                {
                    id: 1,
                    userId: testUserId,
                    productId: testProductId,
                    quantity: 1,
                    product: {
                        id: testProductId,
                        name: 'Test Product',
                        price: 99.99,
                        stock: 10,
                    },
                },
            ]);

            // Mock product.findUnique for stock check
            prisma.product.findUnique.mockResolvedValueOnce({
                id: testProductId,
                name: 'Test Product',
                price: 99.99,
                stock: 10,
            });

            // Mock order.findUnique that's called after transaction to fetch full order details
            prisma.order.findUnique.mockResolvedValueOnce({
                id: 1,
                userId: testUserId,
                totalAmount: 99.99,
                status: 'COMPLETED',
                createdAt: new Date(),
                updatedAt: new Date(),
                items: [
                    {
                        id: 1,
                        orderId: 1,
                        productId: testProductId,
                        quantity: 1,
                        price: 99.99,
                        product: {
                            id: testProductId,
                            name: 'Test Product',
                            price: 99.99,
                            category: { id: testCategoryId, name: 'Test Category', description: 'Test Description' }
                        }
                    }
                ]
            });

            prisma.$transaction.mockImplementation(async (callback) => {
                const mockTransactionPrisma = {
                    order: {
                        create: jest.fn().mockResolvedValue({
                            id: 1,
                            userId: testUserId,
                            totalAmount: 99.99,
                            status: 'COMPLETED',
                            createdAt: new Date(),
                            updatedAt: new Date(),
                        }),
                    },
                    orderItem: {
                        create: jest.fn().mockImplementation((args) => {
                            return Promise.resolve({
                                id: 1,
                                orderId: args.data.orderId,
                                productId: args.data.productId,
                                quantity: args.data.quantity,
                                price: args.data.price,
                                product: {
                                    id: args.data.productId,
                                    name: args.data.productId === 1 ? 'Laptop' : 'Phone',
                                    price: args.data.price,
                                    category: { id: 1, name: 'Electronics', description: 'Electronic items' }
                                }
                            });
                        }),
                    },
                    product: {
                        update: jest.fn().mockResolvedValue({}),
                    },
                    cartItem: {
                        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
                    },
                };
                return await callback(mockTransactionPrisma);
            });

            const orderResponse = await request(app)
                .post('/api/orders')
                .set('Authorization', `Bearer ${userToken}`)
                .expect(201);

            expect(orderResponse.body.success).toBe(true);
            expect(orderResponse.body.data).toHaveProperty('id');
            expect(orderResponse.body.data.totalAmount.toString()).toBe('99.99');
        });
    });
});

