const path = require('path');
const fs = require('fs');

// ONLY load dotenv if the environment variables are missing (likely local dev)
// If you are on Coolify, it should already have these in process.env
if (!process.env.DB_HOST) {
    const envPath = path.join(__dirname, '..', '..', '.env');
    if (fs.existsSync(envPath)) {
        require('dotenv').config({ path: envPath });
    }
}
const { PrismaClient } = require('@prisma/client');
const { PrismaMariaDb } = require('@prisma/adapter-mariadb');
const mariadb = require('mariadb');

/**
 * Prisma Client initialization with MariaDB Driver Adapter
 * 
 * Using a manual connection pool bypasses DATABASE_URL parsing issues 
 * and allows explicit configuration like allowPublicKeyRetrieval: true
 * which is often required for MariaDB/MySQL 8+ connections.
 */

const config = {
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT, 10),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  // This is the fix for the RSA/PublicKey error
  allowPublicKeyRetrieval: true,
  connectionLimit: 10
};

// Debug logging for server troubleshooting
if (process.env.NODE_ENV !== 'test') {
  console.log(`[Database Config] Host: ${config.host}, Port: ${config.port}, User: ${config.user}, DB: ${config.database}`);
  if (!config.host || config.host === 'localhost') {
    console.warn('⚠️ WARNING: DB_HOST is "localhost" or undefined. If you are on a server, check your environment variables!');
  }
}

// Fallback: If individual variables are missing, parse DATABASE_URL
// This ensures local development works with existing .env files
if (!process.env.DB_USER || !process.env.DB_NAME) {
  const dbUrl = process.env.DATABASE_URL;
  if (dbUrl) {
    // Parse DATABASE_URL: mysql://user:password@host:port/database
    const urlMatch = dbUrl.match(/^mysql:\/\/([^:]+):([^@]*)@([^:]+):(\d+)\/(.+)$/);
    if (urlMatch) {
      const [, user, password, host, port, database] = urlMatch;
      config.user = config.user || user;
      config.password = config.password || (password === '' ? undefined : password);
      config.host = config.host || host;
      config.port = config.port || parseInt(port, 10);
      config.database = config.database || database;
    }
  }
}

// 1. Setup the MariaDB connection pool manually
const pool = mariadb.createPool(config);

// 2. Initialize the adapter with that pool
const adapter = new PrismaMariaDb(pool);

// 3. Create the Prisma instance using the adapter
const prisma = new PrismaClient({ adapter });

module.exports = prisma;
