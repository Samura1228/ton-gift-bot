const cache = require('../cache');
const tonnel = require('./tonnel');
const portals = require('./portals');
const mrkt = require('./mrkt');

async function getCollectionFloorTon(collectionName) {
  // 1. Check Cache
  const cached = cache.get(collectionName);
  if (cached) return cached;

  // 2. Check Negative Cache (Blocked)
  if (cache.isBlocked('TONNEL')) {
    console.log('TONNEL is temporarily blocked. Skipping.');
    // Try fallbacks immediately
  } else {
    // 3. Try TONNEL (Primary)
    const floor = await tonnel.getFloorTon({ collectionName });
    
    if (floor === 'BLOCKED') {
      cache.setBlocked('TONNEL');
    } else if (floor !== null) {
      console.log(`Floor found for ${collectionName}: ${floor} TON (Source: TONNEL)`);
      cache.set(collectionName, floor);
      return floor;
    }
  }

  // 4. Try Portals (Fallback)
  let floor = await portals.getFloorTon({ collectionName });
  if (floor !== null) {
    console.log(`Floor found for ${collectionName}: ${floor} TON (Source: Portals)`);
    cache.set(collectionName, floor);
    return floor;
  }

  // 5. Try MRKT (Fallback)
  floor = await mrkt.getFloorTon({ collectionName });
  if (floor !== null) {
    console.log(`Floor found for ${collectionName}: ${floor} TON (Source: MRKT)`);
    cache.set(collectionName, floor);
    return floor;
  }

  console.log(`No floor found for ${collectionName} on any market.`);
  return null;
}

module.exports = { getCollectionFloorTon };