// ============================================================
// services/track-reposts.service.js
// Owner: Beshoy Maher (BE-3)
// Business logic, rules & cross-module orchestration
// Delegates SQL to models/
// ============================================================

const trackRepostModel = require('../models/track-repost.model');
const AppError = require('../utils/app-error');
const notificationModel = require('../models/notification.model');
const emailNotificationsService = require('./email-notifications.service');
const userModel = require('../models/user.model');
const followModel = require('../models/follow.model');

/* Forces viewer-personalized flags into stable booleans regardless of SQL driver edge cases. */
const normalizeViewerFlags = (track) => {
  if (!track) {
    return track;
  }

  return {
    ...track,
    is_liked_by_me: Boolean(track.is_liked_by_me),
    is_reposted_by_me: Boolean(track.is_reposted_by_me),
    is_artist_followed_by_me: Boolean(track.is_artist_followed_by_me),
  };
};

/**
 * Get paginated list of users who reposted a track
 * Includes user profile information
 */
exports.getTrackReposters = async (trackId, limit = 20, offset = 0) => {
  // Validate inputs
  if (!trackId || trackId.trim() === '') {
    throw new AppError('Track ID is required', 400, 'INVALID_REQUEST');
  }

  if (limit < 1 || limit > 100) {
    limit = 20; // Default
  }
  if (offset < 0) {
    offset = 0;
  }

  return await trackRepostModel.getTrackReposters(trackId, limit, offset);
};

/**
 * Repost a track (idempotent operation)
 * Business rules:
 *   - User cannot repost their own track
 * Returns:
 *   - 201: Track newly reposted
 *   - 200: Already reposted (no change)
 */
exports.repostTrack = async (userId, trackId) => {
  // Validate inputs
  if (!userId || userId.trim() === '') {
    throw new AppError('User ID is required', 400, 'INVALID_REQUEST');
  }
  if (!trackId || trackId.trim() === '') {
    throw new AppError('Track ID is required', 400, 'INVALID_REQUEST');
  }

  // Check if user is trying to repost their own track
  const trackOwner = await trackRepostModel.getTrackOwner(trackId);
  if (trackOwner === userId) {
    throw new AppError('Cannot repost your own track', 400, 'CANNOT_REPOST_OWN_TRACK');
  }

  // Attempt to repost track
  const { created, repost } = await trackRepostModel.repostTrack(userId, trackId);

  await notifyTrackRepostIfNeeded({ created, userId, trackId });

  return {
    repostId: repost.id,
    userId: repost.user_id,
    trackId: repost.track_id,
    createdAt: repost.created_at,
    isNew: created, // Flag to determine HTTP status (201 vs 200)
  };
};

/**
 * Remove a repost from a track (idempotent operation)
 * Returns: true if deleted, false if didn't exist
 */
exports.removeRepost = async (userId, trackId) => {
  // Validate inputs
  if (!userId || userId.trim() === '') {
    throw new AppError('User ID is required', 400, 'INVALID_REQUEST');
  }
  if (!trackId || trackId.trim() === '') {
    throw new AppError('Track ID is required', 400, 'INVALID_REQUEST');
  }

  // Attempt to remove repost
  const deleted = await trackRepostModel.removeRepost(userId, trackId);

  if (!deleted) {
    throw new AppError('Repost not found', 404, 'REPOST_NOT_FOUND');
  }

  return true;
};

/**
 * Get authenticated user's reposted tracks (for /me/reposted-tracks)
 */
exports.getUserRepostedTracks = async (userId, limit = 20, offset = 0) => {
  if (!userId || userId.trim() === '')
    throw new AppError('User ID is required', 400, 'INVALID_REQUEST');

  // For /me, the target and the requester are the exact same user
  const result = await trackRepostModel.getUserRepostedTracks(userId, userId, limit, offset);

  return {
    ...result,
    items: result.items.map(normalizeViewerFlags),
  };
};

/**
 * Get public user's reposted tracks (for /users/{user_id}/reposted-tracks)
 * Includes privacy check
 */
exports.getPublicUserRepostedTracks = async (targetUserId, requesterId, limit = 20, offset = 0) => {
  if (!targetUserId || targetUserId.trim() === '')
    throw new AppError('User ID is required', 400, 'INVALID_REQUEST');

  // 1. Verify User Exists
  const targetUser = await userModel.findById(targetUserId);
  if (!targetUser) throw new AppError('User not found', 404, 'NOT_FOUND');

  // 2. Privacy Check
  if (targetUser.is_private && targetUserId !== requesterId) {
    if (!requesterId) {
      throw new AppError(
        'This profile is private. You must sign in and follow the user to view their reposts.',
        403,
        'PROFILE_ACCESS_DENIED'
      );
    }

    const followStatus = await followModel.getFollowStatus(requesterId, targetUserId);
    if (!followStatus.is_following) {
      throw new AppError(
        'This profile is private. You must follow the user to view their reposts.',
        403,
        'PROFILE_ACCESS_DENIED'
      );
    }
  }

  // 3. Fetch Data passing both IDs so flags calculate properly
  const result = await trackRepostModel.getUserRepostedTracks(
    targetUserId,
    requesterId,
    limit,
    offset
  );

  return {
    ...result,
    items: result.items.map(normalizeViewerFlags),
  };
};

/**
 * Check if user has reposted a track (used for response decoration)
 */
exports.isTrackRepostedByUser = async (userId, trackId) => {
  if (!userId) return false;
  return await trackRepostModel.isTrackRepostedByUser(userId, trackId);
};

/**
 * Get total repost count for a track
 */
exports.getTrackRepostCount = async (trackId) => {
  if (!trackId) return 0;
  return await trackRepostModel.getTrackRepostCount(trackId);
};

async function notifyTrackRepostIfNeeded({ created, userId, trackId }) {
  if (!created) return;

  const ownerId = await notificationModel.getTrackOwnerId(trackId);
  if (!ownerId || ownerId === userId) return;

  await notificationModel.createNotification({
    userId: ownerId,
    actionUserId: userId,
    type: 'repost',
    referenceId: trackId,
    referenceType: 'track',
  });

  await emailNotificationsService.sendGeneralNotificationEmailIfEligible({
    recipientUserId: ownerId,
    actionUserId: userId,
    type: 'repost',
  });
}
