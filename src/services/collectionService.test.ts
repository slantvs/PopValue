import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CollectionService } from './collectionService';
import type { CollectionEntry, FunkoItem, ValuationResult } from '../types';

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

const valuation: ValuationResult = {
  estimatedLow: 40,
  estimatedHigh: 60,
  medianPrice: 50,
  activeMedianPrice: 50,
  lowestListing: undefined,
  listingsUsed: [],
  confidence: 'medium',
  confidenceScore: 0.6,
  sampleSize: 3,
  activeSampleSize: 3,
  soldSampleSize: 0,
  basis: 'active listings',
  notes: []
};

function entry(overrides: Partial<CollectionEntry> = {}): CollectionEntry {
  return {
    id: 'entry-1',
    item,
    valuation,
    condition: 'mint',
    notes: 'Keep box protector',
    purchasePrice: 25,
    savedAt: '2026-04-30T00:00:00.000Z',
    ...overrides
  };
}

function stubLocalStorage() {
  const store = new Map<string, string>();

  vi.stubGlobal('localStorage', {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => store.set(key, value),
    removeItem: (key: string) => store.delete(key),
    clear: () => store.clear()
  });
}

describe('CollectionService', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    stubLocalStorage();
  });

  it('preserves existing fields when updating only condition', () => {
    const service = new CollectionService();
    service.save(entry());

    const [updated] = service.update('entry-1', { condition: 'good' });

    expect(updated.condition).toBe('good');
    expect(updated.item.condition).toBe('good');
    expect(updated.notes).toBe('Keep box protector');
    expect(updated.purchasePrice).toBe(25);
  });

  it('round-trips exported collection JSON', () => {
    const service = new CollectionService();
    const saved = service.save(entry({ id: 'entry-2' }));
    const exported = service.exportJson(saved);

    const imported = service.importJson(exported);

    expect(imported).toHaveLength(1);
    expect(imported[0].id).toBe('entry-2');
    expect(imported[0].valuation.medianPrice).toBe(50);
  });
});
