#!/usr/bin/env node

/**
 * Add Welsh NRW station coordinates to stations metadata
 * This script processes the Welsh stations JSON and adds them to the stations-metadata.json file
 */

const fs = require('fs').promises;
const path = require('path');

function slugify(input) {
  return (input || '').toString().trim().toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 80);
}

async function addWelshStationsToMetadata() {
  console.log('🏴󠁧󠁢󠁷󠁬󠁳󠁿 Adding Welsh NRW stations to metadata...');
  
  const processedDir = path.join(__dirname, '..', 'data', 'processed');
  const metadataPath = path.join(processedDir, 'stations-metadata.json');
  const welshStationsPath = path.join(__dirname, '..', 'welsh_rainfall_stations_with_coords.json');
  
  // Load existing metadata
  let existing = { stations: {} };
  try {
    const raw = await fs.readFile(metadataPath, 'utf8');
    existing = JSON.parse(raw);
  } catch (error) {
    console.log('📄 No existing metadata found, creating new file');
  }
  
  // Load Welsh stations
  let welshStations = [];
  try {
    const raw = await fs.readFile(welshStationsPath, 'utf8');
    welshStations = JSON.parse(raw);
  } catch (error) {
    console.error('❌ Could not read Welsh stations JSON:', error.message);
    process.exit(1);
  }
  
  console.log(`📊 Found ${welshStations.length} Welsh stations`);
  
  // Process Welsh stations
  let addedCount = 0;
  let updatedCount = 0;
  
  for (const station of welshStations) {
    const stationId = station.station_id.toString();
    const stationName = station.station_name.replace(' raingauge', '').trim();
    const label = `${stationName} (${stationId})`;
    
    // Check if station already exists
    const existingStation = existing.stations[stationId];
    const isNew = !existingStation;
    
    // Create blob key using EA pattern: {name}-{stationId}
    let cleanName = stationName
      .replace(/\s*\([^)]*\)$/, '') // Remove (ID) suffix
      .replace(/\s+raingauge$/i, '') // Remove "raingauge" suffix
      .replace(/\s+school$/i, '') // Remove "school" suffix
      .trim();
    
    function slugify(input) {
      return (input || '').toString().trim().toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
    }
    
    let blobKey = slugify(cleanName);
    if (!blobKey.endsWith(`-${stationId}`)) {
      blobKey = `${blobKey}-${stationId}`;
    }

    // Add/update station metadata
    existing.stations[stationId] = {
      key: stationId,
      stationId: stationId,
      name: stationName,
      label: label,
      provider: 'Natural Resources Wales',
      country: 'Wales',
      region: 'Wales',
      coordinates: {
        lat: station.latitude,
        lng: station.longitude
      },
      gridReference: station.national_grid_reference,
      status: station.status_text,
      waterBody: station.water_body,
      catchment: station.catchment,
      dateOpened: station.date_opened,
      hasData: true, // Welsh stations have data when uploaded
      dataFile: `wales-${stationId}.json`,
      blobKey: blobKey  // ✅ Add blobKey for API lookup
    };
    
    if (isNew) {
      addedCount++;
    } else {
      updatedCount++;
    }
  }
  
  // Update metadata file
  const output = {
    lastUpdated: new Date().toISOString(),
    description: 'Metadata for rainfall stations currently being processed with accurate coordinates',
    count: Object.keys(existing.stations).length,
    stations: existing.stations
  };
  
  await fs.mkdir(processedDir, { recursive: true });
  await fs.writeFile(metadataPath, JSON.stringify(output, null, 2));
  
  // Also copy to public directory
  const publicMetadataPath = path.join(__dirname, '..', 'public', 'data', 'processed', 'stations-metadata.json');
  await fs.mkdir(path.dirname(publicMetadataPath), { recursive: true });
  await fs.writeFile(publicMetadataPath, JSON.stringify(output, null, 2));
  
  console.log(`✅ Metadata updated successfully!`);
  console.log(`📊 Total stations: ${output.count}`);
  console.log(`➕ Added: ${addedCount} Welsh stations`);
  console.log(`🔄 Updated: ${updatedCount} Welsh stations`);
  console.log(`📁 Saved to: ${metadataPath}`);
  console.log(`📁 Copied to: ${publicMetadataPath}`);
}

// Run if called directly
if (require.main === module) {
  addWelshStationsToMetadata()
    .then(() => {
      console.log('Welsh stations metadata update completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Welsh stations metadata update failed:', error);
      process.exit(1);
    });
}

module.exports = addWelshStationsToMetadata;
