/**
 * @flux/check — Flux constraint engine: exact checking, fracture-coalesce, sediment layers.
 *
 * @module
 */
// Core: exact constraint checking
export { checkExact, checkOne, errorMask, severityFromMask, Severity } from "./core.js";
// Fracture: dependency graph fracture & coalesce
export { fracture, fractureFromConstraints, coalesce, coalesceArrays, DependencyGraph, } from "./fracture.js";
// Sediment: accumulated correctness layers
export { SedimentStack } from "./sediment.js";
// Engine: unified interface
export { ConstraintEngine } from "./engine.js";
