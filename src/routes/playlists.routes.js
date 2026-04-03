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

module.exports = router;
