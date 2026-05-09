// Unit tests for service-c: POST /api/add (cost), GET /api/report
jest.mock('../config/logger', () => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn()
}));

const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const request = require('supertest');
const app = require('../index');
const Cost = require('../models/cost.model');
const User = require('../models/user.model');
const Report = require('../models/report.model');

let mongod;

// Start an in-memory MongoDB server and connect Mongoose before any test runs
beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri());
});

// Clear all collections between tests to prevent state leakage
afterEach(async () => {
    await Cost.deleteMany({});
    await User.deleteMany({});
    await Report.deleteMany({});
});

// Disconnect and shut down the in-memory server after all tests finish
afterAll(async () => {
    await mongoose.disconnect();
    await mongod.stop();
});

// Helper: create the standard test user in the in-memory DB
async function seedUser(id = 123123) {
    return User.create({ id, first_name: 'mosh', last_name: 'israeli', birthday: new Date('1980-01-01') });
}

// Helper: build a date string for N days from today
function daysFromNow(n) {
    const d = new Date();
    d.setDate(d.getDate() + n);
    return d.toISOString();
}

// Helper: build a date string for N days before today
function daysAgo(n) {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d.toISOString();
}

// ──────────────────────────────────────────────────────────────────────────────
describe('POST /api/add (cost)', () => {
    // A well-formed request should persist the cost and return it
    it('creates a cost item and returns 201 with the saved document', async () => {
        await seedUser();

        const res = await request(app)
            .post('/api/add')
            .send({ userid: 123123, description: 'milk', category: 'food', sum: 8 });

        expect(res.status).toBe(201);
        expect(res.body.description).toBe('milk');
        expect(res.body.category).toBe('food');
        expect(res.body.userid).toBe(123123);
        expect(res.body.sum).toBe(8);
    });

    // A category not in the supported list must be rejected
    it('returns 400 for an invalid category', async () => {
        await seedUser();

        const res = await request(app)
            .post('/api/add')
            .send({ userid: 123123, description: 'x', category: 'toys', sum: 5 });

        expect(res.status).toBe(400);
        expect(res.body.id).toBe('INVALID_CATEGORY');
    });

    // A cost dated before today must be rejected
    it('returns 400 when the cost date is in the past', async () => {
        await seedUser();

        const res = await request(app)
            .post('/api/add')
            .send({ userid: 123123, description: 'old purchase', category: 'food', sum: 5, date: daysAgo(1) });

        expect(res.status).toBe(400);
        expect(res.body.id).toBe('PAST_DATE');
    });

    // Referencing a non-existent user should yield 404
    it('returns 404 when userid does not match any user', async () => {
        const res = await request(app)
            .post('/api/add')
            .send({ userid: 99999, description: 'test', category: 'food', sum: 1 });

        expect(res.status).toBe(404);
        expect(res.body.id).toBe('USER_NOT_FOUND');
    });

    // Omitting a required field should yield 400
    it('returns 400 when description is missing', async () => {
        await seedUser();

        const res = await request(app)
            .post('/api/add')
            .send({ userid: 123123, category: 'food', sum: 5 });

        expect(res.status).toBe(400);
        expect(res.body.id).toBe('MISSING_FIELDS');
    });

    // A future date should be accepted
    it('accepts a future date for the cost item', async () => {
        await seedUser();

        const res = await request(app)
            .post('/api/add')
            .send({ userid: 123123, description: 'future buy', category: 'education', sum: 20, date: daysFromNow(5) });

        expect(res.status).toBe(201);
    });
});

// ──────────────────────────────────────────────────────────────────────────────
describe('GET /api/report', () => {
    // Missing query parameters should yield 400
    it('returns 400 when required query parameters are missing', async () => {
        const res = await request(app).get('/api/report?id=123123&year=2026');
        expect(res.status).toBe(400);
        expect(res.body.id).toBe('MISSING_PARAMS');
    });

    // An invalid month value should yield 400
    it('returns 400 for an out-of-range month', async () => {
        const res = await request(app).get('/api/report?id=123123&year=2026&month=13');
        expect(res.status).toBe(400);
        expect(res.body.id).toBe('INVALID_MONTH');
    });

    // The current month report should always be computed fresh from costs
    it('returns a fresh report with all 5 categories for the current month', async () => {
        await seedUser();
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth() + 1;

        // Add a cost for this month to verify it appears in the report
        await Cost.create({ description: 'coffee', category: 'food', userid: 123123, sum: 3, date: now });

        const res = await request(app).get(`/api/report?id=123123&year=${year}&month=${month}`);
        expect(res.status).toBe(200);
        expect(res.body.userid).toBe(123123);
        expect(res.body.year).toBe(year);
        expect(res.body.month).toBe(month);

        // All 5 categories must appear in the costs array
        const categories = res.body.costs.map(obj => Object.keys(obj)[0]);
        expect(categories).toContain('food');
        expect(categories).toContain('health');
        expect(categories).toContain('housing');
        expect(categories).toContain('sports');
        expect(categories).toContain('education');

        // The seeded coffee cost should appear under 'food'
        const foodEntry = res.body.costs.find(obj => obj.food);
        expect(foodEntry.food).toHaveLength(1);
        expect(foodEntry.food[0].description).toBe('coffee');
    });

    // A past month with no cache should compute, save to reports, and return
    it('computes and caches a report for a past month on first request', async () => {
        await seedUser();

        // Request a report for January 2025 (definitely in the past)
        const res = await request(app).get('/api/report?id=123123&year=2025&month=1');
        expect(res.status).toBe(200);
        expect(res.body.month).toBe(1);
        expect(res.body.year).toBe(2025);

        // Verify the report was saved to the cache collection
        const cached = await Report.findOne({ userid: 123123, year: 2025, month: 1 });
        expect(cached).not.toBeNull();
    });

    // A past month with an existing cache should return the cached result without querying costs
    it('returns the cached report without re-querying costs on subsequent requests', async () => {
        await seedUser();

        // Pre-seed a cached report for February 2025
        const cachedCosts = [
            { food: [{ sum: 10, description: 'cached item', day: 5 }] },
            { education: [] },
            { health: [] },
            { housing: [] },
            { sports: [] }
        ];
        await Report.create({ userid: 123123, year: 2025, month: 2, costs: cachedCosts });

        // Spy on Cost.find to verify it is NOT called when a cache hit occurs
        const findSpy = jest.spyOn(Cost, 'find');

        const res = await request(app).get('/api/report?id=123123&year=2025&month=2');
        expect(res.status).toBe(200);

        // The response must match the cached data exactly
        expect(res.body.costs[0].food[0].description).toBe('cached item');
        expect(findSpy).not.toHaveBeenCalled();

        findSpy.mockRestore();
    });

    // Empty categories must still appear in the report
    it('includes empty arrays for categories with no costs', async () => {
        await seedUser();
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth() + 1;

        const res = await request(app).get(`/api/report?id=123123&year=${year}&month=${month}`);
        expect(res.status).toBe(200);

        // Every category object in the costs array should exist
        expect(res.body.costs).toHaveLength(5);
        for (const catObj of res.body.costs) {
            const values = Object.values(catObj);
            expect(Array.isArray(values[0])).toBe(true);
        }
    });
});
