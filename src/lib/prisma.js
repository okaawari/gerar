// Simple, non-blocking Prisma setup
require('dotenv').config();
const { PrismaClient } = require("@prisma/client");

let adapter = null;

try {
    const dbUrl = process.env.DATABASE_URL;
    
    if (dbUrl) {
        const urlMatch = dbUrl.match(/^mysql:\/\/([^:]+):([^@]*)@([^:]+):(\d+)\/(.+)$/);
        
        if (urlMatch) {
            try {
                // Try to load adapter (might not be installed)
                const { PrismaMariaDb } = require("@prisma/adapter-mariadb");
                const [, user, password, host, port, database] = urlMatch;
                
                adapter = new PrismaMariaDb({
                    host: host,
                    port: parseInt(port, 10),
                    user: user || undefined,
                    password: password || undefined,
                    database: database,
                });
            } catch (adapterError) {
                // Adapter not available or failed - use default
                // PrismaClient will use default adapter
            }
        }
    }
} catch (error) {
    // Ignore - will use default PrismaClient
}

// Create PrismaClient - this is fast and non-blocking
// It doesn't connect until you call $connect() or make a query
const prisma = adapter 
    ? new PrismaClient({ adapter })
    : new PrismaClient();

module.exports = prisma;
