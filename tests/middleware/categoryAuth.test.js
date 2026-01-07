const fc = require('fast-check');

const { authorizeAdmin } = require('../../src/middleware/authMiddleware');

describe('Category Authorization Middleware Tests', () => {
    // **Feature: ecommerce-api, Property 21: Non-admin category management rejection**
    // Task 6.4: Property test for non-admin category rejection
    test('Property 21: Non-admin category management rejection', async () => {
        fc.assert(
            fc.asyncProperty(
                fc.record({
                    role: fc.constantFrom('USER'), // Only non-admin roles
                    hasUser: fc.constant(true) // User is authenticated but not admin
                }),
                async (testCase) => {
                    const mockReq = {
                        user: {
                            id: 1,
                            phoneNumber: '12345678',
                            name: 'Test User',
                            role: testCase.role
                        }
                    };
                    const mockRes = {};
                    const mockNext = jest.fn();

                    // Call authorizeAdmin middleware
                    authorizeAdmin(mockReq, mockRes, mockNext);

                    // Should call next with error (403 Forbidden)
                    expect(mockNext).toHaveBeenCalled();
                    const errorCall = mockNext.mock.calls[0] && mockNext.mock.calls[0][0];
                    
                    return errorCall && 
                           errorCall.statusCode === 403 && 
                           errorCall.message.includes('Access denied');
                }
            ),
            { numRuns: 5 }
        );
    });

    test('authorizeAdmin allows ADMIN users', () => {
        const mockReq = {
            user: {
                id: 1,
                phoneNumber: '12345678',
                name: 'Admin User',
                role: 'ADMIN'
            }
        };
        const mockRes = {};
        const mockNext = jest.fn();

        authorizeAdmin(mockReq, mockRes, mockNext);

        // Should call next without error
        expect(mockNext).toHaveBeenCalledWith();
    });

    test('authorizeAdmin rejects USER role', () => {
        const mockReq = {
            user: {
                id: 1,
                phoneNumber: '12345678',
                name: 'Regular User',
                role: 'USER'
            }
        };
        const mockRes = {};
        const mockNext = jest.fn();

        authorizeAdmin(mockReq, mockRes, mockNext);

        // Should call next with 403 error
        expect(mockNext).toHaveBeenCalled();
        const error = mockNext.mock.calls[0][0];
        expect(error.statusCode).toBe(403);
        expect(error.message).toContain('Access denied');
    });

    test('authorizeAdmin rejects when no user attached', () => {
        const mockReq = {}; // No user
        const mockRes = {};
        const mockNext = jest.fn();

        authorizeAdmin(mockReq, mockRes, mockNext);

        // Should call next with 403 error
        expect(mockNext).toHaveBeenCalled();
        const error = mockNext.mock.calls[0][0];
        expect(error.statusCode).toBe(403);
        expect(error.message).toContain('Access denied');
    });
});

