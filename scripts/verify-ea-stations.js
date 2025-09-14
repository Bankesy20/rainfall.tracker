const fs = require('fs').promises;
const path = require('path');

const CONCURRENCY = 8;
const TIMEOUT_MS = 8000;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function head(url) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { method: 'HEAD', redirect: 'follow', signal: controller.signal, headers: { 'User-Agent': 'rainfall-stations-verifier/1.0' } });
    return res.status;
  } catch (e) {
    return 0;
  } finally {
    clearTimeout(t);
  }
}

function buildMapUrl(lat, lon) {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  const dx = 0.2, dy = 0.2; // ~small bbox
  const ext = `${(lon - dx).toFixed(6)},${(lat - dy).toFixed(6)},${(lon + dx).toFixed(6)},${(lat + dy).toFixed(6)}`;
  return `https://check-for-flooding.service.gov.uk/river-and-sea-levels?v=map-live&lyr=mv,rf&ext=${ext}`;
}

async function verifyStation(station) {
  const out = { ...station };
  out.mapUrl = buildMapUrl(station.lat, station.long);

  const candidates = Array.isArray(station.stationPageCandidates) ? station.stationPageCandidates : [];
  for (const url of candidates) {
    const status = await head(url);
    if (status >= 200 && status < 400) {
      out.humanPage = url;
      break;
    }
    await sleep(50);
  }
  delete out.stationPageCandidates;
  return out;
}

async function run() {
  const srcPath = path.join(__dirname, '..', 'data', 'processed', 'ea-rainfall-stations.json');
  const outPath = path.join(__dirname, '..', 'data', 'processed', 'ea-rainfall-stations.checked.json');
  const raw = await fs.readFile(srcPath, 'utf8');
  const parsed = JSON.parse(raw);
  const items = Array.isArray(parsed.items) ? parsed.items : parsed;

  const queue = items.slice();
  const results = new Array(items.length);
  let index = 0;

  async function worker() {
    while (true) {
      const i = index++;
      if (i >= items.length) break;
      const st = items[i];
      results[i] = await verifyStation(st);
    }
  }

  const workers = Array.from({ length: CONCURRENCY }, worker);
  await Promise.all(workers);

  const output = { lastVerified: new Date().toISOString(), count: results.length, items: results };
  await fs.writeFile(outPath, JSON.stringify(output, null, 2));
  console.log(`Wrote verified stations to ${outPath}`);
}

if (require.main === module) {
  run().catch(e => { console.error(e); process.exit(1); });
}
