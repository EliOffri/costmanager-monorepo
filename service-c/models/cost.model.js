// Mongoose model for the costs collection.
const mongoose = require('mongoose');

// Schema mirrors the required properties specified in the project document.
const costSchema = new mongoose.Schema({
    description: { type: String, required: true },
    category: { type: String, required: true },
    userid: { type: Number, required: true },
    // sum is stored as a floating-point number (Double in MongoDB)
    sum: { type: Number, required: true },
    // date defaults to the moment the document is created if not supplied by the client
    date: { type: Date, default: Date.now }
});

// Explicit collection name prevents Mongoose from auto-pluralising
const Cost = mongoose.model('Cost', costSchema, 'costs');

module.exports = Cost;
