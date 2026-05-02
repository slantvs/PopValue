import type { CollectionEntry, Condition, FunkoItem, ValuationResult } from '../types';
import { supabase } from './supabaseClient';

interface CollectionEntryRow {
  id: string;
  user_id: string;
  item: FunkoItem;
  valuation: ValuationResult;
  condition: Condition;
  notes: string | null;
  purchase_price: number | null;
  saved_at: string;
}

const toEntry = (row: CollectionEntryRow): CollectionEntry => ({
  id: row.id,
  item: row.item,
  valuation: row.valuation,
  condition: row.condition,
  notes: row.notes ?? '',
  purchasePrice: row.purchase_price ?? undefined,
  savedAt: row.saved_at
});

const toRow = (userId: string, entry: CollectionEntry) => ({
  id: entry.id,
  user_id: userId,
  item: entry.item,
  valuation: entry.valuation,
  condition: entry.condition,
  notes: entry.notes,
  purchase_price: entry.purchasePrice ?? null,
  saved_at: entry.savedAt
});

export class CloudCollectionService {
  async list(userId: string): Promise<CollectionEntry[]> {
    if (!supabase) return [];

    const { data, error } = await supabase
      .from('collection_entries')
      .select('*')
      .eq('user_id', userId)
      .order('saved_at', { ascending: false });

    if (error) throw error;
    return ((data ?? []) as CollectionEntryRow[]).map(toEntry);
  }

  async save(userId: string, entry: CollectionEntry) {
    if (!supabase) return [];

    const { error } = await supabase.from('collection_entries').upsert(toRow(userId, entry), {
      onConflict: 'user_id,id'
    });

    if (error) throw error;
    return this.list(userId);
  }

  async merge(userId: string, entries: CollectionEntry[]) {
    if (!supabase || !entries.length) return this.list(userId);

    const { error } = await supabase.from('collection_entries').upsert(
      entries.map((entry) => toRow(userId, entry)),
      { onConflict: 'user_id,id' }
    );

    if (error) throw error;
    return this.list(userId);
  }

  async replace(userId: string, entries: CollectionEntry[]) {
    if (!supabase) return [];

    const { error: deleteError } = await supabase.from('collection_entries').delete().eq('user_id', userId);
    if (deleteError) throw deleteError;

    return entries.length ? this.merge(userId, entries) : [];
  }

  async update(
    userId: string,
    id: string,
    patch: Partial<Pick<CollectionEntry, 'notes' | 'purchasePrice'> & { condition: Condition }>
  ) {
    if (!supabase) return [];

    const definedPatch = Object.fromEntries(Object.entries(patch).filter(([, value]) => value !== undefined));
    const rowPatch: Record<string, unknown> = {};

    if ('condition' in definedPatch) rowPatch.condition = definedPatch.condition;
    if ('notes' in definedPatch) rowPatch.notes = definedPatch.notes;
    if ('purchasePrice' in definedPatch) rowPatch.purchase_price = definedPatch.purchasePrice;

    const { error } = await supabase.from('collection_entries').update(rowPatch).eq('user_id', userId).eq('id', id);
    if (error) throw error;

    return this.list(userId);
  }

  async remove(userId: string, id: string) {
    if (!supabase) return [];

    const { error } = await supabase.from('collection_entries').delete().eq('user_id', userId).eq('id', id);
    if (error) throw error;

    return this.list(userId);
  }
}

export const cloudCollectionService = new CloudCollectionService();
