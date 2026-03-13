'use strict';

let dbm;
let type;
let seed;

exports.setup = function(options, seedLink) {
  dbm = options.dbmigrate;
  type = dbm.dataType;
  seed = seedLink;
};

exports.up = async function(db) {
  // Extensions 
  await db.runSql(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`);
  await db.runSql(`CREATE EXTENSION IF NOT EXISTS "citext";`);
  await db.runSql(`CREATE EXTENSION IF NOT EXISTS "pgcrypto";`);

  // ENUMs 
  await db.runSql(`
    CREATE TYPE "user_role" AS ENUM (
      'artist', 'listener', 'admin'
    );
  `);

  await db.runSql(`
    CREATE TYPE "track_status" AS ENUM (
      'processing', 'ready', 'failed'
    );
  `);

  await db.runSql(`
    CREATE TYPE "activity_type" AS ENUM (
      'like', 'repost', 'follow', 'upload', 'comment'
    );
  `);

  await db.runSql(`
    CREATE TYPE "notification_type" AS ENUM (
      'like', 'comment', 'follow', 'repost',
      'new_message', 'recommended_content', 'new_post_by_followed'
    );
  `);

  await db.runSql(`
    CREATE TYPE "reference_type" AS ENUM (
      'track', 'playlist', 'album', 'comment', 'user'
    );
  `);

  await db.runSql(`
    CREATE TYPE "report_status" AS ENUM (
      'pending', 'resolved', 'dismissed'
    );
  `);

  await db.runSql(`
    CREATE TYPE "report_resource_type" AS ENUM (
      'track', 'user'
    );
  `);

  await db.runSql(`
    CREATE TYPE "subscription_plan" AS ENUM (
      'free', 'premium'
    );
  `);

  await db.runSql(`
    CREATE TYPE "subscription_status" AS ENUM (
      'pending', 'active', 'expired', 'canceled'
    );
  `);

  await db.runSql(`
    CREATE TYPE "payment_status" AS ENUM (
      'pending', 'paid', 'failed'
    );
  `);

  await db.runSql(`
    CREATE TYPE "payment_method" AS ENUM (
      'mock'
    );
  `);

  await db.runSql(`
    CREATE TYPE "search_type" AS ENUM (
      'track', 'user', 'playlist', 'album'
    );
  `);

  await db.runSql(`
    CREATE TYPE "gender_type" AS ENUM (
      'male', 'female'
    );
  `);

  await db.runSql(`
    CREATE TYPE "playlist_type" AS ENUM (
      'regular', 'liked_songs', 'auto_generated'
    );
  `);

  await db.runSql(`
    CREATE TYPE "audio_quality" AS ENUM (
      'low', 'normal', 'high'
    );
  `);

  await db.runSql(`
    CREATE TYPE "embed_type" AS ENUM (
      'track', 'playlist'
    );
  `);

  await db.runSql(`
    CREATE TYPE "verification_token_type" AS ENUM (
      'verify_email', 'reset_password', 'change_email'
    );
  `);

  await db.runSql(`
    CREATE TYPE "geo_restriction_type" AS ENUM (
      'worldwide', 'exclusive_regions', 'blocked_regions'
    );
  `);

  await db.runSql(`
    CREATE TYPE "license_type" AS ENUM (
      'all_rights_reserved', 'creative_commons'
    );
  `);

  await db.runSql(`
    CREATE TYPE "oauth_provider" AS ENUM (
      'google', 'facebook', 'apple', 'soundcloud'
    );
  `);

  await db.runSql(`
    CREATE TYPE "messages_from_type" AS ENUM (
      'everyone', 'followers_only'
    );
  `);

  await db.runSql(`
    CREATE TYPE "web_profile_platform" AS ENUM (
      'instagram', 'twitter', 'youtube', 'tiktok',
      'soundcloud', 'website', 'other'
    );
  `);
};

exports.down = async function(db) {
  const types = [
    'web_profile_platform', 'messages_from_type', 'oauth_provider',
    'license_type', 'geo_restriction_type', 'verification_token_type',
    'embed_type', 'audio_quality', 'playlist_type', 'gender_type',
    'search_type', 'payment_method', 'payment_status', 'subscription_status',
    'subscription_plan', 'report_resource_type', 'report_status',
    'reference_type', 'notification_type', 'activity_type',
    'track_status', 'user_role',
  ];

  for (const t of types) {
    await db.runSql(`DROP TYPE IF EXISTS "${t}" CASCADE;`);
  }
};

exports._meta = {
  "version": 1
};