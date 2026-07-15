// ============================================================
// Orbiton Caching Module
// Auto-detects Redis connection. Falls back to Node In-Memory Cache
// for high-availability database query offloading.
// ============================================================

const Redis = require('ioredis');

let redisClient = null;
const memoryCache = new Map();
const useRedis = process.env.REDIS_URL || process.env.USE_REDIS === 'true';

if (useRedis) {
  try {
    // Attempt Redis connection
    redisClient = new Redis(process.env.REDIS_URL || 'redis://127.0.0.1:6379', {
      maxRetriesPerRequest: 1,
      connectTimeout: 2000,
      lazyConnect: true
    });
    
    redisClient.connect()
      .then(() => console.log('⚡ Redis Cache Server connected successfully!'))
      .catch(() => {
        console.warn('⚠️ Redis not running. Falling back to local In-Memory Cache.');
        redisClient = null;
      });

    redisClient.on('error', () => {
      // Prevent crash, fallback silently
      redisClient = null;
    });
  } catch (_) {
    redisClient = null;
  }
}

const cache = {
  async get(key) {
    if (redisClient) {
      try {
        const val = await redisClient.get(key);
        return val ? JSON.parse(val) : null;
      } catch (_) {
        // Fallback to local memory on transient Redis failures
      }
    }
    
    const memVal = memoryCache.get(key);
    if (memVal) {
      if (Date.now() > memVal.expireAt) {
        memoryCache.delete(key);
        return null;
      }
      return memVal.data;
    }
    return null;
  },

  async set(key, value, ttlSeconds = 5) {
    if (redisClient) {
      try {
        await redisClient.set(key, JSON.stringify(value), 'EX', ttlSeconds);
        return;
      } catch (_) {}
    }
    
    memoryCache.set(key, {
      data: value,
      expireAt: Date.now() + (ttlSeconds * 1000)
    });
  },

  async del(key) {
    if (redisClient) {
      try {
        await redisClient.del(key);
        return;
      } catch (_) {}
    }
    memoryCache.delete(key);
  },

  async flush() {
    if (redisClient) {
      try {
        await redisClient.flushall();
        return;
      } catch (_) {}
    }
    memoryCache.clear();
  }
};

module.exports = cache;
