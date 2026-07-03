import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { Icon } from './icon';
import { ICON_PATHS } from './icon-registry';

describe('Icon', () => {
  it('renders the registry path for the given name', () => {
    const fixture = TestBed.createComponent(Icon);
    fixture.componentRef.setInput('name', 'check');
    fixture.detectChanges();
    const path = fixture.nativeElement.querySelector('path') as SVGPathElement;
    expect(path.getAttribute('d')).toBe(ICON_PATHS.check);
  });

  it('applies the size input to the svg', () => {
    const fixture = TestBed.createComponent(Icon);
    fixture.componentRef.setInput('name', 'plus');
    fixture.componentRef.setInput('size', 32);
    fixture.detectChanges();
    const svg = fixture.nativeElement.querySelector('svg') as SVGElement;
    expect(svg.getAttribute('width')).toBe('32');
    expect(svg.getAttribute('height')).toBe('32');
  });
});
