const axios = require('axios');
const cache = require('./cache');

const PROXY_URL = process.env.MARKET_PROXY_URL;
const TON_API_KEY = process.env.TON_API_KEY;
const TON_API_URL = 'https://tonapi.io/v2';

async function getCollectionFloorTon(collectionName, modelName) {
  const cacheKey = `${collectionName}:${modelName || ''}`;
  
  // 1. Check Cache
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  let floor = null;

  // 2. Try TonAPI (Direct, Reliable)
  if (TON_API_KEY) {
    try {
      console.log(`Checking TonAPI for Collection: "${collectionName}", Model: "${modelName}"...`);
      
      // Helper to search and get floor
      const searchAndGetFloor = async (query, filterModel) => {
        if (!query) return null;
        
        const searchRes = await axios.get(`${TON_API_URL}/nfts/collections/search`, {
          params: { name: query },
          headers: { 'Authorization': `Bearer ${TON_API_KEY}` }
        });

        const collections = searchRes.data.nft_collections || [];
        // Find best match
        const match = collections.find(c => c.name.toLowerCase().includes(query.toLowerCase()));

        if (match) {
          console.log(`Found collection: ${match.name} (${match.address})`);
          
          // Strategy A: Get collection floor directly (if available)
          let collectionFloor = null;
          try {
             const collectionRes = await axios.get(`${TON_API_URL}/nfts/collections/${match.address}`, {
               headers: { 'Authorization': `Bearer ${TON_API_KEY}` }
             });
             if (collectionRes.data.floor_price) {
               collectionFloor = parseInt(collectionRes.data.floor_price) / 1000000000;
             }
          } catch (e) {}

          // Strategy B: If we have a specific model to filter by, fetch items and filter
          if (filterModel) {
             try {
               const itemsRes = await axios.get(`${TON_API_URL}/nfts/collections/${match.address}/items`, {
                 params: { limit: 100 }, 
                 headers: { 'Authorization': `Bearer ${TON_API_KEY}` }
               });
               
               const items = itemsRes.data.nft_items || [];
               const matchingItems = items.filter(item => {
                 // Check attributes
                 const attrs = item.metadata?.attributes || [];
                 return attrs.some(a => 
                   (a.trait_type === 'Model' || a.key === 'Model') && 
                   a.value.toLowerCase() === filterModel.toLowerCase()
                 );
               });

               if (matchingItems.length > 0) {
                 // Find cheapest sale
                 const prices = matchingItems
                   .filter(i => i.sale)
                   .map(i => parseInt(i.sale.price.value) / 1000000000)
                   .filter(p => p > 0);
                 
                 if (prices.length > 0) {
                   return Math.min(...prices);
                 }
               }
             } catch (e) {
               console.error("Error filtering items:", e.message);
             }
          }
          
          // Fallback to collection floor if no specific model filtering worked
          return collectionFloor;
        }
        return null;
      };

      // Attempt 1: Try searching for the Collection Name
      floor = await searchAndGetFloor(collectionName, modelName);
      
      // Attempt 2: If failed, try searching for "Telegram Gifts" (Common case)
      if (!floor && modelName) {
         console.log(`Retrying with "Telegram Gifts"...`);
         floor = await searchAndGetFloor("Telegram Gifts", modelName);
      }

      // Attempt 3: If failed, try searching for the Model Name as the collection
      if (!floor && modelName && modelName !== collectionName) {
        console.log(`Retrying with Model Name: "${modelName}"...`);
        floor = await searchAndGetFloor(modelName, null);
      }

    } catch (e) {
      console.error('TonAPI check failed:', e.message);
    }
  }

  // 3. Try Proxy (TONNEL/GetGems) if TonAPI failed
  if (!floor && PROXY_URL) {
    try {
      // Try collection name
      let response = await axios.get(`${PROXY_URL}/floor`, {
        params: { collection: collectionName },
        timeout: 15000
      });

      if (!response.data.ok && modelName) {
         // Try model name
         response = await axios.get(`${PROXY_URL}/floor`, {
            params: { collection: modelName },
            timeout: 15000
         });
      }

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
    cache.set(cacheKey, floor);
    return floor;
  }

  return null;
}

module.exports = { getCollectionFloorTon };