const fs = require('fs').promises;
const path = require('path');
const dayjs = require('dayjs');

/**
 * Detailed analysis of Exmouth station data to identify specific error patterns
 * Focus on suspicious readings and comparison with nearby stations
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
function findNearbyStations(stations, targetStation, radiusKm = 30) {
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

// Function to detect suspicious patterns in rainfall data
function detectSuspiciousPatterns(data) {
  const suspicious = [];
  
  for (let i = 0; i < data.length; i++) {
    const record = data[i];
    const rainfall = parseFloat(record.rainfall_mm) || 0;
    const timestamp = record.dateTime || `${record.date} ${record.time}`;
    
    // Pattern 1: Identical consecutive readings
    if (i > 0) {
      const prevRainfall = parseFloat(data[i-1].rainfall_mm) || 0;
      if (rainfall > 5 && rainfall === prevRainfall) {
        suspicious.push({
          type: 'identical_consecutive',
          timestamp,
          rainfall,
          reason: `Identical to previous reading: ${prevRainfall}mm`,
          index: i
        });
      }
    }
    
    // Pattern 2: Very high readings (>20mm in 15min)
    if (rainfall > 20) {
      suspicious.push({
        type: 'very_high_reading',
        timestamp,
        rainfall,
        reason: `Very high reading: ${rainfall}mm in 15 minutes`,
        index: i
      });
    }
    
    // Pattern 3: Sudden spikes (increase by >15mm from previous)
    if (i > 0) {
      const prevRainfall = parseFloat(data[i-1].rainfall_mm) || 0;
      const increase = rainfall - prevRainfall;
      if (increase > 15 && rainfall > 10) {
        suspicious.push({
          type: 'sudden_spike',
          timestamp,
          rainfall,
          reason: `Sudden spike: +${increase.toFixed(1)}mm from ${prevRainfall}mm`,
          index: i
        });
      }
    }
    
    // Pattern 4: Round numbers (suspicious for rainfall data)
    if (rainfall > 10 && rainfall % 1 === 0) {
      suspicious.push({
        type: 'round_number',
        timestamp,
        rainfall,
        reason: `Round number reading: ${rainfall}mm`,
        index: i
      });
    }
  }
  
  return suspicious;
}

// Function to compare with nearby stations for specific time periods
async function compareWithNearbyStations(exmouthData, nearbyStations, suspiciousReadings) {
  const comparisons = [];
  
  for (const suspicious of suspiciousReadings) {
    const suspiciousTime = dayjs(suspicious.timestamp);
    const timeWindow = 30; // 30 minutes window
    
    for (const station of nearbyStations) {
      const stationData = await loadStationData(station.stationId);
      if (!stationData) continue;
      
      // Find readings in the same time window
      const nearbyReadings = stationData.data.filter(record => {
        const recordTime = dayjs(record.dateTime || `${record.date} ${record.time}`);
        const timeDiff = Math.abs(recordTime.diff(suspiciousTime, 'minutes'));
        return timeDiff <= timeWindow;
      });
      
      if (nearbyReadings.length > 0) {
        const nearbyRainfall = nearbyReadings.map(r => parseFloat(r.rainfall_mm) || 0);
        const maxNearby = Math.max(...nearbyRainfall);
        const avgNearby = nearbyRainfall.reduce((a, b) => a + b, 0) / nearbyRainfall.length;
        
        comparisons.push({
          suspiciousTime: suspicious.timestamp,
          exmouthReading: suspicious.rainfall,
          stationName: station.name,
          stationId: station.stationId,
          distance: station.distance,
          nearbyReadings: nearbyReadings.length,
          maxNearby,
          avgNearby,
          ratio: suspicious.rainfall / Math.max(avgNearby, 0.1),
          isAnomaly: suspicious.rainfall > avgNearby * 2
        });
      }
    }
  }
  
  return comparisons;
}

// Main analysis function
async function detailedExmouthAnalysis() {
  console.log('🔍 Detailed analysis of Exmouth station data...');
  console.log(`📍 Exmouth coordinates: ${EXMOUTH_STATION.coordinates.lat}, ${EXMOUTH_STATION.coordinates.lng}`);
  
  // Load stations metadata
  console.log('📁 Loading stations metadata...');
  const metadataPath = 'data/processed/stations-metadata.json';
  const metadata = JSON.parse(await fs.readFile(metadataPath, 'utf8'));
  
  // Find nearby stations (closer radius for better comparison)
  console.log('🔍 Finding nearby stations...');
  const nearbyStations = findNearbyStations(metadata.stations, EXMOUTH_STATION, 30);
  console.log(`📍 Found ${nearbyStations.length} nearby stations within 30km:`);
  nearbyStations.slice(0, 8).forEach(station => {
    console.log(`  - ${station.name} (${station.stationId}): ${station.distance}km`);
  });
  
  // Load Exmouth data
  console.log('📊 Loading Exmouth station data...');
  const exmouthData = await loadStationData(EXMOUTH_STATION.id);
  if (!exmouthData) {
    console.error('❌ Could not load Exmouth data');
    return;
  }
  
  // Filter for last 3 days to get more context
  const cutoffDate = dayjs().subtract(3, 'day').startOf('day');
  const recentData = exmouthData.data.filter(record => {
    const recordDate = dayjs(record.dateTime || `${record.date} ${record.time}`);
    return recordDate.isAfter(cutoffDate);
  });
  
  console.log(`📈 Analyzing ${recentData.length} readings from last 3 days`);
  
  // Detect suspicious patterns
  console.log('🔍 Detecting suspicious patterns...');
  const suspiciousPatterns = detectSuspiciousPatterns(recentData);
  
  console.log(`\n🚨 Found ${suspiciousPatterns.length} suspicious patterns:`);
  console.log('='.repeat(60));
  
  // Group by type
  const byType = {};
  suspiciousPatterns.forEach(pattern => {
    if (!byType[pattern.type]) byType[pattern.type] = [];
    byType[pattern.type].push(pattern);
  });
  
  Object.entries(byType).forEach(([type, patterns]) => {
    console.log(`\n📊 ${type.replace(/_/g, ' ').toUpperCase()}: ${patterns.length} occurrences`);
    patterns.forEach(pattern => {
      console.log(`  ${pattern.timestamp}: ${pattern.rainfall}mm - ${pattern.reason}`);
    });
  });
  
  // Compare with nearby stations
  console.log('\n🔍 Comparing with nearby stations...');
  const comparisons = await compareWithNearbyStations(recentData, nearbyStations.slice(0, 5), suspiciousPatterns);
  
  if (comparisons.length > 0) {
    console.log('\n📊 COMPARISON WITH NEARBY STATIONS:');
    console.log('='.repeat(60));
    
    // Group by suspicious time
    const byTime = {};
    comparisons.forEach(comp => {
      if (!byTime[comp.suspiciousTime]) byTime[comp.suspiciousTime] = [];
      byTime[comp.suspiciousTime].push(comp);
    });
    
    Object.entries(byTime).forEach(([time, comps]) => {
      console.log(`\n🕐 ${time}:`);
      console.log(`   Exmouth: ${comps[0].exmouthReading}mm`);
      
      comps.forEach(comp => {
        const status = comp.isAnomaly ? '🚨 ANOMALY' : '✅ Normal';
        console.log(`   ${comp.stationName} (${comp.distance}km): ${comp.avgNearby.toFixed(1)}mm avg, ${comp.maxNearby}mm max - ${status}`);
        console.log(`   Ratio: ${comp.ratio.toFixed(1)}x higher than nearby average`);
      });
    });
  }
  
  // Generate recommendations
  console.log('\n💡 RECOMMENDATIONS:');
  console.log('='.repeat(60));
  
  const highReadings = suspiciousPatterns.filter(p => p.type === 'very_high_reading');
  const identicalReadings = suspiciousPatterns.filter(p => p.type === 'identical_consecutive');
  const anomalies = comparisons.filter(c => c.isAnomaly);
  
  if (highReadings.length > 0) {
    console.log(`\n🔧 High readings (${highReadings.length}): Consider reducing to 5-10mm range`);
    highReadings.forEach(reading => {
      console.log(`   ${reading.timestamp}: ${reading.rainfall}mm → suggest 8mm`);
    });
  }
  
  if (identicalReadings.length > 0) {
    console.log(`\n🔧 Identical readings (${identicalReadings.length}): Likely sensor malfunction`);
    identicalReadings.forEach(reading => {
      console.log(`   ${reading.timestamp}: ${reading.rainfall}mm → suggest interpolation`);
    });
  }
  
  if (anomalies.length > 0) {
    console.log(`\n🔧 Anomalies (${anomalies.length}): Readings significantly higher than nearby stations`);
    anomalies.forEach(anomaly => {
      console.log(`   ${anomaly.suspiciousTime}: ${anomaly.exmouthReading}mm vs ${anomaly.avgNearby.toFixed(1)}mm nearby`);
    });
  }
  
  // Save detailed report
  const report = {
    generatedAt: new Date().toISOString(),
    exmouthStation: EXMOUTH_STATION,
    nearbyStations: nearbyStations.slice(0, 8),
    analysis: {
      totalReadings: recentData.length,
      suspiciousPatterns,
      comparisons,
      recommendations: {
        highReadings: highReadings.length,
        identicalReadings: identicalReadings.length,
        anomalies: anomalies.length
      }
    }
  };
  
  const reportPath = `detailed-exmouth-analysis-${Date.now()}.json`;
  await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
  console.log(`\n💾 Detailed report saved to: ${reportPath}`);
  
  return report;
}

// Run the analysis
if (require.main === module) {
  detailedExmouthAnalysis().catch(console.error);
}

module.exports = { detailedExmouthAnalysis };
