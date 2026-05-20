/**
 * ConstraintEngine — Unified constraint checking with fracture and sediment.
 *
 * Combines exact checking, fracture-coalesce, and sediment layers
 * into a single engine.
 */
import { Severity } from "./core.js";
import { type FractureResult } from "./fracture.js";
import { SedimentStack, type ConstraintCorrection, type SedimentResult } from "./sediment.js";
export interface CheckResult {
    /** Bitmask: bit i set iff constraint i is violated */
    errorMask: number;
    /** Per-constraint violations (0 or 1) */
    violations: Uint8Array;
    /** Max severity across all violations */
    severity: Severity;
    /** Number of violated constraints */
    violationCount: number;
    /** Constraint names that are violated */
    violatedNames: string[];
}
export interface EngineConstraint {
    name: string;
    lo: number;
    hi: number;
    dims?: number[];
}
type Strategy = "exact" | "fracture" | "sediment";
export declare class ConstraintEngine {
    private constraints;
    private strategies;
    private _sedimentStack;
    private _lastFracture;
    /** Add a constraint definition */
    addConstraint(name: string, lo: number, hi: number, dims?: number[]): this;
    /** Enable a strategy: "fracture", "sediment", or "exact" */
    use(strategy: Strategy): this;
    /**
     * Check N named values against their respective constraints by name.
     *
     * Unlike `check()` which accepts positional arrays or records, this
     * explicitly looks up each constraint by name in the values map.
     * Returns a combined CheckResult with all violations.
     *
     * @param values - Map of constraint name → numeric value to check
     */
    checkVector(values: Record<string, number>): CheckResult;
    /** Check values against all constraints */
    check(values: Float64Array | number[] | Record<string, number>): CheckResult;
    /** Fracture the constraint system into independent blocks */
    fracture(): FractureResult;
    /** Add a sediment correction layer */
    addSedimentLayer(inputContext: Record<string, unknown>, corrections: ConstraintCorrection[], provenance?: string, model?: string): void;
    /** Run check through sediment layers */
    checkWithSediment(values: Record<string, number> | number[] | Float64Array): SedimentResult;
    /** Export engine config as a plain object */
    toJSON(): object;
    /** Reconstruct a ConstraintEngine from serialized config */
    static fromJSON(data: any): ConstraintEngine;
    /** Write engine config to a file (Node.js only) */
    save(path: string): void;
    /** Load a ConstraintEngine from a file */
    static load(path: string): ConstraintEngine;
    /** Check a batch of readings and return aggregate statistics */
    checkAndAggregate(valuesBatch: Record<string, number>[]): {
        totalReadings: number;
        totalViolations: number;
        violationRate: number;
        perConstraintViolationRate: Record<string, number>;
        worstReading: {
            index: number;
            result: CheckResult;
        };
        severityBreakdown: Record<string, number>;
    };
    get constraintCount(): number;
    get sedimentStack(): SedimentStack | null;
    private _normalizeValues;
}
export {};
