#!/usr/bin/env node

/**
 * Example: How to integrate outlier detection into existing workflows
 * This shows how to add outlier detection to your current data processing scripts
 */

const IntegratedOutlierDetection = require('./integrated-outlier-detection.js');

// Example 1: Integration into single station processing (like download-ea-station.js)
async function processSingleStationWithOutliers(stationData) {
  console.log('📊 Processing station data...');
  
  // Your existing data processing logic here
  // ... parse CSV, clean data, etc.
  
  // Add outlier detection
  const outlierDetector = new IntegratedOutlierDetection({
    threshold: 25,
    autoCorrect: true,
    alertThreshold: 5
  });
  
  const outlierResult = await outlierDetector.processStationData(stationData);
  
  // Use the corrected data
  const finalData = outlierResult.correctedData;
  
  // Your existing save logic here
  // ... save to JSON, upload to blobs, etc.
  
  return finalData;
}

// Example 2: Integration into batch processing (like download-ea-multi-stations.js)
async function processBatchWithOutliers(stationsData) {
  console.log('📊 Processing batch of stations...');
  
  // Your existing batch processing logic here
  // ... load stations, process each one, etc.
  
  // Add outlier detection for all stations
  const outlierDetector = new IntegratedOutlierDetection({
    threshold: 25,
    autoCorrect: true,
    alertThreshold: 10 // Higher threshold for batch processing
  });
  
  const results = [];
  for (const stationData of stationsData) {
    const result = await outlierDetector.processStationData(stationData);
    results.push(result.correctedData);
  }
  
  // Print summary
  outlierDetector.printSummary();
  
  // Your existing save logic here
  // ... save all results, upload to blobs, etc.
  
  return results;
}

// Example 3: Integration into GitHub Actions workflow
async function githubActionsIntegration() {
  console.log('🚀 GitHub Actions: Processing with outlier detection...');
  
  // This would be called from your existing GitHub Actions scripts
  const outlierDetector = new IntegratedOutlierDetection({
    threshold: 25,
    autoCorrect: true,
    alertThreshold: 5
  });
  
  // Process your data (this would be your existing logic)
  const stationData = {
    station: "45164",
    stationName: "Exmouth",
    data: [] // Your processed data here
  };
  
  const result = await outlierDetector.processStationData(stationData);
  
  // The result.correctedData contains the cleaned data
  return result.correctedData;
}

// Example 4: Manual correction workflow
async function manualCorrectionWorkflow() {
  console.log('🔧 Manual outlier correction workflow...');
  
  const outlierDetector = new IntegratedOutlierDetection({
    threshold: 25,
    autoCorrect: false, // Don't auto-correct, just detect
    alertThreshold: 1
  });
  
  // Load station data
  const stationData = {
    station: "45164",
    stationName: "Exmouth",
    data: [] // Your data here
  };
  
  const result = await outlierDetector.processStationData(stationData);
  
  if (result.hadOutliers) {
    console.log(`\n🚨 Found ${result.outliers.length} outliers that need manual review:`);
    result.outliers.forEach((outlier, i) => {
      console.log(`  ${i + 1}. ${outlier.timestamp}: ${outlier.rainfall_mm}mm`);
    });
    
    // You could save this for manual review
    // or implement custom correction logic here
  }
  
  return result;
}

// Example usage
if (require.main === module) {
  console.log('📖 Outlier Detection Integration Examples');
  console.log('='.repeat(50));
  console.log('');
  console.log('This file shows how to integrate outlier detection into your existing workflows.');
  console.log('');
  console.log('Key integration points:');
  console.log('1. Single station processing (download-ea-station.js)');
  console.log('2. Batch processing (download-ea-multi-stations.js)');
  console.log('3. GitHub Actions workflows');
  console.log('4. Manual correction workflows');
  console.log('');
  console.log('To integrate:');
  console.log('1. Import: const IntegratedOutlierDetection = require("./integrated-outlier-detection.js");');
  console.log('2. Create detector: const detector = new IntegratedOutlierDetection(options);');
  console.log('3. Process data: const result = await detector.processStationData(stationData);');
  console.log('4. Use corrected data: result.correctedData');
}

module.exports = {
  processSingleStationWithOutliers,
  processBatchWithOutliers,
  githubActionsIntegration,
  manualCorrectionWorkflow
};
