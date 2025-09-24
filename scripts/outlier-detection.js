const fs = require('fs').promises;
const path = require('path');
const dayjs = require('dayjs');

/**
 * Outlier Detection and Correction Utilities for Rainfall Data
 * Detects and corrects rainfall measurements > 25mm in 15-minute intervals
 */

class RainfallOutlierDetector {
  constructor(threshold = 25) {
    this.threshold = threshold; // Default 25mm in 15 minutes
    this.detectedOutliers = [];
    this.correctedCount = 0;
  }

  /**
   * Detect outliers in rainfall data
   * @param {Array} data - Array of rainfall measurements
   * @returns {Array} Array of outlier records
   */
  detectOutliers(data) {
    const outliers = [];
    
    for (let i = 0; i < data.length; i++) {
      const record = data[i];
      const rainfall = parseFloat(record.rainfall_mm) || 0;
      
      if (rainfall > this.threshold) {
        outliers.push({
          index: i,
          record: record,
          rainfall_mm: rainfall,
          reason: `Rainfall ${rainfall}mm exceeds threshold of ${this.threshold}mm in 15-minute interval`,
          timestamp: record.dateTime || `${record.date} ${record.time}`,
          station: record.station || record.stationName || 'unknown'
        });
      }
    }
    
    return outliers;
  }

  /**
   * Correct outliers using intelligent interpolation
   * @param {Array} data - Array of rainfall measurements
   * @param {Array} outliers - Array of detected outliers
   * @returns {Array} Corrected data array
   */
  correctOutliers(data, outliers) {
    const correctedData = [...data];
    const corrections = [];
    
    for (const outlier of outliers) {
      const index = outlier.index;
      const correctedValue = this.calculateCorrectedValue(data, index);
      
      // Store original value for logging
      const originalValue = correctedData[index].rainfall_mm;
      
      // Apply correction
      correctedData[index] = {
        ...correctedData[index],
        rainfall_mm: correctedValue,
        original_rainfall_mm: originalValue,
        corrected: true,
        correction_reason: 'Outlier detected and corrected via interpolation',
        correction_timestamp: new Date().toISOString()
      };
      
      // Update total_mm if it exists
      if (correctedData[index].total_mm !== undefined) {
        const difference = correctedValue - originalValue;
        this.adjustTotalsFromIndex(correctedData, index, difference);
      }
      
      corrections.push({
        index,
        station: outlier.station,
        timestamp: outlier.timestamp,
        original: originalValue,
        corrected: correctedValue,
        method: this.getInterpolationMethod(data, index)
      });
      
      this.correctedCount++;
    }
    
    return { correctedData, corrections };
  }

  /**
   * Calculate corrected value using intelligent interpolation
   * @param {Array} data - Full data array
   * @param {number} index - Index of outlier
   * @returns {number} Corrected value
   */
  calculateCorrectedValue(data, index) {
    const windowSize = 6; // Look at 3 points before and after (1.5 hours each side)
    
    // Method 1: Local median (preferred)
    const localValues = this.getLocalValues(data, index, windowSize);
    if (localValues.length >= 3) {
      return this.calculateMedian(localValues);
    }
    
    // Method 2: Linear interpolation between nearest valid points
    const { prev, next } = this.findNearestValidPoints(data, index);
    if (prev !== null && next !== null) {
      return this.linearInterpolate(data[prev].rainfall_mm, data[next].rainfall_mm);
    }
    
    // Method 3: Use previous valid value
    if (prev !== null) {
      return parseFloat(data[prev].rainfall_mm) || 0;
    }
    
    // Method 4: Use next valid value
    if (next !== null) {
      return parseFloat(data[next].rainfall_mm) || 0;
    }
    
    // Fallback: Return 0
    return 0;
  }

  /**
   * Get local values around the outlier (excluding outliers)
   * @param {Array} data - Full data array
   * @param {number} index - Index of outlier
   * @param {number} windowSize - Size of window to check
   * @returns {Array} Array of valid local values
   */
  getLocalValues(data, index, windowSize) {
    const values = [];
    const start = Math.max(0, index - windowSize);
    const end = Math.min(data.length - 1, index + windowSize);
    
    for (let i = start; i <= end; i++) {
      if (i === index) continue; // Skip the outlier itself
      
      const value = parseFloat(data[i].rainfall_mm) || 0;
      // Only include reasonable values (not outliers)
      if (value <= this.threshold) {
        values.push(value);
      }
    }
    
    return values;
  }

  /**
   * Find nearest valid (non-outlier) points
   * @param {Array} data - Full data array
   * @param {number} index - Index of outlier
   * @returns {Object} {prev: index, next: index}
   */
  findNearestValidPoints(data, index) {
    let prev = null;
    let next = null;
    
    // Look backwards
    for (let i = index - 1; i >= 0; i--) {
      const value = parseFloat(data[i].rainfall_mm) || 0;
      if (value <= this.threshold) {
        prev = i;
        break;
      }
    }
    
    // Look forwards
    for (let i = index + 1; i < data.length; i++) {
      const value = parseFloat(data[i].rainfall_mm) || 0;
      if (value <= this.threshold) {
        next = i;
        break;
      }
    }
    
    return { prev, next };
  }

  /**
   * Calculate median of array
   * @param {Array} values - Array of numbers
   * @returns {number} Median value
   */
  calculateMedian(values) {
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    
    if (sorted.length % 2 === 0) {
      return (sorted[mid - 1] + sorted[mid]) / 2;
    } else {
      return sorted[mid];
    }
  }

  /**
   * Linear interpolation between two values
   * @param {number} prev - Previous value
   * @param {number} next - Next value
   * @returns {number} Interpolated value
   */
  linearInterpolate(prev, next) {
    return (parseFloat(prev) + parseFloat(next)) / 2;
  }

  /**
   * Adjust running totals from a given index onwards
   * @param {Array} data - Data array
   * @param {number} fromIndex - Index to start adjusting from
   * @param {number} difference - Difference to apply
   */
  adjustTotalsFromIndex(data, fromIndex, difference) {
    for (let i = fromIndex; i < data.length; i++) {
      if (data[i].total_mm !== undefined) {
        data[i].total_mm = Math.max(0, parseFloat(data[i].total_mm) + difference);
      }
    }
  }

  /**
   * Get description of interpolation method used
   * @param {Array} data - Full data array
   * @param {number} index - Index of corrected value
   * @returns {string} Method description
   */
  getInterpolationMethod(data, index) {
    const localValues = this.getLocalValues(data, index, 6);
    if (localValues.length >= 3) {
      return `Local median of ${localValues.length} nearby values`;
    }
    
    const { prev, next } = this.findNearestValidPoints(data, index);
    if (prev !== null && next !== null) {
      return 'Linear interpolation between nearest valid points';
    }
    
    if (prev !== null) {
      return 'Previous valid value';
    }
    
    if (next !== null) {
      return 'Next valid value';
    }
    
    return 'Fallback to zero';
  }

  /**
   * Process a single station's data for outliers
   * @param {Object} stationData - Station data object
   * @returns {Object} Processed results
   */
  processStationData(stationData) {
    console.log(`🔍 Analyzing station: ${stationData.station || 'unknown'}`);
    
    if (!stationData.data || !Array.isArray(stationData.data)) {
      throw new Error('Invalid station data structure');
    }
    
    const outliers = this.detectOutliers(stationData.data);
    console.log(`📊 Found ${outliers.length} outliers (>${this.threshold}mm in 15min)`);
    
    if (outliers.length === 0) {
      return {
        hadOutliers: false,
        originalData: stationData,
        correctedData: stationData,
        outliers: [],
        corrections: []
      };
    }
    
    // Log outliers for review
    console.log('🚨 Detected outliers:');
    outliers.forEach((outlier, i) => {
      console.log(`  ${i + 1}. ${outlier.timestamp}: ${outlier.rainfall_mm}mm (Station: ${outlier.station})`);
    });
    
    const { correctedData, corrections } = this.correctOutliers(stationData.data, outliers);
    
    const result = {
      ...stationData,
      data: correctedData,
      outlierDetection: {
        detectedAt: new Date().toISOString(),
        threshold: this.threshold,
        outliersFound: outliers.length,
        correctionsMade: corrections.length,
        correctionMethod: 'intelligent_interpolation'
      }
    };
    
    console.log(`✅ Applied ${corrections.length} corrections`);
    
    return {
      hadOutliers: true,
      originalData: stationData,
      correctedData: result,
      outliers,
      corrections
    };
  }

  /**
   * Generate a detailed report of outliers and corrections
   * @param {Array} allResults - Results from processing multiple stations
   * @returns {Object} Comprehensive report
   */
  generateReport(allResults) {
    const report = {
      generatedAt: new Date().toISOString(),
      threshold: this.threshold,
      summary: {
        stationsProcessed: allResults.length,
        stationsWithOutliers: allResults.filter(r => r.hadOutliers).length,
        totalOutliersFound: allResults.reduce((sum, r) => sum + r.outliers.length, 0),
        totalCorrections: allResults.reduce((sum, r) => sum + r.corrections.length, 0)
      },
      stationDetails: allResults.filter(r => r.hadOutliers).map(result => ({
        station: result.correctedData.station,
        stationName: result.correctedData.stationName,
        outliersFound: result.outliers.length,
        corrections: result.corrections.map(c => ({
          timestamp: c.timestamp,
          originalValue: c.original,
          correctedValue: c.corrected,
          method: c.method
        }))
      }))
    };
    
    return report;
  }
}

module.exports = RainfallOutlierDetector;

// CLI usage if run directly
if (require.main === module) {
  const detector = new RainfallOutlierDetector(25);
  
  async function processFile() {
    const filePath = process.argv[2];
    
    if (!filePath) {
      console.log('Usage: node outlier-detection.js <path-to-json-file>');
      console.log('Example: node outlier-detection.js ../data/processed/ea-031555.json');
      process.exit(1);
    }
    
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const data = JSON.parse(content);
      
      const result = detector.processStationData(data);
      
      if (result.hadOutliers) {
        // Save corrected data
        const outputPath = filePath.replace('.json', '-corrected.json');
        await fs.writeFile(outputPath, JSON.stringify(result.correctedData, null, 2));
        console.log(`💾 Corrected data saved to: ${outputPath}`);
        
        // Save detailed report
        const reportPath = filePath.replace('.json', '-outlier-report.json');
        const report = detector.generateReport([result]);
        await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
        console.log(`📋 Detailed report saved to: ${reportPath}`);
      } else {
        console.log('✅ No outliers detected in this station data');
      }
      
    } catch (error) {
      console.error('❌ Error:', error.message);
      process.exit(1);
    }
  }
  
  processFile();
}
