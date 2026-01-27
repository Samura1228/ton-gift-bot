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
        
        // floor_price is in nanoTON? No, usually raw.
        // TonAPI docs say floor_price is number.
        // Let's check if it exists.
        // Actually, TonAPI might not return floor_price in collection details directly?
        // It does!
        
        // Wait, TonAPI v2 might not have floor_price in getCollection.
        // Let's assume it does or we can fetch items.
        // Actually, let's stick to the Proxy if TonAPI fails or doesn't have floor.
        
        // Alternative: Get items and sort by price.
        const itemsRes = await axios.get(`${TON_API_URL}/nfts/collections/${match.address}/items`, {
          params: { limit: 20, offset: 0 }, // Can we sort?
          headers: { 'Authorization': `Bearer ${TON_API_KEY}` }
        });
        
        // TonAPI doesn't support sorting items by price easily in this endpoint.
        // But GetGems does.
      }
    } catch (e) {
      console.error('TonAPI check failed:', e.message);
    }
  }

  // 3. Try Proxy (TONNEL/GetGems)
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