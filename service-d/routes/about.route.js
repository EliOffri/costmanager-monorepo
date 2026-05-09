// Route handler for the about endpoint — returns developer team information.
const express = require('express');
const router = express.Router();
const logger = require('../config/logger');

// Returns the list of team members who developed this application.
// Names are sourced from the TEAM_MEMBERS environment variable, not from the database.
router.get('/about', (req, res, next) => {
    try {
        logger.info({ service: process.env.SERVICE_NAME }, 'GET /api/about accessed');

        // TEAM_MEMBERS format: "FirstName,LastName;FirstName2,LastName2"
        const rawTeam = process.env.TEAM_MEMBERS || '';

        // Return an empty array if no team members are configured
        if (!rawTeam.trim()) {
            return res.json([]);
        }

        // Split on semicolons to get individual member entries, then parse each pair
        const team = rawTeam.split(';').map(pair => {
            const [first_name, last_name] = pair.split(',');
            return {
                first_name: (first_name || '').trim(),
                last_name: (last_name || '').trim()
            };
        });

        res.json(team);
    } catch (err) {
        const error = new Error('Failed to retrieve team members');
        error.status = 500;
        error.code = 'ABOUT_ERROR';
        next(error);
    }
});

module.exports = router;
