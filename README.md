# @flux/check

Flux constraint engine — exact checking, fracture-coalesce, and sediment layers. Zero false negatives.

## How It Works

A constraint system checks whether values fall within acceptable bounds. This library does three things:

**1. Exact checking.** Given N values and N `(lo, hi)` bounds, check each value against its bound. Produce a violation array and an error bitmask. NaN always violates. Boundary values pass (`<=`). No approximations.

When constraints are **independent** (they share no underlying physical dimension), fracture splits them into parallel blocks. Set the `dims` parameter on `addConstraint()` to declare which dimensions each constraint depends on. Constraints sharing a dimension are grouped into the same block. If `dims` is omitted, every constraint is treated as independent (each gets its own dimension), which means fracture produces N blocks of size 1 — not useful. For practical value, assign shared dimensions to coupled constraints:

```js
// Temperature sensors in the same thermal chamber share dim 0
engine.addConstraint("temp_a", 0, 100, [0]);
engine.addConstraint("temp_b", 0, 100, [0]);
// Pressure sensor is independent — dim 1
engine.addConstraint("pressure", 0, 50, [1]);
// Fracture produces 2 blocks: {temp_a, temp_b} and {pressure}
```

**3. Sediment layers.** Real systems accumulate corrections over time: "we widened the coolant temp range after the sensor upgrade" or "override this fail because we're in test mode." Sediment stacks immutable correction layers. Each layer can widen bounds, force pass/fail, or adjust severity. The stack is append-only — you never lose history.

```js
import { ConstraintEngine, Severity } from "@flux/check";

// Set up 8 constraints (automotive preset)
const engine = new ConstraintEngine();
engine.addConstraint("coolant_temp", -40, 150);
engine.addConstraint("oil_pressure", 0.5, 7);
engine.addConstraint("rpm", 0, 8000);
// ... 5 more

// Check 8 values against 8 bounds
const result = engine.check({
  coolant_temp: 3000,  // violates [-40, 150]
  oil_pressure: 50,    // violates [0.5, 7]
  rpm: 12.5,           // passes [0, 8000]
  // ...
});

// result.errorMask — bitmask of which constraints failed
// result.violatedNames — ["coolant_temp", "oil_pressure"]
// result.severity — Severity.CAUTION (2 violations, non-critical)
```

## What TypeScript Teaches Us

Porting a constraint system to JavaScript reveals things about the architecture that static languages hide:

- **Dynamic types still have exact bounds.** JavaScript has one number type (float64), but constraint bounds are still exact. `NaN` is a valid float64 value — and this library handles it by always flagging it as a violation. No `Option<f64>`, no `Result`. The dynamic type system doesn't make bounds checking harder; it just means you handle `NaN` explicitly rather than via the type system.
- **`Float64Array` for performance.** The core `checkExact` function works on typed arrays, not plain objects. This isn't accidental — it avoids boxing overhead and keeps the hot path in predictable memory. For checking thousands of sensor readings per second, the difference between `number[]` and `Float64Array` is measurable.
- **ESM modules for tree-shaking.** The library ships as ES modules. If you only use `checkExact` and `errorMask`, your bundler strips fracture, sediment, and presets. The constraint system is modular by architecture; ESM makes that modularity physical in the bundle.
- **Severity as a concept, not a type.** In Rust, severity would be an enum with exhaustiveness checking. In TypeScript, it's still an enum, but the runtime representation is just a number. The lesson: severity scoring is a domain concept that transcends the type system. Whether you're in Rust or JS, the logic is "count violations → map to severity level."

## Install

```bash
npm install @flux/check
```

## CLI

```bash
# Check values against an industry preset
flux-check check --preset automotive --values 3000,50,12.5

# List available presets
flux-check presets

# Run a benchmark
flux-check bench --preset automotive --iterations 100000
```

### CLI Output Example

```
Preset: automotive (Automotive engine and drivetrain constraints)
Constraints: 8
Values provided: 3

  ✗ FAIL  coolant_temp: 3000 (bounds: [-40, 150] °C)
  ✗ FAIL  oil_pressure: 50 (bounds: [0.5, 7] bar)
  ✓ PASS  rpm: 12.5 (bounds: [0, 8000] rpm)
  ...

Result: ✗ VIOLATIONS
Error mask: 0b00000011 (3)
Severity: CAUTION
Violated: coolant_temp, oil_pressure
```

## Industry Presets

Six Ten built-in presets for common domains:

| Preset | Domain | Constraints |
|--------|--------|:-----------:|
| `automotive` | Engine & drivetrain | 8 |
| `aviation` | Flight systems | 8 |
| `medical` | Vital signs & devices | 7 |
| `financial` | Trading & risk | 6 |
| `energy` | Grid & power systems | 6 |
| `iot` | Sensors & environment | 8 |
| `maritime` | Navigation & vessel systems | 8 |
| `nuclear` | Reactor & radiation safety | 8 |
| `railway` | Signaling & train systems | 6 |
| `robotics` | Robotic arm & autonomous systems | 8 |

```js
import { getPreset, ConstraintEngine } from "@flux/check";

const preset = getPreset("automotive");
const engine = new ConstraintEngine();
for (const c of preset.constraints) {
  engine.addConstraint(c.name, c.lo, c.hi);
}
```

## API Reference

### Core (`src/core.ts`)

- **`checkExact(values, bounds)`** → `Uint8Array` — Batch exact checking. NaN always violates. Bounds checked with `<=`.
- **`checkOne(value, lo, hi)`** → `0 | 1` — Single value check.
- **`errorMask(violations)`** → `number` — Bitmask from violation array.
- **`severityFromMask(mask)`** → `Severity` — PASS / CAUTION / WARNING / CRITICAL.

### Fracture-Coalesce (`src/fracture.ts`)

- **`DependencyGraph.fromMasks(masks)`** — Build bipartite constraint-dimension graph.
- **`fracture(graph)`** → `FractureResult` — BFS connected components → independent blocks.
- **`coalesce(blockMasks)`** → `number` — Bitwise OR coalescence (provably preserves zero false negatives).

### Sediment (`src/sediment.ts`)

- **`SedimentStack`** — Immutable correction layers that accumulate over time.
- **`addLayer(context, corrections)`** — Add correction (widen bounds, override pass/fail).
- **`checkWithSediment(baseMask, severity, names, values, defs)`** — Post-process through layers.
- **`apply(errorMask, names, values, defs)`** — Simplified mask post-processing.

### Engine (`src/engine.ts`)

- **`ConstraintEngine`** — Unified interface combining all three.
  - `addConstraint(name, lo, hi, dims?)`
    - **`dims`** (optional): Array of dimension indices for fracture analysis. Constraints sharing a dimension are grouped into the same fracture block. If omitted, each constraint gets its own unique dimension (all independent). Set `dims` when constraints are physically coupled — e.g., temperature sensors in the same chamber share dimension 0, while a pressure sensor in a different chamber uses dimension 1.
  - `check(values)` → `{ errorMask, violations, severity, violationCount, violatedNames }`
  - `checkVector(values)` → `CheckResult` — Check N named values against N respective constraints by name. Takes a `Record<string, number>` mapping constraint names to values. Equivalent to `check()` with a record, but explicit about the vector semantics.
  - `use(strategy)` — Enable "fracture" or "sediment"
  - `fracture()` → `FractureResult`
  - `addSedimentLayer(context, corrections)`
  - `checkWithSediment(values)` → `SedimentResult` — Accepts `Record<string, number>`, `number[]`, or `Float64Array`.

### Presets (`src/presets.ts`)

- **`getPreset(name)`** — Get a preset by name (throws if not found).
- **`listPresets()`** — List all available preset names.
- **`presets`** — Full preset record.

## Invariants

1. **Zero false negatives** — a value outside bounds is ALWAYS detected. No exceptions.
2. **NaN always violates** — no opt-in required.
3. **Bounds checked with `<=`** — boundary values pass.
4. **Fracture-coalesce correctness** — bitwise OR of independent block masks preserves all violations.
5. **No external dependencies** — pure TypeScript, runs anywhere.

## Build & Test

```bash
npm install
npx tsc            # compile
node tests/core.test.mjs   # 59 tests
```

## Examples

See `examples/` for complete usage:

- `examples/basic.ts` — Simple constraint checking
- `examples/fracture.ts` — Fracture-coalesce decomposition
- `examples/sediment.ts` — Sediment layer corrections
- `examples/engine.ts` — Full engine with presets

## Performance

Built for high-throughput checking. Typed arrays in the hot path, no object allocation during `check()`.

```bash
flux-check bench --preset automotive --iterations 100000
```

## Where to Go Next

| Repo | Language | What You'll Learn |
|------|----------|-------------------|
| [flux-fracture](https://github.com/SuperInstance/flux-fracture) | Rust | Same fracture algorithm with ownership model and zero-cost generics |
| [flux-fracture-c](https://github.com/SuperInstance/flux-fracture-c) | C | Single-header fracture, manual memory management, embedded-friendly |
| [flux-engine-c](https://github.com/SuperInstance/flux-engine-c) | C | Combined engine: check + fracture + sediment in one header |
| [plato-types](https://github.com/SuperInstance/plato-types) | Python | Tile lifecycle and Lamport clocks for fleet coordination |
| [tensor-spline](https://github.com/SuperInstance/tensor-spline) | Python | SplineLinear compression for micro models |

## License

MIT
