// Mongoose model for the users collection.
const mongoose = require('mongoose');

// Schema mirrors the required properties specified in the project document.
// Note: 'id' is a separate numeric field — it is NOT the same as Mongoose's '_id'.
const userSchema = new mongoose.Schema({
    id: { type: Number, required: true, unique: true },
    first_name: { type: String, required: true },
    last_name: { type: String, required: true },
    birthday: { type: Date, required: true }
});

// Explicit collection name prevents Mongoose from auto-pluralising 'User' → 'users'
const User = mongoose.model('User', userSchema, 'users');

module.exports = User;
