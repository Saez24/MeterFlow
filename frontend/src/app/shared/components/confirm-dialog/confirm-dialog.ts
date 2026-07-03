import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';

export interface ConfirmDialogData {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
}

@Component({
  selector: 'app-confirm-dialog',
  imports: [MatButtonModule, MatDialogModule],
  template: `
    <h2 mat-dialog-title>{{ data.title }}</h2>
    <mat-dialog-content>
      <p>{{ data.message }}</p>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="dialogRef.close(false)">
        {{ data.cancelLabel ?? 'Abbrechen' }}
      </button>
      <button mat-flat-button color="warn" cdkFocusInitial (click)="dialogRef.close(true)">
        {{ data.confirmLabel ?? 'Bestätigen' }}
      </button>
    </mat-dialog-actions>
  `,

})
export class ConfirmDialogComponent {
  readonly data = inject<ConfirmDialogData>(MAT_DIALOG_DATA);
  readonly dialogRef = inject<MatDialogRef<ConfirmDialogComponent, boolean>>(MatDialogRef);
}
