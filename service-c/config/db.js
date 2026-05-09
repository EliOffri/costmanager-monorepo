// Handles the connection to MongoDB Atlas via Mongoose.
const mongoose = require('mongoose');

/*
 * Connects to the MongoDB Atlas cluster using the URI from environment variables.
 * The dbName option ensures all services target the same database regardless
 * of whether the DB name is embedded in the URI or not.
 * Throws on connection failure so the process does not start in a broken state.
 */
async function connectDB() {
    // Establish the connection using the environment-provided URI and DB name
    await mongoose.connect(process.env.MONGODB_URI, {
        dbName: process.env.DB_NAME
    });
    // Confirm successful connection in the console
    console.log('MongoDB connected (service-c)');
}

module.exports = connectDB;
