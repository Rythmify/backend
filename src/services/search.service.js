const searchModel = require('../models/search.model');

// Minimum similarity threshold — queries with no trigram overlap at all are excluded.
// 0.3 allows minor typos while filtering completely unrelated results.
const SIMILARITY_THRESHOLD = 0.2;

async function search({ q, type, sort, limit, offset }) {
  // Determine which resource types to query
  const runTracks = !type || type === 'tracks';
  const runUsers = !type || type === 'users';
  const runPlaylists = !type || type === 'playlists';

  // Fan out all queries in parallel — even if only one type is requested,
  // Promise.all with no-ops keeps the code uniform.
  const [tracksResult, usersResult, playlistsResult] = await Promise.all([
    runTracks
      ? searchModel.searchTracks({ q, sort, limit, offset, threshold: SIMILARITY_THRESHOLD })
      : { rows: [], total: 0 },

    runUsers
      ? searchModel.searchUsers({ q, sort, limit, offset, threshold: SIMILARITY_THRESHOLD })
      : { rows: [], total: 0 },

    runPlaylists
      ? searchModel.searchPlaylists({ q, sort, limit, offset, threshold: SIMILARITY_THRESHOLD })
      : { rows: [], total: 0 },
  ]);

  const tracks = tracksResult.rows.map(formatTrackResult);
  const users = usersResult.rows.map(formatUserResult);
  const playlists = playlistsResult.rows.map(formatPlaylistResult);

  // When a type filter is active, expose that type's total.
  // When all types are returned, we report the total of the first requested type
  // (matching the single ListMeta in the spec).
  let total = 0;
  if (type === 'tracks') total = tracksResult.total;
  else if (type === 'users') total = usersResult.total;
  else if (type === 'playlists') total = playlistsResult.total;
  else total = tracksResult.total + usersResult.total + playlistsResult.total;

  return {
    data: { tracks, users, playlists },
    pagination: { limit, offset, total },
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
    score: parseFloat((row.score ?? 0).toFixed(4)),
  };
}

/** Maps a DB playlist row → PlaylistSearchResult (PlaylistSummary + score) */
function formatPlaylistResult(row) {
  return {
    id: row.id,
    title: row.name,
    owner: {
      id: row.owner_id,
      display_name: row.owner_display_name,
    },
    track_count: row.track_count ?? 0,
    created_at: row.created_at,
    score: parseFloat((row.score ?? 0).toFixed(4)),
    preview_tracks: row.preview_tracks ?? [],
  };
}

module.exports = { search, getSuggestions };
