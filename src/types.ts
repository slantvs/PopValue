export type Condition = 'mint' | 'good' | 'damaged' | 'out of box';

export type ConfidenceLevel = 'low' | 'medium' | 'high';

export interface FunkoItem {
  id: string;
  upc?: string;
  name: string;
  franchise: string;
  series: string;
  boxNumber?: string;
  variant?: string;
  condition: Condition;
  sticker?: string;
  imageUrl: string;
}

export interface IdentificationCandidate {
  item: FunkoItem;
  score: number;
  reasons: string[];
}

export interface ScanResult {
  rawValue?: string;
  source: 'camera' | 'upload' | 'manual';
  confidence: number;
  imagePreview?: string;
  visualHints?: string[];
}

export interface ManualSearchFields {
  name: string;
  franchise: string;
  series: string;
  boxNumber: string;
  variant: string;
}

export interface EbayListing {
  id: string;
  title: string;
  price: number;
  shipping: number;
  condition: string;
  imageUrl: string;
  url: string;
  listingType: string;
  source: 'ebay' | 'mock';
  listingStatus: 'active' | 'sold';
  soldAt?: string;
}

export interface EbayLookupResult {
  activeListings: EbayListing[];
  soldListings: EbayListing[];
  mode: 'live' | 'mock' | 'mixed';
  messages: string[];
}

export interface RetailOffer {
  provider: string;
  price: number;
  url: string;
  availability: string;
  providerType: 'mock-price' | 'search-link';
}

export interface ValuationResult {
  estimatedLow: number;
  estimatedHigh: number;
  medianPrice: number;
  activeMedianPrice: number;
  soldMedianPrice?: number;
  lowestListing?: EbayListing;
  listingsUsed: EbayListing[];
  confidence: ConfidenceLevel;
  confidenceScore: number;
  sampleSize: number;
  activeSampleSize: number;
  soldSampleSize: number;
  basis: 'active listings' | 'sold comps';
  notes: string[];
}

export interface CollectionEntry {
  id: string;
  item: FunkoItem;
  valuation: ValuationResult;
  condition: Condition;
  notes: string;
  purchasePrice?: number;
  savedAt: string;
}

export interface ProfileUser {
  id: string;
  email?: string;
}
