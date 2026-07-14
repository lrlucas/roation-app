// Temporary script: verify real ability IDs in a current top Unholy DK log
import { readFileSync } from 'fs';

const env = Object.fromEntries(
  readFileSync('.env', 'utf8')
    .split(/\r?\n/)
    .filter(l => l.includes('='))
    .map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()])
);
const clientId = env.VITE_WCL_CLIENT_ID;
const clientSecret = env.VITE_WCL_CLIENT_SECRET;

async function gql(token, query, variables) {
  const resp = await fetch('https://www.warcraftlogs.com/api/v2/client', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  });
  const data = await resp.json();
  if (data.errors) throw new Error(JSON.stringify(data.errors));
  return data.data;
}

const tokenResp = await fetch('https://www.warcraftlogs.com/oauth/token', {
  method: 'POST',
  headers: {
    Authorization: 'Basic ' + Buffer.from(clientId + ':' + clientSecret).toString('base64'),
    'Content-Type': 'application/x-www-form-urlencoded',
  },
  body: 'grant_type=client_credentials',
});
const token = (await tokenResp.json()).access_token;

// Find the latest zone with rankings (latest expansion raid)
const zonesData = await gql(token, `query {
  worldData { expansions { id name zones { id name encounters { id name } } } }
}`);
const expansions = zonesData.worldData.expansions;
console.log('Expansions:', expansions.map(e => `${e.id}:${e.name}`).join(', '));
const latestExp = expansions[0];
const raidZone =
  latestExp.zones.find(z => z.encounters.length >= 4 && !/mythic|beta|dungeon/i.test(z.name)) ||
  latestExp.zones[0];
console.log(`Using zone: ${raidZone.name} (exp ${latestExp.name})`);
const encounterId = raidZone.encounters[0].id;
console.log(`Using encounter: ${raidZone.encounters[0].name} (${encounterId})`);

const rData = await gql(token, `query {
  worldData { encounter(id: ${encounterId}) {
    characterRankings(className: "DeathKnight", specName: "Unholy")
  } }
}`);
const top = rData.worldData.encounter.characterRankings.rankings[0];
const code = top.report.code;
const fightID = top.report.fightID;
console.log(`Top log: ${top.name} — report ${code}, fight ${fightID}`);

// masterData abilities for name lookup + player actor id
const md = await gql(token, `query {
  reportData { report(code: "${code}") {
    masterData { abilities { gameID name } actors(type: "Player") { id name subType } }
  } }
}`);
const abilityNames = new Map(md.reportData.report.masterData.abilities.map(a => [a.gameID, a.name]));
const actors = md.reportData.report.masterData.actors;
const player =
  actors.find(a => a.name === top.name) ||
  actors.find(a => a.subType === 'DeathKnight');
console.log(`Player: ${player.name} (${player.subType}) sourceID: ${player.id}`);

const ev = await gql(token, `query {
  reportData { report(code: "${code}") {
    casts: events(fightIDs: [${fightID}], dataType: Casts, sourceID: ${player.id}, limit: 10000) { data }
    buffs: events(fightIDs: [${fightID}], dataType: Buffs, sourceID: ${player.id}, limit: 10000) { data }
    debuffs: events(fightIDs: [${fightID}], dataType: Debuffs, sourceID: ${player.id}, hostilityType: Enemies, limit: 10000) { data }
  } }
}`);
const rep = ev.reportData.report;

const INTEREST = /putrefy|dread plague|dark transformation|sudden doom|virulent|death coil|epidemic|necrotic coil|graveyard|festering|scourge strike|vampiric strike|soul reaper|army of the dead|outbreak|apocalypse|raise abomination/i;

function summarize(label, events) {
  const counts = new Map();
  for (const e of events) {
    const id = e.abilityGameID;
    const key = `${id}|${e.type}`;
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  console.log(`\n=== ${label} ===`);
  const rows = [...counts.entries()]
    .map(([key, n]) => {
      const [id, type] = key.split('|');
      return { id: Number(id), type, n, name: abilityNames.get(Number(id)) || '?' };
    })
    .filter(r => INTEREST.test(r.name))
    .sort((a, b) => a.name.localeCompare(b.name) || a.type.localeCompare(b.type));
  for (const r of rows) console.log(`${r.id}\t${r.type}\tx${r.n}\t${r.name}`);
}

summarize('CASTS', rep.casts.data);
summarize('BUFFS (source=player)', rep.buffs.data);
summarize('DEBUFFS (enemies)', rep.debuffs.data);
