import type { ConfidenceLevel, EbayListing, FunkoItem, ValuationResult } from '../types';

const totalPrice = (listing: EbayListing) => listing.price + listing.shipping;

export class ValuationService {
  estimate(item: FunkoItem, activeListings: EbayListing[], soldListings: EbayListing[] = []): ValuationResult {
    const relevantActive = this.removeOutliers(this.filterRelevantListings(item, activeListings));
    const relevantSold = this.removeOutliers(this.filterRelevantListings(item, soldListings));
    const basisListings = relevantSold.length >= 3 ? relevantSold : relevantActive;
    const basis: ValuationResult['basis'] = relevantSold.length >= 3 ? 'sold comps' : 'active listings';
    const trimmed = basisListings;
    const prices = trimmed.map(totalPrice).sort((a, b) => a - b);
    const medianPrice = this.median(prices);
    const activeMedianPrice = this.median(relevantActive.map(totalPrice).sort((a, b) => a - b));
    const soldMedianPrice = relevantSold.length ? this.median(relevantSold.map(totalPrice).sort((a, b) => a - b)) : undefined;
    const estimatedLow = prices.length ? Math.max(0, medianPrice * 0.88) : 0;
    const estimatedHigh = prices.length ? medianPrice * 1.12 : 0;
    const confidenceScore = this.confidenceScore(item, trimmed);
    const confidence = this.confidenceLevel(confidenceScore);

    return {
      estimatedLow,
      estimatedHigh,
      medianPrice,
      activeMedianPrice,
      soldMedianPrice,
      lowestListing: [...relevantActive].sort((a, b) => totalPrice(a) - totalPrice(b))[0],
      listingsUsed: trimmed,
      confidence,
      confidenceScore,
      sampleSize: trimmed.length,
      activeSampleSize: relevantActive.length,
      soldSampleSize: relevantSold.length,
      basis,
      notes: this.notes(trimmed.length, confidence, basis, relevantSold.length)
    };
  }

  private filterRelevantListings(item: FunkoItem, listings: EbayListing[]) {
    const required = [item.name, item.boxNumber].filter(Boolean).map((value) => value!.toLowerCase());
    const optional = [item.variant, item.franchise, item.series].filter(Boolean).map((value) => value!.toLowerCase());

    return listings.filter((listing) => {
      const title = listing.title.toLowerCase();
      const requiredMatches = required.filter((token) => title.includes(token)).length;
      const optionalMatches = optional.filter((token) => title.includes(token)).length;
      const excludes = ['lot of', 'bundle', 'damaged box only', 'protector only'].some((term) => title.includes(term));
      return !excludes && requiredMatches >= Math.min(required.length, 1) && requiredMatches + optionalMatches >= 1;
    });
  }

  private removeOutliers(listings: EbayListing[]) {
    if (listings.length < 4) return listings;

    const prices = listings.map(totalPrice).sort((a, b) => a - b);
    const q1 = this.percentile(prices, 0.25);
    const q3 = this.percentile(prices, 0.75);
    const iqr = q3 - q1;
    const low = q1 - iqr * 1.5;
    const high = q3 + iqr * 1.5;

    return listings.filter((listing) => {
      const price = totalPrice(listing);
      return price >= low && price <= high;
    });
  }

  private median(values: number[]) {
    if (!values.length) return 0;
    const middle = Math.floor(values.length / 2);
    return values.length % 2 ? values[middle] : (values[middle - 1] + values[middle]) / 2;
  }

  private percentile(values: number[], percentile: number) {
    const index = (values.length - 1) * percentile;
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    const weight = index - lower;
    return values[lower] * (1 - weight) + values[upper] * weight;
  }

  private confidenceScore(item: FunkoItem, listings: EbayListing[]) {
    const sampleScore = Math.min(listings.length / 8, 1) * 0.45;
    const titleScore =
      listings.filter((listing) => {
        const title = listing.title.toLowerCase();
        return title.includes(item.name.toLowerCase()) && (!item.boxNumber || title.includes(item.boxNumber));
      }).length / Math.max(listings.length, 1);
    const upcBoost = item.upc ? 0.1 : 0;
    return Math.min(sampleScore + titleScore * 0.45 + upcBoost, 1);
  }

  private confidenceLevel(score: number): ConfidenceLevel {
    if (score >= 0.75) return 'high';
    if (score >= 0.45) return 'medium';
    return 'low';
  }

  private notes(sampleSize: number, confidence: ConfidenceLevel, basis: ValuationResult['basis'], soldSampleSize: number) {
    const notes = [
      basis === 'sold comps'
        ? 'Estimated Value is based primarily on sold comps from available sales history.'
        : 'Estimated Value is based on active listing asking prices, not guaranteed sale prices.'
    ];
    if (soldSampleSize > 0 && soldSampleSize < 3) notes.push('Sold comp sample is too small, so active listings are still the primary basis.');
    if (sampleSize < 4) notes.push('Small listing sample. Treat this as a directional estimate.');
    if (confidence === 'low') notes.push('Low confidence match. Review possible variants, stickers, and box condition.');
    return notes;
  }
}

export const valuationService = new ValuationService();
