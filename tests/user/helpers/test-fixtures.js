// ============================================================
// tests/user/helpers/test-fixtures.js
// Shared test data for user tests
// ============================================================

const testFixtures = {
  // Full private user (returned from findFullById — used in getMe)
  mockUser: {
    id: 'user-123',
    email: 'test@example.com',
    username: 'testuser',
    display_name: 'Test User',
    first_name: 'Test',
    last_name: 'User',
    bio: 'Test bio',
    city: 'Test City',
    country: 'EG',
    gender: 'male',
    date_of_birth: '2000-01-01',
    role: 'listener',
    profile_picture: 'https://cdn.rythmify.com/avatars/user-123.jpg',
    cover_photo: 'https://cdn.rythmify.com/covers/user-123.jpg',
    is_private: false,
    is_verified: true,
    is_suspended: false,
    twofa_enabled: false,
    followers_count: 10,
    following_count: 5,
    last_login_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },

  // Public user (returned from findPublicById — used in getUserById)
  mockPublicUser: {
    id: 'user-456',
    display_name: 'Public User',
    username: 'publicuser',
    bio: 'Public bio',
    city: 'Cairo',
    country: 'EG',
    gender: 'female',
    role: 'artist',
    profile_picture: null,
    cover_photo: null,
    is_private: false,
    is_verified: true,
    followers_count: 100,
    following_count: 50,
    created_at: new Date().toISOString(),
  },

  // Single web profile fixture
  mockWebProfile: {
    id: 'profile-1',
    user_id: 'user-123',
    platform: 'Twitter',
    url: 'https://twitter.com/testuser',
    created_at: new Date().toISOString(),
  },

  // Multiple web profiles fixture
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

  // Genre fixtures
  mockGenres: [
    { id: 'genre-1', name: 'Rock' },
    { id: 'genre-2', name: 'Jazz' },
    { id: 'genre-3', name: 'Pop' },
  ],

  // Content settings fixture
  mockContentSettings: {
    rss_title: 'My Podcast',
    rss_language: 'en',
    rss_category: 'Music',
    rss_explicit: false,
    rss_show_email: false,
    default_include_in_rss: true,
    default_license_type: 'all-rights-reserved',
  },

  // Privacy settings fixture
  mockPrivacySettings: {
    receive_messages_from_anyone: true,
    show_activities_in_discovery: true,
    show_as_top_fan: false,
    show_top_fans_on_tracks: true,
  },

  // Error fixtures
  errors: {
    notFound:     { statusCode: 404, message: 'User not found',  code: 'RESOURCE_NOT_FOUND'      },
    unauthorized: { statusCode: 401, message: 'Unauthorized',    code: 'AUTH_FAILED'              },
    forbidden:    { statusCode: 403, message: 'Forbidden',       code: 'PERMISSION_DENIED'        },
    conflict:     { statusCode: 409, message: 'Conflict',        code: 'RESOURCE_ALREADY_EXISTS'  },
    badRequest:   { statusCode: 400, message: 'Bad request',     code: 'VALIDATION_FAILED'        },
    private:      { statusCode: 403, message: 'Private profile', code: 'RESOURCE_PRIVATE'         },
  },
};

module.exports = testFixtures;