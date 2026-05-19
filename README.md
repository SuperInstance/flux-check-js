# @flux/check

Flux constraint engine — exact checking, fracture-coalesce, and sediment layers. Zero false negatives.

## Install

```bash
npm install @flux/check
```

## Quick Start

```js
import { ConstraintEngine, Severity } from "@flux/check";

const engine = new ConstraintEngine();
engine.addConstraint("coolant_temp", -40, 150);
engine.addConstraint("pressure", 0, 100);

const result = engine.check({ coolant_temp: 151, pressure: 50 });
// result.errorMask === 0b001  (coolant_temp violated)
// result.severity === Severity.CAUTION
// result.violatedNames === ["coolant_temp"]
```

## API

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
  - `check(values)` → `{ errorMask, violations, severity, violationCount, violatedNames }`
  - `use(strategy)` — Enable "fracture" or "sediment"
  - `fracture()` → `FractureResult`
  - `addSedimentLayer(context, corrections)`
  - `checkWithSediment(values)` → `SedimentResult`

## Invariants

1. **Zero false negatives** — a value outside bounds is ALWAYS detected. No exceptions.
2. **NaN always violates** — no opt-in required.
3. **Bounds checked with `<=`** — boundary values pass.
4. **Fracture-coalesce correctness** — bitwise OR of independent block masks preserves all violations.
5. **No external dependencies** — pure TypeScript, runs anywhere.

## Build & Test

```bash
npm install
npx tsc
node tests/core.test.mjs
```

## Ports

Same algorithm in Python (`flux_constraint_exact`, `flux_fracture`, `flux_sediment`), Rust, and C. This is the JavaScript/TypeScript port.

## License

MIT
