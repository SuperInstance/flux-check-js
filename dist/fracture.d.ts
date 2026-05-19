/**
 * FRACTURE-COALESCE: Disjoint Linear Algebra for Constraint Systems
 *
 * THEOREM: If fracture correctly identifies connected components of the
 * constraint-dimension dependency graph, coalescence via bitwise OR
 * preserves zero false negatives.
 *
 * Port of flux_fracture.py
 */
export declare class DependencyGraph {
    /** Adjacency matrix: adjacency[constraint][dimension] = 0|1 */
    adjacency: Uint8Array[];
    nConstraints: number;
    nDimensions: number;
    constraintNames: string[];
    dimensionNames: string[];
    constructor(adjacency: Uint8Array[], constraintNames?: string[], dimensionNames?: string[]);
    static fromMasks(masks: number[][], constraintNames?: string[], dimensionNames?: string[]): DependencyGraph;
    involves(constraintIdx: number, dimensionIdx: number): boolean;
    constraintDims(constraintIdx: number): number[];
    dimConstraints(dimensionIdx: number): number[];
}
export interface Block {
    constraintIndices: number[];
    dimensionIndices: number[];
    size: number;
}
export interface FractureResult {
    blocks: Block[];
    graph: DependencyGraph;
    nBlocks: number;
    largestBlockSize: number;
    speedupPotential: number;
}
/**
 * Fracture a constraint system by finding connected components
 * of the bipartite constraint-dimension dependency graph via BFS.
 */
export declare function fracture(graph: DependencyGraph): FractureResult;
/**
 * Coalesce block-level error masks into a unified error mask via bitwise OR.
 *
 * CORRECTNESS: Each block's error mask covers disjoint constraints.
 * Bitwise OR of all block masks captures ALL violations.
 */
export declare function coalesce(blockMasks: number[]): number;
/**
 * Coalesce Uint8Array violation arrays via elementwise OR.
 */
export declare function coalesceArrays(blockArrays: Uint8Array[]): Uint8Array;
/**
 * Convenience: fracture from a list of constraint configs.
 * Each config may have 'dims' with dimension indices; defaults to [i].
 */
export declare function fractureFromConstraints(constraints: Array<{
    dims?: number[];
}>): FractureResult;
