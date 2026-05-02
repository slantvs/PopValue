import { createClient } from '@supabase/supabase-js';

export function normalizeSupabaseUrl(value: string | undefined) {
  const trimmed = value?.trim().replace(/\/+$/, '');
  if (!trimmed) return undefined;

  return trimmed.replace(/\/rest\/v1$/, '').replace(/\/auth\/v1$/, '');
}

const supabaseUrl = normalizeSupabaseUrl(import.meta.env.VITE_SUPABASE_URL);
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = isSupabaseConfigured ? createClient(supabaseUrl!, supabaseAnonKey!) : null;
