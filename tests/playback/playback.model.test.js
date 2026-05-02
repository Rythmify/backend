const model = require('../../src/models/playback.model');
const db = require('../../src/config/db');

jest.mock('../../src/config/db', () => ({ query: jest.fn() }));

beforeEach(() => jest.clearAllMocks());

describe('playback.model', () => {
  it('returns the playback-state track row when found', async () => {
    const row = {
      id: '11111111-1111-4111-8111-111111111111',
      status: 'ready',
      is_public: true,
      is_hidden: false,
      secret_token: null,
      user_id: 'user-1',
      stream_url: 'stream-url',
      preview_url: 'preview-url',
      audio_url: 'audio-url',
      geo_restriction_type: 'worldwide',
      geo_regions: [],
      enable_app_playback: true,
    };

    db.query.mockResolvedValueOnce({ rows: [row] });

    await expect(
      model.findTrackByIdForPlaybackState('11111111-1111-4111-8111-111111111111')
    ).resolves.toEqual(row);
    expect(db.query).toHaveBeenCalledWith(expect.stringContaining('FROM tracks t'), [
      '11111111-1111-4111-8111-111111111111',
    ]);
  });

  it('returns null when no playback-state track row exists', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });

    await expect(
      model.findTrackByIdForPlaybackState('11111111-1111-4111-8111-111111111111')
    ).resolves.toBeNull();
  });

  it('batch-loads playback track metadata for player-state enrichment', async () => {
    const rows = [
      {
        id: '11111111-1111-4111-8111-111111111111',
        title: 'Current Track',
        duration: 180,
        cover_image: 'https://cdn.rythmify.app/covers/current.jpg',
        stream_url: 'stream-url',
        audio_url: 'audio-url',
        user_id: 'artist-1',
        artist_name: 'DJ Nova',
      },
      {
        id: '22222222-2222-4222-8222-222222222222',
        title: 'Queued Track',
        duration: 240,
        cover_image: 'https://cdn.rythmify.app/covers/queued.jpg',
        stream_url: null,
        audio_url: 'audio-only-url',
        user_id: 'artist-2',
        artist_name: 'Echo Atlas',
      },
    ];

    db.query.mockResolvedValueOnce({ rows });

    await expect(
      model.findTrackMetadataByIds([
        '11111111-1111-4111-8111-111111111111',
        '22222222-2222-4222-8222-222222222222',
      ])
    ).resolves.toEqual(rows);
    expect(db.query).toHaveBeenCalledWith(expect.stringContaining('WHERE t.id = ANY($1::uuid[])'), [
      ['11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222'],
    ]);

    const metadataQuery = db.query.mock.calls[0][0];
    expect(metadataQuery).toContain('LEFT JOIN users u');
    expect(metadataQuery).toContain('t.cover_image');
    expect(metadataQuery).toContain("(t.cover_image IS NULL OR t.cover_image <> 'pending')");
    expect(metadataQuery).not.toContain('t.cover_image IS NOT NULL');
    expect(metadataQuery).toContain('u.display_name AS artist_name');
    expect(metadataQuery).toContain('AND t.deleted_at IS NULL');
  });

  it('returns an empty array when track metadata is requested with no track ids', async () => {
    await expect(model.findTrackMetadataByIds([])).resolves.toEqual([]);
    expect(db.query).not.toHaveBeenCalled();
  });

  it('inserts a listening history row for a successful authenticated play', async () => {
    const row = {
      id: 'history-1',
      user_id: 'user-1',
      track_id: '11111111-1111-4111-8111-111111111111',
      duration_played: 0,
      played_at: '2026-04-06T10:00:00.000Z',
    };

    db.query.mockResolvedValueOnce({ rows: [row] });

    await expect(
      model.insertListeningHistory({
        userId: 'user-1',
        trackId: '11111111-1111-4111-8111-111111111111',
      })
    ).resolves.toEqual(row);
    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO listening_history'),
      ['user-1', '11111111-1111-4111-8111-111111111111', 0, null]
    );
  });

  it('returns null when listening history insert does not return a row', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });

    await expect(
      model.insertListeningHistory({
        userId: 'user-1',
        trackId: '11111111-1111-4111-8111-111111111111',
        durationPlayed: 42,
        playedAt: '2026-04-06T10:00:00.000Z',
      })
    ).resolves.toBeNull();
  });

  it('soft-deletes active listening history rows for one user', async () => {
    db.query.mockResolvedValueOnce({ rowCount: 3 });

    await expect(model.softDeleteListeningHistoryByUserId('user-1')).resolves.toBe(3);
    expect(db.query).toHaveBeenCalledWith(expect.stringContaining('UPDATE listening_history'), [
      'user-1',
    ]);

    const clearHistoryQuery = db.query.mock.calls[0][0];
    expect(clearHistoryQuery).toContain('SET deleted_at = NOW()');
    expect(clearHistoryQuery).toContain('AND deleted_at IS NULL');
    expect(clearHistoryQuery).not.toContain('DELETE FROM listening_history');
  });

  it('returns 0 when softDeleteListeningHistoryByUserId receives no rowCount from the database', async () => {
    db.query.mockResolvedValueOnce({});

    await expect(model.softDeleteListeningHistoryByUserId('user-1')).resolves.toBe(0);
  });

  it('finds a recent listening history row inside the dedupe window', async () => {
    const row = {
      id: 'history-1',
      user_id: 'user-1',
      track_id: '11111111-1111-4111-8111-111111111111',
      duration_played: 180,
      played_at: '2026-04-06T12:00:00.000Z',
    };

    db.query.mockResolvedValueOnce({ rows: [row] });

    await expect(
      model.findRecentListeningHistoryEntry({
        userId: 'user-1',
        trackId: '11111111-1111-4111-8111-111111111111',
        playedAt: '2026-04-06T12:00:00.000Z',
        windowSeconds: 30,
      })
    ).resolves.toEqual(row);
    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining('make_interval(secs => $4::int)'),
      ['user-1', '11111111-1111-4111-8111-111111111111', '2026-04-06T12:00:00.000Z', 30]
    );

    const recentHistoryEntryQuery = db.query.mock.calls[0][0];
    expect(recentHistoryEntryQuery).toContain('AND lh.deleted_at IS NULL');
  });

  it('returns null when no recent listening history row matches the dedupe window', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });

    await expect(
      model.findRecentListeningHistoryEntry({
        userId: 'user-1',
        trackId: '11111111-1111-4111-8111-111111111111',
        playedAt: '2026-04-06T12:00:00.000Z',
        windowSeconds: 30,
      })
    ).resolves.toBeNull();
  });

  it('finds the newest recent listening-history row for player-state enrichment', async () => {
    const row = {
      id: 'history-2',
      user_id: 'user-1',
      track_id: '11111111-1111-4111-8111-111111111111',
      duration_played: 120,
      played_at: '2026-04-06T12:00:00.000Z',
    };

    db.query.mockResolvedValueOnce({ rows: [row] });

    await expect(
      model.findLatestListeningHistoryEntryByUserAndTrack({
        userId: 'user-1',
        trackId: '11111111-1111-4111-8111-111111111111',
        playedAfter: '2026-04-01T00:00:00.000Z',
      })
    ).resolves.toEqual(row);

    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining('AND ($3::timestamptz IS NULL OR lh.played_at >= $3::timestamptz)'),
      ['user-1', '11111111-1111-4111-8111-111111111111', '2026-04-01T00:00:00.000Z']
    );

    const latestHistoryEntryQuery = db.query.mock.calls[0][0];
    expect(latestHistoryEntryQuery).toContain('AND lh.deleted_at IS NULL');
  });

  it('returns null when no matching recent listening-history row exists for enrichment', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });

    await expect(
      model.findLatestListeningHistoryEntryByUserAndTrack({
        userId: 'user-1',
        trackId: '11111111-1111-4111-8111-111111111111',
        playedAfter: '2026-04-01T00:00:00.000Z',
      })
    ).resolves.toBeNull();
  });

  it('updates listening-history progress using a non-decreasing greatest comparison', async () => {
    const row = {
      id: 'history-2',
      user_id: 'user-1',
      track_id: '11111111-1111-4111-8111-111111111111',
      duration_played: 120,
      played_at: '2026-04-06T12:00:00.000Z',
    };

    db.query.mockResolvedValueOnce({ rows: [row] });

    await expect(
      model.updateListeningHistoryProgress({
        historyId: 'history-2',
        progressSeconds: 95,
      })
    ).resolves.toEqual(row);

    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining('SET duration_played = GREATEST(duration_played, $2::int)'),
      ['history-2', 95]
    );

    const progressUpdateQuery = db.query.mock.calls[0][0];
    expect(progressUpdateQuery).toContain('AND deleted_at IS NULL');
  });

  it('returns null when updateListeningHistoryProgress does not update any row', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });

    await expect(
      model.updateListeningHistoryProgress({
        historyId: 'history-2',
        progressSeconds: 95,
      })
    ).resolves.toBeNull();
  });

  it('returns recently played entries with the expected nested track summary shape', async () => {
    const row = {
      id: '11111111-1111-4111-8111-111111111111',
      title: 'Latest Track',
      genre: 'Pop',
      duration: 180,
      cover_image: 'cover-1.jpg',
      user_id: 'artist-1',
      artist_name: 'DJ Nova',
      play_count: 12,
      like_count: 4,
      comment_count: 7,
      repost_count: 2,
      stream_url: 'stream-1',
      audio_url: 'audio-1',
      tags: ['house', 'summer'],
      is_liked_by_me: true,
      is_reposted_by_me: false,
      is_artist_followed_by_me: true,
      last_played_at: '2026-04-06T12:00:00.000Z',
    };

    db.query.mockResolvedValueOnce({ rows: [row] });

    await expect(model.findRecentlyPlayedByUserId('user-1')).resolves.toEqual([
      {
        track: {
          id: '11111111-1111-4111-8111-111111111111',
          title: 'Latest Track',
          genre: 'Pop',
          duration: 180,
          cover_image: 'cover-1.jpg',
          user_id: 'artist-1',
          artist_name: 'DJ Nova',
          play_count: 12,
          like_count: 4,
          comment_count: 7,
          repost_count: 2,
          stream_url: 'stream-1',
          audio_url: 'audio-1',
          tags: ['house', 'summer'],
          is_liked_by_me: true,
          is_reposted_by_me: false,
          is_artist_followed_by_me: true,
        },
        last_played_at: '2026-04-06T12:00:00.000Z',
      },
    ]);
  });

  it('returns an empty tags array for recently played tracks without tags', async () => {
    db.query.mockResolvedValueOnce({
      rows: [
        {
          id: '11111111-1111-4111-8111-111111111111',
          title: 'Latest Track',
          genre: 'Pop',
          duration: 180,
          cover_image: 'cover-1.jpg',
          user_id: 'artist-1',
          artist_name: 'DJ Nova',
          play_count: 12,
          like_count: 4,
          comment_count: 0,
          repost_count: 0,
          stream_url: 'stream-1',
          audio_url: 'audio-1',
          tags: null,
          is_liked_by_me: null,
          is_reposted_by_me: undefined,
          is_artist_followed_by_me: 0,
          last_played_at: '2026-04-06T12:00:00.000Z',
        },
      ],
    });

    await expect(model.findRecentlyPlayedByUserId('user-1')).resolves.toEqual([
      {
        track: {
          id: '11111111-1111-4111-8111-111111111111',
          title: 'Latest Track',
          genre: 'Pop',
          duration: 180,
          cover_image: 'cover-1.jpg',
          user_id: 'artist-1',
          artist_name: 'DJ Nova',
          play_count: 12,
          like_count: 4,
          comment_count: 0,
          repost_count: 0,
          stream_url: 'stream-1',
          audio_url: 'audio-1',
          tags: [],
          is_liked_by_me: false,
          is_reposted_by_me: false,
          is_artist_followed_by_me: false,
        },
        last_played_at: '2026-04-06T12:00:00.000Z',
      },
    ]);
  });

  it('queries deduplicated recently played tracks newest first with conservative visibility filters', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });

    await model.findRecentlyPlayedByUserId('user-1');

    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining('SELECT DISTINCT ON (lh.track_id)'),
      ['user-1', 20, 0]
    );

    const recentHistoryQuery = db.query.mock.calls[0][0];

    expect(recentHistoryQuery).toContain('FROM listening_history lh');
    expect(recentHistoryQuery).toContain('AND lh.deleted_at IS NULL');
    expect(recentHistoryQuery).toContain('AND t.deleted_at IS NULL');
    expect(recentHistoryQuery).toContain("AND t.status = 'ready'");
    expect(recentHistoryQuery).toContain('t.user_id = $1');
    expect(recentHistoryQuery).toContain('(t.is_public = true AND t.is_hidden = false)');
    expect(recentHistoryQuery).toContain('LEFT JOIN users u');
    expect(recentHistoryQuery).toContain('u.display_name AS artist_name');
    expect(recentHistoryQuery).toContain('COALESCE(tag_data.tags, ARRAY[]::text[]) AS tags');
    expect(recentHistoryQuery).toContain('t.comment_count');
    expect(recentHistoryQuery).toContain('t.repost_count');
    expect(recentHistoryQuery).toContain('END AS is_liked_by_me');
    expect(recentHistoryQuery).toContain('END AS is_reposted_by_me');
    expect(recentHistoryQuery).toContain('END AS is_artist_followed_by_me');
    expect(recentHistoryQuery).toContain('LEFT JOIN LATERAL');
    expect(recentHistoryQuery).toContain('SELECT DISTINCT tag.name');
    expect(recentHistoryQuery).toContain('array_agg(tag_name.name ORDER BY tag_name.name) AS tags');
    expect(recentHistoryQuery).toContain('ORDER BY lh.track_id, lh.played_at DESC');
    expect(recentHistoryQuery).toContain(
      'ORDER BY deduplicated_history.last_played_at DESC, t.id ASC'
    );
    expect(recentHistoryQuery).toContain('LIMIT $2 OFFSET $3');
    expect(recentHistoryQuery.indexOf('LIMIT $2 OFFSET $3')).toBeGreaterThan(
      recentHistoryQuery.indexOf('ORDER BY deduplicated_history.last_played_at DESC, t.id ASC')
    );
  });

  it('passes through custom limit and offset for recently played queries after deduplication', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });

    await model.findRecentlyPlayedByUserId('user-1', 5, 10);

    expect(db.query).toHaveBeenCalledWith(expect.any(String), ['user-1', 5, 10]);
  });

  it('counts deduplicated recently played tracks for pagination totals', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ total: 57 }] });

    await expect(model.countRecentlyPlayedByUserId('user-1')).resolves.toBe(57);
    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining('SELECT COUNT(*)::int AS total'),
      ['user-1']
    );

    const recentHistoryCountQuery = db.query.mock.calls[0][0];
    expect(recentHistoryCountQuery).toContain('WITH deduplicated_history AS');
    expect(recentHistoryCountQuery).toContain('SELECT DISTINCT ON (lh.track_id)');
    expect(recentHistoryCountQuery).toContain('AND lh.deleted_at IS NULL');
    expect(recentHistoryCountQuery).toContain('FROM deduplicated_history');
  });

  it('returns 0 when recently played count does not return a total row', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });

    await expect(model.countRecentlyPlayedByUserId('user-1')).resolves.toBe(0);
  });

  it('returns full play-by-play listening history rows without deduplicating repeated tracks', async () => {
    const rows = [
      {
        history_id: 'history-2',
        played_at: '2026-04-06T12:00:00.000Z',
        id: '11111111-1111-4111-8111-111111111111',
        title: 'Track Repeat',
        genre: 'Pop',
        duration: 180,
        cover_image: 'cover-1.jpg',
        user_id: 'artist-1',
        artist_name: 'DJ Nova',
        play_count: 12,
        like_count: 4,
        comment_count: 7,
        repost_count: 2,
        stream_url: 'stream-1',
        audio_url: 'audio-1',
      },
      {
        history_id: 'history-1',
        played_at: '2026-04-06T11:00:00.000Z',
        id: '11111111-1111-4111-8111-111111111111',
        title: 'Track Repeat',
        genre: 'Pop',
        duration: 180,
        cover_image: 'cover-1.jpg',
        user_id: 'artist-1',
        artist_name: 'DJ Nova',
        play_count: 12,
        like_count: 4,
        comment_count: 7,
        repost_count: 2,
        stream_url: 'stream-1',
        audio_url: 'audio-1',
      },
    ];

    db.query.mockResolvedValueOnce({ rows });

    await expect(model.findListeningHistoryByUserId('user-1', 20, 0)).resolves.toEqual([
      {
        id: 'history-2',
        track: {
          id: '11111111-1111-4111-8111-111111111111',
          title: 'Track Repeat',
          genre: 'Pop',
          duration: 180,
          cover_image: 'cover-1.jpg',
          user_id: 'artist-1',
          artist_name: 'DJ Nova',
          play_count: 12,
          like_count: 4,
          comment_count: 7,
          repost_count: 2,
          stream_url: 'stream-1',
          audio_url: 'audio-1',
        },
        played_at: '2026-04-06T12:00:00.000Z',
      },
      {
        id: 'history-1',
        track: {
          id: '11111111-1111-4111-8111-111111111111',
          title: 'Track Repeat',
          genre: 'Pop',
          duration: 180,
          cover_image: 'cover-1.jpg',
          user_id: 'artist-1',
          artist_name: 'DJ Nova',
          play_count: 12,
          like_count: 4,
          comment_count: 7,
          repost_count: 2,
          stream_url: 'stream-1',
          audio_url: 'audio-1',
        },
        played_at: '2026-04-06T11:00:00.000Z',
      },
    ]);
  });

  it('queries paginated listening history newest first while excluding deleted tracks', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });

    await model.findListeningHistoryByUserId('user-1', 5, 10);

    expect(db.query).toHaveBeenCalledWith(expect.stringContaining('FROM listening_history lh'), [
      'user-1',
      5,
      10,
    ]);

    const listeningHistoryQuery = db.query.mock.calls[0][0];

    expect(listeningHistoryQuery).toContain('lh.id AS history_id');
    expect(listeningHistoryQuery).toContain('AND lh.deleted_at IS NULL');
    expect(listeningHistoryQuery).toContain('AND t.deleted_at IS NULL');
    expect(listeningHistoryQuery).toContain('LEFT JOIN users u');
    expect(listeningHistoryQuery).toContain('u.display_name AS artist_name');
    expect(listeningHistoryQuery).toContain('t.comment_count');
    expect(listeningHistoryQuery).toContain('t.repost_count');
    expect(listeningHistoryQuery).toContain('ORDER BY lh.played_at DESC, lh.id DESC');
    expect(listeningHistoryQuery).toContain('LIMIT $2 OFFSET $3');
  });

  it('counts non-deleted listening history rows for pagination totals', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ total: 53 }] });

    await expect(model.countListeningHistoryByUserId('user-1')).resolves.toBe(53);
    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining('SELECT COUNT(*)::int AS total'),
      ['user-1']
    );

    const listeningHistoryCountQuery = db.query.mock.calls[0][0];
    expect(listeningHistoryCountQuery).toContain('AND lh.deleted_at IS NULL');
  });

  it('returns 0 when listening history count does not return a total row', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });

    await expect(model.countListeningHistoryByUserId('user-1')).resolves.toBe(0);
  });
});
