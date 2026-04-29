import type { FunkoItem, RetailOffer } from '../types';

export interface RetailProvider {
  name: string;
  search(item: FunkoItem): Promise<RetailOffer[]>;
}

class FunkoRetailProvider implements RetailProvider {
  name = 'Funko';

  async search(item: FunkoItem): Promise<RetailOffer[]> {
    return [
      {
        provider: this.name,
        price: 12.99,
        availability: 'Reference retail price',
        url: `https://funko.com/search/?q=${encodeURIComponent(item.name)}`,
        providerType: 'mock-price'
      }
    ];
  }
}

class SearchLinkRetailProvider implements RetailProvider {
  constructor(
    public name: string,
    private baseUrl: string,
    private price: number
  ) {}

  async search(item: FunkoItem): Promise<RetailOffer[]> {
    const query = encodeURIComponent(`Funko Pop ${item.name} ${item.boxNumber ?? ''} ${item.variant ?? ''}`.trim());
    return [
      {
        provider: this.name,
        price: this.price,
        availability: 'Search-link provider',
        url: `${this.baseUrl}${query}`,
        providerType: 'search-link'
      }
    ];
  }
}

export class RetailService {
  constructor(
    private providers: RetailProvider[] = [
      new FunkoRetailProvider(),
      new SearchLinkRetailProvider('Amazon', 'https://www.amazon.com/s?k=', 14.99),
      new SearchLinkRetailProvider('Walmart', 'https://www.walmart.com/search?q=', 13.88),
      new SearchLinkRetailProvider('Target', 'https://www.target.com/s?searchTerm=', 14.99)
    ]
  ) {}

  async compare(item: FunkoItem) {
    const offers = await Promise.all(this.providers.map((provider) => provider.search(item)));
    return offers.flat().sort((a, b) => a.price - b.price);
  }
}

export const retailService = new RetailService();
