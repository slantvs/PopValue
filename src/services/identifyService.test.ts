import { describe, expect, it } from 'vitest';
import { IdentifyService } from './identifyService';
import type { ManualSearchFields, ScanResult } from '../types';

const emptyManual: ManualSearchFields = {
  name: '',
  franchise: '',
  series: '',
  boxNumber: '',
  variant: ''
};

const manualScan = (query: string): ScanResult => ({
  source: 'manual',
  rawValue: query,
  confidence: 0.7,
  visualHints: query.split(/\s+/).filter(Boolean)
});

describe('IdentifyService', () => {
  it('matches compact superhero names without punctuation', () => {
    const service = new IdentifyService();
    const results = service.identifyFromScan(manualScan('spiderman 03 classic'), {
      ...emptyManual,
      name: 'spiderman',
      boxNumber: '03',
      variant: 'classic'
    });

    expect(results[0].item.id).toBe('spiderman-03-classic');
    expect(results[0].score).toBeGreaterThanOrEqual(0.55);
  });

  it('matches common aliases like grogu to The Child', () => {
    const service = new IdentifyService();
    const results = service.identifyFromScan(manualScan('grogu 345 cup'), {
      ...emptyManual,
      name: 'grogu',
      boxNumber: '345',
      variant: 'cup'
    });

    expect(results[0].item.id).toBe('mando-345-child');
    expect(results[0].score).toBeGreaterThanOrEqual(0.55);
  });

  it('treats box number 1 and 01 as the same figure number', () => {
    const service = new IdentifyService();
    const results = service.identifyFromScan(manualScan('batman 1 chase'), {
      ...emptyManual,
      name: 'Batman',
      boxNumber: '1',
      variant: 'Chase'
    });

    expect(results[0].item.id).toBe('batman-01-chase');
    expect(results[0].reasons).toContain('Box number match');
  });

  it('builds a richer marketplace query from the selected item', () => {
    const service = new IdentifyService();
    const results = service.identifyFromScan(manualScan('batman chase'), {
      ...emptyManual,
      name: 'Batman',
      variant: 'Chase'
    });

    const query = service.buildSearchQuery(emptyManual, results[0].item);

    expect(query).toContain('Funko Pop');
    expect(query).toContain('Batman');
    expect(query).toContain('DC Comics');
    expect(query).toContain('#01');
    expect(query).toContain('Chase');
  });
});
