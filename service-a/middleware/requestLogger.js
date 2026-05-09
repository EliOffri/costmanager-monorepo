// Middleware that logs every incoming HTTP request before it reaches a route handler.
const logger = require('../config/logger');

// Called for every request; records method, URL, IP, and originating service.
function requestLogger(req, res, next) {
    logger.info({
        method: req.method,
        url: req.originalUrl,
        ip: req.ip,
        service: process.env.SERVICE_NAME
    }, 'incoming request');
    // Pass control to the next middleware or route handler
    next();
}

module.exports = requestLogger;
