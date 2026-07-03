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

    it('should extract meter reading from text', () => {
        // Access private method for testing
        const extractMethod = (service as any).extractMeterReading.bind(service);
        const result = extractMethod('12345.678');
        expect(result).toBe(12345.678);
    });
});