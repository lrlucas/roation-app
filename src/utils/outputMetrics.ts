// Universal "output" metrics shared across specs: raw throughput/activity signals
// (as opposed to rotation-quality metrics). Composed into each spec module.
import type { CombinedEvents } from './unholyDkAnalyzerUtils';
import type { Aggregates, MetricInfo } from '../specs/types';

export const OUTPUT_METRIC_KEYS = ['apm', 'dps_first_90s'];

const OPENER_WINDOW_MS = 90000;

export function computeOutputMetrics(
  events: CombinedEvents,
  fightStartTime: number,
  fightEndTime: number,
): Record<string, number> {
  const fightDurationMs = fightEndTime - fightStartTime;
  if (fightDurationMs <= 0) return { apm: 0, dps_first_90s: 0 };

  // APM — completed casts per minute (begincast excluded to avoid double-counting
  // hardcasts). A pacing signal: too low = missed GCDs, too high may be wasteful.
  const castCount = (events.casts || []).filter(e => e.type === 'cast').length;
  const apm = Number((castCount / (fightDurationMs / 60000)).toFixed(1));

  // dps_first_90s — player-direct DPS over the opening window. NOTE: the events
  // stream is filtered to the player's sourceID, so this excludes pet damage;
  // it's an opener-pacing signal compared like-for-like against the Top 20.
  const windowMs = Math.min(OPENER_WINDOW_MS, fightDurationMs);
  const cutoff = fightStartTime + windowMs;
  let openerDamage = 0;
  (events.meleeHits || []).forEach(e => {
    if (e.timestamp <= cutoff) openerDamage += e.amount || 0;
  });
  const dps_first_90s = Math.round(openerDamage / (windowMs / 1000));

  return { apm, dps_first_90s };
}

export function getOutputMetricsInfo(aggregates: Aggregates): Record<string, MetricInfo> {
  return {
    apm: {
      title: 'APM (acciones por minuto)',
      simc: 'output.apm',
      description: 'Ritmo de pulsaciones (casts completados por minuto). Se compara contra el Top 20 del mismo spec: muy por debajo indica GCDs perdidos.',
      fixTip: 'Mantén el ritmo de lanzamientos sin tiempos muertos ni dudas entre GCDs.',
      simcraftText: 'Referencia: el APM del Top 20 del mismo spec.',
      targetText: `${aggregates.apm?.avg || 0} prom. Top 20`,
      isCount: true,
    },
    dps_first_90s: {
      title: 'DPS de apertura (primeros 90s)',
      simc: 'output.dps_opener',
      description: 'Daño por segundo del jugador en los primeros 90s del combate (daño directo; no incluye mascotas). Mide la calidad de tu opener, comparado contra el Top 20 medido igual.',
      fixTip: 'Encadena bien tu secuencia de apertura y los cooldowns iniciales para front-loadear daño.',
      simcraftText: 'Referencia: el DPS de apertura del Top 20 (ojo: escala con ilvl).',
      targetText: `${(aggregates.dps_first_90s?.avg || 0).toLocaleString()} prom. Top 20`,
      isCount: true,
    },
  };
}
