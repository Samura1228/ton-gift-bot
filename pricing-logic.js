const puppeteer = require('puppeteer');
const fs = require('fs');

// Cache storage
const floorCache = {
  data: {},
  ttl: 60 * 60 * 1000 // 60 minutes in milliseconds
};

// DIRECT URL for Telegram Gifts listings
const TONNEL_GIFTS_URL = 'https://tonnel.network/telegram-gifts';

/**
 * Helper function to calculate rarity bonus based on percentage (0.0-1.0 scale)
 * @param {number} rarity - Rarity percentage as decimal
 * @returns {number} Bonus value
 */
function rarityBonus(rarity) {
  if (rarity > 0.05) return 0;
  if (rarity > 0.02) return 0.05;
  if (rarity > 0.01) return 0.10;
  if (rarity > 0.005) return 0.15;
  return 0.25;
}

/**
 * Scrapes TONNEL marketplace for the floor price of a collection
 * @param {string} collectionName 
 * @returns {Promise<number|null>} Floor price in TON or null
 */
async function getFloorPriceFromTonnel(collectionName) {
  let browser = null;
  try {
    browser = await puppeteer.launch({
      headless: "new",
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    
    // DIRECTLY open the Telegram Gifts section
    await page.goto(TONNEL_GIFTS_URL, { waitUntil: 'networkidle2', timeout: 30000 });
    
    // Wait for listing cards or price text to appear
    // Robust waiting strategy: look for common price indicators
    try {
      await page.waitForFunction(
        () => document.body.innerText.includes('TON'),
        { timeout: 8000 }
      );
    } catch (e) {
      console.log("Timeout waiting for 'TON' text, proceeding to scrape anyway...");
    }
    
    // Parse gift listing cards directly from the page
    const listings = await page.evaluate(() => {
      // Strategy: Scan all text nodes for price patterns
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      const items = [];
      let node;
      
      while (node = walker.nextNode()) {
        const text = node.textContent.trim();
        if (!text) continue;
        
        // Look for patterns like "2.45 TON", "2,45 TON"
        // We look for the number immediately preceding "TON"
        if (text.toUpperCase().includes('TON')) {
           // Try to find a number in this node or previous sibling/parent
           const priceMatch = text.match(/(\d+(?:[.,]\d+)?)\s*TON/i);
           if (priceMatch) {
             const price = parseFloat(priceMatch[1].replace(',', '.'));
             
             // Try to find associated text (collection name) by looking up the tree
             // This is heuristic
             let parent = node.parentElement;
             let contextText = "";
             // Gather text from parent block
             while (parent && parent.tagName !== 'BODY' && contextText.length < 200) {
               contextText = parent.innerText + " " + contextText;
               if (parent.className.includes('card') || parent.className.includes('item')) break;
               parent = parent.parentElement;
             }
             
             items.push({
               price: price,
               text: contextText.toLowerCase()
             });
           }
        }
      }
      return items;
    });
    
    console.log(`Extracted ${listings.length} potential prices from TONNEL.`);
    
    // Filter by collection name (loose matching)
    const collectionLower = collectionName.toLowerCase();
    // Split collection name into words for looser matching if exact match fails
    const collectionParts = collectionLower.split(' ').filter(w => w.length > 2);
    
    const validPrices = listings
      .filter(item => {
        if (item.price <= 0) return false;
        // Check if item text contains collection name OR significant parts of it
        if (item.text.includes(collectionLower)) return true;
        // Fallback: check if it contains at least one significant word (e.g. "Elven")
        return collectionParts.some(part => item.text.includes(part));
      })
      .map(item => item.price);
      
    if (validPrices.length === 0) {
      console.log("No matching prices found for collection:", collectionName);
      // Diagnostic screenshot
      await page.screenshot({ path: 'tonnel_debug.png' });
      return null;
    }
    
    // Determine the floor price as the MINIMUM active listing price
    const floor = Math.min(...validPrices);
    console.log(`Found floor price for ${collectionName}: ${floor} TON`);
    return floor;
    
  } catch (error) {
    console.error(`Error scraping TONNEL for ${collectionName}:`, error.message);
    return null;
  } finally {
    if (browser) await browser.close();
  }
}

/**
 * Gets cached floor price or fetches fresh if expired/missing
 * @param {string} collectionName 
 * @returns {Promise<number|null>}
 */
async function getCachedFloorPrice(collectionName) {
  const now = Date.now();
  const cached = floorCache.data[collectionName];
  
  if (cached && (now - cached.timestamp < floorCache.ttl)) {
    return cached.price;
  }
  
  const price = await getFloorPriceFromTonnel(collectionName);
  
  if (price !== null) {
    floorCache.data[collectionName] = {
      price: price,
      timestamp: now
    };
  }
  
  return price;
}

/**
 * Main function to estimate price based on floor price and attributes
 * @param {Object} params
 * @param {number} params.floorPrice - Collection floor price in TON
 * @param {Array<{name: string, rarity: number}>} params.attributes - List of attributes with rarity
 * @returns {Object} Price estimation object
 */
function estimatePrice({ floorPrice, attributes }) {
  // 1. Validate floor price
  if (!floorPrice || floorPrice <= 0) {
    throw new Error("Рыночные данные временно недоступны. Не удалось определить floor коллекции.");
  }

  // 2. Calculate total rarity bonus
  let totalBonus = 0;
  
  for (const attr of attributes) {
    // Normalize rarity to 0.0-1.0 scale if it's in 0-100 scale
    const rarityDecimal = attr.rarity > 1 ? attr.rarity / 100 : attr.rarity;
    totalBonus += rarityBonus(rarityDecimal);
  }

  // 3. Cap total bonus at 0.6
  if (totalBonus > 0.6) {
    totalBonus = 0.6;
  }

  // 4. Calculate base price
  const basePrice = floorPrice * (1 + totalBonus);

  // 5. Calculate price range
  const hardMin = floorPrice * 0.9;
  const hardMax = floorPrice * 3.0;

  let fastPrice = basePrice * 0.95;
  if (fastPrice < hardMin) fastPrice = hardMin;

  let marketPrice = basePrice;
  
  let maxPrice = basePrice * 1.2;
  if (maxPrice > hardMax) maxPrice = hardMax;

  // Round to 2 decimal places
  const round = (num) => Math.round(num * 100) / 100;

  return {
    fast: round(fastPrice),
    market: round(marketPrice),
    max: round(maxPrice),
    bonusPercent: round(totalBonus * 100)
  };
}

module.exports = { 
  estimatePrice, 
  getCachedFloorPrice,
  rarityBonus 
};