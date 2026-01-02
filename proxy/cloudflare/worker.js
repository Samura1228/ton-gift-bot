export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    // CORS Handling
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    if (url.pathname !== '/floor') {
      return new Response('Not Found', { status: 404, headers: corsHeaders });
    }

    const collectionRaw = url.searchParams.get('collection');
    if (!collectionRaw) {
      return new Response(JSON.stringify({ ok: false, error: 'Missing collection param' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Normalize collection name
    const collection = collectionRaw.trim().replace(/\s+/g, ' ').toLowerCase();

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

    // TONNEL Request Configuration
    const tonnelUrl = 'https://gifts2.tonnel.network/api/pageGifts';
    const headers = {
      'Content-Type': 'application/json',
      'Accept': '*/*',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Origin': 'https://tonnel-gift.vercel.app',
      'Referer': 'https://tonnel-gift.vercel.app/',
      'Accept-Language': 'en-US,en;q=0.9'
    };

    // Helper to make request with specific filter
    async function fetchTonnel(filterObj) {
      const body = {
        page: 1,
        limit: 50,
        sort: JSON.stringify({ "price": 1, "gift_id": 1 }),
        filter: JSON.stringify(filterObj),
        ref: 0,
        price_range: null,
        user_auth: ""
      };

      const res = await fetch(tonnelUrl, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(body)
      });

      if (!res.ok) {
        throw new Error(`TONNEL status ${res.status}`);
      }

      const json = await res.json();
      // Detect listings array
      return json.data || json.items || json.gifts || json.result || [];
    }

    let floorTon = null;
    let fetchError = null;
    let attempts = 0;
    const maxAttempts = 3;

    // Base filter always included
    const baseFilter = {
      asset: "TON",
      refunded: false
    };

    // Filter strategies to try in order
    const strategies = [
      { ...baseFilter, gift_name: collection }, // 1. gift_name
      { ...baseFilter, giftName: collection },  // 2. giftName
      { ...baseFilter, name: collection },      // 3. name
      { ...baseFilter }                         // 4. No name filter (client-side match)
    ];

    // Retry loop for network errors (403/429/5xx)
    // Logic loop for strategies is inside
    
    outerLoop:
    while (attempts < maxAttempts) {
      try {
        // Try strategies sequentially until floor found
        for (const filterStrategy of strategies) {
          const items = await fetchTonnel(filterStrategy);
          
          if (items && items.length > 0) {
            // Extract and filter prices
            const validPrices = items
              .filter(item => {
                // If we used a specific name filter, assume API filtered correctly.
                // If we used base filter (strategy 4), we MUST match client-side.
                // To be safe, always double-check if name matches loosely.
                
                // If strategy has specific name key, we trust API mostly, but let's be safe.
                // If strategy is baseFilter, we MUST match.
                
                const name = (item.gift_name || item.giftName || item.name || item.gift?.name || "").toLowerCase().trim();
                
                // Check if name contains collection (loose match) or equals
                return name.includes(collection);
              })
              .map(item => {
                let price = item.price || item.priceTon || item.price_ton || item.amount || 0;
                if (typeof price === 'string') price = parseFloat(price);
                // Heuristic for nanoTON
                if (price > 1000000) price = price / 1000000000;
                return price;
              })
              .filter(p => p > 0);

            if (validPrices.length > 0) {
              floorTon = Math.min(...validPrices);
              fetchError = null;
              break outerLoop; // Found floor, exit everything
            }
          }
        }
        
        // If we tried all strategies and found nothing, stop retrying (it's not a network error, just no data)
        fetchError = null; // Not an error, just empty
        break;

      } catch (e) {
        // Only retry on network/server errors
        const isRetryable = e.message.includes('403') || e.message.includes('429') || e.message.includes('5');
        
        if (!isRetryable) {
          fetchError = e.message; // 400 Bad Request etc.
          break;
        }

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
      collection: collectionRaw, // Return original name
      floorTon,
      source: 'tonnel',
      cached: false,
      error: fetchError
    };

    response = new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

    // Cache valid responses (even if floor is null, as long as no error)
    if (!fetchError) {
      ctx.waitUntil(cache.put(cacheKey, response.clone()));
    }

    return response;
  }
};