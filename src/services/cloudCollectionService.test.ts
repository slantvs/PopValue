import { describe, expect, it } from 'vitest';
import { normalizePublicHandle } from './cloudCollectionService';

describe('normalizePublicHandle', () => {
  it('normalizes profile handles for public lookup', () => {
    expect(normalizePublicHandle('@Bradley Pops!!')).toBe('bradley-pops');
    expect(normalizePublicHandle('  POP_Value_123  ')).toBe('pop_value_123');
  });

  it('limits handles to 30 characters', () => {
    expect(normalizePublicHandle('a'.repeat(40))).toHaveLength(30);
  });
});
