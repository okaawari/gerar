/**
 * Database configuration
 */

// Use the same Prisma instance that services use
const prisma = require('../lib/prisma');

// Handle Prisma client connection
const connectDatabase = async () => {
    try {
        await prisma.$connect();
        console.log('Database connected successfully');
    } catch (error) {
        console.error('Database connection failed:', error);
        process.exit(1);
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