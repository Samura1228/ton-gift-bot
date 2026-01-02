function rarityBonus(rarity) {
  if (rarity > 0.05) return 0;
  if (rarity > 0.02) return 0.05;
  if (rarity > 0.01) return 0.10;
  if (rarity > 0.005) return 0.15;
  return 0.25;
}

function estimatePrice({ floorPrice, attributes }) {
  if (!floorPrice || floorPrice <= 0) {
    throw new Error("Market data temporarily unavailable. Unable to determine collection floor.");
  }

  let totalBonus = 0;
  for (const attr of attributes) {
    const rarityDecimal = attr.rarity > 1 ? attr.rarity / 100 : attr.rarity;
    totalBonus += rarityBonus(rarityDecimal);
  }

  if (totalBonus > 0.6) totalBonus = 0.6;

  const basePrice = floorPrice * (1 + totalBonus);
  const minPrice = floorPrice * 0.9;
  const maxCap = floorPrice * 3.0;

  let fast = basePrice * 0.95;
  if (fast < minPrice) fast = minPrice;

  let market = basePrice;
  
  let max = basePrice * 1.2;
  if (max > maxCap) max = maxCap;

  const round = (num) => Math.round(num * 100) / 100;

  return {
    fast: round(fast),
    market: round(market),
    max: round(max),
    bonusPercent: round(totalBonus * 100)
  };
}

module.exports = { estimatePrice };