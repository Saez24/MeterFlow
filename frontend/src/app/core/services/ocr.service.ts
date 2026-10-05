import { Injectable } from '@angular/core';
import { pickMeterReading, ReadingBounds } from './meter-reading-parser';

export interface OcrResult {
  value: number | null;
  /** Other plausible values for a one-tap correction. */
  alternatives: number[];
  confidence: number;
  rawText: string;
}

/** Area of the photo to read, as fractions (0–1) of width and height. */
export interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface OcrOptions {
  /** Only this part of the photo is read (the number wheels). */
  crop?: CropRect | null;
  /** Previous/next reading of the meter, to pick the plausible value. */
  bounds?: ReadingBounds;
}

/** Binarisation thresholds; each pass catches other wheels, the parser votes. */
const CROP_THRESHOLDS = [80, 100, 120, 140];
/** Width the cropped wheels are scaled to (tested: wider gets worse, not better). */
const CROP_WIDTH = 1200;
const FULL_MAX_WIDTH = 2000;

/**
 * On-Device OCR via Tesseract.js (WASM).
 * No API key needed, works offline.
 * Lazy-loads the Tesseract worker only when recognizeMeterValue() is first called.
 */
@Injectable({ providedIn: 'root' })
export class OcrService {
  /**
   * Recognizes a meter reading from a photo file.
   * The photo is cropped to the wheels, converted to black digits on white
   * (Tesseract expects dark text; most counters are white on black) and read
   * in several threshold passes; pickMeterReading() combines them.
   */
  async recognizeMeterValue(file: File, options: OcrOptions = {}): Promise<OcrResult> {
    // Lazy import – WASM bundle only loaded when OCR is first used.
    // tesseract.js is CommonJS: in the browser bundle its API only lives on
    // `default` (named exports are undefined there → "t is not a function").
    const tesseract = await import('tesseract.js');
    const { createWorker, PSM } = tesseract.default ?? tesseract;

    const photo = await this.toJpegIfHeic(file);
    const images = await this.preprocess(photo, options.crop ?? null);

    // Self-hosted assets only (no CDN — security-standards §7/§8). The core
    // WASM + worker are copied from node_modules to /tesseract by angular.json;
    // deu.traineddata.gz lives in public/tessdata. workerBlobURL:false loads the
    // worker directly from workerPath so it satisfies CSP `worker-src 'self'`.
    // Requires `'wasm-unsafe-eval'` in the CSP `script-src` for WASM instantiation.
    const worker = await createWorker('deu', 1, {
      workerPath: '/tesseract/worker.min.js',
      corePath: '/tesseract',
      langPath: '/tessdata',
      workerBlobURL: false,
    });
    try {
      await worker.setParameters({
        tessedit_pageseg_mode: options.crop ? PSM.SINGLE_LINE : PSM.SINGLE_BLOCK,
        tessedit_char_whitelist: '0123456789, ',
      });
      const texts: string[] = [];
      let confidenceSum = 0;
      for (const image of images) {
        const { data } = await worker.recognize(image);
        texts.push(data.text.trim());
        confidenceSum += data.confidence;
      }
      const { value, alternatives } = pickMeterReading(texts, options.bounds);
      return {
        value,
        alternatives,
        confidence: Math.round(confidenceSum / images.length),
        rawText: texts.join(' | '),
      };
    } finally {
      await worker.terminate();
    }
  }

  /**
   * HEIC/HEIF (iPhone photos) → JPEG; other files are returned unchanged.
   * Browsers other than Safari can neither preview nor OCR HEIC, so the form
   * converts right after selection and stores the JPEG.
   */
  async toJpegIfHeic(file: File): Promise<File> {
    const name = file.name.toLowerCase();
    const isHeic =
      file.type === 'image/heic' ||
      file.type === 'image/heif' ||
      name.endsWith('.heic') ||
      name.endsWith('.heif');
    if (!isHeic) return file;
    // CSP build: no `new Function`, so no 'unsafe-eval' needed (worker-src still needs blob:).
    // heic-to has no default export and takes one options object.
    const { heicTo } = await import('heic-to/csp');
    const jpeg = await heicTo({ blob: file, type: 'image/jpeg', quality: 0.8 });
    return new File([jpeg], file.name.replace(/\.(heic|heif)$/i, '.jpg'), { type: 'image/jpeg' });
  }

  /**
   * Crop → scale → grayscale → contrast stretch (2nd–98th percentile) → dark
   * digits on light background. With a crop: one black/white image per
   * threshold; without: one contrast-stretched image.
   */
  private async preprocess(file: File, crop: CropRect | null): Promise<Blob[]> {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const sx = crop ? crop.x * bitmap.width : 0;
    const sy = crop ? crop.y * bitmap.height : 0;
    const sw = crop ? crop.width * bitmap.width : bitmap.width;
    const sh = crop ? crop.height * bitmap.height : bitmap.height;
    const width = Math.round(crop ? CROP_WIDTH : Math.min(sw, FULL_MAX_WIDTH));
    const height = Math.max(1, Math.round((sh * width) / sw));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('Canvas 2D context not available');
    ctx.drawImage(bitmap, sx, sy, sw, sh, 0, 0, width, height);
    bitmap.close();

    const image = ctx.getImageData(0, 0, width, height);
    const px = image.data;
    const gray = new Uint8ClampedArray(width * height);
    const histogram = new Uint32Array(256);
    let sum = 0;
    for (let i = 0; i < gray.length; i++) {
      const g = 0.299 * px[i * 4] + 0.587 * px[i * 4 + 1] + 0.114 * px[i * 4 + 2];
      gray[i] = g;
      histogram[gray[i]]++;
      sum += gray[i];
    }
    const lo = percentile(histogram, gray.length, 0.02);
    const hi = percentile(histogram, gray.length, 0.98);
    const invert = sum / gray.length < 128; // white digits on black wheels
    const range = Math.max(1, hi - lo);
    for (let i = 0; i < gray.length; i++) {
      const v = ((gray[i] - lo) * 255) / range;
      gray[i] = invert ? 255 - v : v;
    }

    const thresholds = crop ? CROP_THRESHOLDS : [null];
    const blobs: Blob[] = [];
    for (const threshold of thresholds) {
      for (let i = 0; i < gray.length; i++) {
        const v = threshold === null ? gray[i] : gray[i] < threshold ? 0 : 255;
        px[i * 4] = px[i * 4 + 1] = px[i * 4 + 2] = v;
        px[i * 4 + 3] = 255;
      }
      ctx.putImageData(image, 0, 0);
      blobs.push(await canvasToPng(canvas));
    }
    return blobs;
  }
}

function percentile(histogram: Uint32Array, total: number, p: number): number {
  const target = total * p;
  let seen = 0;
  for (let v = 0; v < histogram.length; v++) {
    seen += histogram[v];
    if (seen >= target) return v;
  }
  return 255;
}

function canvasToPng(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Canvas export failed'))), 'image/png'),
  );
}
