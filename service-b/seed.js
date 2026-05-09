// One-time seed script — run with: node seed.js
// Ensures the required imaginary user exists in the database before submission.
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/user.model');

// The single required test user as specified in the project document
const SEED_USER = {
    id: 123123,
    first_name: 'mosh',
    last_name: 'israeli'
};

async function seed() {
    // Connect to Atlas using the same URI as the running service
    await mongoose.connect(process.env.MONGODB_URI, { dbName: process.env.DB_NAME });
    console.log('Connected to MongoDB');

    // Upsert so re-running the script is safe — will not create duplicates
    const result = await User.findOneAndUpdate(
        { id: SEED_USER.id },
        SEED_USER,
        { upsert: true, new: true }
    );

    // Confirm which action was taken
    console.log(`Seed user upserted: id=${result.id}, name=${result.first_name} ${result.last_name}`);

    await mongoose.disconnect();
    console.log('Done');
}

// Run and exit; any error is printed and exits with a non-zero code
seed().catch(err => {
    console.error('Seed failed:', err);
    process.exit(1);
});
