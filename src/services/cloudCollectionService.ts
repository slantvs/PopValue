import type { CollectionEntry, Condition, FunkoItem, PublicProfile, ValuationResult } from '../types';
import { supabase } from './supabaseClient';

interface ProfileRow {
  id: string;
  username: string | null;
  display_name: string | null;
  collection_public: boolean | null;
}

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

export const normalizePublicHandle = (value: string) =>
  value
    .trim()
    .replace(/^@+/, '')
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 30);

const toProfile = (row: ProfileRow): PublicProfile | null =>
  row.username
    ? {
        id: row.id,
        username: row.username,
        displayName: row.display_name ?? undefined,
        collectionPublic: row.collection_public ?? true
      }
    : null;

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
  async getProfile(userId: string): Promise<PublicProfile | null> {
    if (!supabase) return null;

    const { data, error } = await supabase
      .from('profiles')
      .select('id, username, display_name, collection_public')
      .eq('id', userId)
      .maybeSingle();

    if (error) throw error;
    return data ? toProfile(data as ProfileRow) : null;
  }

  async saveProfile(userId: string, options: { username: string; collectionPublic: boolean }) {
    if (!supabase) return null;

    const username = normalizePublicHandle(options.username);
    if (username.length < 3) throw new Error('Handle must be at least 3 characters.');

    const { data, error } = await supabase
      .from('profiles')
      .upsert(
        {
          id: userId,
          username,
          collection_public: options.collectionPublic
        },
        { onConflict: 'id' }
      )
      .select('id, username, display_name, collection_public')
      .single();

    if (error) {
      if (error.code === '23505') throw new Error('That profile name is already taken.');
      throw error;
    }

    return toProfile(data as ProfileRow);
  }

  async findPublicProfile(username: string): Promise<PublicProfile | null> {
    if (!supabase) return null;

    const handle = normalizePublicHandle(username);
    if (handle.length < 3) return null;

    const { data, error } = await supabase
      .from('profiles')
      .select('id, username, display_name, collection_public')
      .eq('username', handle)
      .eq('collection_public', true)
      .maybeSingle();

    if (error) throw error;
    return data ? toProfile(data as ProfileRow) : null;
  }

  async listPublic(userId: string): Promise<CollectionEntry[]> {
    if (!supabase) return [];

    const { data, error } = await supabase
      .from('collection_entries')
      .select('*')
      .eq('user_id', userId)
      .order('saved_at', { ascending: false });

    if (error) throw error;
    return ((data ?? []) as CollectionEntryRow[]).map(toEntry);
  }

  async lookupPublicCollection(username: string) {
    const profile = await this.findPublicProfile(username);
    if (!profile) return null;

    return {
      profile,
      entries: await this.listPublic(profile.id)
    };
  }

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
