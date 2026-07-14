// Demonology Warlock spec module: analyzer + metric UI definitions.
import { analyzeDemoMetrics } from '../utils/demoWarlockAnalyzerUtils';
import { OUTPUT_METRIC_KEYS, computeOutputMetrics, getOutputMetricsInfo } from '../utils/outputMetrics';
import type { Aggregates, MetricInfo, SpecModule } from './types';

export const DEMO_METRIC_KEYS = [
  'ability_uptime',
  'soul_shard_overcap',
  'demonic_core_waste',
  'cooldown_efficiency',
  'tyrant_cast_count',
  'dreadstalkers_cast_count',
  'tyrant_hog_casts',
  'tyrant_demons_active',
  'hand_of_guldan_cast_count',
];

function getDemoMetricsInfo(aggregates: Aggregates): Record<string, MetricInfo> {
  return {
    ability_uptime: {
      title: 'Ability Uptime (casteo activo)',
      simc: 'uptime.cast_active',
      description: 'Cobertura de casteo activo. Los huecos sin castear superiores a ~3s (tiempo de casteo + GCD) cuentan como tiempo muerto.',
      fixTip: 'Mantén el casteo continuo; usa Demonbolt (instantáneo) para cubrir movimiento.',
      simcraftText: 'Objetivo: casteo prácticamente ininterrumpido.',
      targetText: '≈ 99% (Top 20)',
      isCount: false,
    },
    soul_shard_overcap: {
      title: 'Soul Shards desperdiciados (overcap)',
      simc: 'resource.soul_shard.overcap',
      description: '% de Soul Shards generados que se pierden por estar al máximo (5). Cada fragmento perdido es generación malgastada.',
      fixTip: 'No acumules shards; gasta Hand of Gul’dan antes de overcapear, sobre todo cerca de Tyrant.',
      simcraftText: 'Guía: no overcapear Soul Shards.',
      targetText: '<5% prom. Top 20',
      isCount: false,
      lowerIsBetter: true,
    },
    demonic_core_waste: {
      title: 'Demonic Core desperdiciado',
      simc: 'proc.demonic_core.waste',
      description: '% de procs de Demonic Core sobrescritos al máximo (4) o expirados sin consumir con Demonbolt.',
      fixTip: 'Consume los Demonic Core con Demonbolt; no superes ~2 cargas salvo antes de Tyrant.',
      simcraftText: 'Guía: Demonic Core stackea a 4; no desperdiciar procs.',
      targetText: '<10% prom. Top 20',
      isCount: false,
      lowerIsBetter: true,
    },
    cooldown_efficiency: {
      title: 'Eficiencia de Cooldowns (Tyrant + Dreadstalkers)',
      simc: 'cooldown.efficiency',
      description: 'Promedio de uso de Summon Demonic Tyrant (60s) y Call Dreadstalkers (20s) frente al máximo posible en la pelea.',
      fixTip: 'Usa Tyrant y Call Dreadstalkers en cuanto estén disponibles; no los retrases.',
      simcraftText: 'Guía: mantener los cooldowns rodando.',
      targetText: '≈ 100% (Top 20)',
      isCount: false,
    },
    tyrant_cast_count: {
      title: 'Summon Demonic Tyrant (usos)',
      simc: 'cast_count.summon_demonic_tyrant',
      description: 'Número de usos de Summon Demonic Tyrant, tu cooldown principal de daño.',
      fixTip: 'Asegúrate de no perder ventanas de Tyrant a lo largo del combate.',
      simcraftText: 'Tyrant es el determinante del daño; maximiza sus usos.',
      targetText: `${aggregates.tyrant_cast_count?.avg || 4} prom. Top 20`,
      isCount: true,
    },
    dreadstalkers_cast_count: {
      title: 'Call Dreadstalkers (usos)',
      simc: 'cast_count.call_dreadstalkers',
      description: 'Número de usos de Call Dreadstalkers en la pelea.',
      fixTip: 'Usa Call Dreadstalkers en cooldown; alinéalo con la ventana de Tyrant cuando convenga.',
      simcraftText: 'Guía: Call Dreadstalkers siempre que esté disponible.',
      targetText: `${aggregates.dreadstalkers_cast_count?.avg || 10} prom. Top 20`,
      isCount: true,
    },
    tyrant_hog_casts: {
      title: 'Hand of Gul’dan por ventana de Tyrant',
      simc: 'tyrant.hand_of_guldan_casts',
      description: 'Promedio de Hand of Gul’dan lanzados dentro de cada ventana de Demonic Tyrant (20s). Es el factor determinante del daño de Tyrant.',
      fixTip: 'Entra a Tyrant con shards y cores para encadenar el máximo de Hand of Gul’dan dentro de la ventana.',
      simcraftText: 'Guía: maximizar Hand of Gul’dan dentro de Tyrant.',
      targetText: `${aggregates.tyrant_hog_casts?.avg || 7} prom. Top 20`,
      isCount: true,
    },
    tyrant_demons_active: {
      title: 'Demonios por ventana de Tyrant',
      simc: 'tyrant.demons_active',
      description: 'Promedio de demonios (Wild Imps + Dreadstalkers) invocados hacia cada ventana de Tyrant. Tyrant escala su daño con los demonios activos. (Aproximado: cuenta invocaciones en la ventana, sin modelar despawns.)',
      fixTip: 'Entra a Tyrant con muchos demonios activos; encadena Hand of Gul’dan para generar Wild Imps.',
      simcraftText: 'Guía: maximizar demonios activos durante Tyrant.',
      targetText: `${aggregates.tyrant_demons_active?.avg || 30} prom. Top 20`,
      isCount: true,
    },
    hand_of_guldan_cast_count: {
      title: 'Hand of Gul’dan (usos totales)',
      simc: 'cast_count.hand_of_guldan',
      description: 'Usos totales de Hand of Gul’dan, tu principal gastador de shards y generador de Wild Imps.',
      fixTip: 'Gasta shards con Hand of Gul’dan a 4-5 shards para no overcapear.',
      simcraftText: 'Guía: Hand of Gul’dan a 4-5 shards.',
      targetText: `${aggregates.hand_of_guldan_cast_count?.avg || 50} prom. Top 20`,
      isCount: true,
    },
  };
}

export const demonologyWarlockModule: SpecModule = {
  className: 'Warlock',
  specName: 'Demonology',
  cacheSpec: 'Demonology',
  // Demo's metrics use casts/buffs/resources/summons only — no enemy debuffs or
  // pet-targeted buffs to fetch.
  debuffIds: [],
  petBuffIds: [],
  metricKeys: [...DEMO_METRIC_KEYS, ...OUTPUT_METRIC_KEYS],
  displayName: 'Warlock Demonology',
  analyze: (events, start, end) => ({
    ...analyzeDemoMetrics(events, start, end),
    ...computeOutputMetrics(events, start, end),
  }),
  getMetricsInfo: (aggregates) => ({
    ...getDemoMetricsInfo(aggregates),
    ...getOutputMetricsInfo(aggregates),
  }),
  // No computeDpsGains yet — no sim-derived formulas, so no DPS-recoverable banner.
};
