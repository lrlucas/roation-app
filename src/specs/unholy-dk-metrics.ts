// Unholy DK UI definitions: per-metric copy + DPS-gain estimates. Extracted from
// the component so the analyzer view can be driven generically per spec.
import type { Aggregates, MetricInfo, SpecMetrics } from './types';

export function getUnholyMetricsInfo(aggregates: Aggregates): Record<string, MetricInfo> {
  return {
    putrefy_pct_dt: {
      title: 'Putrefy en Dark Transformation',
      simc: 'apl.putrefy_in_dt',
      description: '% de Festering Wounds reventados con Putrefy activo durante Dark Transformation.',
      fixTip: 'Castea Putrefy justo antes de reventar heridas dentro de la ventana de DT.',
      simcraftText: 'Simcraft: 50% → 112k vs 94% → 117k DPS.',
      targetText: '94% prom. Top 20',
      isCount: false,
    },
    dt_army_aligned: {
      title: 'Alineación de Burst',
      simc: 'burst.sync_pct',
      description: 'Sincronía de Apocalypse - Dark Transformation - Army dentro de la ventana de daño.',
      fixTip: 'Agrupa Apocalypse con Dark Transformation; evita desfasarlos > 3s.',
      simcraftText: 'Simcraft: 60% → 108k vs 90% → 114k DPS.',
      targetText: '90% prom. Top 20',
      isCount: false,
    },
    sudden_doom_waste: {
      title: 'Sudden Doom desperdiciado',
      simc: 'apl.sudden_doom_waste',
      description: '% de procs de Sudden Doom sobrescritos o expirados sin consumir.',
      fixTip: 'Consume el proc antes de generar otro Festering Strike.',
      simcraftText: 'Simcraft: 25% → 110k vs 5% → 113k DPS.',
      targetText: '5.5% prom. Top 20',
      isCount: false,
      lowerIsBetter: true,
    },
    dt_cast_count: {
      title: 'Dark Transformation (usos)',
      simc: 'cast_count.dark_transformation',
      description: 'Número de activaciones de Dark Transformation en el combate.',
      fixTip: 'Perdiste 1 ventana. Mantén Festering Wounds para no retrasar el siguiente DT.',
      simcraftText: 'Simcraft: 3 casts → 105k vs 5 casts → 111k DPS.',
      targetText: `${aggregates.dt_cast_count?.avg || 5} prom. Top 20`,
      isCount: true,
    },
    ability_uptime: {
      title: 'Ability Uptime (Active GCD)',
      simc: 'uptime.gcd_active',
      description: 'Mide la cobertura de GCDs activos. Los intervalos sin castear superiores a 1.5 segundos (GCD aproximado) reducen este valor.',
      fixTip: 'Evita tiempos muertos y mantén el ritmo de lanzamientos.',
      simcraftText: 'Simcraft: 85% → 105k vs 96% → 112k DPS.',
      targetText: '96% prom. Top 20',
      isCount: false,
    },
    melee_uptime: {
      title: 'Melee Uptime',
      simc: 'uptime.melee',
      description: 'Porcentaje de tiempo de combate en rango de cuerpo a cuerpo pegando golpes blancos reales.',
      fixTip: 'Mantén la proximidad física al jefe para no perder golpes blancos.',
      simcraftText: 'Simcraft: 80% → 102k vs 95% → 108k DPS.',
      targetText: '95% prom. Top 20',
      isCount: false,
    },
    army_cast_count: {
      title: 'Army of the Dead (usos)',
      simc: 'cast_count.army_of_the_dead',
      description: 'Cantidad de usos de Army of the Dead en la pelea.',
      fixTip: 'Asegúrate de lanzar Army en los momentos óptimos del combate.',
      simcraftText: 'Simcraft: 1 cast → 108k vs 2 casts → 112k DPS.',
      targetText: `${aggregates.army_cast_count?.avg || 2} prom. Top 20`,
      isCount: true,
    },
    virulent_uptime: {
      title: 'Virulent Plague Uptime',
      simc: 'dot.virulent_plague.uptime',
      description: 'Tiempo de actividad de la peste Virulent Plague (ID 191587) aplicada en los enemigos.',
      fixTip: 'Reaplica Outbreak o Putrefy antes de que la peste expire.',
      simcraftText: 'Simcraft: 80% → 107k vs 97% → 111k DPS.',
      targetText: '97% prom. Top 20',
      isCount: false,
      treatZeroAsNoData: true,
    },
    dread_uptime: {
      title: 'Dread Plague Uptime',
      simc: 'dot.dread_plague.uptime',
      description: 'Tiempo de actividad de la peste Dread Plague (ID 1240996) aplicada en los enemigos.',
      fixTip: 'Mantén activa la peste Dread Plague mediante tu rotación estándar.',
      simcraftText: 'Simcraft: 80% → 109k vs 96% → 113k DPS.',
      targetText: '96% prom. Top 20',
      isCount: false,
      treatZeroAsNoData: true,
    },
    plague_efficiency: {
      title: 'Eficiencia de Plagas (Dread/Virulent)',
      simc: 'dot.dread_plague.coverage',
      description: 'Cobertura de Dread Plague mientras Virulent Plague está activa. Es la métrica primaria de enfermedades de WoWAnalyzer.',
      fixTip: 'Dread Plague debería espejar el uptime de Virulent Plague; reaplica antes de que expire.',
      simcraftText: 'WoWAnalyzer: objetivo ≥99% de cobertura (98%+ aceptable).',
      targetText: '99% objetivo (WoWAnalyzer)',
      isCount: false,
      treatZeroAsNoData: true,
    },
    rp_overcap_pct: {
      title: 'Runic Power desperdiciado (overcap)',
      simc: 'resource.runic_power.overcap',
      description: '% de Runic Power generado que se pierde por estar al máximo (100). Cada punto en overcap es generación malgastada.',
      fixTip: 'Gasta Death Coil / Epidemic antes de generar RP. Evita acumular cerca de 100, sobre todo en AoE.',
      simcraftText: 'Guía: nunca pasar de 100 RP — gasta para no overcapear.',
      targetText: '<3% prom. Top 20',
      isCount: false,
      lowerIsBetter: true,
    },
    commander_buffed_pct: {
      title: 'Commander of the Dead (pets buffeados)',
      simc: 'talent.commander_of_the_dead.buffed_pct',
      description: '% de invocaciones que reciben el buff de Commander of the Dead. Mide la sincronía de tus summons con la ventana de Dark Transformation.',
      fixTip: 'Mantén Army y Dark Transformation sincronizados para que los pets nazcan dentro del buff.',
      simcraftText: 'WoWAnalyzer: objetivo lo más cercano a 100%.',
      targetText: '100% objetivo (WoWAnalyzer)',
      isCount: false,
    },
    correct_spender_pct: {
      title: 'Spender correcto (ST vs AoE)',
      simc: 'apl.epidemic_prio',
      description: '% de gastos de Runic Power con el botón correcto según nº de objetivos: Epidemic/Graveyard en AoE, Death Coil/Necrotic Coil en single target.',
      fixTip: 'Cambia a Epidemic a 3+ objetivos (Graveyard a 6+ con Forbidden Knowledge); usa Death Coil en pocos objetivos.',
      simcraftText: 'Guía: Epidemic a 3+ targets, Graveyard a 6+ (con Forbidden Knowledge).',
      targetText: '100% objetivo',
      isCount: false,
    },
    soul_reaper_window_pct: {
      title: 'Soul Reaper en ventana (DT/Reaping)',
      simc: 'apl.soul_reaper_window',
      description: '% de Soul Reapers lanzados dentro de Dark Transformation / Reaping. (La rama execute <35% no se valida: WCL no expone el HP del enemigo en estos logs.)',
      fixTip: 'Prioriza Soul Reaper durante Dark Transformation; aprovecha el cast gratis de Reaping.',
      simcraftText: 'Icy Veins: Soul Reaper si <35% y DT activo, o el uso gratis de Reaping.',
      targetText: '100% objetivo',
      isCount: false,
    },
    scourge_strike_with_stacks: {
      title: 'Scourge Strike con stacks',
      simc: 'apl.scourge_strike_stacks',
      description: '% de Scourge Strikes lanzados teniendo al menos 1 stack de Lesser Ghoul disponible para consumir.',
      fixTip: 'No uses Scourge Strike sin stacks de Lesser Ghoul; mantén Festering Strike para alimentarlos.',
      simcraftText: 'APL: scourge_strike solo con buff.lesser_ghoul_ready.stack ≥ 1.',
      targetText: '100% objetivo',
      isCount: false,
    },
    festering_scythe_uptime: {
      title: 'Festering Scythe (uptime del buff)',
      simc: 'buff.festering_scythe.uptime',
      description: 'Tiempo con el buff de Festering Scythe activo. La rotación normal no garantiza 100%, hay que reaplicarlo activamente antes de que caiga.',
      fixTip: 'Vigila el buff de Festering Scythe y reaplícalo antes de que expire para no perder uptime.',
      simcraftText: 'Guías: trackear el buff activamente; evitar que caiga.',
      targetText: 'maximizar (≈ Top 20)',
      isCount: false,
    },
    cooldown_efficiency: {
      title: 'Eficiencia de Cooldowns (DT + Army)',
      simc: 'cooldown.efficiency',
      description: 'Promedio de uso de Dark Transformation (45s) y Army of the Dead (90s) frente al máximo posible en la pelea. Mide si los lanzas en cuanto están disponibles.',
      fixTip: 'Usa Army y Dark Transformation en cuanto salen de cooldown; cada retraso desfasa la ventana de burst.',
      simcraftText: 'Guías: usar los cooldowns en cuanto estén listos (ciclo de 45s).',
      targetText: '≈ 100% (Top 20)',
      isCount: false,
    },
    lesser_ghoul_efficiency: {
      title: 'Eficiencia de stacks de Lesser Ghoul',
      simc: 'buff.lesser_ghoul.efficiency',
      description: '% de stacks de Lesser Ghoul consumidos vs generados. Los stacks que expiran sin gastarse son daño perdido.',
      fixTip: 'Consume tus stacks de Lesser Ghoul con Scourge Strike antes de que expiren o de sobrecapear.',
      simcraftText: 'WoWAnalyzer: stack efficiency = consumidos / generados.',
      targetText: 'maximizar (≈ Top 20)',
      isCount: false,
    },
  };
}

/** Estimated DPS recoverable per metric (Unholy-specific formulas). */
export function computeUnholyDpsGains(
  userMetrics: SpecMetrics | undefined | null,
  aggregates: Aggregates,
): Record<string, number> {
  const gains: Record<string, number> = {};
  if (!userMetrics) return gains;

  const userPutrefy = userMetrics.putrefy_pct_dt;
  if (userPutrefy < 94) gains.putrefy_pct_dt = Math.round((94 - userPutrefy) * 115);

  const userBurst = userMetrics.dt_army_aligned;
  if (userBurst < 90) gains.dt_army_aligned = Math.round((90 - userBurst) * 122);

  const userSuddenDoom = userMetrics.sudden_doom_waste;
  if (userSuddenDoom > 5.5) gains.sudden_doom_waste = Math.round((userSuddenDoom - 5.5) * 152);

  const userDtCasts = userMetrics.dt_cast_count;
  const top20DtAvg = aggregates.dt_cast_count?.avg || 5;
  if (userDtCasts < top20DtAvg) gains.dt_cast_count = Math.round((top20DtAvg - userDtCasts) * 900);

  return gains;
}
