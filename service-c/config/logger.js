// Configures Pino to write structured log entries to the MongoDB logs collection.
require('dotenv').config();
const pino = require('pino');

// Use pino's worker-thread transport to write each log entry as a MongoDB document.
// pino-mongodb opens its own connection separate from Mongoose — this is expected.
const transport = pino.transport({
    target: 'pino-mongodb',
    options: {
        uri: process.env.MONGODB_URI,
        database: process.env.DB_NAME,
        // All four services write to the same 'logs' collection in Atlas
        collection: 'logs'
    }
});

// Create the logger instance with the MongoDB transport as destination
const logger = pino({ level: 'info' }, transport);

module.exports = logger;
