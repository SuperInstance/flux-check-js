/**
 * ConstraintEngine — Unified constraint checking with fracture and sediment.
 *
 * Combines exact checking, fracture-coalesce, and sediment layers
 * into a single engine.
 */

import { writeFileSync, readFileSync } from "node:fs";
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

  /**
   * Check N named values against their respective constraints by name.
   *
   * Unlike `check()` which accepts positional arrays or records, this
   * explicitly looks up each constraint by name in the values map.
   * Returns a combined CheckResult with all violations.
   *
   * @param values - Map of constraint name → numeric value to check
   */
  checkVector(values: Record<string, number>): CheckResult {
    const arr = new Float64Array(this.constraints.length);
    for (let i = 0; i < this.constraints.length; i++) {
      const c = this.constraints[i];
      arr[i] = values[c.name] ?? NaN;
    }
    const bounds = this.constraints.map(c => ({ lo: c.lo, hi: c.hi }));
    const violations = checkExact(arr, bounds);
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
    corrections: ConstraintCorrection[],
    provenance?: string,
    model?: string
  ): void {
    if (!this._sedimentStack) {
      this._sedimentStack = new SedimentStack();
      this.strategies.add("sediment");
    }
    this._sedimentStack.addLayer(inputContext, corrections, provenance ?? "", model ?? "");
  }

  /** Run check through sediment layers */
  checkWithSediment(values: Record<string, number> | number[] | Float64Array): SedimentResult {
    if (!this._sedimentStack) throw new Error("Sediment not enabled. Call use('sediment') first.");

    // Convert array/Float64Array to Record<string, number> for sediment
    let valueRecord: Record<string, number>;
    if (values instanceof Float64Array || Array.isArray(values)) {
      valueRecord = {};
      for (let i = 0; i < this.constraints.length; i++) {
        valueRecord[this.constraints[i].name] = values[i] ?? NaN;
      }
    } else {
      valueRecord = values;
    }

    const baseResult = this.check(valueRecord);
    const names = this.constraints.map(c => c.name);
    const defs: Record<string, [number, number]> = {};
    for (const c of this.constraints) {
      defs[c.name] = [c.lo, c.hi];
    }

    return this._sedimentStack.checkWithSediment(
      baseResult.errorMask,
      baseResult.severity,
      names,
      valueRecord,
      defs
    );
  }

  // ── Serialization ──────────────────────────────────────────

  /** Export engine config as a plain object */
  toJSON(): object {
    const data: any = {
      version: 1,
      constraints: this.constraints.map(c => ({
        name: c.name,
        lo: c.lo,
        hi: c.hi,
        ...(c.dims ? { dims: c.dims } : {}),
      })),
      strategies: [...this.strategies],
    };
    if (this._sedimentStack) {
      data.sedimentLayers = this._sedimentStack.activeLayers.map(l => ({
        inputContext: l.inputContext,
        corrections: l.corrections,
        provenance: l.provenance,
        model: l.model,
      }));
    }
    return data;
  }

  /** Reconstruct a ConstraintEngine from serialized config */
  static fromJSON(data: any): ConstraintEngine {
    const engine = new ConstraintEngine();
    for (const c of data.constraints) {
      engine.addConstraint(c.name, c.lo, c.hi, c.dims);
    }
    for (const s of (data.strategies ?? [])) {
      if (s !== "exact") engine.use(s as Strategy);
    }
    for (const layer of (data.sedimentLayers ?? [])) {
      engine.addSedimentLayer(layer.inputContext, layer.corrections, layer.provenance, layer.model);
    }
    return engine;
  }

  /** Write engine config to a file (Node.js only) */
  save(path: string): void {
    writeFileSync(path, JSON.stringify(this.toJSON(), null, 2), "utf-8");
  }

  /** Load a ConstraintEngine from a file */
  static load(path: string): ConstraintEngine {
    const raw = readFileSync(path, "utf-8");
    return ConstraintEngine.fromJSON(JSON.parse(raw));
  }

  // ── Aggregation ────────────────────────────────────────────

  /** Check a batch of readings and return aggregate statistics */
  checkAndAggregate(valuesBatch: Record<string, number>[]): {
    totalReadings: number;
    totalViolations: number;
    violationRate: number;
    perConstraintViolationRate: Record<string, number>;
    worstReading: { index: number; result: CheckResult };
    severityBreakdown: Record<string, number>;
  } {
    let totalViolations = 0;
    const perConstraintCounts: Record<string, number> = {};
    for (const c of this.constraints) {
      perConstraintCounts[c.name] = 0;
    }
    const severityBreakdown: Record<string, number> = {
      PASS: 0,
      CAUTION: 0,
      WARNING: 0,
      CRITICAL: 0,
    };
    let worstIdx = 0;
    let worstResult: CheckResult | null = null;
    let worstViolationCount = -1;

    const results: CheckResult[] = [];
    for (let i = 0; i < valuesBatch.length; i++) {
      const result = this.check(valuesBatch[i]);
      results.push(result);
      totalViolations += result.violationCount;
      for (const name of result.violatedNames) {
        perConstraintCounts[name]++;
      }
      const sevKey = Severity[result.severity] as string;
      severityBreakdown[sevKey]++;
      if (result.violationCount > worstViolationCount) {
        worstViolationCount = result.violationCount;
        worstIdx = i;
        worstResult = result;
      }
    }

    const totalChecks = valuesBatch.length * this.constraints.length;
    const perConstraintViolationRate: Record<string, number> = {};
    for (const c of this.constraints) {
      perConstraintViolationRate[c.name] =
        valuesBatch.length > 0 ? perConstraintCounts[c.name] / valuesBatch.length : 0;
    }

    return {
      totalReadings: valuesBatch.length,
      totalViolations,
      violationRate: totalChecks > 0 ? totalViolations / totalChecks : 0,
      perConstraintViolationRate,
      worstReading: { index: worstIdx, result: worstResult ?? this.check(valuesBatch[0] ?? {}) },
      severityBreakdown,
    };
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
