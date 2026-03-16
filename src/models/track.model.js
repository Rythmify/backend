// ============================================================
// models/track.model.js — PostgreSQL queries for Tracks
// Entity attributes: Track_ID, User_Id, File_url, Song_Picture_url, Album, Genre, Description, Duration, Status, Play_Counts, Like_count, Is_trending, Release_Date, Created_at, Updated_at
// All SQL lives HERE — no SQL outside models/
// ============================================================
const db = require('../config/db');

const createTrack = async (t) => {
  const query = `
    INSERT INTO tracks (
      title, description, genre_id, cover_image, waveform_url, audio_url, stream_url, preview_url,
      duration, file_size, bitrate, status, is_public, user_id,
      release_date, isrc, p_line, buy_link, record_label, publisher,
      explicit_content, license_type,
      enable_downloads, enable_offline_listening, include_in_rss_feed, display_embed_code, enable_app_playback,
      allow_comments, show_comments_public, show_insights_public, geo_restriction_type, geo_regions
    )
    VALUES (
      $1,$2,$3,$4,NULL,$5,NULL,NULL,
      NULL,$6,NULL,$7,$8,$9,
      $10,$11,$12,$13,$14,$15,
      $16,$17,
      $18,$19,$20,$21,$22,
      $23,$24,$25,$26,$27
    )
    RETURNING *;
  `;

  const values = [
    t.title, t.description, t.genre_id, t.cover_image, t.audio_url, t.file_size, t.status, t.is_public, t.user_id,
    t.release_date, t.isrc, t.p_line, t.buy_link, t.record_label, t.publisher,
    t.explicit_content, t.license_type,
    t.enable_downloads, t.enable_offline_listening, t.include_in_rss_feed, t.display_embed_code, t.enable_app_playback,
    t.allow_comments, t.show_comments_public, t.show_insights_public, t.geo_restriction_type, JSON.stringify(t.geo_regions || []),
  ];

  const result = await db.query(query, values);
  return result.rows[0];
};

const addTrackTags = async (trackId, tagIds) => {
  for (const tagId of tagIds) {
    await db.query(
      `INSERT INTO track_tags (track_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [trackId, tagId]
    );
  }
};

const addTrackArtists = async (trackId, artistIds) => {
  for (let i = 0; i < artistIds.length; i++) {
    await db.query(
      `INSERT INTO track_artists (track_id, artist_id, position) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
      [trackId, artistIds[i], i + 1]
    );
  }
};

const getGenreIdByName = async (genreName) => {
  if (!genreName) return null;

  const result = await db.query(
    `SELECT id FROM genres WHERE LOWER(name) = LOWER($1) LIMIT 1`,
    [genreName]
  );

  return result.rows[0]?.id || null;
};

const getTagIdsByTrackId = async (trackId) => {
  const result = await db.query(
    `SELECT tag_id FROM track_tags WHERE track_id = $1 ORDER BY created_at ASC`,
    [trackId]
  );

  return result.rows.map((row) => row.tag_id);
};

module.exports = { createTrack, addTrackTags, addTrackArtists, getGenreIdByName, getTagIdsByTrackId };