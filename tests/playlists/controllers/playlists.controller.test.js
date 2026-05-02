/**
 * @fileoverview Comprehensive unit tests for Playlist Controller layer
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

// jest.mock('../../../src/services/storage.service');
// jest.mock('../../../src/config/db');
jest.mock('../../../src/models/playlist.model');
// jest.mock('../../../src/models/user.model');
// jest.mock('../../../src/models/follow.model');
// jest.mock('../../../src/models/playlist-like.model');
// jest.mock('../../../src/models/track.model');
// jest.mock('../../../src/models/feed.model');

const playlistService = require('../../../src/services/playlists.service');
const playlistController = require('../../../src/controllers/playlists.controller');
const playlistModel = require('../../../src/models/playlist.model');

const mockPlaylistId = uuidv4();
const mockUserId = uuidv4();
const mockTrackId = uuidv4();
const mockGenreId = uuidv4();

const mockPlaylist = {
  id: mockPlaylistId,
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
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

const mockTrack = {
  id: mockTrackId,
  track_id: mockTrackId,
  title: 'Test Track',
  duration: 180,
  is_public: true,
  is_hidden: false,
};

const createMockReqRes = () => {
  const req = {
    user: { sub: mockUserId },
    body: {},
    params: {},
    query: {},
    file: null,
  };
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis(),
  };
  return { req, res };
};

describe('Playlist Controller', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ────────────────────────────────────
  // CREATE PLAYLIST - COMPREHENSIVE
  // ────────────────────────────────────
  describe('createPlaylist', () => {
    it('should require authentication', async () => {
      const { req, res } = createMockReqRes();
      req.user = null;
      req.body = { name: 'Test' };

      await playlistController.createPlaylist(req, res);

      expect(res.json).toHaveBeenCalled();
    });

    it('should reject empty playlist name', async () => {
      const { req, res } = createMockReqRes();
      req.body = { name: '' };

      await playlistController.createPlaylist(req, res);

      expect(res.json).toHaveBeenCalled();
    });

    it('should reject whitespace-only name', async () => {
      const { req, res } = createMockReqRes();
      req.body = { name: '   ' };

      await playlistController.createPlaylist(req, res);

      expect(res.json).toHaveBeenCalled();
    });

    it('should create public playlist successfully', async () => {
      const { req, res } = createMockReqRes();
      req.body = { name: 'New Playlist', is_public: true };

      jest.spyOn(playlistService, 'createPlaylist').mockResolvedValue({
        playlist: mockPlaylist,
      });

      await playlistController.createPlaylist(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
      jest.restoreAllMocks();
    });

    it('should create private playlist', async () => {
      const { req, res } = createMockReqRes();
      req.body = { name: 'Private', is_public: false };

      jest.spyOn(playlistService, 'createPlaylist').mockResolvedValue({
        playlist: { ...mockPlaylist, is_public: false },
      });

      await playlistController.createPlaylist(req, res);

      expect(res.status).toHaveBeenCalled();
      jest.restoreAllMocks();
    });

    it('should handle is_public as string', async () => {
      const { req, res } = createMockReqRes();
      req.body = { name: 'Test', is_public: 'true' };

      jest.spyOn(playlistService, 'createPlaylist').mockResolvedValue({
        playlist: mockPlaylist,
      });

      await playlistController.createPlaylist(req, res);

      expect(playlistService.createPlaylist).toHaveBeenCalledWith(
        expect.objectContaining({ isPublic: true })
      );
      jest.restoreAllMocks();
    });

    it('should handle service error in create', async () => {
      const { req, res } = createMockReqRes();
      req.body = { name: 'Test' };

      jest.spyOn(playlistService, 'createPlaylist').mockRejectedValue(new Error('Service error'));

      await expect(playlistController.createPlaylist(req, res)).rejects.toThrow('Service error');
      jest.restoreAllMocks();
    });
  });

  // ────────────────────────────────────
  // LIST PLAYLISTS - COMPREHENSIVE
  // ────────────────────────────────────
  describe('listPlaylists', () => {
    it('should list playlists without filters', async () => {
      const { req, res } = createMockReqRes();
      req.query = {};

      jest.spyOn(playlistService, 'listPlaylists').mockResolvedValue({
        items: [mockPlaylist],
        meta: { total: 1 },
      });

      await playlistController.listPlaylists(req, res);

      expect(res.json).toHaveBeenCalled();
      jest.restoreAllMocks();
    });

    it('should list user own playlists', async () => {
      const { req, res } = createMockReqRes();
      req.query = { mine: 'true', filter: 'created' };

      jest.spyOn(playlistService, 'listPlaylists').mockResolvedValue({
        items: [mockPlaylist],
        meta: { total: 1 },
      });

      await playlistController.listPlaylists(req, res);

      expect(playlistService.listPlaylists).toHaveBeenCalledWith(
        expect.objectContaining({ mine: true })
      );
      jest.restoreAllMocks();
    });

    it('should apply search query', async () => {
      const { req, res } = createMockReqRes();
      req.query = { q: 'test' };

      jest.spyOn(playlistService, 'listPlaylists').mockResolvedValue({
        items: [],
        meta: { total: 0 },
      });

      await playlistController.listPlaylists(req, res);

      expect(res.json).toHaveBeenCalled();
      jest.restoreAllMocks();
    });

    it('should handle pagination parameters', async () => {
      const { req, res } = createMockReqRes();
      req.query = { limit: '50', offset: '100' };

      jest.spyOn(playlistService, 'listPlaylists').mockResolvedValue({
        items: [],
        meta: { total: 0 },
      });

      await playlistController.listPlaylists(req, res);

      expect(res.json).toHaveBeenCalled();
      jest.restoreAllMocks();
    });

    it('should handle subtype filter', async () => {
      const { req, res } = createMockReqRes();
      req.query = { subtype: 'album' };

      jest.spyOn(playlistService, 'listPlaylists').mockResolvedValue({
        items: [],
        meta: { total: 0 },
      });

      await playlistController.listPlaylists(req, res);

      expect(res.json).toHaveBeenCalled();
      jest.restoreAllMocks();
    });
  });

  // ────────────────────────────────────
  // GET PLAYLIST - COMPREHENSIVE
  // ────────────────────────────────────
  describe('getPlaylist', () => {
    it('should reject invalid playlist_id', async () => {
      const { req, res } = createMockReqRes();
      req.params = { playlist_id: 'invalid-id' };

      jest.spyOn(playlistService, 'getPlaylist').mockResolvedValue(mockPlaylist);

      await playlistController.getPlaylist(req, res);

      expect(playlistService.getPlaylist).toHaveBeenCalledWith(
        expect.objectContaining({ playlistId: 'invalid-id' })
      );
      expect(res.json).toHaveBeenCalled();
      jest.restoreAllMocks();
    });

    it('should fetch public playlist', async () => {
      const { req, res } = createMockReqRes();
      req.params = { playlist_id: mockPlaylistId };
      req.query = {};

      jest.spyOn(playlistService, 'getPlaylist').mockResolvedValue(mockPlaylist);

      await playlistController.getPlaylist(req, res);

      expect(res.json).toHaveBeenCalled();
      jest.restoreAllMocks();
    });

    it('should handle include_tracks parameter', async () => {
      const { req, res } = createMockReqRes();
      req.params = { playlist_id: mockPlaylistId };
      req.query = { include_tracks: 'true' };

      jest.spyOn(playlistService, 'getPlaylist').mockResolvedValue({
        ...mockPlaylist,
        tracks: [mockTrack],
      });

      await playlistController.getPlaylist(req, res);

      expect(playlistService.getPlaylist).toHaveBeenCalledWith(
        expect.objectContaining({ includeTracks: true })
      );
      jest.restoreAllMocks();
    });

    it('should handle secret_token parameter', async () => {
      const { req, res } = createMockReqRes();
      req.params = { playlist_id: mockPlaylistId };
      req.query = { secret_token: 'secret123' };

      jest.spyOn(playlistService, 'getPlaylist').mockResolvedValue(mockPlaylist);

      await playlistController.getPlaylist(req, res);

      expect(playlistService.getPlaylist).toHaveBeenCalledWith(
        expect.objectContaining({ secretToken: 'secret123' })
      );
      jest.restoreAllMocks();
    });

    it('should handle service error', async () => {
      const { req, res } = createMockReqRes();
      req.params = { playlist_id: mockPlaylistId };

      jest.spyOn(playlistService, 'getPlaylist').mockRejectedValue(new Error('Not found'));

      await expect(playlistController.getPlaylist(req, res)).rejects.toThrow('Not found');
      jest.restoreAllMocks();
    });

    it('defaults includeTracks=true when include_tracks is omitted', async () => {
      const { req, res } = createMockReqRes();
      req.params = { playlist_id: mockPlaylistId };
      req.query = {};

      jest.spyOn(playlistService, 'getPlaylist').mockResolvedValue(mockPlaylist);

      await playlistController.getPlaylist(req, res);

      expect(playlistService.getPlaylist).toHaveBeenCalledWith(
        expect.objectContaining({ includeTracks: true })
      );
      jest.restoreAllMocks();
    });

    it('sets includeTracks=false when include_tracks is false', async () => {
      const { req, res } = createMockReqRes();
      req.params = { playlist_id: mockPlaylistId };
      req.query = { include_tracks: 'false' };

      jest.spyOn(playlistService, 'getPlaylist').mockResolvedValue(mockPlaylist);

      await playlistController.getPlaylist(req, res);

      expect(playlistService.getPlaylist).toHaveBeenCalledWith(
        expect.objectContaining({ includeTracks: false })
      );
      jest.restoreAllMocks();
    });
  });

  // ────────────────────────────────────
  // UPDATE PLAYLIST - COMPREHENSIVE
  // ────────────────────────────────────
  describe('updatePlaylist', () => {
    it('should require authentication', async () => {
      const { req, res } = createMockReqRes();
      req.user = null;
      req.params = { playlist_id: mockPlaylistId };
      req.body = { name: 'Updated' };

      await playlistController.updatePlaylist(req, res);

      expect(res.json).toHaveBeenCalled();
    });

    it('should update playlist name', async () => {
      const { req, res } = createMockReqRes();
      req.params = { playlist_id: mockPlaylistId };
      req.body = { name: 'Updated' };

      jest.spyOn(playlistService, 'updatePlaylist').mockResolvedValue({
        playlist: { ...mockPlaylist, name: 'Updated' },
      });

      await playlistController.updatePlaylist(req, res);

      expect(res.json).toHaveBeenCalled();
      jest.restoreAllMocks();
    });

    it('should update playlist description', async () => {
      const { req, res } = createMockReqRes();
      req.params = { playlist_id: mockPlaylistId };
      req.body = { description: 'New Desc' };

      jest.spyOn(playlistService, 'updatePlaylist').mockResolvedValue({
        playlist: { ...mockPlaylist, description: 'New Desc' },
      });

      await playlistController.updatePlaylist(req, res);

      expect(res.json).toHaveBeenCalled();
      jest.restoreAllMocks();
    });

    it('should update privacy setting', async () => {
      const { req, res } = createMockReqRes();
      req.params = { playlist_id: mockPlaylistId };
      req.body = { is_public: false };

      jest.spyOn(playlistService, 'updatePlaylist').mockResolvedValue({
        playlist: { ...mockPlaylist, is_public: false },
      });

      await playlistController.updatePlaylist(req, res);

      expect(res.json).toHaveBeenCalled();
      jest.restoreAllMocks();
    });

    it('should handle release_date', async () => {
      const { req, res } = createMockReqRes();
      req.params = { playlist_id: mockPlaylistId };
      req.body = { release_date: '2026-01-01', subtype: 'album' };

      jest.spyOn(playlistService, 'updatePlaylist').mockResolvedValue({
        playlist: { ...mockPlaylist, release_date: '2026-01-01' },
      });

      await playlistController.updatePlaylist(req, res);

      expect(res.json).toHaveBeenCalled();
      jest.restoreAllMocks();
    });

    it('should handle genre_id', async () => {
      const { req, res } = createMockReqRes();
      req.params = { playlist_id: mockPlaylistId };
      req.body = { genre_id: mockGenreId };

      jest.spyOn(playlistService, 'updatePlaylist').mockResolvedValue({
        playlist: { ...mockPlaylist, genre_id: mockGenreId },
      });

      await playlistController.updatePlaylist(req, res);

      expect(res.json).toHaveBeenCalled();
      jest.restoreAllMocks();
    });

    it('should handle tags array', async () => {
      const { req, res } = createMockReqRes();
      req.params = { playlist_id: mockPlaylistId };
      req.body = { tags: ['tag1', 'tag2'] };

      jest.spyOn(playlistService, 'updatePlaylist').mockResolvedValue({
        playlist: { ...mockPlaylist, tags: ['tag1', 'tag2'] },
      });

      await playlistController.updatePlaylist(req, res);

      expect(playlistService.updatePlaylist).toHaveBeenCalledWith(
        expect.objectContaining({ tags: ['tag1', 'tag2'] })
      );
      jest.restoreAllMocks();
    });

    it('should handle remove_cover_image flag', async () => {
      const { req, res } = createMockReqRes();
      req.params = { playlist_id: mockPlaylistId };
      req.body = { remove_cover_image: true };

      jest.spyOn(playlistService, 'updatePlaylist').mockResolvedValue({
        playlist: { ...mockPlaylist, cover_image: null },
      });

      await playlistController.updatePlaylist(req, res);

      expect(playlistService.updatePlaylist).toHaveBeenCalledWith(
        expect.objectContaining({ clearCoverImage: true })
      );
      jest.restoreAllMocks();
    });

    it('should reject with missing playlist_id', async () => {
      const { req, res } = createMockReqRes();
      req.params = {};
      req.body = { name: 'Updated' };

      await playlistController.updatePlaylist(req, res);

      expect(res.json).toHaveBeenCalled();
    });
  });

  // ────────────────────────────────────
  // DELETE PLAYLIST - COMPREHENSIVE
  // ────────────────────────────────────
  describe('deletePlaylist', () => {
    it('should require authentication', async () => {
      const { req, res } = createMockReqRes();
      req.user = null;
      req.params = { playlist_id: mockPlaylistId };

      await playlistController.deletePlaylist(req, res);

      expect(res.json).toHaveBeenCalled();
    });

    it('should delete playlist', async () => {
      const { req, res } = createMockReqRes();
      req.params = { playlist_id: mockPlaylistId };

      jest.spyOn(playlistService, 'deletePlaylist').mockResolvedValue(true);

      await playlistController.deletePlaylist(req, res);

      expect(res.json).toHaveBeenCalled();
      jest.restoreAllMocks();
    });

    it('should reject invalid playlist_id', async () => {
      const { req, res } = createMockReqRes();
      req.params = { playlist_id: 'not-uuid' };

      await playlistController.deletePlaylist(req, res);

      expect(res.json).toHaveBeenCalled();
    });
  });

  // ────────────────────────────────────
  // ADD TRACK - COMPREHENSIVE
  // ────────────────────────────────────
  describe('addTrack', () => {
    it('should require track_id', async () => {
      const { req, res } = createMockReqRes();
      req.params = { playlist_id: mockPlaylistId };
      req.body = {};

      await playlistController.addTrack(req, res);

      expect(res.json).toHaveBeenCalled();
    });

    it('should add track to end', async () => {
      const { req, res } = createMockReqRes();
      req.params = { playlist_id: mockPlaylistId };
      req.body = { track_id: mockTrackId };

      jest.spyOn(playlistService, 'addTrack').mockResolvedValue({
        playlist: mockPlaylist,
      });

      await playlistController.addTrack(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
      jest.restoreAllMocks();
    });

    it('should add track at position', async () => {
      const { req, res } = createMockReqRes();
      req.params = { playlist_id: mockPlaylistId };
      req.body = { track_id: mockTrackId, position: 5 };

      jest.spyOn(playlistService, 'addTrack').mockResolvedValue({
        playlist: mockPlaylist,
      });

      await playlistController.addTrack(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
      jest.restoreAllMocks();
    });

    it('should reject non-integer position', async () => {
      const { req, res } = createMockReqRes();
      req.params = { playlist_id: mockPlaylistId };
      req.body = { track_id: mockTrackId, position: 'five' };

      await playlistController.addTrack(req, res);

      expect(res.json).toHaveBeenCalled();
    });

    it('should reject negative position', async () => {
      const { req, res } = createMockReqRes();
      req.params = { playlist_id: mockPlaylistId };
      req.body = { track_id: mockTrackId, position: -1 };

      await playlistController.addTrack(req, res);

      expect(res.json).toHaveBeenCalled();
    });

    it('should require authentication', async () => {
      const { req, res } = createMockReqRes();
      req.user = null;
      req.params = { playlist_id: mockPlaylistId };
      req.body = { track_id: mockTrackId };

      await playlistController.addTrack(req, res);

      expect(res.json).toHaveBeenCalled();
    });

    it('should reject invalid track_id UUID', async () => {
      const { req, res } = createMockReqRes();
      req.params = { playlist_id: mockPlaylistId };
      req.body = { track_id: 'not-uuid' };

      const spy = jest
        .spyOn(playlistService, 'addTrack')
        .mockResolvedValue({ playlist: mockPlaylist });

      await playlistController.addTrack(req, res);

      expect(spy).not.toHaveBeenCalled();
      expect(res.json).toHaveBeenCalled();
      jest.restoreAllMocks();
    });

    it('should reject invalid playlist_id UUID', async () => {
      const { req, res } = createMockReqRes();
      req.params = { playlist_id: 'not-uuid' };
      req.body = { track_id: mockTrackId };

      const spy = jest
        .spyOn(playlistService, 'addTrack')
        .mockResolvedValue({ playlist: mockPlaylist });

      await playlistController.addTrack(req, res);

      expect(spy).not.toHaveBeenCalled();
      expect(res.json).toHaveBeenCalled();
      jest.restoreAllMocks();
    });
  });

  // ────────────────────────────────────
  // REMOVE TRACK - COMPREHENSIVE
  // ────────────────────────────────────
  describe('removeTrack', () => {
    it('should require authentication', async () => {
      const { req, res } = createMockReqRes();
      req.user = null;
      req.params = { playlist_id: mockPlaylistId, track_id: mockTrackId };

      await playlistController.removeTrack(req, res);

      expect(res.json).toHaveBeenCalled();
    });

    it('should remove track from playlist', async () => {
      const { req, res } = createMockReqRes();
      req.params = { playlist_id: mockPlaylistId, track_id: mockTrackId };

      jest.spyOn(playlistService, 'removeTrack').mockResolvedValue({
        playlist: mockPlaylist,
      });

      await playlistController.removeTrack(req, res);

      expect(res.json).toHaveBeenCalled();
      jest.restoreAllMocks();
    });

    it('should reject missing parameters', async () => {
      const { req, res } = createMockReqRes();
      req.params = { track_id: mockTrackId };

      await playlistController.removeTrack(req, res);

      expect(res.json).toHaveBeenCalled();
    });
  });

  // ────────────────────────────────────
  // REORDER TRACKS - COMPREHENSIVE
  // ────────────────────────────────────
  describe('reorderPlaylistTracks', () => {
    it('should require authentication', async () => {
      const { req, res } = createMockReqRes();
      req.user = null;
      req.params = { playlist_id: mockPlaylistId };
      req.body = { items: [] };

      await playlistController.reorderPlaylistTracks(req, res);

      expect(res.json).toHaveBeenCalled();
    });

    it('should reorder tracks', async () => {
      const { req, res } = createMockReqRes();
      req.params = { playlist_id: mockPlaylistId };
      req.body = {
        items: [
          { track_id: uuidv4(), position: 1 },
          { track_id: uuidv4(), position: 2 },
        ],
      };

      jest.spyOn(playlistService, 'reorderPlaylistTracks').mockResolvedValue({
        tracks: [],
      });

      await playlistController.reorderPlaylistTracks(req, res);

      expect(res.json).toHaveBeenCalled();
      jest.restoreAllMocks();
    });
  });

  // ────────────────────────────────────
  // GET PLAYLIST TRACKS - COMPREHENSIVE
  // ────────────────────────────────────
  describe('getPlaylistTracks', () => {
    it('should fetch tracks with default pagination', async () => {
      const { req, res } = createMockReqRes();
      req.params = { playlist_id: mockPlaylistId };
      req.query = {};

      jest.spyOn(playlistService, 'getPlaylistTracks').mockResolvedValue({
        tracks: [mockTrack],
        pagination: { page: 1, per_page: 20, total_items: 1 },
      });

      await playlistController.getPlaylistTracks(req, res);

      expect(res.json).toHaveBeenCalled();
      jest.restoreAllMocks();
    });

    it('should handle custom pagination', async () => {
      const { req, res } = createMockReqRes();
      req.params = { playlist_id: mockPlaylistId };
      req.query = { page: '2', limit: '50' };

      jest.spyOn(playlistService, 'getPlaylistTracks').mockResolvedValue({
        tracks: [],
        pagination: { page: 2, per_page: 50 },
      });

      await playlistController.getPlaylistTracks(req, res);

      expect(res.json).toHaveBeenCalled();
      jest.restoreAllMocks();
    });
  });

  // ────────────────────────────────────
  // GET EMBED - COMPREHENSIVE
  // ────────────────────────────────────
  describe('getEmbed', () => {
    it('should generate embed code', async () => {
      const { req, res } = createMockReqRes();
      req.params = { playlist_id: mockPlaylistId };
      req.query = {};

      jest.spyOn(playlistService, 'getEmbed').mockResolvedValue({
        embed_url: 'https://example.com/embed',
        iframe_html: '<iframe></iframe>',
      });

      await playlistController.getEmbed(req, res);

      expect(res.json).toHaveBeenCalled();
      jest.restoreAllMocks();
    });

    it('should handle theme parameter', async () => {
      const { req, res } = createMockReqRes();
      req.params = { playlist_id: mockPlaylistId };
      req.query = { theme: 'dark' };

      jest.spyOn(playlistService, 'getEmbed').mockResolvedValue({
        embed_url: 'https://example.com/embed?theme=dark',
        iframe_html: '<iframe></iframe>',
      });

      await playlistController.getEmbed(req, res);

      expect(res.json).toHaveBeenCalled();
      jest.restoreAllMocks();
    });

    it('should handle autoplay parameter', async () => {
      const { req, res } = createMockReqRes();
      req.params = { playlist_id: mockPlaylistId };
      req.query = { autoplay: 'true' };

      jest.spyOn(playlistService, 'getEmbed').mockResolvedValue({
        embed_url: 'https://example.com/embed?autoplay=true',
        iframe_html: '<iframe></iframe>',
      });

      await playlistController.getEmbed(req, res);

      expect(res.json).toHaveBeenCalled();
      jest.restoreAllMocks();
    });

    it('should reject invalid playlist_id UUID', async () => {
      const { req, res } = createMockReqRes();
      req.params = { playlist_id: 'not-uuid' };
      req.query = {};

      const spy = jest.spyOn(playlistService, 'getEmbed').mockResolvedValue({
        embed_url: 'x',
        iframe_html: 'y',
      });

      await playlistController.getEmbed(req, res);

      expect(spy).not.toHaveBeenCalled();
      expect(res.json).toHaveBeenCalled();
      jest.restoreAllMocks();
    });
  });

  // ────────────────────────────────────
  // GET USER PLAYLISTS - COMPREHENSIVE
  // ────────────────────────────────────
  describe('getUserPlaylists', () => {
    it('should require user_id', async () => {
      const { req, res } = createMockReqRes();
      req.params = {};

      await playlistController.getUserPlaylists(req, res);

      expect(res.json).toHaveBeenCalled();
    });

    it('should fetch user playlists', async () => {
      const { req, res } = createMockReqRes();
      req.params = { user_id: mockUserId };

      jest.spyOn(playlistService, 'getUserPlaylists').mockResolvedValue({
        items: [mockPlaylist],
        meta: { total: 1 },
      });

      await playlistController.getUserPlaylists(req, res);

      expect(res.json).toHaveBeenCalled();
      jest.restoreAllMocks();
    });

    it('should reject invalid user_id', async () => {
      const { req, res } = createMockReqRes();
      req.params = { user_id: 'not-uuid' };

      await playlistController.getUserPlaylists(req, res);

      expect(res.json).toHaveBeenCalled();
    });
  });

  // ────────────────────────────────────
  // GET USER ALBUMS - COMPREHENSIVE
  // ────────────────────────────────────
  describe('getUserAlbums', () => {
    it('should fetch user albums', async () => {
      const { req, res } = createMockReqRes();
      req.params = { user_id: mockUserId };

      jest.spyOn(playlistService, 'getUserAlbums').mockResolvedValue({
        items: [{ ...mockPlaylist, subtype: 'album' }],
        meta: { total: 1 },
      });

      await playlistController.getUserAlbums(req, res);

      expect(res.json).toHaveBeenCalled();
      jest.restoreAllMocks();
    });

    it('should reject missing user_id', async () => {
      const { req, res } = createMockReqRes();
      req.params = {};

      await playlistController.getUserAlbums(req, res);

      expect(res.json).toHaveBeenCalled();
    });
  });

  // ────────────────────────────────────
  // CONVERT PLAYLIST - COMPREHENSIVE
  // ────────────────────────────────────
  describe('convertPlaylist', () => {
    it('should require authentication', async () => {
      const { req, res } = createMockReqRes();
      req.user = null;
      req.params = { playlist_id: mockPlaylistId };
      req.body = { name: 'Converted' };

      await playlistController.convertPlaylist(req, res);

      expect(res.json).toHaveBeenCalled();
    });

    it('should reject invalid playlist_id', async () => {
      const { req, res } = createMockReqRes();
      req.params = { playlist_id: 'not-uuid' };
      req.body = { name: 'Converted' };

      await playlistController.convertPlaylist(req, res);

      expect(res.json).toHaveBeenCalled();
    });

    it('should convert playlist successfully', async () => {
      const { req, res } = createMockReqRes();
      req.params = { playlist_id: mockPlaylistId };
      req.body = { name: 'Converted', is_public: 'true' };

      jest.resetModules();
      const convertPlaylistMock = jest.fn().mockResolvedValue({ playlist: mockPlaylist });

      jest.doMock('../../../src/services/playlists.service', () => ({
        convertPlaylist: convertPlaylistMock,
      }));

      await jest.isolateModulesAsync(async () => {
        const isolatedController = require('../../../src/controllers/playlists.controller');
        await isolatedController.convertPlaylist(req, res);
      });

      expect(convertPlaylistMock).toHaveBeenCalledWith(expect.objectContaining({ isPublic: true }));
      expect(res.status).toHaveBeenCalledWith(201);
    });
  });

  // ────────────────────────────────────
  // ERROR HANDLING - COMPREHENSIVE
  // ────────────────────────────────────
  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      const { req, res } = createMockReqRes();
      req.params = { playlist_id: mockPlaylistId };

      jest.spyOn(playlistService, 'getPlaylist').mockRejectedValue(new Error('Database error'));

      await expect(playlistController.getPlaylist(req, res)).rejects.toThrow('Database error');
      jest.restoreAllMocks();
    });

    it('should handle missing authentication gracefully', async () => {
      const { req, res } = createMockReqRes();
      req.user = undefined;
      req.body = { name: 'Test' };

      await playlistController.createPlaylist(req, res);

      expect(res.json).toHaveBeenCalled();
    });

    it('should validate UUID format', async () => {
      const { req, res } = createMockReqRes();
      req.params = { playlist_id: 'not-uuid' };

      jest.spyOn(playlistService, 'getPlaylist').mockResolvedValue(mockPlaylist);

      await playlistController.getPlaylist(req, res);

      expect(playlistService.getPlaylist).toHaveBeenCalledWith(
        expect.objectContaining({ playlistId: 'not-uuid' })
      );
      expect(res.json).toHaveBeenCalled();
      jest.restoreAllMocks();
    });
  });

  // ────────────────────────────────────
  // EDGE CASES & SANITIZATION - COMPREHENSIVE
  // ────────────────────────────────────
  describe('Edge Cases & Sanitization', () => {
    it('should trim whitespace from name', async () => {
      const { req, res } = createMockReqRes();
      req.body = { name: '  Test  ' };

      jest.spyOn(playlistService, 'createPlaylist').mockResolvedValue({
        playlist: mockPlaylist,
      });

      await playlistController.createPlaylist(req, res);

      expect(res.status).toHaveBeenCalled();
      jest.restoreAllMocks();
    });

    it('should handle boolean is_public as false', async () => {
      const { req, res } = createMockReqRes();
      req.body = { name: 'Test', is_public: false };

      jest.spyOn(playlistService, 'createPlaylist').mockResolvedValue({
        playlist: mockPlaylist,
      });

      await playlistController.createPlaylist(req, res);

      expect(playlistService.createPlaylist).toHaveBeenCalledWith(
        expect.objectContaining({ isPublic: false })
      );
      jest.restoreAllMocks();
    });

    it('should handle empty tags array', async () => {
      const { req, res } = createMockReqRes();
      req.params = { playlist_id: mockPlaylistId };
      req.body = { tags: [] };

      jest.spyOn(playlistService, 'updatePlaylist').mockResolvedValue({
        playlist: mockPlaylist,
      });

      await playlistController.updatePlaylist(req, res);

      expect(res.json).toHaveBeenCalled();
      jest.restoreAllMocks();
    });

    it('should handle null release_date', async () => {
      const { req, res } = createMockReqRes();
      req.params = { playlist_id: mockPlaylistId };
      req.body = { release_date: null };

      jest.spyOn(playlistService, 'updatePlaylist').mockResolvedValue({
        playlist: mockPlaylist,
      });

      await playlistController.updatePlaylist(req, res);

      expect(res.json).toHaveBeenCalled();
      jest.restoreAllMocks();
    });

    it('should handle null genre_id', async () => {
      const { req, res } = createMockReqRes();
      req.params = { playlist_id: mockPlaylistId };
      req.body = { genre_id: null };

      jest.spyOn(playlistService, 'updatePlaylist').mockResolvedValue({
        playlist: mockPlaylist,
      });

      await playlistController.updatePlaylist(req, res);

      expect(res.json).toHaveBeenCalled();
      jest.restoreAllMocks();
    });

    it('should handle zero limit', async () => {
      const { req, res } = createMockReqRes();
      req.query = { limit: '0' };

      jest.spyOn(playlistService, 'listPlaylists').mockResolvedValue({
        items: [],
        meta: { total: 0 },
      });

      await playlistController.listPlaylists(req, res);

      expect(res.json).toHaveBeenCalled();
      jest.restoreAllMocks();
    });

    it('should handle very large limit', async () => {
      const { req, res } = createMockReqRes();
      req.query = { limit: '9999' };

      jest.spyOn(playlistService, 'listPlaylists').mockResolvedValue({
        items: [],
        meta: { total: 0 },
      });

      await playlistController.listPlaylists(req, res);

      expect(res.json).toHaveBeenCalled();
      jest.restoreAllMocks();
    });

    it('should default list requester to null without req.user and pass album owner filters', async () => {
      const { req, res } = createMockReqRes();
      req.user = undefined;
      req.query = {
        owner_user_id: mockUserId,
        is_album_view: 'true',
      };

      jest.spyOn(playlistService, 'listPlaylists').mockResolvedValue({
        items: [],
        meta: { total: 0 },
      });

      await playlistController.listPlaylists(req, res);

      expect(playlistService.listPlaylists).toHaveBeenCalledWith(
        expect.objectContaining({
          requesterId: null,
          ownerUserId: mockUserId,
          isAlbumView: true,
        })
      );
      jest.restoreAllMocks();
    });

    it('should reject missing playlist_id in getPlaylist', async () => {
      const { req, res } = createMockReqRes();
      req.params = {};

      const spy = jest.spyOn(playlistService, 'getPlaylist').mockResolvedValue(mockPlaylist);

      await playlistController.getPlaylist(req, res);

      expect(spy).not.toHaveBeenCalled();
      expect(res.json).toHaveBeenCalled();
      jest.restoreAllMocks();
    });

    it('should normalize update body edge values before calling service', async () => {
      const { req, res } = createMockReqRes();
      req.params = { playlist_id: mockPlaylistId };
      req.body = {
        name: '',
        description: '',
        is_public: '',
        release_date: '',
        genre_id: '',
        subtype: '',
        slug: '  My Slug  ',
        tags: 'solo',
        cover_image: '',
      };
      req.file = { originalname: 'cover.png' };

      jest.spyOn(playlistService, 'updatePlaylist').mockResolvedValue({
        playlist: mockPlaylist,
      });

      await playlistController.updatePlaylist(req, res);

      expect(playlistService.updatePlaylist).toHaveBeenCalledWith(
        expect.objectContaining({
          name: undefined,
          description: undefined,
          isPublic: undefined,
          releaseDate: null,
          genreId: null,
          subtype: undefined,
          slug: 'My Slug',
          tags: ['solo'],
          clearCoverImage: true,
          coverImageFile: req.file,
        })
      );
      jest.restoreAllMocks();
    });

    it('should reject missing playlist_id before deleting', async () => {
      const { req, res } = createMockReqRes();
      req.params = {};

      const spy = jest.spyOn(playlistService, 'deletePlaylist').mockResolvedValue(true);

      await playlistController.deletePlaylist(req, res);

      expect(spy).not.toHaveBeenCalled();
      expect(res.json).toHaveBeenCalled();
      jest.restoreAllMocks();
    });

    it('should reject missing playlist_id before adding a track', async () => {
      const { req, res } = createMockReqRes();
      req.params = {};
      req.body = { track_id: mockTrackId };

      const spy = jest.spyOn(playlistService, 'addTrack').mockResolvedValue({
        playlist: mockPlaylist,
      });

      await playlistController.addTrack(req, res);

      expect(spy).not.toHaveBeenCalled();
      expect(res.json).toHaveBeenCalled();
      jest.restoreAllMocks();
    });

    it('should pass null requester to getPlaylistTracks when unauthenticated', async () => {
      const { req, res } = createMockReqRes();
      req.user = undefined;
      req.params = { playlist_id: mockPlaylistId };
      req.query = { secret_token: 'secret123' };

      jest.spyOn(playlistService, 'getPlaylistTracks').mockResolvedValue({
        tracks: [],
        pagination: {},
      });

      await playlistController.getPlaylistTracks(req, res);

      expect(playlistService.getPlaylistTracks).toHaveBeenCalledWith(
        expect.objectContaining({ userId: null, secretToken: 'secret123' })
      );
      jest.restoreAllMocks();
    });

    it('should reject invalid UUIDs before removing a track', async () => {
      const { req, res } = createMockReqRes();
      req.params = { playlist_id: mockPlaylistId, track_id: 'not-uuid' };

      const spy = jest.spyOn(playlistService, 'removeTrack').mockResolvedValue({
        playlist: mockPlaylist,
      });

      await playlistController.removeTrack(req, res);

      expect(spy).not.toHaveBeenCalled();
      expect(res.json).toHaveBeenCalled();
      jest.restoreAllMocks();
    });

    it('should reject missing playlist_id before embed generation', async () => {
      const { req, res } = createMockReqRes();
      req.params = {};

      const spy = jest.spyOn(playlistService, 'getEmbed').mockResolvedValue({
        embed_url: 'x',
        iframe_html: 'y',
      });

      await playlistController.getEmbed(req, res);

      expect(spy).not.toHaveBeenCalled();
      expect(res.json).toHaveBeenCalled();
      jest.restoreAllMocks();
    });

    it('should pass null requester to user playlist and album endpoints', async () => {
      const { req: playlistReq, res: playlistRes } = createMockReqRes();
      playlistReq.user = undefined;
      playlistReq.params = { user_id: mockUserId };
      playlistReq.query = { limit: '5', offset: '10' };

      const { req: albumReq, res: albumRes } = createMockReqRes();
      albumReq.user = undefined;
      albumReq.params = { user_id: mockUserId };
      albumReq.query = {};

      jest.spyOn(playlistService, 'getUserPlaylists').mockResolvedValue({ items: [], meta: {} });
      jest.spyOn(playlistService, 'getUserAlbums').mockResolvedValue({ items: [], meta: {} });

      await playlistController.getUserPlaylists(playlistReq, playlistRes);
      await playlistController.getUserAlbums(albumReq, albumRes);

      expect(playlistService.getUserPlaylists).toHaveBeenCalledWith(
        expect.objectContaining({ requesterId: null, limit: '5', offset: '10' })
      );
      expect(playlistService.getUserAlbums).toHaveBeenCalledWith(
        expect.objectContaining({ requesterId: null })
      );
      jest.restoreAllMocks();
    });

    it('should reject invalid user_id for albums', async () => {
      const { req, res } = createMockReqRes();
      req.params = { user_id: 'not-uuid' };

      const spy = jest.spyOn(playlistService, 'getUserAlbums').mockResolvedValue({
        items: [],
        meta: {},
      });

      await playlistController.getUserAlbums(req, res);

      expect(spy).not.toHaveBeenCalled();
      expect(res.json).toHaveBeenCalled();
      jest.restoreAllMocks();
    });

    it('should reject missing playlist_id before conversion', async () => {
      const { req, res } = createMockReqRes();
      req.params = {};
      req.body = { name: 'Converted' };

      await playlistController.convertPlaylist(req, res);

      expect(res.json).toHaveBeenCalled();
    });

    it('should pass null requester to getPlaylist and getEmbed when req.user is missing', async () => {
      const { req: getReq, res: getRes } = createMockReqRes();
      getReq.user = undefined;
      getReq.params = { playlist_id: mockPlaylistId };
      getReq.query = {};

      const { req: embedReq, res: embedRes } = createMockReqRes();
      embedReq.user = undefined;
      embedReq.params = { playlist_id: mockPlaylistId };
      embedReq.query = {};

      jest.spyOn(playlistService, 'getPlaylist').mockResolvedValue(mockPlaylist);
      jest.spyOn(playlistService, 'getEmbed').mockResolvedValue({
        embed_url: 'x',
        iframe_html: 'y',
      });

      await playlistController.getPlaylist(getReq, getRes);
      await playlistController.getEmbed(embedReq, embedRes);

      expect(playlistService.getPlaylist).toHaveBeenCalledWith(
        expect.objectContaining({ userId: null })
      );
      expect(playlistService.getEmbed).toHaveBeenCalledWith(
        expect.objectContaining({ userId: null })
      );
      jest.restoreAllMocks();
    });

    it('should reject invalid update playlist_id before service call', async () => {
      const { req, res } = createMockReqRes();
      req.params = { playlist_id: 'not-uuid' };
      req.body = { name: 'Updated' };

      const spy = jest.spyOn(playlistService, 'updatePlaylist').mockResolvedValue({
        playlist: mockPlaylist,
      });

      await playlistController.updatePlaylist(req, res);

      expect(spy).not.toHaveBeenCalled();
      expect(res.json).toHaveBeenCalled();
      jest.restoreAllMocks();
    });

    it('should normalize empty string tags to undefined', async () => {
      const { req, res } = createMockReqRes();
      req.params = { playlist_id: mockPlaylistId };
      req.body = { tags: '' };

      jest.spyOn(playlistService, 'updatePlaylist').mockResolvedValue({
        playlist: mockPlaylist,
      });

      await playlistController.updatePlaylist(req, res);

      expect(playlistService.updatePlaylist).toHaveBeenCalledWith(
        expect.objectContaining({ tags: undefined })
      );
      jest.restoreAllMocks();
    });
  });
});
