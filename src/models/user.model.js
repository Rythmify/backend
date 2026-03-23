// ============================================================
// models/user.model.js — PostgreSQL queries for User
// Entity attributes: User_Id, Email, Display_name, Password, Role, Profile_picture, Cover_Picture, BIO, Gender, Location, Favourite_Genre, Followers_Count, Following_Count, Total_Stream, Is_verified, Is_Private, Created_at, Updated_at
// All SQL lives HERE — no SQL outside models/
// ============================================================
const db = require('../config/db');

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
exports.create = async ({ email, password_hashed, display_name, gender, date_of_birth }) => {
  const { rows } = await db.query(
    `INSERT INTO users (email, password_hashed, display_name, gender, date_of_birth)
     VALUES (LOWER($1), $2, $3, $4, $5)
     RETURNING id, email, display_name, gender, date_of_birth, role, is_verified, created_at`,
    [email, password_hashed, display_name, gender, date_of_birth]
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
      is_private, is_verified, followers_count, following_count,
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
    `SELECT receive_messages_from_anyone, show_activities_in_discovery, 
            show_as_top_fan, show_top_fans_on_tracks  
     FROM user_privacy_settings WHERE user_id = $1`,
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

  if (fields.length === 0) return null;
  fields.push(`updated_at = now()`);
  values.push(userId);

  const { rows } = await db.query(
    `UPDATE user_privacy_settings SET ${fields.join(', ')} 
     WHERE user_id = $${i} 
     RETURNING receive_messages_from_anyone, show_activities_in_discovery, 
               show_as_top_fan, show_top_fans_on_tracks`,
    values
  );
  return rows[0] || null;
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

exports.createOAuthUser = async ({ email, display_name }) => {
  const { rows } = await db.query(
    `INSERT INTO users (email, display_name, is_verified)
     VALUES ($1, $2, true)
     RETURNING id, email, display_name, gender, role, is_verified, created_at`,
    [email, display_name]
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
