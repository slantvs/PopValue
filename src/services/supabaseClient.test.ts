import { describe, expect, it } from 'vitest';
import { normalizeSupabaseUrl, resolveSupabaseConfig } from './supabaseClient';

describe('normalizeSupabaseUrl', () => {
  it('keeps the base project URL unchanged', () => {
    expect(normalizeSupabaseUrl('https://example.supabase.co')).toBe('https://example.supabase.co');
  });

  it('strips REST and Auth endpoint suffixes from pasted Supabase URLs', () => {
    expect(normalizeSupabaseUrl('https://example.supabase.co/rest/v1/')).toBe('https://example.supabase.co');
    expect(normalizeSupabaseUrl('https://example.supabase.co/auth/v1')).toBe('https://example.supabase.co');
  });
});

describe('resolveSupabaseConfig', () => {
  it('prefers Vercel Supabase integration public env vars over legacy Vite vars', () => {
    expect(
      resolveSupabaseConfig({
        VITE_SUPABASE_URL: 'https://old.supabase.co',
        VITE_SUPABASE_ANON_KEY: 'old-key',
        NEXT_PUBLIC_SUPABASE_URL: 'https://new.supabase.co/rest/v1',
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'new-key'
      })
    ).toEqual({
      supabaseUrl: 'https://new.supabase.co',
      supabaseAnonKey: 'new-key'
    });
  });

  it('falls back to existing Vite Supabase vars', () => {
    expect(
      resolveSupabaseConfig({
        VITE_SUPABASE_URL: 'https://example.supabase.co',
        VITE_SUPABASE_ANON_KEY: 'anon-key'
      })
    ).toEqual({
      supabaseUrl: 'https://example.supabase.co',
      supabaseAnonKey: 'anon-key'
    });
  });
});
