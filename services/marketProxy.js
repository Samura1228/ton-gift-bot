const axios = require('axios');
const cache = require('./cache');

const PROXY_URL = process.env.MARKET_PROXY_URL;
const TON_API_KEY = process.env.TON_API_KEY;
const TON_API_URL = 'https://tonapi.io/v2';

async function getCollectionFloorTon(collectionName) {
  // 1. Check Cache
  const cached = cache.get(collectionName);
  if (cached) return cached;

  let floor = null;

  // 2. Try TonAPI (Direct, Reliable)
  if (TON_API_KEY) {
    try {
      console.log(`Checking TonAPI for ${collectionName}...`);
      // Search for collection
      const searchRes = await axios.get(`${TON_API_URL}/nfts/collections/search`, {
        params: { name: collectionName },
        headers: { 'Authorization': `Bearer ${TON_API_KEY}` }
      });

      const collections = searchRes.data.nft_collections || [];
      const match = collections.find(c => c.name.toLowerCase().includes(collectionName.toLowerCase()));

      if (match) {
        // Get collection details (floor price)
        const collectionRes = await axios.get(`${TON_API_URL}/nfts/collections/${match.address}`, {
          headers: { 'Authorization': `Bearer ${TON_API_KEY}` }
        });
        
        // TonAPI returns floor_price in raw format (nanoTON) if available
        // Note: Not all collections have floor_price in the response
        const colData = collectionRes.data;
        if (colData.floor_price) {
           floor = parseInt(colData.floor_price) / 1000000000;
           console.log(`Floor found via TonAPI: ${floor}`);
        }
      }
    } catch (e) {
      console.error('TonAPI check failed:', e.message);
    }
  }

  // 3. Try Proxy (TONNEL/GetGems) if TonAPI failed or didn't have floor
  if (!floor && PROXY_URL) {
    try {
      const response = await axios.get(`${PROXY_URL}/floor`, {
        params: { collection: collectionName },
        timeout: 15000
      });

      const data = response.data;
      if (data && data.ok && data.floorTon !== null) {
        floor = data.floorTon;
        console.log(`Floor found via Proxy: ${floor}`);
      } else {
        console.log(`Proxy failed: ${data.error}`);
      }
    } catch (error) {
      console.error(`Proxy fetch error:`, error.message);
    }
  }

  if (floor !== null) {
    cache.set(collectionName, floor);
    return floor;
  }

  return null;
}

module.exports = { getCollectionFloorTon };