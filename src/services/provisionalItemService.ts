import type { FunkoItem, ManualSearchFields } from '../types';

const placeholderImageUrl = 'https://placehold.co/600x800/111827/f8fafc?text=Funko+Pop';

export function buildProvisionalFunkoItem(rawValue: string | undefined, manual: ManualSearchFields): FunkoItem | null {
  const upc = rawValue?.match(/\d{8,14}/)?.[0];
  if (!upc) return null;

  return {
    id: `barcode-${upc}`,
    upc,
    name: manual.name.trim() || 'Funko Pop',
    franchise: manual.franchise.trim() || 'Unknown Franchise',
    series: manual.series.trim() || 'Unknown Series',
    boxNumber: manual.boxNumber.trim() || undefined,
    variant: manual.variant.trim() || undefined,
    condition: 'mint',
    imageUrl: placeholderImageUrl
  };
}
