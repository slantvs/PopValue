import type { EbayListing, FunkoItem } from '../types';

const genericImageSignals = ['placehold.co', 'images.unsplash.com', 'funko+pop', 'text=Funko'];
const trustedListingImageSignals = ['i.ebayimg.com', 'i.etsystatic.com', 'm.media-amazon.com'];

const hasGenericImage = (imageUrl: string) =>
  genericImageSignals.some((signal) => imageUrl.toLowerCase().includes(signal.toLowerCase()));

const isUsableListingImage = (listing: EbayListing) =>
  Boolean(listing.imageUrl) && !hasGenericImage(listing.imageUrl);

const isTrustedListingImage = (listing: EbayListing) =>
  isUsableListingImage(listing) && trustedListingImageSignals.some((signal) => listing.imageUrl.includes(signal));

export function enrichItemImageFromListings(item: FunkoItem, listings: EbayListing[]): FunkoItem {
  const liveListingImage = listings.find((listing) => listing.source === 'ebay' && isTrustedListingImage(listing))?.imageUrl;
  const anyLiveListingImage = listings.find((listing) => listing.source === 'ebay' && isUsableListingImage(listing))?.imageUrl;
  const fallbackListingImage = hasGenericImage(item.imageUrl)
    ? listings.find(isUsableListingImage)?.imageUrl
    : undefined;
  const imageUrl = liveListingImage ?? anyLiveListingImage ?? fallbackListingImage;

  if (!imageUrl || imageUrl === item.imageUrl) return item;
  return { ...item, imageUrl };
}
