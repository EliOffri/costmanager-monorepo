// Route handler for the logs endpoint.
const express = require('express');
const router = express.Router();
const Log = require('../models/log.model');
const logger = require('../config/logger');

// Returns all documents stored in the logs collection.
router.get('/logs', async (req, res, next) => {
    try {
        // Log that this specific endpoint was accessed
        logger.info({ service: process.env.SERVICE_NAME }, 'GET /api/logs accessed');

        // Fetch every log document without filtering
        const logs = await Log.find({});
        res.json(logs);
    } catch (err) {
        // Forward to the central error handler with a descriptive error object
        const error = new Error('Failed to retrieve logs');
        error.status = 500;
        error.code = 'LOGS_FETCH_ERROR';
        next(error);
    }
});

module.exports = router;
