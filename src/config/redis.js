const env = require('./env');

const DEFAULT_REDIS_URL = 'redis://localhost:6379';

let redisModule = null;
let redisModuleLoadFailed = false;
let client = null;
let connectPromise = null;
const isDevelopment = process.env.NODE_ENV === 'development';
let hasLoggedRedisConnected = false;
let hasLoggedRedisConnectionFailure = false;
let hasLoggedRedisClientError = false;

function loadRedisModule() {
  if (redisModuleLoadFailed) return null;
  if (redisModule) return redisModule;

  try {
    redisModule = require('redis');
    return redisModule;
  } catch {
    redisModuleLoadFailed = true;
    return null;
  }
}

function isRedisConfigured() {
  return env.REDIS_ENABLED === 'true';
}

function createRedisClient() {
  const mod = loadRedisModule();
  if (!mod) return null;

  const redisUrl = env.REDIS_URL || DEFAULT_REDIS_URL;

  const nextClient = mod.createClient({
    url: redisUrl,
    socket: {
      connectTimeout: 2000,
      reconnectStrategy: false,
    },
  });

  nextClient.on('error', (error) => {
    if (hasLoggedRedisClientError) return;
    hasLoggedRedisClientError = true;
    console.error('[cache] Redis client error:', error?.message || error);
  });

  if (isDevelopment) {
    console.info(`[cache] Redis client configured with ${redisUrl}`);
  }

  return nextClient;
}

async function getRedisClient() {
  if (!isRedisConfigured()) return null;

  if (!client) {
    client = createRedisClient();
  }

  if (!client) return null;
  if (client.isOpen) return client;

  if (!connectPromise) {
    connectPromise = client.connect().catch((error) => {
      if (!hasLoggedRedisConnectionFailure) {
        hasLoggedRedisConnectionFailure = true;
        console.error('[cache] Redis connection failed:', error?.message || error);
      }
      return null;
    });
  }

  await connectPromise;
  connectPromise = null;

  if (client.isOpen) {
    hasLoggedRedisConnectionFailure = false;
    hasLoggedRedisClientError = false;
    if (!hasLoggedRedisConnected) {
      hasLoggedRedisConnected = true;
      console.info('Redis connected');
    }
  }

  return client.isOpen ? client : null;
}

module.exports = {
  getRedisClient,
};
