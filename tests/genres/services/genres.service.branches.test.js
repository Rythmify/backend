// ============================================================
// tests/genres/services/genres.service.branches.test.js
// Coverage Target: 100%
// ============================================================

const genresService = require('../../../src/services/genres.service');
const genreModel = require('../../../src/models/genre.model');
const discoveryModel = require('../../../src/models/genrediscovery.model');

jest.mock('../../../src/models/genre.model');
jest.mock('../../../src/models/genrediscovery.model');

describe('Genres Service - Branch Coverage Expansion', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getGenrePage Branches', () => {
    it('handles genre with no playlists (no introducing section)', async () => {
        genreModel.findGenreDetail.mockResolvedValue({ id: 'g1', name: 'G' });
        discoveryModel.findGenreTracks.mockResolvedValue({ tracks: [] });
        discoveryModel.findGenreAlbums.mockResolvedValue({ albums: [] });
        discoveryModel.findGenrePlaylists.mockResolvedValue({ playlists: [] }); // No playlists
        discoveryModel.findGenreArtists.mockResolvedValue({ artists: [] });

        const res = await genresService.getGenrePage({ genreId: 'g1' });
        expect(res.introducing).toBeNull();
    });
  });

  describe('Private Formatters Branches', () => {
    it('formats genre with missing counts and image', async () => {
        genreModel.findGenreDetail.mockResolvedValue({ id: 'g1', name: 'G', cover_image: null, track_count: null });
        const res = await genresService.getGenrePage({ genreId: 'g1' });
        expect(res.genre.cover_image).toBeNull();
        expect(res.genre.track_count).toBe(0);
    });

    it('formats track with missing fields', async () => {
        genreModel.findGenreDetail.mockResolvedValue({ id: 'g1', name: 'G' });
        discoveryModel.findGenreTracks.mockResolvedValue({ tracks: [{ id: 't1', title: 'T' }] }); // Missing cover, duration, etc.
        discoveryModel.findGenreAlbums.mockResolvedValue({ albums: [] });
        discoveryModel.findGenrePlaylists.mockResolvedValue({ playlists: [] });
        discoveryModel.findGenreArtists.mockResolvedValue({ artists: [] });

        const res = await genresService.getGenrePage({ genreId: 'g1' });
        expect(res.tracks[0].cover_image).toBeNull();
        expect(res.tracks[0].play_count).toBe(0);
    });

    it('formats preview track with null values', async () => {
        genreModel.findGenreDetail.mockResolvedValue({ id: 'g1', name: 'G' });
        discoveryModel.findGenrePlaylists.mockResolvedValue({ playlists: [{ id: 'p1' }] });
        discoveryModel.getPlaylistPreviewTracks.mockResolvedValue([{ track_id: 't1', title: 'T' }]); // Missing art, etc.
        
        discoveryModel.findGenreTracks.mockResolvedValue({ tracks: [] });
        discoveryModel.findGenreAlbums.mockResolvedValue({ albums: [] });
        discoveryModel.findGenreArtists.mockResolvedValue({ artists: [] });

        const res = await genresService.getGenrePage({ genreId: 'g1' });
        expect(res.introducing.tracks_preview[0].cover_image).toBeNull();
    });
  });
});
