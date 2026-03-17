// ============================================================
// middleware/multer.js — File upload config
// Audio: 100 MB (MP3, WAV, FLAC, AAC) | Images: 5 MB (JPG, PNG, WEBP)
// ============================================================
const multer = require('multer');
const path = require('path');
const env = require('../config/env');

const storage = multer.memoryStorage();

const audioTypes = [
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/x-wav',
  'audio/wave',
  'audio/vnd.wave',
  'audio/flac',
  'audio/x-flac',
  'audio/aac',
  'audio/mp4'
];
const imageTypes = ['image/jpeg', 'image/png', 'image/webp'];

const audioExts = ['.mp3', '.wav', '.flac', '.aac', '.m4a'];
const imageExts = ['.jpg', '.jpeg', '.png', '.webp'];

const isAllowedAudio = (file) => {
  const ext = path.extname(file.originalname).toLowerCase();
  return audioTypes.includes(file.mimetype) ||
    (file.mimetype === 'application/octet-stream' && audioExts.includes(ext));
};

const isAllowedImage = (file) => {
  const ext = path.extname(file.originalname).toLowerCase();
  return imageTypes.includes(file.mimetype) ||
    (file.mimetype === 'application/octet-stream' && imageExts.includes(ext));
};

const audioFilter = (req, file, cb) => {
  isAllowedAudio(file)
    ? cb(null, true)
    : cb(new Error('Invalid audio format'), false);
};

const imageFilter = (req, file, cb) => {
  isAllowedImage(file)
    ? cb(null, true)
    : cb(new Error('Invalid image format'), false);
};

const trackFilesFilter = (req, file, cb) => {
  if (file.fieldname === 'audio_file') {
    return isAllowedAudio(file)
      ? cb(null, true)
      : cb(new Error('Invalid audio format'), false);
  }

  if (file.fieldname === 'cover_image') {
    return isAllowedImage(file)
      ? cb(null, true)
      : cb(new Error('Invalid image format'), false);
  }

  return cb(new Error('Unexpected file field'), false);
};

const uploadAudio = multer({
  storage,
  fileFilter: audioFilter,
  limits: { fileSize: env.MAX_FILE_SIZE_AUDIO },
});

const uploadImage = multer({
  storage,
  fileFilter: imageFilter,
  limits: { fileSize: env.MAX_FILE_SIZE_IMAGE },
});

const uploadTrackFiles = multer({
  storage,
  fileFilter: trackFilesFilter,
  limits: { fileSize: env.MAX_FILE_SIZE_AUDIO },
});

module.exports = { uploadAudio, uploadImage, uploadTrackFiles };