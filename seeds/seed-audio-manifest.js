'use strict';

const fs = require('fs');
const path = require('path');

const ARTIST_CONFIG = {
  'tame impala': {
    email: 'tameimpala@rythmify.com',
    displayName: 'Tame Impala',
    genre: 'Psychedelic Rock',
  },
  radiohead: {
    email: 'radiohead@rythmify.com',
    displayName: 'Radiohead',
    genre: 'Alternative Rock',
  },
  'arctic monkeys': {
    email: 'arcticmonkeys@rythmify.com',
    displayName: 'Arctic Monkeys',
    genre: 'Indie Rock',
  },
  'marwan pablo': {
    email: 'marwanpablo@rythmify.com',
    displayName: 'Marwan Pablo',
    genre: 'Arabic Trap',
  },
  'dominic fike': {
    email: 'dominicfike@rythmify.com',
    displayName: 'Dominic Fike',
    genre: 'Indie Pop',
  },
  'glass animals': {
    email: 'glassanimals@rythmify.com',
    displayName: 'Glass Animals',
    genre: 'Indie Pop',
  },
  tul8te: {
    email: 'tul8te@rythmify.com',
    displayName: 'TUL8TE',
    genre: 'Arabic Pop',
  },
  'amr diab': {
    email: 'amrdiab@rythmify.com',
    displayName: 'Amr Diab',
    genre: 'Arabic Pop',
  },
  elissa: {
    email: 'elissa@rythmify.com',
    displayName: 'Elissa',
    genre: 'Arabic Pop',
  },
  adele: {
    email: 'adele@rythmify.com',
    displayName: 'Adele',
    genre: 'Pop',
  },
  cairokee: {
    email: 'cairokee@rythmify.com',
    displayName: 'Cairokee',
    genre: 'Arabic Rock',
  },
  'the weeknd': {
    email: 'theweeknd@rythmify.com',
    displayName: 'The Weeknd',
    genre: 'R&B',
  },
  drake: {
    email: 'drake@rythmify.com',
    displayName: 'Drake',
    genre: 'Hip-Hop',
  },
  'kendrick lamar': {
    email: 'kendricklamar@rythmify.com',
    displayName: 'Kendrick Lamar',
    genre: 'Hip-Hop',
  },
  'frank ocean': {
    email: 'frankocean@rythmify.com',
    displayName: 'Frank Ocean',
    genre: 'R&B',
  },
  'tyler the creator': {
    email: 'tylerthecreator@rythmify.com',
    displayName: 'Tyler The Creator',
    genre: 'Hip-Hop',
  },
  'billie eilish': {
    email: 'billieeilish@rythmify.com',
    displayName: 'Billie Eilish',
    genre: 'Indie Pop',
  },
  'daft punk': {
    email: 'daftpunk@rythmify.com',
    displayName: 'Daft Punk',
    genre: 'Electronic',
  },
  gorillaz: {
    email: 'gorillaz@rythmify.com',
    displayName: 'Gorillaz',
    genre: 'Indie Rock',
  },
};

const ARTIST_EMAILS = [...new Set(Object.values(ARTIST_CONFIG).map((artist) => artist.email))];

function normalize(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/&/g, ' and ')
    .replace(/tyler,\s*the creator/g, 'tyler the creator')
    .replace(/['\u2019`]/g, '')
    .replace(/[^a-z0-9\u0600-\u06ff]+/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeTitle(value) {
  return normalize(value);
}

function stripSeedSuffix(folderName) {
  return folderName.replace(/\s+-\s+Rythmify Seed$/i, '');
}

function getArtistConfig(name) {
  return ARTIST_CONFIG[normalize(name)] || null;
}

function parseAudioFilename(filePath) {
  const basename = path.basename(filePath, path.extname(filePath));
  const parts = basename
    .split(/\s+-\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length < 3 || !/^\d+$/.test(parts[0])) return null;

  return {
    trackNumber: Number(parts[0]),
    parsedArtistName: parts[1],
    title: parts.slice(2).join(' - ').replace(/_/g, ' ').trim(),
    filename: path.basename(filePath),
  };
}

function walkMp3Files(dir) {
  if (!fs.existsSync(dir)) return [];

  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkMp3Files(fullPath));
    } else if (entry.isFile() && path.extname(entry.name).toLowerCase() === '.mp3') {
      files.push(fullPath);
    }
  }
  return files;
}

function resolveSeedAssetsRoot() {
  const backendRoot = path.resolve(__dirname, '..');
  const projectRoot = path.resolve(backendRoot, '..');
  const candidates = [
    path.join(backendRoot, 'seed-assets'),
    path.join(backendRoot, 'seeds', 'seed-assets'),
    path.join(projectRoot, 'seed-assets'),
  ];

  return (
    candidates.find(
      (candidate) =>
        fs.existsSync(path.join(candidate, 'audio')) ||
        fs.existsSync(path.join(candidate, 'images'))
    ) || candidates[0]
  );
}

function buildAudioManifest(seedAssetsRoot = resolveSeedAssetsRoot()) {
  const audioRoot = path.join(seedAssetsRoot, 'audio');
  const allFiles = walkMp3Files(audioRoot).sort((left, right) => left.localeCompare(right));
  const canonicalByKey = new Map();
  const duplicates = [];
  const skipped = [];

  for (const filePath of allFiles) {
    const parsed = parseAudioFilename(filePath);
    if (!parsed) {
      skipped.push({ filePath, reason: 'unparseable filename' });
      continue;
    }

    const folderName = path.basename(path.dirname(filePath));
    const folderArtistName = stripSeedSuffix(folderName);
    const folderArtist = getArtistConfig(folderArtistName);
    const parsedArtist = getArtistConfig(parsed.parsedArtistName);
    const ownerArtist = parsedArtist || folderArtist;

    if (!ownerArtist) {
      skipped.push({ filePath, reason: `unmapped artist ${parsed.parsedArtistName}` });
      continue;
    }

    const key = `${ownerArtist.email}::${normalizeTitle(parsed.title)}`;
    const entry = {
      key,
      ownerEmail: ownerArtist.email,
      ownerArtistName: ownerArtist.displayName,
      parsedArtistName: parsed.parsedArtistName,
      title: parsed.title,
      genreName: ownerArtist.genre,
      trackNumber: parsed.trackNumber,
      filePath,
      audioRoot,
      seedAssetsRoot,
      folderName,
      filename: parsed.filename,
      isMixDuplicate: folderName === 'rythmify',
    };

    const existing = canonicalByKey.get(key);
    if (!existing) {
      canonicalByKey.set(key, entry);
      continue;
    }

    if (existing.isMixDuplicate && !entry.isMixDuplicate) {
      duplicates.push(existing);
      canonicalByKey.set(key, entry);
    } else {
      duplicates.push(entry);
    }
  }

  const tracks = [...canonicalByKey.values()].sort(
    (left, right) =>
      left.ownerArtistName.localeCompare(right.ownerArtistName) ||
      left.trackNumber - right.trackNumber ||
      left.title.localeCompare(right.title)
  );

  return {
    seedAssetsRoot,
    audioRoot,
    totalMp3Files: allFiles.length,
    tracks,
    duplicates,
    skipped,
  };
}

module.exports = {
  ARTIST_CONFIG,
  ARTIST_EMAILS,
  buildAudioManifest,
  getArtistConfig,
  normalize,
  normalizeTitle,
};
