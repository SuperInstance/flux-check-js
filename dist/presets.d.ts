/**
 * Industry preset constraint definitions.
 *
 * Each preset provides a named set of constraints for a specific domain.
 * Use with ConstraintEngine or directly with checkExact.
 */
export interface PresetConstraint {
    name: string;
    lo: number;
    hi: number;
    unit?: string;
}
export interface Preset {
    name: string;
    description: string;
    constraints: PresetConstraint[];
}
export declare const presets: Record<string, Preset>;
/** Get a preset by name. Throws if not found. */
export declare function getPreset(name: string): Preset;
/** List all available preset names. */
export declare function listPresets(): string[];
