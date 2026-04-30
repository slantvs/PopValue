import { afterEach, describe, expect, it, vi } from 'vitest';
import { ScanService } from './scanService';

const makeImage = (name: string) => new File(['barcode-image'], name, { type: 'image/png' });

describe('ScanService', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('uses the native BarcodeDetector result when available', async () => {
    const close = vi.fn();
    const zxingFactory = vi.fn();

    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:native');
    vi.stubGlobal('createImageBitmap', vi.fn(async () => ({ close })));
    vi.stubGlobal(
      'BarcodeDetector',
      class {
        async detect() {
          return [{ rawValue: '830395022260' }];
        }
      }
    );

    const result = await new ScanService(zxingFactory).scanImage(makeImage('batman.png'));

    expect(result.rawValue).toBe('830395022260');
    expect(result.confidence).toBe(0.98);
    expect(result.imagePreview).toBe('blob:native');
    expect(close).toHaveBeenCalledOnce();
    expect(zxingFactory).not.toHaveBeenCalled();
  });

  it('falls back to ZXing when the native detector is unavailable', async () => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:zxing');

    const service = new ScanService(() => ({
      decodeFromImageUrl: vi.fn(async () => ({ getText: () => '889698036034' }))
    }));

    const result = await service.scanImage(makeImage('spiderman.png'));

    expect(result.rawValue).toBe('889698036034');
    expect(result.confidence).toBe(0.9);
  });

  it('uses barcode-like digits from the filename when image decoding fails', async () => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:fallback');

    const service = new ScanService(() => ({
      decodeFromImageUrl: vi.fn(async () => {
        throw new Error('not found');
      })
    }));

    const result = await service.scanImage(makeImage('funko-889698455898-box.png'));

    expect(result.rawValue).toBe('889698455898');
    expect(result.confidence).toBe(0.45);
    expect(result.visualHints).toEqual(['funko', 'box']);
  });

  it('builds high-confidence camera barcode scan results', () => {
    const result = new ScanService().buildBarcodeScan('830395022260', 'camera');

    expect(result).toEqual({
      source: 'camera',
      rawValue: '830395022260',
      confidence: 0.98,
      visualHints: []
    });
  });

  it('wires live camera decoding to the detected barcode callback', async () => {
    const controls = { stop: vi.fn() };
    const onDetected = vi.fn();
    const video = {} as HTMLVideoElement;
    const service = new ScanService(() => ({
      decodeFromImageUrl: vi.fn(),
      decodeFromConstraints: vi.fn(async (_constraints, _preview, callback) => {
        callback({ getText: () => '889698123321' }, undefined, controls);
        return controls;
      })
    }));

    await service.startCameraScan(video, onDetected);

    expect(onDetected).toHaveBeenCalledWith('889698123321');
    expect(controls.stop).toHaveBeenCalledOnce();
  });
});
