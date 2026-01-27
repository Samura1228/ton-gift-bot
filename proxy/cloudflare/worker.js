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

    // Cache Check - VERSION 3 TO CLEAR OLD CACHE
    const cacheKey = new Request(url.toString() + "&v=3", request);
    const cache = caches.default;
    let response = await cache.match(cacheKey);

    if (response) {
      const data = await response.json();
      data.cached = true;
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    let floorTon = null;
    let fetchError = null;
    let debugInfo = [];

    // Helper to try finding floor
    async function tryFindFloor(searchTerm) {
      // 1. Try TONNEL
      try {
        const f = await fetchTonnelFloor(searchTerm);
        if (f !== null) return { floor: f, source: 'tonnel' };
      } catch (e) { debugInfo.push(`Tonnel error for ${searchTerm}: ${e.message}`); }

      // 2. Try GetGems
      try {
        const f = await fetchGetGemsFloor(searchTerm);
        if (f !== null) return { floor: f, source: 'getgems' };
      } catch (e) { debugInfo.push(`GetGems error for ${searchTerm}: ${e.message}`); }

      return null;
    }

    // Strategy 1: Exact Name
    let result = await tryFindFloor(collection);

    // Strategy 2: Fuzzy Name (First word only, e.g. "Caramel" for "Caramel Fest")
    if (!result && collection.includes(' ')) {
      const firstWord = collection.split(' ')[0];
      if (firstWord.length > 3) { // Only if first word is significant
        debugInfo.push(`Trying fuzzy search: ${firstWord}`);
        result = await tryFindFloor(firstWord);
      }
    }

    if (result) {
      floorTon = result.floor;
    } else {
      fetchError = "No listings found. Debug: " + debugInfo.join('; ');
    }

    const responseData = {
      ok: floorTon !== null,
      collection: collectionRaw,
      floorTon,
      source: result ? result.source : null,
      cached: false,
      error: floorTon === null ? fetchError : null
    };

    response = new Response(JSON.stringify(responseData), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

    if (floorTon !== null) {
      ctx.waitUntil(cache.put(cacheKey, response.clone()));
    }

    return response;
  }
};

// --- TONNEL IMPLEMENTATION ---
async function fetchTonnelFloor(collection) {
  const tonnelUrl = 'https://gifts2.tonnel.network/api/pageGifts';
  const headers = {
    'Content-Type': 'application/json',
    'Accept': '*/*',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Origin': 'https://tonnel-gift.vercel.app',
    'Referer': 'https://tonnel-gift.vercel.app/',
    'Accept-Language': 'en-US,en;q=0.9'
  };

  const baseFilter = { asset: "TON", refunded: false };
  const strategies = [
    { ...baseFilter, gift_name: collection },
    { ...baseFilter, giftName: collection },
    { ...baseFilter, name: collection },
    { ...baseFilter }
  ];

  for (const filterStrategy of strategies) {
    try {
      const body = {
        page: 1,
        limit: 50,
        sort: JSON.stringify({ "price": 1, "gift_id": 1 }),
        filter: JSON.stringify(filterStrategy),
        ref: 0,
        price_range: null,
        user_auth: ""
      };

      const res = await fetch(tonnelUrl, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(body)
      });

      if (!res.ok) continue;

      const json = await res.json();
      const items = json.data || json.items || json.gifts || json.result || [];

      if (items.length > 0) {
        const validPrices = items
          .filter(item => {
            const name = (item.gift_name || item.giftName || item.name || item.gift?.name || "").toLowerCase().trim();
            // Loose match: if we searched for "Caramel", we accept "Caramel Fest"
            return name.includes(collection);
          })
          .map(item => {
            let price = item.price || item.priceTon || item.price_ton || item.amount || 0;
            if (typeof price === 'string') price = parseFloat(price);
            if (price > 1000000) price = price / 1000000000;
            return price;
          })
          .filter(p => p > 0);

        if (validPrices.length > 0) {
          return Math.min(...validPrices);
        }
      }
    } catch (e) {
      continue;
    }
  }
  return null;
}

// --- GETGEMS IMPLEMENTATION ---
async function fetchGetGemsFloor(collection) {
  const url = 'https://api.getgems.io/graphql';
  
  // Try two different queries
  const queries = [
    `query NftSearch($query: String!) {
      alphaNftItemSearch(query: $query, first: 30) {
        edges { node { name sale { price } } }
      }
    }`,
    `query NftSearch($query: String!) {
      nftSearch(query: $query) {
        items { name sale { price } }
      }
    }`
  ];

  for (const query of queries) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        },
        body: JSON.stringify({
          operationName: "NftSearch",
          variables: { query: collection },
          query: query
        })
      });

      if (!res.ok) continue;

      const json = await res.json();
      
      // Extract items from either structure
      let items = [];
      if (json.data?.alphaNftItemSearch?.edges) {
        items = json.data.alphaNftItemSearch.edges.map(e => e.node);
      } else if (json.data?.nftSearch?.items) {
        items = json.data.nftSearch.items;
      }

      const validPrices = items
        .filter(node => node.sale && node.name.toLowerCase().includes(collection))
        .map(node => {
          let price = parseFloat(node.sale.price);
          if (price > 1000000) price = price / 1000000000;
          return price;
        })
        .filter(p => p > 0);

      if (validPrices.length > 0) {
        return Math.min(...validPrices);
      }
    } catch (e) {
      console.error("GetGems fetch failed", e);
    }
  }
  return null;
}