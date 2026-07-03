import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';

import { ReadingsList } from './readings-list';

describe('ReadingsList', () => {
  let component: ReadingsList;
  let fixture: ComponentFixture<ReadingsList>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ReadingsList],
      providers: [provideZonelessChangeDetection()],
    }).compileComponents();

    fixture = TestBed.createComponent(ReadingsList);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
