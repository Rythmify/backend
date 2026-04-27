'use strict';

require('dotenv').config();

// ── Startup env validation ────────────────────────────────────────────────────
const _required = ['DATABASE_URL', 'AZURE_STORAGE_CONNECTION_STRING'];
const _missing = _required.filter((k) => !process.env[k]);
if (_missing.length > 0) {
  console.error('Missing required env vars:', _missing.join(', '));
  process.exit(1);
}

const _connStr = process.env.AZURE_STORAGE_CONNECTION_STRING;
if (!_connStr.includes('AccountKey=')) {
  console.error('AZURE_STORAGE_CONNECTION_STRING is missing AccountKey');
  process.exit(1);
}
if (!_connStr.endsWith('==') && !_connStr.includes(';EndpointSuffix=')) {
  console.error('AZURE_STORAGE_CONNECTION_STRING appears truncated (AccountKey must end with ==)');
  process.exit(1);
}

if (
  process.env.DATABASE_URL &&
  process.env.DATABASE_URL.includes('rythmifydb.postgres.database.azure.com')
) {
  console.error(
    'DATABASE_URL contains wrong hostname "rythmifydb.postgres.database.azure.com".\n' +
      'The correct hostname is "rythmify-db.postgres.database.azure.com" (with a hyphen).'
  );
  process.exit(1);
}
// ─────────────────────────────────────────────────────────────────────────────

const fs = require('fs/promises');
const fsSync = require('fs');
const path = require('path');
const { Client } = require('pg');
const storageService = require('../src/services/storage.service');
const tracksService = require('../src/services/tracks.service');
const {
  ARTIST_EMAILS,
  buildAudioManifest,
  normalize: normalizeManifestValue,
  normalizeTitle: normalizeManifestTitle,
} = require('./seed-audio-manifest');

const backendRoot = path.resolve(__dirname, '..');
const projectRoot = path.resolve(backendRoot, '..');
const seedAssetCandidates = [
  path.join(backendRoot, 'seed-assets'),
  path.join(backendRoot, 'seeds', 'seed-assets'),
  path.join(projectRoot, 'seed-assets'),
];
const seedAssetsRoot =
  seedAssetCandidates.find(
    (candidate) =>
      fsSync.existsSync(path.join(candidate, 'audio')) ||
      fsSync.existsSync(path.join(candidate, 'images'))
  ) || seedAssetCandidates[0];

const audioRoot = path.join(seedAssetsRoot, 'audio');
const artistImagesRoot = path.join(seedAssetsRoot, 'images', 'artists');
const artistCoversRoot = path.join(seedAssetsRoot, 'images', 'covers');
const legacyArtistCoversRoot = path.join(seedAssetsRoot, 'images', 'artists', 'covers');
const trackMediaRoot = path.join(seedAssetsRoot, 'images', 'tracks');

const SEEDED_ARTIST_EMAILS = ARTIST_EMAILS;

const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp']);
const MIME_TYPES = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.mp3': 'audio/mpeg',
  '.json': 'application/json',
};

const summary = {
  totalMp3Files: 0,
  totalTracksInDb: 0,
  matchedTracks: 0,
  audioUploaded: 0,
  trackImagesUploaded: 0,
  trackImagesPreserved: 0,
  playlistCoversUploaded: 0,
  albumCoversUpdated: 0,
  artistPlaylistCoversUpdated: 0,
  artistAvatarsUploaded: 0,
  artistCoversUploaded: 0,
  audioBlobsDeleted: 0,
  waveformBlobsDeleted: 0,
  tracksUpdated: 0,
  listeningHistoryInserted: 0,
  waveformFilesFound: 0,
  waveformsGenerated: 0,
  skippedAlreadyExisting: 0,
  unmatchedDbTracks: [],
  unmatchedFiles: [],
  missingAssets: [],
  failedUploads: [],
  mappingReport: [],
};

function hasAsset(value) {
  return Boolean(value && value !== 'pending');
}

function normalize(value) {
  return normalizeManifestValue(value)
    .replace(/_/g, ' ')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeArtistName(value) {
  return normalize(value).replace(/^the /, '');
}

function normalizeTrackTitle(value) {
  return normalizeManifestTitle(value)
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\bfeat\b.*$/i, '')
    .replace(/\bfeaturing\b.*$/i, '')
    .replace(/\bexplicit version\b/g, '')
    .replace(/\bradio edit\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function makeKey(artistName, title) {
  return `${normalizeArtistName(artistName)}::${normalizeTrackTitle(title)}`;
}

function makeArtistSeedPlaylistName(artistName) {
  return `${artistName} - Rythmify Seed`;
}

function stripSeedSuffix(folderName) {
  return folderName.replace(/\s+-\s+Rythmify Seed$/i, '');
}

function mimeTypeFor(filePath) {
  return MIME_TYPES[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
}

function isImage(filePath) {
  return IMAGE_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}

function relativePath(filePath) {
  return path.relative(projectRoot, filePath);
}

function recordMissing(label, filePath) {
  const message = `${label}: ${relativePath(filePath)}`;
  summary.missingAssets.push(message);
  console.warn(`WARN missing ${message}`);
}

function recordFailure(label, filePath, err) {
  const message = `${label}: ${relativePath(filePath)} - ${err.message}`;
  summary.failedUploads.push(message);
  console.error(`ERROR ${message}`);
}

async function fileExists(filePath) {
  try {
    const stat = await fs.stat(filePath);
    return stat.isFile();
  } catch (err) {
    if (err.code === 'ENOENT') return false;
    throw err;
  }
}

async function directoryExists(dirPath) {
  try {
    const stat = await fs.stat(dirPath);
    return stat.isDirectory();
  } catch (err) {
    if (err.code === 'ENOENT') return false;
    throw err;
  }
}

async function listFilesRecursive(dirPath) {
  if (!(await directoryExists(dirPath))) return [];

  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listFilesRecursive(fullPath)));
    } else if (entry.isFile()) {
      files.push(fullPath);
    }
  }

  return files;
}

async function readUploadFile(filePath) {
  const stat = await fs.stat(filePath);
  return {
    buffer: await fs.readFile(filePath),
    mimetype: mimeTypeFor(filePath),
    originalname: path.basename(filePath),
    size: stat.size,
  };
}

async function uploadImageFile(filePath, key) {
  const file = await readUploadFile(filePath);
  const uploaded = await storageService.uploadImage(file, key);
  return uploaded.url;
}

function parseAudioFilename(filePath) {
  const basename = path.basename(filePath, path.extname(filePath));
  const parts = basename
    .split(/\s+-\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length < 3 || !/^\d+$/.test(parts[0])) return null;

  const folderArtist = stripSeedSuffix(path.basename(path.dirname(filePath)));
  return {
    filePath,
    folderArtist,
    parsedArtist: parts[1],
    title: parts.slice(2).join(' - ').replace(/_/g, ' ').trim(),
    trackNumber: Number(parts[0]),
    filename: path.basename(filePath),
  };
}

function addIndexEntry(index, key, value) {
  if (!key.includes('::')) return;
  if (!index.has(key)) index.set(key, []);
  const entries = index.get(key);
  if (!entries.some((entry) => entry.filePath === value.filePath)) {
    entries.push(value);
  }
}

function buildAudioIndex(mp3Files) {
  const index = new Map();
  const byArtist = new Map();
  const parsedFiles = [];

  for (const filePath of mp3Files) {
    const parsed = parseAudioFilename(filePath);
    if (!parsed) {
      summary.unmatchedFiles.push(`unparseable audio filename: ${relativePath(filePath)}`);
      continue;
    }

    parsedFiles.push(parsed);
    addIndexEntry(index, makeKey(parsed.parsedArtist, parsed.title), parsed);

    const artistKey = normalizeArtistName(parsed.parsedArtist);
    if (!byArtist.has(artistKey)) byArtist.set(artistKey, []);
    byArtist.get(artistKey).push(parsed);
  }

  for (const entries of byArtist.values()) {
    entries.sort(
      (left, right) =>
        left.trackNumber - right.trackNumber || left.filename.localeCompare(right.filename)
    );
  }

  return { index, byArtist, parsedFiles };
}

function buildManifestAudioIndex(manifest) {
  const index = new Map();
  for (const track of manifest.tracks) {
    const key = makeKey(track.parsedArtistName, track.title);
    if (index.has(key)) {
      summary.unmatchedFiles.push(
        `duplicate deterministic mp3 key: ${track.parsedArtistName} - ${track.title} (${relativePath(track.filePath)})`
      );
      continue;
    }
    index.set(key, { ...track, key });
  }
  return index;
}

async function buildTrackMediaIndex() {
  const index = new Map();
  const byArtist = new Map();
  const files = await listFilesRecursive(trackMediaRoot);

  for (const filePath of files) {
    const ext = path.extname(filePath).toLowerCase();
    if (!isImage(filePath) && ext !== '.json') continue;

    const parentName = path.basename(path.dirname(filePath));
    const basename = path.basename(filePath, ext);
    const usingFolderLayout =
      basename.toLowerCase() === 'cover' || basename.toLowerCase() === 'waveform';
    const sourceName = usingFolderLayout ? parentName : basename;
    const parts = sourceName.split(' - ');
    if (parts.length < 2) continue;

    const artistName = parts.shift();
    const title = parts.join(' - ');
    const key = makeKey(artistName, title);
    if (!index.has(key)) index.set(key, { imagePath: null, waveformPath: null });

    const item = index.get(key);
    if (isImage(filePath)) {
      const lower = basename.toLowerCase();
      if (!item.imagePath || lower === 'cover') item.imagePath = filePath;
    } else if (ext === '.json' && basename.toLowerCase() === 'waveform') {
      item.waveformPath = filePath;
      summary.waveformFilesFound += 1;
    }

    if (item.imagePath) {
      const artistKey = normalizeArtistName(artistName);
      if (!byArtist.has(artistKey)) byArtist.set(artistKey, []);
      if (!byArtist.get(artistKey).includes(item)) byArtist.get(artistKey).push(item);
    }
  }

  for (const entries of byArtist.values()) {
    entries.sort((left, right) => {
      const leftName = path.basename(left.imagePath || '');
      const rightName = path.basename(right.imagePath || '');
      return leftName.localeCompare(rightName);
    });
  }

  return { index, byArtist };
}

function findClosest(index, artistName, title) {
  const exact = index.get(makeKey(artistName, title));
  if (exact) return exact[0] || exact;

  return null;
}

function findClosestUnused(index, artistName, title, usedFiles) {
  const exact = index.get(makeKey(artistName, title));
  if (exact) {
    return exact.find((entry) => !usedFiles.has(entry.filePath)) || null;
  }

  return null;
}

function buildArtistImageCandidates(artistName) {
  const names = new Set([artistName]);
  if (normalizeArtistName(artistName) === 'tyler the creator') {
    names.add('Tyler, The Creator');
    names.add('Tyler The Creator');
  }
  return [...names].flatMap((name) =>
    ['.jpg', '.jpeg', '.png', '.webp'].map((ext) => `${name}${ext}`)
  );
}

async function findExistingFile(dirPath, filenames) {
  for (const filename of filenames) {
    const candidate = path.join(dirPath, filename);
    if (await fileExists(candidate)) return candidate;
  }
  return path.join(dirPath, filenames[0]);
}

async function getSchemaColumns(client, tableName) {
  const { rows } = await client.query(
    `
    SELECT column_name, data_type, udt_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = $1
    `,
    [tableName]
  );
  return new Map(rows.map((row) => [row.column_name, row]));
}

async function getSeededArtists(client) {
  const { rows } = await client.query(
    `
    SELECT id, display_name, profile_picture, cover_photo
    FROM users
    WHERE role = 'artist'
      AND email = ANY($1::text[])
    ORDER BY display_name
    `,
    [SEEDED_ARTIST_EMAILS]
  );
  return rows;
}

async function getSeededTracks(client) {
  const { rows } = await client.query(
    `
    SELECT
      track.id,
      track.title,
      track.user_id,
      track.genre_id,
      track.audio_url,
      track.stream_url,
      track.preview_url,
      track.waveform_url,
      track.cover_image,
      track.status,
      track.explicit_content,
      artist.email AS artist_email,
      artist.display_name AS artist_name
    FROM tracks track
    JOIN users artist ON artist.id = track.user_id
    WHERE artist.role = 'artist'
      AND artist.email = ANY($1::text[])
      AND track.deleted_at IS NULL
    ORDER BY artist.display_name, track.title
    `,
    [SEEDED_ARTIST_EMAILS]
  );
  return rows;
}

async function getSeededPlaylists(client) {
  const { rows } = await client.query(
    `
    SELECT playlist.id, playlist.name, playlist.cover_image, owner.display_name AS owner_name
    FROM playlists playlist
    JOIN users owner ON owner.id = playlist.user_id
    WHERE playlist.deleted_at IS NULL
      AND (
        playlist.name = 'Rythmify Mix'
        OR playlist.name LIKE '% - Rythmify Seed'
      )
    ORDER BY playlist.name
    `
  );
  return rows;
}

async function uploadArtistAssets(client, artists) {
  const coverRoot = (await directoryExists(artistCoversRoot))
    ? artistCoversRoot
    : legacyArtistCoversRoot;

  for (const artist of artists) {
    const avatarPath = await findExistingFile(
      artistImagesRoot,
      buildArtistImageCandidates(artist.display_name)
    );
    if (hasAsset(artist.profile_picture)) {
      summary.skippedAlreadyExisting += 1;
    } else if (await fileExists(avatarPath)) {
      try {
        const url = await uploadImageFile(
          avatarPath,
          `avatars/${artist.id}/${path.basename(avatarPath)}`
        );
        await client.query('UPDATE users SET profile_picture = $1 WHERE id = $2', [url, artist.id]);
        summary.artistAvatarsUploaded += 1;
      } catch (err) {
        recordFailure(`artist avatar ${artist.display_name}`, avatarPath, err);
      }
    } else {
      recordMissing(`artist avatar ${artist.display_name}`, avatarPath);
    }

    const coverPath = await findExistingFile(
      coverRoot,
      buildArtistImageCandidates(artist.display_name)
    );
    if (hasAsset(artist.cover_photo)) {
      summary.skippedAlreadyExisting += 1;
    } else if (await fileExists(coverPath)) {
      try {
        const url = await uploadImageFile(
          coverPath,
          `covers/${artist.id}/${path.basename(coverPath)}`
        );
        await client.query('UPDATE users SET cover_photo = $1 WHERE id = $2', [url, artist.id]);
        summary.artistCoversUploaded += 1;
      } catch (err) {
        recordFailure(`artist cover ${artist.display_name}`, coverPath, err);
      }
    } else {
      recordMissing(`artist cover ${artist.display_name}`, coverPath);
    }
  }
}

function takeArtistFallback(byArtist, usedFiles, artistName) {
  const entries = byArtist.get(normalizeArtistName(artistName)) || [];
  const unused = entries.find((entry) => !usedFiles.has(entry.filePath));
  return unused || entries[0] || null;
}

function takeMediaFallback(mediaByArtist, usedImages, artistName) {
  const entries = mediaByArtist.get(normalizeArtistName(artistName)) || [];
  const unused = entries.find((entry) => entry.imagePath && !usedImages.has(entry.imagePath));
  return unused || entries.find((entry) => entry.imagePath) || null;
}

async function findPlaylistCoverForArtist(artistName) {
  const playlistName = makeArtistSeedPlaylistName(artistName);
  const candidates = new Set([playlistName]);
  if (normalizeArtistName(artistName) === 'tyler the creator') {
    candidates.add('Tyler, The Creator - Rythmify Seed');
    candidates.add('Tyler The Creator - Rythmify Seed');
  }

  for (const candidate of candidates) {
    const coverPath = path.join(audioRoot, candidate, 'cover.jpg');
    if (await fileExists(coverPath)) return coverPath;
  }

  return null;
}

function getMappingReport(trackId) {
  let report = summary.mappingReport.find((item) => item.trackId === trackId);
  if (!report) {
    report = {
      trackId,
      dbTitle: null,
      mp3: null,
      cover: null,
      waveform: null,
    };
    summary.mappingReport.push(report);
  }
  return report;
}

async function uploadTrackAudio(client, tracks, audioIndex, audioByArtist) {
  const usedFiles = new Set();

  for (const track of tracks) {
    if (
      hasAsset(track.audio_url) &&
      hasAsset(track.stream_url) &&
      hasAsset(track.waveform_url) &&
      track.status === 'ready'
    ) {
      summary.matchedTracks += 1;
      summary.skippedAlreadyExisting += 1;
      summary.mappingReport.push({
        trackId: track.id,
        dbTitle: track.title,
        mp3: '(preserved existing)',
        cover: null,
        waveform: track.waveform_url,
      });
      continue;
    }

    let audioTrack = findClosestUnused(audioIndex, track.artist_name, track.title, usedFiles);
    if (!audioTrack) {
      audioTrack = takeArtistFallback(audioByArtist, usedFiles, track.artist_name);
    }

    if (!audioTrack) {
      const message = `unmatched DB track: ${track.artist_name} - ${track.title} [key=${makeKey(track.artist_name, track.title)}]`;
      summary.unmatchedDbTracks.push(message);
      console.warn(`WARN ${message}`);
      continue;
    }

    summary.matchedTracks += 1;
    usedFiles.add(audioTrack.filePath);

    try {
      const audioFile = await readUploadFile(audioTrack.filePath);
      const processedTrack = await tracksService.replaceTrackAudioAndProcess({
        trackId: track.id,
        userId: track.user_id,
        audioFile,
        audioKeyPrefix: `tracks/${track.id}`,
      });
      summary.audioUploaded += 1;
      summary.tracksUpdated += 1;
      if (processedTrack.waveform_url) summary.waveformsGenerated += 1;
      Object.assign(getMappingReport(track.id), {
        dbTitle: track.title,
        mp3: relativePath(audioTrack.filePath),
        waveform: processedTrack.waveform_url || null,
      });
    } catch (err) {
      recordFailure(`track audio ${track.artist_name} - ${track.title}`, audioTrack.filePath, err);
    }
  }

  const reportedUnusedFiles = new Set();
  for (const entries of audioIndex.values()) {
    for (const audioTrack of entries) {
      if (usedFiles.has(audioTrack.filePath) || reportedUnusedFiles.has(audioTrack.filePath))
        continue;
      reportedUnusedFiles.add(audioTrack.filePath);
      summary.unmatchedFiles.push(
        `unmatched mp3: ${relativePath(audioTrack.filePath)} [key=${makeKey(audioTrack.parsedArtist, audioTrack.title)}]`
      );
    }
  }
}

async function uploadTrackMedia(client, tracks, mediaIndex, mediaByArtist, audioIndex) {
  const usedImages = new Set();

  for (const track of tracks) {
    if (hasAsset(track.cover_image)) {
      summary.trackImagesPreserved += 1;
      summary.skippedAlreadyExisting += 1;
      Object.assign(getMappingReport(track.id), {
        dbTitle: track.title,
        cover: `(preserved existing)`,
      });
      continue;
    }

    const audioTrack = findClosest(audioIndex, track.artist_name, track.title);
    let media = audioTrack
      ? findClosest(mediaIndex, audioTrack.parsedArtist, audioTrack.title)
      : null;

    if (!media?.imagePath) {
      media = findClosest(mediaIndex, track.artist_name, track.title);
    }

    let imagePath = media?.imagePath;

    if (!imagePath) {
      media = takeMediaFallback(mediaByArtist, usedImages, track.artist_name);
      imagePath = media?.imagePath;
    }

    if (!imagePath) {
      // No track image found in seed-assets/images/tracks/ — do NOT fall back to audio folder covers.
      recordMissing(
        `track image ${track.artist_name} - ${track.title}`,
        path.join(trackMediaRoot, `${track.artist_name} - ${track.title}.jpg`)
      );
    } else {
      try {
        const url = await uploadImageFile(
          imagePath,
          `tracks/${track.id}/cover${path.extname(imagePath).toLowerCase()}`
        );
        await client.query('UPDATE tracks SET cover_image = $1 WHERE id = $2', [url, track.id]);
        usedImages.add(imagePath);
        summary.trackImagesUploaded += 1;
        Object.assign(getMappingReport(track.id), {
          dbTitle: track.title,
          cover: relativePath(imagePath),
        });
      } catch (err) {
        recordFailure(`track image ${track.artist_name} - ${track.title}`, imagePath, err);
      }
    }
  }
}

async function uploadPlaylistCovers(client, playlists) {
  for (const playlist of playlists) {
    if (!playlist.name.endsWith(' - Rythmify Seed')) continue;
    if (hasAsset(playlist.cover_image)) {
      summary.skippedAlreadyExisting += 1;
      continue;
    }

    const folderNameCandidates = new Set([playlist.name]);
    if (playlist.name.startsWith('Tyler The Creator')) {
      folderNameCandidates.add(playlist.name.replace('Tyler The Creator', 'Tyler, The Creator'));
    }

    let coverPath = null;
    for (const folderName of folderNameCandidates) {
      const candidate = path.join(audioRoot, folderName, 'cover.jpg');
      if (await fileExists(candidate)) {
        coverPath = candidate;
        break;
      }
    }

    if (!coverPath) {
      recordMissing(
        `playlist cover ${playlist.name}`,
        path.join(audioRoot, playlist.name, 'cover.jpg')
      );
      continue;
    }

    try {
      const url = await uploadImageFile(
        coverPath,
        `playlists/${playlist.id}/cover${path.extname(coverPath)}`
      );
      await client.query('UPDATE playlists SET cover_image = $1 WHERE id = $2', [url, playlist.id]);
      summary.playlistCoversUploaded += 1;
    } catch (err) {
      recordFailure(`playlist cover ${playlist.name}`, coverPath, err);
    }
  }
}

async function updateAlbumCoversFromTracks(client) {
  const result = await client.query(`
    WITH album_first_track AS (
      SELECT DISTINCT ON (playlist.id)
        playlist.id AS playlist_id,
        track.cover_image
      FROM playlists playlist
      JOIN playlist_tracks playlist_track
        ON playlist_track.playlist_id = playlist.id
      JOIN tracks track
        ON track.id = playlist_track.track_id
       AND track.deleted_at IS NULL
      WHERE playlist.subtype = 'album'
        AND playlist.deleted_at IS NULL
        AND track.cover_image IS NOT NULL
        AND track.cover_image <> 'pending'
      ORDER BY playlist.id, playlist_track.position ASC, playlist_track.added_at ASC
    )
    UPDATE playlists playlist
    SET cover_image = album_first_track.cover_image,
        updated_at = NOW()
    FROM album_first_track
    WHERE playlist.id = album_first_track.playlist_id
      AND (
        playlist.cover_image IS NULL
        OR playlist.cover_image = 'pending'
      )
    RETURNING playlist.id;
  `);

  summary.albumCoversUpdated = result.rowCount;
}

async function updateArtistPlaylistCoversFromTracks(client) {
  const result = await client.query(`
    WITH first_track_cover AS (
      SELECT DISTINCT ON (playlist.id)
        playlist.id AS playlist_id,
        track.cover_image
      FROM playlists playlist
      JOIN users artist
        ON artist.id = playlist.user_id
       AND artist.role = 'artist'
       AND playlist.name = artist.display_name
      JOIN playlist_tracks playlist_track
        ON playlist_track.playlist_id = playlist.id
      JOIN tracks track
        ON track.id = playlist_track.track_id
       AND track.deleted_at IS NULL
      WHERE playlist.subtype = 'playlist'
        AND playlist.deleted_at IS NULL
        AND track.cover_image IS NOT NULL
        AND track.cover_image <> 'pending'
      ORDER BY playlist.id, playlist_track.position ASC, track.created_at ASC
    )
    UPDATE playlists playlist
    SET cover_image = first_track_cover.cover_image,
        updated_at = NOW()
    FROM first_track_cover
    WHERE playlist.id = first_track_cover.playlist_id
      AND (
        playlist.cover_image IS NULL
        OR playlist.cover_image = 'pending'
      )
    RETURNING playlist.id;
  `);

  summary.artistPlaylistCoversUpdated = result.rowCount;
}

async function reseedListeningHistory(client) {
  await client.query(`
    DELETE FROM listening_history
    WHERE user_id IN (
      SELECT id
      FROM users
      WHERE role = 'listener'
        AND email LIKE '%@example.com'
    );
  `);

  const result = await client.query(
    `
    WITH seeded_listeners AS (
      SELECT id
      FROM users
      WHERE role = 'listener'
        AND email LIKE '%@example.com'
    ),
    seeded_tracks AS (
      SELECT track.id, track.duration
      FROM tracks track
      JOIN users artist
        ON artist.id = track.user_id
      WHERE artist.email = ANY($1::text[])
        AND artist.role = 'artist'
        AND track.deleted_at IS NULL
        AND track.duration >= 30
    ),
    listener_targets AS (
      SELECT
        id AS user_id,
        25 + FLOOR(RANDOM() * 16)::integer AS history_count
      FROM seeded_listeners
    ),
    listener_slots AS (
      SELECT
        target.user_id,
        slot.slot_number
      FROM listener_targets target
      CROSS JOIN LATERAL generate_series(1, target.history_count) AS slot(slot_number)
    ),
    randomized_history AS (
      SELECT
        slot.user_id,
        picked_track.id AS track_id,
        30 + FLOOR(RANDOM() * GREATEST(picked_track.duration - 29, 1))::integer AS duration_played,
        NOW()
          - (FLOOR(RANDOM() * 90) * INTERVAL '1 day')
          - (FLOOR(RANDOM() * 24) * INTERVAL '1 hour')
          - (FLOOR(RANDOM() * 60) * INTERVAL '1 minute') AS played_at
      FROM listener_slots slot
      CROSS JOIN LATERAL (
        SELECT track.id, track.duration
        FROM seeded_tracks track
        ORDER BY RANDOM() + slot.slot_number * 0
        LIMIT 1
      ) picked_track
    )
    INSERT INTO listening_history (
      user_id, track_id, duration_played, played_at, deleted_at
    )
    SELECT
      user_id,
      track_id,
      LEAST(duration_played, (
        SELECT duration
        FROM seeded_tracks
        WHERE seeded_tracks.id = randomized_history.track_id
      )),
      played_at,
      NULL
    FROM randomized_history
    ON CONFLICT DO NOTHING
    RETURNING id;
    `,
    [SEEDED_ARTIST_EMAILS]
  );

  summary.listeningHistoryInserted = result.rowCount;
}

function blobNameFromUrl(fileUrl) {
  if (!fileUrl || fileUrl === 'pending') return null;

  try {
    const parsed = storageService.parseAzureBlobUrl(fileUrl);
    const audioContainer = process.env.BLOB_CONTAINER_AUDIO || 'audio';
    return parsed.containerName === audioContainer ? parsed.blobName : null;
  } catch {
    return null;
  }
}

async function deleteAudioBlobIfExists(blobName, deletedBlobNames) {
  if (!blobName || deletedBlobNames.has(blobName)) return;

  const deleted = await storageService.deleteObject(blobName, null, 'audio');
  if (deleted) {
    deletedBlobNames.add(blobName);
    summary.audioBlobsDeleted += 1;
  }
}

async function cleanupSeedAudioBlobs(client, tracks) {
  const deletedBlobNames = new Set();
  const seededUserIds = new Set(tracks.map((track) => String(track.user_id)));
  const seededTrackIds = new Set(tracks.map((track) => String(track.id)));

  for (const track of tracks) {
    await deleteAudioBlobIfExists(blobNameFromUrl(track.audio_url), deletedBlobNames);
    await deleteAudioBlobIfExists(blobNameFromUrl(track.stream_url), deletedBlobNames);
    await deleteAudioBlobIfExists(blobNameFromUrl(track.preview_url), deletedBlobNames);
  }

  const audioContainer = storageService.getContainerClient('audio');
  for await (const blob of audioContainer.listBlobsFlat()) {
    const isDirectSeedMp3 =
      !blob.name.includes('/') && path.extname(blob.name).toLowerCase() === '.mp3';
    const isSeedUserTrackBlob = [...seededUserIds].some((userId) =>
      blob.name.startsWith(`tracks/${userId}/`)
    );

    if (isDirectSeedMp3 || isSeedUserTrackBlob) {
      await deleteAudioBlobIfExists(blob.name, deletedBlobNames);
    }
  }

  const mediaContainer = storageService.getContainerClient('media');
  for await (const blob of mediaContainer.listBlobsFlat()) {
    if (!blob.name.endsWith('/waveform.json')) continue;

    const isCanonicalSeedWaveform = [...seededTrackIds].some(
      (trackId) => blob.name === `tracks/${trackId}/waveform.json`
    );
    const isLegacySeedWaveform = [...seededTrackIds].some((trackId) =>
      blob.name.endsWith(`/${trackId}/waveform.json`)
    );

    if (isCanonicalSeedWaveform || isLegacySeedWaveform) {
      const deleted = await storageService.deleteObject(blob.name, null, 'media');
      if (deleted) summary.waveformBlobsDeleted += 1;
    }
  }

  await client.query(
    `
    UPDATE tracks track
    SET
      audio_url = 'pending',
      stream_url = 'pending',
      preview_url = NULL,
      waveform_url = NULL,
      duration = NULL,
      bitrate = NULL,
      status = 'processing',
      updated_at = NOW()
    FROM users artist
    WHERE artist.id = track.user_id
      AND artist.email = ANY($1::text[])
      AND track.deleted_at IS NULL
    `,
    [SEEDED_ARTIST_EMAILS]
  );
}

async function validateDatabase(client) {
  const { rows } = await client.query(
    `
    SELECT
      (SELECT COUNT(*)::int FROM tracks track JOIN users artist ON artist.id = track.user_id WHERE artist.email = ANY($1::text[]) AND track.deleted_at IS NULL) AS total_tracks,
      (SELECT COUNT(*)::int FROM tracks track JOIN users artist ON artist.id = track.user_id WHERE artist.email = ANY($1::text[]) AND track.deleted_at IS NULL AND (track.audio_url IS NULL OR track.audio_url = 'pending')) AS pending_audio,
      (SELECT COUNT(*)::int FROM tracks track JOIN users artist ON artist.id = track.user_id WHERE artist.email = ANY($1::text[]) AND track.deleted_at IS NULL AND (track.stream_url IS NULL OR track.stream_url = 'pending')) AS pending_streams,
      (SELECT COUNT(*)::int FROM tracks track JOIN users artist ON artist.id = track.user_id WHERE artist.email = ANY($1::text[]) AND track.deleted_at IS NULL AND (track.cover_image IS NULL OR track.cover_image = 'pending')) AS pending_images,
      (SELECT COUNT(*)::int FROM tracks WHERE deleted_at IS NULL AND audio_url IS NULL) AS all_tracks_missing_audio_url,
      (SELECT COUNT(*)::int FROM tracks WHERE deleted_at IS NULL AND waveform_url IS NULL) AS all_tracks_missing_waveform_url,
      (SELECT COUNT(*)::int FROM tracks WHERE deleted_at IS NULL AND cover_image IS NULL) AS all_tracks_missing_cover_image,
      (SELECT COUNT(*)::int FROM tracks track JOIN users artist ON artist.id = track.user_id WHERE artist.email = ANY($1::text[]) AND track.deleted_at IS NULL AND track.waveform_url IS NOT NULL AND track.waveform_url <> 'pending') AS waveform_tracks,
      (SELECT COUNT(*)::int FROM tracks track JOIN users artist ON artist.id = track.user_id WHERE artist.email = ANY($1::text[]) AND track.deleted_at IS NULL AND track.status = 'ready') AS ready_tracks,
      (SELECT COUNT(*)::int FROM listening_history history JOIN users listener ON listener.id = history.user_id WHERE listener.role = 'listener' AND listener.email LIKE '%@example.com') AS listening_history_rows,
      (SELECT COUNT(*)::int FROM listening_history history JOIN tracks track ON track.id = history.track_id WHERE history.duration_played > track.duration) AS invalid_history_duration,
      (SELECT COUNT(*)::int FROM playlists WHERE subtype = 'album' AND deleted_at IS NULL AND (cover_image IS NULL OR cover_image = 'pending')) AS pending_album_covers,
      (SELECT COUNT(*)::int FROM playlists playlist JOIN users artist ON artist.id = playlist.user_id AND artist.role = 'artist' AND playlist.name = artist.display_name WHERE playlist.subtype = 'playlist' AND playlist.deleted_at IS NULL AND (playlist.cover_image IS NULL OR playlist.cover_image = 'pending')) AS pending_artist_playlist_covers,
      (SELECT COUNT(*)::int FROM (
        SELECT track.user_id, LOWER(track.title) AS title
        FROM tracks track
        JOIN users artist ON artist.id = track.user_id
        WHERE artist.email = ANY($1::text[])
          AND track.deleted_at IS NULL
        GROUP BY track.user_id, LOWER(track.title)
        HAVING COUNT(*) > 1
      ) dupes) AS duplicate_tracks,
      (SELECT COUNT(*)::int FROM playlist_tracks pt LEFT JOIN playlists p ON p.id = pt.playlist_id WHERE p.id IS NULL) AS orphan_playlist_tracks,
      (SELECT COUNT(*)::int FROM track_likes tl LEFT JOIN tracks t ON t.id = tl.track_id WHERE t.id IS NULL) AS orphan_track_likes,
      (SELECT COUNT(*)::int FROM comments c LEFT JOIN tracks t ON t.id = c.track_id WHERE t.id IS NULL) AS orphan_comments,
      (SELECT COUNT(*)::int FROM tracks track JOIN users artist ON artist.id = track.user_id WHERE artist.email = ANY($1::text[]) AND track.deleted_at IS NULL AND track.cover_image IS NOT NULL AND track.cover_image <> 'pending' AND (track.cover_image LIKE '%/audio/%' OR track.cover_image ~ '/audio/[^/]+ - Rythmify Seed/cover\.jpg$')) AS audio_path_cover_images
  `,
    [SEEDED_ARTIST_EMAILS]
  );

  return rows[0];
}

function requireEnv(name) {
  if (!process.env[name]) throw new Error(`${name} is required`);
  return process.env[name];
}

async function main() {
  requireEnv('DATABASE_URL');
  requireEnv('AZURE_STORAGE_CONNECTION_STRING');
  if (
    process.argv.includes('--reset-seed-audio') &&
    process.env.ALLOW_DESTRUCTIVE_DEPLOYED_RESEED !== 'true'
  ) {
    throw new Error(
      '--reset-seed-audio requires ALLOW_DESTRUCTIVE_DEPLOYED_RESEED=true for deployed reseed'
    );
  }
  if ((process.env.BLOB_CONTAINER_AUDIO || 'audio') !== 'audio') {
    throw new Error('BLOB_CONTAINER_AUDIO must be audio for production-safe seed');
  }
  if ((process.env.BLOB_CONTAINER_MEDIA || 'media') !== 'media') {
    throw new Error('BLOB_CONTAINER_MEDIA must be media for production-safe seed');
  }
  const resetSeedAudio = process.argv.includes('--reset-seed-audio');

  await storageService.initBlobContainers();

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  try {
    const trackColumns = await getSchemaColumns(client, 'tracks');
    const artists = await getSeededArtists(client);
    const tracks = await getSeededTracks(client);
    const playlists = await getSeededPlaylists(client);
    const manifest = buildAudioManifest(seedAssetsRoot);
    const manifestIndex = buildManifestAudioIndex(manifest);
    const mp3Files = (await listFilesRecursive(audioRoot)).filter(
      (filePath) => path.extname(filePath).toLowerCase() === '.mp3'
    );
    const { index: audioIndex, byArtist: audioByArtist } = buildAudioIndex(mp3Files);
    const { index: mediaIndex, byArtist: mediaByArtist } = await buildTrackMediaIndex();

    summary.totalMp3Files = mp3Files.length;
    summary.totalTracksInDb = tracks.length;

    if (resetSeedAudio) {
      console.log('Resetting seeded audio blobs before upload...');
      await cleanupSeedAudioBlobs(client, tracks);
    }

    await uploadArtistAssets(client, artists);
    await uploadTrackAudio(client, tracks, audioIndex, audioByArtist);
    await uploadTrackMedia(client, tracks, mediaIndex, mediaByArtist, audioIndex);
    await updateAlbumCoversFromTracks(client);
    await updateArtistPlaylistCoversFromTracks(client);
    await uploadPlaylistCovers(client, playlists);
    // Production-safe asset seeding must not delete or reseed user activity/history.

    const validation = await validateDatabase(client);
    const waveformRequired =
      trackColumns.has('waveform_url') ||
      trackColumns.has('waveform') ||
      trackColumns.has('waveform_data');

    console.log('\nSeed asset upload summary');
    console.log(`asset root: ${seedAssetsRoot}`);
    console.log(`reset seed audio: ${resetSeedAudio ? 'yes' : 'no'}`);
    console.log(`manifest tracks: ${manifest.tracks.length}`);
    console.log(`duplicate mp3 files ignored: ${manifest.duplicates.length}`);
    console.log(`skipped mp3 files: ${manifest.skipped.length}`);
    for (const item of manifest.skipped) {
      console.log(`  - ${item.reason}: ${relativePath(item.filePath)}`);
    }
    console.log(`audio blobs deleted: ${summary.audioBlobsDeleted}`);
    console.log(`waveform blobs deleted: ${summary.waveformBlobsDeleted}`);
    console.log(`total local mp3 files: ${summary.totalMp3Files}`);
    console.log(`total tracks in DB: ${summary.totalTracksInDb}`);
    console.log(`matched DB tracks: ${summary.matchedTracks}`);
    console.log(`audio uploaded via backend track upload pipeline: ${summary.audioUploaded}`);
    console.log(`tracks updated: ${summary.tracksUpdated}`);
    console.log(`track images uploaded: ${summary.trackImagesUploaded}`);
    console.log(`track images preserved (no new file found): ${summary.trackImagesPreserved}`);
    console.log(
      `track images uploaded or preserved: ${summary.trackImagesUploaded + summary.trackImagesPreserved}`
    );
    console.log(`playlist covers uploaded: ${summary.playlistCoversUploaded}`);
    console.log(`album covers updated: ${summary.albumCoversUpdated}`);
    console.log(`artist playlist covers updated: ${summary.artistPlaylistCoversUpdated}`);
    console.log(`artist avatars uploaded: ${summary.artistAvatarsUploaded}`);
    console.log(`artist covers uploaded: ${summary.artistCoversUploaded}`);
    console.log(`listening history inserted: ${summary.listeningHistoryInserted}`);
    console.log(`waveform files found: ${summary.waveformFilesFound}`);
    console.log(`waveforms generated by backend pipeline: ${summary.waveformsGenerated}`);
    console.log(`skipped already existing: ${summary.skippedAlreadyExisting}`);
    console.log(`pending track audio_url rows: ${validation.pending_audio}`);
    console.log(`pending track stream_url rows: ${validation.pending_streams}`);
    console.log(`pending track cover_image rows: ${validation.pending_images}`);
    console.log(`all tracks missing audio_url: ${validation.all_tracks_missing_audio_url}`);
    console.log(`all tracks missing waveform_url: ${validation.all_tracks_missing_waveform_url}`);
    console.log(`all tracks missing cover_image: ${validation.all_tracks_missing_cover_image}`);
    console.log(`tracks with waveform data: ${validation.waveform_tracks}`);
    console.log(`ready tracks: ${validation.ready_tracks}`);
    console.log(`listening history rows: ${validation.listening_history_rows}`);
    console.log(`invalid listening history duration rows: ${validation.invalid_history_duration}`);
    console.log(`pending album covers: ${validation.pending_album_covers}`);
    console.log(`pending artist playlist covers: ${validation.pending_artist_playlist_covers}`);
    console.log(`duplicate seeded tracks: ${validation.duplicate_tracks}`);
    console.log(`orphan playlist_tracks: ${validation.orphan_playlist_tracks}`);
    console.log(`orphan track_likes: ${validation.orphan_track_likes}`);
    console.log(`orphan comments: ${validation.orphan_comments}`);
    console.log(
      `track covers pointing to audio folder (must be 0): ${validation.audio_path_cover_images}`
    );
    console.log(`unmatched files: ${summary.unmatchedFiles.length}`);
    for (const item of summary.unmatchedFiles) console.log(`  - ${item}`);
    console.log(`missing assets: ${summary.missingAssets.length}`);
    for (const item of summary.missingAssets) console.log(`  - ${item}`);
    console.log(`failed uploads: ${summary.failedUploads.length}`);
    for (const item of summary.failedUploads) console.log(`  - ${item}`);
    console.log(`unmatched DB tracks: ${summary.unmatchedDbTracks.length}`);
    for (const item of summary.unmatchedDbTracks) console.log(`  - ${item}`);
    console.log('mapping report:');
    for (const item of summary.mappingReport) {
      console.log(
        `  - ${item.dbTitle} -> ${item.mp3 || 'missing mp3'} -> ${item.cover || 'missing cover'} -> ${
          item.waveform || 'missing waveform'
        }`
      );
    }

    if (
      summary.failedUploads.length > 0 ||
      summary.unmatchedDbTracks.length > 0 ||
      summary.matchedTracks !== summary.totalTracksInDb ||
      summary.trackImagesUploaded + summary.trackImagesPreserved !== summary.totalTracksInDb ||
      Number(validation.all_tracks_missing_audio_url) !== 0 ||
      Number(validation.all_tracks_missing_waveform_url) !== 0 ||
      Number(validation.all_tracks_missing_cover_image) !== 0 ||
      Number(validation.audio_path_cover_images) !== 0 ||
      Number(validation.pending_streams) !== 0 ||
      Number(validation.pending_audio) !== 0 ||
      Number(validation.pending_images) !== 0 ||
      Number(validation.pending_album_covers) !== 0 ||
      Number(validation.pending_artist_playlist_covers) !== 0 ||
      Number(validation.invalid_history_duration) !== 0 ||
      Number(validation.ready_tracks) !== summary.totalTracksInDb ||
      Number(validation.duplicate_tracks) !== 0 ||
      Number(validation.orphan_playlist_tracks) !== 0 ||
      Number(validation.orphan_track_likes) !== 0 ||
      Number(validation.orphan_comments) !== 0 ||
      (waveformRequired && Number(validation.waveform_tracks) !== summary.totalTracksInDb)
    ) {
      process.exitCode = 1;
    }
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(`Seed asset upload failed: ${err.message}`);
  process.exit(1);
});
