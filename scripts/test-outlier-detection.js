const RainfallOutlierDetector = require('./outlier-detection');

/**
 * Test script to demonstrate outlier detection and correction
 */

// Create sample data with some outliers
const testData = {
  station: "TEST001",
  stationName: "Test Station",
  data: [
    { date: "2025-09-24", time: "09:00", rainfall_mm: 0.5, total_mm: 0.5 },
    { date: "2025-09-24", time: "09:15", rainfall_mm: 1.2, total_mm: 1.7 },
    { date: "2025-09-24", time: "09:30", rainfall_mm: 35.8, total_mm: 37.5 }, // OUTLIER!
    { date: "2025-09-24", time: "09:45", rainfall_mm: 2.1, total_mm: 39.6 },
    { date: "2025-09-24", time: "10:00", rainfall_mm: 1.8, total_mm: 41.4 },
    { date: "2025-09-24", time: "10:15", rainfall_mm: 0.9, total_mm: 42.3 },
    { date: "2025-09-24", time: "10:30", rainfall_mm: 45.0, total_mm: 87.3 }, // OUTLIER!
    { date: "2025-09-24", time: "10:45", rainfall_mm: 1.5, total_mm: 88.8 },
    { date: "2025-09-24", time: "11:00", rainfall_mm: 2.3, total_mm: 91.1 },
    { date: "2025-09-24", time: "11:15", rainfall_mm: 0.8, total_mm: 91.9 },
    { date: "2025-09-24", time: "11:30", rainfall_mm: 0.2, total_mm: 92.1 },
    { date: "2025-09-24", time: "11:45", rainfall_mm: 0.0, total_mm: 92.1 }
  ]
};

async function runTest() {
  console.log('🧪 Testing Rainfall Outlier Detection System');
  console.log('='.repeat(50));
  
  // Create detector with 25mm threshold
  const detector = new RainfallOutlierDetector(25);
  
  console.log('📊 Original test data:');
  testData.data.forEach((record, i) => {
    const marker = record.rainfall_mm > 25 ? ' ⚠️ ' : '   ';
    const index = (i + 1).toString().padStart(2, ' ');
    console.log(`${marker}${index}. ${record.date} ${record.time} - ${record.rainfall_mm}mm (total: ${record.total_mm}mm)`);
  });
  
  console.log('\n🔍 Processing data for outliers...');
  const result = detector.processStationData(testData);
  
  if (result.hadOutliers) {
    console.log('\n✅ Corrected data:');
    result.correctedData.data.forEach((record, i) => {
      const marker = record.corrected ? ' 🔧 ' : '   ';
      const original = record.original_rainfall_mm ? ` (was ${record.original_rainfall_mm}mm)` : '';
      const index = (i + 1).toString().padStart(2, ' ');
      console.log(`${marker}${index}. ${record.date} ${record.time} - ${record.rainfall_mm}mm${original} (total: ${record.total_mm}mm)`);
    });
    
    console.log('\n📋 Correction Details:');
    result.corrections.forEach((correction, i) => {
      console.log(`  ${i + 1}. ${correction.timestamp}:`);
      console.log(`     Original: ${correction.original}mm`);
      console.log(`     Corrected: ${correction.corrected}mm`);
      console.log(`     Method: ${correction.method}`);
    });
    
    // Generate report
    const report = detector.generateReport([result]);
    console.log('\n📊 Summary Report:');
    console.log(`   Outliers found: ${report.summary.totalOutliersFound}`);
    console.log(`   Corrections made: ${report.summary.totalCorrections}`);
    console.log(`   Threshold used: ${report.threshold}mm per 15-minute interval`);
    
  } else {
    console.log('\n✅ No outliers detected in test data');
  }
}

// Run the test
if (require.main === module) {
  runTest().catch(error => {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  });
}

module.exports = { testData, runTest };
