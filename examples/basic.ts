/**
 * Basic constraint checking with ConstraintEngine.
 */
import { ConstraintEngine, Severity } from "../src/index.js";

const engine = new ConstraintEngine();
engine.addConstraint("temperature", -40, 150);
engine.addConstraint("pressure", 0, 100);
engine.addConstraint("flow_rate", 0.1, 50);

// All pass
const result1 = engine.check({ temperature: 80, pressure: 45, flow_rate: 12.5 });
console.log("All in bounds:", result1.violationCount === 0 ? "PASS ✓" : "FAIL ✗");

// One violation
const result2 = engine.check({ temperature: 200, pressure: 45, flow_rate: 12.5 });
console.log("Temp violation:", result2.violatedNames); // ["temperature"]
console.log("Severity:", Severity[result2.severity]); // CAUTION

// NaN always violates (zero false negatives)
const result3 = engine.check({ temperature: NaN, pressure: 45, flow_rate: 12.5 });
console.log("NaN violation:", result3.violatedNames); // ["temperature"]
