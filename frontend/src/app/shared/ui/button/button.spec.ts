import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { Button } from './button';

describe('Button', () => {
  it('defaults to a primary, non-block button of type button', () => {
    const fixture = TestBed.createComponent(Button);
    fixture.detectChanges();
    const button = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
    expect(button.className).toContain('df-btn');
    expect(button.className).toContain('df-btn-primary');
    expect(button.className).not.toContain('df-btn--block');
    expect(button.type).toBe('button');
  });

  it('composes variant, size and block modifier classes', () => {
    const fixture = TestBed.createComponent(Button);
    fixture.componentRef.setInput('variant', 'danger');
    fixture.componentRef.setInput('size', 'sm');
    fixture.componentRef.setInput('block', true);
    fixture.detectChanges();
    const button = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
    expect(button.className).toContain('df-btn-danger');
    expect(button.className).toContain('df-btn--sm');
    expect(button.className).toContain('df-btn--block');
  });

  it('reflects the disabled input', () => {
    const fixture = TestBed.createComponent(Button);
    fixture.componentRef.setInput('disabled', true);
    fixture.detectChanges();
    const button = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });
});
