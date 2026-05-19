/**
 * ConstraintEngine — Unified constraint checking with fracture and sediment.
 *
 * Combines exact checking, fracture-coalesce, and sediment layers
 * into a single engine.
 */

import { checkExact, errorMask, Severity, severityFromMask, type ConstraintDef } from "./core.js";
import { fracture, coalesce, DependencyGraph, type FractureResult } from "./fracture.js";
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
  dims?: number[]; // dimension indices for fracture
}

type Strategy = "exact" | "fracture" | "sediment";

export class ConstraintEngine {
  private constraints: EngineConstraint[] = [];
  private strategies: Set<Strategy> = new Set(["exact"]);
  private _sedimentStack: SedimentStack | null = null;
  private _lastFracture: FractureResult | null = null;

  /** Add a constraint definition */
  addConstraint(name: string, lo: number, hi: number, dims?: number[]): this {
    if (lo > hi) throw new Error(`Constraint '${name}': lo (${lo}) > hi (${hi})`);
    this.constraints.push({ name, lo, hi, dims });
    return this;
  }

  /** Enable a strategy: "fracture", "sediment", or "exact" */
  use(strategy: Strategy): this {
    this.strategies.add(strategy);
    if (strategy === "sediment" && !this._sedimentStack) {
      this._sedimentStack = new SedimentStack();
    }
    return this;
  }

  /** Check values against all constraints */
  check(values: Float64Array | number[] | Record<string, number>): CheckResult {
    const vals = this._normalizeValues(values);
    const bounds = this.constraints.map(c => ({ lo: c.lo, hi: c.hi }));

    // Exact check
    const violations = checkExact(vals, bounds);
    const mask = errorMask(violations);
    const severity = severityFromMask(mask);

    const violatedNames: string[] = [];
    for (let i = 0; i < violations.length; i++) {
      if (violations[i]) violatedNames.push(this.constraints[i].name);
    }

    return {
      errorMask: mask,
      violations,
      severity,
      violationCount: violatedNames.length,
      violatedNames,
    };
  }

  /** Fracture the constraint system into independent blocks */
  fracture(): FractureResult {
    const masks = this.constraints.map((c, i) => c.dims ?? [i]);
    const graph = DependencyGraph.fromMasks(
      masks,
      this.constraints.map(c => c.name)
    );
    this._lastFracture = fracture(graph);
    return this._lastFracture;
  }

  /** Add a sediment correction layer */
  addSedimentLayer(
    inputContext: Record<string, unknown>,
    corrections: ConstraintCorrection[]
  ): void {
    if (!this._sedimentStack) {
      this._sedimentStack = new SedimentStack();
      this.strategies.add("sediment");
    }
    this._sedimentStack.addLayer(inputContext, corrections);
  }

  /** Run check through sediment layers */
  checkWithSediment(values: Record<string, number>): SedimentResult {
    if (!this._sedimentStack) throw new Error("Sediment not enabled. Call use('sediment') first.");

    const baseResult = this.check(values);
    const names = this.constraints.map(c => c.name);
    const defs: Record<string, [number, number]> = {};
    for (const c of this.constraints) {
      defs[c.name] = [c.lo, c.hi];
    }

    return this._sedimentStack.checkWithSediment(
      baseResult.errorMask,
      baseResult.severity,
      names,
      values,
      defs
    );
  }

  get constraintCount(): number {
    return this.constraints.length;
  }

  get sedimentStack(): SedimentStack | null {
    return this._sedimentStack;
  }

  private _normalizeValues(
    values: Float64Array | number[] | Record<string, number>
  ): Float64Array {
    if (values instanceof Float64Array) return values;
    if (Array.isArray(values)) return new Float64Array(values);

    // Record<string, number> — map by constraint name
    const arr = new Float64Array(this.constraints.length);
    for (let i = 0; i < this.constraints.length; i++) {
      arr[i] = values[this.constraints[i].name] ?? NaN;
    }
    return arr;
  }
}
