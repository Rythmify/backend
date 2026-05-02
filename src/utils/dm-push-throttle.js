// Simple in-memory throttle to avoid spamming DM push notifications
// For each recipient+conversation, we allow one push within the cooldown window (e.g. 60s)

const lastPushByRecipientAndConversation = new Map(); // `${recipientId}:${conversationId}` -> timestampMs

const normalizeKey = (value) => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

const makeKey = (recipientId, conversationId) => {
  const rid = normalizeKey(recipientId);
  const cid = normalizeKey(conversationId);
  if (!rid || !cid) return null;
  return `${rid}:${cid}`;
};

exports.isThrottled = ({
  recipientId,
  conversationId,
  withinMs = 60_000,
  now = Date.now(),
} = {}) => {
  const key = makeKey(recipientId, conversationId);
  if (!key) return false;

  const last = lastPushByRecipientAndConversation.get(key);
  if (!last) return false;

  return now - last <= withinMs;
};

exports.markSent = ({ recipientId, conversationId, now = Date.now() } = {}) => {
  const key = makeKey(recipientId, conversationId);
  if (!key) return;
  lastPushByRecipientAndConversation.set(key, now);
};

// For unit tests only
exports._resetForTests = () => {
  lastPushByRecipientAndConversation.clear();
};
