require('dotenv').config();
const { PrismaClient } = require("@prisma/client");
const { PrismaMariaDb } = require("@prisma/adapter-mariadb");

// Parse DATABASE_URL: mysql://user:password@host:port/database
const dbUrl = process.env.DATABASE_URL;

if (!dbUrl) {
  throw new Error('DATABASE_URL environment variable is not set');
}

const urlMatch = dbUrl.match(/^mysql:\/\/([^:]+):([^@]*)@([^:]+):(\d+)\/(.+)$/);

if (!urlMatch) {
  throw new Error('Invalid DATABASE_URL format. Expected: mysql://user:password@host:port/database');
}

const [, user, password, host, port, database] = urlMatch;

const adapter = new PrismaMariaDb({
  host: host,
  port: parseInt(port, 10),
  user: user || undefined,
  password: password || undefined,
  database: database,
});

const prisma = new PrismaClient({ adapter });

module.exports = prisma;