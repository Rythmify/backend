// ============================================================
// routes/playlists.routes.js
// Owner : Alyaa Mohamed (BE-4)
// Modules: Module 7 — Playlists & Sets
// ============================================================
const express      = require('express');
const router       = express.Router();
const controller   = require('../controllers/playlists.controller');
const { authenticate, optionalAuthenticate } = require('../middleware/auth');
const asyncHandler = require('../utils/async-handler');
const { uploadImage } = require('../middleware/multer');

//POST /playlists
router.post(
  '/',
  authenticate,
  uploadImage.single('cover_image'),
  asyncHandler(controller.createPlaylist)
);

//GET /playlists
router.get('/', optionalAuthenticate, asyncHandler(controller.listPlaylists));

// GET /playlists/:playlist_id (Detailed View)
router.get('/:playlist_id', optionalAuthenticate, asyncHandler(controller.getPlaylist));

// PATCH /playlists/:playlist_id
router.patch(
  '/:playlist_id',
  authenticate,
  uploadImage.single('cover_image'),
  asyncHandler(controller.updatePlaylist)
);

// GET /playlists/:playlist_id/tracks
router.get(
  '/:playlist_id/tracks',
  optionalAuthenticate,
  asyncHandler(controller.getPlaylistTracks)
);

// DELETE /playlists/:playlist_id
router.delete(
  '/:playlist_id',
  authenticate,
  asyncHandler(controller.deletePlaylist)
);

// POST /playlists/:playlist_id/tracks — Add track to playlist
router.post(
  '/:playlist_id/tracks',
  authenticate,
  asyncHandler(controller.addTrack)
);

module.exports = router;