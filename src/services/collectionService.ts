import type { CollectionEntry, Condition, FunkoItem } from '../types';

const STORAGE_KEY = 'popvalue.collection.v1';

export function parseCollectionExport(contents: string) {
  const parsed = JSON.parse(contents) as { entries?: CollectionEntry[] } | CollectionEntry[];
  const entries = Array.isArray(parsed) ? parsed : parsed.entries;
  if (!Array.isArray(entries)) throw new Error('Invalid collection export');
  return entries;
}

const normalizeCollectionToken = (value?: string) =>
  (value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ');

export function collectionItemKey(item: FunkoItem) {
  return [
    normalizeCollectionToken(item.upc),
    normalizeCollectionToken(item.franchise),
    normalizeCollectionToken(item.name),
    normalizeCollectionToken(item.boxNumber),
    normalizeCollectionToken(item.variant),
    normalizeCollectionToken(item.sticker)
  ].join('|');
}

export function findMatchingCollectionEntry(entries: CollectionEntry[], item: FunkoItem) {
  const itemKey = collectionItemKey(item);
  const itemUpc = normalizeCollectionToken(item.upc);

  return entries.find((entry) => {
    const entryUpc = normalizeCollectionToken(entry.item.upc);
    return Boolean(itemUpc && entryUpc && itemUpc === entryUpc) || collectionItemKey(entry.item) === itemKey;
  });
}

export class CollectionService {
  list(): CollectionEntry[] {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') as CollectionEntry[];
    } catch {
      return [];
    }
  }

  save(entry: CollectionEntry) {
    const next = [entry, ...this.list().filter((item) => item.id !== entry.id)];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    return next;
  }

  replace(entries: CollectionEntry[]) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    return entries;
  }

  update(id: string, patch: Partial<Pick<CollectionEntry, 'notes' | 'purchasePrice'> & { condition: Condition }>) {
    const definedPatch = Object.fromEntries(
      Object.entries(patch).filter(([, value]) => value !== undefined)
    ) as Partial<Pick<CollectionEntry, 'notes' | 'purchasePrice'> & { condition: Condition }>;

    const next = this.list().map((entry) =>
      entry.id === id
        ? {
            ...entry,
            ...definedPatch,
            item: { ...entry.item, condition: definedPatch.condition ?? entry.item.condition }
          }
        : entry
    );
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    return next;
  }

  remove(id: string) {
    const next = this.list().filter((entry) => entry.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    return next;
  }

  totalEstimatedValue(entries: CollectionEntry[]) {
    return entries.reduce((total, entry) => total + entry.valuation.medianPrice, 0);
  }

  exportJson(entries: CollectionEntry[]) {
    return JSON.stringify({ exportedAt: new Date().toISOString(), entries }, null, 2);
  }

  importJson(contents: string) {
    return this.replace(parseCollectionExport(contents));
  }
}

export const collectionService = new CollectionService();
