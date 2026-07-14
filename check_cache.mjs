// Inspect apl_analysis_cache docs in Firestore (REST API, same public config as the app)
const KEY = 'AIzaSyCGXS3rpum4UpeaVw7d9hsdLMYb0P82xgI';
const BASE = 'https://firestore.googleapis.com/v1/projects/rotation-app-a3562/databases/(default)/documents';

function fromFs(v) {
  if (v.stringValue !== undefined) return v.stringValue;
  if (v.integerValue !== undefined) return Number(v.integerValue);
  if (v.doubleValue !== undefined) return v.doubleValue;
  if (v.booleanValue !== undefined) return v.booleanValue;
  if (v.nullValue !== undefined) return null;
  if (v.mapValue) return Object.fromEntries(Object.entries(v.mapValue.fields || {}).map(([k, x]) => [k, fromFs(x)]));
  if (v.arrayValue) return (v.arrayValue.values || []).map(fromFs);
  return v;
}

const resp = await fetch(`${BASE}/apl_analysis_cache?key=${KEY}&pageSize=50`);
const json = await resp.json();
if (json.error) { console.log('ERROR:', JSON.stringify(json.error)); process.exit(1); }

const docs = (json.documents || []).map(d => ({
  id: d.name.split('/').pop(),
  updateTime: d.updateTime,
  data: fromFs({ mapValue: { fields: d.fields } }),
}));

docs.sort((a, b) => b.updateTime.localeCompare(a.updateTime));
console.log(`Cache docs found: ${docs.length}\n`);

for (const d of docs) {
  const meta = d.data.meta || {};
  console.log(`── ${d.id}`);
  console.log(`   updated: ${d.updateTime} | fetched_at: ${meta.fetched_at} | boss ${meta.boss_id} ${meta.difficulty} patch ${meta.patch} | n=${(d.data.results || []).length || meta.sample_size || '?'}`);
  const ag = d.data.aggregates || {};
  for (const [k, v] of Object.entries(ag)) {
    if (v && typeof v === 'object') {
      console.log(`   ${k.padEnd(20)} avg=${v.avg} min=${v.min} max=${v.max}`);
    }
  }
  console.log();
}
