// Unholy Death Knight spec module — wraps the existing analyzer + ids so the
// generic pipeline can drive it. No behavior change vs. the previous hardcoded path.
import {
  analyzeUnholyDkMetrics,
  SPELL_IDS,
  COMMANDER_OF_THE_DEAD_BUFF,
} from '../utils/unholyDkAnalyzerUtils';
import type { SpecModule } from './types';
import { getUnholyMetricsInfo, computeUnholyDpsGains } from './unholy-dk-metrics';
import { OUTPUT_METRIC_KEYS, computeOutputMetrics, getOutputMetricsInfo } from '../utils/outputMetrics';

export const UNHOLY_DK_METRIC_KEYS = [
  'ability_uptime',
  'melee_uptime',
  'virulent_uptime',
  'dread_uptime',
  'plague_efficiency',
  'putrefy_pct_dt',
  'sudden_doom_waste',
  'army_cast_count',
  'dt_cast_count',
  'dt_army_aligned',
  'rp_overcap_pct',
  'commander_buffed_pct',
  'correct_spender_pct',
  'soul_reaper_window_pct',
  'scourge_strike_with_stacks',
  'festering_scythe_uptime',
  'cooldown_efficiency',
  'lesser_ghoul_efficiency',
];

export const unholyDkModule: SpecModule = {
  className: 'DeathKnight',
  specName: 'Unholy',
  cacheSpec: 'Unholy',
  debuffIds: [SPELL_IDS.virulent_plague, SPELL_IDS.dread_plague],
  petBuffIds: [COMMANDER_OF_THE_DEAD_BUFF],
  metricKeys: [...UNHOLY_DK_METRIC_KEYS, ...OUTPUT_METRIC_KEYS],
  displayName: 'Death Knight Unholy',
  analyze: (events, start, end) => ({
    ...analyzeUnholyDkMetrics(events, start, end),
    ...computeOutputMetrics(events, start, end),
  }),
  getMetricsInfo: (aggregates) => ({
    ...getUnholyMetricsInfo(aggregates),
    ...getOutputMetricsInfo(aggregates),
  }),
  computeDpsGains: computeUnholyDpsGains,
};
