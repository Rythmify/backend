// ============================================================
// routes/engagement.routes.js
// Owner : Beshoy Maher (BE-3)
// Modules: Module 6 — Engagement & Social Interactions
// ============================================================
const express = require('express');
const router = express.Router();
const controller = require('../controllers/engagement.controller');
const albumLikesController = require('../controllers/album-likes.controller');
const trackLikesController = require('../controllers/track-likes.controller');
const playlistLikesController = require('../controllers/playlist-likes.controller');
const commentLikesController = require('../controllers/comment-likes.controller');
const { authenticate } = require('../middleware/auth');
const asyncHandler = require('../utils/async-handler');

// Module 6.1 — Track Likes
// POST /api/v1/tracks/:track_id/like. 
// Like a track (idempotent)

router.post('/tracks/:track_id/like', authenticate, asyncHandler(trackLikesController.likeTrack));

// DELETE /api/v1/tracks/:track_id/like
// Unlike a track

router.delete('/tracks/:track_id/like', authenticate, asyncHandler(trackLikesController.unlikeTrack));

//GET /api/v1/tracks/:track_id/likers
//Get paginated list of users who liked a track

router.get('/tracks/:track_id/likers', authenticate, asyncHandler(trackLikesController.getTrackLikers));

// Module 6.2 — Playlist Likes

//POST /api/v1/playlists/:playlist_id/like
//Like a playlist (idempotent)
router.post('/playlists/:playlist_id/like', authenticate, asyncHandler(playlistLikesController.likePlaylist));

//DELETE /api/v1/playlists/:playlist_id/like
//Unlike a playlist

router.delete('/playlists/:playlist_id/like', authenticate, asyncHandler(playlistLikesController.unlikePlaylist));

//GET /api/v1/playlists/:playlist_id/likers
//Get paginated list of users who liked a playlist

router.get('/playlists/:playlist_id/likers', authenticate, asyncHandler(playlistLikesController.getPlaylistLikers));

// Module 6.3 — Album Likes

//POST /api/v1/albums/:album_id/like
//Like an album (idempotent)
router.post('/albums/:album_id/like', authenticate, asyncHandler(albumLikesController.likeAlbum));

//DELETE /api/v1/albums/:album_id/like
//Unlike an album
router.delete('/albums/:album_id/like', authenticate, asyncHandler(albumLikesController.unlikeAlbum));

//GET /api/v1/albums/:album_id/likers
// Get paginated list of users who liked an album
 
router.get('/albums/:album_id/likers', authenticate, asyncHandler(albumLikesController.getAlbumLikers));

// Module 6.4 — Comment Likes

///POST /api/v1/comments/:comment_id/like
//Like a comment (idempotent)

router.post('/comments/:comment_id/like', authenticate, asyncHandler(commentLikesController.likeComment));

//DELETE /api/v1/comments/:comment_id/like
//Unlike a comment
 
router.delete('/comments/:comment_id/like', authenticate, asyncHandler(commentLikesController.unlikeComment));

// Module 6.5 — User Library - Liked Content

//GET /api/v1/me/liked-tracks
//Get authenticated user's liked tracks
router.get('/me/liked-tracks', authenticate, asyncHandler(trackLikesController.getMyLikedTracks));

//GET /api/v1/me/liked-playlists
//Get authenticated user's liked playlists
 
router.get('/me/liked-playlists', authenticate, asyncHandler(playlistLikesController.getMyLikedPlaylists));

//GET /api/v1/me/liked-albums
//Get authenticated user's liked albums

router.get('/me/liked-albums', authenticate, asyncHandler(albumLikesController.getMyLikedAlbums));

module.exports = router;
