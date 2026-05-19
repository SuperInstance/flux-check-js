/**
 * Industry preset constraint definitions.
 *
 * Each preset provides a named set of constraints for a specific domain.
 * Use with ConstraintEngine or directly with checkExact.
 */
export const presets = {
    automotive: {
        name: "automotive",
        description: "Automotive engine and drivetrain constraints",
        constraints: [
            { name: "coolant_temp", lo: -40, hi: 150, unit: "°C" },
            { name: "oil_pressure", lo: 0.5, hi: 7, unit: "bar" },
            { name: "rpm", lo: 0, hi: 8000, unit: "rpm" },
            { name: "battery_voltage", lo: 10, hi: 16, unit: "V" },
            { name: "throttle_pos", lo: 0, hi: 100, unit: "%" },
            { name: "boost_pressure", lo: 0, hi: 2.5, unit: "bar" },
            { name: "exhaust_temp", lo: 0, hi: 950, unit: "°C" },
            { name: "fuel_pressure", lo: 2, hi: 6, unit: "bar" },
        ],
    },
    aviation: {
        name: "aviation",
        description: "Aviation flight systems constraints",
        constraints: [
            { name: "altitude", lo: 0, hi: 45000, unit: "ft" },
            { name: "airspeed", lo: 60, hi: 600, unit: "kts" },
            { name: "engine_temp", lo: -50, hi: 1050, unit: "°C" },
            { name: "oil_temp", lo: -40, hi: 150, unit: "°C" },
            { name: "fuel_flow", lo: 0, hi: 3000, unit: "lb/h" },
            { name: "cabin_pressure", lo: 0, hi: 15, unit: "psi" },
            { name: "hydraulic_pressure", lo: 1500, hi: 3500, unit: "psi" },
            { name: "egt", lo: 0, hi: 900, unit: "°C" },
        ],
    },
    medical: {
        name: "medical",
        description: "Medical vital signs and device constraints",
        constraints: [
            { name: "heart_rate", lo: 40, hi: 200, unit: "bpm" },
            { name: "spo2", lo: 70, hi: 100, unit: "%" },
            { name: "blood_pressure_sys", lo: 60, hi: 250, unit: "mmHg" },
            { name: "blood_pressure_dia", lo: 40, hi: 150, unit: "mmHg" },
            { name: "body_temp", lo: 34, hi: 42, unit: "°C" },
            { name: "resp_rate", lo: 6, hi: 60, unit: "breaths/min" },
            { name: "etco2", lo: 10, hi: 80, unit: "mmHg" },
        ],
    },
    financial: {
        name: "financial",
        description: "Financial trading and risk constraints",
        constraints: [
            { name: "price", lo: 0.01, hi: 1000000, unit: "USD" },
            { name: "spread", lo: 0, hi: 5, unit: "%" },
            { name: "volume", lo: 0, hi: 1e9, unit: "shares" },
            { name: "volatility", lo: 0, hi: 200, unit: "%" },
            { name: "delta", lo: -1, hi: 1, unit: "" },
            { name: "var_daily", lo: -1e6, hi: 0, unit: "USD" },
        ],
    },
    energy: {
        name: "energy",
        description: "Energy grid and power system constraints",
        constraints: [
            { name: "voltage", lo: 210, hi: 250, unit: "V" },
            { name: "frequency", lo: 49.5, hi: 50.5, unit: "Hz" },
            { name: "current", lo: 0, hi: 5000, unit: "A" },
            { name: "power_factor", lo: 0.8, hi: 1, unit: "" },
            { name: "transformer_temp", lo: -20, hi: 120, unit: "°C" },
            { name: "load_percent", lo: 0, hi: 110, unit: "%" },
        ],
    },
    iot: {
        name: "iot",
        description: "IoT sensor and environmental constraints",
        constraints: [
            { name: "temperature", lo: -40, hi: 85, unit: "°C" },
            { name: "humidity", lo: 0, hi: 100, unit: "%" },
            { name: "pressure", lo: 800, hi: 1200, unit: "hPa" },
            { name: "co2", lo: 300, hi: 5000, unit: "ppm" },
            { name: "pm25", lo: 0, hi: 500, unit: "µg/m³" },
            { name: "light", lo: 0, hi: 100000, unit: "lux" },
            { name: "noise", lo: 0, hi: 130, unit: "dB" },
            { name: "battery", lo: 0, hi: 100, unit: "%" },
        ],
    },
};
/** Get a preset by name. Throws if not found. */
export function getPreset(name) {
    const p = presets[name];
    if (!p)
        throw new Error(`Unknown preset: '${name}'. Available: ${Object.keys(presets).join(", ")}`);
    return p;
}
/** List all available preset names. */
export function listPresets() {
    return Object.keys(presets);
}
