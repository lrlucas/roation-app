/**
 * Recap de Progreso Mítico — capa de AGREGACIÓN PURA.
 *
 * Sin red, sin React: recibe los fights crudos (ya normalizados a timestamps
 * absolutos) y produce las métricas por boss + los totales globales del tier.
 *
 * Todo es determinístico y testeable: ver `test_recap_aggregation.mjs` en la raíz.
 */

/** Un pull (fight) ya normalizado, con timestamps ABSOLUTOS en ms. */
export interface RecapFight {
  /** Código del reporte de WCL donde vive el pull (para dedup + enlaces). */
  reportCode: string;
  /** Id del fight dentro del reporte. */
  fightId: number;
  encounterID: number;
  name: string;
  kill: boolean;
  /** % del boss al wipear; MENOR = mejor pull. null si WCL no lo reportó. */
  fightPercentage: number | null;
  bossPercentage: number | null;
  lastPhase: number | null;
  /** Timestamp Unix absoluto en ms del inicio del pull (report.startTime + fight.startTime). */
  startTimeAbs: number;
  /** Timestamp Unix absoluto en ms del fin del pull. */
  endTimeAbs: number;
}

export interface RecapOptions {
  /** Zona horaria IANA de la guild para agrupar noches de raid (ej: "America/Argentina/Buenos_Aires"). */
  timezone: string;
  /**
   * Hora de corte (0-23). Las sesiones que empiezan ANTES de esta hora local
   * cuentan como la noche anterior (ej: 5 → un pull a las 2am del martes
   * pertenece a la noche del lunes).
   */
  nightCutoffHour: number;
}

export const DEFAULT_RECAP_OPTIONS: RecapOptions = {
  timezone: 'America/Argentina/Buenos_Aires',
  nightCutoffHour: 5,
};

/** Mejor `fightPercentage` alcanzado en una noche concreta de raid. */
export interface NightBest {
  /** Clave de la noche (YYYY-MM-DD, fecha local con cutoff aplicado). */
  night: string;
  /** Timestamp absoluto del primer pull de esa noche (para ordenar/mostrar). */
  date: number;
  /** Mejor (menor) fightPercentage de la noche. null si ninguno fue reportado. */
  bestPct: number | null;
  /** Pulls de esa noche para ese boss. */
  pulls: number;
}

export interface BossRecap {
  encounterID: number;
  name: string;
  /** Total de pulls de este encounter. */
  totalPulls: number;
  /** Pulls donde kill === false. */
  wipes: number;
  /** Menor fightPercentage entre los wipes (cuánto se atascaron antes del kill). null si no hubo wipes con dato. */
  bestPullPct: number | null;
  /** ¿Ya está muerto? */
  killed: boolean;
  /** Número de pull del kill dentro de la secuencia del boss (1-based). null si sin kill. */
  killPullNumber: number | null;
  /** Timestamp absoluto del primer kill. null si sin kill. */
  killDate: number | null;
  /** Reporte/fight del kill, para enlazar a WCL. */
  killReportCode: string | null;
  killFightId: number | null;
  /** Suma de (endTimeAbs - startTimeAbs) de todos los pulls, en ms. */
  combatTimeMs: number;
  /** Cantidad de noches de raid distintas en las que se tocó este boss. */
  progressNights: number;
  /** Timestamp del primer pull del boss. */
  firstPullDate: number;
  /** Timestamp del último pull del boss. */
  lastPullDate: number;
  /** Evolución del mejor % noche a noche (para la curva del boss-muro). */
  nightlyBest: NightBest[];
  /** Orden en el que cayó respecto a los demás kills (1 = primer boss muerto). null si sin kill. */
  killOrder: number | null;
}

export interface RecapTotals {
  totalPulls: number;
  totalCombatMs: number;
  bossesKilled: number;
  /** Encounters distintos vistos en el tier (con al menos 1 pull). */
  bossesSeen: number;
  firstKillDate: number | null;
  lastKillDate: number | null;
  /** encounterID del boss con más pulls (el "muro" del tier). null si no hay datos. */
  wallBossEncounterID: number | null;
}

export interface RecapResult {
  bosses: BossRecap[];
  totals: RecapTotals;
  /** Opciones efectivas usadas (timezone/cutoff) — útil para el export. */
  options: RecapOptions;
  /** Cantidad de pulls duplicados que se descartaron (reportes solapados). */
  duplicatesDropped: number;
}

/**
 * Clave de "noche de raid" para un timestamp: fecha local (en la timezone dada)
 * tras restar el cutoff, de modo que las madrugadas cuenten como la noche previa.
 * Devuelve YYYY-MM-DD.
 */
export function raidNightKey(ts: number, timezone: string, cutoffHour: number): string {
  const shifted = ts - cutoffHour * 3_600_000;
  // 'en-CA' formatea como YYYY-MM-DD, ideal para usar como clave ordenable.
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return fmt.format(new Date(shifted));
}

/** Menor valor no-nulo de una lista; null si todos son null. */
function minNonNull(values: (number | null)[]): number | null {
  let best: number | null = null;
  for (const v of values) {
    if (v == null) continue;
    if (best == null || v < best) best = v;
  }
  return best;
}

/**
 * Agrega los fights crudos en métricas por boss + totales del tier.
 *
 * - Dedup por `reportCode#fightId` (maneja reportes solapados/duplicados).
 * - Ordena GLOBALMENTE por timestamp absoluto antes de numerar pulls / detectar
 *   el primer kill (un kill siempre es el primer `kill===true` en orden temporal).
 * - Edge cases cubiertos: bosses sin kill (progreso en curso), pulls sin
 *   fightPercentage, encounters sin pulls (no aparecen), fights de trash deben
 *   filtrarse ANTES de llamar a esta función (encounterID === 0).
 */
export function aggregateRecap(
  rawFights: RecapFight[],
  options: RecapOptions = DEFAULT_RECAP_OPTIONS,
): RecapResult {
  const { timezone, nightCutoffHour } = options;

  // 1) Dedup por reportCode#fightId.
  const seen = new Set<string>();
  const fights: RecapFight[] = [];
  let duplicatesDropped = 0;
  for (const f of rawFights) {
    if (f.encounterID === 0) continue; // trash, por las dudas
    const key = `${f.reportCode}#${f.fightId}`;
    if (seen.has(key)) {
      duplicatesDropped++;
      continue;
    }
    seen.add(key);
    fights.push(f);
  }

  // 2) Orden global por timestamp absoluto (desempate estable por reportCode#fightId).
  fights.sort((a, b) =>
    a.startTimeAbs - b.startTimeAbs ||
    a.reportCode.localeCompare(b.reportCode) ||
    a.fightId - b.fightId,
  );

  // 3) Agrupar por encounter, preservando el orden temporal.
  const groups = new Map<number, RecapFight[]>();
  for (const f of fights) {
    const arr = groups.get(f.encounterID);
    if (arr) arr.push(f);
    else groups.set(f.encounterID, [f]);
  }

  const bosses: BossRecap[] = [];

  for (const [encounterID, allPulls] of groups) {
    const name = allPulls.find(p => p.name)?.name ?? `Encounter ${encounterID}`;

    // Solo cuentan los pulls de PROGRESO: desde el primer pull hasta la primera
    // kill (inclusive). Los pulls posteriores (farm / re-kills) se descartan.
    // Sin kill todavía (en progreso) → cuentan todos.
    const firstKillIdx = allPulls.findIndex(p => p.kill);
    const killed = firstKillIdx !== -1;
    const pulls = killed ? allPulls.slice(0, firstKillIdx + 1) : allPulls;
    const killIdx = killed ? pulls.length - 1 : -1; // la kill es siempre el último pull de progreso

    const wipesPcts: (number | null)[] = [];
    let wipes = 0;
    let combatTimeMs = 0;

    pulls.forEach((p) => {
      combatTimeMs += Math.max(0, p.endTimeAbs - p.startTimeAbs);
      if (!p.kill) {
        wipes++;
        wipesPcts.push(p.fightPercentage);
      }
    });

    // Noches: agrupar pulls por raidNightKey y sacar el mejor % de cada una.
    const byNight = new Map<string, { date: number; pcts: (number | null)[]; pulls: number }>();
    for (const p of pulls) {
      const night = raidNightKey(p.startTimeAbs, timezone, nightCutoffHour);
      const entry = byNight.get(night);
      if (entry) {
        entry.pcts.push(p.fightPercentage);
        entry.pulls++;
        if (p.startTimeAbs < entry.date) entry.date = p.startTimeAbs;
      } else {
        byNight.set(night, { date: p.startTimeAbs, pcts: [p.fightPercentage], pulls: 1 });
      }
    }
    const nightlyBest: NightBest[] = Array.from(byNight.entries())
      .map(([night, v]) => ({ night, date: v.date, bestPct: minNonNull(v.pcts), pulls: v.pulls }))
      .sort((a, b) => a.date - b.date);

    const killPull = killed ? pulls[killIdx] : null;

    bosses.push({
      encounterID,
      name,
      totalPulls: pulls.length,
      wipes,
      bestPullPct: minNonNull(wipesPcts),
      killed,
      killPullNumber: killed ? killIdx + 1 : null,
      killDate: killPull ? killPull.startTimeAbs : null,
      killReportCode: killPull ? killPull.reportCode : null,
      killFightId: killPull ? killPull.fightId : null,
      combatTimeMs,
      progressNights: byNight.size,
      firstPullDate: pulls[0].startTimeAbs,
      lastPullDate: pulls[pulls.length - 1].startTimeAbs,
      nightlyBest,
      killOrder: null, // se completa abajo
    });
  }

  // 4) Orden de kills (1 = primer boss muerto del tier).
  const killedSorted = bosses
    .filter(b => b.killed && b.killDate != null)
    .sort((a, b) => (a.killDate! - b.killDate!));
  killedSorted.forEach((b, i) => { b.killOrder = i + 1; });

  // 5) Totales globales del tier.
  const totalPulls = bosses.reduce((s, b) => s + b.totalPulls, 0);
  const totalCombatMs = bosses.reduce((s, b) => s + b.combatTimeMs, 0);
  const bossesKilled = killedSorted.length;
  const killDates = killedSorted.map(b => b.killDate!);
  const wallBoss = bosses.reduce<BossRecap | null>(
    (best, b) => (!best || b.totalPulls > best.totalPulls ? b : best),
    null,
  );

  const totals: RecapTotals = {
    totalPulls,
    totalCombatMs,
    bossesKilled,
    bossesSeen: bosses.length,
    firstKillDate: killDates.length ? Math.min(...killDates) : null,
    lastKillDate: killDates.length ? Math.max(...killDates) : null,
    wallBossEncounterID: wallBoss ? wallBoss.encounterID : null,
  };

  // 6) Orden de presentación: kills primero por orden de caída, luego los no
  //    muertos por más pulls (los que están en progreso, arriba).
  bosses.sort((a, b) => {
    if (a.killed && b.killed) return a.killDate! - b.killDate!;
    if (a.killed) return -1;
    if (b.killed) return 1;
    return b.totalPulls - a.totalPulls;
  });

  return { bosses, totals, options, duplicatesDropped };
}
