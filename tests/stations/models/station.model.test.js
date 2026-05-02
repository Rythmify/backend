// ============================================================
// tests/stations/models/station.model.test.js
// Coverage Target: 100% (Focus on missed branches)
// ============================================================

const stationModel = require('../../../src/models/station.model');
const db = require('../../../src/config/db');

jest.mock('../../../src/config/db');

describe('Station Model', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('saveStation', () => {
    it('returns created true if insert succeeds', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 's1', user_id: 'u1', artist_id: 'a1' }] });
      const result = await stationModel.saveStation('u1', 'a1');
      expect(result.created).toBe(true);
      expect(result.station.id).toBe('s1');
    });

    it('returns created false and fetches existing if conflict occurs', async () => {
      db.query.mockResolvedValueOnce({ rows: [] }); // ON CONFLICT DO NOTHING -> empty RETURNING
      db.query.mockResolvedValueOnce({ rows: [{ id: 's1', user_id: 'u1', artist_id: 'a1' }] });
      const result = await stationModel.saveStation('u1', 'a1');
      expect(result.created).toBe(false);
      expect(result.station.id).toBe('s1');
    });
  });

  describe('unsaveStation', () => {
    it('returns true if rows deleted', async () => {
      db.query.mockResolvedValueOnce({ rowCount: 1 });
      const result = await stationModel.unsaveStation('u1', 'a1');
      expect(result).toBe(true);
    });

    it('returns false if no rows deleted', async () => {
      db.query.mockResolvedValueOnce({ rowCount: 0 });
      const result = await stationModel.unsaveStation('u1', 'a1');
      expect(result).toBe(false);
    });
  });

  describe('isStationSaved', () => {
    it('returns false if no userId', async () => {
      const result = await stationModel.isStationSaved(null, 'a1');
      expect(result).toBe(false);
    });

    it('returns true if row found', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ 1: 1 }] });
      const result = await stationModel.isStationSaved('u1', 'a1');
      expect(result).toBe(true);
    });

    it('returns false if no row found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });
      const result = await stationModel.isStationSaved('u1', 'a1');
      expect(result).toBe(false);
    });
  });

  describe('getUserSavedStations', () => {
    it('returns items and total', async () => {
      const mockRows = [
        { id: 's1', artist_id: 'a1', artist_name: 'Artist 1', total_count: '2' },
        { id: 's2', artist_id: 'a2', artist_name: 'Artist 2', total_count: '2' }
      ];
      db.query.mockResolvedValueOnce({ rows: mockRows });
      const result = await stationModel.getUserSavedStations('u1', 20, 0);
      expect(result.items).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.items[0].artist_name).toBe('Artist 1');
    });

    it('returns empty if no stations', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });
      const result = await stationModel.getUserSavedStations('u1', 20, 0);
      expect(result.items).toHaveLength(0);
      expect(result.total).toBe(0);
    });
  });

  describe('getSavedStationArtistIds', () => {
    it('returns empty Set if invalid inputs', async () => {
      expect(await stationModel.getSavedStationArtistIds(null, [])).toBeInstanceOf(Set);
      expect(await stationModel.getSavedStationArtistIds('u1', null)).toBeInstanceOf(Set);
      expect(await stationModel.getSavedStationArtistIds('u1', [])).toBeInstanceOf(Set);
    });

    it('returns Set of artist ids', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ artist_id: 'a1' }, { artist_id: 'a2' }] });
      const result = await stationModel.getSavedStationArtistIds('u1', ['a1', 'a2']);
      expect(result.has('a1')).toBe(true);
      expect(result.has('a2')).toBe(true);
      expect(result.size).toBe(2);
    });
  });
});
