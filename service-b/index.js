// Entry point for service-b — the Users microservice.
require('dotenv').config();
const express = require('express');
const connectDB = require('./config/db');
const requestLogger = require('./middleware/requestLogger');
const usersRouter = require('./routes/users.route');

// Create the Express application
const app = express();

// Parse incoming JSON request bodies
app.use(express.json());

// Log every HTTP request before it reaches a route handler
app.use(requestLogger);

// Mount the users router under the /api prefix
app.use('/api', usersRouter);

// Central error handler — formats all errors as the required JSON structure.
// Must have exactly four parameters for Express to treat it as an error handler.
app.use((err, req, res, next) => {
    res.status(err.status || 500).json({
        id: err.code || 'INTERNAL_ERROR',
        message: err.message || 'An unexpected error occurred'
    });
});

// Connect to MongoDB then start listening — skipped during automated tests
if (process.env.NODE_ENV !== 'test') {
    connectDB()
        .then(() => {
            const port = process.env.PORT || 3002;
            app.listen(port, () => console.log(`service-b listening on port ${port}`));
        })
        .catch(err => {
            console.error('Failed to connect to MongoDB:', err);
            process.exit(1);
        });
}

module.exports = app;
