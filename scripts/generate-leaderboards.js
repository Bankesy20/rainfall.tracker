#!/usr/bin/env node

/**
 * Rainfall Leaderboard Generator
 * 
 * Generates leaderboards for various rainfall metrics and time periods
 * by analyzing all station JSON files from Netlify Blobs or local files.
 */

const fs = require('fs');
const path = require('path');
const dayjs = require('dayjs');
const { getCountyFromStation } = require('./county-lookup');

// Configuration
const DATA_DIR = path.join(__dirname, '..', 'data', 'processed');
const LEADERBOARD_DIR = path.join(DATA_DIR, 'leaderboards');
const MAX_RANKINGS = 100; // Top 100 stations displayed in UI (but all stations included in data)

// Feature flag: Use Netlify Blobs for data loading (default: true in production)
const USE_BLOB_STORAGE = process.env.USE_BLOB_STORAGE !== 'false'; // Enabled by default

// Time periods in hours
const TIME_PERIODS = {
  '24h': 24,
  '7d': 24 * 7,
  '30d': 24 * 30,
  'all-time': Infinity
};

// Metrics to calculate
const METRICS = {
  'total_rainfall': {
    name: 'Total Rainfall',
    unit: 'mm',
    calculate: (data, cutoffTime) => {
      return data
        .filter(record => {
          const recordTime = new Date(record.dateTimeUtc || record.dateTime || `${record.date} ${record.time}`);
          return recordTime >= cutoffTime;
        })
        .reduce((sum, record) => sum + (record.rainfall_mm || 0), 0);
    }
  },
  'max_hourly': {
    name: 'Max Hourly Rainfall',
    unit: 'mm/h',
    calculate: (data, cutoffTime) => {
      const filteredData = data.filter(record => {
        const recordTime = new Date(record.dateTimeUtc || record.dateTime || `${record.date} ${record.time}`);
        return recordTime >= cutoffTime;
      });
      let maxHourly = 0;
      
      // Group by hour and sum 15-minute readings
      const hourlyTotals = {};
      filteredData.forEach(record => {
        const dateTime = record.dateTimeUtc || record.dateTime || `${record.date} ${record.time}`;
        const hour = dayjs(dateTime).format('YYYY-MM-DD-HH');
        hourlyTotals[hour] = (hourlyTotals[hour] || 0) + (record.rainfall_mm || 0);
      });
      
      return Math.max(...Object.values(hourlyTotals), 0);
    }
  },
  'max_15min': {
    name: 'Max 15-Minute Rainfall',
    unit: 'mm/15min',
    calculate: (data, cutoffTime) => {
      return Math.max(
        ...data
          .filter(record => {
            const recordTime = new Date(record.dateTimeUtc || record.dateTime || `${record.date} ${record.time}`);
            return recordTime >= cutoffTime;
          })
          .map(record => record.rainfall_mm || 0),
        0
      );
    }
  },
  'rainy_days': {
    name: 'Rainy Days',
    unit: 'days',
    calculate: (data, cutoffTime) => {
      const filteredData = data.filter(record => {
        const recordTime = new Date(record.dateTimeUtc || record.dateTime || `${record.date} ${record.time}`);
        return recordTime >= cutoffTime;
      });
      const dailyTotals = {};
      
      // Group by day and sum rainfall
      filteredData.forEach(record => {
        const dateTime = record.dateTimeUtc || record.dateTime || `${record.date} ${record.time}`;
        const day = dayjs(dateTime).format('YYYY-MM-DD');
        dailyTotals[day] = (dailyTotals[day] || 0) + (record.rainfall_mm || 0);
      });
      
      // Count days with > 0.1mm rainfall
      return Object.values(dailyTotals).filter(total => total > 0.1).length;
    }
  }
};

/**
 * Load station coordinates from both EA and Welsh stations files
 */
function loadStationCoordinates() {
  const coordinates = {};
  let totalLoaded = 0;
  
  // Load EA England stations
  try {
    const stationsFile = path.join(DATA_DIR, 'ea-england-stations-with-names.json');
    const content = fs.readFileSync(stationsFile, 'utf8');
    const data = JSON.parse(content);
    
    if (data.items && Array.isArray(data.items)) {
      data.items.forEach(station => {
        if (station.stationReference && station.lat && station.long) {
          coordinates[station.stationReference] = {
            lat: station.lat,
            lng: station.long,
            label: station.label
          };
          totalLoaded++;
        }
      });
    }
    console.log(`📍 Loaded ${totalLoaded} EA station coordinates`);
  } catch (error) {
    console.warn('⚠️  Could not load EA station coordinates:', error.message);
  }
  
  // Load Welsh stations
  try {
    const welshStationsFile = path.join(__dirname, '..', 'welsh_rainfall_stations_with_coords.json');
    const content = fs.readFileSync(welshStationsFile, 'utf8');
    const welshStations = JSON.parse(content);
    
    let welshLoaded = 0;
    if (Array.isArray(welshStations)) {
      welshStations.forEach(station => {
        if (station.station_id && station.latitude && station.longitude) {
          coordinates[station.station_id.toString()] = {
            lat: station.latitude,
            lng: station.longitude,
            label: station.station_name
          };
          welshLoaded++;
          totalLoaded++;
        }
      });
    }
    console.log(`📍 Loaded ${welshLoaded} Welsh station coordinates`);
  } catch (error) {
    console.warn('⚠️  Could not load Welsh station coordinates:', error.message);
  }
  
  console.log(`📍 Total coordinates loaded: ${totalLoaded} stations`);
  return coordinates;
}

/**
 * Load all station data files from Netlify Blobs
 */
async function loadStationDataFromBlobs() {
  console.log('☁️  Loading station data from Netlify Blobs...');
  const loadStartTime = Date.now();
  
  try {
    // Dynamic import for @netlify/blobs
    const { getStore } = await import('@netlify/blobs');
    
    // Initialize blob store
    const store = getStore({
      name: 'rainfall-data',
      siteID: process.env.NETLIFY_SITE_ID,
      token: process.env.NETLIFY_AUTH_TOKEN
    });
    
    console.log(`🔑 Using Netlify Site: ${process.env.NETLIFY_SITE_ID ? '✅ Set' : '❌ Not Set'}`);
    console.log(`🔑 Auth Token: ${process.env.NETLIFY_AUTH_TOKEN ? '✅ Set' : '❌ Not Set'}`);
    
    // Load station coordinates first
    const stationCoordinates = loadStationCoordinates();
    
    // List all station blobs
    const listStartTime = Date.now();
    const { blobs } = await store.list({ prefix: 'stations/' });
    const stationBlobs = blobs.filter(blob => 
      blob.key.startsWith('stations/') && 
      blob.key.endsWith('.json')
    );
    const listEndTime = Date.now();
    
    console.log(`📋 Listed ${stationBlobs.length} station blobs in ${listEndTime - listStartTime}ms`);
    
    const stations = [];
    let totalDownloadSize = 0;
    let downloadStartTime = Date.now();
    
    // Calculate cutoff time - for efficiency, limit all-time to last year of data (not all historical data)
    const cutoffTime = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000); // Last year for all-time
    
    console.log(`📅 Filtering data to records after: ${cutoffTime.toISOString()} (last year)`);
    console.log(`⚡ Using parallel downloads (concurrency: 10, reduced for memory)`);
    console.log(`💡 This filters out old data to speed up processing - all-time leaderboard uses last year`);
    
    // Process blobs in parallel batches (reduced concurrency to avoid memory issues)
    const CONCURRENCY = 10;
    let processedCount = 0;
    
    for (let i = 0; i < stationBlobs.length; i += CONCURRENCY) {
      const batch = stationBlobs.slice(i, i + CONCURRENCY);
      
      const batchPromises = batch.map(async (blob) => {
        try {
          const blobContent = await store.get(blob.key);
          const data = typeof blobContent === 'string' ? JSON.parse(blobContent) : blobContent;
          totalDownloadSize += (typeof blobContent === 'string' ? blobContent.length : JSON.stringify(blobContent).length);
          
          if (data.station && data.data && Array.isArray(data.data) && data.data.length > 0) {
            // Filter to only recent data (for efficiency - we don't need all historical data)
            const recentData = data.data.filter(record => {
              const recordTime = new Date(record.dateTimeUtc || record.dateTime || `${record.date} ${record.time}`);
              return recordTime >= cutoffTime;
            });
            
            // Skip if no recent data
            if (recentData.length === 0) {
              return null;
            }
            
            // Get coordinates from the stations file
            const coords = stationCoordinates[data.station];
            const stationData = {
              ...data,
              lat: coords?.lat,
              lng: coords?.lng,
              location: coords ? { lat: coords.lat, long: coords.lng } : data.location
            };
            
            // Detect Welsh stations if region is missing
            let region = data.region;
            if (!region || region === 'Unknown') {
              const stationId = String(data.station || '');
              const stationIdNum = parseInt(stationId, 10);
              
              // Welsh stations have IDs in range 1000-1149
              if (stationIdNum >= 1000 && stationIdNum <= 1149) {
                region = 'Wales';
              } else if (data.source === 'NRW' || data.source === 'Natural Resources Wales') {
                region = 'Wales';
              } else if (data.provider === 'Natural Resources Wales') {
                region = 'Wales';
              } else if (data.country === 'Wales') {
                region = 'Wales';
              } else if (data.nameCY || (data.nameEN && data.nameEN.match(/[\u0590-\u05FF\u0600-\u06FF]/))) {
                // Welsh language indicators
                region = 'Wales';
              }
            }
            
            // Get county information using coordinates
            const county = getCountyFromStation(stationData);
            
            return {
              station: data.station,
              stationName: data.nameEN || data.stationName || coords?.label || data.station,
              region: region || 'Unknown',
              county: county,
              location: stationData.location || { lat: null, long: null },
              data: recentData // Only include recent data
            };
          }
          return null;
        } catch (error) {
          console.warn(`⚠️  Skipping blob ${blob.key}: ${error.message}`);
          return null;
        }
      });
      
      const batchResults = await Promise.all(batchPromises);
      const validStations = batchResults.filter(s => s !== null);
      stations.push(...validStations);
      
      processedCount += batch.length;
      
      // Log progress every batch
      const elapsed = Date.now() - downloadStartTime;
      const rate = processedCount / (elapsed / 1000);
      const remaining = stationBlobs.length - processedCount;
      const eta = remaining / rate;
      console.log(`  ⏳ Processed ${processedCount}/${stationBlobs.length} stations (${rate.toFixed(1)}/sec, ETA: ${eta.toFixed(0)}s, ${stations.length} with recent data)`);
      
      // Force garbage collection hint every 200 stations (if available)
      if (global.gc && processedCount % 200 === 0) {
        global.gc();
      }
    }
    
    const downloadEndTime = Date.now();
    const totalLoadTime = downloadEndTime - loadStartTime;
    const downloadTime = downloadEndTime - downloadStartTime;
    
    console.log(`\n✅ BLOB LOADING PERFORMANCE:`);
    console.log(`   📊 Total stations: ${stations.length}`);
    console.log(`   📦 Total data size: ${(totalDownloadSize / 1024 / 1024).toFixed(2)} MB`);
    console.log(`   ⏱️  List blobs: ${listEndTime - listStartTime}ms`);
    console.log(`   ⏱️  Download all: ${downloadTime}ms (${(downloadTime / 1000).toFixed(1)}s)`);
    console.log(`   ⏱️  Total time: ${totalLoadTime}ms (${(totalLoadTime / 1000).toFixed(1)}s)`);
    console.log(`   📈 Download rate: ${(stations.length / (downloadTime / 1000)).toFixed(1)} stations/sec`);
    console.log(`   📈 Bandwidth: ${((totalDownloadSize / 1024 / 1024) / (downloadTime / 1000)).toFixed(2)} MB/sec\n`);
    
    return stations;
    
  } catch (error) {
    console.error(`❌ Failed to load from Netlify Blobs: ${error.message}`);
    console.log(`⚠️  Falling back to local files...`);
    return loadStationDataFromFiles();
  }
}

/**
 * Load all station data files from local filesystem
 */
function loadStationDataFromFiles() {
  console.log('📁 Loading station data from local files...');
  const loadStartTime = Date.now();
  
  // Load station coordinates first
  const stationCoordinates = loadStationCoordinates();
  
  const stationFiles = fs.readdirSync(DATA_DIR)
    .filter(file => file.startsWith('ea-') && file.endsWith('.json'))
    .filter(file => file !== 'ea-england-stations.json' && file !== 'ea-england-stations-with-names.json')
    .filter(file => !file.includes('backup'));
  
  console.log(`📊 Found ${stationFiles.length} station files`);
  
  const stations = [];
  
  for (const file of stationFiles) {
    try {
      const filePath = path.join(DATA_DIR, file);
      const content = fs.readFileSync(filePath, 'utf8');
      const data = JSON.parse(content);
      
      if (data.station && data.data && Array.isArray(data.data) && data.data.length > 0) {
        // Get coordinates from the stations file
        const coords = stationCoordinates[data.station];
        const stationData = {
          ...data,
          lat: coords?.lat,
          lng: coords?.lng,
          location: coords ? { lat: coords.lat, long: coords.lng } : data.location
        };
        
        // Detect Welsh stations if region is missing
        let region = data.region;
        if (!region || region === 'Unknown') {
          const stationId = String(data.station || '');
          const stationIdNum = parseInt(stationId, 10);
          
          // Welsh stations have IDs in range 1000-1149
          if (stationIdNum >= 1000 && stationIdNum <= 1149) {
            region = 'Wales';
          } else if (data.source === 'NRW' || data.source === 'Natural Resources Wales') {
            region = 'Wales';
          } else if (data.provider === 'Natural Resources Wales') {
            region = 'Wales';
          } else if (data.country === 'Wales') {
            region = 'Wales';
          } else if (data.nameCY || (data.nameEN && data.nameEN.match(/[\u0590-\u05FF\u0600-\u06FF]/))) {
            // Welsh language indicators
            region = 'Wales';
          }
        }
        
        // Get county information using coordinates
        const county = getCountyFromStation(stationData);
        
        stations.push({
          station: data.station,
          stationName: data.nameEN || data.stationName || coords?.label || data.station,
          region: region || 'Unknown',
          county: county,
          location: stationData.location || { lat: null, long: null },
          data: data.data
        });
      }
    } catch (error) {
      console.warn(`⚠️  Skipping ${file}: ${error.message}`);
    }
  }
  
  const loadEndTime = Date.now();
  const totalLoadTime = loadEndTime - loadStartTime;
  
  console.log(`\n✅ FILE LOADING PERFORMANCE:`);
  console.log(`   📊 Total stations: ${stations.length}`);
  console.log(`   ⏱️  Total time: ${totalLoadTime}ms (${(totalLoadTime / 1000).toFixed(1)}s)\n`);
  
  return stations;
}

/**
 * Load station data - uses blobs if enabled, otherwise local files
 */
async function loadStationData() {
  if (USE_BLOB_STORAGE) {
    console.log('🌐 Data source: NETLIFY BLOBS (set USE_BLOB_STORAGE=false to use local files)');
    return await loadStationDataFromBlobs();
  } else {
    console.log('💾 Data source: LOCAL FILES (set USE_BLOB_STORAGE=true to use blobs)');
    return loadStationDataFromFiles();
  }
}

/**
 * Calculate cutoff time for a given period
 */
function getCutoffTime(period) {
  if (period === 'all-time') {
    return new Date(0); // Beginning of time
  }
  
  const hours = TIME_PERIODS[period];
  return dayjs().subtract(hours, 'hour').toDate();
}

/**
 * Calculate metric value for a station
 */
function calculateMetric(station, metricKey, period) {
  const metric = METRICS[metricKey];
  const cutoffTime = getCutoffTime(period);
  
  try {
    return metric.calculate(station.data, cutoffTime);
  } catch (error) {
    console.warn(`⚠️  Error calculating ${metricKey} for ${station.station}: ${error.message}`);
    return 0;
  }
}

/**
 * Generate leaderboard for a specific metric and period
 */
function generateLeaderboard(stations, metricKey, period) {
  console.log(`📈 Generating ${metricKey} leaderboard for ${period}...`);
  const startTime = Date.now();
  
  const metric = METRICS[metricKey];
  const cutoffTime = getCutoffTime(period);
  
  // Calculate values for all stations
  const stationValues = stations.map(station => ({
    station: station.station,
    stationName: station.stationName,
    region: station.region,
    county: station.county,
    location: station.location,
    value: calculateMetric(station, metricKey, period)
  }));
  
  // Sort by value (descending) - include ALL stations, even those with zero rainfall
  const sorted = stationValues
    .sort((a, b) => b.value - a.value);
  
  // Add rank numbers - include all stations
  const rankings = sorted.map((item, index) => ({
    rank: index + 1,
    station: item.station,
    stationName: item.stationName,
    region: item.region,
    county: item.county,
    location: item.location,
    value: Math.round(item.value * 100) / 100 // Round to 2 decimal places
  }));
  
  const endTime = Date.now();
  const processingTime = endTime - startTime;
  
  // Calculate statistics
  const stationsWithRainfall = rankings.filter(station => station.value > 0).length;
  const totalStations = rankings.length;
  const rainfallPercentage = Math.round((stationsWithRainfall / totalStations) * 100);
  
  console.log(`⏱️  Processed ${rankings.length} stations in ${processingTime}ms (${(processingTime/rankings.length).toFixed(2)}ms per station)`);
  console.log(`📊 ${stationsWithRainfall}/${totalStations} stations had rainfall (${rainfallPercentage}%)`);
  
  return {
    metric: metricKey,
    period: period,
    unit: metric.unit,
    generated_at: dayjs().toISOString(),
    rankings: rankings,
    statistics: {
      total_stations: totalStations,
      stations_with_rainfall: stationsWithRainfall,
      rainfall_percentage: rainfallPercentage
    }
  };
}

/**
 * Save leaderboard to file
 */
function saveLeaderboard(leaderboard) {
  const filename = `leaderboard-${leaderboard.metric}-${leaderboard.period}.json`;
  const filepath = path.join(LEADERBOARD_DIR, filename);
  
  fs.writeFileSync(filepath, JSON.stringify(leaderboard, null, 2));
  console.log(`💾 Saved ${filename} (${leaderboard.rankings.length} stations)`);
}

/**
 * Main function
 */
async function main() {
  console.log('🚀 Starting rainfall leaderboard generation...');
  console.log(`⏰ Generated at: ${dayjs().format('YYYY-MM-DD HH:mm:ss UTC')}`);
  const overallStartTime = Date.now();
  
  // Create leaderboard directory if it doesn't exist
  if (!fs.existsSync(LEADERBOARD_DIR)) {
    fs.mkdirSync(LEADERBOARD_DIR, { recursive: true });
    console.log('📁 Created leaderboard directory');
  }
  
  // Load station data (async now - can pull from blobs)
  const stations = await loadStationData();
  
  if (stations.length === 0) {
    console.error('❌ No station data found!');
    process.exit(1);
  }
  
  // Generate all leaderboards
  const totalLeaderboards = Object.keys(METRICS).length * Object.keys(TIME_PERIODS).length;
  let generated = 0;
  
  console.log(`📊 Generating ${totalLeaderboards} leaderboards...`);
  
  for (const metricKey of Object.keys(METRICS)) {
    for (const period of Object.keys(TIME_PERIODS)) {
      try {
        const leaderboard = generateLeaderboard(stations, metricKey, period);
        saveLeaderboard(leaderboard);
        generated++;
      } catch (error) {
        console.error(`❌ Error generating ${metricKey}-${period}: ${error.message}`);
      }
    }
  }
  
  const overallEndTime = Date.now();
  const totalProcessingTime = overallEndTime - overallStartTime;
  
  console.log(`✅ Generated ${generated}/${totalLeaderboards} leaderboards successfully`);
  console.log(`📁 Leaderboards saved to: ${LEADERBOARD_DIR}`);
  console.log(`⏱️  Total processing time: ${totalProcessingTime}ms (${(totalProcessingTime/1000).toFixed(2)}s)`);
  console.log(`📊 Average time per leaderboard: ${(totalProcessingTime/generated).toFixed(0)}ms`);
  
  // Generate summary
  const summary = {
    generated_at: dayjs().toISOString(),
    total_stations: stations.length,
    total_leaderboards: generated,
    metrics: Object.keys(METRICS),
    periods: Object.keys(TIME_PERIODS),
    max_rankings_per_leaderboard: MAX_RANKINGS,
    processing_time_ms: totalProcessingTime,
    stations_included: "all" // Now includes all stations, not just top 100
  };
  
  const summaryPath = path.join(LEADERBOARD_DIR, 'summary.json');
  fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
  console.log('📋 Generated summary.json');
}

// Run the script
if (require.main === module) {
  main().catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
}

module.exports = { main, generateLeaderboard, calculateMetric };
