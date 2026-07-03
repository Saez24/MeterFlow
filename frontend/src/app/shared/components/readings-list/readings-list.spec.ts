import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ApiService } from '../../../core/services/api.service';
import { apiServiceMock } from '../../../core/services/api.service.mock';
import { provideZonelessChangeDetection } from '@angular/core';

import { ReadingsList } from './readings-list';

describe('ReadingsList', () => {
  let component: ReadingsList;
  let fixture: ComponentFixture<ReadingsList>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ReadingsList],
      providers: [
        { provide: ApiService, useValue: apiServiceMock() },
        provideZonelessChangeDetection(),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ReadingsList);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
