/**
 * Sediment layers: accumulated corrections over time.
 */
import { ConstraintEngine } from "../src/index.js";

const engine = new ConstraintEngine();
engine.addConstraint("coolant_temp", -40, 150);
engine.addConstraint("oil_pressure", 0.5, 7);
engine.addConstraint("rpm", 0, 8000);
engine.use("sediment");

// Base check — rpm at 8100 violates
const base = engine.check({ coolant_temp: 90, oil_pressure: 3, rpm: 8100 });
console.log("Base violations:", base.violatedNames); // ["rpm"]

// Add a correction layer: widen rpm to 8500 for a specific context
engine.addSedimentLayer(
  { scenario: "track_mode", driver: "sport" },
  [
    {
      constraintName: "rpm",
      newHi: 8500,
      reason: "Track mode allows higher RPM",
    },
  ]
);

// Now check through sediment — rpm 8100 should pass with widened bounds
const result = engine.checkWithSediment({ coolant_temp: 90, oil_pressure: 3, rpm: 8100 });
console.log("After sediment:", result.passed ? "PASS ✓" : "FAIL ✗");
console.log("Layers applied:", result.layersApplied);
console.log("Corrections applied:", result.correctionsApplied);
