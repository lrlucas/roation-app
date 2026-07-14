// E2E: fetch the Demo rank-1 log and run analyzeDemoMetrics.
// Build first: npx esbuild src/utils/demoWarlockAnalyzerUtils.ts --bundle --format=esm --outfile=tmp_demo.mjs
import { readFileSync } from 'fs';
import { analyzeDemoMetrics } from './tmp_demo.mjs';

const env = Object.fromEntries(
  readFileSync('.env', 'utf8').split(/\r?\n/).filter(l => l.includes('='))
    .map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()])
);
const tok = await fetch('https://www.warcraftlogs.com/oauth/token', {
  method: 'POST',
  headers: { Authorization: 'Basic ' + Buffer.from(env.VITE_WCL_CLIENT_ID + ':' + env.VITE_WCL_CLIENT_SECRET).toString('base64'), 'Content-Type': 'application/x-www-form-urlencoded' },
  body: 'grant_type=client_credentials',
});
const token = (await tok.json()).access_token;
async function gql(q, v) {
  const r = await fetch('https://www.warcraftlogs.com/api/v2/client', {
    method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: q, variables: v }),
  });
  const d = await r.json();
  if (d.errors) throw new Error(JSON.stringify(d.errors));
  return d.data;
}

const code = 'nGtqRhvJYdQxVNj3', fightID = 12, sourceID = 9;
const fight = (await gql(`query{reportData{report(code:"${code}"){fights(fightIDs:[${fightID}]){startTime endTime name}}}}`)).reportData.report.fights[0];

const ev = (await gql(`query($code:String!,$fightID:Int!,$sourceID:Int!){
  reportData{report(code:$code){
    casts: events(fightIDs:[$fightID], dataType: Casts, sourceID:$sourceID, limit:10000){ data }
    buffs: events(fightIDs:[$fightID], dataType: Buffs, sourceID:$sourceID, limit:10000){ data }
    resources: events(fightIDs:[$fightID], dataType: Resources, sourceID:$sourceID, limit:10000){ data }
    summons: events(fightIDs:[$fightID], dataType: Summons, sourceID:$sourceID, limit:10000){ data }
  }}}`, { code, fightID, sourceID })).reportData.report;

const events = {
  casts: ev.casts.data,
  buffs: ev.buffs.data,
  debuffs: [],
  meleeHits: [],
  resources: ev.resources.data,
  summons: ev.summons.data,
};
console.log(`Fight: ${fight.name} (${((fight.endTime - fight.startTime) / 1000).toFixed(0)}s)`);
console.log(`Events: ${events.casts.length} casts, ${events.buffs.length} buffs, ${events.resources.length} resources, ${events.summons.length} summons`);

const metrics = analyzeDemoMetrics(events, fight.startTime, fight.endTime);
console.log('\nDemo metrics (rank 1):');
console.log(JSON.stringify(metrics, null, 2));
