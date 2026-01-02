const { getTonnelFloor } = require('./tonnel');
const { getPortalsFloor } = require('./portals');

// Cache storage
const floorCache = {
  data: {},
  ttl: 60 * 60 * 1000 // 60 minutes
};

/**
 * Gets the best available floor price from markets
 * @param {string} collectionName 
 * @returns {Promise<{price: number, source: string}|null>}
 */
async function getBestFloor(collectionName) {
  // 1. Check Cache
  const now = Date.now();
  const cached = floorCache.data[collectionName];
  
  if (cached && (now - cached.timestamp < floorCache.ttl)) {
    return { price: cached.price, source: cached.source };
  }

  // 2. Try TONNEL (Primary)
  let floor = await getTonnelFloor(collectionName);
  let source = 'tonnel';

  // 3. Try Portals (Fallback)
  if (floor === null) {
    floor = await getPortalsFloor(collectionName);
    source = 'portals';
  }

  // 4. Return result or null
  if (floor !== null) {
    // Update Cache
    floorCache.data[collectionName] = {
      price: floor,
      source: source,
      timestamp: now
    };
    return { price: floor, source: source };
  }

  return null;
}

module.exports = { getBestFloor };