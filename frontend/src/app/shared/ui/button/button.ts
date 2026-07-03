import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'md' | 'sm';

/**
 * Apple-style button — Material-free, token-based (`.df-btn`). Replaces
 * `mat-button`. Content is projected, so use it like a native button:
 * `<app-button variant="primary" (click)="save()">Save</app-button>`.
 */
@Component({
  selector: 'app-button',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button [class]="classes()" [type]="type()" [disabled]="disabled()">
      <ng-content />
    </button>
  `,
  styles: [
    `
      :host {
        display: contents;
      }
    `,
  ],
})
export class Button {
  readonly variant = input<ButtonVariant>('primary');
  readonly size = input<ButtonSize>('md');
  readonly block = input(false);
  readonly disabled = input(false);
  readonly type = input<'button' | 'submit' | 'reset'>('button');

  protected readonly classes = computed(() => {
    const classes = ['df-btn', `df-btn-${this.variant()}`];
    if (this.size() === 'sm') classes.push('df-btn--sm');
    if (this.block()) classes.push('df-btn--block');
    return classes.join(' ');
  });
}
