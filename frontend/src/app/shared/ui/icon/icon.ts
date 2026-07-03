import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { ICON_PATHS, type IconName } from './icon-registry';

/**
 * Inline-SVG icon — Material-free, no CDN. Renders a registry path via
 * `[attr.d]` binding (never innerHTML, so it is XSS- and CSP-safe).
 */
@Component({
  selector: 'app-icon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg
      [attr.width]="size()"
      [attr.height]="size()"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path [attr.d]="path()" />
    </svg>
  `,
  styles: [
    `
      :host {
        display: inline-flex;
        line-height: 0;
        color: inherit;
      }
    `,
  ],
})
export class Icon {
  readonly name = input.required<IconName>();
  readonly size = input(20);

  protected readonly path = computed(() => ICON_PATHS[this.name()] ?? '');
}
