/**
 * Calculates rarity bonus based on percentage (0.0-1.0 scale)
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
 * Estimates price range based on floor price and attributes
 * @param {Object} params
 * @param {number} params.floorPrice - Collection floor price in TON
 * @param {Array<{name: string, rarity: number}>} params.attributes - List of attributes with rarity
 * @returns {Object} Price estimation object
 */
function estimatePrice({ floorPrice, attributes }) {
  if (!floorPrice || floorPrice <= 0) {
    throw new Error("Market data temporarily unavailable. Unable to determine collection floor.");
  }

  let totalBonus = 0;
  for (const attr of attributes) {
    // Normalize rarity to 0.0-1.0 scale if it's in 0-100 scale
    const rarityDecimal = attr.rarity > 1 ? attr.rarity / 100 : attr.rarity;
    totalBonus += rarityBonus(rarityDecimal);
  }

  // Cap total bonus at 0.6
  if (totalBonus > 0.6) totalBonus = 0.6;

  const basePrice = floorPrice * (1 + totalBonus);
  const minPrice = floorPrice * 0.9;
  const maxCap = floorPrice * 3.0;

  let fast = basePrice * 0.95;
  if (fast < minPrice) fast = minPrice;

  let market = basePrice;
  
  let max = basePrice * 1.2;
  if (max > maxCap) max = maxCap;

  // Round to 2 decimal places
  const round = (num) => Math.round(num * 100) / 100;

  const priceResult = {
    fast: round(fast),
    market: round(market),
    max: round(max),
    bonusPercent: round(totalBonus * 100)
  };

  console.log("FINAL PRICE RESULT:", priceResult);
  return priceResult;
}

module.exports = { estimatePrice };