import { readFileSync } from 'fs';
const env = Object.fromEntries(
  readFileSync('.env', 'utf8').split(/\r?\n/).filter(l => l.includes('='))
    .map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()])
);
const clientId = env.VITE_WCL_CLIENT_ID;
const clientSecret = env.VITE_WCL_CLIENT_SECRET;
async function test() {
  const tokenResp = await fetch('https://www.warcraftlogs.com/oauth/token', { method: 'POST', headers: { Authorization: 'Basic ' + Buffer.from(clientId+':'+clientSecret).toString('base64'), 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'grant_type=client_credentials' });
  const tokenData = await tokenResp.json();
  const query = `query { reportData { report(code: "B46zWkK9mFqHtcZf") { masterData { actors { id name type subType } } } } }`;
  const gqlResp = await fetch('https://www.warcraftlogs.com/api/v2/client', { method: 'POST', headers: { Authorization: 'Bearer ' + tokenData.access_token, 'Content-Type': 'application/json' }, body: JSON.stringify({ query }) });
  const data = await gqlResp.json();
  console.log(JSON.stringify(data.data.reportData.report.masterData.actors.filter(a => a.type === "NPC").slice(0, 5), null, 2));
}
test();
