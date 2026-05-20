/**
 * Tests for @flux/check — runnable with `node tests/core.test.mjs` after `tsc`
 */

import {
  checkExact, checkOne, errorMask, severityFromMask, Severity,
  fracture, coalesce, coalesceArrays, DependencyGraph,
  SedimentStack,
  ConstraintEngine,
  DriftDetector,
  getPreset, listPresets,
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
// 5. checkVector
// ════════════════════════════════════════════════════════════

section("checkVector");

{
  const engine = new ConstraintEngine();
  engine.addConstraint("temp", 0, 100);
  engine.addConstraint("pressure", 0, 50);
  engine.addConstraint("flow", 0.5, 10);

  const r1 = engine.checkVector({ temp: 50, pressure: 25, flow: 5 });
  assertEqual(r1.errorMask, 0, "checkVector: all pass");
  assertEqual(r1.violationCount, 0, "checkVector: 0 violations");
}

{
  const engine = new ConstraintEngine();
  engine.addConstraint("temp", 0, 100);
  engine.addConstraint("pressure", 0, 50);
  engine.addConstraint("flow", 0.5, 10);

  const r = engine.checkVector({ temp: 200, pressure: 25, flow: 5 });
  assertEqual(r.errorMask, 0b001, "checkVector: only temp violated");
  assertEqual(r.violatedNames[0], "temp", "checkVector: correct name");
  assertEqual(r.severity, Severity.CAUTION, "checkVector: 1 violation = CAUTION");
}

{
  const engine = new ConstraintEngine();
  engine.addConstraint("a", 0, 10);
  engine.addConstraint("b", 0, 10);
  engine.addConstraint("c", 0, 10);

  const r = engine.checkVector({ a: 20, b: 20, c: 5 });
  assertEqual(r.errorMask, 0b011, "checkVector: a and b violated");
  assertEqual(r.violationCount, 2, "checkVector: 2 violations");
}

{
  const engine = new ConstraintEngine();
  engine.addConstraint("x", 0, 100);
  engine.addConstraint("y", 0, 100);

  // Missing 'y' → NaN → violation
  const r = engine.checkVector({ x: 50 });
  assertEqual(r.errorMask, 0b010, "checkVector: missing key → NaN → violation");
  assertEqual(r.violatedNames[0], "y", "checkVector: correct missing name");
}

{
  const engine = new ConstraintEngine();
  engine.addConstraint("temp", 0, 100);
  engine.addConstraint("pressure", 0, 50);

  // checkVector and check(Record) should produce same result
  const vals = { temp: 50, pressure: 75 };
  const rv = engine.checkVector(vals);
  const rc = engine.check(vals);
  assertEqual(rv.errorMask, rc.errorMask, "checkVector matches check(Record)");
  assertEqual(rv.violationCount, rc.violationCount, "checkVector violationCount matches");
}

{
  // Sediment with number[] input (fix: accept arrays)
  const engine = new ConstraintEngine();
  engine.addConstraint("temp", 0, 150);
  engine.addConstraint("pressure", 0, 100);
  engine.use("sediment");
  engine.addSedimentLayer(
    { reason: "tolerance" },
    [{ constraintName: "temp", newHi: 200, reason: "extended" }]
  );

  const result = engine.checkWithSediment([160, 50]);
  assertEqual(result.passed, true, "sediment accepts number[] and passes");
}

// ════════════════════════════════════════════════════════════
// 6. New Presets
// ════════════════════════════════════════════════════════════

section("New Presets");

{
  const names = listPresets();
  assert(names.includes("maritime"), "maritime preset exists");
  assert(names.includes("nuclear"), "nuclear preset exists");
  assert(names.includes("railway"), "railway preset exists");
  assert(names.includes("robotics"), "robotics preset exists");
  assertEqual(names.length, 10, "10 total presets");
}

{
  const maritime = getPreset("maritime");
  assertEqual(maritime.constraints.length, 8, "maritime has 8 constraints");
  assertEqual(maritime.constraints[0].name, "heading", "maritime first constraint is heading");

  const nuclear = getPreset("nuclear");
  assertEqual(nuclear.constraints.length, 8, "nuclear has 8 constraints");

  const railway = getPreset("railway");
  assertEqual(railway.constraints.length, 6, "railway has 6 constraints");

  const robotics = getPreset("robotics");
  assertEqual(robotics.constraints.length, 8, "robotics has 8 constraints");
}

// ════════════════════════════════════════════════════════════
// 7. Serialization (toJSON / fromJSON)
// ════════════════════════════════════════════════════════════

section("Serialization (toJSON / fromJSON)");

{
  const engine = new ConstraintEngine();
  engine.addConstraint("temp", 0, 100);
  engine.addConstraint("pressure", 0, 50);
  engine.addConstraint("flow", 0.5, 10);

  const json = engine.toJSON();
  const data = JSON.parse(JSON.stringify(json));
  assertEqual(data.version, 1, "toJSON: version is 1");
  assertEqual(data.constraints.length, 3, "toJSON: 3 constraints");
  assertEqual(data.constraints[0].name, "temp", "toJSON: first constraint name");
  assertEqual(data.constraints[1].lo, 0, "toJSON: second constraint lo");
  assertEqual(data.constraints[2].hi, 10, "toJSON: third constraint hi");
  assert(data.strategies.includes("exact"), "toJSON: strategies include exact");
}

{
  const engine = new ConstraintEngine();
  engine.addConstraint("temp", 0, 100);
  engine.addConstraint("pressure", 0, 50);

  const json = engine.toJSON();
  const restored = ConstraintEngine.fromJSON(json);

  // Same checks should produce same results
  const vals = { temp: 50, pressure: 25 };
  const r1 = engine.check(vals);
  const r2 = restored.check(vals);
  assertEqual(r1.errorMask, r2.errorMask, "fromJSON: same errorMask");
  assertEqual(r1.violationCount, r2.violationCount, "fromJSON: same violationCount");
  assertEqual(restored.constraintCount, 2, "fromJSON: correct constraint count");
}

{
  // Round-trip through JSON string
  const engine = new ConstraintEngine();
  engine.addConstraint("a", -10, 10);
  engine.addConstraint("b", 0, 100, [0, 1]);
  engine.use("fracture");

  const str = JSON.stringify(engine.toJSON());
  const restored = ConstraintEngine.fromJSON(JSON.parse(str));
  assertEqual(restored.constraintCount, 2, "round-trip: 2 constraints");

  const r = restored.check({ a: 50, b: 50 });
  assertEqual(r.violatedNames[0], "a", "round-trip: a violated (50 > 10)");
}

{
  // Serialization with sediment
  const engine = new ConstraintEngine();
  engine.addConstraint("temp", 0, 150);
  engine.addConstraint("pressure", 0, 100);
  engine.use("sediment");
  engine.addSedimentLayer(
    { reason: "sensor tolerance" },
    [{ constraintName: "temp", newHi: 200, reason: "extended" }]
  );

  const json = engine.toJSON();
  assert(json.sedimentLayers != null, "toJSON: sediment layers present");
  assertEqual(json.sedimentLayers.length, 1, "toJSON: 1 sediment layer");

  const restored = ConstraintEngine.fromJSON(json);
  const result = restored.checkWithSediment({ temp: 160, pressure: 50 });
  assertEqual(result.passed, true, "fromJSON: sediment still works");
}

{
  // save / load round-trip
  const engine = new ConstraintEngine();
  engine.addConstraint("x", 0, 10);
  engine.addConstraint("y", 0, 10);
  const path = "/tmp/flux-test-engine.json";
  engine.save(path);
  const loaded = ConstraintEngine.load(path);
  assertEqual(loaded.constraintCount, 2, "save/load: 2 constraints");
  const r = loaded.check({ x: 5, y: 5 });
  assertEqual(r.errorMask, 0, "save/load: all pass");
}

// ════════════════════════════════════════════════════════════
// 8. Aggregation (checkAndAggregate)
// ════════════════════════════════════════════════════════════

section("Aggregation (checkAndAggregate)");

{
  const engine = new ConstraintEngine();
  engine.addConstraint("temp", 0, 100);
  engine.addConstraint("pressure", 0, 50);

  const batch = [
    { temp: 50, pressure: 25 },
    { temp: 50, pressure: 25 },
    { temp: 150, pressure: 25 },  // temp violates
    { temp: 50, pressure: 60 },   // pressure violates
  ];

  const agg = engine.checkAndAggregate(batch);
  assertEqual(agg.totalReadings, 4, "aggregate: 4 readings");
  assertEqual(agg.totalViolations, 2, "aggregate: 2 total violations");
  assertEqual(agg.violationRate, 2 / 8, "aggregate: violation rate = 2/8");
  assertEqual(agg.perConstraintViolationRate.temp, 1 / 4, "aggregate: temp violated 1/4");
  assertEqual(agg.perConstraintViolationRate.pressure, 1 / 4, "aggregate: pressure violated 1/4");
  assertEqual(agg.worstReading.index, 2, "aggregate: worst reading at index 2 (first violation)");
  assertEqual(agg.severityBreakdown.PASS, 2, "aggregate: 2 passing readings");
  assertEqual(agg.severityBreakdown.CAUTION, 2, "aggregate: 2 caution readings");
}

{
  const engine = new ConstraintEngine();
  engine.addConstraint("x", 0, 10);

  const agg = engine.checkAndAggregate([]);
  assertEqual(agg.totalReadings, 0, "aggregate: empty batch");
  assertEqual(agg.totalViolations, 0, "aggregate: 0 violations on empty");
  assertEqual(agg.violationRate, 0, "aggregate: 0 rate on empty");
}

{
  const engine = new ConstraintEngine();
  engine.addConstraint("a", 0, 10);
  engine.addConstraint("b", 0, 10);
  engine.addConstraint("c", 0, 10);

  const batch = [
    { a: 5, b: 5, c: 5 },    // pass
    { a: 20, b: 20, c: 5 },  // 2 violations
    { a: 20, b: 20, c: 20 }, // 3 violations — worst
  ];

  const agg = engine.checkAndAggregate(batch);
  assertEqual(agg.worstReading.index, 2, "aggregate: worst is last reading (3 violations)");
  assertEqual(agg.worstReading.result.violationCount, 3, "aggregate: worst has 3 violations");
  assertEqual(agg.severityBreakdown.WARNING, 1, "aggregate: 1 warning (3 violations)");
}

// ════════════════════════════════════════════════════════════
// 9. Drift Detection
// ════════════════════════════════════════════════════════════

section("Drift Detection");

{
  const detector = new DriftDetector({ windowSize: 5, driftThreshold: 0.5 });
  detector.setBounds("temp", 0, 100);

  // Stable readings
  for (let i = 0; i < 5; i++) {
    detector.add({ temp: 50 });
  }
  const info = detector.detectDrift();
  assertEqual(info.drifting, false, "drift: stable readings not drifting");
  assertEqual(info.perSensor.temp.direction, "stable", "drift: direction is stable");
}

{
  const detector = new DriftDetector({ windowSize: 5, driftThreshold: 0.5 });
  detector.setBounds("temp", 0, 100);

  // Upward drift
  for (let i = 0; i < 5; i++) {
    detector.add({ temp: 50 + i * 2 });  // 50, 52, 54, 56, 58
  }
  const info = detector.detectDrift();
  assertEqual(info.drifting, true, "drift: upward trend detected");
  assertEqual(info.perSensor.temp.direction, "up", "drift: direction is up");
  assert(info.perSensor.temp.rate > 0, "drift: positive rate");
}

{
  const detector = new DriftDetector({ windowSize: 5, driftThreshold: 0.5 });
  detector.setBounds("temp", 0, 100);

  // Downward drift
  for (let i = 0; i < 5; i++) {
    detector.add({ temp: 50 - i * 2 });  // 50, 48, 46, 44, 42
  }
  const info = detector.detectDrift();
  assertEqual(info.drifting, true, "drift: downward trend detected");
  assertEqual(info.perSensor.temp.direction, "down", "drift: direction is down");
  assert(info.perSensor.temp.rate < 0, "drift: negative rate");
}

{
  const detector = new DriftDetector({ windowSize: 5, driftThreshold: 0.5 });
  detector.setBounds("temp", 0, 100);

  // Upward drift from 80 — should estimate time to hit 100
  for (let i = 0; i < 5; i++) {
    detector.add({ temp: 80 + i * 2 });  // 80, 82, 84, 86, 88
  }
  const info = detector.detectDrift();
  assert(info.timeToViolation.temp != null, "drift: timeToViolation computed");
  assert(info.timeToViolation.temp > 0, "drift: positive time to violation");
}

{
  const detector = new DriftDetector({ windowSize: 10, driftThreshold: 0.5 });
  detector.setBounds("temp", 0, 100);
  detector.setBounds("pressure", 0, 50);

  // Multi-sensor: temp drifting, pressure stable
  for (let i = 0; i < 5; i++) {
    detector.add({ temp: 80 + i * 3, pressure: 25 });
  }
  const info = detector.detectDrift();
  assertEqual(info.drifting, true, "drift: multi-sensor detects drift");
  assertEqual(info.perSensor.temp.direction, "up", "drift: temp drifting up");
  assertEqual(info.perSensor.pressure.direction, "stable", "drift: pressure stable");
}

{
  const detector = new DriftDetector({ windowSize: 5, driftThreshold: 0.5 });

  for (let i = 0; i < 5; i++) {
    detector.add({ sensor: 50 + i });
  }
  const forecasts = detector.forecast(3);
  assertEqual(forecasts.length, 3, "forecast: 3 steps ahead");
  assert(forecasts[0].sensor > 50, "forecast: first step above last");
  assert(forecasts[1].sensor > forecasts[0].sensor, "forecast: second step higher");
}

{
  const detector = new DriftDetector({ windowSize: 5 });
  assertEqual(detector.ticks, 0, "drift: initial ticks = 0");
  detector.add({ a: 1 });
  assertEqual(detector.ticks, 1, "drift: ticks = 1 after add");
  detector.reset();
  assertEqual(detector.ticks, 0, "drift: ticks = 0 after reset");
}

{
  // Drift with fewer than 3 readings → unknown
  const detector = new DriftDetector({ windowSize: 5, driftThreshold: 0.5 });
  detector.add({ temp: 50 });
  detector.add({ temp: 51 });
  const info = detector.detectDrift();
  assertEqual(info.perSensor.temp.direction, "unknown", "drift: unknown with < 3 readings");
}

// ════════════════════════════════════════════════════════════
console.log(`\n${"═".repeat(60)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log(`${"═".repeat(60)}`);
process.exit(failed > 0 ? 1 : 0);
