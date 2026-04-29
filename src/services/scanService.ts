import type { ScanResult } from '../types';

type BarcodeDetectorConstructor = new (options?: { formats?: string[] }) => {
  detect(source: ImageBitmapSource): Promise<Array<{ rawValue: string }>>;
};

export class ScanService {
  async scanImage(file: File): Promise<ScanResult> {
    const imagePreview = URL.createObjectURL(file);
    const detector = this.getBarcodeDetector();

    if (!detector) {
      return {
        source: 'upload',
        confidence: 0.35,
        imagePreview,
        rawValue: this.extractDigits(file.name),
        visualHints: this.extractFilenameHints(file.name)
      };
    }

    let bitmap: ImageBitmap | null = null;

    try {
      bitmap = await createImageBitmap(file);
      const matches = await detector.detect(bitmap);

      return {
        source: 'upload',
        confidence: matches[0]?.rawValue ? 0.95 : 0.25,
        imagePreview,
        rawValue: matches[0]?.rawValue ?? this.extractDigits(file.name),
        visualHints: this.extractFilenameHints(file.name)
      };
    } catch {
      return {
        source: 'upload',
        confidence: 0.25,
        imagePreview,
        rawValue: this.extractDigits(file.name),
        visualHints: this.extractFilenameHints(file.name)
      };
    } finally {
      bitmap?.close();
    }
  }

  buildManualScan(query: string): ScanResult {
    return {
      source: 'manual',
      rawValue: query,
      confidence: query.trim().length > 2 ? 0.7 : 0.2,
      visualHints: query.split(/\s+/).filter(Boolean)
    };
  }

  private getBarcodeDetector() {
    const detector = (window as unknown as { BarcodeDetector?: BarcodeDetectorConstructor }).BarcodeDetector;
    if (!detector) return null;
    return new detector({ formats: ['ean_13', 'upc_a', 'upc_e', 'code_128'] });
  }

  private extractDigits(value: string) {
    return value.match(/\d{8,14}/)?.[0];
  }

  private extractFilenameHints(value: string) {
    return value
      .replace(/\.[^.]+$/, '')
      .split(/[^a-zA-Z0-9]+/)
      .filter((token) => token.length >= 2 && !/^\d{8,14}$/.test(token));
  }
}

export const scanService = new ScanService();
