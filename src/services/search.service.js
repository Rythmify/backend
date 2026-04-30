const searchModel = require('../models/search.model');

// Minimum similarity threshold — queries with no trigram overlap at all are excluded.
// 0.3 allows minor typos while filtering completely unrelated results.
const SIMILARITY_THRESHOLD = 0.2;

const TIME_RANGE_OPTIONS = [
  { label: 'Past hour', value: 'past_hour' },
  { label: 'Past day', value: 'past_day' },
  { label: 'Past week', value: 'past_week' },
  { label: 'Past month', value: 'past_month' },
  { label: 'Past year', value: 'past_year' },
];

const DURATION_OPTIONS = [
  { label: '< 2 min', value: 'short' },
  { label: '2–10 min', value: 'medium' },
  { label: '10–30 min', value: 'long' },
  { label: '> 30 min', value: 'extra' },
];

async function search({
  q,
  type,
  sort,
  limit,
  offset,
  currentUserId,
  // filter params
  time_range,
  duration,
  tag,
  location,
}) {
  const threshold = SIMILARITY_THRESHOLD;

  const runTracks = !type || type === 'tracks';
  const runUsers = !type || type === 'users';
  const runPlaylists = !type || type === 'playlists';
  const runAlbums = !type || type === 'albums';

  // Fan out search queries + filter-metadata queries in parallel.
  // Filter metadata (tags, locations) is only fetched when that type is
  // specifically requested — there's no value returning locations when
  // the user is browsing tracks.
  const [
    tracksResult,
    usersResult,
    playlistsResult,
    albumsResult,
    trackTags,
    userLocations,
    playlistTags,
    albumTags,
  ] = await Promise.all([
    runTracks
      ? searchModel.searchTracks({ q, sort, limit, offset, threshold, time_range, duration, tag })
      : { rows: [], total: 0 },

    runUsers
      ? searchModel.searchUsers({ q, sort, limit, offset, threshold, currentUserId, location })
      : { rows: [], total: 0 },

    runPlaylists
      ? searchModel.searchPlaylists({ q, sort, limit, offset, threshold, tag })
      : { rows: [], total: 0 },

    runAlbums
      ? searchModel.searchAlbums({ q, sort, limit, offset, threshold, tag })
      : { rows: [], total: 0 },

    // Tags / locations are only fetched when that type is active
    type === 'tracks' ? searchModel.getTrackSearchTags({ q, threshold }) : Promise.resolve(null),

    type === 'users' ? searchModel.getUserSearchLocations({ q, threshold }) : Promise.resolve(null),

    type === 'playlists'
      ? searchModel.getPlaylistSearchTags({ q, threshold, subtype: 'playlist' })
      : Promise.resolve(null),

    type === 'albums'
      ? searchModel.getPlaylistSearchTags({ q, threshold, subtype: 'album' })
      : Promise.resolve(null),
  ]);

  const tracks = tracksResult.rows.map(formatTrackResult);
  const users = usersResult.rows.map(formatUserResult);
  const playlists = playlistsResult.rows.map(formatPlaylistResult);
  const albums = albumsResult.rows.map(formatAlbumResult);

  // Total count
  let total = 0;
  if (type === 'tracks') total = tracksResult.total;
  else if (type === 'users') total = usersResult.total;
  else if (type === 'playlists') total = playlistsResult.total;
  else if (type === 'albums') total = albumsResult.total;
  else total = tracksResult.total + usersResult.total + playlistsResult.total + albumsResult.total;

  // ── Build the `filters` block ────────────────────────────────────────────
  // `available` = what the client should render as filter options
  // `active`    = which filters are currently applied (echoed back for UI state)
  let filters = null;

  if (type === 'tracks') {
    filters = {
      available: {
        time_range: TIME_RANGE_OPTIONS,
        duration: DURATION_OPTIONS,
        tags: trackTags, // dynamic — from actual results
      },
      active: {
        time_range: time_range ?? null,
        duration: duration ?? null,
        tag: tag ?? null,
      },
    };
  } else if (type === 'users') {
    filters = {
      available: {
        locations: userLocations, // dynamic — from actual results
      },
      active: {
        location: location ?? null,
      },
    };
  } else if (type === 'playlists') {
    filters = {
      available: {
        tags: playlistTags,
      },
      active: {
        tag: tag ?? null,
      },
    };
  } else if (type === 'albums') {
    filters = {
      available: {
        tags: albumTags,
      },
      active: {
        tag: tag ?? null,
      },
    };
  }

  return {
    data: { tracks, users, playlists, albums },
    pagination: { limit, offset, total },
    filters,
  };
}

async function getSuggestions({ q, limit, userId }) {
  // Run all three in parallel — each is a single lightweight query
  const [users, trackTitles, playlistNames] = await Promise.all([
    searchModel.suggestUsers(q, limit, userId),
    searchModel.suggestTrackTitles(q, limit),
    searchModel.suggestPlaylistNames(q, limit),
  ]);

  // Merge track titles and playlist names into one flat deduplicated list.
  // Both are already sorted by popularity from the model.
  // We interleave them (zip) so neither type dominates the top slots.
  const suggestions = interleaveAndDedupe(trackTitles, playlistNames, limit);

  return { users, suggestions };
}

async function searchEverything({ q, sort, currentUserId }) {
  const threshold = SIMILARITY_THRESHOLD;

  const [tracksResult, usersResult, playlistsResult, albumsResult] = await Promise.all([
    searchModel.searchTracks({ q, sort, limit: 6, offset: 0, threshold }),
    searchModel.searchUsers({ q, sort, limit: 5, offset: 0, threshold, currentUserId }),
    searchModel.searchPlaylists({ q, sort, limit: 3, offset: 0, threshold }),
    searchModel.searchAlbums({ q, sort, limit: 3, offset: 0, threshold }),
  ]);

  const tracks = tracksResult.rows.map(formatTrackResult);
  const users = usersResult.rows.map(formatUserResult);
  const playlists = playlistsResult.rows.map(formatPlaylistResult);
  const albums = albumsResult.rows.map(formatAlbumResult);
  return {
    data: {
      top_track: tracks[0] ?? null,
      top_user: users[0] ?? null,
      tracks: tracks.slice(1, 5), // up to 4
      users: users.slice(1, 4), // up to 3
      playlists: playlists.slice(0, 2), // up to 2
      albums: albums.slice(0, 2), // up to 2
    },
    pagination: null,
    filters: null,
  };
}

function interleaveAndDedupe(a, b, limit) {
  const seen = new Set();
  const result = [];
  const max = Math.max(a.length, b.length);

  for (let i = 0; i < max && result.length < limit; i++) {
    if (i < a.length) {
      const val = a[i].toLowerCase();
      if (!seen.has(val)) {
        seen.add(val);
        result.push(a[i]);
      }
    }
    if (result.length < limit && i < b.length) {
      const val = b[i].toLowerCase();
      if (!seen.has(val)) {
        seen.add(val);
        result.push(b[i]);
      }
    }
  }

  return result;
}
// ── Formatters ────────────────────────────────────────────────────────────

/** Maps a DB track row → TrackSearchResult (FeedTrack + score) */
function formatTrackResult(row) {
  return {
    id: row.id,
    title: row.title,
    cover_image: row.cover_image ?? null,
    artist_name: row.artist_name ?? null,
    user_id: row.user_id,
    username: row.artist_username ?? null,
    genre_name: row.genre_name ?? null,
    duration: row.duration ?? null,
    play_count: row.play_count ?? 0,
    like_count: row.like_count ?? 0,
    repost_count: row.repost_count ?? null,
    stream_url: row.stream_url ?? null,
    created_at: row.created_at,
    score: parseFloat((row.score ?? 0).toFixed(4)),
  };
}

/** Maps a DB user row → UserSearchResult */
function formatUserResult(row) {
  return {
    id: row.id,
    display_name: row.display_name,
    profile_picture: row.profile_picture ?? null,
    follower_count: row.followers_count ?? 0,
    is_following: row.is_following ?? false,
    score: parseFloat((row.score ?? 0).toFixed(4)),
  };
}

/** Maps a DB playlist row → PlaylistSearchResult (PlaylistSummary + score) */
function formatPlaylistResult(row) {
  return {
    id: row.id,
    title: row.name,
    cover_image: row.cover_image ?? null,
    owner: {
      id: row.owner_id,
      display_name: row.owner_display_name,
      username: row.owner_username ?? null,
    },
    track_count: row.track_count ?? 0,
    created_at: row.created_at,
    score: parseFloat((row.score ?? 0).toFixed(4)),
    preview_tracks: row.preview_tracks ?? [],
  };
}
const formatAlbumResult = formatPlaylistResult;

module.exports = { search, getSuggestions, searchEverything };
