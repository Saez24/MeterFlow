// ------------------------
// Energy Types & Units
// ------------------------
export enum EnergyType {
  Electricity = 'electricity',
  Gas = 'gas',
  Water = 'water',
  GardenWater = 'garden_water',
  HeatingOil = 'heating_oil',
  Solar = 'solar',
  Fernwärme = 'fernwarme',
}

export interface ReadingRow {
  reading: MeterReading;
  gardenWaterCost: number | null;
}

export interface TariffPeriod {
  id: string;
  validFrom: Date;
  validTo?: Date;
  pricePerUnit: number;
  baseCharge: number;
  wastewaterPrice?: number;
  calorificValue?: number;
  zNumber?: number;
  note?: string;
  emissionPrice?: number;
  basePricePerKw?: number;       // Fernwärme: Bereitstellungspreis pro kW/Jahr

}

export interface BudgetConfig {
  monthlyLimit?: number; // € Gesamtlimit
  yearlyLimit?: number; // € Jahreslimit
  consumptionLimit?: number; // Einheit-Limit (kWh / m³)
  alertAt: number; // % Schwelle für Warnung (z.B. 80)
}

export type UnitByEnergyType = {
  [EnergyType.Electricity]: 'kWh';
  [EnergyType.Gas]: 'm³';
  [EnergyType.Water]: 'm³';
  [EnergyType.GardenWater]: 'm³';
  [EnergyType.HeatingOil]: 'Liter';
  [EnergyType.Solar]: 'kWh';
  [EnergyType.Fernwärme]: 'MWh';
};

export type MaterialIcon =
  | 'bolt'
  | 'local_fire_department'
  | 'water_drop'
  | 'yard'
  | 'oil_barrel'
  | 'wb_sunny';

// ------------------------
// Meter Config
// ------------------------
export interface MeterConfig<T extends EnergyType = EnergyType> {
  id: string;
  name: string;
  type: T;
  calorificValue?: number;
  zNumber?: number;
  unit: UnitByEnergyType[T];
  icon: MaterialIcon;
  color: string;
  active: boolean;
  createdAt: Date;
  budget?: BudgetConfig;
  connectedLoadKw?: number; // Fernwärme: Anschlussleistung in kW

  // Tariff
  tariffHistory?: TariffPeriod[];

  // Water-specific
  linkedWaterMeterId?: string; // garden_water -> water meter

  // Notes
  meterNumber?: string;
  provider?: string;
  notes?: string;
}

// ------------------------
// Meter Reading
// ------------------------
export interface MeterReading {
  id: string;
  meterId: string;
  date: Date;
  value: number;
  note?: string;
  photo?: string; // base64 data URL
  consumption?: number;
  kwh?: number;
  cost?: number;
  wastewaterCost?: number;
  totalCost?: number;
}

// ------------------------
// Water Bill
// ------------------------
export interface WaterBill {
  meterId: string; // main water meter id
  month: number; // 1-12
  year: number;
  totalConsumption: number; // m³ gesamt
  gardenConsumption: number; // m³ Garten (kein Abwasser)
  billableWastewater: number; // totalConsumption - gardenConsumption
  freshwaterCost: number; // €/m³ * totalConsumption
  wastewaterCost: number;
  baseCharge: number; // Grundgebühr für diesen Monat
  totalCost: number; // freshwaterCost + wastewaterCost + baseCharge
}

// ------------------------
// Statistics
// ------------------------
export interface MonthStats {
  year: number;
  month: number; // 1-12
  label: string; // "Jan 24"
  byMeter: Record<string, { consumption: number; cost: number; unit: string }>;
  totalCost: number;
}

export interface YearStats {
  year: number;
  totalCost: number;
  byMeter: Record<string, { consumption: number; cost: number }>;
  months: MonthStats[];
}

export interface BudgetAlert {
  meterId: string;
  meterName: string;
  type: 'monthly_cost' | 'yearly_cost' | 'consumption';
  current: number;
  limit: number;
  percent: number;
  unit: string;
  color: string;
  critical: boolean; // > 100%
}

// ------------------------
// Constants
// ------------------------

/**
 * CO₂-Emissionsfaktoren (Quelle: Umweltbundesamt 2024)
 * Einheit: kg CO₂ pro Verbrauchseinheit des jeweiligen Energietyps
 *
 * Strom:       0,380 kg/kWh  (DE-Strommix 2024)
 * Gas:         2,020 kg/m³   (Erdgas H, inkl. Vorkette)
 * Wasser:      0,000 kg/m³   (keine Verbrennung)
 * GardenWater: 0,000 kg/m³
 * Heizöl:      2,680 kg/L    (Leichtes Heizöl)
 * Solar:      -0,050 kg/kWh  (Gutschrift: vermiedene Emissionen)
 * Fernwärme:  75,000 kg/MWh  (DE-Fernwärme-Mittel)
 */
export const CO2_FACTORS: Record<EnergyType, number> = {
  [EnergyType.Electricity]: 0.380,
  [EnergyType.Gas]: 2.020,
  [EnergyType.Water]: 0.000,
  [EnergyType.GardenWater]: 0.000,
  [EnergyType.HeatingOil]: 2.680,
  [EnergyType.Solar]: -0.050,
  [EnergyType.Fernwärme]: 75.000,
};

export const ENERGY_META: Record<
  EnergyType,
  { label: string; icon: MaterialIcon; color: string; unit: string }
> = {
  [EnergyType.Electricity]: { label: 'Strom', icon: 'bolt', color: '#F59E0B', unit: 'kWh' },
  [EnergyType.Gas]: { label: 'Gas', icon: 'local_fire_department', color: '#3B82F6', unit: 'm³' },
  [EnergyType.Water]: { label: 'Wasser', icon: 'water_drop', color: '#06B6D4', unit: 'm³' },
  [EnergyType.GardenWater]: { label: 'Gartenwasser', icon: 'yard', color: '#10B981', unit: 'm³' },
  [EnergyType.HeatingOil]: { label: 'Heizöl', icon: 'oil_barrel', color: '#F97316', unit: 'Liter' },
  [EnergyType.Solar]: { label: 'Solar', icon: 'wb_sunny', color: '#EAB308', unit: 'kWh' },
  [EnergyType.Fernwärme]: { label: 'Fernwärme', icon: 'local_fire_department', color: '#EAB308', unit: 'MWh' },
};

export const MONTH_NAMES = [
  'Jan',
  'Feb',
  'Mär',
  'Apr',
  'Mai',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Okt',
  'Nov',
  'Dez',
] as const;

export const MONTH_NAMES_FULL = [
  'Januar',
  'Februar',
  'März',
  'April',
  'Mai',
  'Juni',
  'Juli',
  'August',
  'September',
  'Oktober',
  'November',
  'Dezember',
];
