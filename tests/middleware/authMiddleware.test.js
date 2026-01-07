const fc = require('fast-check');

// Mock dependencies before importing
jest.mock('../../src/utils/jwtUtils', () => ({
    verifyToken: jest.fn()
}));

jest.mock('../../src/lib/prisma', () => ({
    user: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
    }
}));

const { authenticateUser } = require('../../src/middleware/authMiddleware');
const { verifyToken } = require('../../src/utils/jwtUtils');
const prisma = require('../../src/lib/prisma');

describe('Authentication Middleware Properties', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    // **Feature: ecommerce-api, Property 8: JWT token validation and user extraction**
    // Task 3.5: Property test for JWT validation
    test('Property 8: JWT token validation and user extraction', async () => {
        fc.assert(
            fc.asyncProperty(
                fc.record({
                    userId: fc.integer({ min: 1, max: 1000000 }),
                    phoneNumber: fc.string({ minLength: 8, maxLength: 8 }).filter(s => /^\d+$/.test(s)),
                    name: fc.string({ minLength: 1, maxLength: 100 }),
                    role: fc.constantFrom('USER', 'ADMIN')
                }),
                async (userData) => {
                    const mockToken = 'valid_token';
                    const mockReq = {
                        headers: {
                            authorization: `Bearer ${mockToken}`
                        },
                        user: null
                    };
                    const mockRes = {};
                    const mockNext = jest.fn();

                    // Reset mocks
                    verifyToken.mockClear();
                    prisma.user.findUnique.mockClear();
                    mockNext.mockClear();

                    // Mock JWT verification
                    verifyToken.mockReturnValue({
                        id: userData.userId,
                        phoneNumber: userData.phoneNumber,
                        role: userData.role
                    });

                    // Mock user lookup
                    prisma.user.findUnique.mockResolvedValue({
                        id: userData.userId,
                        phoneNumber: userData.phoneNumber,
                        name: userData.name,
                        role: userData.role
                    });

                    // Call middleware
                    await authenticateUser(mockReq, mockRes, mockNext);

                    // Verify token was verified
                    expect(verifyToken).toHaveBeenCalledWith(mockToken);
                    
                    // Verify user was looked up
                    expect(prisma.user.findUnique).toHaveBeenCalledWith({
                        where: { id: userData.userId },
                        select: { id: true, phoneNumber: true, name: true, role: true }
                    });

                    // Verify user was attached to request
                    expect(mockReq.user).toEqual({
                        id: userData.userId,
                        phoneNumber: userData.phoneNumber,
                        name: userData.name,
                        role: userData.role
                    });

                    // Verify next was called (no error)
                    expect(mockNext).toHaveBeenCalledWith();
                    
                    return true;
                }
            ),
            { numRuns: 5 }
        );
    });

    test('Property 9: Invalid JWT token rejection', async () => {
        fc.assert(
            fc.asyncProperty(
                fc.oneof(
                    // No authorization header
                    fc.constant(null),
                    // Invalid format
                    fc.string({ minLength: 1 }).filter(s => !s.startsWith('Bearer ')),
                    // Invalid token
                    fc.constant('Bearer invalid_token')
                ),
                async (authHeader) => {
                    const mockReq = {
                        headers: {
                            authorization: authHeader
                        }
                    };
                    const mockRes = {};
                    const mockNext = jest.fn();

                    // Reset mocks
                    verifyToken.mockClear();
                    mockNext.mockClear();

                    if (authHeader && authHeader.startsWith('Bearer ')) {
                        // Mock invalid token
                        verifyToken.mockImplementation(() => {
                            throw new Error('Invalid token');
                        });
                    }

                    await authenticateUser(mockReq, mockRes, mockNext);

                    // Should call next with error
                    expect(mockNext).toHaveBeenCalled();
                    const errorCall = mockNext.mock.calls[0] && mockNext.mock.calls[0][0];
                    return errorCall && errorCall.statusCode === 401;
                }
            ),
            { numRuns: 5 }
        );
    });
});

