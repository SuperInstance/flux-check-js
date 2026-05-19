/**
 * @flux/check — Flux constraint engine: exact checking, fracture-coalesce, sediment layers.
 *
 * @module
 */

// Core: exact constraint checking
export { checkExact, checkOne, errorMask, severityFromMask, Severity } from "./core.js";
export type { ConstraintBound, ConstraintDef } from "./core.js";

// Fracture: dependency graph fracture & coalesce
export {
  fracture,
  fractureFromConstraints,
  coalesce,
  coalesceArrays,
  DependencyGraph,
} from "./fracture.js";
export type { Block, FractureResult } from "./fracture.js";

// Sediment: accumulated correctness layers
export { SedimentStack } from "./sediment.js";
export type {
  ConstraintCorrection,
  SedimentLayer,
  SedimentResult,
} from "./sediment.js";

// Engine: unified interface
export { ConstraintEngine } from "./engine.js";
export type { CheckResult, EngineConstraint } from "./engine.js";

// Presets: industry constraint definitions
export { presets, getPreset, listPresets } from "./presets.js";
export type { Preset, PresetConstraint } from "./presets.js";
