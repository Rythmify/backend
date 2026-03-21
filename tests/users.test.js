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
const { generateToken, mockUser, makeAuthenticatedRequest, mockQueryResponse, mockMultipleQueries } = require('./helpers/users.helper');

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

// PATCH /api/v1/users/me/account
describe('PATCH /api/v1/users/me/account', () => {
  it('should return 401 if no token provided', async () => {
    const res = await request(app).patch('/api/v1/users/me/account').send({ gender: 'male' });
    expect(res.status).toBe(401);
  });

  it('should return 400 if gender is invalid', async () => {
    const res = await makeAuthenticatedRequest(app, 'patch', '/api/v1/users/me/account', { gender: 'invalid' });
    expect(res.status).toBe(400);
  });

  it('should return 400 if date_of_birth is invalid format', async () => {
    const res = await makeAuthenticatedRequest(app, 'patch', '/api/v1/users/me/account', { date_of_birth: 'not-a-date' });
    expect(res.status).toBe(400);
  });

  it('should return 400 if user is under 13 years old', async () => {
    const res = await makeAuthenticatedRequest(app, 'patch', '/api/v1/users/me/account', { date_of_birth: '2020-01-01' });
    expect(res.status).toBe(400);
  });

  it('should return 200 if account updated with gender only', async () => {
    mockQueryResponse(db, [{ ...mockUser, gender: 'female' }]);
    const res = await makeAuthenticatedRequest(app, 'patch', '/api/v1/users/me/account', { gender: 'female' });
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('gender', 'female');
  });

  it('should return 200 if account updated with valid date_of_birth', async () => {
    mockQueryResponse(db, [{ ...mockUser, date_of_birth: '2000-06-15' }]);
    const res = await makeAuthenticatedRequest(app, 'patch', '/api/v1/users/me/account', { date_of_birth: '2000-06-15' });
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('date_of_birth', '2000-06-15');
  });

  it('should return 200 if account updated with both gender and date_of_birth', async () => {
    mockQueryResponse(db, [{ ...mockUser, gender: 'female', date_of_birth: '1995-03-20' }]);
    const res = await makeAuthenticatedRequest(app, 'patch', '/api/v1/users/me/account', { gender: 'female', date_of_birth: '1995-03-20' });
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('gender', 'female');
    expect(res.body.data).toHaveProperty('date_of_birth', '1995-03-20');
  });
});

// PATCH /api/v1/users/me/role
describe('PATCH /api/v1/users/me/role', () => {
  it('should return 401 if no token provided', async () => {
    const res = await request(app).patch('/api/v1/users/me/role').send({ role: 'artist' });
    expect(res.status).toBe(401);
  });

  it('should return 400 if role is missing', async () => {
    const res = await makeAuthenticatedRequest(app, 'patch', '/api/v1/users/me/role', {});
    expect(res.status).toBe(400);
  });

  it('should return 400 if role is invalid', async () => {
    const res = await makeAuthenticatedRequest(app, 'patch', '/api/v1/users/me/role', { role: 'invalid' });
    expect(res.status).toBe(400);
  });

  it('should return 404 if user not found', async () => {
    mockQueryResponse(db, []); // user not found
    const res = await makeAuthenticatedRequest(app, 'patch', '/api/v1/users/me/role', { role: 'artist' });
    expect(res.status).toBe(404);
  });

  it('should return 409 if user already has that role', async () => {
    mockQueryResponse(db, [{ ...mockUser, role: 'listener' }]);
    const res = await makeAuthenticatedRequest(app, 'patch', '/api/v1/users/me/role', { role: 'listener' });
    expect(res.status).toBe(409);
  });

  it('should return 200 if role switched successfully from listener to artist', async () => {
    mockMultipleQueries(db, [
      [{ ...mockUser, role: 'listener' }],  // findById
      [{ ...mockUser, role: 'artist' }],    // updateRole
    ]);
    const res = await makeAuthenticatedRequest(app, 'patch', '/api/v1/users/me/role', { role: 'artist' });
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('role', 'artist');
  });

  it('should return 200 if role switched successfully from artist to listener', async () => {
    mockMultipleQueries(db, [
      [{ ...mockUser, role: 'artist' }],    // findById
      [{ ...mockUser, role: 'listener' }],  // updateRole
    ]);
    const res = await makeAuthenticatedRequest(app, 'patch', '/api/v1/users/me/role', { role: 'listener' });
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('role', 'listener');
  });
});

// POST /api/v1/users/me/avatar
describe('POST /api/v1/users/me/avatar', () => {
  it('should return 401 if no token provided', async () => {
    const res = await request(app).post('/api/v1/users/me/avatar');
    expect(res.status).toBe(401);
  });

  it('should return 400 if no file uploaded', async () => {
    const token = generateToken();
    const res = await request(app)
      .post('/api/v1/users/me/avatar')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
  });

  // Note: Testing 404 (user not found) and 200 (success) for file uploads requires 
  // complex multer middleware mocking. The above tests cover authentication and validation.
});

// DELETE /api/v1/users/me/cover
describe('DELETE /api/v1/users/me/cover', () => {
  it('should return 401 if no token provided', async () => {
    const res = await request(app).delete('/api/v1/users/me/cover');
    expect(res.status).toBe(401);
  });

  it('should return 404 if user not found', async () => {
    mockQueryResponse(db, []); // user not found
    const res = await makeAuthenticatedRequest(app, 'delete', '/api/v1/users/me/cover');
    expect(res.status).toBe(404);
  });

  it('should return 404 if no cover photo set', async () => {
    const userWithoutCover = { ...mockUser, cover_photo: null };
    mockQueryResponse(db, [userWithoutCover]);
    const res = await makeAuthenticatedRequest(app, 'delete', '/api/v1/users/me/cover');
    expect(res.status).toBe(404);
  });

  // Note: Testing successful deletion (200) requires careful mock setup for consecutive queries.
  // The above tests cover auth and error cases (401, 404).
}); 





