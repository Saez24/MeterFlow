import { Injectable, inject, resource, signal } from '@angular/core';
import { EnergyType, CO2_FACTORS, ENERGY_META } from '../models/energy.models';
import { SupabaseService } from './supabase.service';

export interface Co2FactorRow {
    id: string;
    energy_type: string;
    factor_kg_per_unit: number;
    unit: string;
    source: string;
    source_url: string | null;
    valid_from: string;
}

/** Standard-Quell-URLs (UBA – Umweltbundesamt) */
export const CO2_DEFAULT_SOURCE_URLS: Partial<Record<EnergyType, string>> = {
    [EnergyType.Electricity]: 'https://www.umweltbundesamt.de/themen/klima-energie/energieversorgung/strom-waermeversorgung-in-zahlen',
    [EnergyType.Gas]: 'https://www.umweltbundesamt.de/sites/default/files/medien/479/publikationen/cc_26-2021_emissionsbilanz_erneuerbarer_energietraeger.pdf',
    [EnergyType.HeatingOil]: 'https://www.umweltbundesamt.de/themen/klima-energie/treibhausgas-emissionen',
    [EnergyType.Solar]: 'https://www.umweltbundesamt.de/themen/klima-energie/erneuerbare-energien/photovoltaik',
    [EnergyType.Fernwärme]: 'https://www.agfw.de/zahlen-und-statistiken/co2-emission/',
};

/** Energietypen für die ein CO₂-Faktor sinnvoll ist (Wasser hat 0 → trotzdem editierbar) */
export const CO2_SUPPORTED_TYPES: EnergyType[] = [
    EnergyType.Electricity,
    EnergyType.Gas,
    EnergyType.HeatingOil,
    EnergyType.Solar,
    EnergyType.Fernwärme,
    EnergyType.Water,
    EnergyType.GardenWater,
];

@Injectable({ providedIn: 'root' })
export class Co2FactorService {
    private readonly supabase = inject(SupabaseService);
    private readonly reloadTrigger = signal(0);

    readonly factors = resource<Co2FactorRow[], { uid: string | undefined; _: number }>({
        params: () => ({ uid: this.supabase.currentUser()?.id, _: this.reloadTrigger() }),
        loader: async ({ params }): Promise<Co2FactorRow[]> => {
            if (!params.uid) return [];
            const { data, error } = await this.supabase.getCo2Factors();
            if (error || !data) return [];
            return data as Co2FactorRow[];
        },
        defaultValue: [],
    });

    /** Gibt DB-Faktor oder Fallback-Konstante zurück */
    getFactor(energyType: EnergyType): number {
        const rows = this.factors.value() ?? [];
        const dbRow = rows.find(r => r.energy_type === energyType);
        return dbRow ? dbRow.factor_kg_per_unit : (CO2_FACTORS[energyType] ?? 0);
    }

    /** Für das Settings-Template */
    getEntryForType(type: EnergyType): {
        factor: number;
        unit: string;
        source: string;
        sourceUrl: string | null;
        isDefault: boolean;
    } {
        const rows = this.factors.value() ?? [];
        const dbRow = rows.find(r => r.energy_type === type);
        if (dbRow) {
            return {
                factor: dbRow.factor_kg_per_unit,
                unit: dbRow.unit,
                source: dbRow.source,
                sourceUrl: dbRow.source_url,
                isDefault: false,
            };
        }
        return {
            factor: CO2_FACTORS[type] ?? 0,
            unit: ENERGY_META[type]?.unit ?? '',
            source: 'UBA 2024',
            sourceUrl: CO2_DEFAULT_SOURCE_URLS[type] ?? null,
            isDefault: true,
        };
    }

    async upsert(row: Omit<Co2FactorRow, 'id'>): Promise<void> {
        await this.supabase.upsertCo2Factor(row);
        this.reloadTrigger.update(v => v + 1);
    }

    async remove(id: string): Promise<void> {
        await this.supabase.deleteCo2Factor(id);
        this.reloadTrigger.update(v => v + 1);
    }
}
