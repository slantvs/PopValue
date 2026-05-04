import type { CollectionEntry, Condition, FunkoItem, PublicProfile, ValuationResult } from '../types';
import { supabase } from './supabaseClient';

interface ProfileRow {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url?: string | null;
  bio?: string | null;
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

const cleanProfileText = (value: string | undefined, maxLength: number) => {
  const trimmed = (value ?? '').trim().replace(/\s+/g, ' ');
  return trimmed ? trimmed.slice(0, maxLength) : null;
};

const cleanProfileUrl = (value: string | undefined) => {
  const trimmed = (value ?? '').trim();
  if (!trimmed) return null;

  try {
    const url = new URL(trimmed);
    return ['http:', 'https:'].includes(url.protocol) ? url.toString().slice(0, 300) : null;
  } catch {
    return null;
  }
};

const profileSelect = 'id, username, display_name, avatar_url, bio, collection_public';
const legacyProfileSelect = 'id, username, display_name, collection_public';

const isMissingProfileColumnError = (error: { code?: string; message?: string }) =>
  error.code === 'PGRST204' ||
  error.code === '42703' ||
  /avatar_url|bio|column/i.test(error.message ?? '');

const toProfile = (row: ProfileRow): PublicProfile | null =>
  row.username
    ? {
        id: row.id,
        username: row.username,
        displayName: row.display_name ?? undefined,
        avatarUrl: row.avatar_url ?? undefined,
        bio: row.bio ?? undefined,
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

    const initial = await supabase
      .from('profiles')
      .select(profileSelect)
      .eq('id', userId)
      .maybeSingle();
    let data: unknown = initial.data;
    let error = initial.error;

    if (error && isMissingProfileColumnError(error)) {
      const fallback = await supabase
        .from('profiles')
        .select(legacyProfileSelect)
        .eq('id', userId)
        .maybeSingle();
      data = fallback.data;
      error = fallback.error;
    }

    if (error) throw error;
    return data ? toProfile(data as ProfileRow) : null;
  }

  async saveProfile(
    userId: string,
    options: {
      username: string;
      displayName?: string;
      avatarUrl?: string;
      bio?: string;
      collectionPublic: boolean;
    }
  ) {
    if (!supabase) return null;

    const username = normalizePublicHandle(options.username);
    if (username.length < 3) throw new Error('Handle must be at least 3 characters.');

    const profilePayload = {
      id: userId,
      username,
      display_name: cleanProfileText(options.displayName, 60),
      avatar_url: cleanProfileUrl(options.avatarUrl),
      bio: cleanProfileText(options.bio, 180),
      collection_public: options.collectionPublic
    };

    const initial = await supabase
      .from('profiles')
      .upsert(profilePayload, { onConflict: 'id' })
      .select(profileSelect)
      .single();
    let data: unknown = initial.data;
    let error = initial.error;

    if (error && isMissingProfileColumnError(error)) {
      const fallback = await supabase
        .from('profiles')
        .upsert(
          {
            id: profilePayload.id,
            username: profilePayload.username,
            display_name: profilePayload.display_name,
            collection_public: profilePayload.collection_public
          },
          { onConflict: 'id' }
        )
        .select(legacyProfileSelect)
        .single();
      data = fallback.data;
      error = fallback.error;
    }

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

    const initial = await supabase
      .from('profiles')
      .select(profileSelect)
      .eq('username', handle)
      .eq('collection_public', true)
      .maybeSingle();
    let data: unknown = initial.data;
    let error = initial.error;

    if (error && isMissingProfileColumnError(error)) {
      const fallback = await supabase
        .from('profiles')
        .select(legacyProfileSelect)
        .eq('username', handle)
        .eq('collection_public', true)
        .maybeSingle();
      data = fallback.data;
      error = fallback.error;
    }

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
