#!/usr/bin/env node

/**
 * EA Batch Downloader - Downloads specific alphabetical range of stations
 * Used by the batch GitHub Actions workflows
 */

const fs = require('fs');
const path = require('path');

// Import the base functionality from the main downloader
const mainDownloader = require('./download-ea-multi-stations');

async function downloadBatch() {
  const batchNum = process.env.EA_BATCH_NUM;
  const batchStart = process.env.EA_BATCH_START;
  const batchEnd = process.env.EA_BATCH_END;
  
  if (!batchNum || !batchStart || !batchEnd) {
    console.error('❌ Missing required environment variables: EA_BATCH_NUM, EA_BATCH_START, EA_BATCH_END');
    process.exit(1);
  }
  
  console.log(`🚀 Starting EA Batch ${batchNum} download...`);
  console.log(`📍 Range: ${batchStart} → ${batchEnd}`);
  
  // Load all stations
  const stationsJsonPath = path.join(__dirname, '..', 'data', 'processed', 'ea-england-stations-with-names.json');
  
  try {
    const raw = fs.readFileSync(stationsJsonPath, 'utf8');
    const parsed = JSON.parse(raw);
    const items = Array.isArray(parsed.items) ? parsed.items : [];
    
    // Exclude miserden and maenclochog (handled separately)
    const excludedIds = new Set(['1141', '1099']);
    const validStations = items.filter(item => {
      const stationId = String(item.stationReference || item.key || '').trim();
      const label = (item.label || item.gaugeName || '').trim();
      return stationId && label && !excludedIds.has(stationId);
    });
    
    // Sort alphabetically
    const sortedStations = validStations.sort((a, b) => {
      const nameA = (a.label || a.gaugeName || '').trim().toLowerCase();
      const nameB = (b.label || b.gaugeName || '').trim().toLowerCase();
      return nameA.localeCompare(nameB);
    });
    
    // Filter for this batch
    const batchStations = sortedStations.filter(station => {
      const name = (station.label || station.gaugeName || '').trim();
      return name >= batchStart && name <= batchEnd;
    });
    
    console.log(`📊 Found ${batchStations.length} stations in range`);
    
    if (batchStations.length === 0) {
      console.log('⚠️  No stations found in range, exiting successfully');
      return;
    }
    
    // Convert to the format expected by the main downloader
    const stationsConfig = batchStations.map(station => {
      const stationId = String(station.stationReference || station.key || '').trim();
      const label = (station.label || station.gaugeName || '').trim();
      return {
        stationId: stationId,
        stationName: `${label} (${stationId})`,
        csvUrl: `https://check-for-flooding.service.gov.uk/rainfall-station-csv/${stationId}`,
        humanPage: station.humanPage || `https://check-for-flooding.service.gov.uk/rainfall-station/${stationId}`,
        region: 'England'
      };
    });
    
    console.log(`🔄 Processing ${stationsConfig.length} stations...`);
    
    const results = [];
    let successCount = 0;
    let errorCount = 0;
    
    // Process each station using the main downloader functions
    for (const station of stationsConfig) {
      try {
        console.log(`\n🚀 Processing station: ${station.stationName} (${station.stationId})`);
        
        // Download CSV
        const csvPath = await mainDownloader.downloadEACSV(station);
        
        // Process CSV
        const data = await mainDownloader.processDownloadedCSV(csvPath, station);
        
        // Save processed data
        const outputFile = await mainDownloader.saveProcessedData(data, station);
        
        console.log(`✅ Station ${station.stationName} complete!`);
        console.log(`📊 Records processed: ${data.recordCount}`);
        
        results.push({
          stationId: station.stationId,
          stationName: station.stationName,
          region: station.region,
          recordCount: data.recordCount,
          success: true,
          outputFile: outputFile
        });
        
        successCount++;
        
      } catch (error) {
        console.error(`❌ Error processing station ${station.stationName}:`, error);
        results.push({
          stationId: station.stationId,
          stationName: station.stationName,
          region: station.region,
          recordCount: 0,
          success: false,
          error: error.message
        });
        errorCount++;
      }
      
      // Polite delay between stations
      const delay = 2500 + Math.floor(Math.random() * 500); // 2.5-3s
      await new Promise(resolve => setTimeout(resolve, delay));
    }
    
    // Summary
    console.log(`\n🎯 BATCH ${batchNum} SUMMARY:`);
    console.log(`✅ Successful: ${successCount}`);
    console.log(`❌ Failed: ${errorCount}`);
    console.log(`📊 Total stations: ${stationsConfig.length}`);
    console.log(`📍 Range: ${batchStart} → ${batchEnd}`);
    
    console.log(`\n✅ EA Batch ${batchNum} download complete!`);
    
  } catch (error) {
    console.error('❌ Error in batch download:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  downloadBatch();
}

module.exports = { downloadBatch };
