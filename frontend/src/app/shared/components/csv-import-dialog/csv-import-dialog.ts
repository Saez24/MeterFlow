import {

    Component,
    inject,
    signal,
    computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { CsvImportService, CsvImportResult, ParsedCsvRow } from '../../../core/services/csv-import.service';
import { MeterService } from '../../../core/services/meter.service';
import { MeterConfig } from '../../../core/models/energy.models';

@Component({
    selector: 'app-csv-import-dialog',
    imports: [
        CommonModule,
        MatButtonModule,
        MatDialogModule,
        MatIconModule,
        MatSelectModule,
        MatProgressBarModule,
        MatSnackBarModule,
    ],
    templateUrl: './csv-import-dialog.html',
    styleUrl: './csv-import-dialog.scss',

})
export class CsvImportDialogComponent {
    private readonly csvImport = inject(CsvImportService);
    private readonly meterService = inject(MeterService);
    private readonly snackBar = inject(MatSnackBar);
    readonly dialogRef = inject<MatDialogRef<CsvImportDialogComponent>>(MatDialogRef);

    readonly meters = this.meterService.activeMeters;
    readonly selectedMeterId = signal<string>('');
    readonly parseResult = signal<CsvImportResult | null>(null);
    readonly importing = signal(false);
    readonly dragOver = signal(false);

    readonly processedRows = computed<ParsedCsvRow[]>(() => {
        const result = this.parseResult();
        const meterId = this.selectedMeterId();
        if (!result || !meterId) return result?.rows ?? [];
        return this.csvImport.markDuplicates(result.rows, meterId);
    });

    readonly importableCount = computed(() =>
        this.processedRows().filter((r) => r.errors.length === 0 && !r.duplicate).length
    );

    readonly canImport = computed(
        () => !!this.selectedMeterId() && this.importableCount() > 0 && !this.importing()
    );

    onDragOver(event: DragEvent): void {
        event.preventDefault();
        this.dragOver.set(true);
    }

    onDragLeave(): void {
        this.dragOver.set(false);
    }

    onDrop(event: DragEvent): void {
        event.preventDefault();
        this.dragOver.set(false);
        const file = event.dataTransfer?.files?.[0];
        if (file) this.loadFile(file);
    }

    onFileChange(event: Event): void {
        const file = (event.target as HTMLInputElement).files?.[0];
        if (file) this.loadFile(file);
    }

    private async loadFile(file: File): Promise<void> {
        try {
            const result = await this.csvImport.parseFile(file);
            this.parseResult.set(result);
        } catch {
            this.snackBar.open(
                $localize`:@@csv.parseError:CSV-Datei konnte nicht gelesen werden`,
                'OK',
                { duration: 4000 }
            );
        }
    }

    selectMeter(meter: MeterConfig): void {
        this.selectedMeterId.set(meter.id);
    }

    async import(): Promise<void> {
        if (!this.canImport()) return;
        this.importing.set(true);
        try {
            const count = await this.csvImport.importRows(
                this.processedRows(),
                this.selectedMeterId()
            );
            this.snackBar.open(
                $localize`:@@csv.importSuccess:${count}:count: Ablesungen importiert`,
                'OK',
                { duration: 4000 }
            );
            this.dialogRef.close(count);
        } catch {
            this.snackBar.open(
                $localize`:@@csv.importError:Fehler beim Import`,
                'OK',
                { duration: 4000 }
            );
        } finally {
            this.importing.set(false);
        }
    }
}
