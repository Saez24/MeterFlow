import { Component, ElementRef, input, output, signal, viewChild } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import type { CropRect } from '../../../core/services/ocr.service';

type DragMode = 'move' | 'nw' | 'ne' | 'sw' | 'se';

interface DragState {
  mode: DragMode;
  pointerId: number;
  startX: number;
  startY: number;
  start: CropRect;
  stageWidth: number;
  stageHeight: number;
}

const MIN_WIDTH = 0.08;
const MIN_HEIGHT = 0.03;
const KEY_STEP = 0.01;

/**
 * Lets the user draw a tight frame around the meter's number wheels before OCR.
 * Works with touch, mouse (pointer events) and keyboard (arrows move,
 * Shift+arrows resize). Emits the frame as fractions of the image (0–1).
 */
@Component({
  selector: 'app-photo-crop',
  imports: [MatIconModule],
  templateUrl: './photo-crop.html',
  styleUrl: './photo-crop.scss',
})
export class PhotoCrop {
  readonly src = input.required<string>();
  readonly confirmed = output<CropRect>();
  readonly cancelled = output<void>();

  /** Default: a wide, flat band in the middle — the typical shape of a counter. */
  readonly rect = signal<CropRect>({ x: 0.1, y: 0.42, width: 0.8, height: 0.16 });

  private readonly stage = viewChild.required<ElementRef<HTMLElement>>('stage');
  private drag: DragState | null = null;

  onPointerDown(event: PointerEvent, mode: DragMode): void {
    event.preventDefault();
    event.stopPropagation();
    const bounds = this.stage().nativeElement.getBoundingClientRect();
    (event.target as HTMLElement).setPointerCapture(event.pointerId);
    this.drag = {
      mode,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      start: this.rect(),
      stageWidth: bounds.width,
      stageHeight: bounds.height,
    };
  }

  onPointerMove(event: PointerEvent): void {
    const d = this.drag;
    if (!d || event.pointerId !== d.pointerId) return;
    const dx = (event.clientX - d.startX) / d.stageWidth;
    const dy = (event.clientY - d.startY) / d.stageHeight;
    this.rect.set(applyDrag(d.start, d.mode, dx, dy));
  }

  onPointerUp(event: PointerEvent): void {
    if (this.drag?.pointerId === event.pointerId) this.drag = null;
  }

  onKeydown(event: KeyboardEvent): void {
    const delta: Record<string, [number, number]> = {
      ArrowLeft: [-KEY_STEP, 0],
      ArrowRight: [KEY_STEP, 0],
      ArrowUp: [0, -KEY_STEP],
      ArrowDown: [0, KEY_STEP],
    };
    const step = delta[event.key];
    if (!step) return;
    event.preventDefault();
    this.rect.set(applyDrag(this.rect(), event.shiftKey ? 'se' : 'move', step[0], step[1]));
  }

  confirm(): void {
    this.confirmed.emit(this.rect());
  }
}

/** Moves or resizes the frame by (dx, dy) and keeps it inside the image. */
export function applyDrag(start: CropRect, mode: DragMode, dx: number, dy: number): CropRect {
  let { x, y, width, height } = start;
  const right = x + width;
  const bottom = y + height;
  if (mode === 'move') {
    x = clamp(x + dx, 0, 1 - width);
    y = clamp(y + dy, 0, 1 - height);
    return { x, y, width, height };
  }
  if (mode === 'nw' || mode === 'sw') {
    x = clamp(x + dx, 0, right - MIN_WIDTH);
    width = right - x;
  } else {
    width = clamp(width + dx, MIN_WIDTH, 1 - x);
  }
  if (mode === 'nw' || mode === 'ne') {
    y = clamp(y + dy, 0, bottom - MIN_HEIGHT);
    height = bottom - y;
  } else {
    height = clamp(height + dy, MIN_HEIGHT, 1 - y);
  }
  return { x, y, width, height };
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}
