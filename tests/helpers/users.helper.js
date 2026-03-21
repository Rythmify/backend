const jwt = require('jsonwebtoken');

// Generate a fake JWT token for testing
const generateToken = (userId = 'test-user-uuid') => {
  return jwt.sign({ sub: userId }, process.env.JWT_SECRET || 'test-secret', { expiresIn: '15m' });
};

// Fake user data
const mockUser = {
  id: 'test-user-uuid',
  email: 'test@example.com',
  display_name: 'Test User',
  role: 'listener',
  is_verified: true,
  is_private: false,
  followers_count: 0,
  following_count: 0,
  created_at: new Date().toISOString(),
};

module.exports = { generateToken, mockUser };