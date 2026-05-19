/**
 * FRACTURE-COALESCE: Disjoint Linear Algebra for Constraint Systems
 *
 * THEOREM: If fracture correctly identifies connected components of the
 * constraint-dimension dependency graph, coalescence via bitwise OR
 * preserves zero false negatives.
 *
 * Port of flux_fracture.py
 */

// ── Dependency Graph ────────────────────────────────────────

export class DependencyGraph {
  /** Adjacency matrix: adjacency[constraint][dimension] = 0|1 */
  adjacency: Uint8Array[];
  nConstraints: number;
  nDimensions: number;
  constraintNames: string[];
  dimensionNames: string[];

  constructor(
    adjacency: Uint8Array[],
    constraintNames?: string[],
    dimensionNames?: string[]
  ) {
    this.nConstraints = adjacency.length;
    this.nDimensions = adjacency.length > 0 ? adjacency[0].length : 0;
    this.adjacency = adjacency;
    this.constraintNames = constraintNames ?? Array.from({ length: this.nConstraints }, (_, i) => `c${i}`);
    this.dimensionNames = dimensionNames ?? Array.from({ length: this.nDimensions }, (_, i) => `d${i}`);
  }

  static fromMasks(masks: number[][], constraintNames?: string[], dimensionNames?: string[]): DependencyGraph {
    const nC = masks.length;
    const nD = masks.length === 0 ? 0 : Math.max(...masks.flat()) + 1;
    const adj: Uint8Array[] = [];
    for (let i = 0; i < nC; i++) {
      const row = new Uint8Array(nD);
      for (const d of masks[i]) {
        row[d] = 1;
      }
      adj.push(row);
    }
    return new DependencyGraph(adj, constraintNames, dimensionNames);
  }

  involves(constraintIdx: number, dimensionIdx: number): boolean {
    return this.adjacency[constraintIdx]?.[dimensionIdx] === 1;
  }

  constraintDims(constraintIdx: number): number[] {
    const dims: number[] = [];
    const row = this.adjacency[constraintIdx];
    if (!row) return dims;
    for (let j = 0; j < row.length; j++) {
      if (row[j]) dims.push(j);
    }
    return dims;
  }

  dimConstraints(dimensionIdx: number): number[] {
    const constraints: number[] = [];
    for (let i = 0; i < this.nConstraints; i++) {
      if (this.adjacency[i]?.[dimensionIdx]) constraints.push(i);
    }
    return constraints;
  }
}

// ── Block & FractureResult ──────────────────────────────────

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

// ── Fracturer ───────────────────────────────────────────────

/**
 * Fracture a constraint system by finding connected components
 * of the bipartite constraint-dimension dependency graph via BFS.
 */
export function fracture(graph: DependencyGraph): FractureResult {
  const visitedC = new Uint8Array(graph.nConstraints);
  const visitedD = new Uint8Array(graph.nDimensions);
  const blocks: Block[] = [];

  // Seed from each unvisited constraint
  for (let seedC = 0; seedC < graph.nConstraints; seedC++) {
    if (visitedC[seedC]) continue;

    const compC = new Set<number>();
    const compD = new Set<number>();

    // BFS
    const queue: Array<["c" | "d", number]> = [["c", seedC]];

    while (queue.length > 0) {
      const [nodeType, idx] = queue.shift()!;

      if (nodeType === "c") {
        if (visitedC[idx]) continue;
        visitedC[idx] = 1;
        compC.add(idx);
        // Add all dimensions this constraint touches
        for (const d of graph.constraintDims(idx)) {
          if (!visitedD[d]) queue.push(["d", d]);
        }
      } else {
        if (visitedD[idx]) continue;
        visitedD[idx] = 1;
        compD.add(idx);
        // Add all constraints touching this dimension
        for (const c of graph.dimConstraints(idx)) {
          if (!visitedC[c]) queue.push(["c", c]);
        }
      }
    }

    blocks.push({
      constraintIndices: [...compC].sort((a, b) => a - b),
      dimensionIndices: [...compD].sort((a, b) => a - b),
      size: compC.size,
    });
  }

  // Seed from unvisited dimensions (dimensions with no constraints)
  for (let d = 0; d < graph.nDimensions; d++) {
    if (!visitedD[d]) {
      blocks.push({
        constraintIndices: [],
        dimensionIndices: [d],
        size: 0,
      });
    }
  }

  const largestBlockSize = blocks.reduce((max, b) => Math.max(max, b.size), 0);
  const nBlocks = blocks.length;
  const speedupPotential = largestBlockSize > 0 ? graph.nConstraints / largestBlockSize : 1.0;

  return { blocks, graph, nBlocks, largestBlockSize, speedupPotential };
}

// ── Coalescer ───────────────────────────────────────────────

/**
 * Coalesce block-level error masks into a unified error mask via bitwise OR.
 *
 * CORRECTNESS: Each block's error mask covers disjoint constraints.
 * Bitwise OR of all block masks captures ALL violations.
 */
export function coalesce(blockMasks: number[]): number {
  let result = 0;
  for (const m of blockMasks) {
    result |= m;
  }
  return result;
}

/**
 * Coalesce Uint8Array violation arrays via elementwise OR.
 */
export function coalesceArrays(blockArrays: Uint8Array[]): Uint8Array {
  if (blockArrays.length === 0) return new Uint8Array(0);
  const result = new Uint8Array(blockArrays[0].length);
  for (const arr of blockArrays) {
    for (let i = 0; i < result.length; i++) {
      result[i] |= arr[i];
    }
  }
  return result;
}

/**
 * Convenience: fracture from a list of constraint configs.
 * Each config may have 'dims' with dimension indices; defaults to [i].
 */
export function fractureFromConstraints(constraints: Array<{ dims?: number[] }>): FractureResult {
  const masks = constraints.map((c, i) => c.dims ?? [i]);
  const graph = DependencyGraph.fromMasks(masks);
  return fracture(graph);
}
