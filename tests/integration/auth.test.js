const authService = require('../../src/services/authService');
const prisma = require('../../src/lib/prisma');
const { hashPin, comparePin } = require('../../src/utils/hashUtils');
const { generateToken, verifyToken } = require('../../src/utils/jwtUtils');

// Mock Prisma
jest.mock('../../src/lib/prisma', () => ({
    user: {
        create: jest.fn(),
        findUnique: jest.fn(),
    }
}));

describe('Authentication Integration Test', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('Complete authentication flow: Register and Login', async () => {
        // Test data
        const phoneNumber = '12345678';
        const pin = '1234';
        const name = 'Test User';

        // 1. Test Registration
        const hashedPin = await hashPin(pin);
        
        // Mock: User doesn't exist yet
        prisma.user.findUnique.mockResolvedValueOnce(null);
        
        // Mock: User creation succeeds
        const createdUser = {
            id: 1,
            phoneNumber,
            pin: hashedPin,
            name,
            role: 'USER'
        };
        prisma.user.create.mockResolvedValueOnce(createdUser);

        // Register user
        const registerResult = await authService.register({ phoneNumber, pin, name });

        // Verify registration
        expect(registerResult.user).toBeDefined();
        expect(registerResult.user.phoneNumber).toBe(phoneNumber);
        expect(registerResult.user.name).toBe(name);
        expect(registerResult.user.id).toBe(1);
        expect(registerResult.user.pin).toBeUndefined(); // PIN should not be in response
        expect(registerResult.token).toBeDefined();
        
        // Verify PIN was hashed
        expect(createdUser.pin).not.toBe(pin);
        expect(await comparePin(pin, createdUser.pin)).toBe(true);

        // Verify JWT token is valid
        const decodedToken = verifyToken(registerResult.token);
        expect(decodedToken.id).toBe(1);
        expect(decodedToken.phoneNumber).toBe(phoneNumber);
        expect(decodedToken.role).toBe('USER');

        // 2. Test Login with valid credentials
        // Mock: User exists
        prisma.user.findUnique.mockResolvedValueOnce(createdUser);

        // Login user
        const loginResult = await authService.login({ phoneNumber, pin });

        // Verify login
        expect(loginResult.user).toBeDefined();
        expect(loginResult.user.phoneNumber).toBe(phoneNumber);
        expect(loginResult.user.name).toBe(name);
        expect(loginResult.user.pin).toBeUndefined(); // PIN should not be in response
        expect(loginResult.token).toBeDefined();

        // Verify JWT token is valid
        const decodedLoginToken = verifyToken(loginResult.token);
        expect(decodedLoginToken.id).toBe(1);
        expect(decodedLoginToken.phoneNumber).toBe(phoneNumber);
    });

    test('Login with invalid credentials should fail', async () => {
        const phoneNumber = '12345678';
        const wrongPin = '9999';
        const correctPin = '1234';

        // Mock: User exists with correct PIN
        const hashedCorrectPin = await hashPin(correctPin);
        const user = {
            id: 1,
            phoneNumber,
            pin: hashedCorrectPin,
            name: 'Test User',
            role: 'USER'
        };
        prisma.user.findUnique.mockResolvedValueOnce(user);

        // Try to login with wrong PIN
        await expect(authService.login({ phoneNumber, pin: wrongPin })).rejects.toThrow();
        
        try {
            await authService.login({ phoneNumber, pin: wrongPin });
        } catch (error) {
            expect(error.statusCode).toBe(401);
            expect(error.message).toContain('Invalid credentials');
        }
    });

    test('Register with duplicate phone number should fail', async () => {
        const phoneNumber = '12345678';
        const pin = '1234';
        const name = 'Test User';

        // Mock: User already exists
        const existingUser = {
            id: 1,
            phoneNumber,
            pin: await hashPin(pin),
            name: 'Existing User',
            role: 'USER'
        };
        prisma.user.findUnique.mockResolvedValueOnce(existingUser);

        // Try to register with same phone number
        try {
            await authService.register({ phoneNumber, pin, name });
            // Should not reach here
            expect(true).toBe(false);
        } catch (error) {
            expect(error.statusCode).toBe(409);
            expect(error.message).toContain('already exists');
        }
    });
});

