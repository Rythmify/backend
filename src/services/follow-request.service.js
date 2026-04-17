// ============================================================
// services/follow-request.service.js
// Owner: Beshoy Maher (BE-3)
// Business logic for follow request operations (private accounts)
// ============================================================

const followRequestModel = require('../models/follow-request.model');
const userModel = require('../models/user.model');
const AppError = require('../utils/app-error');

// ===== GET OPERATIONS =====

/**
 * Get pending follow requests for the authenticated user
 * Paginated list of users who want to follow them
 */
exports.getPendingFollowRequests = async (userId, limit, offset) => {
  // Validate pagination
  if (isNaN(limit) || isNaN(offset) || limit < 1 || limit > 100 || offset < 0) {
    throw new AppError('Limit must be 1-100, offset must be >= 0', 400, 'VALIDATION_FAILED');
  }

  const result = await followRequestModel.getPendingRequests(userId, limit, offset);
  return result;
};

/**
 * Get follow request status between two users
 * Returns: 'pending', 'accepted', 'rejected', or null if no request
 */
exports.getRequestStatus = async (followerId, userId) => {
  const status = await followRequestModel.getRequestStatus(followerId, userId);
  return status;
};

// ===== ACCEPT/REJECT/CANCEL OPERATIONS =====

/**
 * Accept a follow request
 * Converts pending follow request to actual follow relationship
 * Validation: request exists, is pending, user is recipient
 */
exports.acceptFollowRequest = async (requestId, userId) => {
  // Verify user exists and not suspended
  const user = await userModel.findById(userId);
  if (!user) {
    throw new AppError('User not found', 404, 'RESOURCE_NOT_FOUND');
  }
  if (user.is_suspended) {
    throw new AppError('Suspended users cannot perform this action', 403, 'USER_SUSPENDED');
  }

  // Accept the request (model handles validation)
  const result = await followRequestModel.acceptFollowRequest(requestId, userId);

  return {
    request_id: result.id,
    follower_id: result.follower_id,
    following_id: result.following_id,
    status: result.status,
    accepted_at: result.updated_at,
    isNew: result.isNew, // Flag: true if new follow created, false if already accepted
  };
};

/**
 * Reject a follow request
 * Updates request status without creating follow relationship
 * Validation: request exists, is pending, user is recipient
 */
exports.rejectFollowRequest = async (requestId, userId) => {
  // Verify user exists and not suspended
  const user = await userModel.findById(userId);
  if (!user) {
    throw new AppError('User not found', 404, 'RESOURCE_NOT_FOUND');
  }
  if (user.is_suspended) {
    throw new AppError('Suspended users cannot perform this action', 403, 'USER_SUSPENDED');
  }

  // Reject the request (model handles validation)
  const result = await followRequestModel.rejectFollowRequest(requestId, userId);

  return {
    request_id: result.id,
    follower_id: result.follower_id,
    following_id: result.following_id,
    status: result.status,
    rejected_at: result.updated_at,
  };
};

/**
 * Cancel a follow request (follower cancels their own request)
 * Deletes the follow request entirely
 * Validation: request exists, user is requester
 */
exports.cancelFollowRequest = async (requestId, followerId) => {
  // Verify user exists
  const user = await userModel.findById(followerId);
  if (!user) {
    throw new AppError('User not found', 404, 'RESOURCE_NOT_FOUND');
  }

  // Cancel the request (model handles validation)
  await followRequestModel.cancelFollowRequest(requestId, followerId);

  return { success: true };
};
