import { Injectable, inject } from '@angular/core';
import Papa from 'papaparse';
import { ReadingService } from './reading.service';
import { MeterService } from './meter.service';

export interface CsvRow {
    datum?: string;
    wert?: string;
    notiz?: string;
    [key: string]: string | undefined;
}

export interface ParsedCsvRow {
    line: number;
    date: Date | null;
    value: number | null;
    note: string;
    rawDatum: string;
    rawWert: string;
    errors: string[];
    duplicate: boolean;
}

export interface CsvImportResult {
    rows: ParsedCsvRow[];
    validCount: number;
    errorCount: number;
}

@Injectable({ providedIn: 'root' })
export class CsvImportService {
    private readonly readingService = inject(ReadingService);
    private readonly meterService = inject(MeterService);

    parseFile(file: File): Promise<CsvImportResult> {
        return new Promise((resolve, reject) => {
            Papa.parse<CsvRow>(file, {
                header: true,
                skipEmptyLines: true,
                transformHeader: (h) => h.trim().toLowerCase(),
                complete: (result) => {
                    resolve(this.processRows(result.data));
                },
                error: (err) => reject(err),
            });
        });
    }

    private processRows(raw: CsvRow[]): CsvImportResult {
        const rows: ParsedCsvRow[] = raw.map((r, i) => this.parseRow(r, i + 2));
        const validCount = rows.filter((r) => r.errors.length === 0).length;
        const errorCount = rows.filter((r) => r.errors.length > 0).length;
        return { rows, validCount, errorCount };
    }

    private parseRow(r: CsvRow, line: number): ParsedCsvRow {
        const errors: string[] = [];
        const rawDatum = (r.datum ?? r['date'] ?? '').trim();
        const rawWert = (r.wert ?? r['value'] ?? r['wert (kwh)'] ?? r['wert (m3)'] ?? r['wert (l)'] ?? '').trim();
        const note = (r.notiz ?? r['note'] ?? r['notiz'] ?? '').trim();

        const date = this.parseDate(rawDatum);
        if (!date) errors.push($localize`:@@csv.error.date:Ungültiges Datum „${rawDatum}:date:"`);

        const value = rawWert === '' ? null : Number(rawWert.replace(',', '.'));
        if (value === null || isNaN(value)) errors.push($localize`:@@csv.error.value:Ungültiger Wert „${rawWert}:value:"`);
        if (value !== null && !isNaN(value) && value < 0) errors.push($localize`:@@csv.error.negative:Wert darf nicht negativ sein`);

        return { line, date, value, note, rawDatum, rawWert, errors, duplicate: false };
    }

    private parseDate(raw: string): Date | null {
        if (!raw) return null;
        // ISO: YYYY-MM-DD
        if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
            const d = new Date(raw);
            return isNaN(d.getTime()) ? null : d;
        }
        // DE: DD.MM.YYYY
        const deMatcher = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(raw);
        if (deMatcher) {
            const d = new Date(Number(deMatcher[3]), Number(deMatcher[2]) - 1, Number(deMatcher[1]));
            return isNaN(d.getTime()) ? null : d;
        }
        // DE short: DD.MM.YY
        const deShortMatcher = /^(\d{1,2})\.(\d{1,2})\.(\d{2})$/.exec(raw);
        if (deShortMatcher) {
            const year = 2000 + Number(deShortMatcher[3]);
            const d = new Date(year, Number(deShortMatcher[2]) - 1, Number(deShortMatcher[1]));
            return isNaN(d.getTime()) ? null : d;
        }
        return null;
    }

    markDuplicates(rows: ParsedCsvRow[], meterId: string): ParsedCsvRow[] {
        const existingDates = new Set(
            this.readingService.getReadingsForMeter(meterId).map((r) =>
                new Date(r.date).toDateString()
            )
        );
        return rows.map((row) => ({
            ...row,
            duplicate: row.date ? existingDates.has(row.date.toDateString()) : false,
        }));
    }

    async importRows(rows: ParsedCsvRow[], meterId: string): Promise<number> {
        const valid = rows.filter((r) => r.errors.length === 0 && !r.duplicate && r.date && r.value !== null);
        let imported = 0;
        for (const row of valid) {
            await this.readingService.addReading({
                meterId,
                date: row.date!,
                value: row.value!,
                note: row.note || undefined,
            });
            imported++;
        }
        return imported;
    }
}
