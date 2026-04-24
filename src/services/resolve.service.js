const db = require('../db'); // adjust to your db import

const ALLOWED_HOSTNAME = 'rythmify.com';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const bySlugOrId = (identifier, table) =>
  UUID_RE.test(identifier) ? { [`${table}.id`]: identifier } : { [`${table}.slug`]: identifier };

async function resolve(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return { error: 'INVALID_URL' };
  }

  if (!parsed.hostname.endsWith(ALLOWED_HOSTNAME)) {
    return { error: 'INVALID_URL' };
  }

  const [, first, second, third] = parsed.pathname.split('/');
  // e.g. /discover/sets/abc  → ['', 'discover', 'sets', 'abc']
  // e.g. /someuser/sets/abc  → ['', 'someuser', 'sets', 'abc']

  // ── /discover/* ───────────────────────────────────────────────────────────

  if (first === 'discover') {
    // /discover/sets/:mixSlug
    if (second === 'sets' && third) {
      const mix = await db('mixes')
        .where(bySlugOrId(third, 'mixes'))
        .select('id')
        .first();
      if (!mix) return null;
      return { type: 'mix', id: mix.id, permalink: `https://${ALLOWED_HOSTNAME}/discover/sets/${third}` };
    }

    // /discover/stations/:stationSlug
    if (second === 'stations' && third) {
      const station = await db('stations')
        .where(bySlugOrId(third, 'stations'))
        .select('id')
        .first();
      if (!station) return null;
      return { type: 'station', id: station.id, permalink: `https://${ALLOWED_HOSTNAME}/discover/stations/${third}` };
    }

    // /discover/personalised/:playlistSlug
    if (second === 'personalised' && third) {
      const mfy = await db('made_for_you_playlists')
        .where(bySlugOrId(third, 'made_for_you_playlists'))
        .select('id')
        .first();
      if (!mfy) return null;
      return { type: 'made_for_you', id: mfy.id, permalink: `https://${ALLOWED_HOSTNAME}/discover/personalised/${third}` };
    }

    return null;
  }

  // ── /:username ────────────────────────────────────────────────────────────

  if (!first) return null;

  if (!second) {
    const user = await db('users').where({ username: first }).select('id').first();
    if (!user) return null;
    return { type: 'user', id: user.id, permalink: `https://${ALLOWED_HOSTNAME}/${first}` };
  }

  // ── /:username/tracks/:slug ───────────────────────────────────────────────

  if (second === 'tracks' && third) {
    const track = await db('tracks')
      .join('users', 'users.id', 'tracks.user_id')
      .where({ 'users.username': first })
      .andWhere(bySlugOrId(third, 'tracks'))
      .select('tracks.id', 'tracks.visibility', 'tracks.user_id')
      .first();
    if (!track) return null;
    return { type: 'track', id: track.id, permalink: `https://${ALLOWED_HOSTNAME}/${first}/tracks/${third}`, visibility: track.visibility, owner_id: track.user_id };
  }

  // ── /:username/sets/:slug → Playlist ──────────────────────────────────────

  if (second === 'sets' && third) {
    const playlist = await db('playlists')
      .join('users', 'users.id', 'playlists.user_id')
      .where({ 'users.username': first })
      .andWhere(bySlugOrId(third, 'playlists'))
      .select('playlists.id', 'playlists.visibility', 'playlists.user_id')
      .first();
    if (!playlist) return null;
    return { type: 'playlist', id: playlist.id, permalink: `https://${ALLOWED_HOSTNAME}/${first}/sets/${third}`, visibility: playlist.visibility, owner_id: playlist.user_id };
  }

  // ── /:username/album/:slug ────────────────────────────────────────────────

  if (second === 'album' && third) {
    const album = await db('albums')
      .join('users', 'users.id', 'albums.user_id')
      .where({ 'users.username': first })
      .andWhere(bySlugOrId(third, 'albums'))
      .select('albums.id', 'albums.visibility', 'albums.user_id')
      .first();
    if (!album) return null;
    return { type: 'album', id: album.id, permalink: `https://${ALLOWED_HOSTNAME}/${first}/album/${third}`, visibility: album.visibility, owner_id: album.user_id };
  }

  return null;
}

module.exports = { resolve };