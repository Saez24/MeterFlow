import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { PhotoCrop, applyDrag } from './photo-crop';

const START = { x: 0.1, y: 0.4, width: 0.8, height: 0.2 };

describe('applyDrag', () => {
  it('moves the frame and keeps it inside the image', () => {
    const moved = applyDrag(START, 'move', 0.05, 0.1);
    expect(moved.x).toBeCloseTo(0.15);
    expect(moved.y).toBeCloseTo(0.5);
    expect(moved.width).toBeCloseTo(0.8);
    const clamped = applyDrag(START, 'move', 0.5, 0.9);
    expect(clamped.x + clamped.width).toBeCloseTo(1);
    expect(clamped.y + clamped.height).toBeCloseTo(1);
  });

  it('resizes from the bottom-right corner', () => {
    const r = applyDrag(START, 'se', -0.3, -0.1);
    expect(r.x).toBe(0.1);
    expect(r.width).toBeCloseTo(0.5);
    expect(r.height).toBeCloseTo(0.1);
  });

  it('resizes from the top-left corner and keeps the opposite edge fixed', () => {
    const r = applyDrag(START, 'nw', 0.2, 0.05);
    expect(r.x).toBeCloseTo(0.3);
    expect(r.x + r.width).toBeCloseTo(0.9);
    expect(r.y + r.height).toBeCloseTo(0.6);
  });

  it('never gets smaller than the minimum size', () => {
    const r = applyDrag(START, 'se', -5, -5);
    expect(r.width).toBeGreaterThan(0.05);
    expect(r.height).toBeGreaterThan(0.02);
  });
});

describe('PhotoCrop', () => {
  it('emits the current frame on confirm', () => {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
    const fixture = TestBed.createComponent(PhotoCrop);
    fixture.componentRef.setInput('src', 'blob:test');
    fixture.detectChanges();
    let emitted: unknown;
    fixture.componentInstance.confirmed.subscribe((r) => (emitted = r));
    fixture.componentInstance.confirm();
    expect(emitted).toEqual(fixture.componentInstance.rect());
  });

  it('moves the frame with the arrow keys', () => {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
    const fixture = TestBed.createComponent(PhotoCrop);
    fixture.componentRef.setInput('src', 'blob:test');
    fixture.detectChanges();
    const before = fixture.componentInstance.rect();
    fixture.componentInstance.onKeydown(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    expect(fixture.componentInstance.rect().x).toBeCloseTo(before.x + 0.01);
  });
});
