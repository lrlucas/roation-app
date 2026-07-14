// Verify the new fetch logic end-to-end against the real Imperator log:
// pagination, CombatantInfo, Resources, Summons. Mirrors fetchPlayerEvents.
import { readFileSync } from 'fs';

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
  const d = await resp.json();
  if (d.errors) throw new Error(JSON.stringify(d.errors));
  return d.data;
}

const code = 'Gbc3x9zTtHBjyZWq', fightID = 41, sourceID = 20;
const VIRULENT = 191587, DREAD = 1240996;
const fightData = await gql(`query{reportData{report(code:"${code}"){fights(fightIDs:[${fightID}]){startTime endTime}}}}`);
const fight = fightData.reportData.report.fights[0];

async function fetchRemainingPages(dataType, argsString, fromTimestamp, endTime) {
  const all = [];
  let pageStart = fromTimestamp;
  for (let i = 0; i < 50 && pageStart != null; i++) {
    const q = `query($code:String!,$fightID:Int!,$start:Float!,$end:Float!){
      reportData{report(code:$code){
        events(fightIDs:[$fightID], dataType:${dataType}, startTime:$start, endTime:$end, limit:10000, ${argsString}){ data nextPageTimestamp }
      }}}`;
    const data = await gql(q, { code, fightID, start: pageStart, end: endTime });
    const ev = data.reportData?.report?.events;
    const pageData = Array.isArray(ev?.data) ? ev.data : (ev?.data?.data || []);
    all.push(...pageData);
    pageStart = ev?.nextPageTimestamp ?? null;
  }
  return all;
}

const debuffFilter = `ability.id in (${VIRULENT}, ${DREAD})`;
const q = `query($code:String!,$fightID:Int!,$sourceID:Int!,$debuffFilter:String!){
  reportData{report(code:$code){
    combatantInfo: events(fightIDs:[$fightID], dataType: CombatantInfo, sourceID:$sourceID){ data }
    casts: events(fightIDs:[$fightID], dataType: Casts, sourceID:$sourceID, limit:10000){ data nextPageTimestamp }
    buffs: events(fightIDs:[$fightID], dataType: Buffs, sourceID:$sourceID, limit:10000){ data nextPageTimestamp }
    debuffs: events(fightIDs:[$fightID], dataType: Debuffs, hostilityType: Enemies, filterExpression:$debuffFilter, limit:10000){ data nextPageTimestamp }
    damage: events(fightIDs:[$fightID], dataType: DamageDone, sourceID:$sourceID, limit:10000){ data nextPageTimestamp }
    resources: events(fightIDs:[$fightID], dataType: Resources, sourceID:$sourceID, limit:10000){ data nextPageTimestamp }
    summons: events(fightIDs:[$fightID], dataType: Summons, sourceID:$sourceID, limit:10000){ data nextPageTimestamp }
  }}}`;
const rep = (await gql(q, { code, fightID, sourceID, debuffFilter })).reportData.report;

async function collectPaged(block, dataType, argsString) {
  const firstPage = Array.isArray(block?.data) ? block.data : (block?.data?.data || []);
  const next = block?.nextPageTimestamp ?? null;
  if (next == null) return firstPage;
  const rest = await fetchRemainingPages(dataType, argsString, next, fight.endTime);
  return [...firstPage, ...rest];
}

const srcArgs = `sourceID: ${sourceID}`;
const debuffArgs = `hostilityType: Enemies, filterExpression: ${JSON.stringify(debuffFilter)}`;
const [casts, buffs, debuffsRaw, damage, resources, summons] = await Promise.all([
  collectPaged(rep.casts, 'Casts', srcArgs),
  collectPaged(rep.buffs, 'Buffs', srcArgs),
  collectPaged(rep.debuffs, 'Debuffs', debuffArgs),
  collectPaged(rep.damage, 'DamageDone', srcArgs),
  collectPaged(rep.resources, 'Resources', srcArgs),
  collectPaged(rep.summons, 'Summons', srcArgs),
]);

console.log('--- PAGINATION (first-page sizes vs total) ---');
console.log('damage first page:', (rep.damage.data?.length ?? rep.damage.data?.data?.length), '| nextPage:', rep.damage.nextPageTimestamp, '| TOTAL after paging:', damage.length);
console.log('casts total:', casts.length, '| buffs total:', buffs.length);

console.log('\n--- DEBUFFS (player only) ---');
const debuffs = debuffsRaw.filter(e => e.sourceID === sourceID);
console.log('debuffs (player):', debuffs.length, '| virulent:', debuffs.filter(e => e.abilityGameID === VIRULENT).length, '| dread:', debuffs.filter(e => e.abilityGameID === DREAD).length);

console.log('\n--- RESOURCES ---');
console.log('resource events:', resources.length);
const wasteEvents = resources.filter(e => (e.waste || 0) > 0);
console.log('events with waste>0:', wasteEvents.length, '| total waste:', resources.reduce((s, e) => s + (e.waste || 0), 0));
const typeCounts = {};
resources.forEach(e => { typeCounts[e.resourceChangeType] = (typeCounts[e.resourceChangeType] || 0) + 1; });
console.log('resourceChangeType counts:', JSON.stringify(typeCounts));

console.log('\n--- SUMMONS ---');
console.log('summon events:', summons.length);
const summonByAbility = {};
summons.forEach(e => { summonByAbility[e.abilityGameID] = (summonByAbility[e.abilityGameID] || 0) + 1; });
console.log('summons by abilityGameID:', JSON.stringify(summonByAbility));

console.log('\n--- COMBATANT ---');
const ci = (rep.combatantInfo.data || [])[0] || {};
const gear = Array.isArray(ci.gear) ? ci.gear : [];
const ilvls = gear.map(g => g?.itemLevel).filter(n => typeof n === 'number' && n > 0);
const gearIlvl = ilvls.length ? Math.round(ilvls.reduce((a, b) => a + b, 0) / ilvls.length) : null;
console.log('specID:', ci.specID, '| hasteMelee:', ci.hasteMelee, '| gearIlvl:', gearIlvl, '| talentTree nodes:', (ci.talentTree || []).length);
