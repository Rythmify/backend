// ============================================================
// routes/engagement.routes.js
// Owner : Beshoy Maher (BE-3)
// Modules: Module 6 — Engagement & Social Interactions
// ============================================================
const express = require('express');
const router = express.Router();
const albumLikesController = require('../controllers/album-likes.controller');
const trackLikesController = require('../controllers/track-likes.controller');
const trackRepostsController = require('../controllers/track-reposts.controller');
const playlistLikesController = require('../controllers/playlist-likes.controller');
const playlistRepostsController = require('../controllers/playlist-reposts.controller');
const albumRepostsController = require('../controllers/album-reposts.controller');
const commentLikesController = require('../controllers/comment-likes.controller');
const commentController = require('../controllers/comment.controller');
const { authenticate, optionalAuthenticate } = require('../middleware/auth');
const asyncHandler = require('../utils/async-handler');

// Module 6.1 — Track Likes
// POST /api/v1/tracks/:track_id/like.
// Like a track (idempotent)

router.post('/tracks/:track_id/like', authenticate, asyncHandler(trackLikesController.likeTrack));

// DELETE /api/v1/tracks/:track_id/like
// Unlike a track

router.delete(
  '/tracks/:track_id/like',
  authenticate,
  asyncHandler(trackLikesController.unlikeTrack)
);

//GET /api/v1/tracks/:track_id/likers
//Get paginated list of users who liked a track

router.get(
  '/tracks/:track_id/likers',
  authenticate,
  asyncHandler(trackLikesController.getTrackLikers)
);

// Module 6.1b — Track Reposts
// POST /api/v1/tracks/:track_id/repost
// Repost a track (idempotent)

router.post(
  '/tracks/:track_id/repost',
  authenticate,
  asyncHandler(trackRepostsController.repostTrack)
);

// DELETE /api/v1/tracks/:track_id/repost
// Remove a repost

router.delete(
  '/tracks/:track_id/repost',
  authenticate,
  asyncHandler(trackRepostsController.removeRepost)
);

// GET /api/v1/tracks/:track_id/reposters
// Get paginated list of users who reposted a track

router.get(
  '/tracks/:track_id/reposters',
  authenticate,
  asyncHandler(trackRepostsController.getTrackReposters)
);

// Module 6.2 — Playlist Likes

//POST /api/v1/playlists/:playlist_id/like
//Like a playlist (idempotent)
router.post(
  '/playlists/:playlist_id/like',
  authenticate,
  asyncHandler(playlistLikesController.likePlaylist)
);

//DELETE /api/v1/playlists/:playlist_id/like
//Unlike a playlist

router.delete(
  '/playlists/:playlist_id/like',
  authenticate,
  asyncHandler(playlistLikesController.unlikePlaylist)
);

//GET /api/v1/playlists/:playlist_id/likers
//Get paginated list of users who liked a playlist

router.get(
  '/playlists/:playlist_id/likers',
  authenticate,
  asyncHandler(playlistLikesController.getPlaylistLikers)
);

// Module 6.2b — Playlist Reposts

//POST /api/v1/playlists/:playlist_id/repost
//Repost a playlist (idempotent)
router.post(
  '/playlists/:playlist_id/repost',
  authenticate,
  asyncHandler(playlistRepostsController.repostPlaylist)
);

//DELETE /api/v1/playlists/:playlist_id/repost
//Remove a playlist repost

router.delete(
  '/playlists/:playlist_id/repost',
  authenticate,
  asyncHandler(playlistRepostsController.removeRepost)
);

//GET /api/v1/playlists/:playlist_id/reposters
//Get paginated list of users who reposted a playlist

router.get(
  '/playlists/:playlist_id/reposters',
  authenticate,
  asyncHandler(playlistRepostsController.getPlaylistReposters)
);

// Module 6.3 — Album Likes

//POST /api/v1/albums/:album_id/like
//Like an album (idempotent)
router.post('/albums/:album_id/like', authenticate, asyncHandler(albumLikesController.likeAlbum));

//DELETE /api/v1/albums/:album_id/like
//Unlike an album
router.delete(
  '/albums/:album_id/like',
  authenticate,
  asyncHandler(albumLikesController.unlikeAlbum)
);

//GET /api/v1/albums/:album_id/likers
// Get paginated list of users who liked an album

router.get(
  '/albums/:album_id/likers',
  authenticate,
  asyncHandler(albumLikesController.getAlbumLikers)
);

// Module 6.3b — Album Reposts

//POST /api/v1/albums/:album_id/repost
//Repost an album (idempotent)
router.post(
  '/albums/:album_id/repost',
  authenticate,
  asyncHandler(albumRepostsController.repostAlbum)
);

//DELETE /api/v1/albums/:album_id/repost
//Remove an album repost

router.delete(
  '/albums/:album_id/repost',
  authenticate,
  asyncHandler(albumRepostsController.removeRepost)
);

//GET /api/v1/albums/:album_id/reposters
//Get paginated list of users who reposted an album

router.get(
  '/albums/:album_id/reposters',
  authenticate,
  asyncHandler(albumRepostsController.getAlbumReposters)
);

// Module 6.4 — Comment Likes

///POST /api/v1/comments/:comment_id/like
//Like a comment (idempotent)

router.post(
  '/comments/:comment_id/like',
  authenticate,
  asyncHandler(commentLikesController.likeComment)
);

//DELETE /api/v1/comments/:comment_id/like
//Unlike a comment

router.delete(
  '/comments/:comment_id/like',
  authenticate,
  asyncHandler(commentLikesController.unlikeComment)
);

// Module 6.5 — User Library - Liked Content

//GET /api/v1/me/liked-tracks
//Get authenticated user's liked tracks
router.get('/me/liked-tracks', authenticate, asyncHandler(trackLikesController.getMyLikedTracks));

//GET /api/v1/me/liked-playlists
//Get authenticated user's liked playlists

router.get(
  '/me/liked-playlists',
  authenticate,
  asyncHandler(playlistLikesController.getMyLikedPlaylists)
);

//GET /api/v1/me/liked-albums
//Get authenticated user's liked albums

router.get('/me/liked-albums', authenticate, asyncHandler(albumLikesController.getMyLikedAlbums));

// Module 6.5b — User Library - Reposted Content

//GET /api/v1/me/reposted-tracks
//Get authenticated user's reposted tracks

router.get(
  '/me/reposted-tracks',
  authenticate,
  asyncHandler(trackRepostsController.getMyRepostedTracks)
);

//GET /api/v1/me/reposted-playlists
//Get authenticated user's reposted playlists

router.get(
  '/me/reposted-playlists',
  authenticate,
  asyncHandler(playlistRepostsController.getMyRepostedPlaylists)
);

//GET /api/v1/me/reposted-albums
//Get authenticated user's reposted albums

router.get(
  '/me/reposted-albums',
  authenticate,
  asyncHandler(albumRepostsController.getMyRepostedAlbums)
);

// Module 6.6 — Comments & Replies

// GET /api/v1/tracks/:track_id/comments
// List paginated top-level comments with optional timestamp filtering and sorting
router.get(
  '/tracks/:track_id/comments',
  optionalAuthenticate,
  asyncHandler(commentController.getTrackComments)
);

// POST /api/v1/tracks/:track_id/comments
// Create a new top-level comment on a track
router.post(
  '/tracks/:track_id/comments',
  authenticate,
  asyncHandler(commentController.createComment)
);

// GET /api/v1/comments/:comment_id
// Fetch a single comment by ID
router.get('/comments/:comment_id', optionalAuthenticate, asyncHandler(commentController.getComment));

// PATCH /api/v1/comments/:comment_id
// Update a comment (only author can update)
router.patch('/comments/:comment_id', authenticate, asyncHandler(commentController.updateComment));

// DELETE /api/v1/comments/:comment_id
// Delete a comment (only author can delete, cascade deletes all replies)
router.delete('/comments/:comment_id', authenticate, asyncHandler(commentController.deleteComment));

// GET /api/v1/comments/:comment_id/replies
// List paginated replies to a top-level comment
router.get(
  '/comments/:comment_id/replies',
  optionalAuthenticate,
  asyncHandler(commentController.getCommentReplies)
);

// POST /api/v1/comments/:comment_id/replies
// Create a reply to a top-level comment
router.post(
  '/comments/:comment_id/replies',
  authenticate,
  asyncHandler(commentController.createReply)
);

module.exports = router;
