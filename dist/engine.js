/**
 * ConstraintEngine — Unified constraint checking with fracture and sediment.
 *
 * Combines exact checking, fracture-coalesce, and sediment layers
 * into a single engine.
 */
import { writeFileSync, readFileSync } from "node:fs";
import { checkExact, errorMask, Severity, severityFromMask } from "./core.js";
import { fracture, DependencyGraph } from "./fracture.js";
import { SedimentStack } from "./sediment.js";
export class ConstraintEngine {
    constraints = [];
    strategies = new Set(["exact"]);
    _sedimentStack = null;
    _lastFracture = null;
    /** Add a constraint definition */
    addConstraint(name, lo, hi, dims) {
        if (lo > hi)
            throw new Error(`Constraint '${name}': lo (${lo}) > hi (${hi})`);
        this.constraints.push({ name, lo, hi, dims });
        return this;
    }
    /** Enable a strategy: "fracture", "sediment", or "exact" */
    use(strategy) {
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
    checkVector(values) {
        const arr = new Float64Array(this.constraints.length);
        for (let i = 0; i < this.constraints.length; i++) {
            const c = this.constraints[i];
            arr[i] = values[c.name] ?? NaN;
        }
        const bounds = this.constraints.map(c => ({ lo: c.lo, hi: c.hi }));
        const violations = checkExact(arr, bounds);
        const mask = errorMask(violations);
        const severity = severityFromMask(mask);
        const violatedNames = [];
        for (let i = 0; i < violations.length; i++) {
            if (violations[i])
                violatedNames.push(this.constraints[i].name);
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
    check(values) {
        const vals = this._normalizeValues(values);
        const bounds = this.constraints.map(c => ({ lo: c.lo, hi: c.hi }));
        // Exact check
        const violations = checkExact(vals, bounds);
        const mask = errorMask(violations);
        const severity = severityFromMask(mask);
        const violatedNames = [];
        for (let i = 0; i < violations.length; i++) {
            if (violations[i])
                violatedNames.push(this.constraints[i].name);
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
    fracture() {
        const masks = this.constraints.map((c, i) => c.dims ?? [i]);
        const graph = DependencyGraph.fromMasks(masks, this.constraints.map(c => c.name));
        this._lastFracture = fracture(graph);
        return this._lastFracture;
    }
    /** Add a sediment correction layer */
    addSedimentLayer(inputContext, corrections, provenance, model) {
        if (!this._sedimentStack) {
            this._sedimentStack = new SedimentStack();
            this.strategies.add("sediment");
        }
        this._sedimentStack.addLayer(inputContext, corrections, provenance ?? "", model ?? "");
    }
    /** Run check through sediment layers */
    checkWithSediment(values) {
        if (!this._sedimentStack)
            throw new Error("Sediment not enabled. Call use('sediment') first.");
        // Convert array/Float64Array to Record<string, number> for sediment
        let valueRecord;
        if (values instanceof Float64Array || Array.isArray(values)) {
            valueRecord = {};
            for (let i = 0; i < this.constraints.length; i++) {
                valueRecord[this.constraints[i].name] = values[i] ?? NaN;
            }
        }
        else {
            valueRecord = values;
        }
        const baseResult = this.check(valueRecord);
        const names = this.constraints.map(c => c.name);
        const defs = {};
        for (const c of this.constraints) {
            defs[c.name] = [c.lo, c.hi];
        }
        return this._sedimentStack.checkWithSediment(baseResult.errorMask, baseResult.severity, names, valueRecord, defs);
    }
    // ── Serialization ──────────────────────────────────────────
    /** Export engine config as a plain object */
    toJSON() {
        const data = {
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
    static fromJSON(data) {
        const engine = new ConstraintEngine();
        for (const c of data.constraints) {
            engine.addConstraint(c.name, c.lo, c.hi, c.dims);
        }
        for (const s of (data.strategies ?? [])) {
            if (s !== "exact")
                engine.use(s);
        }
        for (const layer of (data.sedimentLayers ?? [])) {
            engine.addSedimentLayer(layer.inputContext, layer.corrections, layer.provenance, layer.model);
        }
        return engine;
    }
    /** Write engine config to a file (Node.js only) */
    save(path) {
        writeFileSync(path, JSON.stringify(this.toJSON(), null, 2), "utf-8");
    }
    /** Load a ConstraintEngine from a file */
    static load(path) {
        const raw = readFileSync(path, "utf-8");
        return ConstraintEngine.fromJSON(JSON.parse(raw));
    }
    // ── Aggregation ────────────────────────────────────────────
    /** Check a batch of readings and return aggregate statistics */
    checkAndAggregate(valuesBatch) {
        let totalViolations = 0;
        const perConstraintCounts = {};
        for (const c of this.constraints) {
            perConstraintCounts[c.name] = 0;
        }
        const severityBreakdown = {
            PASS: 0,
            CAUTION: 0,
            WARNING: 0,
            CRITICAL: 0,
        };
        let worstIdx = 0;
        let worstResult = null;
        let worstViolationCount = -1;
        const results = [];
        for (let i = 0; i < valuesBatch.length; i++) {
            const result = this.check(valuesBatch[i]);
            results.push(result);
            totalViolations += result.violationCount;
            for (const name of result.violatedNames) {
                perConstraintCounts[name]++;
            }
            const sevKey = Severity[result.severity];
            severityBreakdown[sevKey]++;
            if (result.violationCount > worstViolationCount) {
                worstViolationCount = result.violationCount;
                worstIdx = i;
                worstResult = result;
            }
        }
        const totalChecks = valuesBatch.length * this.constraints.length;
        const perConstraintViolationRate = {};
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
    get constraintCount() {
        return this.constraints.length;
    }
    get sedimentStack() {
        return this._sedimentStack;
    }
    _normalizeValues(values) {
        if (values instanceof Float64Array)
            return values;
        if (Array.isArray(values))
            return new Float64Array(values);
        // Record<string, number> — map by constraint name
        const arr = new Float64Array(this.constraints.length);
        for (let i = 0; i < this.constraints.length; i++) {
            arr[i] = values[this.constraints[i].name] ?? NaN;
        }
        return arr;
    }
}
