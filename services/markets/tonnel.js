const axios = require('axios');
const https = require('https');

const API_URL = 'https://gifts2.tonnel.network/api/pageGifts';
const TIMEOUT = parseInt(process.env.MARKET_TIMEOUT_MS) || 8000;
const USER_AGENT = process.env.MARKET_USER_AGENT || 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// Configure Proxy if available
let httpsAgent;
if (process.env.MARKET_HTTP_PROXY) {
  const { HttpsProxyAgent } = require('https-proxy-agent');
  httpsAgent = new HttpsProxyAgent(process.env.MARKET_HTTP_PROXY);
} else {
  httpsAgent = new https.Agent({ keepAlive: true });
}

async function getFloorTon({ collectionName }) {
  let attempts = 0;
  const maxAttempts = 2;

  while (attempts < maxAttempts) {
    try {
      const payload = {
        page: 1,
        limit: 50,
        sort: { price: 1 },
        filter: {
          search: collectionName
        }
      };

      const response = await axios.post(API_URL, payload, {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json, text/plain, */*',
          'Accept-Language': 'en-US,en;q=0.9',
          'User-Agent': USER_AGENT,
          'Origin': 'https://market.tonnel.network',
          'Referer': 'https://market.tonnel.network/'
        },
        timeout: TIMEOUT,
        httpsAgent: httpsAgent
      });

      const data = response.data;
      const items = data.docs || data.items || (Array.isArray(data) ? data : []);

      if (!items || items.length === 0) {
        return null;
      }

      const validPrices = items
        .filter(item => {
          const name = item.name || item.giftName || "";
          // Best-effort exact match or case-insensitive check
          return name.toLowerCase() === collectionName.toLowerCase() || 
                 name.toLowerCase().includes(collectionName.toLowerCase());
        })
        .map(item => {
          let price = item.price || item.amount || 0;
          if (typeof price === 'string') price = parseFloat(price);
          if (price > 1000000) price = price / 1000000000;
          return price;
        })
        .filter(p => p > 0);

      if (validPrices.length === 0) return null;

      return Math.min(...validPrices);

    } catch (error) {
      attempts++;
      
      if (error.response && error.response.status === 403) {
        console.warn(`TONNEL 403 Forbidden (Attempt ${attempts}). Blocked environment.`);
        if (attempts >= maxAttempts) {
          // Return specific error or null to indicate block
          return 'BLOCKED'; 
        }
        // Jitter + Exponential Backoff
        const delay = 300 * Math.pow(2, attempts) + Math.random() * 100;
        await new Promise(r => setTimeout(r, delay));
        continue;
      }
      
      console.error(`TONNEL API error for ${collectionName}:`, error.message);
      return null;
    }
  }
  return null;
}

module.exports = { getFloorTon };