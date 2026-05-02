// ============================================================
// tests/resolve.model.unit.test.js
// ============================================================
const model = require('../../../src/models/resolve.model');
const db = require('../../../src/config/db');

jest.mock('../../../src/config/db', () => ({
  query: jest.fn(),
}));

beforeEach(() => jest.clearAllMocks());

const UUID = '11111111-2222-3333-4444-555555555555';

// ══════════════════════════════════════════════════════════════
// trackExists
// ══════════════════════════════════════════════════════════════
describe('trackExists', () => {
  it('returns true when track row found', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ 1: 1 }] });

    await expect(model.trackExists(UUID)).resolves.toBe(true);
    expect(db.query).toHaveBeenCalledWith(expect.any(String), [UUID]);
  });

  it('returns false when no row found', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });

    await expect(model.trackExists(UUID)).resolves.toBe(false);
  });

  it('only matches non-deleted public tracks', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });

    await model.trackExists(UUID);

    const sql = db.query.mock.calls[0][0];
    expect(sql).toMatch(/deleted_at/i);
    expect(sql).toMatch(/is_public/i);
  });
});

// ══════════════════════════════════════════════════════════════
// playlistSubtype
// ══════════════════════════════════════════════════════════════
describe('playlistSubtype', () => {
  it('returns subtype string when playlist found', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ subtype: 'playlist' }] });

    await expect(model.playlistSubtype(UUID)).resolves.toBe('playlist');
    expect(db.query).toHaveBeenCalledWith(expect.any(String), [UUID]);
  });

  it('returns "album" subtype when playlist is an album', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ subtype: 'album' }] });

    await expect(model.playlistSubtype(UUID)).resolves.toBe('album');
  });

  it('returns null when playlist not found', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });

    await expect(model.playlistSubtype(UUID)).resolves.toBeNull();
  });

  it('only matches non-deleted public playlists', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });

    await model.playlistSubtype(UUID);

    const sql = db.query.mock.calls[0][0];
    expect(sql).toMatch(/deleted_at/i);
    expect(sql).toMatch(/is_public/i);
  });
});

// ══════════════════════════════════════════════════════════════
// playlistSubtypeBySlug
// ══════════════════════════════════════════════════════════════
describe('playlistSubtypeBySlug', () => {
  it('returns subtype when found by slug', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ subtype: 'playlist' }] });

    await expect(model.playlistSubtypeBySlug('my-playlist')).resolves.toBe('playlist');
    expect(db.query).toHaveBeenCalledWith(expect.any(String), ['my-playlist']);
  });

  it('returns null when slug not found', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });

    await expect(model.playlistSubtypeBySlug('nonexistent')).resolves.toBeNull();
  });

  it('queries by slug column, not id', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });

    await model.playlistSubtypeBySlug('some-slug');

    const sql = db.query.mock.calls[0][0];
    expect(sql).toMatch(/slug/i);
  });
});

// ══════════════════════════════════════════════════════════════
// userExists
// ══════════════════════════════════════════════════════════════
describe('userExists', () => {
  it('returns true when user found by username', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ 1: 1 }] });

    await expect(model.userExists('artistname')).resolves.toBe(true);
    expect(db.query).toHaveBeenCalledWith(expect.any(String), ['artistname']);
  });

  it('returns false when user not found', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });

    await expect(model.userExists('ghostuser')).resolves.toBe(false);
  });

  it('only matches non-deleted users', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });

    await model.userExists('someone');

    const sql = db.query.mock.calls[0][0];
    expect(sql).toMatch(/deleted_at/i);
  });

  it('queries against username column', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });

    await model.userExists('testuser');

    const sql = db.query.mock.calls[0][0];
    expect(sql).toMatch(/username/i);
  });
});
