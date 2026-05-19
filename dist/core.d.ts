/**
 * FLUX Exact Constraint Engine — Zero False Negatives
 *
 * INVARIANT: A value outside bounds is ALWAYS detected. No exceptions.
 * NaN always violates all constraints. No opt-in required.
 *
 * Port of flux_constraint_exact.py — same math, zero false negatives.
 */
export declare enum Severity {
    PASS = 0,
    CAUTION = 1,
    WARNING = 2,
    CRITICAL = 3
}
export declare function severityFromMask(mask: number): Severity;
export interface ConstraintBound {
    lo: number;
    hi: number;
}
export interface ConstraintDef extends ConstraintBound {
    name: string;
}
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
export declare function checkExact(values: Float64Array | number[], bounds: ConstraintBound[]): Uint8Array;
/**
 * Check a single value against its bounds.
 * Returns 0 for pass, 1 for violation.
 */
export declare function checkOne(value: number, lo: number, hi: number): number;
/**
 * Compute an error bitmask from an array of per-constraint results.
 * Bit i is set iff constraints[i] was violated.
 */
export declare function errorMask(violations: Uint8Array | number[]): number;
