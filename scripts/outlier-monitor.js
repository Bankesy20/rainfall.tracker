#!/usr/bin/env node

/**
 * Comprehensive Outlier Detection and Correction System
 * This script can be run as part of existing workflows or as a standalone monitor
 */

const fs = require('fs').promises;
const path = require('path');
const dayjs = require('dayjs');

// Import the existing outlier detector
const RainfallOutlierDetector = require('./outlier-detection.js');

class OutlierMonitor {
  constructor(options = {}) {
    this.mode = options.mode || 'comprehensive'; // 'quick', 'comprehensive', 'area-based'
    this.threshold = options.threshold || 25;
    this.areaRadius = options.areaRadius || 30; // km
    this.daysBack = options.daysBack || 3;
    this.autoCorrect = options.autoCorrect || false;
    this.alertThreshold = options.alertThreshold || 5; // Alert if more than 5 outliers found
    
    this.detector = new RainfallOutlierDetector(this.threshold);
    this.results = {
      stationsProcessed: 0,
      stationsWithOutliers: 0,
      totalOutliers: 0,
      correctionsApplied: 0,
      alerts: []
    };
  }

  // Calculate distance between coordinates (Haversine formula)
  calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 6371; // Earth's radius in kilometers
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  // Find nearby stations for area-based validation
  async findNearbyStations(targetStation, allStations, radiusKm = 30) {
    const nearby = [];
    
    for (const [key, station] of Object.entries(allStations)) {
      if (station.coordinates && station.coordinates.lat && station.coordinates.lng) {
        const distance = this.calculateDistance(
          targetStation.coordinates.lat,
          targetStation.coordinates.lng,
          station.coordinates.lat,
          station.coordinates.lng
        );
        
        if (distance <= radiusKm && station.stationId !== targetStation.stationId) {
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

  // Load station data from various sources
  async loadStationData(stationId) {
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
    
    return null;
  }

  // Quick outlier detection (for integration with existing workflows)
  async quickDetection(stationData) {
    console.log(`🔍 Quick outlier detection for station ${stationData.station || 'unknown'}`);
    
    const result = this.detector.processStationData(stationData);
    
    if (result.hadOutliers) {
      this.results.stationsWithOutliers++;
      this.results.totalOutliers += result.outliers.length;
      
      console.log(`🚨 Found ${result.outliers.length} outliers in station ${stationData.station}`);
      
      if (this.autoCorrect) {
        this.results.correctionsApplied += result.corrections.length;
        console.log(`🔧 Applied ${result.corrections.length} corrections`);
      }
    }
    
    return result;
  }

  // Comprehensive area-based detection
  async comprehensiveDetection(stationData, allStations) {
    console.log(`🔍 Comprehensive detection for station ${stationData.station || 'unknown'}`);
    
    // First, run standard outlier detection
    const standardResult = await this.quickDetection(stationData);
    
    if (this.mode === 'comprehensive' && stationData.coordinates) {
      // Find nearby stations
      const nearbyStations = await this.findNearbyStations(
        { coordinates: stationData.coordinates, stationId: stationData.station },
        allStations,
        this.areaRadius
      );
      
      if (nearbyStations.length > 0) {
        console.log(`📍 Found ${nearbyStations.length} nearby stations for validation`);
        
        // Load nearby station data for comparison
        const nearbyData = {};
        for (const station of nearbyStations.slice(0, 5)) { // Limit to 5 closest
          const data = await this.loadStationData(station.stationId);
          if (data) {
            nearbyData[station.key] = data;
          }
        }
        
        // Perform area-based validation
        const areaValidation = await this.validateAgainstNearbyStations(
          stationData,
          nearbyData,
          standardResult.outliers
        );
        
        if (areaValidation.anomalies.length > 0) {
          this.results.alerts.push({
            station: stationData.station,
            type: 'area_anomaly',
            count: areaValidation.anomalies.length,
            message: `Station readings significantly higher than nearby stations`
          });
        }
      }
    }
    
    return standardResult;
  }

  // Validate readings against nearby stations
  async validateAgainstNearbyStations(stationData, nearbyStationsData, outliers) {
    const anomalies = [];
    const cutoffDate = dayjs().subtract(this.daysBack, 'day').startOf('day');
    
    for (const outlier of outliers) {
      const outlierTime = dayjs(outlier.timestamp);
      const timeWindow = 30; // 30 minutes
      
      let nearbyReadings = [];
      
      // Collect nearby readings in the same time window
      for (const [stationKey, stationData] of Object.entries(nearbyStationsData)) {
        if (!stationData) continue;
        
        stationData.data.forEach(record => {
          const recordTime = dayjs(record.dateTime || `${record.date} ${record.time}`);
          const timeDiff = Math.abs(recordTime.diff(outlierTime, 'minutes'));
          
          if (timeDiff <= timeWindow && recordTime.isAfter(cutoffDate)) {
            const rainfall = parseFloat(record.rainfall_mm) || 0;
            if (rainfall > 0) {
              nearbyReadings.push(rainfall);
            }
          }
        });
      }
      
      if (nearbyReadings.length > 0) {
        const avgNearby = nearbyReadings.reduce((a, b) => a + b, 0) / nearbyReadings.length;
        const ratio = outlier.rainfall_mm / Math.max(avgNearby, 0.1);
        
        if (ratio > 5) { // 5x higher than nearby average
          anomalies.push({
            timestamp: outlier.timestamp,
            stationReading: outlier.rainfall_mm,
            nearbyAverage: Math.round(avgNearby * 10) / 10,
            ratio: Math.round(ratio * 10) / 10,
            nearbyReadings: nearbyReadings.length
          });
        }
      }
    }
    
    return { anomalies };
  }

  // Process a single station
  async processStation(stationKey, stationInfo, allStations) {
    console.log(`\n📊 Processing station: ${stationInfo.name || stationKey}`);
    
    const stationData = await this.loadStationData(stationInfo.stationId);
    if (!stationData) {
      console.log(`⚠️  Could not load data for station ${stationKey}`);
      return null;
    }
    
    // Add coordinates if available
    if (stationInfo.coordinates) {
      stationData.coordinates = stationInfo.coordinates;
    }
    
    let result;
    if (this.mode === 'quick') {
      result = await this.quickDetection(stationData);
    } else {
      result = await this.comprehensiveDetection(stationData, allStations);
    }
    
    this.results.stationsProcessed++;
    
    return {
      stationKey,
      stationInfo,
      result,
      hadOutliers: result.hadOutliers,
      outlierCount: result.outliers ? result.outliers.length : 0
    };
  }

  // Main monitoring function
  async run() {
    console.log(`🚀 Starting outlier monitoring (mode: ${this.mode})`);
    console.log(`📊 Threshold: ${this.threshold}mm, Area radius: ${this.areaRadius}km`);
    
    // Load stations metadata
    const metadataPath = 'data/processed/stations-metadata.json';
    const metadata = JSON.parse(await fs.readFile(metadataPath, 'utf8'));
    
    const stationResults = [];
    const stationsToProcess = Object.entries(metadata.stations);
    
    console.log(`📈 Processing ${stationsToProcess.length} stations...`);
    
    // Process stations in batches to avoid overwhelming the system
    const batchSize = 10;
    for (let i = 0; i < stationsToProcess.length; i += batchSize) {
      const batch = stationsToProcess.slice(i, i + batchSize);
      
      const batchPromises = batch.map(([stationKey, stationInfo]) => 
        this.processStation(stationKey, stationInfo, metadata.stations)
      );
      
      const batchResults = await Promise.all(batchPromises);
      stationResults.push(...batchResults.filter(result => result !== null));
      
      console.log(`✅ Processed batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(stationsToProcess.length / batchSize)}`);
    }
    
    // Generate summary
    this.generateSummary(stationResults);
    
    return {
      results: this.results,
      stationResults: stationResults.filter(r => r.hadOutliers)
    };
  }

  // Generate monitoring summary
  generateSummary(stationResults) {
    console.log('\n📊 OUTLIER MONITORING SUMMARY');
    console.log('='.repeat(50));
    console.log(`Stations processed: ${this.results.stationsProcessed}`);
    console.log(`Stations with outliers: ${this.results.stationsWithOutliers}`);
    console.log(`Total outliers found: ${this.results.totalOutliers}`);
    console.log(`Corrections applied: ${this.results.correctionsApplied}`);
    
    if (this.results.alerts.length > 0) {
      console.log(`\n🚨 ALERTS (${this.results.alerts.length}):`);
      this.results.alerts.forEach(alert => {
        console.log(`  - ${alert.station}: ${alert.message}`);
      });
    }
    
    // Show stations with most outliers
    const topOutlierStations = stationResults
      .filter(r => r.hadOutliers)
      .sort((a, b) => b.outlierCount - a.outlierCount)
      .slice(0, 5);
    
    if (topOutlierStations.length > 0) {
      console.log('\n🔝 TOP OUTLIER STATIONS:');
      topOutlierStations.forEach((station, index) => {
        console.log(`  ${index + 1}. ${station.stationInfo.name}: ${station.outlierCount} outliers`);
      });
    }
    
    // Alert if too many outliers found
    if (this.results.totalOutliers > this.alertThreshold) {
      console.log(`\n⚠️  ALERT: ${this.results.totalOutliers} outliers found (threshold: ${this.alertThreshold})`);
    }
  }

  // Save monitoring report
  async saveReport(monitoringResults) {
    const report = {
      generatedAt: new Date().toISOString(),
      mode: this.mode,
      threshold: this.threshold,
      areaRadius: this.areaRadius,
      results: this.results,
      stationResults: monitoringResults.stationResults
    };
    
    const reportPath = `outlier-monitoring-report-${Date.now()}.json`;
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
    console.log(`\n💾 Monitoring report saved to: ${reportPath}`);
    
    return reportPath;
  }
}

// CLI usage
if (require.main === module) {
  const args = process.argv.slice(2);
  
  const options = {
    mode: args.includes('--quick') ? 'quick' : 
           args.includes('--area') ? 'comprehensive' : 'comprehensive',
    threshold: parseInt(args.find(arg => arg.startsWith('--threshold='))?.split('=')[1]) || 25,
    areaRadius: parseInt(args.find(arg => arg.startsWith('--radius='))?.split('=')[1]) || 30,
    autoCorrect: args.includes('--auto-correct'),
    alertThreshold: parseInt(args.find(arg => arg.startsWith('--alert='))?.split('=')[1]) || 5
  };
  
  const monitor = new OutlierMonitor(options);
  
  monitor.run()
    .then(async (results) => {
      await monitor.saveReport(results);
      console.log('\n✅ Outlier monitoring completed successfully!');
    })
    .catch(error => {
      console.error('\n❌ Outlier monitoring failed:', error.message);
      process.exit(1);
    });
}

module.exports = OutlierMonitor;
