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
