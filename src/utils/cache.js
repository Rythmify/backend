const { getRedisClient } = require('../config/redis');

async function getOrSetCache(key, ttlSeconds, fetchFn) {
  const redis = await getRedisClient();

  if (redis) {
    try {
      const cached = await redis.get(key);
      if (cached) {
        console.info(`[cache] hit ${key}`);
        return JSON.parse(cached);
      }
      console.info(`[cache] miss ${key}`);
    } catch (error) {
      console.warn('[cache] Read failed, falling back to source:', error?.message || error);
    }
  }

  const freshData = await fetchFn();

  if (redis) {
    try {
      await redis.setEx(key, ttlSeconds, JSON.stringify(freshData));
    } catch (error) {
      console.warn('[cache] Write failed:', error?.message || error);
    }
  }

  return freshData;
}

module.exports = {
  getOrSetCache,
};
