// ============================================================
// tests/user/helpers/test-fixtures.js
// Shared test data for user tests
// ============================================================

const testFixtures = {
  // User fixtures
  mockUser: {
    id: 'user-123',
    email: 'test@example.com',
    username: 'testuser',
    display_name: 'Test User',
    first_name: 'Test',
    last_name: 'User',
    bio: 'Test bio',
    city: 'Test City',
    country: 'Test Country',
    gender: 'male',
    date_of_birth: '2000-01-01',
    role: 'listener',
    profile_picture: null,
    cover_photo: null,
    is_private: false,
    is_verified: true,
    is_suspended: false,
    twofa_enabled: false,
    followers_count: 0,
    following_count: 0,
    last_login_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },

  // Web profile fixtures
  mockWebProfile: {
    id: 'profile-1',
    user_id: 'user-123',
    platform: 'Twitter',
    url: 'https://twitter.com/testuser',
    created_at: new Date().toISOString(),
  },

  mockWebProfiles: [
    {
      id: 'profile-1',
      user_id: 'user-123',
      platform: 'Twitter',
      url: 'https://twitter.com/testuser',
    },
    {
      id: 'profile-2',
      user_id: 'user-123',
      platform: 'Instagram',
      url: 'https://instagram.com/testuser',
    },
  ],

  // Error fixtures
  errors: {
    notFound: { statusCode: 404, message: 'User not found', code: 'RESOURCE_NOT_FOUND' },
    unauthorized: { statusCode: 401, message: 'Unauthorized', code: 'AUTH_FAILED' },
    forbidden: { statusCode: 403, message: 'Forbidden', code: 'PERMISSION_DENIED' },
    conflict: { statusCode: 409, message: 'Conflict', code: 'RESOURCE_ALREADY_EXISTS' },
    badRequest: { statusCode: 400, message: 'Bad request', code: 'VALIDATION_FAILED' },
  },
};

module.exports = testFixtures;
