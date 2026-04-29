import type { EbayListing, FunkoItem, RetailOffer } from '../types';

export const mockCatalog: FunkoItem[] = [
  {
    id: 'batman-01-chase',
    upc: '830395022260',
    name: 'Batman',
    franchise: 'DC Comics',
    series: 'Heroes',
    boxNumber: '01',
    variant: 'Chase',
    condition: 'mint',
    sticker: 'Chase',
    imageUrl: 'https://images.unsplash.com/photo-1608889825205-eebdb9fc5806?auto=format&fit=crop&w=900&q=80'
  },
  {
    id: 'spiderman-03-classic',
    upc: '889698036034',
    name: 'Spider-Man',
    franchise: 'Marvel',
    series: 'Marvel Universe',
    boxNumber: '03',
    variant: 'Classic Suit',
    condition: 'mint',
    imageUrl: 'https://images.unsplash.com/photo-1601645191163-3fc0d5d64e35?auto=format&fit=crop&w=900&q=80'
  },
  {
    id: 'mando-345-child',
    upc: '889698455898',
    name: 'The Child',
    franchise: 'Star Wars',
    series: 'The Mandalorian',
    boxNumber: '345',
    variant: 'With Cup',
    condition: 'mint',
    sticker: 'Galactic Convention',
    imageUrl: 'https://images.unsplash.com/photo-1607462109225-6b64ae2dd3cb?auto=format&fit=crop&w=900&q=80'
  },
  {
    id: 'eleven-421-eggos',
    upc: '889698123321',
    name: 'Eleven',
    franchise: 'Stranger Things',
    series: 'Television',
    boxNumber: '421',
    variant: 'With Eggos',
    condition: 'mint',
    imageUrl: 'https://images.unsplash.com/photo-1596464716127-f2a82984de30?auto=format&fit=crop&w=900&q=80'
  }
];

export const mockEbayListings: EbayListing[] = [
  {
    id: 'mock-1',
    title: 'Funko Pop Batman #01 Chase DC Heroes Vinyl Figure',
    price: 42,
    shipping: 5.5,
    condition: 'New',
    imageUrl: mockCatalog[0].imageUrl,
    url: 'https://www.ebay.com/sch/i.html?_nkw=Funko+Pop+Batman+01+Chase',
    listingType: 'FIXED_PRICE',
    source: 'mock',
    listingStatus: 'active'
  },
  {
    id: 'mock-2',
    title: 'Batman Funko Pop Heroes 01 Chase Sticker Mint Box',
    price: 48,
    shipping: 0,
    condition: 'New',
    imageUrl: mockCatalog[0].imageUrl,
    url: 'https://www.ebay.com/sch/i.html?_nkw=Batman+Funko+Pop+Chase',
    listingType: 'FIXED_PRICE',
    source: 'mock',
    listingStatus: 'active'
  },
  {
    id: 'mock-3',
    title: 'Funko Pop DC Batman Chase Vinyl Figure Number 01',
    price: 39.99,
    shipping: 6,
    condition: 'Used',
    imageUrl: mockCatalog[0].imageUrl,
    url: 'https://www.ebay.com/sch/i.html?_nkw=DC+Batman+Funko+01',
    listingType: 'AUCTION',
    source: 'mock',
    listingStatus: 'active'
  },
  {
    id: 'mock-4',
    title: 'Funko Pop Spider-Man #03 Classic Suit Marvel',
    price: 22,
    shipping: 4.99,
    condition: 'New',
    imageUrl: mockCatalog[1].imageUrl,
    url: 'https://www.ebay.com/sch/i.html?_nkw=Funko+Pop+Spider-Man+03',
    listingType: 'FIXED_PRICE',
    source: 'mock',
    listingStatus: 'active'
  },
  {
    id: 'mock-5',
    title: 'The Child With Cup Funko Pop Star Wars Mandalorian 345',
    price: 31,
    shipping: 5,
    condition: 'New',
    imageUrl: mockCatalog[2].imageUrl,
    url: 'https://www.ebay.com/sch/i.html?_nkw=The+Child+Funko+Pop+345',
    listingType: 'FIXED_PRICE',
    source: 'mock',
    listingStatus: 'active'
  },
  {
    id: 'mock-6',
    title: 'Funko Pop Eleven with Eggos Stranger Things #421',
    price: 18,
    shipping: 4.5,
    condition: 'New',
    imageUrl: mockCatalog[3].imageUrl,
    url: 'https://www.ebay.com/sch/i.html?_nkw=Eleven+Eggos+Funko+421',
    listingType: 'FIXED_PRICE',
    source: 'mock',
    listingStatus: 'active'
  }
];

export const mockSoldListings: EbayListing[] = [
  {
    id: 'sold-1',
    title: 'Sold Funko Pop Batman #01 Chase DC Heroes',
    price: 44,
    shipping: 5,
    condition: 'New',
    imageUrl: mockCatalog[0].imageUrl,
    url: 'https://www.ebay.com/sch/i.html?_nkw=Funko+Pop+Batman+01+Chase&LH_Sold=1',
    listingType: 'SOLD_COMP',
    source: 'mock',
    listingStatus: 'sold',
    soldAt: '2026-04-16T16:20:00.000Z'
  },
  {
    id: 'sold-2',
    title: 'Batman Chase Funko Pop 01 Mint Box Sold',
    price: 41.5,
    shipping: 6,
    condition: 'New',
    imageUrl: mockCatalog[0].imageUrl,
    url: 'https://www.ebay.com/sch/i.html?_nkw=Batman+Chase+Funko+Pop+01&LH_Sold=1',
    listingType: 'SOLD_COMP',
    source: 'mock',
    listingStatus: 'sold',
    soldAt: '2026-04-09T13:12:00.000Z'
  },
  {
    id: 'sold-3',
    title: 'Funko Pop DC Heroes Batman Chase Number 01',
    price: 47,
    shipping: 0,
    condition: 'New',
    imageUrl: mockCatalog[0].imageUrl,
    url: 'https://www.ebay.com/sch/i.html?_nkw=DC+Heroes+Batman+Chase+01&LH_Sold=1',
    listingType: 'SOLD_COMP',
    source: 'mock',
    listingStatus: 'sold',
    soldAt: '2026-03-30T21:04:00.000Z'
  },
  {
    id: 'sold-4',
    title: 'Spider-Man #03 Classic Suit Funko Pop Marvel Sold',
    price: 21,
    shipping: 4,
    condition: 'New',
    imageUrl: mockCatalog[1].imageUrl,
    url: 'https://www.ebay.com/sch/i.html?_nkw=Spider-Man+Funko+Pop+03&LH_Sold=1',
    listingType: 'SOLD_COMP',
    source: 'mock',
    listingStatus: 'sold',
    soldAt: '2026-04-11T09:30:00.000Z'
  },
  {
    id: 'sold-5',
    title: 'The Child With Cup Star Wars Funko Pop 345',
    price: 29,
    shipping: 5.25,
    condition: 'New',
    imageUrl: mockCatalog[2].imageUrl,
    url: 'https://www.ebay.com/sch/i.html?_nkw=The+Child+Funko+Pop+345&LH_Sold=1',
    listingType: 'SOLD_COMP',
    source: 'mock',
    listingStatus: 'sold',
    soldAt: '2026-04-04T19:55:00.000Z'
  }
];

export const mockRetailOffers: RetailOffer[] = [
  { provider: 'Funko', price: 12.99, availability: 'Reference retail price', url: 'https://funko.com', providerType: 'mock-price' },
  { provider: 'Target', price: 14.99, availability: 'Search-link provider', url: 'https://target.com/s?searchTerm=Funko%20Pop', providerType: 'search-link' },
  { provider: 'Walmart', price: 13.88, availability: 'Search-link provider', url: 'https://www.walmart.com/search?q=Funko%20Pop', providerType: 'search-link' }
];
