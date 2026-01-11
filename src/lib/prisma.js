require('dotenv').config();
const { PrismaClient } = require("@prisma/client");
const { PrismaMariaDb } = require("@prisma/adapter-mariadb");

let prisma;

try {
    // Parse DATABASE_URL: mysql://user:password@host:port/database
    const dbUrl = process.env.DATABASE_URL;

    if (!dbUrl) {
        process.stderr.write('\n⚠️ DATABASE_URL not set - creating Prisma without adapter\n');
        // Create Prisma without adapter - will fail on use but won't block startup
        prisma = new PrismaClient();
    } else {
        const urlMatch = dbUrl.match(/^mysql:\/\/([^:]+):([^@]*)@([^:]+):(\d+)\/(.+)$/);

        if (!urlMatch) {
            process.stderr.write('\n⚠️ Invalid DATABASE_URL format - creating Prisma without adapter\n');
            process.stderr.write('Expected: mysql://user:password@host:port/database\n');
            // Create Prisma without adapter - will fail on use but won't block startup
            prisma = new PrismaClient();
        } else {
            const [, user, password, host, port, database] = urlMatch;

            const adapter = new PrismaMariaDb({
                host: host,
                port: parseInt(port, 10),
                user: user || undefined,
                password: password || undefined,
                database: database,
            });

            prisma = new PrismaClient({ adapter });
        }
    }
} catch (error) {
    process.stderr.write('\n❌ Error initializing Prisma: ' + error.message + '\n');
    // Create basic Prisma client as fallback - won't work but won't block startup
    prisma = new PrismaClient();
}

module.exports = prisma;
