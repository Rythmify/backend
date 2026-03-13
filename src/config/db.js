// ============================================================
// config/db.js — PostgreSQL connection pool (pg driver)
// ============================================================
const { Pool } = require('pg');
const env = require('./env');

const pool = new Pool({
  connectionString: env.DATABASE_URL,
});

pool.on('connect', () => console.log('PostgreSQL connected'));
pool.on('error', (err) => console.error('PostgreSQL error:', err));

module.exports = pool;
