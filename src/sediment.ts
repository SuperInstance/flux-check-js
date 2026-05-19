/**
 * Accumulated Correctness as Computational Sediment
 *
 * Models constraint correctness as geological sediment: layers of edge-case
 * corrections that accumulate over time, each layer immutable, new layers
 * superseding specific corrections from older ones.
 *
 * Port of flux_sediment.py
 */

// ── ConstraintCorrection ────────────────────────────────────

export interface ConstraintCorrection {
  constraintName: string;
  oldLo?: number | null;
  oldHi?: number | null;
  newLo?: number | null;
  newHi?: number | null;
  overridePass?: boolean | null;
  reason: string;
}

function applyCorrection(
  correction: ConstraintCorrection,
  lo: number,
  hi: number,
  passed: boolean
): [number, number, boolean] {
  const outLo = correction.newLo != null ? correction.newLo : lo;
  const outHi = correction.newHi != null ? correction.newHi : hi;
  const outPassed = correction.overridePass != null ? correction.overridePass : passed;
  return [outLo, outHi, outPassed];
}

// ── SedimentLayer ───────────────────────────────────────────

export interface SedimentLayer {
  layerId: number;
  inputContext: Record<string, unknown>;
  corrections: ConstraintCorrection[];
  timestamp: number;
  provenance: string;
  model: string;
  superseded: boolean;
  supersededBy: number | null;
  catchCount: number;
}

// ── SedimentResult ──────────────────────────────────────────

export interface SedimentResult {
  baseErrorMask: number;
  baseSeverity: number;
  finalErrorMask: number;
  finalSeverity: number;
  layersApplied: number[];
  correctionsApplied: number;
  passed: boolean;
}

// ── SedimentStack ───────────────────────────────────────────

export class SedimentStack {
  private layers: SedimentLayer[] = [];
  private nextId = 0;

  get depth(): number {
    return this.layers.length;
  }

  get activeLayers(): SedimentLayer[] {
    return this.layers.filter(l => !l.superseded);
  }

  addLayer(
    inputContext: Record<string, unknown>,
    corrections: ConstraintCorrection[],
    provenance = "",
    model = ""
  ): SedimentLayer {
    const layer: SedimentLayer = {
      layerId: this.nextId,
      inputContext,
      corrections,
      timestamp: Date.now() / 1000,
      provenance,
      model,
      superseded: false,
      supersededBy: null,
      catchCount: 0,
    };
    this.layers.push(layer);
    this.nextId++;
    return layer;
  }

  supersedeLayer(oldId: number, newId: number): boolean {
    for (const layer of this.layers) {
      if (layer.layerId === oldId && !layer.superseded) {
        layer.superseded = true;
        layer.supersededBy = newId;
        return true;
      }
    }
    return false;
  }

  /**
   * Run a base check result through all active sediment layers.
   *
   * Each layer can modify bounds or override pass/fail for specific constraints.
   */
  checkWithSediment(
    baseErrorMask: number,
    baseSeverity: number,
    constraintNames: string[],
    values: Record<string, number>,
    constraintDefs?: Record<string, [number, number]>
  ): SedimentResult {
    let currentMask = baseErrorMask;
    const layersApplied: number[] = [];
    let correctionsApplied = 0;

    // Track accumulated bounds from corrections
    const accumulatedBounds: Record<string, [number, number]> = {};
    if (constraintDefs) {
      for (const [k, v] of Object.entries(constraintDefs)) {
        accumulatedBounds[k] = [...v] as [number, number];
      }
    }

    for (const layer of this.layers) {
      if (layer.superseded) continue;

      let layerModified = false;

      for (const correction of layer.corrections) {
        const idx = constraintNames.indexOf(correction.constraintName);
        if (idx === -1) continue;

        const bit = 1 << idx;
        const isViolated = Boolean(currentMask & bit);

        // Override pass/fail takes priority
        if (correction.overridePass != null) {
          if (correction.overridePass && isViolated) {
            currentMask &= ~bit;
            layerModified = true;
          } else if (!correction.overridePass && !isViolated) {
            currentMask |= bit;
            layerModified = true;
          }
        } else if (constraintDefs && correction.constraintName in constraintDefs) {
          const orig = accumulatedBounds[correction.constraintName] ?? constraintDefs[correction.constraintName];
          const [newLo, newHi] = applyCorrection(correction, orig[0], orig[1], !isViolated);
          accumulatedBounds[correction.constraintName] = [newLo, newHi];

          // Re-check with updated bounds
          const value = values[correction.constraintName];
          if (value != null && !Number.isNaN(value)) {
            const newPassed = value >= newLo && value <= newHi;
            if (newPassed && isViolated) {
              currentMask &= ~bit;
              layerModified = true;
            } else if (!newPassed && !isViolated) {
              currentMask |= bit;
              layerModified = true;
            }
          }
        }

        if (layerModified) correctionsApplied++;
      }

      if (layerModified) {
        layersApplied.push(layer.layerId);
        layer.catchCount++;
      }
    }

    return {
      baseErrorMask,
      baseSeverity,
      finalErrorMask: currentMask,
      finalSeverity: currentMask === 0 ? 0 : baseSeverity,
      layersApplied,
      correctionsApplied,
      passed: currentMask === 0,
    };
  }

  /**
   * Simplified apply: post-process an error mask through sediment.
   * Each correction can flip bits based on overridePass or widened bounds.
   */
  apply(
    errorMask: number,
    constraintNames: string[],
    values: Record<string, number>,
    constraintDefs?: Record<string, [number, number]>
  ): number {
    const result = this.checkWithSediment(errorMask, 0, constraintNames, values, constraintDefs);
    return result.finalErrorMask;
  }
}
