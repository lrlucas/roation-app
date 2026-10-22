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

// ── Hero talents ─────────────────────────────────────────────────────────────
// talentIDs (entradas del árbol, no spell ids) tal como los devuelve
// characterRankings con includeCombatantInfo. Identificados agrupando el top
// 100 Mythic de 12.1 y confirmados por daño: San'layn → Vampiric Strike /
// Blood Beast; Rider → Rider's Champion.
export const SANLAYN_TALENT_IDS = [
  117630, 117637, 117642, 117643, 117648, 117650, 117652, 117662, 117892,
  123321, 133513, 133516, 135994, 135995, 135996,
];
export const RIDER_TALENT_IDS = [
  96294, 96318, 117638, 117639, 117641, 117644, 117651, 117656, 117660,
  117663, 117664, 123322, 123410, 123412, 135997, 135998, 135999,
];

export type UnholyHeroTree = 'sanlayn' | 'rider' | 'unknown';

export function getUnholyHeroTree(talents?: { talentID: number }[]): UnholyHeroTree {
  if (!talents?.length) return 'unknown';
  const ids = new Set(talents.map(t => t.talentID));
  const san = SANLAYN_TALENT_IDS.filter(id => ids.has(id)).length;
  const rider = RIDER_TALENT_IDS.filter(id => ids.has(id)).length;
  if (san === 0 && rider === 0) return 'unknown';
  return san >= rider ? 'sanlayn' : 'rider';
}
