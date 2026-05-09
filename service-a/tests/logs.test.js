// Unit tests for service-a: GET /api/logs
// jest.mock is hoisted by Jest so the logger is mocked before index.js loads.
jest.mock('../config/logger', () => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn()
}));

const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const request = require('supertest');
const app = require('../index');
const Log = require('../models/log.model');

let mongod;

// Start an in-memory MongoDB server and connect Mongoose before any test runs
beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri());
});

// Wipe the logs collection after each test to ensure full isolation
afterEach(async () => {
    await Log.deleteMany({});
});

// Disconnect Mongoose and stop the in-memory server after all tests complete
afterAll(async () => {
    await mongoose.disconnect();
    await mongod.stop();
});

describe('GET /api/logs', () => {
    // When the collection is empty the endpoint should return an empty array
    it('returns an empty array when no logs exist', async () => {
        const res = await request(app).get('/api/logs');
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
        expect(res.body).toHaveLength(0);
    });

    // When documents exist they should all be returned
    it('returns all log documents', async () => {
        await Log.create({ msg: 'test log entry', level: 30 });
        await Log.create({ msg: 'another entry', level: 20 });

        const res = await request(app).get('/api/logs');
        expect(res.status).toBe(200);
        expect(res.body).toHaveLength(2);

        // Verify at least one field from the seeded documents is present
        const messages = res.body.map(doc => doc.msg);
        expect(messages).toContain('test log entry');
        expect(messages).toContain('another entry');
    });
});
