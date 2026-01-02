const cache = require('../cache');
const { fetchFloorFromTonnel } = require('./tonnel');
const { fetchFloorFromPortals } = require('./portals');
const { fetchFloorFromMrkt } = require('./mrkt');

async function getCollectionFloorTon(collectionName) {
  // 1. Check Cache
  const cached = cache.get(collectionName);
  if (cached) return cached;

  let floor = null;
  let source = null;

  // 2. Try TONNEL (Primary)
  floor = await fetchFloorFromTonnel(collectionName);
  if (floor !== null) source = 'TONNEL';

  // 3. Try Portals (Fallback)
  if (floor === null) {
    floor = await fetchFloorFromPortals(collectionName);
    if (floor !== null) source = 'Portals';
  }

  // 4. Try MRKT (Fallback)
  if (floor === null) {
    floor = await fetchFloorFromMrkt(collectionName);
    if (floor !== null) source = 'MRKT';
  }

  // 5. Cache and Return
  if (floor !== null) {
    console.log(`Floor found for ${collectionName}: ${floor} TON (Source: ${source})`);
    cache.set(collectionName, floor);
    return floor;
  }

  console.log(`No floor found for ${collectionName} on any market.`);
  return null;
}

module.exports = { getCollectionFloorTon };