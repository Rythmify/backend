const resolveModel = require('../models/resolve.model');

// UUID regex
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUUID(str) {
  return UUID_RE.test(str);
}

/**
 * Parses a pathname into { type, id } based on URL patterns:
 *
 *  /playlist/<uuid>                → playlist
 *  /<username>/playlist-<uuid>     → playlist
 *  /<username>/<uuid>              → track
 *  //<uuid>  or /<uuid>            → try playlist then track
 */
function parsePath(pathname) {
  // Normalize — remove leading slash, split
  const parts = pathname.replace(/^\/+/, '').split('/').filter(Boolean);

  // /playlist/<uuid>
  if (parts.length === 2 && parts[0] === 'playlist' && isUUID(parts[1])) {
    return { type: 'playlist', id: parts[1] };
  }

  // /<username>/playlist-<uuid>
  if (parts.length === 2 && parts[1].startsWith('playlist-')) {
    const id = parts[1].replace('playlist-', '');
    if (isUUID(id)) return { type: 'playlist', id };
  }

  // /<username>/<uuid>  → track
  if (parts.length === 2 && isUUID(parts[1])) {
    return { type: 'track', id: parts[1] };
  }

  // /<uuid> alone — ambiguous, try both
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
    const subtype = await resolveModel.playlistSubtype(parsed.id);
    if (!subtype) return null;
    // subtype is 'playlist' or 'album' from the DB
    return { type: subtype, id: parsed.id };
  }

  if (parsed.type === 'ambiguous') {
    // Try playlist/album first, then track
    const subtype = await resolveModel.playlistSubtype(parsed.id);
    if (subtype) return { type: subtype, id: parsed.id };

    const exists = await resolveModel.trackExists(parsed.id);
    if (exists) return { type: 'track', id: parsed.id };

    return null;
  }

  return null;
}

module.exports = { resolve };