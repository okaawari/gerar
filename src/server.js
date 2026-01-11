// Log startup information immediately
console.log('🚀 Starting server.js...');
console.log('📁 Working directory:', process.cwd());
console.log('🔧 Node version:', process.version);

require('dotenv').config();

console.log('📦 Environment variables loaded');
console.log('🔐 NODE_ENV:', process.env.NODE_ENV || 'not set');

const { connectDatabase, disconnectDatabase } = require('./config/database');

console.log('✅ Database module loaded');

try {
    var app = require('./app');
    console.log('✅ app.js loaded successfully');
} catch (error) {
    // Write to stderr so Passenger captures it
    process.stderr.write('\n❌ FAILED TO LOAD app.js\n');
    process.stderr.write('Error: ' + (error.message || 'Unknown error') + '\n');
    if (error.stack) {
        process.stderr.write('Stack: ' + error.stack + '\n');
    }
    process.stderr.write('\n');
    
    console.error('❌ Failed to load app.js:', error);
    throw error;
}

const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Connect to database on startup
(async () => {
    try {
        console.log('🔄 Attempting database connection...');
        await connectDatabase();
        console.log('✅ Database connected');
    } catch (error) {
        // Write to stderr so Passenger captures it
        process.stderr.write('\n❌ DATABASE CONNECTION FAILED (async)\n');
        process.stderr.write('Error: ' + (error.message || 'Unknown error') + '\n');
        if (error.stack) {
            process.stderr.write('Stack: ' + error.stack + '\n');
        }
        process.stderr.write('\n');
        
        console.error('❌ Database connection failed:', error);
        // Don't exit - let the app start anyway (for Passenger)
    }
})();

// Check if running under Passenger
const isPassenger = process.env.PASSENGER_APP_ENV || process.env.PASSENGER_APP_ROOT;
console.log('🚌 Running under Passenger:', !!isPassenger);
if (isPassenger) {
    console.log('📋 Passenger env vars:', {
        PASSENGER_APP_ENV: process.env.PASSENGER_APP_ENV,
        PASSENGER_APP_ROOT: process.env.PASSENGER_APP_ROOT
    });
}

if (!isPassenger) {
    // Standalone mode - start HTTP server
    let server;
    
    const startServer = async () => {
        try {
            await connectDatabase();
            
            server = app.listen(PORT, () => {
                console.log('='.repeat(50));
                console.log(`✅ Server is running on port ${PORT}`);
                console.log(`📦 Environment: ${NODE_ENV}`);
                console.log(`🌐 API Base URL: http://localhost:${PORT}/api`);
                console.log(`📚 Health Check: http://localhost:${PORT}/`);
                console.log('='.repeat(50));
            });

            // Graceful shutdown handler
            const gracefulShutdown = async (signal) => {
                console.log(`\n${signal} received. Starting graceful shutdown...`);
                
                if (server) {
                    server.close(async () => {
                        console.log('HTTP server closed');
                        await disconnectDatabase();
                        console.log('Graceful shutdown completed');
                        process.exit(0);
                    });
                    
                    setTimeout(() => {
                        console.error('Forced shutdown after timeout');
                        process.exit(1);
                    }, 10000);
                } else {
                    await disconnectDatabase();
                    process.exit(0);
                }
            };

            process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
            process.on('SIGINT', () => gracefulShutdown('SIGINT'));

        } catch (error) {
            console.error('Failed to start server:', error);
            await disconnectDatabase();
            process.exit(1);
        }
    };

    startServer();
} else {
    // Passenger mode - just export the app, Passenger handles HTTP server
    console.log('✅ Running under Passenger');
    console.log(`📦 Environment: ${NODE_ENV}`);
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
    process.stderr.write('\n💥 UNHANDLED REJECTION!\n');
    process.stderr.write('Error: ' + (err.message || 'Unknown') + '\n');
    process.stderr.write('Name: ' + (err.name || 'Error') + '\n');
    if (err.stack) {
        process.stderr.write('Stack: ' + err.stack + '\n');
    }
    process.stderr.write('\n');
    
    console.error('UNHANDLED REJECTION! 💥', err);
});

// Handle uncaught exceptions
process.on('uncaughtException', async (err) => {
    process.stderr.write('\n💥 UNCAUGHT EXCEPTION!\n');
    process.stderr.write('Error: ' + (err.message || 'Unknown') + '\n');
    process.stderr.write('Name: ' + (err.name || 'Error') + '\n');
    if (err.stack) {
        process.stderr.write('Stack: ' + err.stack + '\n');
    }
    process.stderr.write('\n');
    
    console.error('UNCAUGHT EXCEPTION! 💥', err);
    await disconnectDatabase();
    process.exit(1);
});

// Export app for Passenger
module.exports = app;
