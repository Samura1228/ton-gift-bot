const axios = require('axios');
const cache = require('../cache');

const PROXY_URL = process.env.MARKET_PROXY_URL;

async function getCollectionFloorTon(collectionName) {
  if (!PROXY_URL) {
    console.error('MARKET_PROXY_URL is not defined');
    return null;
  }

  // Check local cache first (double caching is fine)
  const cached = cache.get(collectionName);
  if (cached) return cached;

  try {
    const response = await axios.get(`${PROXY_URL}/floor`, {
      params: { collection: collectionName },
      timeout: 10000
    });

    const data = response.data;

    if (data && data.ok && data.floorTon !== null) {
      console.log(`Floor found via Proxy for ${collectionName}: ${data.floorTon} TON`);
      cache.set(collectionName, data.floorTon);
      return data.floorTon;
    }

    console.log(`Proxy returned no floor for ${collectionName}: ${data.error || 'Unknown error'}`);
    return null;

  } catch (error) {
    console.error(`Proxy fetch error for ${collectionName}:`, error.message);
    return null;
  }
}

module.exports = { getCollectionFloorTon };