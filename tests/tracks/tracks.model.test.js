jest.mock('../../src/config/db', () => ({
  query: jest.fn(),
}));

const db = require('../../src/config/db.js');
const tracksModel = require('../../src/models/track.model.js');

describe('tracksModel.updateTrackFields', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('returns null when no allowed update fields are provided', async () => {
    const result = await tracksModel.updateTrackFields('track-1', {
      unknown_field: 'x',
    });

    expect(result).toBeNull();
    expect(db.query).not.toHaveBeenCalled();
  });

  it('updates allowed fields and stringifies geo_regions', async () => {
    db.query.mockResolvedValue({
      rows: [{ id: 'track-1', title: 'New Title' }],
    });

    const result = await tracksModel.updateTrackFields('track-1', {
      title: 'New Title',
      description: 'New Description',
      geo_regions: ['EG', 'SA'],
    });

    expect(result).toEqual({
      id: 'track-1',
      title: 'New Title',
    });

    expect(db.query).toHaveBeenCalledTimes(1);

    const [sql, params] = db.query.mock.calls[0];

    expect(sql).toContain('UPDATE tracks');
    expect(sql).toContain('"title" = $2');
    expect(sql).toContain('"description" = $3');
    expect(sql).toContain('"geo_regions" = $4');
    expect(sql).toContain('WHERE id = $1 AND deleted_at IS NULL');

    expect(params).toEqual([
      'track-1',
      'New Title',
      'New Description',
      JSON.stringify(['EG', 'SA']),
    ]);
  });
});

describe('tracksModel.replaceTrackTags', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('deletes old track tags and inserts the new ones', async () => {
    db.query.mockResolvedValue({});

    await tracksModel.replaceTrackTags('track-1', ['tag-1', 'tag-2']);

    expect(db.query).toHaveBeenCalledTimes(3);

    expect(db.query).toHaveBeenNthCalledWith(1, 'DELETE FROM track_tags WHERE track_id = $1', [
      'track-1',
    ]);

    expect(db.query).toHaveBeenNthCalledWith(
      2,
      'INSERT INTO track_tags (track_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      ['track-1', 'tag-1']
    );

    expect(db.query).toHaveBeenNthCalledWith(
      3,
      'INSERT INTO track_tags (track_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      ['track-1', 'tag-2']
    );
  });

  it('only deletes old tags when new tagIds is empty', async () => {
    db.query.mockResolvedValue({});

    await tracksModel.replaceTrackTags('track-1', []);

    expect(db.query).toHaveBeenCalledTimes(1);
    expect(db.query).toHaveBeenCalledWith('DELETE FROM track_tags WHERE track_id = $1', [
      'track-1',
    ]);
  });
});

describe('tracksModel.findMyTracks', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('returns items and total without status filter', async () => {
    db.query
      .mockResolvedValueOnce({
        rows: [{ id: 'track-1', title: 'Track One', artist_name: 'DJ Nova' }],
      })
      .mockResolvedValueOnce({
        rows: [{ total: 1 }],
      });

    const result = await tracksModel.findMyTracks('user-1', {
      limit: 10,
      offset: 20,
      status: null,
    });

    expect(result).toEqual({
      items: [{ id: 'track-1', title: 'Track One', artist_name: 'DJ Nova' }],
      total: 1,
    });

    expect(db.query).toHaveBeenCalledTimes(2);

    const [itemsSql, itemsParams] = db.query.mock.calls[0];
    const [countSql, countParams] = db.query.mock.calls[1];

    expect(itemsSql).toContain('WHERE t.user_id = $1 AND t.deleted_at IS NULL');
    expect(itemsSql).toContain('LEFT JOIN users u');
    expect(itemsSql).toContain('u.display_name AS artist_name');
    expect(itemsSql).toContain('LIMIT $2 OFFSET $3');
    expect(itemsParams).toEqual(['user-1', 10, 20]);

    expect(countSql).toContain('WHERE t.user_id = $1 AND t.deleted_at IS NULL');
    expect(countParams).toEqual(['user-1']);
  });

  it('adds status filter to both queries when status is provided', async () => {
    db.query
      .mockResolvedValueOnce({
        rows: [{ id: 'track-1', title: 'Ready Track', status: 'ready', artist_name: 'DJ Nova' }],
      })
      .mockResolvedValueOnce({
        rows: [{ total: 1 }],
      });

    const result = await tracksModel.findMyTracks('user-1', {
      limit: 10,
      offset: 0,
      status: 'ready',
    });

    expect(result).toEqual({
      items: [{ id: 'track-1', title: 'Ready Track', status: 'ready', artist_name: 'DJ Nova' }],
      total: 1,
    });

    expect(db.query).toHaveBeenCalledTimes(2);

    const [itemsSql, itemsParams] = db.query.mock.calls[0];
    const [countSql, countParams] = db.query.mock.calls[1];

    expect(itemsSql).toContain('t.status = $2');
    expect(itemsSql).toContain('LIMIT $3 OFFSET $4');
    expect(itemsParams).toEqual(['user-1', 'ready', 10, 0]);

    expect(countSql).toContain('t.status = $2');
    expect(countParams).toEqual(['user-1', 'ready']);
  });
});

describe('tracksModel.findPublicTracksByUserId', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('returns items and total using the public listing filters', async () => {
    db.query
      .mockResolvedValueOnce({
        rows: [{ id: 'track-1', title: 'Public Track', status: 'ready', artist_name: 'DJ Nova' }],
      })
      .mockResolvedValueOnce({
        rows: [{ total: 1 }],
      });

    const result = await tracksModel.findPublicTracksByUserId(
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      {
        limit: 20,
        offset: 0,
      }
    );

    expect(result).toEqual({
      items: [{ id: 'track-1', title: 'Public Track', status: 'ready', artist_name: 'DJ Nova' }],
      total: 1,
    });

    expect(db.query).toHaveBeenCalledTimes(2);

    const [itemsSql, itemsParams] = db.query.mock.calls[0];
    const [countSql, countParams] = db.query.mock.calls[1];

    expect(itemsSql).toContain('FROM tracks t');
    expect(itemsSql).toContain('LEFT JOIN genres g');
    expect(itemsSql).toContain('LEFT JOIN users u');
    expect(itemsSql).toContain('u.display_name AS artist_name');
    expect(itemsSql).toContain('t.user_id = $1');
    expect(itemsSql).toContain('t.deleted_at IS NULL');
    expect(itemsSql).toContain('t.is_public = true');
    expect(itemsSql).toContain('t.is_hidden = false');
    expect(itemsSql).toContain("t.status = 'ready'");
    expect(itemsSql).toContain('ORDER BY t.created_at DESC');
    expect(itemsSql).toContain('LIMIT $2 OFFSET $3');
    expect(itemsParams).toEqual(['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 20, 0]);

    expect(countSql).toContain('FROM tracks t');
    expect(countSql).toContain('t.user_id = $1');
    expect(countSql).toContain('t.deleted_at IS NULL');
    expect(countSql).toContain('t.is_public = true');
    expect(countSql).toContain('t.is_hidden = false');
    expect(countSql).toContain("t.status = 'ready'");
    expect(countParams).toEqual(['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa']);
  });

  it('returns an empty list when the user has no public ready tracks', async () => {
    db.query
      .mockResolvedValueOnce({
        rows: [],
      })
      .mockResolvedValueOnce({
        rows: [{ total: 0 }],
      });

    const result = await tracksModel.findPublicTracksByUserId(
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      {
        limit: 10,
        offset: 10,
      }
    );

    expect(result).toEqual({
      items: [],
      total: 0,
    });
  });
});

describe('tracksModel.getGenreIdByName', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('returns null when genreName is missing', async () => {
    const result = await tracksModel.getGenreIdByName(null);

    expect(result).toBeNull();
    expect(db.query).not.toHaveBeenCalled();
  });

  it('returns genre id when genre exists', async () => {
    db.query.mockResolvedValue({
      rows: [{ id: 'genre-1' }],
    });

    const result = await tracksModel.getGenreIdByName('Pop');

    expect(result).toBe('genre-1');
    expect(db.query).toHaveBeenCalledWith(
      'SELECT id FROM genres WHERE LOWER(name) = LOWER($1) LIMIT 1',
      ['Pop']
    );
  });

  it('returns null when genre does not exist', async () => {
    db.query.mockResolvedValue({
      rows: [],
    });

    const result = await tracksModel.getGenreIdByName('Unknown');

    expect(result).toBeNull();
    expect(db.query).toHaveBeenCalledWith(
      'SELECT id FROM genres WHERE LOWER(name) = LOWER($1) LIMIT 1',
      ['Unknown']
    );
  });
});

describe('tracksModel.getTagIdsByTrackId', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('returns tag ids in query order', async () => {
    db.query.mockResolvedValue({
      rows: [{ tag_id: 'tag-1' }, { tag_id: 'tag-2' }],
    });

    const result = await tracksModel.getTagIdsByTrackId('track-1');

    expect(result).toEqual(['tag-1', 'tag-2']);
    expect(db.query).toHaveBeenCalledWith(
      'SELECT tag_id FROM track_tags WHERE track_id = $1 ORDER BY created_at ASC',
      ['track-1']
    );
  });

  it('returns empty array when no tag ids exist', async () => {
    db.query.mockResolvedValue({
      rows: [],
    });

    const result = await tracksModel.getTagIdsByTrackId('track-1');

    expect(result).toEqual([]);
    expect(db.query).toHaveBeenCalledWith(
      'SELECT tag_id FROM track_tags WHERE track_id = $1 ORDER BY created_at ASC',
      ['track-1']
    );
  });
});

describe('tracksModel.updateTrackVisibility', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('returns updated row when update succeeds', async () => {
    db.query.mockResolvedValue({
      rows: [{ id: 'track-1', is_public: false }],
    });

    const result = await tracksModel.updateTrackVisibility('track-1', false, 'secret-123');

    expect(result).toEqual({
      id: 'track-1',
      is_public: false,
    });

    const [sql, params] = db.query.mock.calls[0];

    expect(sql).toContain('UPDATE tracks');
    expect(sql).toContain('is_public = $2');
    expect(sql).toContain('secret_token = $3');
    expect(sql).toContain('updated_at = NOW()');
    expect(sql).toContain('WHERE id = $1');
    expect(sql).toContain('deleted_at IS NULL');
    expect(sql).toContain('RETURNING id, is_public');

    expect(params).toEqual(['track-1', false, 'secret-123']);
  });

  it('returns null when no row is updated', async () => {
    db.query.mockResolvedValue({
      rows: [],
    });

    const result = await tracksModel.updateTrackVisibility('track-1', true, null);

    expect(result).toBeNull();
  });
});

describe('tracksModel.softDeleteTrack', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('returns deleted row id when soft delete succeeds', async () => {
    db.query.mockResolvedValue({
      rows: [{ id: 'track-1' }],
    });

    const result = await tracksModel.softDeleteTrack('track-1');

    expect(result).toEqual({ id: 'track-1' });

    const [sql, params] = db.query.mock.calls[0];

    expect(sql).toContain('UPDATE tracks');
    expect(sql).toContain('deleted_at = NOW()');
    expect(sql).toContain('updated_at = NOW()');
    expect(sql).toContain('WHERE id = $1');
    expect(sql).toContain('deleted_at IS NULL');
    expect(sql).toContain('RETURNING id');

    expect(params).toEqual(['track-1']);
  });

  it('returns null when soft delete affects no rows', async () => {
    db.query.mockResolvedValue({
      rows: [],
    });

    const result = await tracksModel.softDeleteTrack('track-1');

    expect(result).toBeNull();
  });
});

describe('tracksModel.deleteTrackPermanently', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('returns deleted row id when hard delete succeeds', async () => {
    db.query.mockResolvedValue({
      rows: [{ id: 'track-1' }],
    });

    const result = await tracksModel.deleteTrackPermanently('track-1');

    expect(result).toEqual({ id: 'track-1' });

    const [sql, params] = db.query.mock.calls[0];

    expect(sql).toContain('DELETE FROM tracks');
    expect(sql).toContain('WHERE id = $1');
    expect(sql).toContain('deleted_at IS NULL');
    expect(sql).toContain('RETURNING id');

    expect(params).toEqual(['track-1']);
  });

  it('returns null when hard delete affects no rows', async () => {
    db.query.mockResolvedValue({
      rows: [],
    });

    const result = await tracksModel.deleteTrackPermanently('track-1');

    expect(result).toBeNull();
  });
});

describe('tracksModel.createTrack', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('inserts a track and stringifies geo_regions', async () => {
    const trackData = {
      title: 'My Song',
      description: 'desc',
      genre_id: 'genre-1',
      cover_image: 'cover-url',
      audio_url: 'audio-url',
      file_size: 12345,
      status: 'processing',
      is_public: true,
      user_id: 'user-1',
      release_date: null,
      isrc: null,
      p_line: null,
      buy_link: null,
      record_label: null,
      publisher: null,
      explicit_content: false,
      license_type: 'all_rights_reserved',
      enable_downloads: false,
      enable_offline_listening: false,
      include_in_rss_feed: true,
      display_embed_code: true,
      enable_app_playback: true,
      allow_comments: true,
      show_comments_public: true,
      show_insights_public: true,
      geo_restriction_type: 'worldwide',
      geo_regions: ['EG', 'SA'],
    };

    db.query.mockResolvedValue({
      rows: [{ id: 'track-1', title: 'My Song' }],
    });

    const result = await tracksModel.createTrack(trackData);

    expect(result).toEqual({
      id: 'track-1',
      title: 'My Song',
    });

    expect(db.query).toHaveBeenCalledTimes(1);

    const [sql, params] = db.query.mock.calls[0];

    expect(sql).toContain('INSERT INTO tracks');
    expect(sql).toContain('title, description, genre_id, cover_image');
    expect(sql).toContain('audio_url, stream_url, preview_url');
    expect(sql).toContain('geo_restriction_type, geo_regions');
    expect(sql).toContain('RETURNING *');

    expect(params).toEqual([
      'My Song',
      'desc',
      'genre-1',
      'cover-url',
      'audio-url',
      12345,
      'processing',
      true,
      undefined,
      'user-1',
      null,
      null,
      null,
      null,
      null,
      null,
      false,
      'all_rights_reserved',
      false,
      false,
      true,
      true,
      true,
      true,
      true,
      true,
      'worldwide',
      JSON.stringify(['EG', 'SA']),
    ]);
  });

  it('uses empty geo_regions array when geo_regions is missing', async () => {
    db.query.mockResolvedValue({
      rows: [{ id: 'track-1' }],
    });

    await tracksModel.createTrack({
      title: 'My Song',
      description: null,
      genre_id: null,
      cover_image: null,
      audio_url: 'audio-url',
      file_size: 12345,
      status: 'processing',
      is_public: true,
      user_id: 'user-1',
      release_date: null,
      isrc: null,
      p_line: null,
      buy_link: null,
      record_label: null,
      publisher: null,
      explicit_content: false,
      license_type: 'all_rights_reserved',
      enable_downloads: false,
      enable_offline_listening: false,
      include_in_rss_feed: true,
      display_embed_code: true,
      enable_app_playback: true,
      allow_comments: true,
      show_comments_public: true,
      show_insights_public: true,
      geo_restriction_type: 'worldwide',
    });

    const [, params] = db.query.mock.calls[0];

    expect(params[27]).toBe(JSON.stringify([]));
  });
});

describe('tracksModel.addTrackTags', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('inserts each tag with ON CONFLICT DO NOTHING', async () => {
    db.query.mockResolvedValue({});

    await tracksModel.addTrackTags('track-1', ['tag-1', 'tag-2']);

    expect(db.query).toHaveBeenCalledTimes(2);

    expect(db.query).toHaveBeenNthCalledWith(
      1,
      'INSERT INTO track_tags (track_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      ['track-1', 'tag-1']
    );

    expect(db.query).toHaveBeenNthCalledWith(
      2,
      'INSERT INTO track_tags (track_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      ['track-1', 'tag-2']
    );
  });

  it('does nothing when tagIds is empty', async () => {
    await tracksModel.addTrackTags('track-1', []);

    expect(db.query).not.toHaveBeenCalled();
  });
});

describe('tracksModel.addTrackArtists', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('inserts each artist with incrementing position and ON CONFLICT DO NOTHING', async () => {
    db.query.mockResolvedValue({});

    await tracksModel.addTrackArtists('track-1', ['artist-1', 'artist-2']);

    expect(db.query).toHaveBeenCalledTimes(2);

    expect(db.query).toHaveBeenNthCalledWith(
      1,
      'INSERT INTO track_artists (track_id, artist_id, position) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
      ['track-1', 'artist-1', 1]
    );

    expect(db.query).toHaveBeenNthCalledWith(
      2,
      'INSERT INTO track_artists (track_id, artist_id, position) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
      ['track-1', 'artist-2', 2]
    );
  });

  it('does nothing when artistIds is empty', async () => {
    await tracksModel.addTrackArtists('track-1', []);

    expect(db.query).not.toHaveBeenCalled();
  });
});

describe('tracksModel.findTrackByIdWithDetails', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('returns the first matching track row with viewer-specific flags', async () => {
    db.query.mockResolvedValue({
      rows: [
        {
          id: 'track-1',
          title: 'My Song',
          genre: 'Pop',
          artist_name: 'DJ Nova',
          tags: ['tag-1', 'tag-2'],
          is_liked_by_me: true,
          is_reposted_by_me: false,
          is_artist_followed_by_me: true,
        },
      ],
    });

    const result = await tracksModel.findTrackByIdWithDetails(
      'track-1',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
    );

    expect(result).toEqual({
      id: 'track-1',
      title: 'My Song',
      genre: 'Pop',
      artist_name: 'DJ Nova',
      tags: ['tag-1', 'tag-2'],
      is_liked_by_me: true,
      is_reposted_by_me: false,
      is_artist_followed_by_me: true,
    });

    expect(db.query).toHaveBeenCalledTimes(1);

    const [sql, params] = db.query.mock.calls[0];

    expect(sql).toContain('SELECT');
    expect(sql).toContain('FROM tracks t');
    expect(sql).toContain('LEFT JOIN genres g');
    expect(sql).toContain('LEFT JOIN users u');
    expect(sql).toContain('u.display_name AS artist_name');
    expect(sql).toContain('LEFT JOIN LATERAL');
    expect(sql).toContain('array_agg(tag.id::text ORDER BY tag.id::text) AS tags');
    expect(sql).toContain('FROM track_likes tl');
    expect(sql).toContain('FROM track_reposts tr');
    expect(sql).toContain('FROM follows f');
    expect(sql).toContain('WHEN $2::uuid IS NULL THEN false');
    expect(sql).toContain('END AS is_liked_by_me');
    expect(sql).toContain('END AS is_reposted_by_me');
    expect(sql).toContain('END AS is_artist_followed_by_me');
    expect(sql).toContain('WHERE t.id = $1');
    expect(sql).toContain('t.deleted_at IS NULL');
    expect(sql).toContain('LIMIT 1');

    expect(params).toEqual(['track-1', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa']);
  });

  it('returns null when no track is found', async () => {
    db.query.mockResolvedValue({
      rows: [],
    });

    const result = await tracksModel.findTrackByIdWithDetails('track-1');

    expect(result).toBeNull();
    expect(db.query).toHaveBeenCalledWith(expect.any(String), ['track-1', null]);
  });
});

describe('tracksModel.findTrackFanLeaderboard', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('queries the overall leaderboard with deterministic ordering and a five-row cap', async () => {
    db.query.mockResolvedValue({
      rows: [{ id: 'fan-1', play_count: 8 }],
    });

    const result = await tracksModel.findTrackFanLeaderboard('track-1', 'overall');

    expect(result).toEqual([{ id: 'fan-1', play_count: 8 }]);
    expect(db.query).toHaveBeenCalledTimes(1);

    const [sql, params] = db.query.mock.calls[0];

    expect(sql).toContain('WITH aggregated_fans AS');
    expect(sql).toContain('FROM listening_history lh');
    expect(sql).toContain('JOIN users fan');
    expect(sql).toContain('COUNT(*)::int AS play_count');
    expect(sql).toContain('MIN(lh.played_at) AS first_played_at');
    expect(sql).toContain('MAX(lh.played_at) AS last_played_at');
    expect(sql).toContain('WHERE lh.track_id = $1');
    expect(sql).toContain('u.profile_picture');
    expect(sql).toContain('u.is_verified');
    expect(sql).not.toContain('u.cover_photo');
    expect(sql).not.toContain('u.bio');
    expect(sql).not.toContain('followers_count');
    expect(sql).toContain('aggregated_fans.play_count DESC');
    expect(sql).toContain('aggregated_fans.first_played_at ASC');
    expect(sql).toContain('aggregated_fans.user_id ASC');
    expect(sql).toContain('LIMIT 5');
    expect(sql).not.toContain("INTERVAL '7 days'");
    expect(params).toEqual(['track-1']);
  });

  it('adds the trailing seven-day filter when period is last_7_days', async () => {
    db.query.mockResolvedValue({
      rows: [],
    });

    await tracksModel.findTrackFanLeaderboard('track-1', 'last_7_days');

    const [sql, params] = db.query.mock.calls[0];

    expect(sql).toContain("lh.played_at >= NOW() - INTERVAL '7 days'");
    expect(params).toEqual(['track-1']);
  });
});

describe('tracksModel.findOrCreateTagsByNames', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('returns empty array and does not query when tagNames is empty', async () => {
    const result = await tracksModel.findOrCreateTagsByNames([]);

    expect(result).toEqual([]);
    expect(db.query).not.toHaveBeenCalled();
  });

  it('normalizes, deduplicates, and returns existing tags without inserting', async () => {
    db.query
      .mockResolvedValueOnce({
        rows: [
          { id: 'tag-1', name: 'chill' },
          { id: 'tag-2', name: 'ambient' },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          { id: 'tag-1', name: 'chill' },
          { id: 'tag-2', name: 'ambient' },
        ],
      });

    const result = await tracksModel.findOrCreateTagsByNames([' Chill ', 'ambient', 'CHILL']);

    expect(result).toEqual([
      { id: 'tag-1', name: 'chill' },
      { id: 'tag-2', name: 'ambient' },
    ]);

    expect(db.query).toHaveBeenCalledTimes(2);

    expect(db.query).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('SELECT id, LOWER(name::text) AS name'),
      [['chill', 'ambient']]
    );

    expect(db.query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('SELECT id, LOWER(name::text) AS name'),
      [['chill', 'ambient']]
    );
  });
  it('inserts only missing normalized tags and returns final rows', async () => {
    db.query
      .mockResolvedValueOnce({
        rows: [{ id: 'tag-1', name: 'chill' }],
      })
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({
        rows: [
          { id: 'tag-1', name: 'chill' },
          { id: 'tag-2', name: 'ambient' },
        ],
      });

    const result = await tracksModel.findOrCreateTagsByNames(['Chill', ' ambient ']);

    expect(result).toEqual([
      { id: 'tag-1', name: 'chill' },
      { id: 'tag-2', name: 'ambient' },
    ]);

    expect(db.query).toHaveBeenCalledTimes(3);

    expect(db.query).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('WHERE LOWER(name::text) = ANY($1::text[])'),
      [['chill', 'ambient']]
    );

    expect(db.query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('INSERT INTO tags (name)'),
      ['ambient']
    );

    expect(db.query).toHaveBeenNthCalledWith(
      3,
      expect.stringContaining('WHERE LOWER(name::text) = ANY($1::text[])'),
      [['chill', 'ambient']]
    );
  });

  it('inserts each missing tag when multiple tags are missing', async () => {
    db.query
      .mockResolvedValueOnce({
        rows: [],
      })
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({
        rows: [
          { id: 'tag-1', name: 'chill' },
          { id: 'tag-2', name: 'ambient' },
        ],
      });

    const result = await tracksModel.findOrCreateTagsByNames(['Chill', 'Ambient']);

    expect(result).toEqual([
      { id: 'tag-1', name: 'chill' },
      { id: 'tag-2', name: 'ambient' },
    ]);

    expect(db.query).toHaveBeenCalledTimes(4);
    expect(db.query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('INSERT INTO tags (name)'),
      ['chill']
    );
    expect(db.query).toHaveBeenNthCalledWith(
      3,
      expect.stringContaining('INSERT INTO tags (name)'),
      ['ambient']
    );
  });

  it('returns null when update query runs but no row is returned', async () => {
    db.query.mockResolvedValue({
      rows: [],
    });

    const result = await tracksModel.updateTrackFields('track-1', {
      title: 'New Title',
    });

    expect(result).toBeNull();
    expect(db.query).toHaveBeenCalledTimes(1);
  });
});

describe('tracksModel processing asset helpers', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('updateTrackProcessingAssets returns the updated row when the track exists', async () => {
    db.query.mockResolvedValue({
      rows: [
        {
          id: 'track-1',
          status: 'ready',
          duration: 180,
          bitrate: 320,
          stream_url: 'stream-url',
          preview_url: 'preview-url',
          waveform_url: 'waveform-url',
        },
      ],
    });

    const result = await tracksModel.updateTrackProcessingAssets('track-1', {
      duration: 180,
      bitrate: 320,
      streamUrl: 'stream-url',
      previewUrl: 'preview-url',
      waveformUrl: 'waveform-url',
    });

    expect(result).toEqual({
      id: 'track-1',
      status: 'ready',
      duration: 180,
      bitrate: 320,
      stream_url: 'stream-url',
      preview_url: 'preview-url',
      waveform_url: 'waveform-url',
    });

    const [sql, params] = db.query.mock.calls[0];

    expect(sql).toContain('UPDATE tracks');
    expect(sql).toContain("status = 'ready'");
    expect(sql).toContain('duration = $2');
    expect(sql).toContain('bitrate = $3');
    expect(sql).toContain('stream_url = $4');
    expect(sql).toContain('preview_url = $5');
    expect(sql).toContain('waveform_url = $6');
    expect(sql).toContain('WHERE id = $1');
    expect(sql).toContain('deleted_at IS NULL');
    expect(sql).toContain(
      'RETURNING id, status, duration, bitrate, stream_url, preview_url, waveform_url'
    );
    expect(params).toEqual(['track-1', 180, 320, 'stream-url', 'preview-url', 'waveform-url']);
  });

  it('updateTrackProcessingAssets returns null when no row is updated', async () => {
    db.query.mockResolvedValue({
      rows: [],
    });

    const result = await tracksModel.updateTrackProcessingAssets('track-1', {
      duration: 180,
      bitrate: 320,
      streamUrl: 'stream-url',
      previewUrl: 'preview-url',
      waveformUrl: 'waveform-url',
    });

    expect(result).toBeNull();
  });

  it('markTrackProcessingFailed returns the updated row when the track exists', async () => {
    db.query.mockResolvedValue({
      rows: [{ id: 'track-1', status: 'failed' }],
    });

    const result = await tracksModel.markTrackProcessingFailed('track-1');

    expect(result).toEqual({ id: 'track-1', status: 'failed' });

    const [sql, params] = db.query.mock.calls[0];

    expect(sql).toContain('UPDATE tracks');
    expect(sql).toContain("status = 'failed'");
    expect(sql).toContain('updated_at = NOW()');
    expect(sql).toContain('WHERE id = $1');
    expect(sql).toContain('deleted_at IS NULL');
    expect(sql).toContain('RETURNING id, status');
    expect(params).toEqual(['track-1']);
  });

  it('markTrackProcessingFailed returns null when no row is updated', async () => {
    db.query.mockResolvedValue({
      rows: [],
    });

    const result = await tracksModel.markTrackProcessingFailed('track-1');

    expect(result).toBeNull();
  });
});
