// ============================================================
// controllers/playback.controller.js
// Owner : Saja Aboulmagd (BE-2)
// Receives validated requests → calls service → returns HTTP response
// ============================================================
const playbackService = require('../services/playback.service');
const { success, error } = require('../utils/api-response');

/* Resolves the authenticated requester ID for endpoints that require a signed-in user. */
const getAuthenticatedUserId = (req, res) => {
  const userId = req?.user?.sub || req?.user?.id || req?.user?.user_id;
  if (!userId) {
    error(res, 'UNAUTHORIZED', 'Authentication required.', 401);
    return null;
  }
  return userId;
};

/* Resolves the requester ID when authentication is optional and anonymous access is allowed. */
const getOptionalUserId = (req) => req?.user?.sub || req?.user?.id || req?.user?.user_id || null;

/* Returns the playback accessibility state for a track without recording a play event. */
exports.getPlaybackState = async (req, res) => {
  const data = await playbackService.getPlaybackState({
    trackId: req.params?.track_id,
    requesterUserId: getOptionalUserId(req),
    secretToken: req.query?.secret_token || null,
  });

  return success(res, data, 'Playback state fetched successfully.');
};

/* Resolves a play request and returns the playable URL payload without persisting player state. */
exports.playTrack = async (req, res) => {
  const data = await playbackService.playTrack({
    trackId: req.params?.track_id,
    requesterUserId: getOptionalUserId(req),
    secretToken: req.query?.secret_token || null,
  });

  return success(res, data, 'Track play resolved successfully.');
};

/* Returns the authenticated user's last persisted player state. */
exports.getPlayerState = async (req, res) => {
  const userId = getAuthenticatedUserId(req, res);
  if (!userId) return;

  const data = await playbackService.getPlayerState({ userId });
  return success(res, data, 'Player state fetched successfully.');
};

/* Returns the authenticated user's deduplicated recently played tracks. */
exports.getRecentlyPlayed = async (req, res) => {
  const userId = getAuthenticatedUserId(req, res);
  if (!userId) return;

  const data = await playbackService.getRecentlyPlayed({
    userId,
    limit: req.query?.limit,
    offset: req.query?.offset,
  });
  return success(res, data.data, 'Recently played fetched successfully.', 200, data.pagination);
};

/* Deletes all listening history for the authenticated user and returns no content. */
exports.clearListeningHistory = async (req, res) => {
  const userId = getAuthenticatedUserId(req, res);
  if (!userId) return;

  await playbackService.clearListeningHistory({ userId });
  return res.status(204).send();
};

/* Returns the authenticated user's paginated play-by-play listening history. */
exports.getListeningHistory = async (req, res) => {
  const userId = getAuthenticatedUserId(req, res);
  if (!userId) return;

  const data = await playbackService.getListeningHistory({
    userId,
    limit: req.query?.limit,
    offset: req.query?.offset,
  });

  return success(res, data.data, 'Listening history fetched successfully.', 200, data.pagination);
};

/* Records one authenticated listening history entry and reports whether it was created or deduplicated. */
exports.writeListeningHistory = async (req, res) => {
  const userId = getAuthenticatedUserId(req, res);
  if (!userId) return;

  const result = await playbackService.writeListeningHistory({
    userId,
    trackId: req.body?.track_id,
    playedAt: req.body?.played_at,
    durationPlayedSeconds: req.body?.duration_played_seconds,
  });

  return success(res, result.data, result.message, result.created ? 201 : 200);
};

/* Persists the authenticated user's player queue, position, and playback preferences. */
exports.savePlayerState = async (req, res) => {
  const userId = getAuthenticatedUserId(req, res);
  if (!userId) return;

  const data = await playbackService.savePlayerState({
    userId,
    trackId: req.body?.track_id,
    positionSeconds: req.body?.position_seconds,
    volume: req.body?.volume,
    queue: req.body?.queue,
  });

  return success(res, data, 'Player state saved successfully.');
};
