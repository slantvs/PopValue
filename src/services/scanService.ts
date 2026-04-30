import type { ScanResult } from '../types';
import type { DecodeHintType as DecodeHintTypeValue } from '@zxing/library';

type BarcodeDetectorConstructor = new (options?: { formats?: string[] }) => {
  detect(source: ImageBitmapSource): Promise<Array<{ rawValue: string }>>;
};

export interface CameraScannerControls {
  stop: () => void;
  switchTorch?: (onOff: boolean) => Promise<void>;
}

interface BarcodeImageReader {
  decodeFromImageUrl(url?: string): Promise<{ getText(): string }>;
  decodeFromConstraints?(
    constraints: MediaStreamConstraints,
    previewElem: HTMLVideoElement,
    callbackFn: (
      result: { getText(): string } | undefined,
      error: Error | undefined,
      controls: CameraScannerControls
    ) => void
  ): Promise<CameraScannerControls>;
}

type BarcodeImageReaderFactory = () => BarcodeImageReader | Promise<BarcodeImageReader>;

export class ScanService {
  constructor(private zxingReaderFactory: BarcodeImageReaderFactory = createZxingReader) {}

  async scanImage(file: File): Promise<ScanResult> {
    const imagePreview = URL.createObjectURL(file);
    const nativeValue = await this.decodeWithNativeDetector(file);
    const zxingValue = nativeValue ? undefined : await this.decodeWithZxing(imagePreview);
    const rawValue = nativeValue ?? zxingValue ?? this.extractDigits(file.name);

    return {
      source: 'upload',
      confidence: nativeValue ? 0.98 : zxingValue ? 0.9 : rawValue ? 0.45 : 0.2,
      imagePreview,
      rawValue,
      visualHints: this.extractFilenameHints(file.name)
    };
  }

  buildManualScan(query: string): ScanResult {
    return {
      source: 'manual',
      rawValue: query,
      confidence: query.trim().length > 2 ? 0.7 : 0.2,
      visualHints: query.split(/\s+/).filter(Boolean)
    };
  }

  buildBarcodeScan(rawValue: string, source: ScanResult['source'] = 'camera'): ScanResult {
    return {
      source,
      rawValue,
      confidence: rawValue.trim() ? 0.98 : 0.2,
      visualHints: []
    };
  }

  async startCameraScan(videoElement: HTMLVideoElement, onDetected: (rawValue: string) => void) {
    const reader = await this.zxingReaderFactory();
    if (!reader.decodeFromConstraints) throw new Error('Camera scanning is unavailable in this browser.');

    const constraints: MediaStreamConstraints = {
      audio: false,
      video: {
        facingMode: { ideal: 'environment' },
        width: { ideal: 1280 },
        height: { ideal: 720 }
      }
    };

    return reader.decodeFromConstraints(constraints, videoElement, (result, error, controls) => {
      if (result) {
        controls.stop();
        onDetected(result.getText());
        return;
      }

      if (error && !this.isExpectedScanMiss(error)) {
        console.info('Barcode scan retrying after decoder error:', error.message);
      }
    });
  }

  private getBarcodeDetector() {
    const detector = (globalThis as unknown as { BarcodeDetector?: BarcodeDetectorConstructor }).BarcodeDetector;
    if (!detector) return null;
    return new detector({ formats: ['ean_13', 'upc_a', 'upc_e', 'code_128'] });
  }

  private async decodeWithNativeDetector(file: File) {
    const detector = this.getBarcodeDetector();
    if (!detector) return undefined;

    let bitmap: ImageBitmap | null = null;

    try {
      bitmap = await createImageBitmap(file);
      const matches = await detector.detect(bitmap);
      return matches[0]?.rawValue;
    } catch {
      return undefined;
    } finally {
      bitmap?.close();
    }
  }

  private async decodeWithZxing(imagePreview: string) {
    try {
      const reader = await this.zxingReaderFactory();
      const result = await reader.decodeFromImageUrl(imagePreview);
      return result.getText();
    } catch {
      return undefined;
    }
  }

  private isExpectedScanMiss(error: Error) {
    return ['ChecksumException', 'FormatException', 'NotFoundException'].some((name) => error.name.includes(name));
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

async function createZxingReader() {
  const [{ BrowserMultiFormatReader }, { BarcodeFormat, DecodeHintType }] = await Promise.all([
    import('@zxing/browser'),
    import('@zxing/library')
  ]);
  const barcodeFormats = [
    BarcodeFormat.UPC_A,
    BarcodeFormat.UPC_E,
    BarcodeFormat.EAN_13,
    BarcodeFormat.EAN_8,
    BarcodeFormat.CODE_128,
    BarcodeFormat.CODE_39,
    BarcodeFormat.ITF
  ];
  const hints = new Map<DecodeHintTypeValue, unknown>();
  hints.set(DecodeHintType.POSSIBLE_FORMATS, barcodeFormats);
  hints.set(DecodeHintType.TRY_HARDER, true);
  return new BrowserMultiFormatReader(hints);
}
