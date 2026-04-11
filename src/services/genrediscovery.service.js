// ============================================================
// services/discovery.service.js — Discovery Module
// ============================================================
const discoveryModel = require('../models/genrediscovery.model');
const genreModel = require('../models/genre.model');
const AppError = require('../utils/app-error');

exports.getGenrePage = async ({
  genreId,
  tracksLimit = 12,
  artistsLimit = 12,
  playlistsLimit = 4,
  albumsLimit = 4,
  currentUserId = null,
}) => {
  // First check genre exists
  const genre = await genreModel.findGenreDetail(genreId);
  if (!genre) {
    throw new AppError('Genre not found', 404, 'RESOURCE_NOT_FOUND');
  }

  // Run all sub-queries in parallel
  const [tracksResult, albumsResult, playlistsResult, artistsResult] = await Promise.all([
    discoveryModel.findGenreTracks({ genreId, limit: tracksLimit, offset: 0, sort: 'newest' }),
    discoveryModel.findGenreAlbums({ genreId, limit: albumsLimit, offset: 0 }),
    discoveryModel.findGenrePlaylists({ genreId, limit: playlistsLimit, offset: 0 }),
    discoveryModel.findGenreArtists({ genreId, limit: artistsLimit, offset: 0, currentUserId }),
  ]);

  return {
    genre: _formatGenre(genre),
    tracks: tracksResult.tracks.map(_formatTrack),
    albums: albumsResult.albums.map(_formatAlbum),
    playlists: playlistsResult.playlists.map(_formatPlaylist),
    artists: artistsResult.artists.map(_formatArtist),
  };
};

exports.getGenreTracks = async ({ genreId, limit = 20, offset = 0, sort = 'newest' }) => {
  // Verify genre exists
  const genre = await genreModel.findGenreDetail(genreId);
  if (!genre) {
    throw new AppError('Genre not found', 404, 'RESOURCE_NOT_FOUND');
  }

  const { tracks, total } = await discoveryModel.findGenreTracks({ genreId, limit, offset, sort });

  return {
    tracks: tracks.map(_formatTrack),
  pagination: {
    page: Math.floor(offset / limit) + 1,
    per_page: limit,
    total_items: total,
    total_pages: Math.ceil(total / limit),
    has_next: offset + limit < total,
    has_prev: offset > 0,
  },
};
};

exports.getGenreAlbums = async ({ genreId, limit = 12, offset = 0 }) => {
  const genre = await genreModel.findGenreDetail(genreId);
  if (!genre) {
    throw new AppError('Genre not found', 404, 'RESOURCE_NOT_FOUND');
  }

  const { albums, total } = await discoveryModel.findGenreAlbums({ genreId, limit, offset });

  return {
    albums: albums.map(_formatAlbum),
 
  pagination: {
    page: Math.floor(offset / limit) + 1,
    per_page: limit,
    total_items: total,
    total_pages: Math.ceil(total / limit),
    has_next: offset + limit < total,
    has_prev: offset > 0,
  },
};
};

exports.getGenrePlaylists = async ({ genreId, limit = 12, offset = 0 }) => {
  const genre = await genreModel.findGenreDetail(genreId);
  if (!genre) {
    throw new AppError('Genre not found', 404, 'RESOURCE_NOT_FOUND');
  }

  const { playlists, total } = await discoveryModel.findGenrePlaylists({ genreId, limit, offset });

  return {
    playlists: playlists.map(_formatPlaylist),

  pagination: {
    page: Math.floor(offset / limit) + 1,
    per_page: limit,
    total_items: total,
    total_pages: Math.ceil(total / limit),
    has_next: offset + limit < total,
    has_prev: offset > 0,
  },
};
};

exports.getGenreArtists = async ({ genreId, limit = 10, offset = 0, currentUserId = null }) => {
  const genre = await genreModel.findGenreDetail(genreId);
  if (!genre) {
    throw new AppError('Genre not found', 404, 'RESOURCE_NOT_FOUND');
  }

  const { artists, total } = await discoveryModel.findGenreArtists({
    genreId,
    limit,
    offset,
    currentUserId,
  });

  return {
   
      artists: artists.map(_formatArtist),
 
    pagination: {
      page: Math.floor(offset / limit) + 1,
      per_page: limit,
      total_items: total,
      total_pages: Math.ceil(total / limit),
      has_next: offset + limit < total,
      has_prev: offset > 0,
    },
  };
};

// Private formatters — shape DB rows into clean API objects
function _formatGenre(row) {
  return {
    id: row.id,
    name: row.name,
    cover_image: row.cover_image || null,
    track_count: parseInt(row.track_count, 10) || 0,
    artist_count: parseInt(row.artist_count, 10) || 0,
  };
}

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

function _formatAlbum(row) {
  return {
    id: row.id,
    name: row.name,
    cover_image: row.cover_image || null,
    owner_id: row.owner_id,
    owner_name: row.owner_name,
    track_count: parseInt(row.track_count, 10) || 0,
    like_count: parseInt(row.like_count, 10) || 0,
    release_date: row.release_date || null,
    created_at: row.created_at,
  };
}

function _formatPlaylist(row) {
  return {
    id: row.id,
    name: row.name,
    cover_image: row.cover_image || null,
    owner_id: row.owner_id,
    owner_name: row.owner_name,
    track_count: parseInt(row.track_count, 10) || 0,
    like_count: parseInt(row.like_count, 10) || 0,
    source: row.source,
    created_at: row.created_at,
  };
}

function _formatArtist(row) {
  return {
    id: row.id,
    display_name: row.display_name,
    username: row.username || null,
    profile_picture: row.profile_picture || null,
    is_verified: row.is_verified,
    follower_count: parseInt(row.followers_count, 10) || 0,
    track_count_in_genre: parseInt(row.track_count_in_genre, 10) || 0,
    is_following: row.is_following || false,
  };
}

