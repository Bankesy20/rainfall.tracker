#!/usr/bin/env node

/**
 * Rainfall Leaderboard Generator
 * 
 * Generates leaderboards for various rainfall metrics and time periods
 * by analyzing all station JSON files in the data/processed directory.
 */

const fs = require('fs');
const path = require('path');
const dayjs = require('dayjs');

// Configuration
const DATA_DIR = path.join(__dirname, '..', 'data', 'processed');
const LEADERBOARD_DIR = path.join(DATA_DIR, 'leaderboards');
const MAX_RANKINGS = 100; // Top 100 stations per leaderboard

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
        .filter(record => new Date(record.dateTime) >= cutoffTime)
        .reduce((sum, record) => sum + (record.rainfall_mm || 0), 0);
    }
  },
  'max_hourly': {
    name: 'Max Hourly Rainfall',
    unit: 'mm/h',
    calculate: (data, cutoffTime) => {
      const filteredData = data.filter(record => new Date(record.dateTime) >= cutoffTime);
      let maxHourly = 0;
      
      // Group by hour and sum 15-minute readings
      const hourlyTotals = {};
      filteredData.forEach(record => {
        const hour = dayjs(record.dateTime).format('YYYY-MM-DD-HH');
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
          .filter(record => new Date(record.dateTime) >= cutoffTime)
          .map(record => record.rainfall_mm || 0),
        0
      );
    }
  },
  'rainy_days': {
    name: 'Rainy Days',
    unit: 'days',
    calculate: (data, cutoffTime) => {
      const filteredData = data.filter(record => new Date(record.dateTime) >= cutoffTime);
      const dailyTotals = {};
      
      // Group by day and sum rainfall
      filteredData.forEach(record => {
        const day = dayjs(record.dateTime).format('YYYY-MM-DD');
        dailyTotals[day] = (dailyTotals[day] || 0) + (record.rainfall_mm || 0);
      });
      
      // Count days with > 0.1mm rainfall
      return Object.values(dailyTotals).filter(total => total > 0.1).length;
    }
  }
};

/**
 * Load all station data files
 */
function loadStationData() {
  console.log('📁 Loading station data files...');
  
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
        stations.push({
          station: data.station,
          stationName: data.stationName || data.station,
          region: data.region || 'Unknown',
          location: data.location || { lat: null, long: null },
          data: data.data
        });
      }
    } catch (error) {
      console.warn(`⚠️  Skipping ${file}: ${error.message}`);
    }
  }
  
  console.log(`✅ Loaded ${stations.length} valid stations`);
  return stations;
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
  
  const metric = METRICS[metricKey];
  const cutoffTime = getCutoffTime(period);
  
  // Calculate values for all stations
  const stationValues = stations.map(station => ({
    station: station.station,
    stationName: station.stationName,
    region: station.region,
    location: station.location,
    value: calculateMetric(station, metricKey, period)
  }));
  
  // Sort by value (descending) and take top N
  const sorted = stationValues
    .filter(item => item.value > 0) // Only include stations with data
    .sort((a, b) => b.value - a.value)
    .slice(0, MAX_RANKINGS);
  
  // Add rank numbers
  const rankings = sorted.map((item, index) => ({
    rank: index + 1,
    station: item.station,
    stationName: item.stationName,
    region: item.region,
    location: item.location,
    value: Math.round(item.value * 100) / 100 // Round to 2 decimal places
  }));
  
  return {
    metric: metricKey,
    period: period,
    unit: metric.unit,
    generated_at: dayjs().toISOString(),
    rankings: rankings
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
  
  // Create leaderboard directory if it doesn't exist
  if (!fs.existsSync(LEADERBOARD_DIR)) {
    fs.mkdirSync(LEADERBOARD_DIR, { recursive: true });
    console.log('📁 Created leaderboard directory');
  }
  
  // Load station data
  const stations = loadStationData();
  
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
  
  console.log(`✅ Generated ${generated}/${totalLeaderboards} leaderboards successfully`);
  console.log(`📁 Leaderboards saved to: ${LEADERBOARD_DIR}`);
  
  // Generate summary
  const summary = {
    generated_at: dayjs().toISOString(),
    total_stations: stations.length,
    total_leaderboards: generated,
    metrics: Object.keys(METRICS),
    periods: Object.keys(TIME_PERIODS),
    max_rankings_per_leaderboard: MAX_RANKINGS
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
