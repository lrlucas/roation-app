// Spec-module abstraction — the contract each supported spec implements so the
// fetch / analyze / cache pipeline can be driven generically instead of being
// hardcoded to a single spec.
import type { CombinedEvents } from '../utils/unholyDkAnalyzerUtils';

export type SpecMetrics = Record<string, number>;

/** Aggregate stats per metric (computed from the Top 20). */
export interface MetricAggregate {
  avg: number;
  p25: number;
  p75: number;
}
export type Aggregates = Record<string, MetricAggregate>;

/** Per-metric UI definition (titles, copy, direction). */
export interface MetricInfo {
  title: string;
  simc: string;
  description: string;
  fixTip: string;
  simcraftText: string;
  targetText: string;
  isCount?: boolean;
  lowerIsBetter?: boolean;
  /** Display unit. Defaults to 'count' when isCount, else 'percent'. Use 'dps' for
   *  large damage values (formatted with thousands separators + a "DPS" suffix). */
  unit?: 'percent' | 'count' | 'dps';
  /** Treat a value of exactly 0 as "no data" (failed/empty query), not a real score. */
  treatZeroAsNoData?: boolean;
}

export interface SpecModule {
  /** WCL class slug, e.g. "DeathKnight", "Warlock". */
  className: string;
  /** WCL spec name, e.g. "Unholy", "Demonology". */
  specName: string;
  /** Value stored in / queried from the Firestore cache `meta.spec`. */
  cacheSpec: string;

  /** Enemy debuff ids to filter server-side in the events fetch (DoTs on the
   *  boss). Combined with the player sourceID client-side. */
  debuffIds: number[];
  /** Pet-targeted buff ids that need a dedicated ability-filtered query because
   *  they don't appear in the player's general Buffs stream (e.g. Commander). */
  petBuffIds: number[];

  /** Ordered metric keys — used for aggregate computation and UI iteration. */
  metricKeys: string[];

  /** Human label shown in the analyzer header, e.g. "Death Knight Unholy". */
  displayName: string;

  /** Compute this spec's metrics from a player's combined events. */
  analyze(events: CombinedEvents, fightStartTime: number, fightEndTime: number): SpecMetrics;

  /** Per-metric UI definitions. A factory because some copy (e.g. count targets)
   *  depends on the Top-20 aggregates. */
  getMetricsInfo(aggregates: Aggregates): Record<string, MetricInfo>;

  /** Optional: estimated DPS recoverable per metric, used to rank fixes and pick
   *  the "critical" priority. Specs without it simply show no DPS-gain banner. */
  computeDpsGains?(
    userMetrics: SpecMetrics | null | undefined,
    aggregates: Aggregates,
  ): Record<string, number>;
}
