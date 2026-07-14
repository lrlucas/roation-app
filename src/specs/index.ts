// Spec registry — single source of truth for which class/spec combos are
// supported. Add a spec by implementing a SpecModule and registering it here.
import type { SpecModule } from './types';
import { unholyDkModule } from './unholy-dk';
import { demonologyWarlockModule } from './demonology-warlock';

const SPEC_MODULES: SpecModule[] = [
  unholyDkModule,
  demonologyWarlockModule,
  // Future: afflictionWarlockModule, ...
];

/** Resolve the spec module for a class/spec, or null if unsupported. */
export function getSpecModule(
  className: string | null | undefined,
  specName: string | null | undefined,
): SpecModule | null {
  if (!className || !specName) return null;
  return (
    SPEC_MODULES.find((m) => m.className === className && m.specName === specName) ?? null
  );
}

/** Whether a class/spec has analyzer support. */
export function isSupportedSpec(
  className: string | null | undefined,
  specName: string | null | undefined,
): boolean {
  return getSpecModule(className, specName) !== null;
}

export type { SpecModule, SpecMetrics } from './types';
