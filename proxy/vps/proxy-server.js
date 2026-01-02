const express = require('express');
const axios = require('axios');
const NodeCache = require('node-cache');

const app = express();
const cache = new NodeCache({ stdTTL: 3600 }); // 60 minutes
const PORT = process.env.PORT || 3000;

app.get('/floor', async (req, res) => {
  const collection = req.query.collection;
  if (!collection) {
    return res.status(400).json({ ok: false, error: 'Missing collection param' });
  }

  const cacheKey = `floor_${collection}`;
  const cached = cache.get(cacheKey);
  if (cached) {
    return res.json({ ...cached, cached: true });
  }

  const tonnelUrl = 'https://gifts2.tonnel.network/api/pageGifts';
  const payload = {
    page: 1,
    limit: 50,
    sort: { price: 1 },
    filter: { search: collection }
  };

  let attempts = 0;
  const maxAttempts = 3;
  let floorTon = null;
  let fetchError = null;

  while (attempts < maxAttempts) {
    try {
      const response = await axios.post(tonnelUrl, payload, {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Referer': 'https://tonnel.network/',
          'Origin': 'https://tonnel.network'
        },
        timeout: 8000
      });

      const data = response.data;
      const items = data.docs || data.items || (Array.isArray(data) ? data : []);

      if (items && items.length > 0) {
        const validPrices = items
          .filter(item => {
            const name = item.name || item.giftName || item.title || item.collection || item.gift || "";
            return name.toLowerCase().includes(collection.toLowerCase());
          })
          .map(item => {
            let price = item.price || item.priceTon || item.ton || item.amount || item.cost || 0;
            if (typeof price === 'string') price = parseFloat(price);
            if (price > 1000000) price = price / 1000000000;
            return price;
          })
          .filter(p => p > 0);

        if (validPrices.length > 0) {
          floorTon = Math.min(...validPrices);
        }
      }
      
      fetchError = null;
      break;

    } catch (e) {
      fetchError = e.message;
      attempts++;
      if (attempts < maxAttempts) {
        const delay = 300 * Math.pow(3, attempts);
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }

  const result = {
    ok: !fetchError,
    collection,
    floorTon,
    source: 'tonnel',
    cached: false,
    error: fetchError
  };

  if (!fetchError) {
    cache.set(cacheKey, result);
  }

  res.json(result);
});

app.listen(PORT, () => {
  console.log(`Proxy server running on port ${PORT}`);
});