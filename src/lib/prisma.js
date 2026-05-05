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
  host: process.env.DB_HOST ? process.env.DB_HOST.trim() : undefined,
  port: process.env.DB_PORT ? parseInt(process.env.DB_PORT.trim(), 10) : 3306,
  user: process.env.DB_USER ? process.env.DB_USER.trim() : undefined,
  password: process.env.DB_PASSWORD ? process.env.DB_PASSWORD.trim() : undefined,
  database: process.env.DB_NAME ? process.env.DB_NAME.trim() : undefined,
  // This is the fix for the RSA/PublicKey error
  allowPublicKeyRetrieval: true,
  connectionLimit: 10,
  connectTimeout: 10000 // 10 seconds
};

// Debug logging for server troubleshooting
if (process.env.NODE_ENV !== 'test') {
  console.log('--- Database Connection Attempt ---');
  console.log(`Host: "${config.host}"`);
  console.log(`Port: ${config.port}`);
  console.log(`User: "${config.user}"`);
  console.log(`Database: "${config.database}"`);
  console.log('---------------------------------');
  
  if (!config.host) {
    console.error('❌ CRITICAL ERROR: DB_HOST is missing!');
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
const pool = mariadb.createPool({
  host: config.host,
  port: config.port,
  user: config.user,
  password: config.password,
  database: config.database,
  allowPublicKeyRetrieval: config.allowPublicKeyRetrieval,
  connectionLimit: config.connectionLimit,
  connectTimeout: config.connectTimeout
});

// 2. RAW CONNECTION TEST (Before Prisma starts)
if (process.env.NODE_ENV !== 'test') {
  pool.getConnection()
    .then(conn => {
      console.log('✅ RAW CONNECTION TEST: SUCCESS!');
      conn.release();
    })
    .catch(err => {
      console.error('❌ RAW CONNECTION TEST: FAILED');
      console.error('Error Code:', err.code);
      console.error('Error Message:', err.message);
      console.error('Raw Error:', err);
    });
}

// 3. Initialize the adapter with that pool
const adapter = new PrismaMariaDb(pool);

// 4. Create the Prisma instance using the adapter
const prisma = new PrismaClient({ adapter });

module.exports = prisma;
