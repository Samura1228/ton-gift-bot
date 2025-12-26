/**
 * Helper function to calculate rarity bonus based on percentage (0.0-1.0 scale)
 * @param {number} rarity - Rarity percentage as decimal (e.g. 0.05 for 5%)
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
 * Main function to estimate price based on floor price and attributes
 * @param {Object} params
 * @param {number} params.floorPrice - Collection floor price in TON
 * @param {Array<{name: string, rarity: number}>} params.attributes - List of attributes with rarity (0-100 scale or 0-1 scale)
 * @returns {Object} Price estimation object
 */
function estimatePrice({ floorPrice, attributes }) {
  // 1. Validate floor price
  if (!floorPrice || floorPrice <= 0) {
    throw new Error("Недостаточно рыночных данных (floor не найден)");
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
  // Fast sale: slightly below base (e.g., halfway between floor and base, or just 95% of base?)
  // The prompt says "slightly below base". Let's use 0.95 * basePrice, but ensure it's >= minPrice
  let fastPrice = basePrice * 0.9; 
  let marketPrice = basePrice;
  let maxPrice = basePrice * 1.15; // "may sell slowly"

  // 5. Hard price safety limits
  const hardMin = floorPrice * 0.9;
  const hardMax = floorPrice * 3.0;

  // Apply limits
  if (fastPrice < hardMin) fastPrice = hardMin;
  if (marketPrice > hardMax) marketPrice = hardMax;
  if (maxPrice > hardMax) maxPrice = hardMax;
  
  // Ensure logical ordering
  if (fastPrice > marketPrice) fastPrice = marketPrice;
  if (maxPrice < marketPrice) maxPrice = marketPrice;

  // Round to 2 decimal places
  const round = (num) => Math.round(num * 100) / 100;

  return {
    fast: round(fastPrice),
    market: round(marketPrice),
    max: round(maxPrice),
    bonusPercent: round(totalBonus * 100)
  };
}

module.exports = { estimatePrice };