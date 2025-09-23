#!/usr/bin/env node

const fs = require('fs');
const fsPromises = require('fs').promises;
const path = require('path');

function slugify(input) {
  return String(input || '')
    .trim()
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 80);
}

async function updateStationsMetadata() {
  const processedDir = path.join(__dirname, '..', 'data', 'processed');
  const publicDir = path.join(__dirname, '..', 'public', 'data', 'processed');
  const eaStationsPath = path.join(__dirname, '..', 'data', 'processed', 'ea-england-stations-with-names.json');
  const metadataPath = path.join(processedDir, 'stations-metadata.json');

  // Load existing metadata if present (to preserve NRW and any manual entries)
  let existing = null;
  try {
    const raw = await fsPromises.readFile(metadataPath, 'utf8');
    existing = JSON.parse(raw);
  } catch {}

  // Load EA stations reference with coordinates
  let eaReference = null;
  try {
    const raw = await fsPromises.readFile(eaStationsPath, 'utf8');
    eaReference = JSON.parse(raw);
  } catch (err) {
    console.error('❌ Could not read EA stations reference JSON:', err.message);
    process.exit(1);
  }

  const eaById = new Map();
  if (eaReference && Array.isArray(eaReference.items)) {
    for (const item of eaReference.items) {
      const ref = String(item.stationReference || item.key || '').trim();
      if (!ref) continue;
      eaById.set(ref, item);
    }
  }

  // Find processed EA station files
  const files = await fsPromises.readdir(processedDir);
  const eaFiles = files
    .filter(f => /^ea\-.+\.json$/.test(f))
    .filter(f => !f.includes('england-stations') && !f.includes('rainfall-stations'));

  console.log(`Found ${eaFiles.length} processed EA station files`);

  // Start with preserved stations from existing metadata (NRW etc.)
  const stations = {};
  if (existing && existing.stations) {
    for (const [key, value] of Object.entries(existing.stations)) {
      // Preserve non-EA special keys or any entries not overwritten later
      stations[key] = value;
    }
  }

  // Build/overwrite EA stations entries from reference
  for (const file of eaFiles) {
    try {
      const raw = await fsPromises.readFile(path.join(processedDir, file), 'utf8');
      const json = JSON.parse(raw);
      const stationId = String(json.station || '').trim();
      if (!stationId) continue;

      const ref = eaById.get(stationId);
      if (!ref || typeof ref.lat !== 'number' || typeof ref.long !== 'number') {
        console.warn(`⚠️ Missing coordinates for ${stationId}, skipping coordinate fields`);
      }

      const nameOnly = (ref && (ref.label || ref.gaugeName)) ? (ref.label || ref.gaugeName) : (json.stationName ? String(json.stationName).replace(/\s*\(.*\)$/, '') : `Station ${stationId}`);
      const label = `${nameOnly} (${stationId})`;
      const provider = 'Environment Agency';
      const country = 'England';
      const gridReference = ref && ref.gridReference ? ref.gridReference : undefined;

      stations[stationId] = {
        key: stationId,
        stationId: stationId,
        name: nameOnly,
        label: label,
        provider: provider,
        country: country,
        region: json.region || 'England',
        coordinates: ref && typeof ref.lat === 'number' && typeof ref.long === 'number'
          ? { lat: ref.lat, lng: ref.long }
          : undefined,
        gridReference: gridReference,
        hasData: Array.isArray(json.data) && json.data.length > 0,
        dataFile: `${slugify(nameOnly)}.json`
      };
    } catch (err) {
      console.warn(`⚠️ Failed to process ${file}: ${err.message}`);
    }
  }

  // Clean undefined fields for consistency
  for (const [key, st] of Object.entries(stations)) {
    Object.keys(st).forEach(k => st[k] === undefined && delete st[k]);
  }

  const output = {
    lastUpdated: new Date().toISOString(),
    description: 'Metadata for rainfall stations currently being processed with accurate coordinates',
    count: Object.keys(stations).length,
    stations
  };

  await fsPromises.mkdir(processedDir, { recursive: true });
  await fsPromises.writeFile(metadataPath, JSON.stringify(output, null, 2));
  console.log(`💾 Updated ${metadataPath}`);

  await fsPromises.mkdir(publicDir, { recursive: true });
  await fsPromises.writeFile(path.join(publicDir, 'stations-metadata.json'), JSON.stringify(output, null, 2));
  console.log(`🌐 Updated ${path.join(publicDir, 'stations-metadata.json')}`);
}

if (require.main === module) {
  updateStationsMetadata().catch(err => {
    console.error('❌ Failed to update stations metadata:', err);
    process.exit(1);
  });
}

module.exports = { updateStationsMetadata };


