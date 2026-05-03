const { getRedisClient } = require('../config/redis');

const inFlightFetches = new Map();
const memoryCache = new Map();
const cacheGenerations = new Map();
const isDevelopment = process.env.NODE_ENV === 'development';
let hasLoggedRedisBypass = false;
const MEMORY_CACHE_CLEANUP_INTERVAL_MS = 60 * 1000;

function cloneCacheValue(value) {
  if (value === null || value === undefined) return value;

  if (typeof structuredClone === 'function') {
    return structuredClone(value);
  }

  return JSON.parse(JSON.stringify(value));
}

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

function pruneExpiredMemoryCacheEntries() {
  const now = Date.now();

  for (const [key, entry] of memoryCache.entries()) {
    if (!entry || entry.expiry <= now) {
      memoryCache.delete(key);
    }
  }
}

const cleanupTimer = setInterval(pruneExpiredMemoryCacheEntries, MEMORY_CACHE_CLEANUP_INTERVAL_MS);
if (typeof cleanupTimer.unref === 'function') {
  cleanupTimer.unref();
}

async function getOrSetCache(key, ttlSeconds, fetchFn) {
  const redis = await getRedisClient();
  const generation = cacheGenerations.get(key) || 0;

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
      return cloneCacheValue(cached.value);
    }

    if (cached) {
      memoryCache.delete(key);
    }
  }

  const existingInFlight = inFlightFetches.get(key);
  if (existingInFlight) {
    debugLog(key, `[CACHE WAIT] ${key}`);
    return existingInFlight;
  }

  const fetchPromise = (async () => {
    const freshData = await fetchFn();

    if ((cacheGenerations.get(key) || 0) !== generation) {
      return cloneCacheValue(freshData);
    }

    if (redis) {
      try {
        await redis.setEx(key, ttlSeconds, JSON.stringify(freshData));
        debugLog(key, `[CACHE SET] ${key} ttl=${ttlSeconds}`);
      } catch (error) {
        console.error('[cache] Write failed:', error?.message || error);
      }
    } else {
      memoryCache.set(key, {
        value: cloneCacheValue(freshData),
        expiry: Date.now() + ttlSeconds * 1000,
      });
      debugLog(key, `[MEMORY CACHE SET] ${key}`);
    }

    return cloneCacheValue(freshData);
  })();

  inFlightFetches.set(key, fetchPromise);

  try {
    return await fetchPromise;
  } finally {
    inFlightFetches.delete(key);
  }
}

async function invalidateCache(key) {
  const redis = await getRedisClient();
  cacheGenerations.set(key, (cacheGenerations.get(key) || 0) + 1);

  if (redis) {
    try {
      await redis.del(key);
    } catch (error) {
      console.error('[cache] Invalidate failed:', error?.message || error);
    }
  } else {
    memoryCache.delete(key);
  }

  inFlightFetches.delete(key);
}

async function invalidateCachePattern(prefix) {
  const safePrefix = String(prefix || '');
  const redis = await getRedisClient();
  const bumpGeneration = (key) => {
    cacheGenerations.set(key, (cacheGenerations.get(key) || 0) + 1);
  };

  if (redis) {
    try {
      if (typeof redis.scanIterator === 'function') {
        const keys = [];
        for await (const key of redis.scanIterator({ MATCH: `${safePrefix}*` })) {
          keys.push(key);
          bumpGeneration(key);
        }

        if (keys.length > 0) {
          await redis.del(keys);
        }
      } else {
        const keys = await redis.keys(`${safePrefix}*`);
        keys.forEach(bumpGeneration);
        if (keys.length > 0) {
          await redis.del(keys);
        }
      }
    } catch (error) {
      console.error('[cache] Pattern invalidate failed:', error?.message || error);
    }
  } else {
    for (const key of memoryCache.keys()) {
      if (key.startsWith(safePrefix)) {
        bumpGeneration(key);
        memoryCache.delete(key);
      }
    }
  }

  for (const key of inFlightFetches.keys()) {
    if (key.startsWith(safePrefix)) {
      bumpGeneration(key);
      inFlightFetches.delete(key);
    }
  }
}

module.exports = {
  getOrSetCache,
  invalidateCache,
  invalidateCachePattern,
};
