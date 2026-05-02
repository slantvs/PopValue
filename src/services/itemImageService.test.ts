import { describe, expect, it } from 'vitest';
import { enrichItemImageFromListings } from './itemImageService';
import type { EbayListing, FunkoItem } from '../types';

const baseItem: FunkoItem = {
  id: 'manual-orihime-inoue-bleach-1611',
  name: 'Orihime Inoue',
  franchise: 'Bleach',
  series: 'Unknown Series',
  boxNumber: '1611',
  condition: 'mint',
  imageUrl: 'https://placehold.co/600x800/111827/f8fafc?text=Funko+Pop'
};

const listing = (overrides: Partial<EbayListing>): EbayListing => ({
  id: 'listing-1',
  title: 'Funko Pop - Bleach Vinyl Figure - Orihime Inoue 1611',
  price: 10.99,
  shipping: 0,
  condition: 'New',
  imageUrl: 'https://i.ebayimg.com/images/g/example/s-l500.webp',
  url: 'https://www.ebay.com/itm/example',
  listingType: 'FIXED_PRICE',
  source: 'ebay',
  listingStatus: 'active',
  ...overrides
});

describe('enrichItemImageFromListings', () => {
  it('replaces generic item artwork with a live eBay listing image', () => {
    const item = enrichItemImageFromListings(baseItem, [listing({})]);

    expect(item.imageUrl).toBe('https://i.ebayimg.com/images/g/example/s-l500.webp');
  });

  it('does not replace a non-generic image with a mock listing image', () => {
    const item = enrichItemImageFromListings(
      { ...baseItem, imageUrl: 'https://example.com/catalog-image.webp' },
      [listing({ source: 'mock', imageUrl: 'https://example.com/mock.webp' })]
    );

    expect(item.imageUrl).toBe('https://example.com/catalog-image.webp');
  });
});
