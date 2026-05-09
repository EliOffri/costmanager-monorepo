// Route handlers for all user-related endpoints.
const express = require('express');
const router = express.Router();
const User = require('../models/user.model');
const Cost = require('../models/cost.model');
const logger = require('../config/logger');

// Returns every user document in the users collection.
router.get('/users', async (req, res, next) => {
    try {
        logger.info({ service: process.env.SERVICE_NAME }, 'GET /api/users accessed');
        const users = await User.find({});
        res.json(users);
    } catch (err) {
        const error = new Error('Failed to retrieve users');
        error.status = 500;
        error.code = 'USERS_FETCH_ERROR';
        next(error);
    }
});

// Returns a single user's details plus the sum of all their cost entries.
router.get('/users/:id', async (req, res, next) => {
    try {
        logger.info({ userid: req.params.id, service: process.env.SERVICE_NAME }, 'GET /api/users/:id accessed');

        const userid = Number(req.params.id);

        // Reject non-numeric id values before hitting the database
        if (isNaN(userid)) {
            const error = new Error('Invalid user id — must be a number');
            error.status = 400;
            error.code = 'INVALID_USER_ID';
            return next(error);
        }

        // Look up the user by the numeric 'id' field, not by MongoDB's '_id'
        const user = await User.findOne({ id: userid });

        if (!user) {
            const error = new Error(`User with id ${userid} not found`);
            error.status = 404;
            error.code = 'USER_NOT_FOUND';
            return next(error);
        }

        // Aggregate the sum of all cost entries belonging to this user
        const result = await Cost.aggregate([
            { $match: { userid } },
            { $group: { _id: null, total: { $sum: '$sum' } } }
        ]);

        // If no costs exist the aggregation returns an empty array; default total to 0
        const total = result.length > 0 ? result[0].total : 0;

        res.json({
            id: user.id,
            first_name: user.first_name,
            last_name: user.last_name,
            total
        });
    } catch (err) {
        const error = new Error('Failed to retrieve user');
        error.status = 500;
        error.code = 'USER_FETCH_ERROR';
        next(error);
    }
});

// Adds a new user document to the users collection.
router.post('/add', async (req, res, next) => {
    try {
        logger.info({ service: process.env.SERVICE_NAME }, 'POST /api/add (user) accessed');

        const { id, first_name, last_name, birthday } = req.body;

        // All four fields are mandatory per the project specification
        if (id === undefined || id === null || !first_name || !last_name || !birthday) {
            const error = new Error('Missing required fields: id, first_name, last_name, birthday');
            error.status = 400;
            error.code = 'MISSING_FIELDS';
            return next(error);
        }

        const numericId = Number(id);

        // Ensure the id field is a valid number
        if (isNaN(numericId)) {
            const error = new Error('Field id must be a number');
            error.status = 400;
            error.code = 'INVALID_FIELD_TYPE';
            return next(error);
        }

        // Validate that birthday can be parsed as a date
        const birthdayDate = new Date(birthday);
        if (isNaN(birthdayDate.getTime())) {
            const error = new Error('Field birthday must be a valid date');
            error.status = 400;
            error.code = 'INVALID_BIRTHDAY';
            return next(error);
        }

        // Construct and persist the new user document
        const user = new User({
            id: numericId,
            first_name,
            last_name,
            birthday: birthdayDate
        });

        const saved = await user.save();
        res.status(201).json(saved);
    } catch (err) {
        // Code 11000 means a duplicate key violation — the id already exists
        if (err.code === 11000) {
            const error = new Error('A user with this id already exists');
            error.status = 409;
            error.code = 'DUPLICATE_USER_ID';
            return next(error);
        }
        const error = new Error('Failed to add user');
        error.status = 500;
        error.code = 'USER_ADD_ERROR';
        next(error);
    }
});

module.exports = router;
