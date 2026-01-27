const axios = require('axios');
const cache = require('./cache');
let puppeteer;
try {
  puppeteer = require('puppeteer');
} catch (e) {}

const PROXY_URL = process.env.MARKET_PROXY_URL;
const TON_API_KEY = process.env.TON_API_KEY;
const TON_API_URL = 'https://tonapi.io/v2';

async function getCollectionFloorTon(collectionName, modelName, nftAddress) {
  const cacheKey = `${collectionName}:${modelName || ''}:${nftAddress || ''}`;
  
  // 1. Check Cache
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  let floor = null;

  // 2. Try TonAPI (Direct, Reliable)
  if (TON_API_KEY) {
    try {
      console.log(`Checking TonAPI... Collection: "${collectionName}", Model: "${modelName}", Address: "${nftAddress}"`);
      
      // Strategy 0: If we have the NFT Address, look it up directly!
      if (nftAddress) {
        try {
          const nftRes = await axios.get(`${TON_API_URL}/nfts/${nftAddress}`, {
            headers: { 'Authorization': `Bearer ${TON_API_KEY}` }
          });
          
          const nftData = nftRes.data;
          if (nftData.collection && nftData.collection.address) {
            // Get collection details (floor price)
            const collectionRes = await axios.get(`${TON_API_URL}/nfts/collections/${nftData.collection.address}`, {
              headers: { 'Authorization': `Bearer ${TON_API_KEY}` }
            });
            
            if (collectionRes.data.floor_price) {
               floor = parseInt(collectionRes.data.floor_price) / 1000000000;
            }
            
            // If we have a model name, try to find specific floor for that model
            if (modelName) {
               const specificFloor = await fetchItemsAndFilter(nftData.collection.address, modelName);
               if (specificFloor) floor = specificFloor;
            }
          }
        } catch (e) {
          console.error("NFT Address lookup failed:", e.message);
        }
      }

      // Helper to search and get floor
      const searchAndGetFloor = async (query, filterModel) => {
        if (!query) return null;
        const searchRes = await axios.get(`${TON_API_URL}/nfts/collections/search`, {
          params: { name: query },
          headers: { 'Authorization': `Bearer ${TON_API_KEY}` }
        });

        const collections = searchRes.data.nft_collections || [];
        const match = collections.find(c => c.name.toLowerCase().includes(query.toLowerCase()));

        if (match) {
          let collectionFloor = null;
          try {
             const collectionRes = await axios.get(`${TON_API_URL}/nfts/collections/${match.address}`, {
               headers: { 'Authorization': `Bearer ${TON_API_KEY}` }
             });
             if (collectionRes.data.floor_price) {
               collectionFloor = parseInt(collectionRes.data.floor_price) / 1000000000;
             }
          } catch (e) {}
          
          if (filterModel) {
             const filteredFloor = await fetchItemsAndFilter(match.address, filterModel);
             if (filteredFloor) return filteredFloor;
          }
          return collectionFloor;
        }
        return null;
      };

      // Helper to fetch items and filter by model
      const fetchItemsAndFilter = async (collectionAddress, filterModel) => {
         try {
           const itemsRes = await axios.get(`${TON_API_URL}/nfts/collections/${collectionAddress}/items`, {
             params: { limit: 100 }, 
             headers: { 'Authorization': `Bearer ${TON_API_KEY}` }
           });
           
           const items = itemsRes.data.nft_items || [];
           const matchingItems = items.filter(item => {
             const attrs = item.metadata?.attributes || [];
             return attrs.some(a => 
               (a.trait_type === 'Model' || a.key === 'Model') && 
               a.value.toLowerCase() === filterModel.toLowerCase()
             );
           });

           if (matchingItems.length > 0) {
             const prices = matchingItems
               .filter(i => i.sale)
               .map(i => parseInt(i.sale.price.value) / 1000000000)
               .filter(p => p > 0);
             
             if (prices.length > 0) return Math.min(...prices);
           }
         } catch (e) {}
         return null;
      };

      if (!floor) floor = await searchAndGetFloor(collectionName, modelName);
      if (!floor && modelName) floor = await searchAndGetFloor("Telegram Gifts", modelName);

    } catch (e) {
      console.error('TonAPI check failed:', e.message);
    }
  }

  // 3. Try Proxy (TONNEL/GetGems)
  if (!floor && PROXY_URL) {
    try {
      let response = await axios.get(`${PROXY_URL}/floor`, {
        params: { collection: collectionName },
        timeout: 15000
      });
      if (response.data.ok && response.data.floorTon !== null) {
        floor = response.data.floorTon;
      }
    } catch (error) {
      console.error(`Proxy fetch error:`, error.message);
    }
  }

  // 4. LAST RESORT: Puppeteer Scraping of GetGems
  if (!floor && puppeteer && modelName) {
    try {
      console.log(`Attempting Puppeteer scrape for ${modelName}...`);
      const browser = await puppeteer.launch({
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
      const page = await browser.newPage();
      
      // Search specifically for Telegram Gifts + Model to avoid random matches
      const searchQuery = `Telegram Gifts ${modelName}`;
      await page.goto(`https://getgems.io/search?q=${encodeURIComponent(searchQuery)}`, { waitUntil: 'networkidle2', timeout: 30000 });
      
      try {
        await page.waitForSelector('div[class*="Price"]', { timeout: 5000 });
        const priceText = await page.evaluate(() => {
          const priceEl = document.querySelector('div[class*="Price"]');
          return priceEl ? priceEl.textContent : null;
        });
        
        if (priceText) {
          const p = parseFloat(priceText.replace(/[^0-9.]/g, ''));
          // Sanity check: Ignore crazy high prices (likely wrong item)
          if (p > 0 && p < 10000) {
            floor = p;
            console.log(`Puppeteer found price: ${floor}`);
          }
        }
      } catch (e) {}
      
      await browser.close();
    } catch (e) {
      console.error("Puppeteer market scrape failed:", e.message);
    }
  }

  if (floor !== null) {
    cache.set(cacheKey, floor);
    return floor;
  }

  return null;
}

module.exports = { getCollectionFloorTon };