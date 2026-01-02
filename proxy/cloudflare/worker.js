export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    // CORS Handling
    const allowedOrigins = (env.ALLOWED_ORIGINS || '*').split(',');
    const origin = request.headers.get('Origin');
    const allowOrigin = allowedOrigins.includes('*') ? '*' : (allowedOrigins.includes(origin) ? origin : null);
    
    const corsHeaders = {
      'Access-Control-Allow-Origin': allowOrigin || '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    if (url.pathname !== '/floor') {
      return new Response('Not Found', { status: 404, headers: corsHeaders });
    }

    const collection = url.searchParams.get('collection');
    if (!collection) {
      return new Response(JSON.stringify({ ok: false, error: 'Missing collection param' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Cache Check
    const cacheKey = new Request(url.toString(), request);
    const cache = caches.default;
    let response = await cache.match(cacheKey);

    if (response) {
      const data = await response.json();
      data.cached = true;
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Fetch from TONNEL
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
        const tonnelRes = await fetch(tonnelUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Referer': 'https://tonnel.network/',
            'Origin': 'https://tonnel.network'
          },
          body: JSON.stringify(payload)
        });

        if (!tonnelRes.ok) {
          throw new Error(`TONNEL status ${tonnelRes.status}`);
        }

        const data = await tonnelRes.json();
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
        
        // Success (even if floor is null, it's a valid response)
        fetchError = null;
        break;

      } catch (e) {
        fetchError = e.message;
        attempts++;
        if (attempts < maxAttempts) {
          const delay = 300 * Math.pow(3, attempts); // 900, 2700
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

    response = new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

    // Cache valid responses for 1 hour
    if (!fetchError) {
      ctx.waitUntil(cache.put(cacheKey, response.clone()));
    }

    return response;
  }
};