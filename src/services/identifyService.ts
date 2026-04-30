import { mockCatalog } from '../data/mockData';
import type { FunkoItem, IdentificationCandidate, ManualSearchFields, ScanResult } from '../types';

const normalize = (value: string | undefined) => (value ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const compact = (value: string | undefined) => normalize(value).replace(/\s+/g, '');
const unique = <T>(values: T[]) => [...new Set(values)];

const stopWords = new Set(['a', 'an', 'and', 'figure', 'funko', 'pop', 'the', 'vinyl', 'with']);

const aliasMap: Record<string, string[]> = {
  'baby yoda': ['the child', 'grogu'],
  dc: ['dc comics'],
  grogu: ['the child', 'baby yoda'],
  mando: ['mandalorian', 'the mandalorian'],
  mandalorian: ['mando'],
  spiderman: ['spider man', 'spider-man'],
  'spider man': ['spiderman', 'spider-man'],
  'strangerthings': ['stranger things'],
  'starwars': ['star wars']
};

const tokenize = (value: string | undefined) =>
  normalize(value)
    .split(' ')
    .filter((token) => token && !stopWords.has(token));

const normalizeBoxNumber = (value: string | undefined) => {
  const digits = normalize(value).match(/\d+/)?.[0];
  if (!digits) return '';
  return digits.replace(/^0+/, '') || '0';
};

const expandTokens = (value: string | undefined) => {
  const normalized = normalize(value);
  const compacted = compact(value);
  const aliases = Object.entries(aliasMap).flatMap(([alias, expansions]) => {
    const normalizedAlias = normalize(alias);
    const compactAlias = compact(alias);
    return normalized.includes(normalizedAlias) || compacted.includes(compactAlias) ? expansions : [];
  });

  return unique([...tokenize(normalized), ...aliases.flatMap(tokenize), compacted].filter((token) => token.length > 1));
};

const looseTokenMatch = (token: string, targetTokens: string[]) => {
  if (token.length < 5) return false;
  return targetTokens.some((target) => {
    if (target.length < 5 || Math.abs(target.length - token.length) > 1) return false;
    let edits = 0;
    for (let index = 0; index < Math.max(token.length, target.length); index += 1) {
      if (token[index] !== target[index]) edits += 1;
      if (edits > 1) return false;
    }
    return true;
  });
};

const textScore = (query: string | undefined, target: string | undefined) => {
  const queryTokens = expandTokens(query);
  if (!queryTokens.length) return { score: 0, matchedCount: 0 };

  const normalizedTarget = normalize(target);
  const compactTarget = compact(target);
  const targetTokens = tokenize(target);
  const matchedTokens = queryTokens.filter(
    (token) =>
      targetTokens.includes(token) ||
      normalizedTarget.includes(token) ||
      compactTarget.includes(token) ||
      looseTokenMatch(token, targetTokens)
  );
  const phraseMatches = normalizedTarget.includes(normalize(query)) || compactTarget.includes(compact(query));
  const score = Math.min(matchedTokens.length / queryTokens.length + (phraseMatches ? 0.15 : 0), 1);

  return { score, matchedCount: unique(matchedTokens).length };
};

export class IdentifyService {
  identifyFromScan(scan: ScanResult, manual: ManualSearchFields): IdentificationCandidate[] {
    const manualQuery = this.buildSearchQuery(manual);
    const raw = scan.rawValue ?? '';
    const visualQuery = scan.visualHints?.join(' ') ?? '';

    const scored = mockCatalog
      .map((item) => this.scoreCandidate(item, raw, `${manualQuery} ${visualQuery}`, manual))
      .filter((candidate) => candidate.score > 0.1)
      .sort((a, b) => b.score - a.score);

    return scored.length ? scored : this.fallbackCandidates(manualQuery);
  }

  buildSearchQuery(fields: ManualSearchFields, item?: FunkoItem) {
    if (item) {
      return unique([
        'Funko Pop',
        item.name,
        item.franchise,
        item.series,
        item.boxNumber && `#${item.boxNumber}`,
        item.boxNumber,
        item.variant,
        item.sticker
      ])
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

    const rawDigits = raw.match(/\d{8,14}/)?.[0];
    if (rawDigits && item.upc === rawDigits) {
      score += 0.7;
      reasons.push('UPC match');
    }

    const itemText = `${item.name} ${item.franchise} ${item.series} ${item.boxNumber} ${item.variant} ${item.sticker}`;
    const broadMatch = textScore(manualQuery, itemText);
    if (broadMatch.matchedCount) {
      score += broadMatch.score * 0.4;
      reasons.push(`${broadMatch.matchedCount} text signals matched`);
    }

    const nameMatch = textScore(manual.name, item.name);
    if (nameMatch.matchedCount) {
      score += nameMatch.score * 0.22;
      reasons.push('Name match');
    }

    const franchiseMatch = textScore(manual.franchise, item.franchise);
    if (franchiseMatch.matchedCount) {
      score += franchiseMatch.score * 0.12;
      reasons.push('Franchise match');
    }

    const seriesMatch = textScore(manual.series, item.series);
    if (seriesMatch.matchedCount) {
      score += seriesMatch.score * 0.1;
      reasons.push('Series match');
    }

    if (manual.boxNumber && normalizeBoxNumber(item.boxNumber) === normalizeBoxNumber(manual.boxNumber)) {
      score += 0.22;
      reasons.push('Box number match');
    } else if (manual.boxNumber) {
      score -= 0.1;
    }

    const variantMatch = textScore(manual.variant, `${item.variant} ${item.sticker}`);
    if (variantMatch.matchedCount) {
      score += 0.12;
      reasons.push('Variant/sticker match');
    }

    return { item, score: Math.max(0, Math.min(score, 1)), reasons: unique(reasons) };
  }

  private fallbackCandidates(query: string) {
    const tokens = expandTokens(query);
    if (!tokens.length) return mockCatalog.slice(0, 3).map((item) => ({ item, score: 0.2, reasons: ['Popular mock match'] }));

    return mockCatalog
      .filter((item) => {
        const searchable = `${item.name} ${item.franchise} ${item.series} ${item.variant} ${item.sticker}`;
        return tokens.some((token) => normalize(searchable).includes(token) || compact(searchable).includes(token));
      })
      .slice(0, 3)
      .map((item) => ({ item, score: 0.3, reasons: ['Loose text match'] }));
  }
}

export const identifyService = new IdentifyService();
