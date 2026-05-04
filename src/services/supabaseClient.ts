import { createClient } from '@supabase/supabase-js';

type SupabaseEnv = Partial<Record<string, string | undefined>>;

const firstNonEmpty = (...values: Array<string | undefined>) =>
  values.find((value) => Boolean(value?.trim()))?.trim();

export function normalizeSupabaseUrl(value: string | undefined) {
  const trimmed = value?.trim().replace(/\/+$/, '');
  if (!trimmed) return undefined;

  return trimmed.replace(/\/rest\/v1$/, '').replace(/\/auth\/v1$/, '');
}

export function resolveSupabaseConfig(env: SupabaseEnv) {
  return {
    supabaseUrl: normalizeSupabaseUrl(
      firstNonEmpty(env.NEXT_PUBLIC_SUPABASE_URL, env.VITE_SUPABASE_URL)
    ),
    supabaseAnonKey: firstNonEmpty(
      env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
      env.VITE_SUPABASE_PUBLISHABLE_KEY,
      env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      env.VITE_SUPABASE_ANON_KEY
    )
  };
}

const { supabaseUrl, supabaseAnonKey } = resolveSupabaseConfig(import.meta.env);

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = isSupabaseConfigured ? createClient(supabaseUrl!, supabaseAnonKey!) : null;
