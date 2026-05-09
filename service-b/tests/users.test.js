// Unit tests for service-b: GET /api/users, GET /api/users/:id, POST /api/add
jest.mock('../config/logger', () => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn()
}));

const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const request = require('supertest');
const app = require('../index');
const User = require('../models/user.model');
const Cost = require('../models/cost.model');

let mongod;

// Start an in-memory MongoDB server and connect Mongoose before any test runs
beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri());
});

// Clear all collections between tests to prevent state leakage
afterEach(async () => {
    await User.deleteMany({});
    await Cost.deleteMany({});
});

// Disconnect and shut down the in-memory server after all tests finish
afterAll(async () => {
    await mongoose.disconnect();
    await mongod.stop();
});

// ──────────────────────────────────────────────────────────────────────────────
describe('POST /api/add (user)', () => {
    // A well-formed request should create a user and return the document
    it('creates a user and returns 201 with the saved document', async () => {
        const res = await request(app)
            .post('/api/add')
            .send({ id: 1, first_name: 'Alice', last_name: 'Smith', birthday: '1990-01-01' });

        expect(res.status).toBe(201);
        expect(res.body.id).toBe(1);
        expect(res.body.first_name).toBe('Alice');
        expect(res.body.last_name).toBe('Smith');
    });

    // Missing any required field should yield a 400 error
    it('returns 400 when first_name is missing', async () => {
        const res = await request(app)
            .post('/api/add')
            .send({ id: 2, last_name: 'Smith', birthday: '1990-01-01' });

        expect(res.status).toBe(400);
        expect(res.body).toHaveProperty('id');
        expect(res.body).toHaveProperty('message');
    });

    // Duplicate id should yield a 409 conflict response
    it('returns 409 when a user with the same id already exists', async () => {
        await User.create({ id: 5, first_name: 'Bob', last_name: 'Jones', birthday: new Date() });

        const res = await request(app)
            .post('/api/add')
            .send({ id: 5, first_name: 'Carol', last_name: 'White', birthday: '1985-06-15' });

        expect(res.status).toBe(409);
        expect(res.body.id).toBe('DUPLICATE_USER_ID');
    });

    // A non-numeric id should be rejected
    it('returns 400 when id is not a number', async () => {
        const res = await request(app)
            .post('/api/add')
            .send({ id: 'abc', first_name: 'Dave', last_name: 'Lee', birthday: '1992-03-20' });

        expect(res.status).toBe(400);
    });
});

// ──────────────────────────────────────────────────────────────────────────────
describe('GET /api/users', () => {
    // An empty collection should return an empty array
    it('returns an empty array when no users exist', async () => {
        const res = await request(app).get('/api/users');
        expect(res.status).toBe(200);
        expect(res.body).toEqual([]);
    });

    // All seeded users should appear in the response
    it('returns all users when users exist', async () => {
        await User.create({ id: 10, first_name: 'Eve', last_name: 'Fox', birthday: new Date() });
        await User.create({ id: 11, first_name: 'Frank', last_name: 'Green', birthday: new Date() });

        const res = await request(app).get('/api/users');
        expect(res.status).toBe(200);
        expect(res.body).toHaveLength(2);
    });
});

// ──────────────────────────────────────────────────────────────────────────────
describe('GET /api/users/:id', () => {
    // A user with no associated costs should return total: 0
    it('returns user details with total 0 when no costs exist', async () => {
        await User.create({ id: 20, first_name: 'Grace', last_name: 'Hill', birthday: new Date() });

        const res = await request(app).get('/api/users/20');
        expect(res.status).toBe(200);
        expect(res.body.id).toBe(20);
        expect(res.body.first_name).toBe('Grace');
        expect(res.body.last_name).toBe('Hill');
        expect(res.body.total).toBe(0);
    });

    // Total should equal the sum of all cost entries for this user
    it('returns the correct total when costs exist', async () => {
        await User.create({ id: 21, first_name: 'Hank', last_name: 'Ivy', birthday: new Date() });
        await Cost.create({ description: 'milk', category: 'food', userid: 21, sum: 10, date: new Date() });
        await Cost.create({ description: 'bread', category: 'food', userid: 21, sum: 5.5, date: new Date() });

        const res = await request(app).get('/api/users/21');
        expect(res.status).toBe(200);
        expect(res.body.total).toBe(15.5);
    });

    // Requesting a non-existent user should yield 404
    it('returns 404 when user does not exist', async () => {
        const res = await request(app).get('/api/users/99999');
        expect(res.status).toBe(404);
        expect(res.body.id).toBe('USER_NOT_FOUND');
    });

    // A non-numeric id in the URL should yield 400
    it('returns 400 for a non-numeric id', async () => {
        const res = await request(app).get('/api/users/not-a-number');
        expect(res.status).toBe(400);
    });
});
