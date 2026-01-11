// ABSOLUTE MINIMUM - Load and export app immediately
// Everything else happens after Passenger gets the app
const app = require('./app');

// Export immediately - Passenger needs this NOW
module.exports = app;
