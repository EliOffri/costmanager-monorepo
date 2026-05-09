// Route handlers for all cost-related endpoints.
const express = require('express');
const router = express.Router();
const Cost = require('../models/cost.model');
const User = require('../models/user.model');
const Report = require('../models/report.model');
const logger = require('../config/logger');

// The five supported cost categories — any other value is rejected.
const CATEGORIES = ['food', 'health', 'housing', 'sports', 'education'];

// Adds a new cost item after validating all required fields and business rules.
router.post('/add', async (req, res, next) => {
    try {
        logger.info({ service: process.env.SERVICE_NAME }, 'POST /api/add (cost) accessed');

        const { userid, description, category, sum, date } = req.body;

        // All four core fields must be present in the request body
        if (userid === undefined || userid === null || !description || !category || sum === undefined || sum === null) {
            const error = new Error('Missing required fields: userid, description, category, sum');
            error.status = 400;
            error.code = 'MISSING_FIELDS';
            return next(error);
        }

        // Reject any category that is not in the supported list
        if (!CATEGORIES.includes(category)) {
            const error = new Error(`Category must be one of: ${CATEGORIES.join(', ')}`);
            error.status = 400;
            error.code = 'INVALID_CATEGORY';
            return next(error);
        }

        // Use the provided date or fall back to the current server time
        const costDate = date ? new Date(date) : new Date();

        if (isNaN(costDate.getTime())) {
            const error = new Error('Field date must be a valid date');
            error.status = 400;
            error.code = 'INVALID_DATE';
            return next(error);
        }

        // Compare only the calendar date (strip time) to determine if the date is in the past
        const costDay = new Date(costDate);
        costDay.setHours(0, 0, 0, 0);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Costs with dates before today are forbidden — enforces the Computed Pattern's immutability
        if (costDay < today) {
            const error = new Error('Cost date cannot be in the past');
            error.status = 400;
            error.code = 'PAST_DATE';
            return next(error);
        }

        // Verify the userid maps to an existing user before creating the cost
        const userExists = await User.findOne({ id: Number(userid) });
        if (!userExists) {
            const error = new Error(`User with id ${userid} not found`);
            error.status = 404;
            error.code = 'USER_NOT_FOUND';
            return next(error);
        }

        // Build and save the new cost document
        const cost = new Cost({
            description,
            category,
            userid: Number(userid),
            sum: Number(sum),
            date: costDate
        });

        const saved = await cost.save();
        res.status(201).json(saved);
    } catch (err) {
        const error = new Error('Failed to add cost item');
        error.status = 500;
        error.code = 'COST_ADD_ERROR';
        next(error);
    }
});

/*
 * Computed Design Pattern — GET /api/report
 *
 * For any month that has already ended (year/month < current year/month),
 * the result is immutable: the server rejects cost entries with past dates,
 * so no new costs can alter a past month's totals. We therefore compute once
 * and cache the result in the 'reports' collection:
 *
 *   1. Determine whether the requested (year, month) is strictly in the past.
 *   2. If it is past, query the 'reports' collection for a cached document
 *      matching { userid, year, month }. If found, return it immediately —
 *      no aggregation needed.
 *   3. If no cache exists (or the month is current/future), aggregate all
 *      matching cost documents from the 'costs' collection, group by the five
 *      categories, and build the standardised response object.
 *   4. If the month is past, persist the computed report using upsert +
 *      $setOnInsert for idempotency under concurrent requests.
 *   5. Return the freshly computed report to the client.
 */
router.get('/report', async (req, res, next) => {
    try {
        logger.info({ query: req.query, service: process.env.SERVICE_NAME }, 'GET /api/report accessed');

        const { id, year, month } = req.query;

        // All three query parameters are required
        if (!id || !year || !month) {
            const error = new Error('Missing required query parameters: id, year, month');
            error.status = 400;
            error.code = 'MISSING_PARAMS';
            return next(error);
        }

        const userid = Number(id);
        const numYear = Number(year);
        const numMonth = Number(month);

        // Reject non-numeric parameter values
        if (isNaN(userid) || isNaN(numYear) || isNaN(numMonth)) {
            const error = new Error('Parameters id, year, and month must be numbers');
            error.status = 400;
            error.code = 'INVALID_PARAMS';
            return next(error);
        }

        // Enforce a valid calendar month range
        if (numMonth < 1 || numMonth > 12) {
            const error = new Error('Month must be between 1 and 12');
            error.status = 400;
            error.code = 'INVALID_MONTH';
            return next(error);
        }

        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth() + 1;

        // A month is "past" if its year/month pair is strictly before the current year/month
        const isPast = numYear < currentYear ||
            (numYear === currentYear && numMonth < currentMonth);

        // Step 2 — cache lookup for past months
        if (isPast) {
            const cached = await Report.findOne({ userid, year: numYear, month: numMonth });
            if (cached) {
                // Return the pre-computed result without touching the costs collection
                return res.json({
                    userid,
                    year: numYear,
                    month: numMonth,
                    costs: cached.costs
                });
            }
        }

        // Step 3 — aggregate from the costs collection
        // $expr with $year/$month operators matches documents by calendar month/year of their date field
        const rawCosts = await Cost.find({
            userid,
            $expr: {
                $and: [
                    { $eq: [{ $year: '$date' }, numYear] },
                    { $eq: [{ $month: '$date' }, numMonth] }
                ]
            }
        });

        // Initialise every category with an empty array so they always appear in the response
        const grouped = {};
        for (const cat of CATEGORIES) {
            grouped[cat] = [];
        }

        // Distribute each cost document into its corresponding category bucket
        for (const cost of rawCosts) {
            grouped[cost.category].push({
                sum: cost.sum,
                description: cost.description,
                // Extract only the day-of-month from the stored date
                day: new Date(cost.date).getDate()
            });
        }

        // Build the response costs array — each element is a single-key object per category
        const costsArray = CATEGORIES.map(cat => ({ [cat]: grouped[cat] }));

        // Step 4 — persist the computed report for future cache hits (past months only)
        if (isPast) {
            // $setOnInsert with upsert:true is idempotent: a concurrent request cannot
            // create a duplicate because the unique index also guards against that.
            await Report.findOneAndUpdate(
                { userid, year: numYear, month: numMonth },
                { $setOnInsert: { userid, year: numYear, month: numMonth, costs: costsArray } },
                { upsert: true }
            );
        }

        // Step 5 — return the freshly computed report
        res.json({
            userid,
            year: numYear,
            month: numMonth,
            costs: costsArray
        });
    } catch (err) {
        const error = new Error('Failed to generate report');
        error.status = 500;
        error.code = 'REPORT_ERROR';
        next(error);
    }
});

module.exports = router;
