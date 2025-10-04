const fs = require('fs').promises;
const path = require('path');
const dayjs = require('dayjs');

/**
 * Correct Exmouth station data based on analysis findings
 * Apply intelligent corrections to readings that are significantly higher than nearby stations
 */

// Exmouth station details
const EXMOUTH_STATION = {
  id: '45164',
  name: 'Exmouth',
  coordinates: { lat: 50.614674, lng: -3.380154 }
};

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

// Function to calculate corrected value based on nearby stations
function calculateCorrectedValue(originalValue, nearbyStationsData, timestamp) {
  const targetTime = dayjs(timestamp);
  const timeWindow = 30; // 30 minutes window
  
  // Collect nearby readings within time window
  const nearbyReadings = [];
  
  for (const [stationKey, stationData] of Object.entries(nearbyStationsData)) {
    if (!stationData) continue;
    
    stationData.data.forEach(record => {
      const recordTime = dayjs(record.dateTime || `${record.date} ${record.time}`);
      const timeDiff = Math.abs(recordTime.diff(targetTime, 'minutes'));
      
      if (timeDiff <= timeWindow) {
        const rainfall = parseFloat(record.rainfall_mm) || 0;
        if (rainfall > 0) { // Only include positive readings
          nearbyReadings.push(rainfall);
        }
      }
    });
  }
  
  if (nearbyReadings.length === 0) {
    // No nearby data, use conservative estimate
    return Math.min(originalValue * 0.1, 2.0); // Max 2mm if no nearby data
  }
  
  // Calculate statistics from nearby readings
  const avgNearby = nearbyReadings.reduce((a, b) => a + b, 0) / nearbyReadings.length;
  const maxNearby = Math.max(...nearbyReadings);
  const medianNearby = nearbyReadings.sort((a, b) => a - b)[Math.floor(nearbyReadings.length / 2)];
  
  // Use median as base, but cap at reasonable maximum
  let correctedValue = medianNearby;
  
  // If original is extremely high compared to nearby, use a more conservative approach
  if (originalValue > avgNearby * 10) {
    correctedValue = Math.min(avgNearby * 1.5, 5.0); // Cap at 5mm
  } else if (originalValue > avgNearby * 5) {
    correctedValue = Math.min(avgNearby * 2, 8.0); // Cap at 8mm
  } else if (originalValue > avgNearby * 2) {
    correctedValue = Math.min(avgNearby * 1.5, 10.0); // Cap at 10mm
  }
  
  // Ensure minimum reasonable value
  correctedValue = Math.max(correctedValue, 0.1);
  
  return Math.round(correctedValue * 10) / 10; // Round to 1 decimal place
}

// Function to detect and correct errors in Exmouth data
async function correctExmouthData() {
  console.log('🔧 Correcting Exmouth station data...');
  
  // Load Exmouth data
  console.log('📊 Loading Exmouth station data...');
  const exmouthData = await loadStationData(EXMOUTH_STATION.id);
  if (!exmouthData) {
    console.error('❌ Could not load Exmouth data');
    return;
  }
  
  // Load nearby stations data for comparison
  console.log('📊 Loading nearby stations data...');
  const nearbyStations = [
    'E82920', // Dawlish Warren Shutterton
    '45186',  // Woodbury
    'E82040', // Colaton Raleigh Dotton Water Works
    '45115',  // Ashcombe
    '45184'   // Exeter Met Office
  ];
  
  const nearbyStationsData = {};
  for (const stationId of nearbyStations) {
    console.log(`  Loading station ${stationId}...`);
    const data = await loadStationData(stationId);
    if (data) {
      nearbyStationsData[stationId] = data;
    }
  }
  
  console.log(`✅ Loaded ${Object.keys(nearbyStationsData).length} nearby stations`);
  
  // Filter for last 3 days to focus on recent errors
  const cutoffDate = dayjs().subtract(3, 'day').startOf('day');
  const recentData = exmouthData.data.filter(record => {
    const recordDate = dayjs(record.dateTime || `${record.date} ${record.time}`);
    return recordDate.isAfter(cutoffDate);
  });
  
  console.log(`📈 Processing ${recentData.length} recent readings`);
  
  // Create corrected data
  const correctedData = [...exmouthData.data];
  const corrections = [];
  
  // Process each reading
  for (let i = 0; i < correctedData.length; i++) {
    const record = correctedData[i];
    const rainfall = parseFloat(record.rainfall_mm) || 0;
    const timestamp = record.dateTime || `${record.date} ${record.time}`;
    
    // Only process readings >10mm in the last 3 days
    const recordDate = dayjs(timestamp);
    if (rainfall > 10 && recordDate.isAfter(cutoffDate)) {
      const originalValue = rainfall;
      const correctedValue = calculateCorrectedValue(originalValue, nearbyStationsData, timestamp);
      
      // Only correct if the difference is significant
      if (Math.abs(originalValue - correctedValue) > 5) {
        // Store original value
        const originalRecord = { ...record };
        
        // Apply correction
        correctedData[i] = {
          ...record,
          rainfall_mm: correctedValue,
          original_rainfall_mm: originalValue,
          corrected: true,
          correction_reason: 'Exmouth data correction based on nearby station comparison',
          correction_timestamp: new Date().toISOString(),
          correction_method: 'nearby_station_analysis'
        };
        
        corrections.push({
          index: i,
          timestamp,
          original: originalValue,
          corrected: correctedValue,
          difference: Math.round((correctedValue - originalValue) * 10) / 10,
          method: 'nearby_station_analysis'
        });
        
        console.log(`🔧 ${timestamp}: ${originalValue}mm → ${correctedValue}mm (${Math.round((correctedValue - originalValue) * 10) / 10}mm change)`);
      }
    }
  }
  
  console.log(`\n✅ Applied ${corrections.length} corrections to Exmouth data`);
  
  // Create corrected data structure
  const correctedExmouthData = {
    ...exmouthData,
    data: correctedData,
    lastUpdated: new Date().toISOString(),
    correctionsApplied: {
      count: corrections.length,
      appliedAt: new Date().toISOString(),
      method: 'nearby_station_analysis',
      description: 'Corrected Exmouth readings based on comparison with nearby stations'
    }
  };
  
  // Save corrected data
  const outputPath = 'data/processed/ea-45164-corrected.json';
  await fs.writeFile(outputPath, JSON.stringify(correctedExmouthData, null, 2));
  console.log(`💾 Corrected data saved to: ${outputPath}`);
  
  // Also save to public directory for development
  const publicPath = 'public/data/processed/ea-45164-corrected.json';
  await fs.writeFile(publicPath, JSON.stringify(correctedExmouthData, null, 2));
  console.log(`💾 Corrected data also saved to: ${publicPath}`);
  
  // Create backup of original data
  const backupPath = `data/processed/ea-45164-backup-${Date.now()}.json`;
  await fs.writeFile(backupPath, JSON.stringify(exmouthData, null, 2));
  console.log(`💾 Original data backed up to: ${backupPath}`);
  
  // Generate correction report
  const report = {
    generatedAt: new Date().toISOString(),
    station: EXMOUTH_STATION,
    correctionsApplied: corrections.length,
    corrections: corrections,
    summary: {
      totalReadings: correctedData.length,
      correctedReadings: corrections.length,
      averageReduction: corrections.length > 0 ? 
        Math.round((corrections.reduce((sum, c) => sum + c.difference, 0) / corrections.length) * 10) / 10 : 0,
      maxReduction: corrections.length > 0 ? 
        Math.min(...corrections.map(c => c.difference)) : 0
    }
  };
  
  const reportPath = `exmouth-correction-report-${Date.now()}.json`;
  await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
  console.log(`📋 Correction report saved to: ${reportPath}`);
  
  // Show summary
  console.log('\n📊 CORRECTION SUMMARY:');
  console.log('='.repeat(50));
  console.log(`Total readings processed: ${correctedData.length}`);
  console.log(`Corrections applied: ${corrections.length}`);
  if (corrections.length > 0) {
    console.log(`Average reduction: ${report.summary.averageReduction}mm`);
    console.log(`Maximum reduction: ${report.summary.maxReduction}mm`);
  }
  
  return {
    originalData: exmouthData,
    correctedData: correctedExmouthData,
    corrections: corrections,
    report: report
  };
}

// Function to replace original data with corrected data
async function replaceOriginalData() {
  console.log('🔄 Replacing original Exmouth data with corrected version...');
  
  try {
    // Load corrected data
    const correctedData = JSON.parse(await fs.readFile('data/processed/ea-45164-corrected.json', 'utf8'));
    
    // Replace original data
    await fs.writeFile('data/processed/ea-45164.json', JSON.stringify(correctedData, null, 2));
    console.log('✅ Original Exmouth data replaced with corrected version');
    
    // Also update public directory
    await fs.writeFile('public/data/processed/ea-45164.json', JSON.stringify(correctedData, null, 2));
    console.log('✅ Public Exmouth data also updated');
    
  } catch (error) {
    console.error('❌ Error replacing original data:', error.message);
  }
}

// Main execution
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.includes('--replace')) {
    replaceOriginalData().catch(console.error);
  } else {
    correctExmouthData().catch(console.error);
  }
}

module.exports = { correctExmouthData, replaceOriginalData };
