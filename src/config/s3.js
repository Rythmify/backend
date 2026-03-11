// ============================================================
// config/s3.js — AWS S3 / Cloudinary client setup
// Audio and images stored externally; only URLs kept in PostgreSQL
// ============================================================
const { v2: cloudinary } = require('cloudinary');
const env = require('./env');

cloudinary.config({
  cloud_name: env.CLOUDINARY_CLOUD_NAME,
  api_key: env.CLOUDINARY_API_KEY,
  api_secret: env.CLOUDINARY_API_SECRET,
});

module.exports = cloudinary;
