// ============================================================
// tests/users.test.js — Unit & integration tests
// Mirrors: src/routes/users.routes.js + src/services/users.service.js
// ============================================================
const request = require('supertest');

// Mock auth middleware BEFORE importing app
jest.mock('../src/middleware/auth', () => ({
  authenticate: (req, res, next) => {
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'AUTH_TOKEN_MISSING', message: 'Authorization header missing' });
    }
    req.user = { sub: 'test-user-uuid' };
    next();
  },
  optionalAuthenticate: (req, res, next) => {
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      req.user = null;
      return next();
    }
    req.user = { sub: 'test-user-uuid' };
    next();
  },
}));

// Mock the database BEFORE importing app
jest.mock('../src/config/db', () => ({
  query: jest.fn().mockResolvedValue({ rows: [] }),
  getClient: jest.fn(),
}));

const app = require('../app');
const db = require('../src/config/db');


// Import test helpers
const { generateToken, mockUser } = require('./helpers/users.helper');

beforeEach(() => {
  jest.clearAllMocks();
});


// GET /api/v1/users/me
describe('GET /api/v1/users/me', () => {
  it('should return 401 if no token provided', async () => {
    const res = await request(app).get('/api/v1/users/me');
    expect(res.status).toBe(401);
  });

  it('should return 200 and user profile if authenticated', async () => {
    db.query.mockResolvedValueOnce({
      rows: [mockUser],
    });

    const token = generateToken();
    const res = await request(app)
      .get('/api/v1/users/me')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('email', mockUser.email);
  });
});


// PATCH /api/v1/users/me
describe('PATCH /api/v1/users/me', () => {
  it('should return 401 if no token provided', async () => {
    const res = await request(app).patch('/api/v1/users/me').send({ display_name: 'New Name' });
    expect(res.status).toBe(401);
  });

  it('should return 200 and updated profile', async () => {
    db.query.mockResolvedValueOnce({
      rows: [{
        ...mockUser,
        display_name: 'New Name',
      }],
    });

    const token = generateToken();
    const res = await request(app)
      .patch('/api/v1/users/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ display_name: 'New Name' });

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('display_name', 'New Name');
  });
});


// DELETE /api/v1/users/me/avatar
describe('DELETE /api/v1/users/me/avatar', () => {
  it('should return 401 if no token provided', async () => {
    const res = await request(app).delete('/api/v1/users/me/avatar');
    expect(res.status).toBe(401);
  });

  it('should return 404 if no avatar set', async () => {
    db.query.mockResolvedValueOnce({
      rows: [{ ...mockUser, profile_picture: null }],
    });

    const token = generateToken();
    const res = await request(app)
      .delete('/api/v1/users/me/avatar')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  it('should return 200 if avatar deleted successfully', async () => {
    db.query.mockResolvedValueOnce({
      rows: [{ ...mockUser, profile_picture: 'https://cdn.rythmify.com/avatar.jpg' }],
    });
    db.query.mockResolvedValueOnce({
      rows: [{ profile_picture: null }],
    });

    const token = generateToken();
    const res = await request(app)
      .delete('/api/v1/users/me/avatar')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('message', 'Your profile picture deleted successfully.');
  });
});


// PATCH /api/v1/users/me/privacy
describe('PATCH /api/v1/users/me/privacy', () => {
  it('should return 401 if no token provided', async () => {
    const res = await request(app).patch('/api/v1/users/me/privacy').send({ is_private: true });
    expect(res.status).toBe(401);
  });

  it('should return 400 if is_private is missing', async () => {
    const token = generateToken();
    const res = await request(app)
      .patch('/api/v1/users/me/privacy')
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(400);
  });

  it('should return 200 if privacy updated', async () => {
    db.query.mockResolvedValueOnce({
      rows: [{ ...mockUser, is_private: false }],
    });
    db.query.mockResolvedValueOnce({
      rows: [{ ...mockUser, is_private: true }],
    });

    const token = generateToken();
    const res = await request(app)
      .patch('/api/v1/users/me/privacy')
      .set('Authorization', `Bearer ${token}`)
      .send({ is_private: true });

    expect(res.status).toBe(200);
  });
});

