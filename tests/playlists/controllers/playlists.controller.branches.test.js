// ============================================================
// tests/playlists/controllers/playlists.controller.branches.test.js
// Coverage Target: 100% (Focus on missed branches)
// ============================================================

const playlistController = require('../../../src/controllers/playlists.controller');
const playlistService = require('../../../src/services/playlists.service');
const { v4: uuidv4 } = require('uuid');

jest.mock('../../../src/services/playlists.service');

const createMockReqRes = () => {
  const req = {
    user: { sub: uuidv4() },
    body: {},
    params: {},
    query: {},
    file: null,
  };
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
  return { req, res };
};

describe('Playlists Controller - Branch Coverage Expansion', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Internal Helpers', () => {
    it('validateRequiredFields handles empty string and null', async () => {
        const { req, res } = createMockReqRes();
        // Since we can't call it directly (not exported), we call it via getPlaylist
        req.params = { playlist_id: ' ' };
        await playlistController.getPlaylist(req, res);
        expect(res.status).toHaveBeenCalledWith(400);
    });

    it('getAuthenticatedUserId handles missing sub', async () => {
        const { req, res } = createMockReqRes();
        req.user = {}; // missing sub
        await playlistController.createPlaylist(req, res);
        expect(res.status).toHaveBeenCalledWith(401);
    });
  });

  describe('updatePlaylist Sanitize Branches', () => {
    it('sanitizes empty string to undefined for name', async () => {
        const { req, res } = createMockReqRes();
        const playlistId = uuidv4();
        req.params = { playlist_id: playlistId };
        req.body = { name: '' }; // empty string
        playlistService.updatePlaylist.mockResolvedValue({ playlist: {} });
        await playlistController.updatePlaylist(req, res);
        expect(playlistService.updatePlaylist).toHaveBeenCalledWith(
            expect.objectContaining({ name: undefined })
        );
    });

    it('sanitizes boolean strings and empty strings', async () => {
        const { req, res } = createMockReqRes();
        const playlistId = uuidv4();
        req.params = { playlist_id: playlistId };
        req.body = { is_public: 'true', remove_cover_image: '' };
        playlistService.updatePlaylist.mockResolvedValue({ playlist: {} });
        await playlistController.updatePlaylist(req, res);
        expect(playlistService.updatePlaylist).toHaveBeenCalledWith(
            expect.objectContaining({ isPublic: true, clearCoverImage: false })
        );
    });

    it('sanitizes tags array/string/empty', async () => {
        const { req, res } = createMockReqRes();
        const playlistId = uuidv4();
        req.params = { playlist_id: playlistId };
        req.body = { tags: ['a', '', 'b'] }; // should filter empty
        playlistService.updatePlaylist.mockResolvedValue({ playlist: {} });
        await playlistController.updatePlaylist(req, res);
        expect(playlistService.updatePlaylist).toHaveBeenCalledWith(
            expect.objectContaining({ tags: ['a', 'b'] })
        );

        req.body = { tags: 'single' }; // should wrap in array
        await playlistController.updatePlaylist(req, res);
        expect(playlistService.updatePlaylist).toHaveBeenCalledWith(
            expect.objectContaining({ tags: ['single'] })
        );

        req.body = { tags: '' }; // should be undefined
        await playlistController.updatePlaylist(req, res);
        expect(playlistService.updatePlaylist).toHaveBeenCalledWith(
            expect.objectContaining({ tags: undefined })
        );
    });

    it('handles release_date and genre_id sanitization', async () => {
        const { req, res } = createMockReqRes();
        const playlistId = uuidv4();
        req.params = { playlist_id: playlistId };
        req.body = { release_date: ' ', genre_id: null };
        playlistService.updatePlaylist.mockResolvedValue({ playlist: {} });
        await playlistController.updatePlaylist(req, res);
        expect(playlistService.updatePlaylist).toHaveBeenCalledWith(
            expect.objectContaining({ releaseDate: '', genreId: null })
        );
    });
  });

  describe('listPlaylists Branches', () => {
    it('handles mine and is_album_view as strings', async () => {
        const { req, res } = createMockReqRes();
        req.query = { mine: 'true', is_album_view: 'true' };
        playlistService.listPlaylists.mockResolvedValue({ items: [], meta: {} });
        await playlistController.listPlaylists(req, res);
        expect(playlistService.listPlaylists).toHaveBeenCalledWith(
            expect.objectContaining({ mine: true, isAlbumView: true })
        );
    });
  });

  describe('addTrack Branches', () => {
    it('handles null position', async () => {
        const { req, res } = createMockReqRes();
        req.params = { playlist_id: uuidv4() };
        req.body = { track_id: uuidv4(), position: null };
        playlistService.addTrack.mockResolvedValue({ playlist: {} });
        await playlistController.addTrack(req, res);
        expect(playlistService.addTrack).toHaveBeenCalledWith(
            expect.objectContaining({ position: undefined })
        );
    });
  });

  describe('convertPlaylist Branches', () => {
    it('handles is_public as string', async () => {
        const { req, res } = createMockReqRes();
        req.params = { playlist_id: uuidv4() };
        req.body = { is_public: 'true' };
        playlistService.convertPlaylist.mockResolvedValue({});
        await playlistController.convertPlaylist(req, res);
        expect(playlistService.convertPlaylist).toHaveBeenCalledWith(
            expect.objectContaining({ isPublic: true })
        );
    });
  });
});
