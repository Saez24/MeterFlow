import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { ApiService } from '../../../core/services/api.service';
import { apiServiceMock } from '../../../core/services/api.service.mock';
import { MeterService } from '../../../core/services/meter.service';
import { provideZonelessChangeDetection } from '@angular/core';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { CostPreview } from './cost-preview';
import { MeterConfig, EnergyType } from '../../../core/models/energy.models';

const YEAR = new Date().getFullYear();

const baseMeter: MeterConfig = {
  id: 'meter-1',
  name: 'Strom',
  type: EnergyType.Electricity,
  unit: 'kWh',
  icon: 'bolt',
  color: '#FFD600',
  active: true,
  createdAt: new Date('2024-01-01'),
  tariffHistory: [
    { id: 't1', validFrom: new Date(YEAR - 1, 0, 1), pricePerUnit: 0.3, baseCharge: 10 },
  ],
};

describe('CostPreview', () => {
  let component: CostPreview;
  let fixture: ComponentFixture<CostPreview>;
  let api: ApiService;

  async function render(meter: MeterConfig): Promise<void> {
    TestBed.inject(MeterService).meters.set([meter]);
    fixture.componentRef.setInput('meter', meter);
    await fixture.whenStable();
  }

  beforeEach(async () => {
    api = apiServiceMock();
    await TestBed.configureTestingModule({
      imports: [CostPreview, NoopAnimationsModule],
      providers: [{ provide: ApiService, useValue: api }, provideZonelessChangeDetection()],
    }).compileComponents();

    fixture = TestBed.createComponent(CostPreview);
    component = fixture.componentInstance;
  });

  it('shows no preview and 12 empty rows without saved payments', async () => {
    await render(baseMeter);

    expect(component.result()).toBeNull();
    expect(component.rows()).toHaveLength(12);
    expect(component.rows().every((r) => r.amount === null)).toBe(true);
    expect(fixture.nativeElement.querySelector('.result-container')).toBeNull();
  });

  it('shows the preview automatically for saved payments', async () => {
    await render({
      ...baseMeter,
      advancePayments: [
        {
          year: YEAR,
          estimatedConsumption: 1000,
          payments: [
            { month: 1, amount: 100 },
            { month: 2, amount: null },
          ],
        },
      ],
    });

    expect(component.result()?.totalPayment).toBe(100);
    expect(component.model().estimatedConsumption).toBe(1000);
    expect(component.rows()).toHaveLength(2);
    expect(component.dirty()).toBe(false);
    expect(fixture.nativeElement.querySelector('.result-container')).not.toBeNull();
  });

  it('drops the last month when reducing the payment count', async () => {
    await render(baseMeter);
    component.paymentForm.payments[0].amount().value.set(120);

    component.setPaymentCount(11);

    expect(component.rows().map((r) => r.month)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    expect(component.rows()[0].amount).toBe(120);
  });

  it('shifts all months when the first month changes', async () => {
    await render(baseMeter);
    component.setPaymentCount(11);
    component.paymentForm.payments[0].amount().value.set(120);
    component.paymentForm.payments[1].amount().value.set(130);

    component.setStartMonth(2);

    expect(component.rows().map((r) => r.month)).toEqual([2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    expect(
      component
        .rows()
        .slice(0, 2)
        .map((r) => r.amount),
    ).toEqual([120, 130]);
    expect(component.startMonth()).toBe(2);
  });

  it('caps the payments at December', async () => {
    await render(baseMeter);

    component.setStartMonth(3);

    expect(component.paymentCount()).toBe(10);
    expect(component.rows().at(-1)?.month).toBe(12);
    expect(component.countOptions().at(-1)).toBe(10);

    component.setPaymentCount(12);
    expect(component.paymentCount()).toBe(10);
  });

  it('schedules quarterly payments from the first month', async () => {
    await render(baseMeter);

    component.setStartMonth(2);
    component.setInterval(3);

    expect(component.rows().map((r) => r.month)).toEqual([2, 5, 8, 11]);
    expect(component.countOptions()).toEqual([1, 2, 3, 4]);

    component.setStartMonth(3);
    expect(component.rows().map((r) => r.month)).toEqual([3, 6, 9, 12]);

    component.setPaymentCount(2);
    expect(component.rows().map((r) => r.month)).toEqual([3, 6]);
  });

  it('switches back to monthly with all months up to December', async () => {
    await render(baseMeter);
    component.setStartMonth(2);
    component.setInterval(3);

    component.setInterval(1);

    expect(component.rows().map((r) => r.month)).toEqual([2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  });

  it('saves and restores the quarterly rhythm', async () => {
    const update = vi.spyOn(api, 'updateMeter');
    await render(baseMeter);
    component.paymentForm.estimatedConsumption().value.set(80);
    component.setStartMonth(2);
    component.setInterval(3);

    await component.save();

    const saved = update.mock.calls[0][1].advancePayments![0];
    expect(saved.interval).toBe(3);
    expect(saved.payments.map((p) => p.month)).toEqual([2, 5, 8, 11]);

    await render({ ...baseMeter, advancePayments: [saved] });
    expect(component.interval()).toBe(3);
    expect(component.dirty()).toBe(false);
  });

  it('shows month names instead of month dropdowns', async () => {
    await render(baseMeter);
    component.setStartMonth(2);
    await fixture.whenStable();

    const labels = [...fixture.nativeElement.querySelectorAll('.payment-month')].map(
      (el: HTMLElement) => el.textContent?.trim(),
    );
    expect(labels[0]).toBe('Februar');
    expect(labels.at(-1)).toBe('Dezember');
    expect(fixture.nativeElement.querySelector('select.payment-month')).toBeNull();
  });

  it('saves the year via updateMeter', async () => {
    const update = vi.spyOn(api, 'updateMeter');
    await render(baseMeter);
    component.paymentForm.estimatedConsumption().value.set(2500);
    component.setPaymentCount(2);
    component.paymentForm.payments[0].amount().value.set(110);

    await component.save();

    expect(update).toHaveBeenCalledWith('meter-1', {
      advancePayments: [
        {
          year: YEAR,
          estimatedConsumption: 2500,
          interval: 1,
          payments: [
            { month: 1, amount: 110 },
            { month: 2, amount: null },
          ],
        },
      ],
    });
  });

  it('does not save without a valid consumption', async () => {
    const update = vi.spyOn(api, 'updateMeter');
    await render(baseMeter);

    await component.save();

    expect(component.paymentForm().invalid()).toBe(true);
    expect(update).not.toHaveBeenCalled();
  });

  it('rejects negative amounts', async () => {
    await render(baseMeter);
    component.paymentForm.estimatedConsumption().value.set(1000);
    component.paymentForm.payments[0].amount().value.set(-5);

    expect(component.paymentForm().invalid()).toBe(true);
    expect(component.formErrors()).toContain('Abschläge dürfen nicht negativ sein.');
  });

  it('binds the amount inputs to the form model', async () => {
    await render(baseMeter);
    const input: HTMLInputElement = fixture.nativeElement.querySelector('.payment-amount input');

    input.value = '99.5';
    input.dispatchEvent(new Event('input'));
    expect(component.rows()[0].amount).toBe(99.5);

    input.value = '';
    input.dispatchEvent(new Event('input'));
    expect(component.rows()[0].amount).toBeNull();
  });
});
