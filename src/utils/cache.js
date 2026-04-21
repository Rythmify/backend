const { getRedisClient } = require('../config/redis');

const inFlightFetches = new Map();
const memoryCache = new Map();
const isDevelopment = process.env.NODE_ENV === 'development';
let hasLoggedRedisBypass = false;

function shouldLogKey(key) {
  return !String(key || '').startsWith('station:');
}

function debugLog(key, message) {
  if (isDevelopment && shouldLogKey(key)) {
    console.info(message);
  }
}

function logRedisBypassOnce() {
  if (hasLoggedRedisBypass) return;
  hasLoggedRedisBypass = true;

  if (isDevelopment) {
    console.warn('[cache] Redis unavailable; using in-memory fallback.');
  }
}

async function getOrSetCache(key, ttlSeconds, fetchFn) {
  const redis = await getRedisClient();

  if (redis) {
    try {
      const cached = await redis.get(key);
      if (cached !== null) {
        debugLog(key, `[CACHE HIT] ${key}`);
        return JSON.parse(cached);
      }
      debugLog(key, `[CACHE MISS] ${key}`);
    } catch (error) {
      console.error('[cache] Read failed, falling back to source:', error?.message || error);
    }
  } else {
    logRedisBypassOnce();

    const cached = memoryCache.get(key);
    if (cached && cached.expiry > Date.now()) {
      debugLog(key, `[MEMORY CACHE HIT] ${key}`);
      return cached.value;
    }
  }

  const existingInFlight = inFlightFetches.get(key);
  if (existingInFlight) {
    debugLog(key, `[CACHE WAIT] ${key}`);
    return existingInFlight;
  }

  const fetchPromise = (async () => {
    const freshData = await fetchFn();

    if (redis) {
      try {
        await redis.setEx(key, ttlSeconds, JSON.stringify(freshData));
        debugLog(key, `[CACHE SET] ${key} ttl=${ttlSeconds}`);
      } catch (error) {
        console.error('[cache] Write failed:', error?.message || error);
      }
    } else {
      memoryCache.set(key, {
        value: freshData,
        expiry: Date.now() + ttlSeconds * 1000,
      });
      debugLog(key, `[MEMORY CACHE SET] ${key}`);
    }

    return freshData;
  })();

  inFlightFetches.set(key, fetchPromise);

  try {
    return await fetchPromise;
  } finally {
    inFlightFetches.delete(key);
  }
}

module.exports = {
  getOrSetCache,
};
