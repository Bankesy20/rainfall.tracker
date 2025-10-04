#!/usr/bin/env node

/**
 * Integrated Outlier Detection for Existing Workflows
 * This script can be easily integrated into existing data processing workflows
 * to provide real-time outlier detection and correction
 */

const RainfallOutlierDetector = require('./outlier-detection.js');

class IntegratedOutlierDetection {
  constructor(options = {}) {
    this.threshold = options.threshold || 25;
    this.autoCorrect = options.autoCorrect !== false; // Default to true
    this.areaValidation = options.areaValidation || false;
    this.alertThreshold = options.alertThreshold || 5;
    
    this.detector = new RainfallOutlierDetector(this.threshold);
    this.stats = {
      stationsProcessed: 0,
      stationsWithOutliers: 0,
      totalOutliers: 0,
      correctionsApplied: 0
    };
  }

  // Main processing function - designed to be called from existing workflows
  async processStationData(stationData, options = {}) {
    const stationId = stationData.station || stationData.stationId || 'unknown';
    const stationName = stationData.stationName || stationData.name || stationId;
    
    console.log(`🔍 Processing outliers for ${stationName} (${stationId})`);
    
    try {
      // Run outlier detection
      const result = this.detector.processStationData(stationData);
      
      this.stats.stationsProcessed++;
      
      if (result.hadOutliers) {
        this.stats.stationsWithOutliers++;
        this.stats.totalOutliers += result.outliers.length;
        
        console.log(`🚨 Found ${result.outliers.length} outliers in ${stationName}`);
        
        // Log outliers for transparency
        result.outliers.forEach((outlier, i) => {
          console.log(`  ${i + 1}. ${outlier.timestamp}: ${outlier.rainfall_mm}mm`);
        });
        
        if (this.autoCorrect) {
          this.stats.correctionsApplied += result.corrections.length;
          console.log(`🔧 Applied ${result.corrections.length} corrections`);
          
          // Log corrections
          result.corrections.forEach(correction => {
            console.log(`  Fixed: ${correction.timestamp} ${correction.original}mm → ${correction.corrected}mm`);
          });
        }
        
        // Check if this exceeds alert threshold
        if (result.outliers.length > this.alertThreshold) {
          console.log(`⚠️  ALERT: ${result.outliers.length} outliers found in ${stationName} (threshold: ${this.alertThreshold})`);
        }
      } else {
        console.log(`✅ No outliers detected in ${stationName}`);
      }
      
      return result;
      
    } catch (error) {
      console.error(`❌ Error processing outliers for ${stationName}:`, error.message);
      return {
        hadOutliers: false,
        originalData: stationData,
        correctedData: stationData,
        outliers: [],
        corrections: [],
        error: error.message
      };
    }
  }

  // Process multiple stations (for batch workflows)
  async processMultipleStations(stationsData) {
    console.log(`\n🔍 Processing outliers for ${stationsData.length} stations...`);
    
    const results = [];
    
    for (const stationData of stationsData) {
      const result = await this.processStationData(stationData);
      results.push(result);
    }
    
    this.printSummary();
    return results;
  }

  // Print processing summary
  printSummary() {
    console.log('\n📊 OUTLIER DETECTION SUMMARY');
    console.log('='.repeat(40));
    console.log(`Stations processed: ${this.stats.stationsProcessed}`);
    console.log(`Stations with outliers: ${this.stats.stationsWithOutliers}`);
    console.log(`Total outliers found: ${this.stats.totalOutliers}`);
    console.log(`Corrections applied: ${this.stats.correctionsApplied}`);
    
    if (this.stats.totalOutliers > 0) {
      const correctionRate = Math.round((this.stats.correctionsApplied / this.stats.totalOutliers) * 100);
      console.log(`Correction rate: ${correctionRate}%`);
    }
  }

  // Get processing statistics
  getStats() {
    return { ...this.stats };
  }

  // Reset statistics (useful for batch processing)
  resetStats() {
    this.stats = {
      stationsProcessed: 0,
      stationsWithOutliers: 0,
      totalOutliers: 0,
      correctionsApplied: 0
    };
  }
}

// Export for use in other scripts
module.exports = IntegratedOutlierDetection;

// CLI usage for testing
if (require.main === module) {
  const args = process.argv.slice(2);
  
  const options = {
    threshold: parseInt(args.find(arg => arg.startsWith('--threshold='))?.split('=')[1]) || 25,
    autoCorrect: !args.includes('--no-auto-correct'),
    alertThreshold: parseInt(args.find(arg => arg.startsWith('--alert='))?.split('=')[1]) || 5
  };
  
  console.log('🔧 Integrated Outlier Detection');
  console.log(`📊 Threshold: ${options.threshold}mm`);
  console.log(`🔧 Auto-correct: ${options.autoCorrect ? 'enabled' : 'disabled'}`);
  console.log(`⚠️  Alert threshold: ${options.alertThreshold} outliers`);
  
  const detector = new IntegratedOutlierDetection(options);
  
  // Example usage - this would be called from your existing workflows
  console.log('\n💡 This script is designed to be imported and used in existing workflows.');
  console.log('📖 Example usage:');
  console.log('  const IntegratedOutlierDetection = require("./integrated-outlier-detection.js");');
  console.log('  const detector = new IntegratedOutlierDetection({ threshold: 25, autoCorrect: true });');
  console.log('  const result = await detector.processStationData(stationData);');
}
