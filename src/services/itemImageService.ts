import type { EbayListing, FunkoItem } from '../types';

const genericImageSignals = ['placehold.co', 'images.unsplash.com'];

const hasGenericImage = (imageUrl: string) => genericImageSignals.some((signal) => imageUrl.includes(signal));

export function enrichItemImageFromListings(item: FunkoItem, listings: EbayListing[]): FunkoItem {
  const liveListingImage = listings.find((listing) => listing.source === 'ebay' && listing.imageUrl)?.imageUrl;
  const fallbackListingImage = hasGenericImage(item.imageUrl)
    ? listings.find((listing) => listing.imageUrl)?.imageUrl
    : undefined;
  const imageUrl = liveListingImage ?? fallbackListingImage;

  if (!imageUrl || imageUrl === item.imageUrl) return item;
  return { ...item, imageUrl };
}
