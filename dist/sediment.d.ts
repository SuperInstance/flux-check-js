/**
 * Accumulated Correctness as Computational Sediment
 *
 * Models constraint correctness as geological sediment: layers of edge-case
 * corrections that accumulate over time, each layer immutable, new layers
 * superseding specific corrections from older ones.
 *
 * Port of flux_sediment.py
 */
export interface ConstraintCorrection {
    constraintName: string;
    oldLo?: number | null;
    oldHi?: number | null;
    newLo?: number | null;
    newHi?: number | null;
    overridePass?: boolean | null;
    reason: string;
}
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
export interface SedimentResult {
    baseErrorMask: number;
    baseSeverity: number;
    finalErrorMask: number;
    finalSeverity: number;
    layersApplied: number[];
    correctionsApplied: number;
    passed: boolean;
}
export declare class SedimentStack {
    private layers;
    private nextId;
    get depth(): number;
    get activeLayers(): SedimentLayer[];
    addLayer(inputContext: Record<string, unknown>, corrections: ConstraintCorrection[], provenance?: string, model?: string): SedimentLayer;
    supersedeLayer(oldId: number, newId: number): boolean;
    /**
     * Run a base check result through all active sediment layers.
     *
     * Each layer can modify bounds or override pass/fail for specific constraints.
     */
    checkWithSediment(baseErrorMask: number, baseSeverity: number, constraintNames: string[], values: Record<string, number>, constraintDefs?: Record<string, [number, number]>): SedimentResult;
    /**
     * Simplified apply: post-process an error mask through sediment.
     * Each correction can flip bits based on overridePass or widened bounds.
     */
    apply(errorMask: number, constraintNames: string[], values: Record<string, number>, constraintDefs?: Record<string, [number, number]>): number;
}
