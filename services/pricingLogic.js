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
  // Calculate bonus regardless of floor price
  let totalBonus = 0;
  for (const attr of attributes) {
    const rarityDecimal = attr.rarity > 1 ? attr.rarity / 100 : attr.rarity;
    totalBonus += rarityBonus(rarityDecimal);
  }
  if (totalBonus > 0.6) totalBonus = 0.6;

  // Round to 2 decimal places
  const round = (num) => Math.round(num * 100) / 100;

  if (!floorPrice || floorPrice <= 0) {
    // Return nulls if no market data, but keep bonus info
    return {
      floor: 0,
      fast: 0,
      market: 0,
      max: 0,
      bonusPercent: round(totalBonus * 100),
      error: "Market data unavailable"
    };
  }

  // Base Price includes Rarity Bonus
  const basePrice = floorPrice * (1 + totalBonus);
  
  let fast = basePrice * 0.95;
  let market = basePrice * 1.02;
  let max = basePrice * 1.15;

  const priceResult = {
    floor: round(floorPrice),
    fast: round(fast),
    market: round(market),
    max: round(max),
    bonusPercent: round(totalBonus * 100)
  };

  console.log("FINAL PRICE RESULT:", priceResult);
  return priceResult;
}

module.exports = { estimatePrice };