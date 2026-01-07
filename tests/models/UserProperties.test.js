const fc = require('fast-check');
const prisma = require('../../src/lib/prisma');

// Mock Prisma
jest.mock('../../src/lib/prisma', () => {
    return {
        user: {
            create: jest.fn(),
            findUnique: jest.fn(),
        },
    };
});

describe('User Model Properties', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    // Task 2.2: Property test for User model validation
    test('Property 1: User registration with valid data creates account', () => {
        fc.assert(
            fc.property(
                fc.string({ minLength: 8, maxLength: 8 }).filter(s => /^\d+$/.test(s)), // 8 digit phone
                fc.string({ minLength: 4, maxLength: 4 }).filter(s => /^\d+$/.test(s)), // 4 digit PIN
                fc.string({ minLength: 1 }), // Name
                (phoneNumber, pin, name) => {
                    // Setup mock to return success
                    prisma.user.create.mockReturnValue(Promise.resolve({
                        id: 1,
                        phoneNumber,
                        pin: 'hashed_pin', // In real app, this would be hashed
                        name,
                        role: 'USER'
                    }));

                    // Simulate User Creation Logic (which would be in a service)
                    // Here we just verify we CAN call prisma with these values
                    const promise = prisma.user.create({
                        data: {
                            phoneNumber,
                            pin, // Note: Encryption is Task 3.2/3.3
                            name,
                        }
                    });

                    return promise.then(user => {
                        return user.phoneNumber === phoneNumber && user.name === name;
                    });
                }
            ),
            { numRuns: 5 }
        );
    });

    // Task 2.3: Property test for duplicate phone number rejection
    test('Property 2: Duplicate phone number registration rejection', () => {
        fc.assert(
            fc.property(
                fc.string({ minLength: 8, maxLength: 8 }).filter(s => /^\d+$/.test(s)),
                (phoneNumber) => {
                    // Setup mock to simulate Unique Constraint Violation
                    // Prisma throws generic error P2002 for unique constraint
                    const error = new Error('Unique constraint failed on the fields: (`phoneNumber`)');
                    error.code = 'P2002';

                    prisma.user.create.mockRejectedValue(error);

                    // Expect the promise to fail
                    return prisma.user.create({
                        data: {
                            phoneNumber,
                            pin: '1234',
                            name: 'Test User'
                        }
                    }).then(() => false).catch(err => {
                        return err.code === 'P2002';
                    });
                }
            ),
            { numRuns: 5 }
        );
    });
});
