/**
 * Full engine usage with presets.
 */
import { ConstraintEngine, Severity, getPreset } from "../src/index.js";

// Load the automotive preset
const preset = getPreset("automotive");
console.log(`Preset: ${preset.name} — ${preset.description}`);
console.log(`Constraints: ${preset.constraints.length}\n`);

// Build engine from preset
const engine = new ConstraintEngine();
for (const c of preset.constraints) {
  engine.addConstraint(c.name, c.lo, c.hi);
}

// Check a realistic engine reading
const values = {
  coolant_temp: 92,
  oil_pressure: 3.5,
  rpm: 3200,
  battery_voltage: 14.2,
  throttle_pos: 45,
  boost_pressure: 1.1,
  exhaust_temp: 620,
  fuel_pressure: 3.8,
};

const result = engine.check(values);

console.log("Engine reading:");
for (const c of preset.constraints) {
  const v = values[c.name as keyof typeof values];
  const unit = c.unit ? ` ${c.unit}` : "";
  const passed = !result.violatedNames.includes(c.name);
  console.log(`  ${passed ? "✓" : "✗"} ${c.name}: ${v}${unit} [${c.lo}, ${c.hi}]`);
}

console.log(`\nOverall: ${result.violationCount === 0 ? "ALL PASS ✓" : "VIOLATIONS FOUND ✗"}`);
console.log(`Severity: ${Severity[result.severity]}`);

// Enable fracture for parallelizable blocks
engine.use("fracture");
for (let i = 0; i < preset.constraints.length; i++) {
  // Each constraint touches its own dimension (fully independent)
  // In a real system, shared dimensions would create coupling
}
const fractureResult = engine.fracture();
console.log(`\nFracture: ${fractureResult.nBlocks} independent blocks`);
console.log(`Speedup potential: ${fractureResult.speedupPotential.toFixed(1)}x`);
