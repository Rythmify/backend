jest.mock('../../src/services/storage.service', () => ({
  initBlobContainers: jest.fn().mockResolvedValue(),
}));

jest.mock('../../src/config/jwt', () => ({
  verifyToken: jest.fn(),
}));

jest.mock('../../src/services/users.service', () => ({
  getMe: jest.fn(),
  getUserById: jest.fn(),
  getUserTracks: jest.fn(),
  getUserLikedTracks: jest.fn(),
  updateMe: jest.fn(),
  updateMyAccount: jest.fn(),
  switchRole: jest.fn(),
  updatePrivacy: jest.fn(),
  getMyWebProfile: jest.fn(),
  addWebProfile: jest.fn(),
  deleteWebProfile: jest.fn(),
  uploadMyAvatar: jest.fn(),
  uploadMyCoverPhoto: jest.fn(),
  deleteMyCoverPhoto: jest.fn(),
  deleteMyAvatar: jest.fn(),
  getMyGenres: jest.fn(),
  replaceMyGenres: jest.fn(),
  completeOnboarding: jest.fn(),
  getMyContentSettings: jest.fn(),
  updateMyContentSettings: jest.fn(),
  getMyPrivacySettings: jest.fn(),
  updateMyPrivacySettings: jest.fn(),
}));

const request = require('supertest');
const app = require('../../app');
const { verifyToken } = require('../../src/config/jwt');
const usersService = require('../../src/services/users.service');

describe('GET /api/v1/users/:user_id/liked-tracks', () => {
  const TARGET_USER_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const REQUESTER_USER_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('works for an anonymous requester', async () => {
    usersService.getUserLikedTracks.mockResolvedValue({
      data: [],
      pagination: {
        limit: 20,
        offset: 0,
        total: 0,
      },
    });

    const response = await request(app).get(`/api/v1/users/${TARGET_USER_ID}/liked-tracks`);

    expect(response.status).toBe(200);
    expect(usersService.getUserLikedTracks).toHaveBeenCalledWith({
      targetUserId: TARGET_USER_ID,
      requesterUserId: null,
      limit: undefined,
      offset: undefined,
    });
    expect(response.body).toEqual({
      data: [],
      message: 'User liked tracks fetched successfully',
      pagination: {
        limit: 20,
        offset: 0,
        total: 0,
      },
    });
  });

  it('passes optional authenticated requester identity to the users service', async () => {
    verifyToken.mockReturnValue({ sub: REQUESTER_USER_ID });
    usersService.getUserLikedTracks.mockResolvedValue({
      data: [
        {
          id: '11111111-1111-4111-8111-111111111111',
          title: 'Liked Track',
          user_id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
          artist_name: 'Artist',
          comment_count: 1,
          repost_count: 2,
        },
      ],
      pagination: {
        limit: 5,
        offset: 10,
        total: 45,
      },
    });

    const response = await request(app)
      .get(`/api/v1/users/${TARGET_USER_ID}/liked-tracks`)
      .query({ limit: '5', offset: '10' })
      .set('Authorization', 'Bearer valid-token');

    expect(response.status).toBe(200);
    expect(usersService.getUserLikedTracks).toHaveBeenCalledWith({
      targetUserId: TARGET_USER_ID,
      requesterUserId: REQUESTER_USER_ID,
      limit: '5',
      offset: '10',
    });
    expect(response.body.pagination.total).toBe(45);
  });

  it('rejects an invalid user_id before calling the service', async () => {
    const response = await request(app).get('/api/v1/users/not-a-uuid/liked-tracks');

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: {
        code: 'VALIDATION_FAILED',
        message: 'user_id must be a valid UUID.',
      },
    });
    expect(usersService.getUserLikedTracks).not.toHaveBeenCalled();
  });
});
