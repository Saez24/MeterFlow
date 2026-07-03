import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { CostPreview } from './cost-preview';
import { MeterConfig, EnergyType } from '../../../core/models/energy.models';

const mockMeter: MeterConfig = {
    id: 'meter-1',
    name: 'Strom',
    type: EnergyType.Electricity,
    unit: 'kWh',
    icon: 'bolt',
    color: '#FFD600',
    active: true,
    createdAt: new Date('2024-01-01'),
};

describe('CostPreview', () => {
    let component: CostPreview;
    let fixture: ComponentFixture<CostPreview>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [CostPreview, NoopAnimationsModule],
            providers: [provideZonelessChangeDetection()],
        }).compileComponents();

        fixture = TestBed.createComponent(CostPreview);
        fixture.componentRef.setInput('meter', mockMeter);
        component = fixture.componentInstance;
        await fixture.whenStable();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });
});
