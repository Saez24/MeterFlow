import { TestBed } from '@angular/core/testing';
import { OcrService } from './ocr.service';

describe('OcrService', () => {
  let service: OcrService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(OcrService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  // Reading the digits is covered by meter-reading-parser.spec.ts.
  it('leaves non-HEIC photos unchanged', async () => {
    const jpeg = new File([new Uint8Array([0xff, 0xd8])], 'zaehler.jpg', { type: 'image/jpeg' });
    expect(await service.toJpegIfHeic(jpeg)).toBe(jpeg);
  });
});
