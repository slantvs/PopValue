import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import { mockEbayListings, mockSoldListings } from '../src/data/mockData';
import type { EbayListing } from '../src/types';

dotenv.config();

const app = express();
const port = Number(process.env.PORT ?? 8787);

let tokenCache: { token: string; expiresAt: number } | null = null;

app.use(cors());
app.use(express.json({ limit: '2mb' }));

app.get('/api/health', (_request, response) => {
  response.json({ ok: true, service: 'popvalue-api' });
});

app.post('/api/ebay/search', async (request, response) => {
  const { upc, query, limit = 40 } = request.body as { upc?: string; query?: string; limit?: number };
  const messages: string[] = [];

  try {
    const token = await getEbayAccessToken();
    if (!token) {
      return response.json({
        listings: mockEbayListings,
        soldListings: mockSoldListings,
        mode: 'mock',
        messages: ['Missing eBay credentials. Using mock active listings and sold comps.']
      });
    }

    const activeListings = await searchActiveListings({ token, upc, query, limit });
    let soldListings: EbayListing[] = [];

    if (process.env.EBAY_ENABLE_SOLD_LOOKUP === 'true') {
      try {
        soldListings = await searchSoldListings({ token, upc, query, limit: Math.min(limit, 50) });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Sold lookup failed';
        messages.push(`Sold comps unavailable: ${message}`);
      }
    } else {
      messages.push('Sold comps are using mock data. Set EBAY_ENABLE_SOLD_LOOKUP=true after Marketplace Insights access is approved.');
    }

    response.json({
      listings: activeListings.length ? activeListings : mockEbayListings,
      soldListings: soldListings.length ? soldListings : mockSoldListings,
      mode: soldListings.length ? 'live' : 'mixed',
      messages
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown eBay lookup error';
    response.status(502).json({
      listings: mockEbayListings,
      soldListings: mockSoldListings,
      mode: 'mock',
      messages: [`Live eBay lookup failed: ${message}`]
    });
  }
});

async function getEbayAccessToken() {
  if (process.env.EBAY_ACCESS_TOKEN) return process.env.EBAY_ACCESS_TOKEN;
  if (tokenCache && tokenCache.expiresAt > Date.now() + 60_000) return tokenCache.token;

  const clientId = process.env.EBAY_CLIENT_ID;
  const clientSecret = process.env.EBAY_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

  const apiBase = process.env.EBAY_API_BASE_URL ?? 'https://api.ebay.com';
  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    scope: process.env.EBAY_OAUTH_SCOPE ?? 'https://api.ebay.com/oauth/api_scope'
  });

  const tokenResponse = await fetch(`${apiBase}/identity/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body
  });

  if (!tokenResponse.ok) {
    const text = await tokenResponse.text();
    throw new Error(`eBay OAuth returned ${tokenResponse.status}: ${text.slice(0, 240)}`);
  }

  const payload = (await tokenResponse.json()) as { access_token: string; expires_in: number };
  tokenCache = {
    token: payload.access_token,
    expiresAt: Date.now() + payload.expires_in * 1000
  };
  return tokenCache.token;
}

async function searchActiveListings(options: EbaySearchOptions): Promise<EbayListing[]> {
  const apiBase = process.env.EBAY_API_BASE_URL ?? 'https://api.ebay.com';
  const searchParams = buildSearchParams(options);
  searchParams.set('filter', 'buyingOptions:{FIXED_PRICE|AUCTION}');

  const payload = await ebayGet<EbaySearchResponse>(
    `${apiBase}/buy/browse/v1/item_summary/search?${searchParams.toString()}`,
    options.token
  );

  return (payload.itemSummaries ?? []).map((item) => mapActiveItem(item));
}

async function searchSoldListings(options: EbaySearchOptions): Promise<EbayListing[]> {
  const apiBase = process.env.EBAY_API_BASE_URL ?? 'https://api.ebay.com';
  const searchParams = buildSearchParams(options);

  const payload = await ebayGet<EbaySalesResponse>(
    `${apiBase}/buy/marketplace_insights/v1_beta/item_sales/search?${searchParams.toString()}`,
    options.token
  );

  return (payload.itemSales ?? []).map((item) => mapSoldItem(item));
}

function buildSearchParams({ upc, query, limit }: EbaySearchOptions) {
  const searchParams = new URLSearchParams({
    limit: String(Math.min(Math.max(limit, 1), 100))
  });

  if (upc) {
    searchParams.set('gtin', upc);
  } else if (query) {
    searchParams.set('q', query);
  } else {
    searchParams.set('q', 'Funko Pop');
  }

  return searchParams;
}

async function ebayGet<T>(url: string, token: string): Promise<T> {
  const marketplaceId = process.env.EBAY_MARKETPLACE_ID ?? 'EBAY_US';
  const ebayResponse = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      'X-EBAY-C-MARKETPLACE-ID': marketplaceId,
      'Content-Type': 'application/json'
    }
  });

  if (!ebayResponse.ok) {
    const text = await ebayResponse.text();
    throw new Error(`eBay API returned ${ebayResponse.status}: ${text.slice(0, 240)}`);
  }

  return (await ebayResponse.json()) as T;
}

function mapActiveItem(item: EbayItemSummary): EbayListing {
  return {
    id: item.itemId,
    title: item.title,
    price: Number(item.price?.value ?? item.currentBidPrice?.value ?? 0),
    shipping: Number(item.shippingOptions?.[0]?.shippingCost?.value ?? 0),
    condition: item.condition ?? 'Unknown',
    imageUrl: item.image?.imageUrl ?? '',
    url: item.itemWebUrl,
    listingType: item.buyingOptions?.join(', ') ?? 'UNKNOWN',
    source: 'ebay',
    listingStatus: 'active'
  };
}

function mapSoldItem(item: EbaySaleSummary): EbayListing {
  return {
    id: item.itemId,
    title: item.title,
    price: Number(item.price?.value ?? 0),
    shipping: Number(item.shippingCost?.value ?? 0),
    condition: item.condition ?? 'Unknown',
    imageUrl: item.image?.imageUrl ?? '',
    url: item.itemWebUrl,
    listingType: 'SOLD_COMP',
    source: 'ebay',
    listingStatus: 'sold',
    soldAt: item.lastSoldDate
  };
}

interface EbaySearchOptions {
  token: string;
  upc?: string;
  query?: string;
  limit: number;
}

interface EbaySearchResponse {
  itemSummaries?: EbayItemSummary[];
}

interface EbaySalesResponse {
  itemSales?: EbaySaleSummary[];
}

interface EbayItemSummary {
  itemId: string;
  title: string;
  itemWebUrl: string;
  condition?: string;
  buyingOptions?: string[];
  image?: { imageUrl?: string };
  price?: { value?: string };
  currentBidPrice?: { value?: string };
  shippingOptions?: Array<{ shippingCost?: { value?: string } }>;
}

interface EbaySaleSummary {
  itemId: string;
  title: string;
  itemWebUrl: string;
  condition?: string;
  image?: { imageUrl?: string };
  price?: { value?: string };
  shippingCost?: { value?: string };
  lastSoldDate?: string;
}

app.listen(port, () => {
  console.log(`PopValue API running on http://localhost:${port}`);
});
