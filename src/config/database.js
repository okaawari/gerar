/**
 * Database configuration
 */

// Use the same Prisma instance that services use
const prisma = require('../lib/prisma');

// Handle Prisma client connection
const connectDatabase = async () => {
    try {
        await prisma.$connect();
        console.log('✅ Database connected successfully');
        // Test query to ensure it works
        await prisma.$queryRaw`SELECT 1`;
        console.log('✅ Database query test successful');
    } catch (error) {
        // Write to stderr so Passenger captures it
        process.stderr.write('\n❌ DATABASE CONNECTION FAILED\n');
        process.stderr.write('Error: ' + error.message + '\n');
        if (error.stack) {
            process.stderr.write('Stack: ' + error.stack + '\n');
        }
        process.stderr.write('\n');
        
        console.error('❌ Database connection failed:', error);
        
        // Don't exit in Passenger - let the app start and show errors on requests
        if (process.env.NODE_ENV === 'production' && (process.env.PASSENGER_APP_ENV || process.env.PASSENGER_APP_ROOT)) {
            process.stderr.write('⚠️ Running in Passenger - app will start but database operations will fail\n');
            console.error('⚠️ Running in Passenger - app will start but database operations will fail');
        } else {
            throw error; // Throw in development/standalone mode
        }
    }
};

// Handle graceful shutdown
const disconnectDatabase = async () => {
    try {
        await prisma.$disconnect();
        console.log('Database disconnected successfully');
    } catch (error) {
        console.error('Error disconnecting from database:', error);
    }
};

module.exports = {
    prisma,
    connectDatabase,
    disconnectDatabase
};