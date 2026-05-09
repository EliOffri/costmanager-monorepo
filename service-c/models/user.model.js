// Read-only reference to the users collection, used to validate that a userid exists.
// This schema is identical to service-b's user.model.js; both target the same Atlas collection.
const mongoose = require('mongoose');

// Schema mirrors the users collection structure defined in service-b.
// Note: 'id' is a separate numeric field — it is NOT the same as Mongoose's '_id'.
const userSchema = new mongoose.Schema({
    id: { type: Number, required: true, unique: true },
    first_name: { type: String, required: true },
    last_name: { type: String, required: true },
    birthday: { type: Date, required: true }
});

// Explicit collection name so both services operate on the same 'users' collection
const User = mongoose.model('User', userSchema, 'users');

module.exports = User;
