// E2E: fetch events exactly like fetchPlayerEvents now does and run analyzeUnholyDkMetrics
// Build the utils bundle first:
//   npx esbuild src/utils/unholyDkAnalyzerUtils.ts --bundle --format=esm --outfile=tmp_utils.mjs
// Then: node test_metrics_e2e.mjs
import { readFileSync } from 'fs';
import { analyzeUnholyDkMetrics, SPELL_IDS } from './tmp_utils.mjs';

const env = Object.fromEntries(
  readFileSync('.env', 'utf8').split(/\r?\n/).filter(l => l.includes('='))
    .map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()])
);
const t = await fetch('https://www.warcraftlogs.com/oauth/token', {
  method: 'POST',
  headers: {
    Authorization: 'Basic ' + Buffer.from(env.VITE_WCL_CLIENT_ID + ':' + env.VITE_WCL_CLIENT_SECRET).toString('base64'),
    'Content-Type': 'application/x-www-form-urlencoded',
  },
  body: 'grant_type=client_credentials',
});
const token = (await t.json()).access_token;

async function gql(query, variables) {
  const resp = await fetch('https://www.warcraftlogs.com/api/v2/client', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  });
  const data = await resp.json();
  if (data.errors) throw new Error(JSON.stringify(data.errors));
  return data.data;
}

const code = 'Gbc3x9zTtHBjyZWq';
const fightID = 41;
const sourceID = 20;

const fightData = await gql(`query {
  reportData { report(code: "${code}") { fights(fightIDs: [${fightID}]) { startTime endTime name } } }
}`);
const fight = fightData.reportData.report.fights[0];
console.log(`Fight: ${fight.name}, duration ${((fight.endTime - fight.startTime) / 1000).toFixed(0)}s`);

const debuffFilter = `ability.id in (${SPELL_IDS.virulent_plague}, ${SPELL_IDS.dread_plague})`;
const ev = await gql(`
  query GetPlayerEvents($code: String!, $fightID: Int!, $sourceID: Int!, $debuffFilter: String!) {
    reportData {
      report(code: $code) {
        casts: events(fightIDs: [$fightID], dataType: Casts, sourceID: $sourceID, limit: 10000) { data }
        buffs: events(fightIDs: [$fightID], dataType: Buffs, sourceID: $sourceID, limit: 10000) { data }
        petBuffs: events(fightIDs: [$fightID], dataType: Buffs, sourceID: $sourceID, abilityID: 390264, limit: 10000) { data }
        debuffs: events(fightIDs: [$fightID], dataType: Debuffs, hostilityType: Enemies, filterExpression: $debuffFilter, limit: 10000) { data }
        damage: events(fightIDs: [$fightID], dataType: DamageDone, sourceID: $sourceID, limit: 10000) { data }
        resources: events(fightIDs: [$fightID], dataType: Resources, sourceID: $sourceID, limit: 10000) { data }
        summons: events(fightIDs: [$fightID], dataType: Summons, sourceID: $sourceID, limit: 10000) { data }
      }
    }
  }
`, { code, fightID, sourceID, debuffFilter });

const rep = ev.reportData.report;
const events = {
  casts: rep.casts.data,
  buffs: [...rep.buffs.data, ...rep.petBuffs.data],
  debuffs: rep.debuffs.data.filter(e => e.sourceID === sourceID),
  meleeHits: rep.damage.data,
  resources: rep.resources.data,
  summons: rep.summons.data,
};
console.log(`Events: ${events.casts.length} casts, ${events.buffs.length} buffs, ${events.debuffs.length} debuffs (player), ${events.meleeHits.length} damage`);

const metrics = analyzeUnholyDkMetrics(events, fight.startTime, fight.endTime);
console.log('\nMetrics (new code):');
console.log(JSON.stringify(metrics, null, 2));

console.log('\nNew metrics detail:');
console.log(`  rp_overcap_pct: ${metrics.rp_overcap_pct}% (RP wasted to overcap)`);
console.log(`  commander_buffed_pct: ${metrics.commander_buffed_pct}% (pets buffed by Commander)`);
console.log(`  correct_spender_pct: ${metrics.correct_spender_pct}% (right spender for target count)`);
console.log(`  soul_reaper_window_pct: ${metrics.soul_reaper_window_pct}% (SR inside DT/Reaping)`);
console.log(`  scourge_strike_with_stacks: ${metrics.scourge_strike_with_stacks}% (SS with ≥1 Lesser Ghoul stack)`);
console.log(`  festering_scythe_uptime: ${metrics.festering_scythe_uptime}% (Festering Scythe buff uptime)`);
console.log(`  cooldown_efficiency: ${metrics.cooldown_efficiency}% (DT + Army usage)`);
console.log(`  lesser_ghoul_efficiency: ${metrics.lesser_ghoul_efficiency}% (stacks consumed / gained)`);
