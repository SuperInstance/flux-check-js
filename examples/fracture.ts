/**
 * Fracture-coalesce: decompose constraints into independent blocks.
 */
import { ConstraintEngine } from "../src/index.js";

const engine = new ConstraintEngine();
engine.addConstraint("temp_1", -40, 150, [0]);
engine.addConstraint("pressure_1", 0, 100, [1]);
engine.addConstraint("temp_2", -40, 150, [2]);
engine.addConstraint("pressure_2", 0, 100, [3]);
engine.addConstraint("coupled", -10, 10, [0, 2]); // links temp_1 and temp_2

const result = engine.fracture();

console.log("Blocks:", result.nBlocks);
console.log("Largest block:", result.largestBlockSize, "constraints");
console.log("Speedup potential:", result.speedupPotential.toFixed(2) + "x");

for (const block of result.blocks) {
  console.log(`  Block [${block.constraintIndices}]: ${block.size} constraints, dims [${block.dimensionIndices}]`);
}
