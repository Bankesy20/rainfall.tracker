const fs = require('fs').promises;
const path = require('path');

async function fetchAllEaRainfallStations() {
  const results = [];
  const limit = 10000; // generous upper bound, EA API caps as needed
  const url = `https://environment.data.gov.uk/flood-monitoring/id/stations?parameter=rainfall&_limit=${limit}`;

  const res = await fetch(url, {
    headers: {
      'Accept': 'application/json'
    }
  });
  if (!res.ok) throw new Error(`EA API HTTP ${res.status}`);
  const json = await res.json();
  const items = Array.isArray(json.items) ? json.items : [];

  for (const s of items) {
    // Filter to rainfall measures and pick a canonical one (prefer 15-min, else 1-hour)
    const rainfallMeasures = (s.measures || []).filter(m => (m.parameter || '').toLowerCase() === 'rainfall');
    if (rainfallMeasures.length === 0) continue;

    const byPeriodScore = (m) => (m.period === 900 ? 2 : m.period === 3600 ? 1 : 0);
    const canonical = rainfallMeasures.reduce((best, m) => (byPeriodScore(m) > byPeriodScore(best) ? m : best), rainfallMeasures[0]);

    // Core identifiers and URLs
    const label = s.label || s.stationReference || s.notation || 'Rainfall station';
    const stationId = s.stationReference || s.notation || (s['@id'] || '').split('/').pop();
    const idSafe = stationId || label.replace(/\s+/g, '-').toLowerCase();
    const apiUrl = `https://environment.data.gov.uk/flood-monitoring/id/stations/${encodeURIComponent(idSafe)}.json`;
    const measureUrl = canonical['@id'];
    const readingsJson = `${measureUrl}/readings`;
    const readingsCsv = `${measureUrl}/readings.csv`;

    // Public page candidates (may 404 for some stations). We include a rainfall-first candidate.
    const stationPageCandidates = [
      `https://check-for-flooding.service.gov.uk/rainfall-station/${encodeURIComponent(idSafe)}`,
      `https://check-for-flooding.service.gov.uk/rainfall/station/${encodeURIComponent(idSafe)}`,
      `https://check-for-flooding.service.gov.uk/station/${encodeURIComponent(idSafe)}?parameter=rainfall`,
      `https://check-for-flooding.service.gov.uk/station/${encodeURIComponent(idSafe)}`
    ];

    results.push({
      key: idSafe,
      label,
      provider: 'EA',
      stationReference: stationId,
      apiUrl,
      stationPageCandidates,
      lat: s.lat,
      long: s.long,
      gridReference: s.gridReference,
      rainfallMeasure: {
        id: measureUrl,
        period: canonical.period,
        unitName: canonical.unitName,
        qualifier: canonical.qualifier
      },
      readings: {
        json: readingsJson,
        csv: readingsCsv
      }
    });
  }

  return results;
}

async function main() {
  try {
    const stations = await fetchAllEaRainfallStations();
    const outDir = path.join(__dirname, '..', 'data', 'processed');
    await fs.mkdir(outDir, { recursive: true });
    const outPath = path.join(outDir, 'ea-rainfall-stations.json');
    await fs.writeFile(outPath, JSON.stringify({
      lastUpdated: new Date().toISOString(),
      count: stations.length,
      items: stations
    }, null, 2));
    console.log(`Wrote ${stations.length} EA rainfall stations to ${outPath}`);
  } catch (e) {
    console.error('Failed to fetch EA stations:', e.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}


