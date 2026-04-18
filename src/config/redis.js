const env = require('./env');

let redisModule = null;
let redisModuleLoadFailed = false;
let client = null;
let connectPromise = null;

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
  return Boolean(env.REDIS_ENABLED && env.REDIS_URL);
}

function createRedisClient() {
  const mod = loadRedisModule();
  if (!mod) return null;

  const nextClient = mod.createClient({
    url: env.REDIS_URL,
    socket: {
      connectTimeout: 2000,
      reconnectStrategy: false,
    },
  });

  nextClient.on('error', (error) => {
    console.warn('[cache] Redis client error:', error?.message || error);
  });

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
      console.warn('[cache] Redis connect failed:', error?.message || error);
      return null;
    });
  }

  await connectPromise;
  connectPromise = null;

  return client.isOpen ? client : null;
}

module.exports = {
  getRedisClient,
};
