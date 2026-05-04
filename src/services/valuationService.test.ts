import { describe, expect, it } from 'vitest';
import { ValuationService } from './valuationService';
import type { EbayListing, FunkoItem } from '../types';

const item: FunkoItem = {
  id: 'batman-01-chase',
  upc: '830395022260',
  name: 'Batman',
  franchise: 'DC Comics',
  series: 'Heroes',
  boxNumber: '01',
  variant: 'Chase',
  condition: 'mint',
  imageUrl: 'https://example.com/batman.jpg'
};

function listing(id: string, title: string, price: number, shipping = 0, listingStatus: 'active' | 'sold' = 'active'): EbayListing {
  return {
    id,
    title,
    price,
    shipping,
    condition: 'New',
    imageUrl: 'https://example.com/listing.jpg',
    url: `https://example.com/${id}`,
    listingType: listingStatus === 'sold' ? 'SOLD_COMP' : 'FIXED_PRICE',
    source: 'mock',
    listingStatus
  };
}

describe('ValuationService', () => {
  it('uses sold comps as the value basis when at least three relevant sales exist', () => {
    const service = new ValuationService();
    const active = [
      listing('active-1', 'Funko Pop Batman #01 Chase', 80),
      listing('active-2', 'Batman 01 Chase DC Heroes', 90)
    ];
    const sold = [
      listing('sold-1', 'Funko Pop Batman #01 Chase sold', 40, 5, 'sold'),
      listing('sold-2', 'Batman 01 Chase DC Heroes sold', 50, 0, 'sold'),
      listing('sold-3', 'Funko Batman Chase Number 01 sold', 55, 5, 'sold')
    ];

    const result = service.estimate(item, active, sold);

    expect(result.basis).toBe('sold comps');
    expect(result.medianPrice).toBe(50);
    expect(result.soldMedianPrice).toBe(50);
    expect(result.activeMedianPrice).toBe(85);
    expect(result.listingsUsed.map((used) => used.id)).toEqual(['sold-1', 'sold-2', 'sold-3']);
    expect(result.relevantListingCount).toBe(5);
    expect(result.excludedListingCount).toBe(0);
  });

  it('filters irrelevant listings and removes extreme active-listing outliers', () => {
    const service = new ValuationService();
    const active = [
      listing('active-1', 'Funko Pop Batman #01 Chase', 20),
      listing('active-2', 'Batman 01 Chase DC Heroes', 21),
      listing('active-3', 'Funko Batman Chase Number 01', 22),
      listing('active-4', 'Funko Pop Batman #01 Chase signed rare', 1000),
      listing('active-5', 'Batman protector only no figure', 5),
      listing('active-6', 'Spider-Man #03 Classic Suit', 15)
    ];

    const result = service.estimate(item, active);

    expect(result.basis).toBe('active listings');
    expect(result.medianPrice).toBe(21);
    expect(result.sampleSize).toBe(3);
    expect(result.excludedListingCount).toBe(3);
    expect(result.listingsUsed.map((used) => used.id)).toEqual(['active-1', 'active-2', 'active-3']);
  });

  it('does not zero out UPC-matched listings when some titles omit the box number', () => {
    const service = new ValuationService();
    const kaijuItem: FunkoItem = {
      id: 'barcode-889698867672',
      upc: '889698867672',
      name: 'Kikoru Shinomiya',
      franchise: 'Kaiju No. 8',
      series: 'Animation',
      boxNumber: '2082',
      condition: 'mint',
      imageUrl: 'https://example.com/kikoru.jpg'
    };
    const active = [
      listing('active-1', 'Funko POP! Anime: Kaiju No8 - Kikoru Shinomiya [New Toy] Vinyl Figure, Collect', 13.91),
      listing('active-2', 'Funko Pop Kaiju No. 8 - Kikoru Shinomiya - Vinyl Figure - #2082', 16.01),
      listing('active-3', 'Funko Pop Animation Kaiju No. 8 Kikoru Shinomiya Vinyl Figure NEW NIB', 9.99, 5.99),
      listing('active-4', 'Funko Pop! Kaiju No. 8 Kikoru Shinomiya signed by Fairouz Ai w/ PSA Witness', 380),
      listing('active-5', 'Funko POP! Anime: Kaiju No8 - Kikoru Shinomiya [Used Very Good Toy] Vinyl Figu', 12.02, 1.99)
    ];

    const result = service.estimate(kaijuItem, active);

    expect(result.medianPrice).toBeCloseTo(14.995);
    expect(result.sampleSize).toBe(4);
    expect(result.confidence).toBe('high');
    expect(result.excludedListingCount).toBe(1);
  });
});
