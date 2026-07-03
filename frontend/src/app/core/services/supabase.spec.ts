import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { SupabaseService } from './supabase.service';


describe('Supabse', () => {
  let service: SupabaseService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection()],
    });
    service = TestBed.inject(SupabaseService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
