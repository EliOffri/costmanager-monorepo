// Mongoose model for the logs collection.
// Pino log entries have a variable structure, so we use a flexible schema.
const mongoose = require('mongoose');

/*
 * strict: false allows documents with any shape to be stored and retrieved.
 * Pino writes entries with fields like level, time, msg, pid, hostname, plus
 * any additional fields we attach (method, url, service, etc.).
 */
const logSchema = new mongoose.Schema({}, { strict: false });

// Third argument explicitly names the collection to avoid Mongoose's pluralisation
const Log = mongoose.model('Log', logSchema, 'logs');

module.exports = Log;
