import dotenv from 'dotenv';
import { mockEbayListings, mockSoldListings } from '../src/data/mockData.js';
import type { EbayListing, EbayLookupResult } from '../src/types.js';

dotenv.config();

let tokenCache: { token: string; expiresAt: number } | null = null;

export interface EbaySearchRequest {
  upc?: string;
  query?: string;
  limit?: number;
}

export async function searchEbayMarket(body: EbaySearchRequest) {
  const { upc, query, limit = 40 } = body;
  const messages: string[] = [];

  try {
    const token = await getEbayAccessToken();
    if (!token) {
      return {
        status: 200,
        payload: {
          listings: mockEbayListings,
          soldListings: mockSoldListings,
          mode: 'mock',
          messages: ['Missing eBay credentials. Using mock active listings and sold comps.']
        } satisfies EbaySearchPayload
      };
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

    return {
      status: 200,
      payload: {
        listings: activeListings.length ? activeListings : mockEbayListings,
        soldListings: soldListings.length ? soldListings : mockSoldListings,
        mode: soldListings.length ? 'live' : 'mixed',
        messages
      } satisfies EbaySearchPayload
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown eBay lookup error';
    return {
      status: 502,
      payload: {
        listings: mockEbayListings,
        soldListings: mockSoldListings,
        mode: 'mock',
        messages: [`Live eBay lookup failed: ${message}`]
      } satisfies EbaySearchPayload
    };
  }
}

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

  let items = payload.itemSummaries ?? [];
  if (!items.length && options.upc && options.query) {
    const fallbackParams = buildSearchParams(options, true);
    fallbackParams.set('filter', 'buyingOptions:{FIXED_PRICE|AUCTION}');
    const fallbackPayload = await ebayGet<EbaySearchResponse>(
      `${apiBase}/buy/browse/v1/item_summary/search?${fallbackParams.toString()}`,
      options.token
    );
    items = fallbackPayload.itemSummaries ?? [];
  }

  return items.map((item) => mapActiveItem(item));
}

async function searchSoldListings(options: EbaySearchOptions): Promise<EbayListing[]> {
  const apiBase = process.env.EBAY_API_BASE_URL ?? 'https://api.ebay.com';
  const searchParams = buildSearchParams(options);

  const payload = await ebayGet<EbaySalesResponse>(
    `${apiBase}/buy/marketplace_insights/v1_beta/item_sales/search?${searchParams.toString()}`,
    options.token
  );

  let items = payload.itemSales ?? [];
  if (!items.length && options.upc && options.query) {
    const fallbackParams = buildSearchParams(options, true);
    const fallbackPayload = await ebayGet<EbaySalesResponse>(
      `${apiBase}/buy/marketplace_insights/v1_beta/item_sales/search?${fallbackParams.toString()}`,
      options.token
    );
    items = fallbackPayload.itemSales ?? [];
  }

  return items.map((item) => mapSoldItem(item));
}

function buildSearchParams({ upc, query, limit }: EbaySearchOptions, preferQuery = false) {
  const searchParams = new URLSearchParams({
    limit: String(Math.min(Math.max(limit, 1), 100))
  });

  if (upc && !preferQuery) {
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

interface EbaySearchPayload extends Omit<EbayLookupResult, 'activeListings'> {
  listings: EbayListing[];
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
