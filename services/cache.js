const cache = new Map();
const DEFAULT_TTL = 60 * 60 * 1000; // 60 minutes
const NEGATIVE_TTL = 10 * 60 * 1000; // 10 minutes for blocked/failed states

module.exports = {
  get: (key) => {
    const item = cache.get(key);
    if (!item) return null;
    if (Date.now() > item.expiresAt) {
      cache.delete(key);
      return null;
    }
    return item.value;
  },
  set: (key, value, ttl = DEFAULT_TTL) => {
    cache.set(key, {
      value,
      expiresAt: Date.now() + ttl
    });
  },
  // Set a negative cache entry (e.g. when blocked)
  setBlocked: (key) => {
    cache.set(key, {
      value: { blocked: true },
      expiresAt: Date.now() + NEGATIVE_TTL
    });
  },
  isBlocked: (key) => {
    const item = cache.get(key);
    if (item && item.value && item.value.blocked && Date.now() <= item.expiresAt) {
      return true;
    }
    return false;
  },
  del: (key) => cache.delete(key),
  flush: () => cache.clear()
};