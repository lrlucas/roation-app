// Tests unitarios de la capa de agregación pura del Recap Mítico.
// No toca la red: alimenta fights de fixture → verifica métricas de salida.
//
// Build + run:
//   npx esbuild src/utils/recapAggregation.ts --bundle --format=esm --outfile=tmp_recap.mjs
//   node test_recap_aggregation.mjs
import { aggregateRecap, raidNightKey } from './tmp_recap.mjs';

let passed = 0, failed = 0;
function assert(cond, msg) {
  if (cond) { passed++; }
  else { failed++; console.error('  ✗ FAIL:', msg); }
}
function eq(a, b, msg) { assert(a === b, `${msg} (esperado ${b}, obtuve ${a})`); }

// Helper: construye un fight con timestamps absolutos.
const TZ = 'America/Argentina/Buenos_Aires';
const opts = { timezone: TZ, nightCutoffHour: 5 };
// 2026-01-05 22:00 ART = 2026-01-06 01:00 UTC. ART = UTC-3.
const night1 = Date.UTC(2026, 0, 6, 1, 0, 0);  // mar 5 ene, 22:00 ART
const night2 = Date.UTC(2026, 0, 8, 1, 0, 0);  // jue 7 ene, 22:00 ART
const MIN = 60_000;

function fight(code, id, enc, name, kill, pct, start, durMin) {
  return {
    reportCode: code, fightId: id, encounterID: enc, name, kill,
    fightPercentage: pct, bossPercentage: pct, lastPhase: 1,
    startTimeAbs: start, endTimeAbs: start + durMin * MIN,
  };
}

// ── Test 1: métricas básicas de un boss con kill ────────────────────────────────
{
  const fights = [
    fight('AAA', 1, 100, 'Boss A', false, 45, night1 + 0 * MIN, 3),
    fight('AAA', 2, 100, 'Boss A', false, 20, night1 + 10 * MIN, 4),
    fight('AAA', 3, 100, 'Boss A', false, 5,  night2 + 0 * MIN, 5),
    fight('AAA', 4, 100, 'Boss A', true,  0,  night2 + 10 * MIN, 6), // kill: pull #4
  ];
  const { bosses, totals } = aggregateRecap(fights, opts);
  const a = bosses.find(b => b.encounterID === 100);
  eq(bosses.length, 1, 'T1 un solo boss');
  eq(a.totalPulls, 4, 'T1 totalPulls');
  eq(a.wipes, 3, 'T1 wipes');
  eq(a.bestPullPct, 5, 'T1 mejor % (menor entre wipes)');
  eq(a.killed, true, 'T1 killed');
  eq(a.killPullNumber, 4, 'T1 pull del kill');
  eq(a.progressNights, 2, 'T1 noches de progreso');
  eq(a.combatTimeMs, (3 + 4 + 5 + 6) * MIN, 'T1 tiempo en combate');
  eq(a.killOrder, 1, 'T1 killOrder');
  eq(totals.totalPulls, 4, 'T1 totalPulls global');
  eq(totals.bossesKilled, 1, 'T1 bosses muertos');
  eq(totals.bossesSeen, 1, 'T1 bosses vistos');
  eq(totals.wallBossEncounterID, 100, 'T1 wall boss');
}

// ── Test 2: orden de kills global + boss en progreso (sin kill) ──────────────────
{
  const fights = [
    // Boss B muere primero (night1), Boss C todavía en progreso.
    fight('R1', 1, 200, 'Boss B', false, 30, night1 + 0 * MIN, 4),
    fight('R1', 2, 200, 'Boss B', true,  0,  night1 + 8 * MIN, 5), // kill night1
    fight('R1', 3, 300, 'Boss C', false, 60, night1 + 20 * MIN, 3),
    fight('R2', 1, 300, 'Boss C', false, 12, night2 + 0 * MIN, 6),
    fight('R2', 2, 300, 'Boss C', false, 12, night2 + 10 * MIN, 6),
    fight('R2', 3, 300, 'Boss C', false, 8,  night2 + 20 * MIN, 6),
  ];
  const { bosses, totals } = aggregateRecap(fights, opts);
  const b = bosses.find(x => x.encounterID === 200);
  const c = bosses.find(x => x.encounterID === 300);
  eq(b.killed, true, 'T2 B muerto');
  eq(b.killOrder, 1, 'T2 B primer kill');
  eq(c.killed, false, 'T2 C en progreso');
  eq(c.killOrder, null, 'T2 C sin killOrder');
  eq(c.killPullNumber, null, 'T2 C sin pull de kill');
  eq(c.totalPulls, 4, 'T2 C pulls');
  eq(c.bestPullPct, 8, 'T2 C mejor %');
  eq(totals.bossesKilled, 1, 'T2 1 boss muerto');
  eq(totals.bossesSeen, 2, 'T2 2 bosses vistos');
  eq(totals.wallBossEncounterID, 300, 'T2 wall = Boss C (más pulls)');
  // Presentación: kills primero, luego en-progreso → B antes que C.
  eq(bosses[0].encounterID, 200, 'T2 orden presentación: kill primero');
}

// ── Test 3: dedup de reportes solapados + kill al primer pull (sin wipes) ────────
{
  const fights = [
    fight('DUP', 9, 400, 'Boss D', true, 0, night1 + 0 * MIN, 5),
    fight('DUP', 9, 400, 'Boss D', true, 0, night1 + 0 * MIN, 5), // duplicado exacto
  ];
  const { bosses, duplicatesDropped } = aggregateRecap(fights, opts);
  const d = bosses[0];
  eq(duplicatesDropped, 1, 'T3 un duplicado descartado');
  eq(d.totalPulls, 1, 'T3 totalPulls tras dedup');
  eq(d.wipes, 0, 'T3 sin wipes');
  eq(d.bestPullPct, null, 'T3 sin mejor % (no hubo wipes)');
  eq(d.killPullNumber, 1, 'T3 kill al primer pull');
}

// ── Test 4: fightPercentage null (no aborta el mínimo) + trash filtrado ──────────
{
  const fights = [
    fight('N', 1, 500, 'Boss E', false, null, night1 + 0 * MIN, 2),
    fight('N', 2, 500, 'Boss E', false, 33,   night1 + 5 * MIN, 3),
    fight('N', 3, 0,   'Trash',  false, 0,    night1 + 8 * MIN, 1), // trash → descartado
  ];
  const { bosses } = aggregateRecap(fights, opts);
  eq(bosses.length, 1, 'T4 trash excluido');
  eq(bosses[0].bestPullPct, 33, 'T4 mejor % ignora null');
  eq(bosses[0].totalPulls, 2, 'T4 pulls sin trash');
}

// ── Test 4b: pulls posteriores a la kill (farm/re-kill) NO cuentan ──────────────
{
  const fights = [
    fight('F', 1, 600, 'Boss F', false, 40, night1 + 0 * MIN, 4),
    fight('F', 2, 600, 'Boss F', false, 10, night1 + 6 * MIN, 5),
    fight('F', 3, 600, 'Boss F', true,  0,  night1 + 12 * MIN, 6), // KILL en pull #3
    fight('F', 4, 600, 'Boss F', true,  0,  night2 + 0 * MIN, 6),  // re-kill (farm) → descartar
    fight('F', 5, 600, 'Boss F', false, 80, night2 + 8 * MIN, 2),  // wipe de farm → descartar
  ];
  const { bosses, totals } = aggregateRecap(fights, opts);
  const f = bosses[0];
  eq(f.totalPulls, 3, 'T4b solo cuenta hasta la kill (3, no 5)');
  eq(f.wipes, 2, 'T4b wipes solo de progreso');
  eq(f.killPullNumber, 3, 'T4b pull del kill');
  eq(f.bestPullPct, 10, 'T4b mejor % ignora el wipe de farm (80%)');
  eq(f.progressNights, 1, 'T4b noches: solo night1 (la kill de farm en night2 no cuenta)');
  eq(f.combatTimeMs, (4 + 5 + 6) * MIN, 'T4b combate solo hasta la kill');
  eq(totals.totalPulls, 3, 'T4b total global excluye farm');
}

// ── Test 5: raidNightKey respeta el cutoff de madrugada ─────────────────────────
{
  // 2026-01-06 02:00 ART (madrugada) → con cutoff 5 cuenta como noche del 05.
  const madrugada = Date.UTC(2026, 0, 6, 5, 0, 0); // 02:00 ART
  eq(raidNightKey(madrugada, TZ, 5), '2026-01-05', 'T5 madrugada → noche anterior');
  // 2026-01-06 22:00 ART (noche) → cuenta como el 06.
  const noche = Date.UTC(2026, 0, 7, 1, 0, 0); // 22:00 ART del 06
  eq(raidNightKey(noche, TZ, 5), '2026-01-06', 'T5 noche → mismo día');
}

console.log(`\n${failed === 0 ? '✓' : '✗'} Recap aggregation: ${passed} pasados, ${failed} fallidos`);
process.exit(failed === 0 ? 0 : 1);
