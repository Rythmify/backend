// ============================================================
// tests/resolve.service.unit.test.js
// ============================================================
const { resolve } = require('../../../src/services/resolve.service');
const resolveModel = require('../../../src/models/resolve.model');

jest.mock('../../../src/models/resolve.model');

beforeEach(() => jest.clearAllMocks());

// ── Helpers ───────────────────────────────────────────────────
const UUID = '11111111-2222-3333-4444-555555555555';
const OTHER_UUID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

// ══════════════════════════════════════════════════════════════
// parsePath / routing — via resolve()
// ══════════════════════════════════════════════════════════════
describe('resolve — unrecognised paths', () => {
  it('returns null for completely unrecognised path shape', async () => {
    const result = await resolve('/a/b/c/d');
    expect(result).toBeNull();
    expect(resolveModel.trackExists).not.toHaveBeenCalled();
  });

  it('returns null for empty pathname', async () => {
    const result = await resolve('/');
    expect(result).toBeNull();
  });
});

// ══════════════════════════════════════════════════════════════
// track paths  /<username>/<uuid>
// ══════════════════════════════════════════════════════════════
describe('resolve — track paths', () => {
  it('returns { type: "track", id } when track exists', async () => {
    resolveModel.trackExists.mockResolvedValue(true);

    const result = await resolve(`/artistname/${UUID}`);

    expect(resolveModel.trackExists).toHaveBeenCalledWith(UUID);
    expect(result).toEqual({ type: 'track', id: UUID });
  });

  it('returns null when track does not exist', async () => {
    resolveModel.trackExists.mockResolvedValue(false);

    const result = await resolve(`/artistname/${UUID}`);

    expect(result).toBeNull();
  });
});

// ══════════════════════════════════════════════════════════════
// playlist paths  /<username>/sets/<uuid-or-slug>
// ══════════════════════════════════════════════════════════════
describe('resolve — playlist paths (sets)', () => {
  it('returns { type: "playlist" } for UUID-based playlist path', async () => {
    resolveModel.playlistSubtype.mockResolvedValue('playlist');

    const result = await resolve(`/user/sets/${UUID}`);

    expect(resolveModel.playlistSubtype).toHaveBeenCalledWith(UUID);
    expect(result).toEqual({ type: 'playlist', id: UUID });
  });

  it('returns { type: "album" } when subtype is album', async () => {
    resolveModel.playlistSubtype.mockResolvedValue('album');

    const result = await resolve(`/user/sets/${UUID}`);

    expect(result).toEqual({ type: 'album', id: UUID });
  });

  it('returns null when playlist UUID not found', async () => {
    resolveModel.playlistSubtype.mockResolvedValue(null);

    const result = await resolve(`/user/sets/${UUID}`);

    expect(result).toBeNull();
  });

  it('uses playlistSubtypeBySlug for slug-based path', async () => {
    resolveModel.playlistSubtypeBySlug.mockResolvedValue('playlist');

    const result = await resolve('/user/sets/my-cool-playlist');

    expect(resolveModel.playlistSubtypeBySlug).toHaveBeenCalledWith('my-cool-playlist');
    expect(result).toEqual({ type: 'playlist', id: 'my-cool-playlist' });
  });

  it('returns null when slug-based playlist not found', async () => {
    resolveModel.playlistSubtypeBySlug.mockResolvedValue(null);

    const result = await resolve('/user/sets/nonexistent-slug');

    expect(result).toBeNull();
  });
});

// ══════════════════════════════════════════════════════════════
// album paths  /<username>/album/<uuid-or-slug>
// ══════════════════════════════════════════════════════════════
describe('resolve — album paths', () => {
  it('returns { type: "album" } for UUID album path', async () => {
    resolveModel.playlistSubtype.mockResolvedValue('album');

    const result = await resolve(`/user/album/${UUID}`);

    expect(resolveModel.playlistSubtype).toHaveBeenCalledWith(UUID);
    expect(result).toEqual({ type: 'album', id: UUID });
  });

  it('returns null when album UUID not found', async () => {
    resolveModel.playlistSubtype.mockResolvedValue(null);

    const result = await resolve(`/user/album/${UUID}`);

    expect(result).toBeNull();
  });

  it('uses playlistSubtypeBySlug for slug-based album path', async () => {
    resolveModel.playlistSubtypeBySlug.mockResolvedValue('album');

    const result = await resolve('/user/album/my-album-slug');

    expect(resolveModel.playlistSubtypeBySlug).toHaveBeenCalledWith('my-album-slug');
    expect(result).toEqual({ type: 'album', id: 'my-album-slug' });
  });
});

// ══════════════════════════════════════════════════════════════
// user paths  /<username>
// ══════════════════════════════════════════════════════════════
describe('resolve — user paths', () => {
  it('returns { type: "user", id: username } when user exists', async () => {
    resolveModel.userExists.mockResolvedValue(true);

    const result = await resolve('/artistname');

    expect(resolveModel.userExists).toHaveBeenCalledWith('artistname');
    expect(result).toEqual({ type: 'user', id: 'artistname' });
  });

  it('returns null when user does not exist', async () => {
    resolveModel.userExists.mockResolvedValue(false);

    const result = await resolve('/ghostuser');

    expect(result).toBeNull();
  });
});

// ══════════════════════════════════════════════════════════════
// ambiguous paths  /<uuid>
// ══════════════════════════════════════════════════════════════
describe('resolve — ambiguous UUID paths', () => {
  it('resolves as playlist when playlistSubtype matches', async () => {
    resolveModel.playlistSubtype.mockResolvedValue('playlist');

    const result = await resolve(`/${UUID}`);

    expect(resolveModel.playlistSubtype).toHaveBeenCalledWith(UUID);
    expect(resolveModel.trackExists).not.toHaveBeenCalled();
    expect(result).toEqual({ type: 'playlist', id: UUID });
  });

  it('falls through to track when playlist not found but track exists', async () => {
    resolveModel.playlistSubtype.mockResolvedValue(null);
    resolveModel.trackExists.mockResolvedValue(true);

    const result = await resolve(`/${UUID}`);

    expect(resolveModel.trackExists).toHaveBeenCalledWith(UUID);
    expect(result).toEqual({ type: 'track', id: UUID });
  });

  it('returns null when neither playlist nor track found', async () => {
    resolveModel.playlistSubtype.mockResolvedValue(null);
    resolveModel.trackExists.mockResolvedValue(false);

    const result = await resolve(`/${UUID}`);

    expect(result).toBeNull();
  });

  it('resolves as album when playlistSubtype returns "album"', async () => {
    resolveModel.playlistSubtype.mockResolvedValue('album');

    const result = await resolve(`/${OTHER_UUID}`);

    expect(result).toEqual({ type: 'album', id: OTHER_UUID });
  });
});
