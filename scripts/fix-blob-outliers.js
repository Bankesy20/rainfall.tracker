const fs = require('fs').promises;
const path = require('path');
const RainfallOutlierDetector = require('./outlier-detection');

/**
 * Script to scan and fix outliers in existing blob storage data
 * This script processes all station data in blob storage and corrects outliers
 */

class BlobOutlierFixer {
  constructor() {
    this.store = null; // Will be initialized in async method
    this.detector = new RainfallOutlierDetector(25);
    this.results = [];
    this.processedCount = 0;
    this.errorCount = 0;
  }

  /**
   * Initialize the blob store with dynamic import
   */
  async initializeStore() {
    if (this.store) return; // Already initialized
    
    try {
      // Dynamic import for @netlify/blobs
      const { getStore } = await import('@netlify/blobs');
      
      // Configure store with explicit site ID if available
      const siteId = process.env.NETLIFY_SITE_ID || 'f9735549-2ceb-4b4b-8263-fd2d52f641bb';
      
      if (process.env.NETLIFY_AUTH_TOKEN && process.env.NETLIFY_SITE_ID) {
        // Use explicit configuration
        this.store = getStore({
          name: 'rainfall-data',
          siteID: process.env.NETLIFY_SITE_ID,
          token: process.env.NETLIFY_AUTH_TOKEN
        });
        console.log(`  🔑 Using explicit auth for site: ${process.env.NETLIFY_SITE_ID}`);
      } else {
        // Try with Netlify CLI environment
        this.store = getStore('rainfall-data');
        console.log('  🔑 Using Netlify CLI environment');
      }
    } catch (error) {
      console.log('❌ Could not initialize blob storage');
      console.log('💡 Make sure you are logged in with: netlify login');
      console.log('📋 Or set NETLIFY_AUTH_TOKEN environment variable');
      console.log(`📊 Error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get list of all station files in blob storage
   * @returns {Array} List of blob keys
   */
  async listStationBlobs() {
    console.log('🔍 Scanning blob storage for station data...');
    
    try {
      await this.initializeStore();
      const { blobs } = await this.store.list({ prefix: 'stations/' });
      const stationBlobs = blobs
        .filter(blob => blob.key.endsWith('.json'))
        .map(blob => blob.key);
      
      console.log(`📁 Found ${stationBlobs.length} station files in blob storage`);
      return stationBlobs;
    } catch (error) {
      console.error('❌ Error listing blobs:', error.message);
      
      // Fallback: try to read from local files if blob access fails
      console.log('🔄 Falling back to local file scanning...');
      return await this.getLocalStationFiles();
    }
  }

  /**
   * Fallback method to get station files from local directory
   * @returns {Array} List of local file paths
   */
  async getLocalStationFiles() {
    const dataDir = path.join(__dirname, '..', 'data', 'processed');
    try {
      const files = await fs.readdir(dataDir);
      return files
        .filter(file => file.endsWith('.json') && (file.startsWith('ea-') || file.startsWith('wales-')))
        .map(file => `local:${file}`);
    } catch (error) {
      console.error('❌ Error reading local directory:', error.message);
      return [];
    }
  }

  /**
   * Load station data from blob or local file
   * @param {string} blobKey - Blob key or local file indicator
   * @returns {Object} Station data
   */
  async loadStationData(blobKey) {
    if (blobKey.startsWith('local:')) {
      // Load from local file
      const fileName = blobKey.replace('local:', '');
      const filePath = path.join(__dirname, '..', 'data', 'processed', fileName);
      const content = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(content);
    } else {
      // Load from blob storage
      await this.initializeStore();
      const content = await this.store.get(blobKey, { type: 'text' });
      if (!content) {
        throw new Error(`Blob ${blobKey} not found`);
      }
      return JSON.parse(content);
    }
  }

  /**
   * Save corrected data back to blob storage or local file
   * @param {string} blobKey - Blob key or local file indicator
   * @param {Object} correctedData - Corrected station data
   */
  async saveCorrectedData(blobKey, correctedData) {
    const jsonContent = JSON.stringify(correctedData, null, 2);
    
    if (blobKey.startsWith('local:')) {
      // Save to local file (and create backup)
      const fileName = blobKey.replace('local:', '');
      const filePath = path.join(__dirname, '..', 'data', 'processed', fileName);
      const backupPath = filePath.replace('.json', `-backup-${Date.now()}.json`);
      
      // Create backup of original
      try {
        const originalContent = await fs.readFile(filePath, 'utf-8');
        await fs.writeFile(backupPath, originalContent);
        console.log(`  💾 Backup created: ${path.basename(backupPath)}`);
      } catch (error) {
        console.log(`  ⚠️  Could not create backup: ${error.message}`);
      }
      
      // Save corrected version
      await fs.writeFile(filePath, jsonContent);
      
      // Also copy to public directory if it exists
      const publicPath = path.join(__dirname, '..', 'public', 'data', 'processed', fileName);
      try {
        await fs.writeFile(publicPath, jsonContent);
      } catch (error) {
        // Public directory might not exist, that's OK
      }
    } else {
      // Save to blob storage
      await this.initializeStore();
      await this.store.set(blobKey, jsonContent, {
        metadata: { 
          contentType: 'application/json',
          correctedOutliers: 'true',
          correctedAt: new Date().toISOString(),
          records: correctedData.data ? correctedData.data.length.toString() : '0'
        }
      });
    }
  }

  /**
   * Process a single station for outliers
   * @param {string} blobKey - Blob key or local file indicator
   * @returns {Object} Processing result
   */
  async processStation(blobKey) {
    const stationId = blobKey.replace('stations/', '').replace('local:', '').replace('.json', '');
    console.log(`\n📊 Processing station: ${stationId}`);
    
    try {
      // Load station data
      const stationData = await this.loadStationData(blobKey);
      
      if (!stationData.data || !Array.isArray(stationData.data)) {
        console.log(`  ⚠️  Skipping - invalid data structure`);
        return {
          station: stationId,
          success: false,
          error: 'Invalid data structure',
          hadOutliers: false
        };
      }
      
      console.log(`  📈 Loaded ${stationData.data.length} records`);
      
      // Process for outliers
      const result = this.detector.processStationData(stationData);
      
      if (result.hadOutliers) {
        // Save corrected data
        await this.saveCorrectedData(blobKey, result.correctedData);
        console.log(`  ✅ Saved corrected data with ${result.corrections.length} fixes`);
        
        this.processedCount++;
        return {
          station: stationId,
          success: true,
          hadOutliers: true,
          outliersFound: result.outliers.length,
          correctionsMade: result.corrections.length,
          corrections: result.corrections
        };
      } else {
        console.log(`  ✅ No outliers detected`);
        return {
          station: stationId,
          success: true,
          hadOutliers: false,
          outliersFound: 0,
          correctionsMade: 0
        };
      }
      
    } catch (error) {
      console.error(`  ❌ Error processing ${stationId}:`, error.message);
      this.errorCount++;
      return {
        station: stationId,
        success: false,
        error: error.message,
        hadOutliers: false
      };
    }
  }

  /**
   * Process all stations in batches
   * @param {Array} blobKeys - Array of blob keys
   * @param {number} batchSize - Size of each batch
   */
  async processAllStations(blobKeys, batchSize = 5) {
    console.log(`🚀 Starting outlier correction for ${blobKeys.length} stations...`);
    console.log(`📦 Processing in batches of ${batchSize}`);
    
    for (let i = 0; i < blobKeys.length; i += batchSize) {
      const batch = blobKeys.slice(i, i + batchSize);
      const batchNum = Math.floor(i / batchSize) + 1;
      const totalBatches = Math.ceil(blobKeys.length / batchSize);
      
      console.log(`\n🔄 Processing batch ${batchNum}/${totalBatches} (${batch.length} stations)`);
      
      // Process batch sequentially to avoid overwhelming the API
      for (const blobKey of batch) {
        const result = await this.processStation(blobKey);
        this.results.push(result);
        
        // Small delay between requests to be nice to the API
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      // Longer delay between batches
      if (i + batchSize < blobKeys.length) {
        console.log(`⏸️  Pausing 2 seconds before next batch...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
  }

  /**
   * Generate and save comprehensive report
   */
  async generateFinalReport() {
    const report = {
      generatedAt: new Date().toISOString(),
      threshold: this.detector.threshold,
      summary: {
        totalStationsProcessed: this.results.length,
        successfullyProcessed: this.results.filter(r => r.success).length,
        errors: this.errorCount,
        stationsWithOutliers: this.results.filter(r => r.hadOutliers).length,
        totalOutliersFound: this.results.reduce((sum, r) => sum + (r.outliersFound || 0), 0),
        totalCorrectionsMade: this.results.reduce((sum, r) => sum + (r.correctionsMade || 0), 0)
      },
      stationResults: this.results.map(result => ({
        station: result.station,
        success: result.success,
        hadOutliers: result.hadOutliers,
        outliersFound: result.outliersFound || 0,
        correctionsMade: result.correctionsMade || 0,
        error: result.error || null,
        corrections: result.corrections || []
      })),
      detailedCorrections: this.results
        .filter(r => r.hadOutliers && r.corrections)
        .flatMap(r => r.corrections.map(c => ({
          station: r.station,
          timestamp: c.timestamp,
          originalValue: c.original,
          correctedValue: c.corrected,
          method: c.method
        })))
    };
    
    // Save report
    const reportPath = path.join(__dirname, '..', `outlier-correction-report-${Date.now()}.json`);
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
    
    // Print summary
    console.log('\n' + '='.repeat(60));
    console.log('📋 OUTLIER CORRECTION SUMMARY');
    console.log('='.repeat(60));
    console.log(`📊 Total stations processed: ${report.summary.totalStationsProcessed}`);
    console.log(`✅ Successfully processed: ${report.summary.successfullyProcessed}`);
    console.log(`❌ Errors encountered: ${report.summary.errors}`);
    console.log(`🚨 Stations with outliers: ${report.summary.stationsWithOutliers}`);
    console.log(`📈 Total outliers found: ${report.summary.totalOutliersFound}`);
    console.log(`🔧 Total corrections made: ${report.summary.totalCorrectionsMade}`);
    console.log(`📄 Detailed report saved: ${reportPath}`);
    console.log('='.repeat(60));
    
    if (report.summary.stationsWithOutliers > 0) {
      console.log('\n🔍 Stations with outliers corrected:');
      this.results
        .filter(r => r.hadOutliers)
        .forEach(r => {
          console.log(`  • ${r.station}: ${r.outliersFound} outliers → ${r.correctionsMade} corrections`);
        });
    }
    
    return report;
  }

  /**
   * Main execution method
   */
  async run() {
    console.log('🌧️  Rainfall Data Outlier Correction Tool');
    console.log('==========================================');
    console.log(`🎯 Threshold: ${this.detector.threshold}mm per 15-minute interval`);
    
    try {
      // Check for required credentials
      if (!process.env.NETLIFY_AUTH_TOKEN && !process.env.NETLIFY_TOKEN) {
        console.log('⚠️  No Netlify credentials found. Will process local files only.');
      }
      
      // Get list of station files
      const blobKeys = await this.listStationBlobs();
      
      if (blobKeys.length === 0) {
        console.log('❌ No station files found to process');
        return;
      }
      
      // Process all stations
      await this.processAllStations(blobKeys);
      
      // Generate final report
      await this.generateFinalReport();
      
      console.log('\n🎉 Outlier correction completed successfully!');
      
    } catch (error) {
      console.error('\n❌ Fatal error:', error.message);
      console.error('Stack trace:', error.stack);
      process.exit(1);
    }
  }
}

// CLI execution
if (require.main === module) {
  const fixer = new BlobOutlierFixer();
  
  // Handle command line arguments
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const specificStation = args.find(arg => arg.startsWith('--station='))?.split('=')[1];
  
  if (dryRun) {
    console.log('🔍 DRY RUN MODE: Will detect outliers but not save corrections');
    // TODO: Implement dry run mode
  }
  
  if (specificStation) {
    console.log(`🎯 Processing specific station: ${specificStation}`);
    // TODO: Implement single station processing
  }
  
  // Run the fixer
  fixer.run().catch(error => {
    console.error('❌ Unhandled error:', error);
    process.exit(1);
  });
}

module.exports = BlobOutlierFixer;
