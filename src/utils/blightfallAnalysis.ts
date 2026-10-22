// Análisis de Blightfall (DK Unholy).
//
// Blightfall consume Virulent Plague y Dread Plague del objetivo y hace el
// 100% del daño restante de golpe (eventos "Erupt"). WCL no registra los
// refresh/extensiones de las plagas (Putrefy las alarga sin evento), así que
// la duración restante en el momento del consumo se estima por daño:
//
//   segundos restantes ≈ daño Erupt / daño medio por tick × intervalo de tick
//
// Validado contra logs reales: las dos plagas (independientes) dan casi el
// mismo valor en cada consumo. Si el Erupt critea se normaliza con el
// multiplicador de crítico medido en los propios ticks del jugador.

import type { WCLEvent } from '../types/warcraftlogs';

export const BLIGHTFALL_SPELL_IDS = {
  blightfall_cast: 1271967,
  virulent_plague: 191587,
  dread_plague: 1240996,
  virulent_erupt: 1241167,
  dread_erupt: 1241171,
};

const HIT_CRIT = 2;
// Erupt y cast comparten timestamp; margen por si el log los separa un poco.
const ERUPT_MATCH_MS = 50;
// Ventana de ticks previos al consumo usada como referencia de daño por tick.
const TICK_WINDOW_MS = 8000;

export interface BlightfallPlagueSample {
  targetID: number;
  eruptDamage: number;
  crit: boolean;
  /** null si no hubo ticks previos suficientes para estimar. */
  estSeconds: number | null;
}

export interface BlightfallCast {
  /** Segundos desde el inicio del fight. */
  time: number;
  /** Daño total del Erupt (ambas plagas, todos los objetivos). */
  damage: number;
  targets: number;
  dread: BlightfallPlagueSample | null;
  virulent: BlightfallPlagueSample | null;
  /** Media de las estimaciones de ambas plagas sobre el objetivo principal. */
  estSeconds: number | null;
}

export interface BlightfallAnalysis {
  casts: BlightfallCast[];
  totalDamage: number;
  avgDamage: number;
  avgSeconds: number | null;
  minSeconds: number | null;
  maxSeconds: number | null;
}

const rawAmount = (e: WCLEvent) => (e.amount ?? 0) + (e.absorbed ?? 0);
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);

function critMultiplier(ticks: WCLEvent[]): number {
  const crit = ticks.filter(t => t.hitType === HIT_CRIT).map(rawAmount);
  const normal = ticks.filter(t => t.hitType !== HIT_CRIT).map(rawAmount);
  const m = mean(crit) / mean(normal);
  // Sin muestras suficientes, el crítico base de WoW es x2.
  return crit.length >= 5 && normal.length >= 5 && Number.isFinite(m) ? m : 2;
}

function samplePlague(
  events: WCLEvent[],
  castTs: number,
  dotId: number,
  eruptId: number,
  critMult: number,
): BlightfallPlagueSample[] {
  // Hay procs pequeños de Erupt fuera de Blightfall que pueden caer pegados al
  // cast; por objetivo nos quedamos solo con el más grande (el del consumo).
  const byTarget = new Map<number | undefined, WCLEvent>();
  for (const e of events) {
    if (e.type !== 'damage' || e.abilityGameID !== eruptId || Math.abs(e.timestamp - castTs) > ERUPT_MATCH_MS) continue;
    const prev = byTarget.get(e.targetID);
    if (!prev || rawAmount(e) > rawAmount(prev)) byTarget.set(e.targetID, e);
  }
  const erupts = [...byTarget.values()];

  return erupts.map(e => {
    const ticks = events.filter(t =>
      t.type === 'damage' && t.tick && t.abilityGameID === dotId && t.targetID === e.targetID &&
      t.timestamp < castTs && t.timestamp >= castTs - TICK_WINDOW_MS);
    const normalTicks = ticks.filter(t => t.hitType !== HIT_CRIT).map(rawAmount);
    const intervals = ticks.slice(1).map((t, i) => t.timestamp - ticks[i].timestamp).filter(v => v > 300);

    const crit = e.hitType === HIT_CRIT;
    const amount = rawAmount(e);
    let estSeconds: number | null = null;
    if (normalTicks.length >= 2 && intervals.length >= 1) {
      const base = crit ? amount / critMult : amount;
      estSeconds = (base / mean(normalTicks)) * (mean(intervals) / 1000);
    }
    return { targetID: e.targetID ?? -1, eruptDamage: amount, crit, estSeconds };
  });
}

export function analyzeBlightfall(events: WCLEvent[], fightStartTime: number): BlightfallAnalysis {
  const ids = BLIGHTFALL_SPELL_IDS;
  const tickEvents = events.filter(e => e.type === 'damage' && e.tick);
  const dreadCrit = critMultiplier(tickEvents.filter(e => e.abilityGameID === ids.dread_plague));
  const virulentCrit = critMultiplier(tickEvents.filter(e => e.abilityGameID === ids.virulent_plague));

  const casts: BlightfallCast[] = events
    .filter(e => e.type === 'cast' && e.abilityGameID === ids.blightfall_cast)
    .map(c => {
      const dread = samplePlague(events, c.timestamp, ids.dread_plague, ids.dread_erupt, dreadCrit);
      const virulent = samplePlague(events, c.timestamp, ids.virulent_plague, ids.virulent_erupt, virulentCrit);
      const all = [...dread, ...virulent];

      // Objetivo principal = el que recibió el Erupt más grande.
      const main = all.slice().sort((a, b) => b.eruptDamage - a.eruptDamage)[0];
      const mainDread = dread.find(s => s.targetID === main?.targetID) ?? null;
      const mainVirulent = virulent.find(s => s.targetID === main?.targetID) ?? null;
      const ests = [mainDread?.estSeconds, mainVirulent?.estSeconds].filter((v): v is number => v != null);

      return {
        time: (c.timestamp - fightStartTime) / 1000,
        damage: all.reduce((a, s) => a + s.eruptDamage, 0),
        targets: new Set(all.map(s => s.targetID)).size,
        dread: mainDread,
        virulent: mainVirulent,
        estSeconds: ests.length ? mean(ests) : null,
      };
    });

  const secs = casts.map(c => c.estSeconds).filter((v): v is number => v != null);
  const totalDamage = casts.reduce((a, c) => a + c.damage, 0);
  return {
    casts,
    totalDamage,
    avgDamage: casts.length ? totalDamage / casts.length : 0,
    avgSeconds: secs.length ? mean(secs) : null,
    minSeconds: secs.length ? Math.min(...secs) : null,
    maxSeconds: secs.length ? Math.max(...secs) : null,
  };
}
