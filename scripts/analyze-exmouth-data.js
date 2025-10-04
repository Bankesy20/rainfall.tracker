const fs = require('fs').promises;
const path = require('path');
const dayjs = require('dayjs');

/**
 * Analyze Exmouth station data for potential errors by comparing with nearby stations
 * Focus on readings >10mm in the last couple of days
 */

// Exmouth station details
const EXMOUTH_STATION = {
  id: '45164',
  name: 'Exmouth',
  coordinates: { lat: 50.614674, lng: -3.380154 }
};

// Function to calculate distance between two coordinates (Haversine formula)
function calculateDistance(lat1, lng1, lat2, lng2) {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// Function to find nearby stations within specified radius
function findNearbyStations(stations, targetStation, radiusKm = 50) {
  const nearby = [];
  
  for (const [key, station] of Object.entries(stations)) {
    if (station.coordinates && station.coordinates.lat && station.coordinates.lng) {
      const distance = calculateDistance(
        targetStation.coordinates.lat,
        targetStation.coordinates.lng,
        station.coordinates.lat,
        station.coordinates.lng
      );
      
      if (distance <= radiusKm && station.stationId !== targetStation.id) {
        nearby.push({
          ...station,
          distance: Math.round(distance * 10) / 10,
          key
        });
      }
    }
  }
  
  return nearby.sort((a, b) => a.distance - b.distance);
}

// Function to load station data
async function loadStationData(stationId) {
  try {
    // Try different possible file locations
    const possiblePaths = [
      `data/processed/ea-${stationId}.json`,
      `data/processed/${stationId}.json`,
      `public/data/processed/ea-${stationId}.json`,
      `public/data/processed/${stationId}.json`
    ];
    
    for (const filePath of possiblePaths) {
      try {
        const content = await fs.readFile(filePath, 'utf8');
        const data = JSON.parse(content);
        if (data.data && Array.isArray(data.data)) {
          return data;
        }
      } catch (e) {
        // Continue to next path
      }
    }
    
    throw new Error(`Station data not found for ${stationId}`);
  } catch (error) {
    console.error(`❌ Error loading station ${stationId}:`, error.message);
    return null;
  }
}

// Function to filter data for last 2 days with readings >10mm
function filterHighRainfallData(data, daysBack = 2) {
  if (!data || !data.data) return [];
  
  const cutoffDate = dayjs().subtract(daysBack, 'day').startOf('day');
  
  return data.data.filter(record => {
    const recordDate = dayjs(record.dateTime || `${record.date} ${record.time}`);
    const rainfall = parseFloat(record.rainfall_mm) || 0;
    
    return recordDate.isAfter(cutoffDate) && rainfall > 10;
  });
}

// Function to analyze rainfall patterns
function analyzeRainfallPatterns(exmouthData, nearbyStationsData) {
  const analysis = {
    exmouthHighReadings: exmouthData,
    nearbyComparison: {},
    potentialErrors: []
  };
  
  // Group readings by hour for comparison
  const exmouthByHour = {};
  exmouthData.forEach(record => {
    const hour = dayjs(record.dateTime || `${record.date} ${record.time}`).format('YYYY-MM-DD HH:00');
    if (!exmouthByHour[hour]) exmouthByHour[hour] = [];
    exmouthByHour[hour].push(record);
  });
  
  // Compare with nearby stations
  for (const [stationKey, stationData] of Object.entries(nearbyStationsData)) {
    if (!stationData) continue;
    
    const stationHighReadings = filterHighRainfallData(stationData);
    const stationByHour = {};
    
    stationHighReadings.forEach(record => {
      const hour = dayjs(record.dateTime || `${record.date} ${record.time}`).format('YYYY-MM-DD HH:00');
      if (!stationByHour[hour]) stationByHour[hour] = [];
      stationByHour[hour].push(record);
    });
    
    analysis.nearbyComparison[stationKey] = {
      highReadings: stationHighReadings,
      byHour: stationByHour
    };
    
    // Find potential errors by comparing hourly totals
    for (const [hour, exmouthReadings] of Object.entries(exmouthByHour)) {
      const exmouthTotal = exmouthReadings.reduce((sum, r) => sum + (parseFloat(r.rainfall_mm) || 0), 0);
      const stationReadings = stationByHour[hour] || [];
      const stationTotal = stationReadings.reduce((sum, r) => sum + (parseFloat(r.rainfall_mm) || 0), 0);
      
      // If Exmouth is significantly higher than nearby station
      if (stationTotal > 0 && exmouthTotal > stationTotal * 3) {
        analysis.potentialErrors.push({
          hour,
          exmouthTotal: Math.round(exmouthTotal * 10) / 10,
          stationKey,
          stationTotal: Math.round(stationTotal * 10) / 10,
          ratio: Math.round((exmouthTotal / stationTotal) * 10) / 10,
          exmouthReadings,
          stationReadings
        });
      }
    }
  }
  
  return analysis;
}

// Main analysis function
async function analyzeExmouthData() {
  console.log('🔍 Analyzing Exmouth station data for potential errors...');
  console.log(`📍 Exmouth coordinates: ${EXMOUTH_STATION.coordinates.lat}, ${EXMOUTH_STATION.coordinates.lng}`);
  
  // Load stations metadata
  console.log('📁 Loading stations metadata...');
  const metadataPath = 'data/processed/stations-metadata.json';
  const metadata = JSON.parse(await fs.readFile(metadataPath, 'utf8'));
  
  // Find nearby stations
  console.log('🔍 Finding nearby stations...');
  const nearbyStations = findNearbyStations(metadata.stations, EXMOUTH_STATION, 50);
  console.log(`📍 Found ${nearbyStations.length} nearby stations within 50km:`);
  nearbyStations.slice(0, 10).forEach(station => {
    console.log(`  - ${station.name} (${station.stationId}): ${station.distance}km`);
  });
  
  // Load Exmouth data
  console.log('📊 Loading Exmouth station data...');
  const exmouthData = await loadStationData(EXMOUTH_STATION.id);
  if (!exmouthData) {
    console.error('❌ Could not load Exmouth data');
    return;
  }
  
  // Filter for high rainfall readings in last 2 days
  const exmouthHighReadings = filterHighRainfallData(exmouthData, 2);
  console.log(`🌧️ Found ${exmouthHighReadings.length} readings >10mm in last 2 days`);
  
  if (exmouthHighReadings.length === 0) {
    console.log('✅ No high rainfall readings found in Exmouth data');
    return;
  }
  
  // Show Exmouth high readings
  console.log('\n📈 Exmouth high rainfall readings (>10mm):');
  exmouthHighReadings.forEach(record => {
    const timestamp = record.dateTime || `${record.date} ${record.time}`;
    const rainfall = parseFloat(record.rainfall_mm) || 0;
    console.log(`  ${timestamp}: ${rainfall}mm`);
  });
  
  // Load nearby stations data
  console.log('\n📊 Loading nearby stations data...');
  const nearbyStationsData = {};
  for (const station of nearbyStations.slice(0, 5)) { // Limit to 5 closest stations
    console.log(`  Loading ${station.name} (${station.stationId})...`);
    const data = await loadStationData(station.stationId);
    if (data) {
      nearbyStationsData[station.key] = data;
    }
  }
  
  // Analyze patterns
  console.log('\n🔍 Analyzing rainfall patterns...');
  const analysis = analyzeRainfallPatterns(exmouthHighReadings, nearbyStationsData);
  
  // Display results
  console.log('\n📊 ANALYSIS RESULTS:');
  console.log('='.repeat(50));
  
  if (analysis.potentialErrors.length === 0) {
    console.log('✅ No obvious errors detected in Exmouth data');
    console.log('   Exmouth readings appear consistent with nearby stations');
  } else {
    console.log(`🚨 Found ${analysis.potentialErrors.length} potential errors:`);
    console.log('');
    
    analysis.potentialErrors.forEach((error, index) => {
      console.log(`${index + 1}. Hour: ${error.hour}`);
      console.log(`   Exmouth: ${error.exmouthTotal}mm`);
      console.log(`   ${error.stationKey}: ${error.stationTotal}mm`);
      console.log(`   Ratio: ${error.ratio}x higher`);
      console.log(`   Exmouth readings: ${error.exmouthReadings.map(r => `${r.rainfall_mm}mm`).join(', ')}`);
      console.log('');
    });
  }
  
  // Save detailed report
  const report = {
    generatedAt: new Date().toISOString(),
    exmouthStation: EXMOUTH_STATION,
    nearbyStations: nearbyStations.slice(0, 10),
    analysis,
    summary: {
      exmouthHighReadings: exmouthHighReadings.length,
      nearbyStationsAnalyzed: Object.keys(nearbyStationsData).length,
      potentialErrors: analysis.potentialErrors.length
    }
  };
  
  const reportPath = `exmouth-analysis-report-${Date.now()}.json`;
  await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
  console.log(`\n💾 Detailed report saved to: ${reportPath}`);
  
  return analysis;
}

// Run the analysis
if (require.main === module) {
  analyzeExmouthData().catch(console.error);
}

module.exports = { analyzeExmouthData, calculateDistance, findNearbyStations };
