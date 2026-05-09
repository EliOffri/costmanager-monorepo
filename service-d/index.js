// Entry point for service-d — the About/Admin microservice.
require('dotenv').config();
const express = require('express');
const requestLogger = require('./middleware/requestLogger');
const aboutRouter = require('./routes/about.route');

// Create the Express application
const app = express();

// Parse incoming JSON request bodies
app.use(express.json());

// Log every HTTP request before it reaches a route handler
app.use(requestLogger);

// Mount the about router under the /api prefix
app.use('/api', aboutRouter);

// Central error handler — formats all errors as the required JSON structure.
// Must have exactly four parameters for Express to treat it as an error handler.
app.use((err, req, res, next) => {
    res.status(err.status || 500).json({
        id: err.code || 'INTERNAL_ERROR',
        message: err.message || 'An unexpected error occurred'
    });
});

// Start listening — this service has no DB dependency so no connectDB call is needed.
// Pino-mongodb handles its own connection for logging via the transport worker thread.
if (process.env.NODE_ENV !== 'test') {
    const port = process.env.PORT || 3004;
    app.listen(port, () => console.log(`service-d listening on port ${port}`));
}

module.exports = app;
