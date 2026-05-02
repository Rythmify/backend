/**
 * @fileoverview Comprehensive unit tests for Playlist Service layer
 * Coverage Target: 95%+
 */

const { v4: uuidv4 } = require('uuid');

// ============================================================
// MOCKS & SETUP
// ============================================================

process.env.AZURE_STORAGE_CONNECTION_STRING =
  'DefaultEndpointsProtocol=https;AccountName=test;AccountKey=test;EndpointSuffix=core.windows.net';
process.env.DATABASE_URL = 'postgresql://user:pass@localhost/db';
process.env.JWT_SECRET = 'test-secret';

jest.mock('../../../src/services/storage.service');
jest.mock('../../../src/services/subscriptions.service', () => ({
  getEffectiveActivePlanForUser: jest.fn(),
}));
jest.mock('../../../src/config/db');
jest.mock('../../../src/models/playlist.model');
jest.mock('../../../src/models/user.model');
jest.mock('../../../src/models/follow.model');
jest.mock('../../../src/models/playlist-like.model');
jest.mock('../../../src/models/track.model');
jest.mock('../../../src/models/feed.model');

const userModel = require('../../../src/models/user.model');
const followModel = require('../../../src/models/follow.model');
const playlistLikeModel = require('../../../src/models/playlist-like.model');
const trackModel = require('../../../src/models/track.model');
const feedModel = require('../../../src/models/feed.model');
const storageService = require('../../../src/services/storage.service');
const subscriptionsService = require('../../../src/services/subscriptions.service');
const db = require('../../../src/config/db');
const playlistService = require('../../../src/services/playlists.service');
const playlistModel = require('../../../src/models/playlist.model');

const mockPlaylistId = uuidv4();
const mockUserId = uuidv4();
const mockTrackId = uuidv4();
const mockGenreId = uuidv4();

const mockPlaylist = {
  id: mockPlaylistId,
  playlist_id: mockPlaylistId,
  user_id: mockUserId,
  owner_user_id: mockUserId,
  name: 'Test Playlist',
  description: 'Test description',
  cover_image: 'https://example.com/cover.jpg',
  type: 'regular',
  subtype: 'playlist',
  slug: 'test-playlist',
  is_public: true,
  secret_token: 'secret123',
  release_date: null,
  genre_id: null,
  like_count: 5,
  repost_count: 2,
  track_count: 10,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

const mockTrack = {
  id: mockTrackId,
  track_id: mockTrackId,
  title: 'Test Track',
  artist: 'Test Artist',
  cover_image: 'https://example.com/track.jpg',
  duration: 180,
  is_public: true,
  is_hidden: false,
};

describe('Playlist Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Default: allow playlist creation by treating the user as unlimited.
    subscriptionsService.getEffectiveActivePlanForUser.mockResolvedValue({ playlist_limit: null });
  });

  // ────────────────────────────────────
  // CREATE PLAYLIST - COMPREHENSIVE COVERAGE
  // ────────────────────────────────────
  describe('createPlaylist', () => {
    it('should create a public playlist successfully', async () => {
      playlistModel.create.mockResolvedValue(mockPlaylist);
      playlistModel.findBySlug.mockResolvedValue(null);

      const result = await playlistService.createPlaylist({
        userId: mockUserId,
        name: 'New Playlist',
        isPublic: true,
      });

      expect(result.playlist).toBeDefined();
      expect(result.playlist.name).toBe('Test Playlist');
      expect(playlistModel.create).toHaveBeenCalled();
    });

    it('should create a private playlist with secret token', async () => {
      const privatePlaylist = { ...mockPlaylist, is_public: false };
      playlistModel.create.mockResolvedValue(privatePlaylist);
      playlistModel.findBySlug.mockResolvedValue(null);

      const result = await playlistService.createPlaylist({
        userId: mockUserId,
        name: 'Private Playlist',
        isPublic: false,
      });

      expect(result.playlist.is_public).toBe(false);
      expect(result.playlist.secret_token).toBeDefined();
    });

    it('should generate unique slug when duplicate exists', async () => {
      playlistModel.findBySlug.mockResolvedValueOnce({ slug: 'test' }).mockResolvedValueOnce(null);
      playlistModel.create.mockResolvedValue(mockPlaylist);

      const result = await playlistService.createPlaylist({
        userId: mockUserId,
        name: 'Test',
        isPublic: true,
      });

      expect(result.playlist).toBeDefined();
      expect(playlistModel.findBySlug).toHaveBeenCalledTimes(2);
    });

    it('should sanitize playlist name for slug generation', async () => {
      playlistModel.create.mockResolvedValue(mockPlaylist);
      playlistModel.findBySlug.mockResolvedValue(null);

      await playlistService.createPlaylist({
        userId: mockUserId,
        name: 'Test@#$%!!!',
        isPublic: true,
      });

      expect(playlistModel.create).toHaveBeenCalled();
    });

    it('should handle empty/whitespace playlist names gracefully', async () => {
      playlistModel.create.mockResolvedValue(mockPlaylist);
      playlistModel.findBySlug.mockResolvedValue(null);

      // Service generates a default slug from whitespace
      const result = await playlistService.createPlaylist({
        userId: mockUserId,
        name: '   ',
        isPublic: true,
      });

      expect(result.playlist).toBeDefined();
    });

    it('should handle create with null userId', async () => {
      playlistModel.create.mockResolvedValue(mockPlaylist);
      playlistModel.findBySlug.mockResolvedValue(null);

      subscriptionsService.getEffectiveActivePlanForUser.mockImplementationOnce(() => {
        throw new Error('Authenticated user is required.');
      });

      await expect(
        playlistService.createPlaylist({
          userId: null,
          name: 'Test',
          isPublic: true,
        })
      ).rejects.toThrow('Authenticated user is required.');
    });

    it('enforces subscription playlist limit (limit reached)', async () => {
      subscriptionsService.getEffectiveActivePlanForUser.mockResolvedValueOnce({
        playlist_limit: 2,
      });
      playlistModel.countUserRegularPlaylists.mockResolvedValueOnce(2);

      await expect(
        playlistService.createPlaylist({
          userId: mockUserId,
          name: 'Limited',
          isPublic: true,
        })
      ).rejects.toMatchObject({ code: 'SUBSCRIPTION_PLAYLIST_LIMIT_REACHED' });
    });

    it('allows creation when under subscription playlist limit', async () => {
      subscriptionsService.getEffectiveActivePlanForUser.mockResolvedValueOnce({
        playlist_limit: 2,
      });
      playlistModel.countUserRegularPlaylists.mockResolvedValueOnce(1);
      playlistModel.create.mockResolvedValue(mockPlaylist);
      playlistModel.findBySlug.mockResolvedValue(null);

      await expect(
        playlistService.createPlaylist({
          userId: mockUserId,
          name: 'Limited ok',
          isPublic: true,
        })
      ).resolves.toEqual(expect.objectContaining({ playlist: expect.any(Object) }));
    });
  });

  // ────────────────────────────────────
  // LIST PLAYLISTS - COMPREHENSIVE COVERAGE
  // ────────────────────────────────────
  describe('listPlaylists', () => {
    it('should list my playlists when mine=true', async () => {
      playlistModel.findMyPlaylists.mockResolvedValue([mockPlaylist]);
      playlistModel.countMyPlaylists.mockResolvedValue(1);
      playlistModel.getTopTrackArt.mockResolvedValue(null);

      const result = await playlistService.listPlaylists({
        requesterId: mockUserId,
        mine: true,
        filter: 'created',
        limit: 20,
        offset: 0,
      });

      expect(result.items).toHaveLength(1);
      expect(result.meta.total).toBe(1);
    });

    it('should list liked playlists when filter=liked', async () => {
      playlistModel.findLikedPlaylists.mockResolvedValue([mockPlaylist]);
      playlistModel.countLikedPlaylists.mockResolvedValue(1);
      playlistModel.getTopTrackArt.mockResolvedValue(null);

      const result = await playlistService.listPlaylists({
        requesterId: mockUserId,
        mine: true,
        filter: 'liked',
        limit: 20,
        offset: 0,
      });

      expect(result.items).toHaveLength(1);
    });

    it('should list public playlists', async () => {
      playlistModel.findPublicPlaylists.mockResolvedValue([mockPlaylist]);
      playlistModel.countPublicPlaylists.mockResolvedValue(1);
      playlistModel.getTopTrackArt.mockResolvedValue(null);

      const result = await playlistService.listPlaylists({
        requesterId: mockUserId,
        mine: false,
        limit: 20,
        offset: 0,
      });

      expect(result.items).toHaveLength(1);
    });

    it('should throw error when mine=true without authentication', async () => {
      await expect(
        playlistService.listPlaylists({
          requesterId: null,
          mine: true,
          limit: 20,
          offset: 0,
        })
      ).rejects.toThrow('Authentication');
    });

    it('should clamp limit to 50 max', async () => {
      playlistModel.findMyPlaylists.mockResolvedValue([]);
      playlistModel.countMyPlaylists.mockResolvedValue(0);

      await playlistService.listPlaylists({
        requesterId: mockUserId,
        mine: true,
        limit: 200,
        offset: 0,
      });

      const call = playlistModel.findMyPlaylists.mock.calls[0][0];
      expect(call.limit).toBeLessThanOrEqual(50);
    });

    it('should apply search query filter', async () => {
      playlistModel.findPublicPlaylists.mockResolvedValue([]);
      playlistModel.countPublicPlaylists.mockResolvedValue(0);

      await playlistService.listPlaylists({
        requesterId: mockUserId,
        mine: false,
        q: 'test',
        limit: 20,
        offset: 0,
      });

      expect(playlistModel.findPublicPlaylists).toHaveBeenCalled();
    });

    it('should handle subtype filter (album)', async () => {
      playlistModel.findPublicPlaylists.mockResolvedValue([]);
      playlistModel.countPublicPlaylists.mockResolvedValue(0);

      await playlistService.listPlaylists({
        requesterId: mockUserId,
        mine: false,
        subtype: 'album',
        limit: 20,
        offset: 0,
      });

      expect(playlistModel.findPublicPlaylists).toHaveBeenCalled();
    });

    it('should handle pagination with large offset', async () => {
      playlistModel.findPublicPlaylists.mockResolvedValue([]);
      playlistModel.countPublicPlaylists.mockResolvedValue(1000);

      const result = await playlistService.listPlaylists({
        requesterId: mockUserId,
        mine: false,
        limit: 20,
        offset: 500,
      });

      expect(result.meta).toBeDefined();
    });

    it('fills missing cover image from top track art', async () => {
      const noCover = { ...mockPlaylist, cover_image: null };
      playlistModel.findPublicPlaylists.mockResolvedValue([noCover]);
      playlistModel.countPublicPlaylists.mockResolvedValue(1);
      playlistModel.getTopTrackArt.mockResolvedValue({
        cover_image: 'https://example.com/fallback.jpg',
      });

      const result = await playlistService.listPlaylists({
        requesterId: mockUserId,
        mine: false,
        limit: 20,
        offset: 0,
      });

      expect(result.items[0].cover_image).toBe('https://example.com/fallback.jpg');
    });
  });

  // ────────────────────────────────────
  // GET PLAYLIST - COMPREHENSIVE COVERAGE
  // ────────────────────────────────────
  describe('getPlaylist', () => {
    it('should fetch public playlist without auth', async () => {
      playlistModel.findPlaylistById.mockResolvedValue(mockPlaylist);
      playlistModel.findPlaylistTracks.mockResolvedValue([mockTrack]);
      playlistModel.getTotalDuration.mockResolvedValue(180);
      playlistLikeModel.isPlaylistLikedByUser.mockResolvedValue(false);
      playlistModel.getTopTrackArt.mockResolvedValue(null);

      const result = await playlistService.getPlaylist({
        playlistId: mockPlaylistId,
        userId: null,
        includeTracks: true,
      });

      expect(result.playlist_id).toBe(mockPlaylistId);
      expect(result.is_liked_by_me).toBe(false);
    });

    it('should fetch private playlist with owner auth', async () => {
      const privatePlaylist = { ...mockPlaylist, is_public: false };
      playlistModel.findPlaylistById.mockResolvedValue(privatePlaylist);
      playlistModel.findPlaylistTracks.mockResolvedValue([]);
      playlistModel.getTotalDuration.mockResolvedValue(0);
      playlistLikeModel.isPlaylistLikedByUser.mockResolvedValue(false);
      playlistModel.getTopTrackArt.mockResolvedValue(null);

      const result = await playlistService.getPlaylist({
        playlistId: mockPlaylistId,
        userId: mockUserId,
        includeTracks: true,
      });

      expect(result.secret_token).toBe('secret123');
    });

    it('should fetch private playlist with secret token', async () => {
      const privatePlaylist = { ...mockPlaylist, is_public: false };
      playlistModel.findPlaylistById.mockResolvedValue(privatePlaylist);
      playlistModel.findPlaylistTracks.mockResolvedValue([]);
      playlistModel.getTotalDuration.mockResolvedValue(0);
      playlistLikeModel.isPlaylistLikedByUser.mockResolvedValue(false);
      playlistModel.getTopTrackArt.mockResolvedValue(null);

      const result = await playlistService.getPlaylist({
        playlistId: mockPlaylistId,
        userId: null,
        secretToken: 'secret123',
        includeTracks: true,
      });

      expect(result).toBeDefined();
    });

    it('should deny access to private playlist without token', async () => {
      const privatePlaylist = { ...mockPlaylist, is_public: false };
      playlistModel.findPlaylistById.mockResolvedValue(privatePlaylist);

      await expect(
        playlistService.getPlaylist({
          playlistId: mockPlaylistId,
          userId: uuidv4(),
          includeTracks: true,
        })
      ).rejects.toThrow();
    });

    it('should throw error when playlist not found', async () => {
      playlistModel.findPlaylistById.mockResolvedValue(null);

      await expect(
        playlistService.getPlaylist({
          playlistId: mockPlaylistId,
          userId: mockUserId,
          includeTracks: true,
        })
      ).rejects.toThrow('not found');
    });

    it('should use first track art as cover fallback', async () => {
      const playlistNoCover = { ...mockPlaylist, cover_image: null };
      playlistModel.findPlaylistById.mockResolvedValue(playlistNoCover);
      playlistModel.findPlaylistTracks.mockResolvedValue([mockTrack]);
      playlistModel.getTotalDuration.mockResolvedValue(180);
      playlistLikeModel.isPlaylistLikedByUser.mockResolvedValue(false);

      const result = await playlistService.getPlaylist({
        playlistId: mockPlaylistId,
        userId: mockUserId,
        includeTracks: true,
      });

      expect(result.cover_image).toBe(mockTrack.cover_image);
    });

    it('should exclude tracks when includeTracks=false', async () => {
      playlistModel.findPlaylistById.mockResolvedValue(mockPlaylist);
      playlistModel.getTotalDuration.mockResolvedValue(180);
      playlistLikeModel.isPlaylistLikedByUser.mockResolvedValue(false);
      playlistModel.getTopTrackArt.mockResolvedValue(null);

      const result = await playlistService.getPlaylist({
        playlistId: mockPlaylistId,
        userId: mockUserId,
        includeTracks: false,
      });

      expect(result.tracks).toBeUndefined();
    });

    it('should mark as liked if user has liked', async () => {
      playlistModel.findPlaylistById.mockResolvedValue(mockPlaylist);
      playlistModel.getTotalDuration.mockResolvedValue(180);
      playlistLikeModel.isPlaylistLikedByUser.mockResolvedValue(true);
      playlistModel.getTopTrackArt.mockResolvedValue(null);

      const result = await playlistService.getPlaylist({
        playlistId: mockPlaylistId,
        userId: mockUserId,
        includeTracks: false,
      });

      expect(result.is_liked_by_me).toBe(true);
    });

    it('should preserve custom cover when no first track', async () => {
      const customCoverUrl = `https://example.com/playlists/${mockPlaylistId}/cover.jpg`;
      playlistModel.findPlaylistById.mockResolvedValue({
        ...mockPlaylist,
        cover_image: customCoverUrl,
      });
      playlistModel.getTotalDuration.mockResolvedValue(180);
      playlistLikeModel.isPlaylistLikedByUser.mockResolvedValue(false);
      playlistModel.getTopTrackArt.mockResolvedValue(null);

      const result = await playlistService.getPlaylist({
        playlistId: mockPlaylistId,
        userId: mockUserId,
        includeTracks: false,
      });

      expect(result.cover_image).toBe(customCoverUrl);
    });

    it('should handle invalid secret token', async () => {
      const privatePlaylist = { ...mockPlaylist, is_public: false };
      playlistModel.findPlaylistById.mockResolvedValue(privatePlaylist);

      await expect(
        playlistService.getPlaylist({
          playlistId: mockPlaylistId,
          userId: null,
          secretToken: 'invalid-token',
          includeTracks: true,
        })
      ).rejects.toThrow();
    });

    it('resolves playlist by slug', async () => {
      playlistModel.findBySlug.mockResolvedValue({ id: mockPlaylistId });
      playlistModel.findPlaylistById.mockResolvedValue(mockPlaylist);
      playlistModel.getTotalDuration.mockResolvedValue(0);
      playlistLikeModel.isPlaylistLikedByUser.mockResolvedValue(false);
      playlistModel.getTopTrackArt.mockResolvedValue(null);

      const result = await playlistService.getPlaylist({
        playlistId: 'my-slug',
        userId: mockUserId,
        includeTracks: false,
      });

      expect(playlistModel.findBySlug).toHaveBeenCalledWith('my-slug');
      expect(result.playlist_id).toBe(mockPlaylistId);
    });
  });

  // ────────────────────────────────────
  // UPDATE PLAYLIST - COMPREHENSIVE COVERAGE
  // ────────────────────────────────────
  describe('updatePlaylist', () => {
    it('should update playlist name', async () => {
      const updated = { ...mockPlaylist, name: 'Updated' };
      playlistModel.findPlaylistById.mockResolvedValue(mockPlaylist);
      playlistModel.updatePlaylist.mockResolvedValue(updated);
      playlistModel.findBySlug.mockResolvedValue(null);
      playlistModel.getTopTrackArt.mockResolvedValue(null);
      playlistModel.replacePlaylistTags.mockResolvedValue([]);

      const result = await playlistService.updatePlaylist({
        playlistId: mockPlaylistId,
        userId: mockUserId,
        name: 'Updated',
      });

      expect(result.playlist.name).toBe('Updated');
    });

    it('uploads cover image using storage service', async () => {
      const updated = { ...mockPlaylist, cover_image: 'https://example.com/new.jpg' };
      playlistModel.findPlaylistById.mockResolvedValue(mockPlaylist);
      storageService.uploadImage.mockResolvedValue({ url: 'https://example.com/new.jpg' });
      playlistModel.updatePlaylist.mockResolvedValue(updated);
      playlistModel.findBySlug.mockResolvedValue(null);
      playlistModel.getTopTrackArt.mockResolvedValue(null);
      playlistModel.replacePlaylistTags.mockResolvedValue([]);

      const result = await playlistService.updatePlaylist({
        playlistId: mockPlaylistId,
        userId: mockUserId,
        coverImageFile: { originalname: 'cover.png', buffer: Buffer.from('x') },
      });

      expect(storageService.uploadImage).toHaveBeenCalled();
      expect(result.playlist.cover_image).toBe('https://example.com/new.jpg');
    });

    it('rejects updates for generated playlists (immutable)', async () => {
      playlistModel.findPlaylistById.mockResolvedValue({ ...mockPlaylist, type: 'curated_daily' });

      await expect(
        playlistService.updatePlaylist({
          playlistId: mockPlaylistId,
          userId: mockUserId,
          name: 'Nope',
        })
      ).rejects.toMatchObject({ code: 'PLAYLIST_GENERATED_IMMUTABLE' });
    });

    it('should reject update when no fields provided', async () => {
      playlistModel.findPlaylistById.mockResolvedValue(mockPlaylist);

      await expect(
        playlistService.updatePlaylist({
          playlistId: mockPlaylistId,
          userId: mockUserId,
        })
      ).rejects.toThrow('At least one field');
    });

    it('should reject update from non-owner', async () => {
      playlistModel.findPlaylistById.mockResolvedValue(mockPlaylist);

      await expect(
        playlistService.updatePlaylist({
          playlistId: mockPlaylistId,
          userId: uuidv4(),
          name: 'New Name',
        })
      ).rejects.toThrow();
    });

    it('should reject empty name after trim', async () => {
      playlistModel.findPlaylistById.mockResolvedValue(mockPlaylist);

      await expect(
        playlistService.updatePlaylist({
          playlistId: mockPlaylistId,
          userId: mockUserId,
          name: '   ',
        })
      ).rejects.toThrow('empty');
    });

    it('should validate subtype', async () => {
      playlistModel.findPlaylistById.mockResolvedValue(mockPlaylist);

      await expect(
        playlistService.updatePlaylist({
          playlistId: mockPlaylistId,
          userId: mockUserId,
          subtype: 'invalid_subtype',
        })
      ).rejects.toThrow('Invalid subtype');
    });

    it('should require release_date for album subtype', async () => {
      playlistModel.findPlaylistById.mockResolvedValue(mockPlaylist);

      await expect(
        playlistService.updatePlaylist({
          playlistId: mockPlaylistId,
          userId: mockUserId,
          subtype: 'album',
          releaseDateProvided: true,
        })
      ).rejects.toThrow('Release date');
    });

    it('should validate release date format', async () => {
      playlistModel.findPlaylistById.mockResolvedValue(mockPlaylist);

      await expect(
        playlistService.updatePlaylist({
          playlistId: mockPlaylistId,
          userId: mockUserId,
          releaseDate: 'invalid-date',
          releaseDateProvided: true,
        })
      ).rejects.toThrow('Invalid release_date');
    });

    it('should handle future release dates', async () => {
      playlistModel.findPlaylistById.mockResolvedValue(mockPlaylist);

      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);
      const futureDateStr = futureDate.toISOString().split('T')[0];

      // Service accepts future dates (no validation against current date)
      playlistModel.updatePlaylist.mockResolvedValue({
        ...mockPlaylist,
        release_date: futureDateStr,
      });
      playlistModel.findBySlug.mockResolvedValue(null);
      playlistModel.getTopTrackArt.mockResolvedValue(null);
      playlistModel.replacePlaylistTags.mockResolvedValue([]);

      const result = await playlistService.updatePlaylist({
        playlistId: mockPlaylistId,
        userId: mockUserId,
        releaseDate: futureDateStr,
        releaseDateProvided: true,
      });

      expect(result.playlist).toBeDefined();
    });

    it('should reject invalid release dates (29 Feb in non-leap year)', async () => {
      playlistModel.findPlaylistById.mockResolvedValue(mockPlaylist);

      await expect(
        playlistService.updatePlaylist({
          playlistId: mockPlaylistId,
          userId: mockUserId,
          releaseDate: '2027-02-29',
          releaseDateProvided: true,
        })
      ).rejects.toThrow('Invalid release_date');
    });

    it('should validate genre exists', async () => {
      playlistModel.findPlaylistById.mockResolvedValue(mockPlaylist);
      db.query.mockResolvedValue({ rows: [] });

      await expect(
        playlistService.updatePlaylist({
          playlistId: mockPlaylistId,
          userId: mockUserId,
          genreId: uuidv4(),
          genreIdProvided: true,
        })
      ).rejects.toThrow('not found');
    });

    it('should reject more than 10 tags', async () => {
      playlistModel.findPlaylistById.mockResolvedValue(mockPlaylist);
      const tags = Array(11)
        .fill()
        .map((_, i) => `tag${i}`);

      await expect(
        playlistService.updatePlaylist({
          playlistId: mockPlaylistId,
          userId: mockUserId,
          tags,
        })
      ).rejects.toThrow('Maximum of 10 tags');
    });

    it('should upload cover image when provided', async () => {
      const mockFile = { originalname: 'cover.jpg', buffer: Buffer.from('data') };
      playlistModel.findPlaylistById.mockResolvedValue(mockPlaylist);
      playlistModel.updatePlaylist.mockResolvedValue({
        ...mockPlaylist,
        cover_image: 'https://new.url',
      });
      playlistModel.findBySlug.mockResolvedValue(null);
      playlistModel.getTopTrackArt.mockResolvedValue(null);
      playlistModel.replacePlaylistTags.mockResolvedValue([]);
      storageService.deleteAllVersionsByUrl.mockResolvedValue(true);
      storageService.uploadImage.mockResolvedValue({ url: 'https://new.url' });

      const result = await playlistService.updatePlaylist({
        playlistId: mockPlaylistId,
        userId: mockUserId,
        coverImageFile: mockFile,
      });

      expect(storageService.uploadImage).toHaveBeenCalled();
    });

    it('should clear cover image when requested', async () => {
      playlistModel.findPlaylistById.mockResolvedValue(mockPlaylist);
      playlistModel.updatePlaylist.mockResolvedValue({
        ...mockPlaylist,
        cover_image: null,
      });
      playlistModel.findBySlug.mockResolvedValue(null);
      playlistModel.getTopTrackArt.mockResolvedValue(null);
      playlistModel.replacePlaylistTags.mockResolvedValue([]);
      storageService.deleteAllVersionsByUrl.mockResolvedValue(true);

      await playlistService.updatePlaylist({
        playlistId: mockPlaylistId,
        userId: mockUserId,
        clearCoverImage: true,
      });

      expect(storageService.deleteAllVersionsByUrl).toHaveBeenCalled();
    });

    it('should reject generated playlist updates', async () => {
      const generated = { ...mockPlaylist, type: 'curated_daily' };
      playlistModel.findPlaylistById.mockResolvedValue(generated);

      await expect(
        playlistService.updatePlaylist({
          playlistId: mockPlaylistId,
          userId: mockUserId,
          name: 'New',
        })
      ).rejects.toThrow('managed automatically');
    });

    it('should handle tag replacement', async () => {
      playlistModel.findPlaylistById.mockResolvedValue(mockPlaylist);
      playlistModel.replacePlaylistTags.mockResolvedValue(['tag1']);
      playlistModel.getTopTrackArt.mockResolvedValue(null);

      const result = await playlistService.updatePlaylist({
        playlistId: mockPlaylistId,
        userId: mockUserId,
        tags: ['tag1'],
      });

      expect(result.playlist.tags).toEqual(['tag1']);
    });

    it('should update multiple fields simultaneously', async () => {
      const updated = {
        ...mockPlaylist,
        name: 'New Name',
        description: 'New Desc',
        is_public: false,
      };
      playlistModel.findPlaylistById.mockResolvedValue(mockPlaylist);
      playlistModel.updatePlaylist.mockResolvedValue(updated);
      playlistModel.findBySlug.mockResolvedValue(null);
      playlistModel.getTopTrackArt.mockResolvedValue(null);
      playlistModel.replacePlaylistTags.mockResolvedValue([]);

      const result = await playlistService.updatePlaylist({
        playlistId: mockPlaylistId,
        userId: mockUserId,
        name: 'New Name',
        description: 'New Desc',
        isPublic: false,
      });

      expect(result.playlist.name).toBe('New Name');
      expect(result.playlist.description).toBe('New Desc');
    });
  });

  // ────────────────────────────────────
  // DELETE PLAYLIST - COMPREHENSIVE COVERAGE
  // ────────────────────────────────────
  describe('deletePlaylist', () => {
    it('should delete playlist successfully', async () => {
      playlistModel.findPlaylistById.mockResolvedValue(mockPlaylist);
      playlistModel.hardDelete.mockResolvedValue(true);
      storageService.deleteAllVersionsByUrl.mockResolvedValue(true);

      const result = await playlistService.deletePlaylist({
        playlistId: mockPlaylistId,
        userId: mockUserId,
      });

      expect(result).toBe(true);
    });

    it('should throw error when playlist not found', async () => {
      playlistModel.findPlaylistById.mockResolvedValue(null);

      await expect(
        playlistService.deletePlaylist({
          playlistId: mockPlaylistId,
          userId: mockUserId,
        })
      ).rejects.toThrow('not found');
    });

    it('should reject delete from non-owner', async () => {
      playlistModel.findPlaylistById.mockResolvedValue(mockPlaylist);

      await expect(
        playlistService.deletePlaylist({
          playlistId: mockPlaylistId,
          userId: uuidv4(),
        })
      ).rejects.toThrow();
    });

    it('should delete cover image if exists', async () => {
      playlistModel.findPlaylistById.mockResolvedValue(mockPlaylist);
      playlistModel.hardDelete.mockResolvedValue(true);
      storageService.deleteAllVersionsByUrl.mockResolvedValue(true);

      await playlistService.deletePlaylist({
        playlistId: mockPlaylistId,
        userId: mockUserId,
      });

      expect(storageService.deleteAllVersionsByUrl).toHaveBeenCalledWith(mockPlaylist.cover_image);
    });

    it('should reject delete of generated playlist', async () => {
      const generated = { ...mockPlaylist, type: 'curated_daily' };
      playlistModel.findPlaylistById.mockResolvedValue(generated);

      await expect(
        playlistService.deletePlaylist({
          playlistId: mockPlaylistId,
          userId: mockUserId,
        })
      ).rejects.toThrow();
    });
  });

  // ────────────────────────────────────
  // ADD TRACK - COMPREHENSIVE COVERAGE
  // ────────────────────────────────────
  describe('addTrack', () => {
    it('should add track to end of playlist', async () => {
      playlistModel.findPlaylistById.mockResolvedValue(mockPlaylist);
      trackModel.findTrackByIdWithDetails.mockResolvedValue(mockTrack);
      playlistModel.findPlaylistTrack.mockResolvedValue(null);
      playlistModel.getMaxPosition.mockResolvedValue(9);
      playlistModel.insertTrackAtPosition.mockResolvedValue(true);
      playlistModel.findPlaylistTracks.mockResolvedValue([mockTrack]);
      playlistModel.getTopTrackArt.mockResolvedValue(null);

      const result = await playlistService.addTrack({
        playlistId: mockPlaylistId,
        userId: mockUserId,
        trackId: mockTrackId,
      });

      expect(result.playlist).toBeDefined();
    });

    it('should add track at specific position', async () => {
      playlistModel.findPlaylistById.mockResolvedValue(mockPlaylist);
      trackModel.findTrackByIdWithDetails.mockResolvedValue(mockTrack);
      playlistModel.findPlaylistTrack.mockResolvedValue(null);
      playlistModel.getMaxPosition.mockResolvedValue(9);
      playlistModel.shiftPositionsDown.mockResolvedValue(true);
      playlistModel.insertTrackAtPosition.mockResolvedValue(true);
      playlistModel.findPlaylistTracks.mockResolvedValue([mockTrack]);
      playlistModel.getTopTrackArt.mockResolvedValue(null);

      await playlistService.addTrack({
        playlistId: mockPlaylistId,
        userId: mockUserId,
        trackId: mockTrackId,
        position: 5,
      });

      expect(playlistModel.shiftPositionsDown).toHaveBeenCalled();
    });

    it('should reject non-owner', async () => {
      playlistModel.findPlaylistById.mockResolvedValue(mockPlaylist);

      await expect(
        playlistService.addTrack({
          playlistId: mockPlaylistId,
          userId: uuidv4(),
          trackId: mockTrackId,
        })
      ).rejects.toThrow();
    });

    it('should reject if track not found', async () => {
      playlistModel.findPlaylistById.mockResolvedValue(mockPlaylist);
      trackModel.findTrackByIdWithDetails.mockResolvedValue(null);

      await expect(
        playlistService.addTrack({
          playlistId: mockPlaylistId,
          userId: mockUserId,
          trackId: mockTrackId,
        })
      ).rejects.toThrow('not found');
    });

    it('should reject hidden tracks', async () => {
      playlistModel.findPlaylistById.mockResolvedValue(mockPlaylist);
      trackModel.findTrackByIdWithDetails.mockResolvedValue({
        ...mockTrack,
        is_hidden: true,
      });

      await expect(
        playlistService.addTrack({
          playlistId: mockPlaylistId,
          userId: mockUserId,
          trackId: mockTrackId,
        })
      ).rejects.toThrow();
    });

    it('should reject duplicate tracks', async () => {
      playlistModel.findPlaylistById.mockResolvedValue(mockPlaylist);
      trackModel.findTrackByIdWithDetails.mockResolvedValue(mockTrack);
      playlistModel.findPlaylistTrack.mockResolvedValue({ track_id: mockTrackId });

      await expect(
        playlistService.addTrack({
          playlistId: mockPlaylistId,
          userId: mockUserId,
          trackId: mockTrackId,
        })
      ).rejects.toThrow('already exists');
    });

    it('should reject private tracks', async () => {
      playlistModel.findPlaylistById.mockResolvedValue(mockPlaylist);
      trackModel.findTrackByIdWithDetails.mockResolvedValue({
        ...mockTrack,
        is_public: false,
      });

      await expect(
        playlistService.addTrack({
          playlistId: mockPlaylistId,
          userId: mockUserId,
          trackId: mockTrackId,
        })
      ).rejects.toThrow('public tracks');
    });

    it('should reject invalid position', async () => {
      playlistModel.findPlaylistById.mockResolvedValue(mockPlaylist);
      trackModel.findTrackByIdWithDetails.mockResolvedValue(mockTrack);
      playlistModel.findPlaylistTrack.mockResolvedValue(null);
      playlistModel.getMaxPosition.mockResolvedValue(9);

      await expect(
        playlistService.addTrack({
          playlistId: mockPlaylistId,
          userId: mockUserId,
          trackId: mockTrackId,
          position: 100,
        })
      ).rejects.toThrow('Position must');
    });

    it('should reject generated playlist modifications', async () => {
      playlistModel.findPlaylistById.mockResolvedValue({
        ...mockPlaylist,
        type: 'auto_generated',
      });

      await expect(
        playlistService.addTrack({
          playlistId: mockPlaylistId,
          userId: mockUserId,
          trackId: mockTrackId,
        })
      ).rejects.toThrow();
    });
  });

  // ────────────────────────────────────
  // REMOVE TRACK - COMPREHENSIVE COVERAGE
  // ────────────────────────────────────
  describe('removeTrack', () => {
    it('should remove track from playlist', async () => {
      playlistModel.findPlaylistById.mockResolvedValue(mockPlaylist);
      playlistModel.removeTrackFromPlaylist.mockResolvedValue(true);
      playlistModel.findPlaylistTracks.mockResolvedValue([]);
      playlistModel.getTopTrackArt.mockResolvedValue(null);

      const result = await playlistService.removeTrack({
        playlistId: mockPlaylistId,
        userId: mockUserId,
        trackId: mockTrackId,
      });

      expect(result.playlist).toBeDefined();
    });

    it('should throw error if track not in playlist', async () => {
      playlistModel.findPlaylistById.mockResolvedValue(mockPlaylist);
      playlistModel.removeTrackFromPlaylist.mockResolvedValue(false);

      await expect(
        playlistService.removeTrack({
          playlistId: mockPlaylistId,
          userId: mockUserId,
          trackId: mockTrackId,
        })
      ).rejects.toThrow('not found');
    });

    it('should reject non-owner', async () => {
      playlistModel.findPlaylistById.mockResolvedValue(mockPlaylist);

      await expect(
        playlistService.removeTrack({
          playlistId: mockPlaylistId,
          userId: uuidv4(),
          trackId: mockTrackId,
        })
      ).rejects.toThrow();
    });
  });

  // ────────────────────────────────────
  // REORDER TRACKS - COMPREHENSIVE COVERAGE
  // ────────────────────────────────────
  describe('reorderPlaylistTracks', () => {
    it('should reorder tracks successfully', async () => {
      const items = [
        { track_id: uuidv4(), position: 1 },
        { track_id: uuidv4(), position: 2 },
      ];

      playlistModel.findPlaylistById.mockResolvedValue(mockPlaylist);
      playlistModel.getAllTracksInPlaylist.mockResolvedValue([
        items[0].track_id,
        items[1].track_id,
      ]);
      playlistModel.reorderTracks.mockResolvedValue(true);
      playlistModel.findPlaylistTracksPaginated.mockResolvedValue({
        rows: items,
        total: 2,
      });
      playlistModel.getTopTrackArt.mockResolvedValue(null);

      const result = await playlistService.reorderPlaylistTracks({
        playlistId: mockPlaylistId,
        userId: mockUserId,
        items,
      });

      expect(result.tracks).toHaveLength(2);
    });

    it('should reject empty items array', async () => {
      playlistModel.findPlaylistById.mockResolvedValue(mockPlaylist);

      await expect(
        playlistService.reorderPlaylistTracks({
          playlistId: mockPlaylistId,
          userId: mockUserId,
          items: [],
        })
      ).rejects.toThrow();
    });

    it('should reject item count mismatch', async () => {
      playlistModel.findPlaylistById.mockResolvedValue(mockPlaylist);
      playlistModel.getAllTracksInPlaylist.mockResolvedValue([uuidv4(), uuidv4()]);

      await expect(
        playlistService.reorderPlaylistTracks({
          playlistId: mockPlaylistId,
          userId: mockUserId,
          items: [{ track_id: uuidv4(), position: 1 }],
        })
      ).rejects.toThrow('full list');
    });

    it('should reject non-owner', async () => {
      playlistModel.findPlaylistById.mockResolvedValue(mockPlaylist);

      await expect(
        playlistService.reorderPlaylistTracks({
          playlistId: mockPlaylistId,
          userId: uuidv4(),
          items: [{ track_id: uuidv4(), position: 1 }],
        })
      ).rejects.toThrow();
    });
  });

  // ────────────────────────────────────
  // GET PLAYLIST TRACKS - COMPREHENSIVE COVERAGE
  // ────────────────────────────────────
  describe('getPlaylistTracks', () => {
    it('should fetch paginated tracks', async () => {
      playlistModel.findPlaylistById.mockResolvedValue(mockPlaylist);
      playlistModel.findPlaylistTracksPaginated.mockResolvedValue({
        rows: [mockTrack],
        total: 1,
      });
      playlistModel.getTotalDuration.mockResolvedValue(180);

      const result = await playlistService.getPlaylistTracks({
        playlistId: mockPlaylistId,
        userId: mockUserId,
        page: 1,
        limit: 20,
      });

      expect(result.tracks).toHaveLength(1);
      expect(result.pagination.page).toBe(1);
    });

    it('should enforce max limit of 100', async () => {
      playlistModel.findPlaylistById.mockResolvedValue(mockPlaylist);
      playlistModel.findPlaylistTracksPaginated.mockResolvedValue({
        rows: [],
        total: 0,
      });
      playlistModel.getTotalDuration.mockResolvedValue(0);

      const result = await playlistService.getPlaylistTracks({
        playlistId: mockPlaylistId,
        userId: mockUserId,
        page: 1,
        limit: 500,
      });

      expect(result.pagination.per_page).toBeLessThanOrEqual(100);
    });

    it('should deny access to private playlist', async () => {
      const privatePlaylist = { ...mockPlaylist, is_public: false };
      playlistModel.findPlaylistById.mockResolvedValue(privatePlaylist);

      await expect(
        playlistService.getPlaylistTracks({
          playlistId: mockPlaylistId,
          userId: uuidv4(),
          page: 1,
          limit: 20,
        })
      ).rejects.toThrow();
    });
  });

  // ────────────────────────────────────
  // GET EMBED - COMPREHENSIVE COVERAGE
  // ────────────────────────────────────
  describe('getEmbed', () => {
    it('should generate embed for public playlist', async () => {
      playlistModel.findPlaylistById.mockResolvedValue(mockPlaylist);

      const result = await playlistService.getEmbed({
        playlistId: mockPlaylistId,
        userId: null,
        theme: 'dark',
      });

      expect(result.embed_url).toBeDefined();
      expect(result.iframe_html).toContain('iframe');
    });

    it('should clamp embed dimensions', async () => {
      playlistModel.findPlaylistById.mockResolvedValue(mockPlaylist);

      const result = await playlistService.getEmbed({
        playlistId: mockPlaylistId,
        userId: null,
        width: 5000,
        height: 5000,
      });

      expect(result.iframe_html).toContain('1200');
    });

    it('should use default theme', async () => {
      playlistModel.findPlaylistById.mockResolvedValue(mockPlaylist);

      const result = await playlistService.getEmbed({
        playlistId: mockPlaylistId,
        userId: null,
      });

      expect(result.embed_url).toBeDefined();
    });

    it('should deny access to private playlist', async () => {
      const privatePlaylist = { ...mockPlaylist, is_public: false };
      playlistModel.findPlaylistById.mockResolvedValue(privatePlaylist);

      await expect(
        playlistService.getEmbed({
          playlistId: mockPlaylistId,
          userId: uuidv4(),
        })
      ).rejects.toThrow();
    });
  });

  // ────────────────────────────────────
  // GET USER PLAYLISTS - COMPREHENSIVE COVERAGE
  // ────────────────────────────────────
  describe('getUserPlaylists', () => {
    it('should fetch user playlists', async () => {
      const targetUser = { id: uuidv4(), is_private: false };
      userModel.findById.mockResolvedValue(targetUser);
      playlistModel.findPublicPlaylists.mockResolvedValue([mockPlaylist]);
      playlistModel.countPublicPlaylists.mockResolvedValue(1);
      playlistModel.getTopTrackArt.mockResolvedValue(null);

      const result = await playlistService.getUserPlaylists({
        targetUserId: targetUser.id,
        requesterId: mockUserId,
        limit: 20,
        offset: 0,
      });

      expect(result.items).toHaveLength(1);
    });

    it('should deny access to private user profile', async () => {
      const targetUser = { id: uuidv4(), is_private: true };
      userModel.findById.mockResolvedValue(targetUser);
      followModel.getFollowStatus.mockResolvedValue({ is_following: false });

      await expect(
        playlistService.getUserPlaylists({
          targetUserId: targetUser.id,
          requesterId: mockUserId,
          limit: 20,
          offset: 0,
        })
      ).rejects.toThrow('private');
    });

    it('should deny access when private profile and requester is missing', async () => {
      const targetUser = { id: uuidv4(), is_private: true };
      userModel.findById.mockResolvedValue(targetUser);

      await expect(
        playlistService.getUserPlaylists({
          targetUserId: targetUser.id,
          requesterId: null,
          limit: 20,
          offset: 0,
        })
      ).rejects.toMatchObject({ code: 'PROFILE_ACCESS_DENIED' });
    });

    it('should allow access if following', async () => {
      const targetUser = { id: uuidv4(), is_private: true };
      userModel.findById.mockResolvedValue(targetUser);
      followModel.getFollowStatus.mockResolvedValue({ is_following: true });
      playlistModel.findPublicPlaylists.mockResolvedValue([mockPlaylist]);
      playlistModel.countPublicPlaylists.mockResolvedValue(1);
      playlistModel.getTopTrackArt.mockResolvedValue(null);

      const result = await playlistService.getUserPlaylists({
        targetUserId: targetUser.id,
        requesterId: mockUserId,
        limit: 20,
        offset: 0,
      });

      expect(result.items).toHaveLength(1);
    });

    it('should throw error when user not found', async () => {
      userModel.findById.mockResolvedValue(null);

      await expect(
        playlistService.getUserPlaylists({
          targetUserId: uuidv4(),
          requesterId: mockUserId,
          limit: 20,
          offset: 0,
        })
      ).rejects.toThrow('not found');
    });
  });

  describe('getUserAlbums', () => {
    it('should fetch user albums (reuses listPlaylists)', async () => {
      const targetUser = { id: uuidv4(), is_private: false };
      userModel.findById.mockResolvedValue(targetUser);
      playlistModel.findPublicPlaylists.mockResolvedValue([mockPlaylist]);
      playlistModel.countPublicPlaylists.mockResolvedValue(1);
      playlistModel.getTopTrackArt.mockResolvedValue(null);

      const result = await playlistService.getUserAlbums({
        targetUserId: targetUser.id,
        requesterId: mockUserId,
        limit: 20,
        offset: 0,
      });

      expect(result.items).toHaveLength(1);
    });
  });

  // ────────────────────────────────────
  // CONVERT PLAYLIST - COMPREHENSIVE COVERAGE
  // ────────────────────────────────────
  describe('convertPlaylist', () => {
    it('should convert generated playlist to regular', async () => {
      const generated = { ...mockPlaylist, type: 'curated_daily' };
      playlistModel.findPlaylistById.mockResolvedValue(generated);
      feedModel.getDailyTracks.mockResolvedValue([mockTrack]);
      playlistModel.create.mockResolvedValue(mockPlaylist);
      playlistModel.findBySlug.mockResolvedValue(null);
      playlistModel.bulkInsertTracks.mockResolvedValue(true);
      db.query.mockResolvedValue({ rows: [] });
      playlistModel.hardDelete.mockResolvedValue(true);
      playlistModel.findPlaylistTracks.mockResolvedValue([mockTrack]);
      playlistModel.getTopTrackArt.mockResolvedValue(null);

      const result = await playlistService.convertPlaylist({
        playlistId: mockPlaylistId,
        userId: mockUserId,
        name: 'My Mix',
        isPublic: true,
      });

      expect(result).toBeDefined();
    });

    it('should reject non-generated playlists', async () => {
      playlistModel.findPlaylistById.mockResolvedValue(mockPlaylist);

      await expect(
        playlistService.convertPlaylist({
          playlistId: mockPlaylistId,
          userId: mockUserId,
          name: 'New',
          isPublic: true,
        })
      ).rejects.toThrow('generated');
    });

    it('should require playlist name', async () => {
      const generated = { ...mockPlaylist, type: 'curated_daily' };
      playlistModel.findPlaylistById.mockResolvedValue(generated);

      await expect(
        playlistService.convertPlaylist({
          playlistId: mockPlaylistId,
          userId: mockUserId,
          name: '',
          isPublic: true,
        })
      ).rejects.toThrow('required');
    });

    it('should reject non-owner conversion', async () => {
      const generated = { ...mockPlaylist, type: 'curated_daily' };
      playlistModel.findPlaylistById.mockResolvedValue(generated);

      await expect(
        playlistService.convertPlaylist({
          playlistId: mockPlaylistId,
          userId: uuidv4(),
          name: 'New',
          isPublic: true,
        })
      ).rejects.toThrow('access');
    });

    it('should handle weekly mix conversion', async () => {
      const generated = { ...mockPlaylist, type: 'curated_weekly' };
      playlistModel.findPlaylistById.mockResolvedValue(generated);
      feedModel.getWeeklyTracks.mockResolvedValue([mockTrack]);
      playlistModel.create.mockResolvedValue(mockPlaylist);
      playlistModel.findBySlug.mockResolvedValue(null);
      playlistModel.bulkInsertTracks.mockResolvedValue(true);
      db.query.mockResolvedValue({ rows: [] });
      playlistModel.hardDelete.mockResolvedValue(true);
      playlistModel.findPlaylistTracks.mockResolvedValue([mockTrack]);
      playlistModel.getTopTrackArt.mockResolvedValue(null);

      const result = await playlistService.convertPlaylist({
        playlistId: mockPlaylistId,
        userId: mockUserId,
        name: 'Weekly',
        isPublic: false,
      });

      expect(result).toBeDefined();
    });

    it('should handle auto_generated conversion', async () => {
      const generated = { ...mockPlaylist, type: 'auto_generated', genre_id: mockGenreId };
      playlistModel.findPlaylistById.mockResolvedValue(generated);
      feedModel.findTracksByGenreId.mockResolvedValue([mockTrack]);
      playlistModel.create.mockResolvedValue(mockPlaylist);
      playlistModel.findBySlug.mockResolvedValue(null);
      playlistModel.bulkInsertTracks.mockResolvedValue(true);
      db.query.mockResolvedValue({ rows: [] });
      playlistModel.hardDelete.mockResolvedValue(true);
      playlistModel.findPlaylistTracks.mockResolvedValue([mockTrack]);
      playlistModel.getTopTrackArt.mockResolvedValue(null);

      const result = await playlistService.convertPlaylist({
        playlistId: mockPlaylistId,
        userId: mockUserId,
        name: 'Genre',
        isPublic: true,
      });

      expect(result).toBeDefined();
    });

    it('should handle other playlist types', async () => {
      const generated = { ...mockPlaylist, type: 'track_radio' };
      playlistModel.findPlaylistById.mockResolvedValue(generated);
      playlistModel.create.mockResolvedValue(mockPlaylist);
      playlistModel.findBySlug.mockResolvedValue(null);
      playlistModel.bulkInsertTracks.mockResolvedValue(true);
      db.query.mockResolvedValue({ rows: [] });
      playlistModel.hardDelete.mockResolvedValue(true);
      playlistModel.findPlaylistTracks.mockResolvedValue([mockTrack]);
      playlistModel.getTopTrackArt.mockResolvedValue(null);

      const result = await playlistService.convertPlaylist({
        playlistId: mockPlaylistId,
        userId: mockUserId,
        name: 'Radio',
        isPublic: false,
      });

      expect(result).toBeDefined();
    });

    it('should 404 when seed playlist missing', async () => {
      playlistModel.findPlaylistById.mockResolvedValue(null);

      await expect(
        playlistService.convertPlaylist({
          playlistId: mockPlaylistId,
          userId: mockUserId,
          name: 'Mix',
          isPublic: true,
        })
      ).rejects.toMatchObject({ code: 'PLAYLIST_NOT_FOUND' });
    });
  });

  // ────────────────────────────────────
  // ADDITIONAL EDGE CASES FOR COVERAGE
  // ────────────────────────────────────
  describe('Additional edge cases and error scenarios', () => {
    it('should handle createPlaylist with null isPublic', async () => {
      playlistModel.findBySlug.mockResolvedValue(null);
      playlistModel.create.mockResolvedValue({
        ...mockPlaylist,
        slug: 'new-playlist',
      });

      const result = await playlistService.createPlaylist({
        userId: mockUserId,
        name: 'New Playlist',
      });

      expect(result).toBeDefined();
    });

    it('should handle listPlaylists with subtype filter', async () => {
      playlistModel.findPublicPlaylists.mockResolvedValue([mockPlaylist]);
      playlistModel.countPublicPlaylists.mockResolvedValue(1);

      const result = await playlistService.listPlaylists({
        subtype: 'album',
        limit: 20,
        offset: 0,
      });

      expect(result).toBeDefined();
    });

    it('should handle deletePlaylist with cover cleanup', async () => {
      playlistModel.findPlaylistById.mockResolvedValue(mockPlaylist);
      playlistModel.hardDelete.mockResolvedValue(mockPlaylist);

      const result = await playlistService.deletePlaylist({
        playlistId: mockPlaylistId,
        userId: mockUserId,
      });

      expect(result).toBeDefined();
    });

    it('should handle addTrack at position 1', async () => {
      playlistModel.findPlaylistById.mockResolvedValue(mockPlaylist);
      playlistModel.findPlaylistTrack.mockResolvedValue(false);
      playlistModel.shiftPositionsDown.mockResolvedValue(true);
      playlistModel.insertTrackAtPosition.mockResolvedValue(true);
      playlistModel.findPlaylistTracks.mockResolvedValue([mockTrackId]);

      const result = await playlistService.addTrack({
        playlistId: mockPlaylistId,
        userId: mockUserId,
        trackId: mockTrackId,
        position: 1,
      });

      expect(result).toBeDefined();
    });

    it('should handle removeTrack from middle', async () => {
      playlistModel.findPlaylistById.mockResolvedValue(mockPlaylist);
      playlistModel.removeTrackFromPlaylist.mockResolvedValue(true);
      playlistModel.findPlaylistTracks.mockResolvedValue([mockTrackId]);
      playlistModel.getTopTrackArt.mockResolvedValue(null);

      const result = await playlistService.removeTrack({
        playlistId: mockPlaylistId,
        userId: mockUserId,
        trackId: mockTrackId,
      });

      expect(result).toBeDefined();
    });

    it('should handle reorderPlaylistTracks with full list', async () => {
      playlistModel.findPlaylistById.mockResolvedValue(mockPlaylist);
      const track2Id = uuidv4();
      playlistModel.getAllTracksInPlaylist.mockResolvedValue([mockTrackId, track2Id]);
      playlistModel.reorderTracks.mockResolvedValue(true);
      playlistModel.findPlaylistTracks.mockResolvedValue([mockTrackId, track2Id]);

      const items = [
        { track_id: track2Id, position: 1 },
        { track_id: mockTrackId, position: 2 },
      ];

      const result = await playlistService.reorderPlaylistTracks({
        playlistId: mockPlaylistId,
        userId: mockUserId,
        items,
      });

      expect(result).toBeDefined();
    });

    it('should handle getPlaylistTracks with valid limit', async () => {
      playlistModel.findPlaylistById.mockResolvedValue(mockPlaylist);
      playlistModel.findPlaylistTracks.mockResolvedValue([mockTrackId]);

      const result = await playlistService.getPlaylistTracks({
        playlistId: mockPlaylistId,
        userId: mockUserId,
        limit: 30,
        offset: 0,
      });

      expect(result).toBeDefined();
    });

    it('should handle getEmbed with default settings', async () => {
      playlistModel.findPlaylistById.mockResolvedValue(mockPlaylist);

      const result = await playlistService.getEmbed({
        playlistId: mockPlaylistId,
        userId: mockUserId,
      });

      expect(result.embed_url).toBeDefined();
    });
  });

  describe('Additional edge cases for coverage', () => {
    it('should throw error when updatePlaylist has no fields provided', async () => {
      playlistModel.findPlaylistById.mockResolvedValue(mockPlaylist);

      await expect(
        playlistService.updatePlaylist({
          playlistId: mockPlaylistId,
          userId: mockUserId,
        })
      ).rejects.toThrow('At least one field must be provided');
    });

    it('should throw error when updatePlaylist with empty name', async () => {
      playlistModel.findPlaylistById.mockResolvedValue(mockPlaylist);

      await expect(
        playlistService.updatePlaylist({
          playlistId: mockPlaylistId,
          userId: mockUserId,
          name: '   ',
        })
      ).rejects.toThrow('Playlist name cannot be empty');
    });

    it('should throw error when updatePlaylist with invalid subtype', async () => {
      playlistModel.findPlaylistById.mockResolvedValue(mockPlaylist);

      await expect(
        playlistService.updatePlaylist({
          playlistId: mockPlaylistId,
          userId: mockUserId,
          subtype: 'invalid',
        })
      ).rejects.toThrow('Invalid subtype');
    });

    it('should throw error when album subtype without release date', async () => {
      playlistModel.findPlaylistById.mockResolvedValue({
        ...mockPlaylist,
        subtype: 'playlist',
      });

      await expect(
        playlistService.updatePlaylist({
          playlistId: mockPlaylistId,
          userId: mockUserId,
          subtype: 'album',
          releaseDateProvided: false,
        })
      ).rejects.toThrow('Release date is required');
    });

    it('should throw error when invalid release date format', async () => {
      playlistModel.findPlaylistById.mockResolvedValue(mockPlaylist);

      await expect(
        playlistService.updatePlaylist({
          playlistId: mockPlaylistId,
          userId: mockUserId,
          releaseDate: '2026/01/01',
          releaseDateProvided: true,
        })
      ).rejects.toThrow('Invalid release_date format');
    });

    it('should throw error when invalid calendar date', async () => {
      playlistModel.findPlaylistById.mockResolvedValue(mockPlaylist);

      await expect(
        playlistService.updatePlaylist({
          playlistId: mockPlaylistId,
          userId: mockUserId,
          releaseDate: '2026-02-31',
          releaseDateProvided: true,
        })
      ).rejects.toThrow('Invalid release_date value');
    });

    it('should throw error when tags is not array', async () => {
      playlistModel.findPlaylistById.mockResolvedValue(mockPlaylist);

      await expect(
        playlistService.updatePlaylist({
          playlistId: mockPlaylistId,
          userId: mockUserId,
          tags: 'not-an-array',
        })
      ).rejects.toThrow('Tags must be an array');
    });

    it('should throw error when tags exceed max length', async () => {
      playlistModel.findPlaylistById.mockResolvedValue(mockPlaylist);

      const tooManyTags = Array(11).fill('tag');

      await expect(
        playlistService.updatePlaylist({
          playlistId: mockPlaylistId,
          userId: mockUserId,
          tags: tooManyTags,
        })
      ).rejects.toThrow('Maximum of 10 tags');
    });

    it('should throw error when slug is empty string', async () => {
      playlistModel.findPlaylistById.mockResolvedValue(mockPlaylist);

      await expect(
        playlistService.updatePlaylist({
          playlistId: mockPlaylistId,
          userId: mockUserId,
          slug: '',
        })
      ).rejects.toThrow('Slug cannot be empty');
    });

    it('should throw error when user not found in getUserAlbums', async () => {
      userModel.findById.mockResolvedValue(null);

      await expect(
        playlistService.getUserAlbums({
          userId: mockUserId,
          requestingUserId: mockUserId,
        })
      ).rejects.toThrow('User not found');
    });

    it('should throw error when unauthorized delete attempt', async () => {
      playlistModel.findPlaylistById.mockResolvedValue(mockPlaylist);

      const differentUserId = uuidv4();

      await expect(
        playlistService.deletePlaylist({
          playlistId: mockPlaylistId,
          userId: differentUserId,
        })
      ).rejects.toThrow('You are not allowed to delete');
    });

    it('should throw error when track position validation fails', async () => {
      playlistModel.findPlaylistById.mockResolvedValue(mockPlaylist);

      await expect(
        playlistService.reorderPlaylistTracks({
          playlistId: mockPlaylistId,
          userId: mockUserId,
          items: [
            { track_id: mockTrackId, position: 0 }, // invalid position
          ],
        })
      ).rejects.toThrow();
    });

    it('should throw error when reorder items incomplete', async () => {
      playlistModel.findPlaylistById.mockResolvedValue(mockPlaylist);
      playlistModel.getAllTracksInPlaylist.mockResolvedValue([mockTrackId, uuidv4()]);

      await expect(
        playlistService.reorderPlaylistTracks({
          playlistId: mockPlaylistId,
          userId: mockUserId,
          items: [{ track_id: mockTrackId, position: 1 }], // only one item
        })
      ).rejects.toThrow();
    });

    it('should handle addTrack with duplicate prevention', async () => {
      playlistModel.findPlaylistById.mockResolvedValue(mockPlaylist);
      playlistModel.findPlaylistTrack.mockResolvedValue({ track_id: mockTrackId }); // already exists

      await expect(
        playlistService.addTrack({
          playlistId: mockPlaylistId,
          userId: mockUserId,
          trackId: mockTrackId,
        })
      ).rejects.toThrow('Track already exists in this playlist');
    });

    it('should handle list when no filters provided', async () => {
      playlistModel.findPublicPlaylists.mockResolvedValue([mockPlaylist]);
      playlistModel.countPublicPlaylists.mockResolvedValue(1);

      const result = await playlistService.listPlaylists({
        limit: 20,
        offset: 0,
      });

      expect(result.items).toBeDefined();
      expect(result.meta.total).toBe(1);
    });
  });
});
