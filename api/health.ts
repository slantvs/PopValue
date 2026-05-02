import { jsonResponse, optionsResponse } from '../server/http.js';

export default {
  fetch(request: Request) {
    if (request.method === 'OPTIONS') return optionsResponse();
    if (request.method !== 'GET') return jsonResponse({ error: 'Method not allowed' }, 405);
    return jsonResponse({ ok: true, service: 'popvalue-api' });
  }
};
