// Unit tests for service-d: GET /api/about
jest.mock('../config/logger', () => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn()
}));

const request = require('supertest');

// Store original env so we can restore it after each test
const originalEnv = process.env.TEAM_MEMBERS;

// Import the app after mocking the logger
const app = require('../index');

afterEach(() => {
    // Restore the TEAM_MEMBERS variable between tests
    process.env.TEAM_MEMBERS = originalEnv || '';
});

describe('GET /api/about', () => {
    // Should return first_name and last_name for each configured team member
    it('returns team member objects with first_name and last_name', async () => {
        process.env.TEAM_MEMBERS = 'Eli,Offri;Jane,Doe';

        const res = await request(app).get('/api/about');
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
        expect(res.body).toHaveLength(2);

        // Verify the response only contains the two required fields
        expect(res.body[0]).toEqual({ first_name: 'Eli', last_name: 'Offri' });
        expect(res.body[1]).toEqual({ first_name: 'Jane', last_name: 'Doe' });
    });

    // When TEAM_MEMBERS is not set the response should be an empty array
    it('returns an empty array when TEAM_MEMBERS is not configured', async () => {
        process.env.TEAM_MEMBERS = '';

        const res = await request(app).get('/api/about');
        expect(res.status).toBe(200);
        expect(res.body).toEqual([]);
    });

    // Response objects should not include extra properties beyond first_name and last_name
    it('does not include extra properties in team member objects', async () => {
        process.env.TEAM_MEMBERS = 'Alice,Smith';

        const res = await request(app).get('/api/about');
        expect(res.status).toBe(200);
        expect(Object.keys(res.body[0])).toEqual(['first_name', 'last_name']);
    });
});
