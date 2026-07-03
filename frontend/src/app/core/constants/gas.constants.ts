/**
 * Standardwerte für Gas-Berechnungen nach DVGW-Arbeitsblatt G 685.
 * Quelle: Bundesnetzagentur / DVGW
 */
export const GAS_DEFAULTS = {
    /** Brennwert (Heizwert) in kWh/m³ */
    CALORIFIC_VALUE: 10.55,
    /** Zustandszahl (dimensionslos) */
    Z_NUMBER: 0.9672,
} as const;
