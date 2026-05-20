/**
 * Drift Detection — Simple linear drift detection for sensor streams.
 *
 * Tracks a rolling window of readings per sensor, detects sustained
 * trends (drift), and forecasts future values using linear regression.
 */
export interface DriftInfo {
    drifting: boolean;
    perSensor: Record<string, {
        direction: string;
        rate: number;
    }>;
    timeToViolation: Record<string, number | null>;
}
export interface DriftConfig {
    /** How many readings to keep for trend estimation (default: 20) */
    windowSize?: number;
    /** Rate threshold to flag as drifting (default: 0.5) */
    driftThreshold?: number;
}
/**
 * Simple drift detector using linear regression on a sliding window.
 *
 * For each sensor, tracks the last `windowSize` readings and fits a
 * line. If the slope exceeds `driftThreshold`, the sensor is flagged
 * as drifting. Time-to-violation is estimated by extrapolating the
 * trend to the nearest bound.
 */
export declare class DriftDetector {
    private windowSize;
    private driftThreshold;
    private sensors;
    private bounds;
    private tickCount;
    constructor(config?: DriftConfig);
    /**
     * Register bounds for a sensor (used for time-to-violation estimation).
     */
    setBounds(sensor: string, lo: number, hi: number): void;
    /**
     * Add a reading. Values is a map of sensor name → numeric value.
     */
    add(values: Record<string, number>): void;
    /**
     * Detect drift across all tracked sensors.
     *
     * Returns per-sensor drift direction, rate, and estimated time to
     * bound violation (null if not drifting or no bounds set).
     */
    detectDrift(): DriftInfo;
    /**
     * Forecast nAhead readings for each sensor using linear extrapolation.
     */
    forecast(nAhead?: number): Record<string, number>[];
    /** Number of readings recorded so far */
    get ticks(): number;
    /** Reset all tracked sensor data */
    reset(): void;
}
