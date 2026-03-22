// ============================================================
// config/env.js — Single source of truth for all env variables
// All process.env access MUST go through this file only
// ============================================================
require('dotenv').config();

module.exports = {
  PORT: process.env.PORT || 8080,
  NODE_ENV: process.env.NODE_ENV || 'development',

  GMAIL_USER: process.env.GMAIL_USER,
  GMAIL_APP_PASSWORD: process.env.GMAIL_APP_PASSWORD,
  EMAIL_FROM: process.env.EMAIL_FROM,

  DATABASE_URL: process.env.DATABASE_URL,

  RECAPTCHA_SECRET: process.env.RECAPTCHA_SECRET,
  JWT_SECRET: process.env.JWT_SECRET,
  JWT_ACCESS_EXPIRES_IN: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
  JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN || '7d',

  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
  GOOGLE_CALLBACK_URL: process.env.GOOGLE_CALLBACK_URL,

  AZURE_STORAGE_CONNECTION_STRING: process.env.AZURE_STORAGE_CONNECTION_STRING,
  BLOB_CONTAINER_AUDIO: process.env.BLOB_CONTAINER_AUDIO || 'audio',
  BLOB_CONTAINER_MEDIA: process.env.BLOB_CONTAINER_MEDIA || 'media',

  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
  STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,

  BASE_URL: process.env.BASE_URL || 'http://localhost:8080',
  CLIENT_URL: process.env.CLIENT_URL || 'http://localhost:3000',
  APP_URL: process.env.APP_URL || 'http://localhost:5173',

  MAX_FILE_SIZE_AUDIO: 100 * 1024 * 1024, // 100 MB
  MAX_FILE_SIZE_IMAGE: 5 * 1024 * 1024, // 5 MB
};
