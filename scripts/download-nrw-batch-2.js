#!/usr/bin/env node

/**
 * NRW Batch Downloader 2 - Downloads second half of Welsh stations
 * Used by GitHub Actions workflows for Welsh rainfall data
 */

const fs = require('fs');
const fsPromises = require('fs').promises;
const path = require('path');
const { spawn } = require('child_process');

const DATA_DIR = path.join(__dirname, '..', 'data');
const RAW_DIR = path.join(DATA_DIR, 'raw');
const PROCESSED_DIR = path.join(DATA_DIR, 'processed');
const PUBLIC_PROCESSED_DIR = path.join(__dirname, '..', 'public', 'data', 'processed');

async function ensureDirectoryExists(directoryPath) {
  try {
    await fsPromises.mkdir(directoryPath, { recursive: true });
  } catch (_) {
    // ignore
  }
}

async function fetchText(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      ...(options.headers || {})
    }
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  return await response.text();
}

async function fetchBuffer(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/csv,application/octet-stream,*/*',
      'Accept-Language': 'en-US,en;q=0.9',
      ...(options.headers || {})
    }
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

function loadParameterIds() {
  const parameterIdsPath = path.join(__dirname, '..', 'station_parameter_ids.json');
  try {
    const raw = fs.readFileSync(parameterIdsPath, 'utf8');
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(`Failed to load parameter IDs from ${parameterIdsPath}: ${error.message}`);
  }
}

async function runProcessorOnCsv(csvPath, outputFileName) {
  return new Promise((resolve, reject) => {
    const child = spawn('node', ['scripts/process-nrw-csv.js', csvPath, outputFileName], {
      stdio: 'inherit',
      cwd: path.join(__dirname, '..')
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Processor exited with code ${code}`));
      }
    });

    child.on('error', reject);
  });
}

async function processStation(station, parameterIds) {
  try {
    console.log(`\n🚀 Processing station: ${station.station_name} (${station.station_id})`);
    
    const stationId = station.station_id.toString();
    const stationUrl = `https://rivers-and-seas.naturalresources.wales/station/${stationId}`;
    
    // 1) Get parameter ID from pre-loaded data
    const parameterInfo = parameterIds[stationId];
    if (!parameterInfo || !parameterInfo.parameter_id) {
      throw new Error(`No parameter ID found for station ${stationId}`);
    }
    const paramId = parameterInfo.parameter_id.toString();
    console.log(`🔍 Using parameter ID: ${paramId}`);

    // 2) Calculate date range - support env vars for scheduled runs
    // Default to last 4 days for regular updates (new data will append)
    const envFrom = (process.env.NRW_FROM || '').trim();
    const envTo = (process.env.NRW_TO || '').trim();
    const envDays = (process.env.NRW_DAYS || '').trim();
    
    const isYmd = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s);
    const todayYmd = () => new Date().toISOString().slice(0, 10);
    const minusDays = (d, days) => {
      const dt = new Date(d + 'T00:00:00Z');
      dt.setUTCDate(dt.getUTCDate() - days);
      return dt.toISOString().slice(0, 10);
    };
    
    let fromStr, toStr;
    if (isYmd(envFrom)) {
      fromStr = envFrom;
      toStr = isYmd(envTo) ? envTo : todayYmd();
    } else if (envDays) {
      const days = parseInt(envDays, 10);
      if (days > 0) {
        toStr = isYmd(envTo) ? envTo : todayYmd();
        fromStr = minusDays(toStr, days);
      } else {
        // Invalid days, use default (4 days)
        const toDate = new Date();
        const fromDate = new Date();
        fromDate.setUTCDate(toDate.getUTCDate() - 4);
        fromStr = fromDate.toISOString().split('T')[0];
        toStr = toDate.toISOString().split('T')[0];
      }
    } else {
      // Default: last 4 days for regular updates (data appends automatically via processor)
      const toDate = new Date();
      const fromDate = new Date();
      fromDate.setUTCDate(toDate.getUTCDate() - 4);
      fromStr = fromDate.toISOString().split('T')[0];
      toStr = toDate.toISOString().split('T')[0];
    }
    
    console.log(`📅 Date range: ${fromStr} to ${toStr}`);
    
    // 3) Build CSV URL using the NRW API endpoint
    const base = new URL(`/Graph/GetHistoricalCsv?location=${encodeURIComponent(stationId)}&parameter=${encodeURIComponent(paramId)}`, stationUrl);
    if (fromStr && toStr) {
      base.searchParams.set('from', fromStr);
      base.searchParams.set('to', toStr);
    }
    const csvUrl = base.toString();
    
    console.log(`📊 CSV URL: ${csvUrl}`);

    // 4) Download CSV
    const now = new Date();
    const isoDate = now.toISOString().split('T')[0];
    const csvFileName = `nrw-${stationId}-${isoDate}.csv`;
    const csvPath = path.join(RAW_DIR, csvFileName);
    
    const csvBuffer = await fetchBuffer(csvUrl);
    await fsPromises.writeFile(csvPath, csvBuffer);
    console.log(`💾 Downloaded CSV: ${csvFileName} (${csvBuffer.length} bytes)`);

    // 5) Process CSV
    const outputFileName = `wales-${stationId}.json`;
    await runProcessorOnCsv(csvPath, outputFileName);
    console.log(`⚙️  Processed CSV to: ${outputFileName}`);

    // 6) Clean up raw CSV file
    try {
      await fsPromises.unlink(csvPath);
      console.log(`🗑️  Cleaned up raw CSV file`);
    } catch (error) {
      console.log(`⚠️  Could not clean up CSV file: ${error.message}`);
    }

    console.log(`✅ Station ${station.station_name} complete!`);
    
    return {
      stationId: stationId,
      stationName: station.station_name,
      region: 'Wales',
      success: true,
      outputFile: outputFileName
    };
    
  } catch (error) {
    console.error(`❌ Error processing station ${station.station_name}:`, error.message);
    return {
      stationId: station.station_id.toString(),
      stationName: station.station_name,
      region: 'Wales',
      success: false,
      error: error.message
    };
  }
}

async function downloadBatch2() {
  console.log(`🚀 Starting NRW Batch 2 download...`);
  
  await ensureDirectoryExists(RAW_DIR);
  await ensureDirectoryExists(PROCESSED_DIR);
  await ensureDirectoryExists(PUBLIC_PROCESSED_DIR);
  
  try {
    // Load parameter IDs
    const parameterIds = loadParameterIds();
    console.log(`📋 Loaded parameter IDs for ${Object.keys(parameterIds).length} stations`);
    
    // Load Welsh stations
    const stationsJsonPath = path.join(__dirname, '..', 'welsh_rainfall_stations_with_coords.json');
    const raw = fs.readFileSync(stationsJsonPath, 'utf8');
    const allStations = JSON.parse(raw);
    
    // Filter stations that have parameter IDs and exclude Maencloghog (1099) as it's handled separately
    const excludedIds = new Set(['1099']);
    const validStations = allStations.filter(station => {
      const stationId = station.station_id.toString();
      return station.station_id && 
             station.station_name && 
             !excludedIds.has(stationId) &&
             parameterIds[stationId];
    });
    
    console.log(`📊 Total Welsh stations: ${allStations.length}`);
    console.log(`📊 Valid stations with parameter IDs (excluding Maencloghog): ${validStations.length}`);
    
    // Split into two batches - second half
    const batchSize = Math.ceil(validStations.length / 2);
    const batch2Stations = validStations.slice(batchSize);
    
    console.log(`📍 Batch 2 stations: ${batch2Stations.length}`);
    console.log(`📍 Range: ${batch2Stations[0]?.station_name} → ${batch2Stations[batch2Stations.length - 1]?.station_name}`);
    
    if (batch2Stations.length === 0) {
      console.log('⚠️  No stations found for batch 2, exiting successfully');
      return;
    }
    
    const results = [];
    let successCount = 0;
    let errorCount = 0;
    
    // Process each station sequentially to avoid overwhelming the server
    for (const station of batch2Stations) {
      const result = await processStation(station, parameterIds);
      results.push(result);
      
      if (result.success) {
        successCount++;
      } else {
        errorCount++;
      }
      
      // Polite delay with small jitter between stations
      const jitter = Math.floor(Math.random() * 1000); // 0-1000ms
      const delay = 3000 + jitter; // 3-4 seconds
      await new Promise(resolve => setTimeout(resolve, delay));
    }
    
    // Summary
    console.log(`\n🎯 NRW BATCH 2 SUMMARY:`);
    console.log(`✅ Successful: ${successCount}`);
    console.log(`❌ Failed: ${errorCount}`);
    console.log(`📊 Total stations: ${batch2Stations.length}`);
    
    console.log(`\n📋 DETAILED RESULTS:`);
    results.forEach(result => {
      if (result.success) {
        console.log(`✅ ${result.stationName} (${result.stationId}) - ${result.region}`);
      } else {
        console.log(`❌ ${result.stationName} (${result.stationId}) - ${result.region}: ${result.error}`);
      }
    });
    
    console.log(`\n✅ NRW Batch 2 download complete!`);
    
  } catch (error) {
    console.error('❌ Error in batch download:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  downloadBatch2();
}

module.exports = { downloadBatch2 };
