import { describe, expect, it } from 'vitest';
import { buildProvisionalFunkoItem } from './provisionalItemService';
import type { ManualSearchFields } from '../types';

const emptyManual: ManualSearchFields = {
  name: '',
  franchise: '',
  series: '',
  boxNumber: '',
  variant: ''
};

describe('buildProvisionalFunkoItem', () => {
  it('builds a marketplace-searchable item from an unknown barcode', () => {
    const item = buildProvisionalFunkoItem('UPC 889698455898', emptyManual);

    expect(item).toMatchObject({
      id: 'barcode-889698455898',
      upc: '889698455898',
      name: 'Funko Pop',
      franchise: 'Unknown Franchise',
      series: 'Unknown Series',
      condition: 'mint'
    });
  });

  it('uses manual context when provided', () => {
    const item = buildProvisionalFunkoItem('830395022260', {
      name: 'Batman',
      franchise: 'DC Comics',
      series: 'Heroes',
      boxNumber: '01',
      variant: 'Chase'
    });

    expect(item).toMatchObject({
      name: 'Batman',
      franchise: 'DC Comics',
      series: 'Heroes',
      boxNumber: '01',
      variant: 'Chase'
    });
  });

  it('returns null when no barcode-like digits exist', () => {
    expect(buildProvisionalFunkoItem('not a barcode', emptyManual)).toBeNull();
  });

  it('builds a marketplace-searchable item from manual details without a barcode', () => {
    const item = buildProvisionalFunkoItem('Orihime Inoue Bleach #1611', {
      ...emptyManual,
      name: 'Orihime Inoue',
      franchise: 'Bleach',
      boxNumber: '1611'
    });

    expect(item).toMatchObject({
      id: 'manual-orihime-inoue-bleach-1611',
      upc: undefined,
      name: 'Orihime Inoue',
      franchise: 'Bleach',
      series: 'Unknown Series',
      boxNumber: '1611'
    });
  });
});
