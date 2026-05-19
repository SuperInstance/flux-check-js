#!/usr/bin/env node
/**
 * @flux/check CLI — Check constraints, list presets, run benchmarks.
 *
 * Usage:
 *   flux-check check --preset automotive --values 3000,50,12.5
 *   flux-check presets
 *   flux-check bench --preset automotive --iterations 100000
 */
import { ConstraintEngine } from "./index.js";
import { getPreset, listPresets } from "./presets.js";
// ── Arg parser ──────────────────────────────────────────────
function parseArgs(argv) {
    const args = argv.slice(2);
    if (args.length === 0) {
        printUsage();
        process.exit(0);
    }
    const command = args[0];
    const opts = {};
    for (let i = 1; i < args.length; i++) {
        if (args[i].startsWith("--")) {
            const key = args[i].slice(2);
            const val = args[i + 1] && !args[i + 1].startsWith("--") ? args[++i] : "true";
            opts[key] = val;
        }
    }
    return { command, opts };
}
function printUsage() {
    console.log(`@flux/check — Flux constraint engine CLI

Usage:
  flux-check check --preset <name> --values <v1,v2,...>   Check values against a preset
  flux-check presets                                        List available presets
  flux-check bench --preset <name> [--iterations N]        Run a benchmark

Options:
  --preset <name>        Preset name (automotive, aviation, medical, financial, energy, iot)
  --values <v1,v2,...>   Comma-separated values to check
  --iterations <N>       Number of benchmark iterations (default: 100000)
  --help                 Show this help
`);
}
// ── Commands ────────────────────────────────────────────────
function cmdCheck(opts) {
    const presetName = opts.preset;
    if (!presetName) {
        console.error("Error: --preset is required. Use 'flux-check presets' to list available presets.");
        process.exit(1);
    }
    const preset = getPreset(presetName);
    const valuesStr = opts.values;
    if (!valuesStr) {
        console.error("Error: --values is required. Example: --values 3000,50,12.5");
        process.exit(1);
    }
    const values = valuesStr.split(",").map(Number);
    // Build engine from preset
    const engine = new ConstraintEngine();
    for (const c of preset.constraints) {
        engine.addConstraint(c.name, c.lo, c.hi);
    }
    // If fewer values than constraints, pad with midpoints (pass by default)
    // If more values than constraints, truncate
    const paddedValues = {};
    for (let i = 0; i < preset.constraints.length; i++) {
        const c = preset.constraints[i];
        paddedValues[c.name] = i < values.length && !Number.isNaN(values[i])
            ? values[i]
            : (c.lo + c.hi) / 2;
    }
    const result = engine.check(paddedValues);
    console.log(`\nPreset: ${preset.name} (${preset.description})`);
    console.log(`Constraints: ${preset.constraints.length}`);
    console.log(`Values provided: ${values.length}\n`);
    // Per-constraint detail
    for (let i = 0; i < preset.constraints.length; i++) {
        const c = preset.constraints[i];
        const v = paddedValues[c.name];
        const violated = result.violations[i];
        const status = violated ? "✗ FAIL" : "✓ PASS";
        const unit = c.unit ? ` ${c.unit}` : "";
        console.log(`  ${status}  ${c.name}: ${v} (bounds: [${c.lo}, ${c.hi}]${unit})`);
    }
    const severityNames = ["PASS", "CAUTION", "WARNING", "CRITICAL"];
    console.log(`\nResult: ${result.violationCount === 0 ? "✓ ALL PASS" : "✗ VIOLATIONS"}`);
    console.log(`Error mask: 0b${result.errorMask.toString(2).padStart(preset.constraints.length, "0")} (${result.errorMask})`);
    console.log(`Severity: ${severityNames[result.severity]}`);
    if (result.violatedNames.length > 0) {
        console.log(`Violated: ${result.violatedNames.join(", ")}`);
    }
    console.log();
}
function cmdPresets() {
    console.log("\nAvailable presets:\n");
    for (const name of listPresets()) {
        const preset = getPreset(name);
        console.log(`  ${name.padEnd(12)} — ${preset.description} (${preset.constraints.length} constraints)`);
        for (const c of preset.constraints) {
            const unit = c.unit ? ` ${c.unit}` : "";
            console.log(`                ${c.name}: [${c.lo}, ${c.hi}]${unit}`);
        }
        console.log();
    }
}
function cmdBench(opts) {
    const presetName = opts.preset;
    if (!presetName) {
        console.error("Error: --preset is required.");
        process.exit(1);
    }
    const preset = getPreset(presetName);
    const iterations = parseInt(opts.iterations ?? "100000", 10);
    const engine = new ConstraintEngine();
    for (const c of preset.constraints) {
        engine.addConstraint(c.name, c.lo, c.hi);
    }
    // Generate random values within 1.5x bounds (some will violate)
    const midpoints = preset.constraints.map(c => (c.lo + c.hi) / 2);
    const ranges = preset.constraints.map(c => (c.hi - c.lo) * 0.75);
    // Warmup
    for (let i = 0; i < 1000; i++) {
        const vals = {};
        for (let j = 0; j < preset.constraints.length; j++) {
            vals[preset.constraints[j].name] = midpoints[j] + (Math.random() - 0.5) * 2 * ranges[j] * 1.5;
        }
        engine.check(vals);
    }
    // Benchmark
    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
        const vals = {};
        for (let j = 0; j < preset.constraints.length; j++) {
            vals[preset.constraints[j].name] = midpoints[j] + (Math.random() - 0.5) * 2 * ranges[j] * 1.5;
        }
        engine.check(vals);
    }
    const elapsed = performance.now() - start;
    const perIterUs = (elapsed * 1000) / iterations;
    const throughput = Math.round(iterations / (elapsed / 1000));
    console.log(`\nBenchmark: ${preset.name} (${preset.constraints.length} constraints)`);
    console.log(`Iterations: ${iterations.toLocaleString()}`);
    console.log(`Time: ${elapsed.toFixed(1)} ms`);
    console.log(`Per iteration: ${perIterUs.toFixed(2)} µs`);
    console.log(`Throughput: ${throughput.toLocaleString()} checks/sec\n`);
}
// ── Main ────────────────────────────────────────────────────
function main() {
    const { command, opts } = parseArgs(process.argv);
    if (opts.help || command === "help") {
        printUsage();
        return;
    }
    switch (command) {
        case "check":
            cmdCheck(opts);
            break;
        case "presets":
            cmdPresets();
            break;
        case "bench":
            cmdBench(opts);
            break;
        default:
            console.error(`Unknown command: '${command}'. Use --help for usage.`);
            process.exit(1);
    }
}
main();
