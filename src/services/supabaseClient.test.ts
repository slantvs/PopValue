import { describe, expect, it } from 'vitest';
import { normalizeSupabaseUrl } from './supabaseClient';

describe('normalizeSupabaseUrl', () => {
  it('keeps the base project URL unchanged', () => {
    expect(normalizeSupabaseUrl('https://example.supabase.co')).toBe('https://example.supabase.co');
  });

  it('strips REST and Auth endpoint suffixes from pasted Supabase URLs', () => {
    expect(normalizeSupabaseUrl('https://example.supabase.co/rest/v1/')).toBe('https://example.supabase.co');
    expect(normalizeSupabaseUrl('https://example.supabase.co/auth/v1')).toBe('https://example.supabase.co');
  });
});
