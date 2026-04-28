'use strict';

exports.setup = function () {};

exports.up = async function (db) {
  // Wipe all seed data in FK dependency order.
  // down() is intentionally a no-op — deletion is permanent.

  await db.runSql(`
    BEGIN;

    -- 1. Engagement data
    DELETE FROM listening_history;
    DELETE FROM player_state;
    DELETE FROM activities;
    DELETE FROM notifications;
    DELETE FROM push_tokens;
    DELETE FROM comment_likes;
    DELETE FROM comments;
    DELETE FROM track_likes;
    DELETE FROM track_reposts;
    DELETE FROM playlist_likes;
    DELETE FROM playlist_reposts;
    DELETE FROM album_likes;
    DELETE FROM album_reposts;

    -- 2. Playlists
    DELETE FROM playlist_tracks;
    DELETE FROM playlist_tags;
    DELETE FROM playlists WHERE type = 'regular';

    -- 3. Albums
    DELETE FROM album_tracks;
    DELETE FROM albums;

    -- 4. Tracks
    DELETE FROM track_tags;
    DELETE FROM track_artists;
    DELETE FROM tracks;

    -- 5. Social graph
    DELETE FROM follows;
    DELETE FROM blocks;
    DELETE FROM follow_requests;

    -- 6. Messages
    DELETE FROM messages;
    DELETE FROM conversations;

    -- 7. Auth tokens
    DELETE FROM refresh_tokens;
    DELETE FROM verification_tokens;

    -- 8. User data
    DELETE FROM user_preferences;
    DELETE FROM user_subscriptions;
    DELETE FROM transactions;
    DELETE FROM reports;
    DELETE FROM web_profiles;

    -- 9. Users (cascades to user_content_settings, user_privacy_settings,
    --    user_favorite_genres, user_favorite_tags, recent_searches,
    --    notification_preferences, oauth_connections)
    DELETE FROM users;

    COMMIT;
  `);

  // saved_stations may not exist in all environments
  await db.runSql(`
    DO $$ BEGIN
      EXECUTE 'DELETE FROM saved_stations';
    EXCEPTION WHEN undefined_table THEN NULL;
    END $$;
  `);
};

exports.down = async function () {
  // Intentional no-op — cleanup is one-way.
};

exports._meta = { version: 1 };
