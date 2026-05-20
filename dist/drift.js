/**
 * Drift Detection — Simple linear drift detection for sensor streams.
 *
 * Tracks a rolling window of readings per sensor, detects sustained
 * trends (drift), and forecasts future values using linear regression.
 */
/**
 * Simple drift detector using linear regression on a sliding window.
 *
 * For each sensor, tracks the last `windowSize` readings and fits a
 * line. If the slope exceeds `driftThreshold`, the sensor is flagged
 * as drifting. Time-to-violation is estimated by extrapolating the
 * trend to the nearest bound.
 */
export class DriftDetector {
    windowSize;
    driftThreshold;
    sensors = new Map();
    bounds = new Map();
    tickCount = 0;
    constructor(config) {
        this.windowSize = config?.windowSize ?? 20;
        this.driftThreshold = config?.driftThreshold ?? 0.5;
    }
    /**
     * Register bounds for a sensor (used for time-to-violation estimation).
     */
    setBounds(sensor, lo, hi) {
        this.bounds.set(sensor, { lo, hi });
    }
    /**
     * Add a reading. Values is a map of sensor name → numeric value.
     */
    add(values) {
        this.tickCount++;
        const now = this.tickCount;
        for (const [sensor, value] of Object.entries(values)) {
            if (!this.sensors.has(sensor)) {
                this.sensors.set(sensor, { values: [], timestamps: [] });
            }
            const win = this.sensors.get(sensor);
            win.values.push(value);
            win.timestamps.push(now);
            // Trim to window size
            if (win.values.length > this.windowSize) {
                win.values.shift();
                win.timestamps.shift();
            }
        }
    }
    /**
     * Detect drift across all tracked sensors.
     *
     * Returns per-sensor drift direction, rate, and estimated time to
     * bound violation (null if not drifting or no bounds set).
     */
    detectDrift() {
        const perSensor = {};
        const timeToViolation = {};
        let anyDrifting = false;
        for (const [sensor, win] of this.sensors) {
            if (win.values.length < 3) {
                perSensor[sensor] = { direction: "unknown", rate: 0 };
                timeToViolation[sensor] = null;
                continue;
            }
            const { slope } = linearRegression(win.timestamps, win.values);
            const absSlope = Math.abs(slope);
            if (absSlope >= this.driftThreshold) {
                anyDrifting = true;
                perSensor[sensor] = {
                    direction: slope > 0 ? "up" : "down",
                    rate: slope,
                };
                // Estimate time to violation
                const b = this.bounds.get(sensor);
                if (b) {
                    const lastVal = win.values[win.values.length - 1];
                    const ttv = estimateTimeToViolation(lastVal, slope, b.lo, b.hi);
                    timeToViolation[sensor] = ttv;
                }
                else {
                    timeToViolation[sensor] = null;
                }
            }
            else {
                perSensor[sensor] = { direction: "stable", rate: slope };
                timeToViolation[sensor] = null;
            }
        }
        return { drifting: anyDrifting, perSensor, timeToViolation };
    }
    /**
     * Forecast nAhead readings for each sensor using linear extrapolation.
     */
    forecast(nAhead = 5) {
        const forecasts = [];
        for (let step = 1; step <= nAhead; step++) {
            const entry = {};
            for (const [sensor, win] of this.sensors) {
                if (win.values.length < 2) {
                    entry[sensor] = win.values.length === 1 ? win.values[0] : NaN;
                    continue;
                }
                const { slope, intercept } = linearRegression(win.timestamps, win.values);
                const lastT = win.timestamps[win.timestamps.length - 1];
                entry[sensor] = intercept + slope * (lastT + step);
            }
            forecasts.push(entry);
        }
        return forecasts;
    }
    /** Number of readings recorded so far */
    get ticks() {
        return this.tickCount;
    }
    /** Reset all tracked sensor data */
    reset() {
        this.sensors.clear();
        this.tickCount = 0;
    }
}
// ── Helpers ─────────────────────────────────────────────────
/** Simple linear regression: y = slope * x + intercept */
function linearRegression(xs, ys) {
    const n = xs.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
    for (let i = 0; i < n; i++) {
        sumX += xs[i];
        sumY += ys[i];
        sumXY += xs[i] * ys[i];
        sumXX += xs[i] * xs[i];
    }
    const denom = n * sumXX - sumX * sumX;
    if (denom === 0)
        return { slope: 0, intercept: sumY / n };
    const slope = (n * sumXY - sumX * sumY) / denom;
    const intercept = (sumY - slope * sumX) / n;
    return { slope, intercept };
}
/**
 * Estimate readings until the forecasted value crosses a bound.
 * Returns number of readings, or null if it won't cross.
 */
function estimateTimeToViolation(currentValue, rate, lo, hi) {
    if (rate === 0)
        return null;
    if (rate > 0) {
        // Trending up → will it hit hi?
        if (currentValue >= hi)
            return 0; // already violated
        if (currentValue < hi) {
            const steps = Math.ceil((hi - currentValue) / rate);
            return steps > 0 ? steps : null;
        }
    }
    else {
        // Trending down → will it hit lo?
        if (currentValue <= lo)
            return 0; // already violated
        if (currentValue > lo) {
            const steps = Math.ceil((lo - currentValue) / rate);
            return steps > 0 ? steps : null;
        }
    }
    return null;
}
