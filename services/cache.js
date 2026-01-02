const cache = new Map();
const DEFAULT_TTL = 60 * 60 * 1000; // 60 minutes

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
  del: (key) => cache.delete(key),
  flush: () => cache.clear()
};