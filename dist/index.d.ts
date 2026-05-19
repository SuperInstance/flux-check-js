/**
 * @flux/check — Flux constraint engine: exact checking, fracture-coalesce, sediment layers.
 *
 * @module
 */
export { checkExact, checkOne, errorMask, severityFromMask, Severity } from "./core.js";
export type { ConstraintBound, ConstraintDef } from "./core.js";
export { fracture, fractureFromConstraints, coalesce, coalesceArrays, DependencyGraph, } from "./fracture.js";
export type { Block, FractureResult } from "./fracture.js";
export { SedimentStack } from "./sediment.js";
export type { ConstraintCorrection, SedimentLayer, SedimentResult, } from "./sediment.js";
export { ConstraintEngine } from "./engine.js";
export type { CheckResult, EngineConstraint } from "./engine.js";
