const fs = require('fs');
const fsPromises = require('fs').promises;
const path = require('path');
const https = require('https');
const http = require('http');
const zlib = require('zlib');

/**
 * Download rainfall CSV from EA station
 * Based on the existing download-rainfall.js but adapted for EA stations
 */

// Configuration - change these for different stations
const STATION_CONFIG = {
  stationId: 'E7050', // Change this to any station ID from ea-england-stations.json
  stationName: 'Preston Capes', // Human readable name
  csvUrl: 'https://check-for-flooding.service.gov.uk/rainfall-station-csv/E7050', // CSV download URL
  humanPage: 'https://check-for-flooding.service.gov.uk/rainfall-station/E7050' // Human page URL
};

async function downloadEACSV() {
  const outputPath = path.join(__dirname, '..', 'data', 'raw', `ea-${STATION_CONFIG.stationId}-${new Date().toISOString().split('T')[0]}.csv`);
  
  console.log(`🌧️ Downloading EA rainfall data for ${STATION_CONFIG.stationName} (${STATION_CONFIG.stationId})...`);
  console.log(`📥 URL: ${STATION_CONFIG.csvUrl}`);
  console.log(`💾 Saving to: ${outputPath}`);
  console.log(`🔍 Node.js version: ${process.version}`);
  console.log(`🌐 Platform: ${process.platform}`);
  
  // Proper headers to mimic a real browser
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Referer': STATION_CONFIG.humanPage,
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'same-origin',
    'Cache-Control': 'max-age=0'
  };
  
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(outputPath);
    
    const options = {
      hostname: 'check-for-flooding.service.gov.uk',
      path: `/rainfall-station-csv/${STATION_CONFIG.stationId}`,
      method: 'GET',
      headers: headers
    };
    
    const request = https.request(options, (response) => {
      console.log(`📊 Response status: ${response.statusCode}`);
      console.log(`📋 Response headers:`, JSON.stringify(response.headers, null, 2));
      
      if (response.statusCode !== 200) {
        reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
        return;
      }
      
      // Handle gzip compression
      let stream = response;
      if (response.headers['content-encoding'] === 'gzip') {
        console.log('🗜️ Decompressing gzip content...');
        stream = response.pipe(zlib.createGunzip());
      }
      
      stream.pipe(file);
      
      file.on('finish', () => {
        file.close();
        console.log(`✅ Download complete: ${outputPath}`);
        resolve(outputPath);
      });
      
      file.on('error', (err) => {
        fs.unlink(outputPath, () => {}); // Delete the file on error
        reject(err);
      });
    });
    
    request.on('error', (err) => {
      console.error('❌ Request error:', err);
      reject(err);
    });
    
    request.setTimeout(30000, () => {
      request.destroy();
      reject(new Error('Request timeout'));
    });
    
    request.end();
  });
}

async function processDownloadedCSV(csvPath) {
  console.log(`🔄 Processing CSV file: ${csvPath}`);
  
  try {
    const csvContent = await fsPromises.readFile(csvPath, 'utf8');
    const lines = csvContent.trim().split('\n');
    
    if (lines.length < 2) {
      throw new Error('CSV file appears to be empty or invalid');
    }
    
    // Parse CSV header
    const header = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    console.log(`📋 CSV Headers: ${header.join(', ')}`);
    
    // Find columns - EA stations use different format
    const timestampIndex = header.findIndex(h => h.toLowerCase().includes('timestamp'));
    const valueIndex = header.findIndex(h => h.toLowerCase().includes('value') || h.toLowerCase().includes('rainfall'));
    
    if (timestampIndex === -1 || valueIndex === -1) {
      throw new Error(`Could not find required columns. Found: ${header.join(', ')}`);
    }
    
    console.log(`⏰ Timestamp column: ${header[timestampIndex]} (index ${timestampIndex})`);
    console.log(`💧 Value column: ${header[valueIndex]} (index ${valueIndex})`);
    
    // Process data rows
    const data = [];
    let validRows = 0;
    let skippedRows = 0;
    
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      const values = line.split(',').map(v => v.trim().replace(/"/g, ''));
      
      if (values.length < Math.max(timestampIndex, valueIndex) + 1) {
        console.log(`⚠️ Skipping malformed row ${i + 1}: ${line}`);
        skippedRows++;
        continue;
      }
      
      const timestamp = values[timestampIndex];
      const value = parseFloat(values[valueIndex]);
      
      if (isNaN(value)) {
        console.log(`⚠️ Skipping row ${i + 1} with invalid value: ${values[valueIndex]}`);
        skippedRows++;
        continue;
      }
      
      // Parse the timestamp (format: 2025-09-16T12:15:00Z)
      const dateTime = new Date(timestamp);
      if (isNaN(dateTime.getTime())) {
        console.log(`⚠️ Skipping row ${i + 1} with invalid timestamp: ${timestamp}`);
        skippedRows++;
        continue;
      }
      
      // Extract date and time components
      const date = dateTime.toISOString().split('T')[0];
      const time = dateTime.toISOString().split('T')[1].replace('Z', '');
      
      data.push({
        date: date,
        time: time,
        dateTime: timestamp,
        value: value,
        station: STATION_CONFIG.stationId,
        stationName: STATION_CONFIG.stationName
      });
      
      validRows++;
    }
    
    console.log(`📊 Processed ${validRows} valid rows, skipped ${skippedRows} invalid rows`);
    
    if (validRows === 0) {
      throw new Error('No valid data rows found in CSV');
    }
    
    // Sort by date and time
    data.sort((a, b) => {
      const dateA = new Date(a.dateTime);
      const dateB = new Date(b.dateTime);
      return dateA - dateB;
    });
    
    // Create the final data structure
    const result = {
      lastUpdated: new Date().toISOString(),
      station: STATION_CONFIG.stationId,
      stationName: STATION_CONFIG.stationName,
      location: {
        lat: null, // Could be added from station config if needed
        long: null
      },
      dataSource: 'EA API',
      recordCount: data.length,
      data: data
    };
    
    return result;
    
  } catch (error) {
    console.error('❌ Error processing CSV:', error);
    throw error;
  }
}

async function saveProcessedData(data) {
  const outputDir = path.join(__dirname, '..', 'data', 'processed');
  const outputFile = path.join(outputDir, `ea-${STATION_CONFIG.stationId}.json`);
  
  // Ensure output directory exists
  await fsPromises.mkdir(outputDir, { recursive: true });
  
  // Save to processed directory
  await fsPromises.writeFile(outputFile, JSON.stringify(data, null, 2));
  console.log(`💾 Saved processed data to: ${outputFile}`);
  
  // Also save to public directory for the web app
  const publicDir = path.join(__dirname, '..', 'public', 'data', 'processed');
  const publicFile = path.join(publicDir, `ea-${STATION_CONFIG.stationId}.json`);
  
  await fsPromises.mkdir(publicDir, { recursive: true });
  await fsPromises.writeFile(publicFile, JSON.stringify(data, null, 2));
  console.log(`🌐 Saved public data to: ${publicFile}`);
  
  return outputFile;
}

async function main() {
  try {
    console.log('🚀 Starting EA station data download...');
    console.log(`📍 Station: ${STATION_CONFIG.stationName} (${STATION_CONFIG.stationId})`);
    
    // Download CSV
    const csvPath = await downloadEACSV();
    
    // Process CSV
    const data = await processDownloadedCSV(csvPath);
    
    // Save processed data
    const outputFile = await saveProcessedData(data);
    
    console.log('✅ EA station data download and processing complete!');
    console.log(`📊 Records processed: ${data.recordCount}`);
    console.log(`📁 Output file: ${outputFile}`);
    
  } catch (error) {
    console.error('❌ Error in main process:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = {
  downloadEACSV,
  processDownloadedCSV,
  saveProcessedData,
  STATION_CONFIG
};
