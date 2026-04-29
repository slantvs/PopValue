import type { CollectionEntry, Condition } from '../types';

const STORAGE_KEY = 'popvalue.collection.v1';

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

  totalEstimatedValue(entries: CollectionEntry[]) {
    return entries.reduce((total, entry) => total + entry.valuation.medianPrice, 0);
  }

  exportJson(entries: CollectionEntry[]) {
    return JSON.stringify({ exportedAt: new Date().toISOString(), entries }, null, 2);
  }

  importJson(contents: string) {
    const parsed = JSON.parse(contents) as { entries?: CollectionEntry[] } | CollectionEntry[];
    const entries = Array.isArray(parsed) ? parsed : parsed.entries;
    if (!Array.isArray(entries)) throw new Error('Invalid collection export');
    return this.replace(entries);
  }
}

export const collectionService = new CollectionService();
