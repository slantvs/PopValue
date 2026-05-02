import { searchEbayMarket, type EbaySearchRequest } from '../../server/ebay.js';
import { jsonResponse, optionsResponse } from '../../server/http.js';

export default {
  async fetch(request: Request) {
    if (request.method === 'OPTIONS') return optionsResponse();
    if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);

    try {
      const body = (await request.json()) as unknown;
      const result = await searchEbayMarket((typeof body === 'object' && body ? body : {}) as EbaySearchRequest);
      return jsonResponse(result.payload, result.status);
    } catch {
      return jsonResponse({ error: 'Invalid JSON body' }, 400);
    }
  }
};
