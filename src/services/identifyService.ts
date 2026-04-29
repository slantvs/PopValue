import { mockCatalog } from '../data/mockData';
import type { FunkoItem, IdentificationCandidate, ManualSearchFields, ScanResult } from '../types';

const normalize = (value: string | undefined) => (value ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

export class IdentifyService {
  identifyFromScan(scan: ScanResult, manual: ManualSearchFields): IdentificationCandidate[] {
    const manualQuery = this.buildSearchQuery(manual);
    const raw = scan.rawValue ?? '';
    const visualQuery = scan.visualHints?.join(' ') ?? '';

    const scored = mockCatalog
      .map((item) => this.scoreCandidate(item, raw, `${manualQuery} ${visualQuery}`, manual))
      .filter((candidate) => candidate.score > 0.12)
      .sort((a, b) => b.score - a.score);

    return scored.length ? scored : this.fallbackCandidates(manualQuery);
  }

  buildSearchQuery(fields: ManualSearchFields, item?: FunkoItem) {
    if (item) {
      return ['Funko Pop', item.name, item.boxNumber && `#${item.boxNumber}`, item.variant]
        .filter(Boolean)
        .join(' ');
    }

    return [fields.name, fields.franchise, fields.series, fields.boxNumber && `#${fields.boxNumber}`, fields.variant]
      .filter(Boolean)
      .join(' ');
  }

  private scoreCandidate(
    item: FunkoItem,
    raw: string,
    manualQuery: string,
    manual: ManualSearchFields
  ): IdentificationCandidate {
    let score = 0;
    const reasons: string[] = [];

    if (raw && item.upc === raw) {
      score += 0.7;
      reasons.push('UPC match');
    }

    const itemText = normalize(`${item.name} ${item.franchise} ${item.series} ${item.boxNumber} ${item.variant} ${item.sticker}`);
    const queryTokens = normalize(manualQuery).split(' ').filter(Boolean);
    const matchedTokens = queryTokens.filter((token) => itemText.includes(token));

    if (queryTokens.length) {
      const ratio = matchedTokens.length / queryTokens.length;
      score += ratio * 0.45;
      if (matchedTokens.length) reasons.push(`${matchedTokens.length} text signals matched`);
    }

    if (manual.boxNumber && item.boxNumber === manual.boxNumber) {
      score += 0.18;
      reasons.push('Box number match');
    }

    if (manual.variant && normalize(item.variant).includes(normalize(manual.variant))) {
      score += 0.12;
      reasons.push('Variant match');
    }

    return { item, score: Math.min(score, 1), reasons };
  }

  private fallbackCandidates(query: string) {
    const tokens = normalize(query).split(' ').filter(Boolean);
    if (!tokens.length) return mockCatalog.slice(0, 3).map((item) => ({ item, score: 0.2, reasons: ['Popular mock match'] }));

    return mockCatalog
      .filter((item) => tokens.some((token) => normalize(`${item.name} ${item.franchise} ${item.series}`).includes(token)))
      .slice(0, 3)
      .map((item) => ({ item, score: 0.3, reasons: ['Loose text match'] }));
  }
}

export const identifyService = new IdentifyService();
