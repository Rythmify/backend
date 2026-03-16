// ============================================================
// models/user.model.js — PostgreSQL queries for User
// Entity attributes: User_Id, Email, Display_name, Password, Role, Profile_picture, Cover_Picture, BIO, Gender, Location, Favourite_Genre, Followers_Count, Following_Count, Total_Stream, Is_verified, Is_Private, Created_at, Updated_at
// All SQL lives HERE — no SQL outside models/
// ============================================================
const db = require('../config/db');

// find user by email used for login and register (to check if email already exists)
exports.findByEmail = async (email) => {
  const { rows } = await db.query(
    `SELECT * FROM users WHERE email = $1 AND deleted_at IS NULL`,
    [email]
  );
  return rows[0] || null;
};

// find user by username used for login (when identifier is a username)
exports.findByUsername = async (username) => {
  const { rows } = await db.query(
    `SELECT * FROM users WHERE username = $1 AND deleted_at IS NULL`,
    [username]
  );
  return rows[0] || null;
};

// find user by email OR username in one query
exports.findByEmailOrUsername = async (identifier) => {
  const { rows } = await db.query(
    `SELECT * FROM users
     WHERE (email = $1 OR username = $1)
     AND deleted_at IS NULL`,
    [identifier]
  );
  return rows[0] || null;
};

// find user by UUID used for auth and other operations where we have the user ID
exports.findById = async (id) => {
  const { rows } = await db.query(
    `SELECT * FROM users WHERE id = $1 AND deleted_at IS NULL`,
    [id]
  );
  return rows[0] || null;
};


// create new user (called during registration)
exports.create = async ({ email, password_hashed, display_name, gender, date_of_birth }) => {
  const { rows } = await db.query(
    `INSERT INTO users (email, password_hashed, display_name, gender, date_of_birth)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, email, display_name, gender, date_of_birth, role, is_verified, created_at`,
    [email, password_hashed, display_name, gender, date_of_birth]
  );
  return rows[0];
};

// mark user as verified
exports.markVerified = async (userId) => {
  await db.query(
    `UPDATE users SET is_verified = true WHERE id = $1`,
    [userId]
  );
};

// update last login timestamp (called after successful login)
exports.updateLastLogin = async (userId) => {
  await db.query(
    `UPDATE users SET last_login_at = now() WHERE id = $1`,
    [userId]
  );
};

// update password (called during password reset)
exports.updatePassword = async (userId, newPasswordHashed) => {
  await db.query(
    `UPDATE users SET password_hashed = $1, updated_at = now() WHERE id = $2`,
    [newPasswordHashed, userId]
  );
};

// update password (called during password reset)
exports.updatePassword = async (userId, newPasswordHashed) => {
  await db.query(
    `UPDATE users SET password_hashed = $1, updated_at = now() WHERE id = $2`,
    [newPasswordHashed, userId]
  );
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
}

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
}

// check if user A is following user B (used in GET /users/:id to determine if we can show private profile)
exports.isFollowing = async (followerId, followingId) => {
  const { rows } = await db.query(
    `SELECT 1 FROM follows WHERE follower_id = $1 AND following_id = $2`,
    [followerId, followingId]
  );
  return rows.length > 0;
};

exports.updateProfile = async (userId, fields) => {
  const allowed =['display_name', 'username', 'first_name', 'last_name', 'bio', 'city', 'country'];
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
  return rows[0]||null;
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
}

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
}
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
  const { rows } = await db.query(
    `SELECT id, platform, url FROM web_profiles WHERE user_id = $1`,
    [userId]
  );
  return rows || [];
};


 