// ============================================================
// routes/users.routes.js
// Owner : Omar Hamdy (BE-1)
// Modules: Module 2 — User Profile & Identity
// ============================================================
const express = require('express');
const router = express.Router();
const controller = require('../controllers/users.controller');
const { authenticate, optionalAuthenticate } = require('../middleware/auth');
const asyncHandler = require('../utils/async-handler');
const trackRepostsController = require('../controllers/track-reposts.controller');
const { uploadImage } = require('../middleware/multer');
const { validateUuidParam } = require('../middleware/validate-params');

router.get('/me', authenticate, asyncHandler(controller.getMe));
router.patch('/me', authenticate, asyncHandler(controller.updateMe));
router.patch('/me/account', authenticate, asyncHandler(controller.updateMyAccount));
router.patch('/me/role', authenticate, asyncHandler(controller.switchRole));
router.delete('/me/avatar', authenticate, asyncHandler(controller.deleteMyAvatar));
router.post(
  '/me/avatar',
  authenticate,
  uploadImage.single('avatar'),
  asyncHandler(controller.uploadMyAvatar)
);
router.post(
  '/me/cover',
  authenticate,
  uploadImage.single('cover'),
  asyncHandler(controller.uploadMyCoverPhoto)
);
router.delete('/me/cover', authenticate, asyncHandler(controller.deleteMyCoverPhoto));
router.get('/me/web-profiles', authenticate, asyncHandler(controller.getMyWebProfile));
router.post('/me/web-profiles', authenticate, asyncHandler(controller.addWebProfile));
router.delete(
  '/me/web-profiles/:profile_id',
  authenticate,
  asyncHandler(controller.deleteWebProfile)
);
router.patch('/me/privacy', authenticate, asyncHandler(controller.updatePrivacy));
router.get('/me/content-settings', authenticate, asyncHandler(controller.getMyContentSettings));
router.patch(
  '/me/content-settings',
  authenticate,
  asyncHandler(controller.updateMyContentSettings)
);
router.get('/me/privacy-settings', authenticate, asyncHandler(controller.getMyPrivacySettings));
router.patch(
  '/me/privacy-settings',
  authenticate,
  asyncHandler(controller.updateMyPrivacySettings)
);
router.get('/me/genres', authenticate, asyncHandler(controller.getMyGenres));
router.put('/me/genres', authenticate, asyncHandler(controller.replaceMyGenres));
router.patch('/me/onboarding', authenticate, asyncHandler(controller.completeOnboarding));

// Public user tracks listing
router.get(
  '/by-id/:user_id',
  validateUuidParam('user_id'),
  optionalAuthenticate,
  asyncHandler(controller.getUserById)
);
router.get(
  '/:user_id/tracks',
  validateUuidParam('user_id'),
  asyncHandler(controller.getUserTracks)
);
router.get(
  '/:user_id',
  validateUuidParam('user_id'),
  optionalAuthenticate,
  asyncHandler(controller.getUserById)
);
router.get(
  '/:user_id/reposted-tracks',
  validateUuidParam('user_id'),
  optionalAuthenticate,
  asyncHandler(trackRepostsController.getUserRepostedTracks)
);

module.exports = router;
