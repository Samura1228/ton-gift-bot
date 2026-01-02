const puppeteer = require('puppeteer');

const TONNEL_BASE_URL = 'https://tonnel.network/';
const TONNEL_API_URL = 'https://gifts2.tonnel.network/api/pageGifts';

/**
 * Fetches floor price from TONNEL using Puppeteer context
 * @param {string} collectionName 
 * @returns {Promise<number|null>} Floor price in TON or null
 */
async function getTonnelFloor(collectionName) {
  let browser = null;
  try {
    browser = await puppeteer.launch({
      headless: "new",
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    
    // Open base URL to establish context/cookies if needed
    await page.goto(TONNEL_BASE_URL, { waitUntil: 'domcontentloaded', timeout: 15000 });

    // Execute fetch inside the browser context
    const floorPrice = await page.evaluate(async (apiUrl, name) => {
      try {
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            page: 1,
            limit: 50,
            sort: { price: 1 }, // Ascending
            filter: {
              // Try generic search/filter
              search: name
            }
          })
        });

        if (!response.ok) return null;

        const data = await response.json();
        const items = data.docs || data.items || (Array.isArray(data) ? data : []);

        if (!items || items.length === 0) return null;

        // Filter and extract prices
        const validPrices = items
          .filter(item => {
            const itemName = item.name || item.giftName || "";
            return itemName.toLowerCase().includes(name.toLowerCase());
          })
          .map(item => {
            let price = item.price || item.amount || 0;
            if (typeof price === 'string') price = parseFloat(price);
            // Handle nanoTON
            if (price > 1000000) price = price / 1000000000;
            return price;
          })
          .filter(p => p > 0);

        if (validPrices.length === 0) return null;

        return Math.min(...validPrices);
      } catch (e) {
        return null;
      }
    }, TONNEL_API_URL, collectionName);

    return floorPrice;

  } catch (error) {
    console.error(`TONNEL fetch error for ${collectionName}:`, error.message);
    return null;
  } finally {
    if (browser) await browser.close();
  }
}

module.exports = { getTonnelFloor };