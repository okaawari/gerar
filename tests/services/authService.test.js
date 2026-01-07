const fc = require('fast-check');
const bcrypt = require('bcrypt');

// Mock Prisma before importing anything that uses it
jest.mock('../../src/lib/prisma', () => ({
    user: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
    }
}));

const authService = require('../../src/services/authService');
const prisma = require('../../src/lib/prisma');
const { hashPin, comparePin } = require('../../src/utils/hashUtils');

describe('Authentication Service Properties', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    // **Feature: ecommerce-api, Property 3: Invalid registration data validation**
    // Task 4.2: Property test for registration validation
    test('Property 3: Invalid registration data validation', async () => {
        fc.assert(
            fc.asyncProperty(
                // Generate invalid data combinations
                fc.oneof(
                    // Missing phoneNumber
                    fc.record({
                        phoneNumber: fc.constant(null),
                        pin: fc.string({ minLength: 4, maxLength: 4 }).filter(s => /^\d+$/.test(s)),
                        name: fc.string({ minLength: 1 })
                    }),
                    // Missing PIN
                    fc.record({
                        phoneNumber: fc.string({ minLength: 8, maxLength: 8 }).filter(s => /^\d+$/.test(s)),
                        pin: fc.constant(null),
                        name: fc.string({ minLength: 1 })
                    }),
                    // Missing name
                    fc.record({
                        phoneNumber: fc.string({ minLength: 8, maxLength: 8 }).filter(s => /^\d+$/.test(s)),
                        pin: fc.string({ minLength: 4, maxLength: 4 }).filter(s => /^\d+$/.test(s)),
                        name: fc.constant(null)
                    }),
                    // Invalid phone format (not 8 digits)
                    fc.record({
                        phoneNumber: fc.string({ minLength: 1, maxLength: 20 }).filter(s => !/^\d{8}$/.test(s)),
                        pin: fc.string({ minLength: 4, maxLength: 4 }).filter(s => /^\d+$/.test(s)),
                        name: fc.string({ minLength: 1 })
                    }),
                    // Invalid PIN format (not 4 digits)
                    fc.record({
                        phoneNumber: fc.string({ minLength: 8, maxLength: 8 }).filter(s => /^\d+$/.test(s)),
                        pin: fc.string({ minLength: 1, maxLength: 10 }).filter(s => !/^\d{4}$/.test(s)),
                        name: fc.string({ minLength: 1 })
                    })
                ),
                async (userData) => {
                    // Reset mocks
                    prisma.user.findUnique.mockResolvedValue(null);
                    
                    try {
                        await authService.register(userData);
                        return false; // Should not succeed
                    } catch (error) {
                        // Should throw validation error with 400 status
                        return error.statusCode === 400 && (
                            error.message.includes('required') || 
                            error.message.includes('Invalid') || 
                            error.message.includes('format')
                        );
                    }
                }
            ),
            { numRuns: 5 }
        );
    });

    // **Feature: ecommerce-api, Property 5: PIN encryption with bcrypt**
    // Task 3.3: Property test for PIN encryption
    test('Property 5: PIN encryption with bcrypt', async () => {
        fc.assert(
            fc.asyncProperty(
                fc.string({ minLength: 4, maxLength: 4 }).filter(s => /^\d+$/.test(s)), // 4 digit PIN
                async (pin) => {
                    // Hash the PIN using actual hashPin function (not mocked)
                    const hashedPin = await hashPin(pin);

                    // Verify it's a bcrypt hash (starts with $2a$, $2b$, or $2y$ and has proper format)
                    const isBcryptHash = /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/.test(hashedPin);

                    // Verify it's not the plain PIN
                    const isNotPlainText = hashedPin !== pin;

                    // Verify it can be compared correctly using actual comparePin function
                    const compareResult = await comparePin(pin, hashedPin);

                    return isBcryptHash && isNotPlainText && compareResult === true;
                }
            ),
            { numRuns: 5 }
        );
    });

    // **Feature: ecommerce-api, Property 6: Valid login credentials authentication**
    // Task 4.4: Property test for login authentication
    test('Property 6: Valid login credentials authentication', async () => {
        fc.assert(
            fc.asyncProperty(
                fc.string({ minLength: 8, maxLength: 8 }).filter(s => /^\d+$/.test(s)), // 8 digit phone
                fc.string({ minLength: 4, maxLength: 4 }).filter(s => /^\d+$/.test(s)), // 4 digit PIN
                fc.string({ minLength: 1 }), // Name
                async (phoneNumber, pin, name) => {
                    // Mock: User exists in database with properly hashed PIN
                    const hashedPin = await hashPin(pin); // Use actual hashPin function
                    const mockUser = {
                        id: 1,
                        phoneNumber,
                        pin: hashedPin,
                        name,
                        role: 'USER'
                    };

                    prisma.user.findUnique.mockResolvedValue(mockUser);

                    // Attempt login (will use actual comparePin function internally)
                    const result = await authService.login({ phoneNumber, pin });

                    // Should return user and token
                    return result.user && result.token && 
                           result.user.phoneNumber === phoneNumber &&
                           result.user.name === name &&
                           !result.user.pin; // PIN should not be in response
                }
            ),
            { numRuns: 5 }
        );
    });

    // **Feature: ecommerce-api, Property 7: Invalid credentials rejection**
    // Task 4.5: Property test for invalid credentials
    test('Property 7: Invalid credentials rejection', async () => {
        fc.assert(
            fc.asyncProperty(
                // Generate test cases: wrong phone, wrong PIN
                fc.oneof(
                    // User doesn't exist
                    fc.record({
                        phoneNumber: fc.string({ minLength: 8, maxLength: 8 }).filter(s => /^\d+$/.test(s)),
                        pin: fc.string({ minLength: 4, maxLength: 4 }).filter(s => /^\d+$/.test(s)),
                        userExists: fc.constant(false)
                    }),
                    // Wrong PIN
                    fc.record({
                        phoneNumber: fc.string({ minLength: 8, maxLength: 8 }).filter(s => /^\d+$/.test(s)),
                        pin: fc.string({ minLength: 4, maxLength: 4 }).filter(s => /^\d+$/.test(s)),
                        correctPin: fc.string({ minLength: 4, maxLength: 4 }).filter(s => /^\d+$/.test(s)),
                        userExists: fc.constant(true)
                    }).filter(data => data.pin !== data.correctPin)
                ),
                async (testCase) => {
                    try {
                        if (!testCase.userExists) {
                            // User doesn't exist
                            prisma.user.findUnique.mockResolvedValue(null);
                        } else {
                            // User exists but wrong PIN - hash the correct PIN
                            const hashedCorrectPin = await hashPin(testCase.correctPin);
                            prisma.user.findUnique.mockResolvedValue({
                                id: 1,
                                phoneNumber: testCase.phoneNumber,
                                pin: hashedCorrectPin,
                                name: 'Test User',
                                role: 'USER'
                            });
                        }

                        // Attempt login should fail
                        await authService.login({ 
                            phoneNumber: testCase.phoneNumber, 
                            pin: testCase.pin
                        });
                        
                        return false; // Should not succeed
                    } catch (error) {
                        // Should throw authentication error with 401 status
                        return error.statusCode === 401 && 
                               error.message.includes('Invalid credentials');
                    }
                }
            ),
            { numRuns: 5 }
        );
    });
});

