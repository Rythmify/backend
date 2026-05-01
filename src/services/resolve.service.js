// resolve.service.js
const resolveModel = require('../models/resolve.model');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUUID(str) {
  return UUID_RE.test(str);
}

function parsePath(pathname) {
  const parts = pathname.replace(/^\/+/, '').split('/').filter(Boolean);

  // /<username>/sets/<uuid-or-slug>  → playlist
  if (parts.length === 3 && parts[1] === 'sets') {
    return { type: 'playlist', id: parts[2] };
  }

  // /<username>/album/<uuid-or-slug>  → album
  if (parts.length === 3 && parts[1] === 'album') {
    return { type: 'album', id: parts[2] };
  }

  // /<username>/<uuid>  → track
  if (parts.length === 2 && isUUID(parts[1])) {
    return { type: 'track', id: parts[1] };
  }

  // /<username>  → user
  if (parts.length === 1 && !isUUID(parts[0])) {
    return { type: 'user', id: parts[0] };
  }

  // /<uuid> alone  → ambiguous, try playlist then track
  if (parts.length === 1 && isUUID(parts[0])) {
    return { type: 'ambiguous', id: parts[0] };
  }

  return null;
}

async function resolve(pathname) {
  const parsed = parsePath(pathname);
  if (!parsed) return null;

  if (parsed.type === 'track') {
    const exists = await resolveModel.trackExists(parsed.id);
    return exists ? { type: 'track', id: parsed.id } : null;
  }

  if (parsed.type === 'playlist') {
    const lookup = isUUID(parsed.id)
      ? await resolveModel.playlistSubtype(parsed.id)
      : await resolveModel.playlistSubtypeBySlug(parsed.id);

    if (!lookup) return null;
    return { type: lookup, id: parsed.id };
  }

  if (parsed.type === 'album') {
    const lookup = isUUID(parsed.id)
      ? await resolveModel.playlistSubtype(parsed.id)
      : await resolveModel.playlistSubtypeBySlug(parsed.id);

    if (!lookup) return null;
    return { type: lookup, id: parsed.id };
  }

  if (parsed.type === 'user') {
    const exists = await resolveModel.userExists(parsed.id);
    return exists ? { type: 'user', id: parsed.id } : null;
  }

  if (parsed.type === 'ambiguous') {
    const subtype = await resolveModel.playlistSubtype(parsed.id);
    if (subtype) return { type: subtype, id: parsed.id };

    const exists = await resolveModel.trackExists(parsed.id);
    if (exists) return { type: 'track', id: parsed.id };

    return null;
  }

  return null;
}

module.exports = { resolve };
