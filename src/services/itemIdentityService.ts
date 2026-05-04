import type { EbayListing, FunkoItem } from '../types';

interface ParsedItemIdentity {
  name?: string;
  franchise?: string;
  series?: string;
  boxNumber?: string;
  variant?: string;
}

const lineMatchers: Array<{ pattern: RegExp; value: string }> = [
  { pattern: /\banimation\b/i, value: 'Animation' },
  { pattern: /\bgames?\b/i, value: 'Games' },
  { pattern: /\btelevision\b|\btv\b/i, value: 'Television' },
  { pattern: /\bmovies?\b/i, value: 'Movies' },
  { pattern: /\bmarvel\b/i, value: 'Marvel' },
  { pattern: /\bheroes\b/i, value: 'Heroes' },
  { pattern: /\bstar wars\b/i, value: 'Star Wars' },
  { pattern: /\bad icons\b/i, value: 'Ad Icons' },
  { pattern: /\brocks\b/i, value: 'Rocks' },
  { pattern: /\bretro toys\b/i, value: 'Retro Toys' },
  { pattern: /\bwwe\b/i, value: 'WWE' },
  { pattern: /\bnba\b/i, value: 'NBA' },
  { pattern: /\bnfl\b/i, value: 'NFL' },
  { pattern: /\bmlb\b/i, value: 'MLB' }
];

const franchiseMatchers: Array<{ pattern: RegExp; value: string; series?: string }> = [
  { pattern: /\bjujutsu kaisen\b/i, value: 'Jujutsu Kaisen', series: 'Animation' },
  { pattern: /\bbleach\b/i, value: 'Bleach', series: 'Animation' },
  { pattern: /\bkaiju\s*no\.?\s*8\b/i, value: 'Kaiju No. 8', series: 'Animation' },
  { pattern: /\bone piece\b/i, value: 'One Piece', series: 'Animation' },
  { pattern: /\bhunter\s*x\s*hunter\b/i, value: 'Hunter x Hunter', series: 'Animation' },
  { pattern: /\bmy hero academia\b/i, value: 'My Hero Academia', series: 'Animation' },
  { pattern: /\bdemon slayer\b/i, value: 'Demon Slayer', series: 'Animation' },
  { pattern: /\bnaruto\b|\bboruto\b/i, value: 'Naruto', series: 'Animation' },
  { pattern: /\bdragon ball(?: z| super| gt)?\b/i, value: 'Dragon Ball', series: 'Animation' },
  { pattern: /\battack on titan\b/i, value: 'Attack on Titan', series: 'Animation' },
  { pattern: /\btokyo ghoul\b/i, value: 'Tokyo Ghoul', series: 'Animation' },
  { pattern: /\bchainsaw man\b/i, value: 'Chainsaw Man', series: 'Animation' },
  { pattern: /\bpokemon\b|\bpok[eé]mon\b/i, value: 'Pokemon', series: 'Games' },
  { pattern: /\bspider[- ]?man\b/i, value: 'Spider-Man', series: 'Marvel' },
  { pattern: /\bdoctor strange\b/i, value: 'Doctor Strange', series: 'Marvel' },
  { pattern: /\bdeadpool\b/i, value: 'Deadpool', series: 'Marvel' },
  { pattern: /\bx[- ]?men\b/i, value: 'X-Men', series: 'Marvel' },
  { pattern: /\bmarvel\b|\bavengers\b/i, value: 'Marvel', series: 'Marvel' },
  { pattern: /\bbatman\b/i, value: 'Batman', series: 'Heroes' },
  { pattern: /\bdc comics\b|\bdc heroes\b|\bdc\b/i, value: 'DC Comics', series: 'Heroes' },
  { pattern: /\bstar wars\b|\bmandalorian\b/i, value: 'Star Wars', series: 'Star Wars' },
  { pattern: /\bdisney\b/i, value: 'Disney', series: 'Disney' },
  { pattern: /\bharry potter\b/i, value: 'Harry Potter', series: 'Movies' },
  { pattern: /\bstranger things\b/i, value: 'Stranger Things', series: 'Television' },
  { pattern: /\bteenage mutant ninja turtles\b|\btmnt\b/i, value: 'Teenage Mutant Ninja Turtles', series: 'Retro Toys' },
  { pattern: /\btransformers\b/i, value: 'Transformers', series: 'Retro Toys' },
  { pattern: /\bspongebob\b/i, value: 'SpongeBob SquarePants', series: 'Television' }
];

const variantMatchers: Array<{ pattern: RegExp; value: string }> = [
  { pattern: /\bchase\b/i, value: 'Chase' },
  { pattern: /\bglow in the dark\b|\bgitd\b|\bglow\b/i, value: 'Glow in the dark' },
  { pattern: /\bspecial edition\b/i, value: 'Special Edition' },
  { pattern: /\bflocked\b/i, value: 'Flocked' },
  { pattern: /\bmetallic\b/i, value: 'Metallic' },
  { pattern: /\bdiamond\b/i, value: 'Diamond' },
  { pattern: /\bblacklight\b|\bblack light\b/i, value: 'Blacklight' },
  { pattern: /\bchalice\b/i, value: 'Chalice Collectibles' },
  { pattern: /\bboxlunch\b|\bbox lunch\b/i, value: 'BoxLunch' },
  { pattern: /\bhot topic\b/i, value: 'Hot Topic' },
  { pattern: /\bwalmart\b/i, value: 'Walmart' },
  { pattern: /\btarget\b/i, value: 'Target' },
  { pattern: /\bgamestop\b|\bgame stop\b/i, value: 'GameStop' },
  { pattern: /\bexclusive\b/i, value: 'Exclusive' }
];

const genericNamePattern = /^funko\s*pop!?$/i;
const unknownPattern = /^unknown\b/i;

const normalizeSpaces = (value: string) => value.replace(/\s+/g, ' ').trim();
const unique = <T>(values: T[]) => [...new Set(values)];

function findFirstMatch<T extends { pattern: RegExp }>(title: string, matchers: T[]) {
  return matchers.find((matcher) => matcher.pattern.test(title));
}

function cleanNoise(value: string) {
  return normalizeSpaces(
    value
      .replace(/\.{3,}/g, ' ')
      .replace(/\[[^\]]*(?:collectible|good|new|toy|used|vinyl)[^\]]*\]/gi, ' ')
      .replace(/\([^)]*(?:animation|common|chase|exclusive|glow|protector|special edition)[^)]*\)/gi, ' ')
      .replace(/\bfunko\b|\bpop!?\b|\bvinyl\b|\bfigure\b|\bcollectibles?\b|\bcollect\b|\btoys?\b/gi, ' ')
      .replace(/\bnew\b|\bnib\b|\bmint\b|\bbox\b|\bin hand\b|\bpre[- ]?order\b/gi, ' ')
      .replace(/\bw\/?\s*protector\b|\bwith protector\b|\bprotector included\b/gi, ' ')
      .replace(/\bcommon\b|\boob\b|\bout of box\b/gi, ' ')
      .replace(/\s+#?\d{1,5}[a-z]?\b/gi, ' ')
  );
}

function cleanNameCandidate(value: string, franchise?: string, series?: string) {
  let cleaned = cleanNoise(value);

  for (const matcher of variantMatchers) {
    cleaned = cleaned.replace(matcher.pattern, ' ');
  }

  if (franchise) cleaned = cleaned.replace(new RegExp(franchise.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), ' ');
  if (series) cleaned = cleaned.replace(new RegExp(series.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), ' ');

  const [firstSegment, ...rest] = cleaned.split(/\s+-\s+/);
  if (firstSegment && rest.length && firstSegment.split(/\s+/).length <= 5) cleaned = firstSegment;

  cleaned = normalizeSpaces(cleaned.replace(/^[^\w]+|[^\w]+$/g, ''));
  return cleaned.length >= 2 ? cleaned : undefined;
}

function extractBoxNumber(title: string) {
  return title.match(/#\s*(\d{1,5}[a-z]?)/i)?.[1] ?? title.match(/\bnumber\s+(\d{1,5}[a-z]?)\b/i)?.[1];
}

function extractVariant(title: string) {
  const variants = unique(variantMatchers.filter((matcher) => matcher.pattern.test(title)).map((matcher) => matcher.value));
  return variants.length ? variants.join(', ') : undefined;
}

function parseLineColonTitle(title: string): ParsedItemIdentity | null {
  const match = title.match(/\bpop!?\s+([^:]{3,30}):\s*([^#|-]+?)\s+-\s+([^#|]+?)(?:\s+#|$)/i);
  if (!match) return null;

  const line = cleanNoise(match[1]);
  const lineMatch = findFirstMatch(line, lineMatchers);
  const franchiseMatch = findFirstMatch(match[2], franchiseMatchers);
  const franchise = franchiseMatch?.value ?? cleanNoise(match[2]);
  const series = lineMatch?.value ?? franchiseMatch?.series;
  const name = cleanNameCandidate(match[3], franchise, series);

  return name ? { name, franchise, series, boxNumber: extractBoxNumber(title), variant: extractVariant(title) } : null;
}

function parseVinylColonTitle(title: string): ParsedItemIdentity | null {
  const match = title.match(/\bpop!?\s*(?:vinyl\s*)?:\s*([^#|-]+?)\s+-\s+([^#|]+?)(?:\s+#|$)/i);
  if (!match) return null;

  const franchiseMatch = findFirstMatch(match[1], franchiseMatchers);
  const franchise = franchiseMatch?.value ?? cleanNoise(match[1]);
  const series = findFirstMatch(title, lineMatchers)?.value ?? franchiseMatch?.series;
  const name = cleanNameCandidate(match[2], franchise, series);

  return name ? { name, franchise, series, boxNumber: extractBoxNumber(title), variant: extractVariant(title) } : null;
}

function parseKnownFranchiseDashTitle(title: string, franchise: string | undefined, series: string | undefined) {
  if (!franchise) return null;

  const segments = title
    .split(/\s+-\s+/)
    .map((segment) => segment.trim())
    .filter(Boolean);
  const franchiseIndex = segments.findIndex((segment) => findFirstMatch(segment, franchiseMatchers)?.value === franchise);
  const name = franchiseIndex >= 0 ? cleanNameCandidate(segments[franchiseIndex + 1] ?? '', franchise, series) : undefined;

  return name ? { name, franchise, series, boxNumber: extractBoxNumber(title), variant: extractVariant(title) } : null;
}

export function parseListingIdentity(title: string): ParsedItemIdentity | null {
  const normalizedTitle = normalizeSpaces(title);
  const franchiseMatch = findFirstMatch(normalizedTitle, franchiseMatchers);
  const lineMatch = findFirstMatch(normalizedTitle, lineMatchers);
  const franchise = franchiseMatch?.value;
  const series = lineMatch?.value ?? franchiseMatch?.series;

  const explicitParsed = parseLineColonTitle(normalizedTitle) ?? parseVinylColonTitle(normalizedTitle);
  if (explicitParsed) {
    return {
      ...explicitParsed,
      franchise: explicitParsed.franchise || franchise,
      series: explicitParsed.series || series
    };
  }

  const franchiseDashParsed = parseKnownFranchiseDashTitle(normalizedTitle, franchise, series);
  if (franchiseDashParsed) return franchiseDashParsed;

  const name = cleanNameCandidate(normalizedTitle, franchise, series);
  if (!name && !franchise && !series) return null;

  return {
    name,
    franchise,
    series,
    boxNumber: extractBoxNumber(normalizedTitle),
    variant: extractVariant(normalizedTitle)
  };
}

function scoreIdentity(identity: ParsedItemIdentity, listing: EbayListing) {
  return (
    (listing.source === 'ebay' ? 4 : 0) +
    (identity.name ? 5 : 0) +
    (identity.franchise ? 3 : 0) +
    (identity.series ? 2 : 0) +
    (identity.boxNumber ? 2 : 0) +
    (identity.variant ? 1 : 0)
  );
}

function normalizeIdentityValue(value: string | undefined) {
  return normalizeSpaces((value ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' '));
}

function isCompatibleIdentity(base: ParsedItemIdentity, next: ParsedItemIdentity) {
  const baseName = normalizeIdentityValue(base.name);
  const nextName = normalizeIdentityValue(next.name);
  const baseFranchise = normalizeIdentityValue(base.franchise);
  const nextFranchise = normalizeIdentityValue(next.franchise);

  return (
    (!baseName || !nextName || baseName === nextName) &&
    (!baseFranchise || !nextFranchise || baseFranchise === nextFranchise)
  );
}

function inferIdentityFromListings(listings: EbayListing[]) {
  const liveListings = listings.filter((listing) => listing.source === 'ebay');
  const candidates = (liveListings.length ? liveListings : listings)
    .map((listing) => ({ identity: parseListingIdentity(listing.title), listing }))
    .filter((candidate): candidate is { identity: ParsedItemIdentity; listing: EbayListing } => Boolean(candidate.identity))
    .sort((a, b) => scoreIdentity(b.identity, b.listing) - scoreIdentity(a.identity, a.listing));

  const best = candidates[0]?.identity;
  if (!best) return undefined;

  return candidates.slice(1).reduce(
    (identity, candidate) =>
      isCompatibleIdentity(identity, candidate.identity)
        ? {
            ...identity,
            franchise: identity.franchise || candidate.identity.franchise,
            series: identity.series || candidate.identity.series,
            boxNumber: identity.boxNumber || candidate.identity.boxNumber,
            variant: identity.variant || candidate.identity.variant
          }
        : identity,
    { ...best }
  );
}

const shouldFillText = (value: string | undefined) => !value || unknownPattern.test(value) || genericNamePattern.test(value);

export function enrichItemIdentityFromListings(item: FunkoItem, listings: EbayListing[]): FunkoItem {
  const identity = inferIdentityFromListings(listings);
  if (!identity) return item;

  return {
    ...item,
    name: shouldFillText(item.name) && identity.name ? identity.name : item.name,
    franchise: shouldFillText(item.franchise) && identity.franchise ? identity.franchise : item.franchise,
    series: shouldFillText(item.series) && identity.series ? identity.series : item.series,
    boxNumber: item.boxNumber || identity.boxNumber,
    variant: item.variant || identity.variant
  };
}
