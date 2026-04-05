// ============================================================
// services/discovery.service.js — Discovery Module
// ============================================================
const discoveryModel = require('../models/discovery.model');
const AppError = require('../utils/app-error');


exports.getRelatedTracks = async ({ trackId, limit = 20, offset = 0 }) => {
  // 1. Verify the reference track exists and is accessible
  const refTrack = await discoveryModel.findTrackMeta(trackId);
  if (!refTrack) {
    throw new AppError('Track not found', 404, 'RESOURCE_NOT_FOUND');
  }

  // 2. Fetch related tracks
  const { tracks, total } = await discoveryModel.findRelatedTracks({
    trackId,
    userId: refTrack.user_id,
    genreId: refTrack.genre_id,
    limit,
    offset,
  });

  return {
    reference_track: _formatTrack(refTrack),
    tracks: tracks.map(_formatTrack),
    meta: { limit, offset, total },
  };
};


// GET /home/hot-for-you
exports.getHotForYou = async ({ userId }) => {
  // Unauthenticated — return global #1 trending track
  if (!userId) {
    const track = await discoveryModel.findGlobalHotTrack();
    return {
      track: track ? _formatTrack(track) : null,
      reason: null,
      valid_until: _nextMidnightUTC(),
    };
  }

  // Authenticated — try each of the user's top 3 genres
  const topGenres = await discoveryModel.findUserTopGenre(userId);

  for (const { genre_id } of topGenres) {
    const track = await discoveryModel.findHotTrackForUser({ userId, genreId: genre_id });
    if (track) {
      return {
        track: _formatTrack(track),
        reason: `Trending in ${track.genre_name}`,
        valid_until: _nextMidnightUTC(),
      };
    }
  }

  // Fallback to global #1
  const track = await discoveryModel.findGlobalHotTrack();
  return {
    track: track ? _formatTrack(track) : null,
    reason: topGenres.length > 0 ? 'global trending' : null,
    valid_until: _nextMidnightUTC(),
  };
};


// GET /home/trending-by-genre/:genre_id
exports.getTrendingByGenre = async ({ genreId, limit = 20, offset = 0 }) => {
  const result = await discoveryModel.findTrendingByGenre({ genreId, limit, offset });

  if (!result.genre_name) {
    throw new AppError('Genre not found', 404, 'RESOURCE_NOT_FOUND');
  }

  return {
    genre_id: result.genre_id,
    genre_name: result.genre_name,
    tracks: result.tracks.map(_formatTrack),
  };
};

// Private formatters — shape DB rows into clean API objects

function _formatTrack(row) {
  return {
    id: row.id,
    title: row.title,
    cover_image: row.cover_image || null,
    duration: row.duration || null,
    genre_name: row.genre_name || null,
    play_count: parseInt(row.play_count, 10) || 0,
    like_count: parseInt(row.like_count, 10) || 0,
    user_id: row.user_id,
    artist_name: row.artist_name || null,
    stream_url: row.stream_url || null,
    created_at: row.created_at,
  };
}

// Returns ISO timestamp for midnight of the next UTC day
function _nextMidnightUTC() {
  const now = new Date();
  const midnight = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1)
  );
  return midnight.toISOString();
}