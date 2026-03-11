// ============================================================
// middleware/multer.js — File upload config
// Audio: 100 MB (MP3, WAV, FLAC, AAC) | Images: 5 MB (JPG, PNG, WEBP)
// ============================================================
const multer = require('multer');
const env = require('../config/env');

const storage = multer.memoryStorage();

const audioFilter = (req, file, cb) => {
  const allowed = ['audio/mpeg', 'audio/wav', 'audio/flac', 'audio/aac', 'audio/x-flac'];
  allowed.includes(file.mimetype) ? cb(null, true) : cb(new Error('Invalid audio format'), false);
};

const imageFilter = (req, file, cb) => {
  const allowed = ['image/jpeg', 'image/png', 'image/webp'];
  allowed.includes(file.mimetype) ? cb(null, true) : cb(new Error('Invalid image format'), false);
};

const uploadAudio = multer({ storage, fileFilter: audioFilter, limits: { fileSize: env.MAX_FILE_SIZE_AUDIO } });
const uploadImage = multer({ storage, fileFilter: imageFilter, limits: { fileSize: env.MAX_FILE_SIZE_IMAGE } });

module.exports = { uploadAudio, uploadImage };
