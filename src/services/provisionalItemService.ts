import type { FunkoItem, ManualSearchFields } from '../types';

const placeholderImageUrl = 'https://placehold.co/600x800/111827/f8fafc?text=Funko+Pop';

export function buildProvisionalFunkoItem(rawValue: string | undefined, manual: ManualSearchFields): FunkoItem | null {
  const upc = rawValue?.match(/\d{8,14}/)?.[0];
  const name = manual.name.trim();
  const franchise = manual.franchise.trim();
  const series = manual.series.trim();
  const boxNumber = manual.boxNumber.trim();
  const variant = manual.variant.trim();
  const hasManualDetail = [name, franchise, series, boxNumber, variant].some(Boolean);

  if (!upc && !hasManualDetail) return null;

  const idSeed = [upc, name, franchise, series, boxNumber, variant]
    .filter(Boolean)
    .join('-')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  return {
    id: upc ? `barcode-${upc}` : `manual-${idSeed}`,
    upc: upc || undefined,
    name: name || 'Funko Pop',
    franchise: franchise || 'Unknown Franchise',
    series: series || 'Unknown Series',
    boxNumber: boxNumber || undefined,
    variant: variant || undefined,
    condition: 'mint',
    imageUrl: placeholderImageUrl
  };
}
