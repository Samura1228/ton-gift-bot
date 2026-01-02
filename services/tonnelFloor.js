const axios = require('axios');

// Cache storage
const floorCache = {
  data: {},
  ttl: 60 * 60 * 1000 // 60 minutes in milliseconds
};

const TONNEL_API_URL = 'https://gifts2.tonnel.network/api/pageGifts';

/**
 * Fetches the floor price for a collection from TONNEL API
 * @param {string} collectionName 
 * @returns {Promise<number|null>} Floor price in TON or null
 */
async function getCollectionFloorTon(collectionName) {
  // 1. Check Cache
  const now = Date.now();
  const cached = floorCache.data[collectionName];
  
  if (cached && (now - cached.timestamp < floorCache.ttl)) {
    return cached.price;
  }

  try {
    // 2. Fetch from API
    // Note: Payload structure is inferred from "example logic". 
    // Adjust if specific API documentation is available.
    const payload = {
      page: 1,
      limit: 50,
      sort: { price: 1 }, // Ascending price
      filter: {
        // Try to match the collection name. 
        // The API might expect 'name', 'giftName', or 'search'.
        // We'll try a generic filter or search if possible.
        search: collectionName 
      }
    };

    const response = await axios.post(TONNEL_API_URL, payload, {
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (compatible; TelegramBot/1.0)'
      },
      timeout: 10000
    });

    const data = response.data;
    
    // 3. Parse Response
    // Expecting data.docs or data.items or data directly
    const items = data.docs || data.items || (Array.isArray(data) ? data : []);
    
    if (!items || items.length === 0) {
      return null;
    }

    // 4. Extract and Find Min Price
    // Filter for active listings and matching name (if API didn't filter perfectly)
    const validPrices = items
      .filter(item => {
        // Check if item name matches collection (loose match)
        const itemName = item.name || item.giftName || "";
        return itemName.toLowerCase().includes(collectionName.toLowerCase());
      })
      .map(item => {
        // Extract price. API might return 'price', 'amount', 'cost'
        // And it might be in nanoTON or TON. 
        // Usually APIs return raw numbers. If it's > 1000000, assume nanoTON.
        let price = item.price || item.amount || 0;
        if (typeof price === 'string') price = parseFloat(price);
        
        // Heuristic for nanoTON vs TON
        if (price > 1000000) {
          return price / 1000000000;
        }
        return price;
      })
      .filter(p => p > 0);

    if (validPrices.length === 0) {
      return null;
    }

    const floorPrice = Math.min(...validPrices);

    // 5. Update Cache
    floorCache.data[collectionName] = {
      price: floorPrice,
      timestamp: now
    };

    return floorPrice;

  } catch (error) {
    console.error(`Error fetching TONNEL floor for ${collectionName}:`, error.message);
    return null;
  }
}

module.exports = { getCollectionFloorTon };