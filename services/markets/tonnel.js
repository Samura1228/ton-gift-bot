const httpClient = require('../httpClient');
const tonnelSession = require('../tonnelSession');

const API_URL = 'https://gifts2.tonnel.network/api/pageGifts';

async function fetchFloorFromTonnel(collectionName) {
  let session = await tonnelSession.getSession();
  
  // Retry logic variables
  let attempts = 0;
  const maxAttempts = 3;

  while (attempts < maxAttempts) {
    try {
      // Construct payload variants
      // We try the most likely one first. If it returns empty, we might try others if we implemented that logic.
      // For now, we stick to a robust standard payload.
      const payload = {
        page: 1,
        limit: 50,
        sort: { price: 1 },
        filter: {
          // Try generic search first
          search: collectionName
        }
      };

      const response = await httpClient.post(API_URL, payload, {
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': session.userAgent,
          'Cookie': session.cookieHeader,
          'Origin': 'https://gifts2.tonnel.network',
          'Referer': 'https://gifts2.tonnel.network/'
        }
      });

      const data = response.data;
      const items = data.docs || data.items || (Array.isArray(data) ? data : []);

      if (!items || items.length === 0) {
        // Could try fallback payload here if needed, e.g. { filter: { giftName: ... } }
        return null;
      }

      // Filter and extract prices
      const validPrices = items
        .filter(item => {
          const name = item.name || item.giftName || "";
          return name.toLowerCase().includes(collectionName.toLowerCase());
        })
        .map(item => {
          let price = item.price || item.amount || item.ton || item.priceTon || 0;
          if (typeof price === 'string') price = parseFloat(price);
          // Heuristic for nanoTON
          if (price > 1000000) price = price / 1000000000;
          return price;
        })
        .filter(p => p > 0);

      if (validPrices.length === 0) return null;

      return Math.min(...validPrices);

    } catch (error) {
      if (error.response && error.response.status === 403) {
        console.log(`TONNEL 403 Forbidden (Attempt ${attempts + 1}). Refreshing session...`);
        await tonnelSession.refresh();
        session = await tonnelSession.getSession();
        attempts++;
        // Exponential backoff
        await new Promise(r => setTimeout(r, 300 * Math.pow(2, attempts)));
        continue;
      }
      
      console.error(`TONNEL API error for ${collectionName}:`, error.message);
      return null;
    }
  }
  
  return null;
}

module.exports = { fetchFloorFromTonnel };