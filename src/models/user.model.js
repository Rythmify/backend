// ============================================================
// models/user.model.js — PostgreSQL queries for User
// Entity attributes: User_Id, Email, Display_name, Password, Role, Profile_picture, Cover_Picture, BIO, Gender, Location, Favourite_Genre, Followers_Count, Following_Count, Total_Stream, Is_verified, Is_Private, Created_at, Updated_at
// All SQL lives HERE — no SQL outside models/
// ============================================================
const db = require('../config/db');
const { buildTrackPersonalizationSelect } = require('./track-personalization');

// find user by email used for login and register (to check if email already exists)
exports.findByEmail = async (email) => {
  const { rows } = await db.query(
    // ✅ FIX: email is citext — case-insensitive comparison is handled at the type level.
    // Using LOWER() wrapping defeats the index. Direct equality uses it correctly.
    `SELECT * FROM users WHERE email = $1 AND deleted_at IS NULL`,
    [email]
  );
  return rows[0] || null;
};

// check if username is already taken (called during registration and username update)
exports.isUsernameTaken = async (username) => {
  const { rows } = await db.query(
    `SELECT 1 FROM users WHERE username = $1 AND deleted_at IS NULL LIMIT 1`,
    [username]
  );
  return rows.length > 0;
};

// find user by username used for login (when identifier is a username)
exports.findByUsername = async (username) => {
  const { rows } = await db.query(
    `SELECT * FROM users WHERE LOWER(username) = LOWER($1) AND deleted_at IS NULL`,
    [username]
  );
  return rows[0] || null;
};

// find user by email OR username in one query
exports.findByEmailOrUsername = async (identifier) => {
  const { rows } = await db.query(
    // ✅ FIX: email is citext so direct equality works and uses the index.
    // username uses LOWER() which hits the functional index added in migration.
    `SELECT * FROM users
     WHERE (email = $1 OR LOWER(username) = LOWER($1))
     AND deleted_at IS NULL`,
    [identifier]
  );
  return rows[0] || null;
};

// find user by UUID used for auth and other operations where we have the user ID
exports.findById = async (id) => {
  const { rows } = await db.query(`SELECT * FROM users WHERE id = $1 AND deleted_at IS NULL`, [id]);
  return rows[0] || null;
};

// create new user (called during registration)
exports.create = async ({
  email,
  password_hashed,
  display_name,
  gender,
  date_of_birth,
  username,
}) => {
  const { rows } = await db.query(
    `INSERT INTO users (email, password_hashed, display_name, gender, date_of_birth, username)
     VALUES (LOWER($1), $2, $3, $4, $5, $6)
     RETURNING id, email, display_name, gender, date_of_birth, role, is_verified, created_at`,
    [email, password_hashed, display_name, gender, date_of_birth, username]
  );
  return rows[0];
};

// mark user as verified
exports.markVerified = async (userId) => {
  await db.query(`UPDATE users SET is_verified = true WHERE id = $1`, [userId]);
};

// update last login timestamp (called after successful login)
exports.updateLastLogin = async (userId) => {
  await db.query(`UPDATE users SET last_login_at = now() WHERE id = $1`, [userId]);
};

// update password (called during password reset)
exports.updatePassword = async (userId, newPasswordHashed) => {
  await db.query(`UPDATE users SET password_hashed = $1, updated_at = now() WHERE id = $2`, [
    newPasswordHashed,
    userId,
  ]);
};

// get user profile (called in GET /users/me)
exports.findFullById = async (id) => {
  const { rows } = await db.query(
    `SELECT       
      id, email, username, display_name, first_name, last_name,
      bio, city, country, gender, date_of_birth, role,
      profile_picture, cover_photo, is_private, is_verified,
      EXISTS (
        SELECT 1
        FROM user_subscriptions us
        JOIN subscription_plans sp ON sp.id = us.subscription_plan_id
        WHERE us.user_id = users.id
          AND us.status = 'active'
          AND sp.name <> 'free'
          AND (us.end_date IS NULL OR us.end_date > NOW())
      ) AS is_user_premium,
      is_suspended, twofa_enabled, followers_count, following_count,
      last_login_at, created_at, updated_at
      FROM users
      WHERE id = $1 AND deleted_at IS NULL`,
    [id]
  );
  return rows[0] || null;
};

// get public user profile (called in GET /users/:id)
exports.findPublicById = async (id) => {
  const { rows } = await db.query(
    `SELECT
      id, display_name, username, bio, city, country,
      gender, role, profile_picture, cover_photo,
      is_private, is_verified,
      EXISTS (
        SELECT 1
        FROM user_subscriptions us
        JOIN subscription_plans sp ON sp.id = us.subscription_plan_id
        WHERE us.user_id = users.id
          AND us.status = 'active'
          AND sp.name <> 'free'
          AND (us.end_date IS NULL OR us.end_date > NOW())
      ) AS is_user_premium,
      followers_count, following_count,
      created_at
      FROM users
      WHERE id = $1 AND deleted_at IS NULL`,
    [id]
  );
  return rows[0] || null;
};

// check if user A is following user B (used in GET /users/:id to determine if we can show private profile)
exports.isFollowing = async (followerId, followingId) => {
  const { rows } = await db.query(
    `SELECT 1 FROM follows WHERE follower_id = $1 AND following_id = $2`,
    [followerId, followingId]
  );
  return rows.length > 0;
};

exports.updateProfile = async (userId, fields) => {
  const allowed = ['display_name', 'username', 'first_name', 'last_name', 'bio', 'city', 'country'];
  const updates = [];
  const values = [];
  let i = 1;

  for (const key in fields) {
    if (allowed.includes(key)) {
      updates.push(`${key} = $${i}`);
      values.push(fields[key]);
      i++;
    }
  }

  if (updates.length === 0) return null;

  updates.push(`updated_at = now()`);
  values.push(userId);

  const { rows } = await db.query(
    `UPDATE users SET ${updates.join(', ')} WHERE id = $${i}
     RETURNING 
      id, email, username, display_name, first_name, last_name,
      bio, city, country, gender, date_of_birth, role,
      profile_picture, cover_photo, is_private, is_verified,
      followers_count, following_count, created_at, updated_at`,
    values
  );
  return rows[0] || null;
};

exports.updateAccount = async (userId, fields) => {
  const allowed = ['date_of_birth', 'gender'];
  const updates = [];
  const values = [];
  let i = 1;

  for (const key in fields) {
    if (allowed.includes(key)) {
      updates.push(`${key} = $${i}`);
      values.push(fields[key]);
      i++;
    }
  }

  if (updates.length === 0) return null;

  updates.push(`updated_at = now()`);
  values.push(userId);

  const { rows } = await db.query(
    `UPDATE users SET ${updates.join(', ')} WHERE id = $${i}
     RETURNING
       id, email, username, display_name, first_name, last_name,
       bio, city, country, gender, date_of_birth, role,
       profile_picture, cover_photo, is_private, is_verified,
       followers_count, following_count, created_at, updated_at`,
    values
  );
  return rows[0] || null;
};

exports.updateRole = async (userId, newRole) => {
  const { rows } = await db.query(
    `UPDATE users SET role = $1, updated_at = now() 
    WHERE id = $2 AND deleted_at IS NULL
     RETURNING
       id, email, username, display_name, role,
       is_verified, followers_count, following_count, updated_at`,
    [newRole, userId]
  );
  return rows[0] || null;
};

exports.promoteListenerToArtist = async (userId) => {
  const { rows } = await db.query(
    `UPDATE users
     SET role = 'artist',
         updated_at = NOW()
     WHERE id = $1
       AND role = 'listener'
       AND deleted_at IS NULL
     RETURNING id, role`,
    [userId]
  );
  return rows[0] || null;
};

exports.deleteAvatar = async (userId) => {
  const { rows } = await db.query(
    `UPDATE users SET profile_picture = NULL, updated_at = now()
     WHERE id = $1 AND deleted_at IS NULL
     RETURNING profile_picture`,
    [userId]
  );
  return rows[0] || null;
};

exports.updateAvatar = async (userId, imagePath) => {
  const { rows } = await db.query(
    `UPDATE users SET profile_picture = $1, updated_at = now()
      WHERE id = $2 AND deleted_at IS NULL
      RETURNING profile_picture`,
    [imagePath, userId]
  );
  return rows[0] || null;
};

exports.updateCoverPhoto = async (userId, imagePath) => {
  const { rows } = await db.query(
    `UPDATE users SET cover_photo = $1, updated_at = now()  
      WHERE id = $2 AND deleted_at IS NULL
      RETURNING cover_photo`,
    [imagePath, userId]
  );
  return rows[0] || null;
};

exports.deleteCoverPhoto = async (userId) => {
  const { rows } = await db.query(
    `UPDATE users SET cover_photo = NULL, updated_at = now()
      WHERE id = $1 AND deleted_at IS NULL
      RETURNING cover_photo`,
    [userId]
  );
  return rows[0] || null;
};

exports.findWebProfilesByUserId = async (userId) => {
  const { rows } = await db.query(`SELECT id, platform, url FROM web_profiles WHERE user_id = $1`, [
    userId,
  ]);
  return rows || [];
};

exports.findWebProfileByPlatform = async (userId, platform) => {
  const { rows } = await db.query(
    `SELECT id FROM web_profiles WHERE user_id = $1 AND platform = $2`,
    [userId, platform]
  );
  return rows[0] || null;
};

exports.createWebProfile = async (userId, platform, url) => {
  const { rows } = await db.query(
    `INSERT INTO web_profiles (user_id, platform, url)
     VALUES ($1, $2, $3)
     RETURNING id, platform, url`,
    [userId, platform, url]
  );
  return rows[0] || null;
};

exports.deleteWebProfile = async (profileId) => {
  const { rows } = await db.query(`DELETE FROM web_profiles WHERE id = $1 RETURNING id`, [
    profileId,
  ]);
  return rows[0] || null;
};

exports.findWebProfileById = async (profileId) => {
  const { rows } = await db.query(
    `SELECT id, user_id, platform, url FROM web_profiles WHERE id = $1`,
    [profileId]
  );
  return rows[0] || null;
};

exports.updatePrivacy = async (userId, isPrivate) => {
  const { rows } = await db.query(
    `UPDATE users SET is_private = $1, updated_at = now()
      WHERE id = $2 AND deleted_at IS NULL
      RETURNING is_private`,
    [isPrivate, userId]
  );
  return rows[0] || null;
};

exports.findContentSettingsByUserId = async (userId) => {
  const { rows } = await db.query(
    `SELECT rss_title, rss_language, rss_category, rss_explicit, 
            rss_show_email, default_include_in_rss, default_license_type
     FROM user_content_settings WHERE user_id = $1`,
    [userId]
  );
  return rows[0] || null;
};

exports.updateContentSettings = async (userId, settings) => {
  const allowed = [
    'rss_title',
    'rss_language',
    'rss_category',
    'rss_explicit',
    'rss_show_email',
    'default_include_in_rss',
    'default_license_type',
  ];
  const fields = [];
  const values = [];
  let i = 1;

  for (const key in settings) {
    if (allowed.includes(key)) {
      fields.push(`${key} = $${i}`);
      values.push(settings[key]);
      i++;
    }
  }

  if (fields.length === 0) return null;
  fields.push(`updated_at = now()`);
  values.push(userId);

  const { rows } = await db.query(
    `UPDATE user_content_settings SET ${fields.join(', ')} 
     WHERE user_id = $${i} 
     RETURNING rss_title, rss_language, rss_category, rss_explicit, 
               rss_show_email, default_include_in_rss, default_license_type`,
    values
  );
  return rows[0] || null;
};

exports.findPrivacySettingsByUserId = async (userId) => {
  const { rows } = await db.query(
    `WITH user_row AS (
       SELECT id, is_private
       FROM users
       WHERE id = $1 AND deleted_at IS NULL
     ),
     insert_settings AS (
       INSERT INTO user_privacy_settings (user_id)
       SELECT id FROM user_row
       ON CONFLICT (user_id) DO NOTHING
     )
     SELECT user_row.is_private,
            ps.receive_messages_from_anyone,
            ps.show_activities_in_discovery,
            ps.show_as_top_fan,
            ps.show_top_fans_on_tracks
     FROM user_row
     LEFT JOIN user_privacy_settings ps ON ps.user_id = user_row.id`,
    [userId]
  );
  return rows[0] || null;
};

exports.updatePrivacySettings = async (userId, settings) => {
  const allowed = [
    'receive_messages_from_anyone',
    'show_activities_in_discovery',
    'show_as_top_fan',
    'show_top_fans_on_tracks',
  ];
  const fields = [];
  const values = [];
  let i = 1;

  for (const key in settings) {
    if (allowed.includes(key)) {
      fields.push(`${key} = $${i}`);
      values.push(settings[key]);
      i++;
    }
  }

  const hasPrivacyUpdates = fields.length > 0;
  const hasPrivateUpdate = settings.is_private !== undefined;

  if (!hasPrivacyUpdates && !hasPrivateUpdate) return null;

  const client = await db.connect();
  try {
    await client.query('BEGIN');

    await client.query(
      `INSERT INTO user_privacy_settings (user_id)
       VALUES ($1)
       ON CONFLICT (user_id) DO NOTHING`,
      [userId]
    );

    if (hasPrivateUpdate) {
      await client.query(
        `UPDATE users SET is_private = $1, updated_at = now()
         WHERE id = $2 AND deleted_at IS NULL`,
        [settings.is_private, userId]
      );
    }

    if (hasPrivacyUpdates) {
      fields.push(`updated_at = now()`);
      values.push(userId);
      const whereIndex = values.length;
      await client.query(
        `UPDATE user_privacy_settings SET ${fields.join(', ')}
         WHERE user_id = $${whereIndex}`,
        values
      );
    }

    const { rows } = await client.query(
      `SELECT u.is_private,
              ps.receive_messages_from_anyone,
              ps.show_activities_in_discovery,
              ps.show_as_top_fan,
              ps.show_top_fans_on_tracks
       FROM users u
       LEFT JOIN user_privacy_settings ps ON ps.user_id = u.id
       WHERE u.id = $1 AND u.deleted_at IS NULL`,
      [userId]
    );

    await client.query('COMMIT');
    return rows[0] || null;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

exports.findGenresByUserId = async (userId) => {
  const { rows } = await db.query(
    `SELECT g.id, g.name FROM user_favorite_genres ufg  
      JOIN genres g ON ufg.genre_id = g.id    
      WHERE ufg.user_id = $1`,
    [userId]
  );
  return rows || [];
};

exports.replaceGenres = async (userId, genreIds) => {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    await client.query(`DELETE FROM user_favorite_genres WHERE user_id = $1`, [userId]);
    for (const genreId of genreIds) {
      await client.query(`INSERT INTO user_favorite_genres (user_id, genre_id) VALUES ($1, $2)`, [
        userId,
        genreId,
      ]);
    }
    await client.query('COMMIT');
    return await exports.findGenresByUserId(userId);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

exports.completeOnboarding = async (userId, fields) => {
  const allowed = ['display_name', 'gender', 'date_of_birth', 'bio', 'city', 'country'];
  const updates = [];
  const values = [];
  let i = 1;
  for (const key in fields) {
    if (allowed.includes(key)) {
      updates.push(`${key} = $${i}`);
      values.push(fields[key]);
      i++;
    }
  }

  if (updates.length === 0) return null;
  updates.push(`updated_at = now()`);
  values.push(userId);
  const { rows } = await db.query(
    `UPDATE users SET ${updates.join(', ')} WHERE id = $${i}
      RETURNING id, email, username, display_name, first_name, last_name,
                bio, city, country, gender, date_of_birth, role,
                profile_picture, cover_photo, is_private, is_verified,
                followers_count, following_count, created_at, updated_at`,
    values
  );
  return rows[0] || null;
};

exports.findVisibleLikedTracksByUserId = async ({
  targetUserId,
  requesterUserId = null,
  limit,
  offset,
}) => {
  const whereClause = `
    tl.user_id = $1
    AND t.deleted_at IS NULL
    AND t.is_hidden = false
    AND t.is_public = true
    AND t.status = 'ready'
    AND u.deleted_at IS NULL
  `;

  const itemsQuery = `
    SELECT
      t.id,
      t.title,
      g.name AS genre,
      t.duration,
      t.cover_image,
      t.user_id,
      u.display_name AS artist_name,
      t.play_count,
      t.like_count,
      t.comment_count,
      t.repost_count,
      t.stream_url,
      t.audio_url,
      ${buildTrackPersonalizationSelect({
        requesterUserIdParam: '$2',
        trackAlias: 't',
      })},
      tl.created_at AS liked_at
    FROM track_likes tl
    JOIN tracks t
      ON t.id = tl.track_id
    LEFT JOIN genres g
      ON g.id = t.genre_id
    JOIN users u
      ON u.id = t.user_id
    WHERE ${whereClause}
    ORDER BY tl.created_at DESC
    LIMIT $3 OFFSET $4
  `;

  const countQuery = `
    SELECT COUNT(DISTINCT tl.track_id)::int AS total
    FROM track_likes tl
    JOIN tracks t
      ON t.id = tl.track_id
    JOIN users u
      ON u.id = t.user_id
    WHERE ${whereClause}
  `;

  const [itemsResult, countResult] = await Promise.all([
    db.query(itemsQuery, [targetUserId, requesterUserId, limit, offset]),
    db.query(countQuery, [targetUserId]),
  ]);

  return {
    items: itemsResult.rows,
    total: countResult.rows[0]?.total ?? 0,
  };
};

exports.createOAuthUser = async ({ email, display_name, username }) => {
  const { rows } = await db.query(
    `INSERT INTO users (email, display_name, username, is_verified)
     VALUES ($1, $2, $3, true)
     RETURNING id, email, display_name, username, gender, role, is_verified, created_at`,
    [email, display_name, username]
  );
  return rows[0];
};

// Set pending_email (called when user requests email change)
exports.setPendingEmail = async (userId, pendingEmail) => {
  await db.query(`UPDATE users SET pending_email = $2 WHERE id = $1`, [userId, pendingEmail]);
};

// Apply the pending email change — copy pending_email to email, clear pending_email
exports.applyPendingEmail = async (userId) => {
  const { rows } = await db.query(
    `UPDATE users
     SET email = pending_email, pending_email = NULL
     WHERE id = $1
     RETURNING email`,
    [userId]
  );
  return rows[0];
};

exports.softDeleteWithContent = async (userId) => {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `UPDATE tracks SET deleted_at = now() WHERE user_id = $1 AND deleted_at IS NULL`,
      [userId]
    );
    await client.query(
      `UPDATE playlists SET deleted_at = now() WHERE user_id = $1 AND deleted_at IS NULL`,
      [userId]
    );
    await client.query(
      `UPDATE users SET deleted_at = now(), updated_at = now() WHERE id = $1 AND deleted_at IS NULL`,
      [userId]
    );
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

// ============================================================
// ADMIN & MODERATION METHODS
// ============================================================

/**
 * Update user status (active, suspended, deleted)
 * Used by admin module to suspend/reinstate users
 */
exports.updateUserStatus = async (userId, status, reason = null) => {
  const validStatuses = ['active', 'suspended', 'deleted'];
  if (!validStatuses.includes(status)) {
    throw new Error(`Invalid status: ${status}`);
  }

  let query;
  let values;

  if (status === 'suspended') {
    // When suspending: set status, suspended_at, is_suspended=true, and suspension_reason
    query = `
      UPDATE users
      SET status = $1, 
          is_suspended = true,
          suspended_at = now(),
          suspension_reason = $2,
          updated_at = now()
      WHERE id = $3 AND deleted_at IS NULL
      RETURNING 
        id, email, username, display_name, role, status,
        is_suspended, suspended_at, suspension_reason, updated_at
    `;
    values = [status, reason, userId];
  } else if (status === 'active') {
    // When reactivating: set status, is_suspended=false, clear suspension fields
    query = `
      UPDATE users
      SET status = $1, 
          is_suspended = false,
          suspended_at = NULL,
          suspension_reason = NULL,
          updated_at = now()
      WHERE id = $2 AND deleted_at IS NULL
      RETURNING 
        id, email, username, display_name, role, status,
        is_suspended, suspended_at, suspension_reason, updated_at
    `;
    values = [status, userId];
  } else if (status === 'deleted') {
    // When marking as deleted: set status and deleted_at
    query = `
      UPDATE users
      SET status = $1, 
          deleted_at = now(),
          updated_at = now()
      WHERE id = $2
      RETURNING 
        id, email, username, display_name, role, status, deleted_at, updated_at
    `;
    values = [status, userId];
  }

  const { rows } = await db.query(query, values);
  return rows[0] || null;
};

/**
 * Get user warning count
 * Used to track repeated violations
 */
exports.getUserWarningCount = async (userId) => {
  const { rows } = await db.query(
    `SELECT COUNT(*)::integer as warning_count FROM warnings WHERE user_id = $1`,
    [userId]
  );
  return rows[0]?.warning_count || 0;
};

/**
 * Get count of suspended accounts
 * Used for admin analytics dashboard
 */
exports.getSuspendedAccountsCount = async () => {
  const { rows } = await db.query(
    `SELECT COUNT(*)::integer as suspended_count FROM users WHERE status = 'suspended' AND deleted_at IS NULL`
  );
  return rows[0]?.suspended_count || 0;
};

/**
 * Get active users count in a time period
 * Active = users with a recent login in the selected period
 */
exports.getActiveUsersCount = async (period = 'month') => {
  const periodMap = {
    day: '1 day',
    week: '7 days',
    month: '30 days',
  };

  const intervalValue = periodMap[period] || periodMap.month;

  const { rows } = await db.query(
    `SELECT COUNT(*)::integer AS active_count
     FROM users
     WHERE deleted_at IS NULL
       AND last_login_at IS NOT NULL
       AND last_login_at >= NOW() - $1::interval`,
    [intervalValue]
  );

  return rows[0]?.active_count || 0;
};

/**
 * Get count of users active today (last_login_at >= start of current day UTC).
 * More precise than getActiveUsersCount('day') which uses a rolling 24h window.
 */
exports.getActiveUsersToday = async () => {
  const { rows } = await db.query(
    `SELECT COUNT(*)::integer AS active_count
     FROM users
     WHERE deleted_at IS NULL
       AND last_login_at IS NOT NULL
       AND last_login_at >= CURRENT_DATE`
  );
  return rows[0]?.active_count || 0;
};

/**
 * Get count of new user registrations in a time period
 */
exports.getNewRegistrationsCount = async (period = 'month') => {
  const periodMap = {
    day: '1 day',
    week: '7 days',
    month: '30 days',
  };

  const intervalValue = periodMap[period] || periodMap.month;

  const { rows } = await db.query(
    `SELECT COUNT(*)::integer AS registrations_count
     FROM users
     WHERE deleted_at IS NULL
       AND created_at >= NOW() - $1::interval`,
    [intervalValue]
  );

  return rows[0]?.registrations_count || 0;
};

exports.findByEmailIncludingDeleted = async (email) => {
  const { rows } = await db.query(`SELECT * FROM users WHERE email = $1 LIMIT 1`, [email]);
  return rows[0] || null;
};

exports.reviveUser = async (
  userId,
  { email, password_hashed, display_name, username, gender, date_of_birth }
) => {
  const { rows } = await db.query(
    `UPDATE users
     SET email = $2,
         password_hashed = $3,
         display_name = $4,
         username = $5,
         gender = $6,
         date_of_birth = $7,
         deleted_at = NULL,
         updated_at = now(),
         is_verified = false
     WHERE id = $1
     RETURNING id, email, display_name, gender, role, is_verified, date_of_birth, username, created_at`,
    [userId, email, password_hashed, display_name, username, gender, date_of_birth]
  );
  return rows[0] || null;
};
