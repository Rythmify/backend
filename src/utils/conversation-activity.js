
// backend-only  for "user is currently in a conversation" without relying on Socket.IO. to prevent edits for cross/front teams
// We mark a user as active when they hit conversation-related HTTP endpoints.
//
//  This is per-node-process state (not shared across multiple server instances).

const lastActiveByUserAndConversation = new Map(); // to avoid unbounded memory growth, we only store keys for active conversations and rely on expiration (see isRecentlyActive)

const normalizeKey = (value) => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

const makeKey = (userId, conversationId) => {
  const uid = normalizeKey(userId);
  const cid = normalizeKey(conversationId);
  if (!uid || !cid) return null;
  return `${uid}:${cid}`;
};

exports.markActive = ({ userId, conversationId, now = Date.now() } = {}) => {
  const key = makeKey(userId, conversationId);
  if (!key) return;
  lastActiveByUserAndConversation.set(key, now);
};

exports.isRecentlyActive = ({
  userId,
  conversationId,
  withinMs = 30_000,
  now = Date.now(),
} = {}) => {
  const key = makeKey(userId, conversationId);
  if (!key) return false;

  const last = lastActiveByUserAndConversation.get(key);
  if (!last) return false;

  return now - last <= withinMs;
};

// For unit tests only
exports._resetForTests = () => {
  lastActiveByUserAndConversation.clear();
};
