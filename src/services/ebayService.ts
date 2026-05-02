import { mockEbayListings, mockSoldListings } from '../data/mockData';
import type { EbayListing, EbayLookupResult, FunkoItem } from '../types';
import { identifyService } from './identifyService';

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '');

export class EbayService {
  async searchListings(item: FunkoItem): Promise<EbayLookupResult> {
    const query = identifyService.buildSearchQuery(
      { name: '', franchise: '', series: '', boxNumber: '', variant: '' },
      item
    );

    try {
      const response = await fetch(`${apiBaseUrl}/api/ebay/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ upc: item.upc, query, limit: 40 })
      });

      if (!response.ok) throw new Error('eBay lookup failed');
      const data = (await response.json()) as {
        listings: EbayListing[];
        soldListings?: EbayListing[];
        mode?: EbayLookupResult['mode'];
        messages?: string[];
      };

      return {
        activeListings: data.listings.length ? data.listings : this.mockForItem(item, mockEbayListings),
        soldListings: data.soldListings?.length ? data.soldListings : this.mockForItem(item, mockSoldListings),
        mode: data.mode ?? 'live',
        messages: data.messages ?? []
      };
    } catch {
      return {
        activeListings: this.mockForItem(item, mockEbayListings),
        soldListings: this.mockForItem(item, mockSoldListings),
        mode: 'mock',
        messages: ['Using mock eBay data because live lookup is unavailable.']
      };
    }
  }

  private mockForItem(item: FunkoItem, listings: EbayListing[]) {
    const itemTokens = [item.name, item.boxNumber, item.variant, item.franchise]
      .filter(Boolean)
      .map((value) => value!.toLowerCase());

    const matched = listings.filter((listing) => {
      const title = listing.title.toLowerCase();
      return itemTokens.some((token) => title.includes(token));
    });

    return matched.length ? matched : listings;
  }
}

export const ebayService = new EbayService();
