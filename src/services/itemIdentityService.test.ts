import { describe, expect, it } from 'vitest';
import type { EbayListing, FunkoItem } from '../types';
import { enrichItemIdentityFromListings, parseListingIdentity } from './itemIdentityService';

const baseItem: FunkoItem = {
  id: 'barcode-889698853248',
  upc: '889698853248',
  name: 'Funko Pop',
  franchise: 'Unknown Franchise',
  series: 'Unknown Series',
  condition: 'mint',
  imageUrl: 'https://placehold.co/600x800/111827/f8fafc?text=Funko+Pop'
};

const listing = (title: string): EbayListing => ({
  id: title,
  title,
  price: 20,
  shipping: 0,
  condition: 'New',
  imageUrl: '',
  url: 'https://example.com',
  listingType: 'FIXED_PRICE',
  source: 'ebay',
  listingStatus: 'active'
});

describe('parseListingIdentity', () => {
  it('extracts anime identity from eBay barcode listing titles', () => {
    expect(
      parseListingIdentity('Toji Fushiguro Funko Pop #1889 (Common) Jujutsu Kaisen (Animation) W/Protector')
    ).toMatchObject({
      name: 'Toji Fushiguro',
      franchise: 'Jujutsu Kaisen',
      series: 'Animation',
      boxNumber: '1889'
    });
  });

  it('extracts franchise/name from Pop Vinyl colon titles', () => {
    expect(
      parseListingIdentity('Funko Pop! Vinyl: Jujutsu Kaisen - Toji Fushiguro (Chase) (Glow) - Chalice Collectibles')
    ).toMatchObject({
      name: 'Toji Fushiguro',
      franchise: 'Jujutsu Kaisen',
      series: 'Animation',
      variant: 'Chase, Glow in the dark, Chalice Collectibles'
    });
  });
});

describe('enrichItemIdentityFromListings', () => {
  it('replaces generic barcode fallback fields with parsed listing identity', () => {
    expect(
      enrichItemIdentityFromListings(baseItem, [
        listing('Funko Pop! Vinyl: Jujutsu Kaisen - Toji Fushiguro (Chase) (Glow) - Chalice Collectibles'),
        listing('Toji Fushiguro Funko Pop #1889 (Common) Jujutsu Kaisen (Animation) W/Protector')
      ])
    ).toMatchObject({
      name: 'Toji Fushiguro',
      franchise: 'Jujutsu Kaisen',
      series: 'Animation',
      boxNumber: '1889'
    });
  });

  it('keeps manual or catalog fields that are already specific', () => {
    expect(
      enrichItemIdentityFromListings(
        { ...baseItem, name: 'Manual Name', franchise: 'Manual Franchise', series: 'Manual Series' },
        [listing('Toji Fushiguro Funko Pop #1889 (Common) Jujutsu Kaisen (Animation) W/Protector')]
      )
    ).toMatchObject({
      name: 'Manual Name',
      franchise: 'Manual Franchise',
      series: 'Manual Series',
      boxNumber: '1889'
    });
  });
});
