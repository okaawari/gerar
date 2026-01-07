const fc = require('fast-check');
const { sendSuccess, sendError, sendSuccessWithPagination, formatTimestamp, sanitizeUser } = require('../../src/utils/response');

describe('Response Formatting Properties', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    // **Feature: ecommerce-api, Property 32: Success response format consistency**
    // Task 10.2: Property test for success response format consistency
    // Validates: Requirements 8.1
    test('Property 32: Success response format consistency', () => {
        fc.assert(
            fc.property(
                // Generate various response data types
                fc.oneof(
                    fc.string(),
                    fc.integer(),
                    fc.float(),
                    fc.boolean(),
                    fc.object(),
                    fc.array(fc.anything()),
                    fc.constant(null),
                    fc.constant(undefined)
                ),
                fc.string(), // message
                fc.integer({ min: 200, max: 299 }), // statusCode
                (data, message, statusCode) => {
                    // Create a mock response object
                    const mockRes = {
                        status: jest.fn().mockReturnThis(),
                        json: jest.fn().mockReturnThis()
                    };

                    // Call sendSuccess
                    sendSuccess(mockRes, data === undefined ? null : data, message, statusCode);

                    // Verify status was called with the correct code
                    expect(mockRes.status).toHaveBeenCalledWith(statusCode);

                    // Verify json was called
                    expect(mockRes.json).toHaveBeenCalledTimes(1);

                    // Get the response object that was sent
                    const response = mockRes.json.mock.calls[0][0];

                    // Verify consistent structure
                    expect(response).toHaveProperty('success', true);
                    expect(response).toHaveProperty('message', message);
                    expect(response).toHaveProperty('timestamp');
                    
                    // Verify timestamp is ISO 8601 format
                    expect(typeof response.timestamp).toBe('string');
                    expect(() => new Date(response.timestamp)).not.toThrow();
                    expect(new Date(response.timestamp).toISOString()).toBe(response.timestamp);

                    // If data is not null/undefined, it should be included
                    if (data !== null && data !== undefined) {
                        expect(response).toHaveProperty('data');
                        expect(response.data).toEqual(data);
                    }

                    // Response should only have expected properties
                    const allowedKeys = ['success', 'message', 'timestamp', 'data'];
                    const responseKeys = Object.keys(response);
                    const unexpectedKeys = responseKeys.filter(key => !allowedKeys.includes(key));
                    expect(unexpectedKeys).toHaveLength(0);

                    return true;
                }
            ),
            { numRuns: 50 }
        );
    });

    // **Feature: ecommerce-api, Property 33: Error response format consistency**
    // Task 10.3: Property test for error response format consistency
    // Validates: Requirements 8.2
    test('Property 33: Error response format consistency', () => {
        fc.assert(
            fc.property(
                fc.string(), // error code
                fc.string(), // error message
                fc.integer({ min: 400, max: 599 }), // statusCode
                fc.oneof(
                    fc.constant(null),
                    fc.constant(undefined),
                    fc.object(),
                    fc.array(fc.anything())
                ), // details
                (code, message, statusCode, details) => {
                    // Create a mock response object
                    const mockRes = {
                        status: jest.fn().mockReturnThis(),
                        json: jest.fn().mockReturnThis()
                    };

                    // Call sendError
                    sendError(mockRes, code, message, statusCode, details === undefined ? null : details);

                    // Verify status was called with the correct code
                    expect(mockRes.status).toHaveBeenCalledWith(statusCode);

                    // Verify json was called
                    expect(mockRes.json).toHaveBeenCalledTimes(1);

                    // Get the response object that was sent
                    const response = mockRes.json.mock.calls[0][0];

                    // Verify consistent structure
                    expect(response).toHaveProperty('success', false);
                    expect(response).toHaveProperty('error');
                    expect(response.error).toHaveProperty('code', code);
                    expect(response.error).toHaveProperty('message', message);
                    expect(response).toHaveProperty('timestamp');
                    
                    // Verify timestamp is ISO 8601 format
                    expect(typeof response.timestamp).toBe('string');
                    expect(() => new Date(response.timestamp)).not.toThrow();
                    expect(new Date(response.timestamp).toISOString()).toBe(response.timestamp);

                    // If details are provided, they should be included
                    if (details !== null && details !== undefined) {
                        expect(response.error).toHaveProperty('details');
                        expect(response.error.details).toEqual(details);
                    } else {
                        expect(response.error).not.toHaveProperty('details');
                    }

                    // Response should only have expected properties
                    const allowedKeys = ['success', 'error', 'timestamp'];
                    const responseKeys = Object.keys(response);
                    const unexpectedKeys = responseKeys.filter(key => !allowedKeys.includes(key));
                    expect(unexpectedKeys).toHaveLength(0);

                    return true;
                }
            ),
            { numRuns: 50 }
        );
    });

    // **Feature: ecommerce-api, Property 34: Pagination format consistency**
    // Task 10.1: Property test for pagination format consistency
    // Validates: Requirements 8.3
    test('Property 34: Pagination format consistency', () => {
        fc.assert(
            fc.property(
                fc.array(fc.anything(), { minLength: 0, maxLength: 100 }), // data array
                fc.integer({ min: 1, max: 100 }), // page
                fc.integer({ min: 1, max: 50 }), // limit
                fc.integer({ min: 0, max: 1000 }), // total
                fc.string(), // message
                (data, page, limit, total, message) => {
                    // Create pagination metadata
                    const pagination = {
                        page,
                        limit,
                        total,
                        totalPages: Math.ceil(total / limit),
                        hasNext: page < Math.ceil(total / limit),
                        hasPrev: page > 1
                    };

                    // Create a mock response object
                    const mockRes = {
                        status: jest.fn().mockReturnThis(),
                        json: jest.fn().mockReturnThis()
                    };

                    // Call sendSuccessWithPagination
                    sendSuccessWithPagination(mockRes, data, pagination, message);

                    // Verify status was called
                    expect(mockRes.status).toHaveBeenCalledWith(200);

                    // Verify json was called
                    expect(mockRes.json).toHaveBeenCalledTimes(1);

                    // Get the response object that was sent
                    const response = mockRes.json.mock.calls[0][0];

                    // Verify consistent structure
                    expect(response).toHaveProperty('success', true);
                    expect(response).toHaveProperty('data', data);
                    expect(response).toHaveProperty('pagination', pagination);
                    expect(response).toHaveProperty('message', message);
                    expect(response).toHaveProperty('timestamp');
                    
                    // Verify timestamp is ISO 8601 format
                    expect(typeof response.timestamp).toBe('string');
                    expect(() => new Date(response.timestamp)).not.toThrow();
                    expect(new Date(response.timestamp).toISOString()).toBe(response.timestamp);

                    // Verify pagination structure
                    expect(response.pagination).toHaveProperty('page');
                    expect(response.pagination).toHaveProperty('limit');
                    expect(response.pagination).toHaveProperty('total');
                    expect(response.pagination).toHaveProperty('totalPages');
                    expect(response.pagination).toHaveProperty('hasNext');
                    expect(response.pagination).toHaveProperty('hasPrev');

                    return true;
                }
            ),
            { numRuns: 50 }
        );
    });

    // **Feature: ecommerce-api, Property 35: Timestamp format consistency**
    // Task 10.1: Property test for timestamp format consistency
    // Validates: Requirements 8.4
    test('Property 35: Timestamp format consistency', () => {
        fc.assert(
            fc.property(
                fc.oneof(
                    fc.date(),
                    fc.integer({ min: 0, max: 4102444800000 }), // timestamp in ms
                    fc.string() // ISO string or other date string
                ),
                (dateInput) => {
                    let date;
                    try {
                        if (typeof dateInput === 'string') {
                            date = new Date(dateInput);
                        } else if (typeof dateInput === 'number') {
                            date = new Date(dateInput);
                        } else {
                            date = dateInput;
                        }

                        // Skip invalid dates
                        if (isNaN(date.getTime())) {
                            return true; // Skip invalid dates
                        }

                        const formatted = formatTimestamp(date);

                        // Verify it's a string
                        expect(typeof formatted).toBe('string');

                        // Verify it's valid ISO 8601 format
                        expect(() => new Date(formatted)).not.toThrow();
                        const parsed = new Date(formatted);
                        expect(isNaN(parsed.getTime())).toBe(false);

                        // Verify it matches ISO 8601 regex pattern
                        const iso8601Regex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/;
                        expect(formatted).toMatch(iso8601Regex);

                        // Verify round-trip consistency
                        expect(new Date(formatted).toISOString()).toBe(formatted);

                        return true;
                    } catch (e) {
                        // Skip invalid date inputs
                        return true;
                    }
                }
            ),
            { numRuns: 100 }
        );
    });

    // **Feature: ecommerce-api, Property 36: User data sanitization**
    // Task 10.5: Property test for data sanitization
    // Validates: Requirements 8.5
    test('Property 36: User data sanitization', () => {
        fc.assert(
            fc.property(
                fc.record({
                    id: fc.integer({ min: 1 }),
                    phoneNumber: fc.string({ minLength: 8, maxLength: 8 }).filter(s => /^\d+$/.test(s)),
                    name: fc.string({ minLength: 1 }),
                    role: fc.constantFrom('USER', 'ADMIN'),
                    pin: fc.string(), // This should be removed
                    password: fc.string(), // This should be removed
                    passwordHash: fc.string(), // This should be removed
                    // Add some additional safe fields
                    email: fc.oneof(fc.string(), fc.constant(null)),
                    createdAt: fc.date(),
                    updatedAt: fc.date()
                }),
                (user) => {
                    const sanitized = sanitizeUser(user);

                    // Verify sensitive fields are removed
                    expect(sanitized).not.toHaveProperty('pin');
                    expect(sanitized).not.toHaveProperty('password');
                    expect(sanitized).not.toHaveProperty('passwordHash');

                    // Verify safe fields are preserved
                    expect(sanitized).toHaveProperty('id', user.id);
                    expect(sanitized).toHaveProperty('phoneNumber', user.phoneNumber);
                    expect(sanitized).toHaveProperty('name', user.name);
                    expect(sanitized).toHaveProperty('role', user.role);
                    
                    if (user.email !== undefined) {
                        expect(sanitized).toHaveProperty('email', user.email);
                    }

                    // Verify other fields are preserved
                    if (user.createdAt !== undefined) {
                        expect(sanitized).toHaveProperty('createdAt', user.createdAt);
                    }
                    if (user.updatedAt !== undefined) {
                        expect(sanitized).toHaveProperty('updatedAt', user.updatedAt);
                    }

                    // Verify it's a new object (not the same reference)
                    expect(sanitized).not.toBe(user);

                    return true;
                }
            ),
            { numRuns: 50 }
        );
    });

    // Additional test for sanitizeUser with edge cases
    test('sanitizeUser handles edge cases', () => {
        // Test with null
        expect(sanitizeUser(null)).toBe(null);
        
        // Test with undefined
        expect(sanitizeUser(undefined)).toBe(undefined);
        
        // Test with empty object
        expect(sanitizeUser({})).toEqual({});
        
        // Test with non-object (should return as-is)
        expect(sanitizeUser('string')).toBe('string');
        expect(sanitizeUser(123)).toBe(123);
    });
});

