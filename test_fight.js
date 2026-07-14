import { readFileSync } from 'fs';
const env = Object.fromEntries(
  readFileSync('.env', 'utf8').split(/\r?\n/).filter(l => l.includes('='))
    .map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()])
);
const clientId = env.VITE_WCL_CLIENT_ID;
const clientSecret = env.VITE_WCL_CLIENT_SECRET;

async function test() {
  const tokenResp = await fetch('https://www.warcraftlogs.com/oauth/token', {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + Buffer.from(clientId + ':' + clientSecret).toString('base64'),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials'
  });
  const tokenData = await tokenResp.json();
  const token = tokenData.access_token;
  
  const rQuery = 'query { worldData { encounter(id: 2902) { characterRankings(className: "DeathKnight", specName: "Unholy") } } }';
  const rResp = await fetch('https://www.warcraftlogs.com/api/v2/client', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: rQuery })
  });
  const rData = await rResp.json();
  const parse = rData.data.worldData.encounter.characterRankings.rankings[0];
  
  const query = `query { reportData { report(code: "${parse.report.code}") { fights(fightIDs: [${parse.report.fightID}]) { startTime } events(fightIDs: [${parse.report.fightID}], dataType: Casts, limit: 1) { data } } } }`;
  const gqlResp = await fetch('https://www.warcraftlogs.com/api/v2/client', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query })
  });
  const gqlData = await gqlResp.json();
  console.log('fight startTime:', gqlData.data.reportData.report.fights[0].startTime);
  console.log('first event timestamp:', gqlData.data.reportData.report.events.data[0].timestamp);
}
test();
