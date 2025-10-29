#!/usr/bin/env node

/**
 * NRW Batch Downloader 1 - Downloads first half of Welsh stations
 * Used by GitHub Actions workflows for Welsh rainfall data
 */

const fs = require('fs');
const fsPromises = require('fs').promises;
const path = require('path');
const { spawn } = require('child_process');

// Import the base functionality from the NRW downloader
const nrwDownloader = require('./download-nrw');

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

async function fetchText(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  return await response.text();
}

async function downloadFile(url, filePath) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  
  const buffer = await response.arrayBuffer();
  await fsPromises.writeFile(filePath, Buffer.from(buffer));
}

async function extractParameterIdFromHtml(html) {
  // Extract parameter ID from the JavaScript initialization code
  // Look for: new NRW.Pages.StationDetails({ "parameters": [{ "id": 10095, "typeId": 2, ... }] })
  
  const patterns = [
    // Pattern 1: Look for StationDetails initialization
    /new\s+NRW\.Pages\.StationDetails\s*\(\s*({[^}]+"parameters"[^}]+})\s*\)/i,
    // Pattern 2: Look for parameters array directly
    /"parameters"\s*:\s*\[([^\]]+)\]/i,
    // Pattern 3: Look for page variable assignment
    /var\s+page\s*=\s*new\s+NRW\.Pages\.StationDetails\s*\(([^)]+)\)/i
  ];
  
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match) {
      try {
        // Try to extract the parameters section
        let jsonStr = match[1];
        
        // If we got the full object, extract just the parameters
        if (jsonStr.includes('"parameters"')) {
          const paramMatch = jsonStr.match(/"parameters"\s*:\s*\[([^\]]+)\]/);
          if (paramMatch) {
            jsonStr = '[' + paramMatch[1] + ']';
          }
        } else {
          // We got just the parameters array content
          jsonStr = '[' + jsonStr + ']';
        }
        
        // Clean up the JSON string
        jsonStr = jsonStr
          .replace(/'/g, '"')  // Replace single quotes with double quotes
          .replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":')  // Quote unquoted keys
          .replace(/,\s*}/g, '}')  // Remove trailing commas
          .replace(/,\s*]/g, ']'); // Remove trailing commas in arrays
        
        const parameters = JSON.parse(jsonStr);
        
        // Find rainfall parameter (typeId: 2)
        const rainfallParam = parameters.find(p => p.typeId === 2);
        if (rainfallParam && rainfallParam.id) {
          return rainfallParam.id.toString();
        }
      } catch (e) {
        console.log(`Failed to parse parameters JSON: ${e.message}`);
        continue;
      }
    }
  }
  
  // Fallback: look for parameter IDs in the HTML more broadly
  const paramIdMatches = html.match(/"id"\s*:\s*(\d+)[^}]*"typeId"\s*:\s*2/g);
  if (paramIdMatches && paramIdMatches.length > 0) {
    const match = paramIdMatches[0].match(/"id"\s*:\s*(\d+)/);
    if (match) {
      return match[1];
    }
  }
  
  return null;
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

async function processStation(station) {
  try {
    console.log(`\n🚀 Processing station: ${station.station_name} (${station.station_id})`);
    
    const stationId = station.station_id.toString();
    // Use the standard NRW station URL pattern instead of the URL from the JSON
    const stationUrl = `https://rivers-and-seas.naturalresources.wales/station/${stationId}`;
    
    // 1) Fetch station HTML
    const html = await fetchText(stationUrl);
    console.log(`📄 Fetched station HTML (${html.length} chars)`);

    // 2) Extract parameter ID from HTML (each station has unique parameter ID)
    const paramId = await extractParameterIdFromHtml(html);
    if (!paramId) {
      throw new Error(`Could not extract parameter ID for station ${stationId}`);
    }
    console.log(`🔍 Found parameter ID: ${paramId}`);
    
    // 3) Calculate date range - support env vars for scheduled runs
    // Default to last 12 months (1 year) for initial backlog
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
        // Invalid days, use default (last year)
        const toDate = new Date();
        const fromDate = new Date();
        fromDate.setFullYear(toDate.getFullYear() - 1);
        fromStr = fromDate.toISOString().split('T')[0];
        toStr = toDate.toISOString().split('T')[0];
      }
    } else {
      // Default: last 12 months (1 year) for initial backlog
      const toDate = new Date();
      const fromDate = new Date();
      fromDate.setFullYear(toDate.getFullYear() - 1);
      fromStr = fromDate.toISOString().split('T')[0];
      toStr = toDate.toISOString().split('T')[0];
    }
    
    // 4) Build CSV URL using the NRW API endpoint
    const base = new URL(`/Graph/GetHistoricalCsv?location=${encodeURIComponent(stationId)}&parameter=${encodeURIComponent(paramId)}`, stationUrl);
    if (fromStr && toStr) {
      base.searchParams.set('from', fromStr);
      base.searchParams.set('to', toStr);
    }
    const csvUrl = base.toString();
    
    console.log(`📊 CSV URL: ${csvUrl}`);

    // 5) Download CSV
    const now = new Date();
    const isoDate = now.toISOString().split('T')[0];
    const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const csvFileName = `nrw-${stationId}-${timestamp}.csv`;
    const csvPath = path.join(RAW_DIR, csvFileName);
    
    await downloadFile(csvUrl, csvPath);
    console.log(`💾 Downloaded CSV: ${csvFileName}`);

    // 6) Process CSV
    const outputFileName = `wales-${stationId}.json`;
    await runProcessorOnCsv(csvPath, outputFileName);
    console.log(`⚙️  Processed CSV to: ${outputFileName}`);

    // 7) Clean up raw CSV file
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

async function downloadBatch1() {
  console.log(`🚀 Starting NRW Batch 1 download...`);
  
  await ensureDirectoryExists(RAW_DIR);
  await ensureDirectoryExists(PROCESSED_DIR);
  await ensureDirectoryExists(PUBLIC_PROCESSED_DIR);
  
  // Load Welsh stations
  const stationsJsonPath = path.join(__dirname, '..', 'welsh_rainfall_stations_with_coords.json');
  
  try {
    const raw = fs.readFileSync(stationsJsonPath, 'utf8');
    const allStations = JSON.parse(raw);
    
    // Exclude Maencloghog (1099) as it's handled separately
    const excludedIds = new Set(['1099']);
    const validStations = allStations.filter(station => {
      return station.station_id && station.station_name && !excludedIds.has(station.station_id.toString());
    });
    
    console.log(`📊 Total Welsh stations: ${allStations.length}`);
    console.log(`📊 Valid stations (excluding Maencloghog): ${validStations.length}`);
    
    // Split into two batches - first half
    const batchSize = Math.ceil(validStations.length / 2);
    const batch1Stations = validStations.slice(0, batchSize);
    
    console.log(`📍 Batch 1 stations: ${batch1Stations.length}`);
    console.log(`📍 Range: ${batch1Stations[0]?.station_name} → ${batch1Stations[batch1Stations.length - 1]?.station_name}`);
    
    if (batch1Stations.length === 0) {
      console.log('⚠️  No stations found for batch 1, exiting successfully');
      return;
    }
    
    const results = [];
    let successCount = 0;
    let errorCount = 0;
    
    // Process each station sequentially to avoid overwhelming the server
    for (const station of batch1Stations) {
      const result = await processStation(station);
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
    console.log(`\n🎯 NRW BATCH 1 SUMMARY:`);
    console.log(`✅ Successful: ${successCount}`);
    console.log(`❌ Failed: ${errorCount}`);
    console.log(`📊 Total stations: ${batch1Stations.length}`);
    
    console.log(`\n📋 DETAILED RESULTS:`);
    results.forEach(result => {
      if (result.success) {
        console.log(`✅ ${result.stationName} (${result.stationId}) - ${result.region}`);
      } else {
        console.log(`❌ ${result.stationName} (${result.stationId}) - ${result.region}: ${result.error}`);
      }
    });
    
    console.log(`\n✅ NRW Batch 1 download complete!`);
    
  } catch (error) {
    console.error('❌ Error in batch download:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  downloadBatch1();
}

module.exports = { downloadBatch1 };
