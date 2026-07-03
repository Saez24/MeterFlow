import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ApiService } from '../../core/services/api.service';
import { apiServiceMock } from '../../core/services/api.service.mock';
import { provideZonelessChangeDetection } from '@angular/core';

import { Auth } from './auth';

describe('Auth', () => {
  let component: Auth;
  let fixture: ComponentFixture<Auth>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Auth],
      providers: [
        { provide: ApiService, useValue: apiServiceMock() },
        provideZonelessChangeDetection(),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Auth);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
