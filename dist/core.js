/**
 * FLUX Exact Constraint Engine — Zero False Negatives
 *
 * INVARIANT: A value outside bounds is ALWAYS detected. No exceptions.
 * NaN always violates all constraints. No opt-in required.
 *
 * Port of flux_constraint_exact.py — same math, zero false negatives.
 */
// ── Severity ────────────────────────────────────────────────
export var Severity;
(function (Severity) {
    Severity[Severity["PASS"] = 0] = "PASS";
    Severity[Severity["CAUTION"] = 1] = "CAUTION";
    Severity[Severity["WARNING"] = 2] = "WARNING";
    Severity[Severity["CRITICAL"] = 3] = "CRITICAL";
})(Severity || (Severity = {}));
const SEVERITY_TABLE = [
    Severity.PASS, Severity.CAUTION, Severity.CAUTION,
    Severity.WARNING, Severity.WARNING,
    Severity.CRITICAL, Severity.CRITICAL, Severity.CRITICAL, Severity.CRITICAL,
];
function popcount(n) {
    let count = 0;
    while (n) {
        count += n & 1;
        n >>>= 1;
    }
    return count;
}
export function severityFromMask(mask) {
    const bits = popcount(mask);
    return SEVERITY_TABLE[Math.min(bits, SEVERITY_TABLE.length - 1)];
}
// ── Exact Checking ──────────────────────────────────────────
/**
 * Check exact constraints against a batch of values.
 *
 * Returns a Uint8Array where element i is:
 *   0 = pass (value within bounds)
 *   1 = violation (value outside bounds or NaN)
 *
 * Uses <= for bound comparison: value passes iff lo <= value <= hi.
 * NaN ALWAYS violates — no exceptions, zero false negatives.
 */
export function checkExact(values, bounds) {
    const n = values.length;
    const result = new Uint8Array(n);
    for (let i = 0; i < n; i++) {
        const v = values[i];
        const b = bounds[i];
        // NaN always violates — Number.isNaN catches NaN only
        if (Number.isNaN(v) || v < b.lo || v > b.hi) {
            result[i] = 1;
        }
    }
    return result;
}
/**
 * Check a single value against its bounds.
 * Returns 0 for pass, 1 for violation.
 */
export function checkOne(value, lo, hi) {
    if (Number.isNaN(value) || value < lo || value > hi) {
        return 1;
    }
    return 0;
}
/**
 * Compute an error bitmask from an array of per-constraint results.
 * Bit i is set iff constraints[i] was violated.
 */
export function errorMask(violations) {
    let mask = 0;
    for (let i = 0; i < violations.length; i++) {
        if (violations[i]) {
            mask |= (1 << i);
        }
    }
    return mask;
}
