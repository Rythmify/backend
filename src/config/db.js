const { Pool } = require('pg');
const env = require('./env');

const pool = new Pool({
  connectionString: env.DATABASE_URL,
});

pool.on('connect', () => console.log('PostgreSQL connected'));
pool.on('error', (err) => console.error('PostgreSQL error:', err));

async function connectDB() {
  const client = await pool.connect();
  client.release();
}

// Export pool as default AND connectDB as named
pool.connectDB = connectDB;
module.exports = pool;