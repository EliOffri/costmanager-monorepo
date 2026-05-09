// Read-only reference to the costs collection, used to compute a user's total spending.
// This schema is identical to service-c's cost.model.js; both point at the same Atlas collection.
const mongoose = require('mongoose');

// Schema mirrors the costs collection structure defined in service-c.
const costSchema = new mongoose.Schema({
    description: { type: String, required: true },
    category: { type: String, required: true },
    userid: { type: Number, required: true },
    // sum is stored as a floating-point number (Double in MongoDB)
    sum: { type: Number, required: true },
    date: { type: Date, default: Date.now }
});

// Explicit collection name so both services operate on the same 'costs' collection
const Cost = mongoose.model('Cost', costSchema, 'costs');

module.exports = Cost;
