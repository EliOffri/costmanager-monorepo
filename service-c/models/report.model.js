// Mongoose model for the reports collection — used by the Computed Design Pattern.
const mongoose = require('mongoose');

/*
 * Stores pre-computed monthly reports for past months.
 * Once a month has ended, no new costs can be added to it (the server rejects
 * past-dated cost entries), so the report is immutable and safe to cache here.
 * Subsequent requests for the same (userid, year, month) return this cached document
 * instead of re-aggregating the costs collection.
 */
const reportSchema = new mongoose.Schema({
    userid: { type: Number, required: true },
    year: { type: Number, required: true },
    month: { type: Number, required: true },
    // costs stores the fully-formatted array exactly as returned to the client
    costs: { type: Array, required: true }
});

// Compound unique index prevents duplicate cache entries for the same user/year/month
// and enables efficient lookups during the cache-check step.
reportSchema.index({ userid: 1, year: 1, month: 1 }, { unique: true });

const Report = mongoose.model('Report', reportSchema, 'reports');

module.exports = Report;
