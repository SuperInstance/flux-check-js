/**
 * Tests for @flux/check — runnable with `node tests/core.test.mjs` after `tsc`
 */

import {
  checkExact, checkOne, errorMask, severityFromMask, Severity,
  fracture, coalesce, coalesceArrays, DependencyGraph,
  SedimentStack,
  ConstraintEngine,
} from "../dist/index.js";

let passed = 0;
let failed = 0;

function assert(condition, msg) {
  if (!condition) {
    console.error(`  ✗ FAIL: ${msg}`);
    failed++;
    console.trace();
  } else {
    passed++;
  }
}

function assertEqual(actual, expected, msg) {
  if (actual !== expected) {
    console.error(`  ✗ FAIL: ${msg} — expected ${expected}, got ${actual}`);
    failed++;
  } else {
    passed++;
  }
}

function section(name) {
  console.log(`\n── ${name} ${"-".repeat(Math.max(0, 60 - name.length))}`);
}

// ════════════════════════════════════════════════════════════
// 1. Exact Constraint Checking
// ════════════════════════════════════════════════════════════

section("Exact Constraint Checking");

{
  const vals = new Float64Array([50, 100, -10]);
  const bounds = [{ lo: 0, hi: 100 }, { lo: 50, hi: 150 }, { lo: -40, hi: 40 }];
  const result = checkExact(vals, bounds);
  assertEqual(result[0], 0, "50 in [0,100] passes");
  assertEqual(result[1], 0, "100 in [50,150] passes");
  assertEqual(result[2], 0, "-10 in [-40,40] passes");
}

{
  const vals = new Float64Array([0, 100, -40, 150]);
  const bounds = [{ lo: 0, hi: 100 }, { lo: 0, hi: 100 }, { lo: -40, hi: 40 }, { lo: 50, hi: 150 }];
  const result = checkExact(vals, bounds);
  assertEqual(result[0], 0, "exactly at lo=0 passes");
  assertEqual(result[1], 0, "exactly at hi=100 passes");
  assertEqual(result[2], 0, "exactly at lo=-40 passes");
  assertEqual(result[3], 0, "exactly at hi=150 passes");
}

{
  const vals = new Float64Array([-0.001, 100.001, -40.001, 150.001]);
  const bounds = [{ lo: 0, hi: 100 }, { lo: 0, hi: 100 }, { lo: -40, hi: 40 }, { lo: 50, hi: 150 }];
  const result = checkExact(vals, bounds);
  assertEqual(result[0], 1, "just below lo fails");
  assertEqual(result[1], 1, "just above hi fails");
  assertEqual(result[2], 1, "just below lo fails");
  assertEqual(result[3], 1, "just above hi fails");
}

{
  const vals = new Float64Array([NaN, 50, NaN]);
  const bounds = [{ lo: 0, hi: 100 }, { lo: 0, hi: 100 }, { lo: -1000, hi: 1000 }];
  const result = checkExact(vals, bounds);
  assertEqual(result[0], 1, "NaN violates even valid bounds");
  assertEqual(result[1], 0, "non-NaN passes normally");
  assertEqual(result[2], 1, "NaN violates even [-1000, 1000]");
}

{
  assertEqual(checkOne(50, 0, 100), 0, "checkOne: 50 in [0,100]");
  assertEqual(checkOne(NaN, 0, 100), 1, "checkOne: NaN violates");
  assertEqual(checkOne(-1, 0, 100), 1, "checkOne: -1 below lo");
  assertEqual(checkOne(0, 0, 100), 0, "checkOne: 0 at lo boundary");
  assertEqual(checkOne(100, 0, 100), 0, "checkOne: 100 at hi boundary");
}

{
  const violations = new Uint8Array([0, 1, 0, 1, 1]);
  const mask = errorMask(violations);
  assertEqual(mask, 26, "errorMask: bits 1,3,4 set = 26");
  assertEqual(errorMask(new Uint8Array([0, 0, 0])), 0, "errorMask: all pass = 0");
}

{
  assertEqual(severityFromMask(0), Severity.PASS, "0 bits → PASS");
  assertEqual(severityFromMask(1), Severity.CAUTION, "1 bit → CAUTION");
}

// ════════════════════════════════════════════════════════════
// 2. Fracture-Coalesce
// ════════════════════════════════════════════════════════════

section("Fracture-Coalesce");

{
  const masks = [[0], [1], [2]];
  const graph = DependencyGraph.fromMasks(masks, ["temp", "pressure", "flow"]);
  const result = fracture(graph);
  assertEqual(result.nBlocks, 3, "3 independent constraints → 3 blocks");
  assertEqual(result.blocks[0].size, 1, "each block has 1 constraint");
  assertEqual(result.speedupPotential, 3, "speedup = 3");
}

{
  const masks = [[0, 1], [1, 2]];
  const graph = DependencyGraph.fromMasks(masks);
  const result = fracture(graph);
  assertEqual(result.nBlocks, 1, "2 coupled constraints → 1 block");
  assertEqual(result.largestBlockSize, 2, "block has 2 constraints");
}

{
  const masks = [[0], [0], [1]];
  const graph = DependencyGraph.fromMasks(masks);
  const result = fracture(graph);
  assertEqual(result.nBlocks, 2, "2 blocks: {c0,c1} and {c2}");
  assertEqual(result.blocks[0].size, 2, "first block has 2 coupled");
  assertEqual(result.blocks[1].size, 1, "second block has 1 independent");
}

{
  const blockMasks = [0b001, 0b100, 0b000];
  const total = coalesce(blockMasks);
  assertEqual(total, 0b101, "coalesce: OR of block masks = 0b101");
}

{
  assertEqual(coalesce([]), 0, "coalesce empty = 0");
}

{
  const a1 = new Uint8Array([1, 0, 1]);
  const a2 = new Uint8Array([0, 1, 0]);
  const merged = coalesceArrays([a1, a2]);
  assertEqual(merged[0], 1, "coalesce arrays: bit 0");
  assertEqual(merged[1], 1, "coalesce arrays: bit 1");
  assertEqual(merged[2], 1, "coalesce arrays: bit 2");
}

{
  const masks = [[0], [0], [1], [1]];
  const graph = DependencyGraph.fromMasks(masks, ["c0", "c1", "c2", "c3"]);
  const fractured = fracture(graph);
  assertEqual(fractured.nBlocks, 2, "two independent pairs → 2 blocks");

  const block0Absolute = 0b0010;
  const block1Absolute = 0b0100;
  const total = coalesce([block0Absolute, block1Absolute]);
  assertEqual(total, 0b0110, "fracture-coalesce: c1 and c2 violated");
}

// ════════════════════════════════════════════════════════════
// 3. Sediment Layers
// ════════════════════════════════════════════════════════════

section("Sediment Layers");

{
  const stack = new SedimentStack();
  const names = ["temp", "pressure"];

  stack.addLayer(
    { reason: "temp sensor calibrated" },
    [{ constraintName: "temp", overridePass: true, reason: "sensor tolerance" }]
  );

  const result = stack.checkWithSediment(
    0b01, Severity.WARNING, names,
    { temp: 151, pressure: 50 },
    { temp: [0, 150], pressure: [0, 100] }
  );

  assertEqual(result.finalErrorMask, 0, "sediment overrides temp violation");
  assertEqual(result.passed, true, "sediment makes check pass");
  assertEqual(result.correctionsApplied, 1, "1 correction applied");
}

{
  const stack = new SedimentStack();
  const names = ["temp", "pressure"];

  stack.addLayer(
    { reason: "known sensor fault" },
    [{ constraintName: "temp", overridePass: false, reason: "always flag temp" }]
  );

  const result = stack.checkWithSediment(
    0b00, Severity.PASS, names,
    { temp: 50, pressure: 50 },
    { temp: [0, 150], pressure: [0, 100] }
  );

  assertEqual(result.finalErrorMask, 0b01, "sediment forces temp violation");
  assertEqual(result.passed, false, "sediment makes check fail");
}

{
  const stack = new SedimentStack();
  const names = ["temp"];

  stack.addLayer(
    { reason: "summer operating range" },
    [{ constraintName: "temp", newHi: 200, reason: "extended range" }]
  );

  const result = stack.checkWithSediment(
    0b01, Severity.CAUTION, names,
    { temp: 151 },
    { temp: [0, 150] }
  );

  assertEqual(result.finalErrorMask, 0, "widened bounds fix violation");
  assertEqual(result.passed, true, "widened bounds make check pass");
}

{
  const stack = new SedimentStack();
  assertEqual(stack.depth, 0, "empty stack has depth 0");
  stack.addLayer({}, []);
  stack.addLayer({}, []);
  assertEqual(stack.depth, 2, "stack has depth 2");
  assertEqual(stack.activeLayers.length, 2, "both layers active");
}

{
  const stack = new SedimentStack();
  const names = ["temp"];

  const layer0 = stack.addLayer(
    { reason: "old calibration" },
    [{ constraintName: "temp", newHi: 160, reason: "old range" }]
  );
  const layer1 = stack.addLayer(
    { reason: "new calibration" },
    [{ constraintName: "temp", newHi: 200, reason: "new range" }]
  );

  stack.supersedeLayer(layer0.layerId, layer1.layerId);
  assertEqual(stack.activeLayers.length, 1, "only 1 active layer after supersedence");
}

{
  const stack = new SedimentStack();
  const names = ["temp"];

  stack.addLayer({}, [{ constraintName: "temp", overridePass: true, reason: "tolerance" }]);
  const resultMask = stack.apply(0b01, names, { temp: 151 }, { temp: [0, 150] });
  assertEqual(resultMask, 0, "apply: sediment fixes violation");
}

// ════════════════════════════════════════════════════════════
// 4. ConstraintEngine Integration
// ════════════════════════════════════════════════════════════

section("ConstraintEngine Integration");

{
  const engine = new ConstraintEngine();
  engine.addConstraint("coolant_temp", -40, 150);
  engine.addConstraint("pressure", 0, 100);
  engine.addConstraint("flow_rate", 0.5, 10);

  const r1 = engine.check({ coolant_temp: 50, pressure: 50, flow_rate: 5 });
  assertEqual(r1.errorMask, 0, "engine: all pass");
  assertEqual(r1.violationCount, 0, "engine: 0 violations");

  const r2 = engine.check({ coolant_temp: 151, pressure: 50, flow_rate: 5 });
  assertEqual(r2.errorMask, 0b001, "engine: coolant_temp violated");
  assertEqual(r2.violatedNames[0], "coolant_temp", "engine: correct name");
  assertEqual(r2.severity, Severity.CAUTION, "engine: 1 violation = CAUTION");

  const r3 = engine.check({ coolant_temp: NaN, pressure: 50, flow_rate: 5 });
  assertEqual(r3.errorMask, 0b001, "engine: NaN violates");
}

{
  const engine = new ConstraintEngine();
  engine.addConstraint("temp_a", 0, 100, [0]);
  engine.addConstraint("temp_b", 0, 100, [0]);
  engine.addConstraint("pressure", 0, 50, [1]);
  engine.use("fracture");
  const fr = engine.fracture();
  assertEqual(fr.nBlocks, 2, "engine fracture: 2 blocks");
}

{
  const engine = new ConstraintEngine();
  engine.addConstraint("temp", 0, 150);
  engine.addConstraint("pressure", 0, 100);
  engine.use("sediment");

  engine.addSedimentLayer(
    { reason: "sensor tolerance" },
    [{ constraintName: "temp", newHi: 200, reason: "extended range" }]
  );

  const result = engine.checkWithSediment({ temp: 160, pressure: 50 });
  assertEqual(result.passed, true, "engine+sediment: widened bounds pass");
}

{
  let threw = false;
  try {
    const engine = new ConstraintEngine();
    engine.addConstraint("bad", 100, 0);
  } catch {
    threw = true;
  }
  assert(threw, "engine rejects lo > hi");
}

// ════════════════════════════════════════════════════════════
console.log(`\n${"═".repeat(60)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log(`${"═".repeat(60)}`);
process.exit(failed > 0 ? 1 : 0);
