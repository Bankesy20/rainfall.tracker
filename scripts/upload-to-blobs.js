#!/usr/bin/env node

/**
 * Upload existing rainfall data to Netlify Blobs
 * This script safely uploads your current JSON files to blob storage
 */

const fs = require('fs').promises;
const path = require('path');

// Station mapping
const STATIONS = {
  'miserden1141': {
    file: 'rainfall-history.json',
    description: 'Miserden EA Station'
  },
  'maenclochog1099': {
    file: 'wales-1099.json', 
    description: 'Maenclochog NRW Station'
  }
};

async function uploadToBlobs() {
  console.log('🚀 Starting blob upload process...');
  
  // Check if we're in the right environment
  if (!process.env.NETLIFY_TOKEN && !process.env.NETLIFY) {
    console.log('⚠️  Warning: This script works best in a Netlify environment');
    console.log('💡 For local testing, make sure you have netlify-cli installed and are logged in');
  }

  // Dynamic import for @netlify/blobs
  const { getStore } = await import('@netlify/blobs');
  
  // Configure store with explicit site ID if available
  const siteId = process.env.NETLIFY_SITE_ID || 'f9735549-2ceb-4b4b-8263-fd2d52f641bb';
  
  let store;
  try {
    if (process.env.NETLIFY_AUTH_TOKEN && process.env.NETLIFY_SITE_ID) {
      // Use explicit configuration
      store = getStore({
        name: 'rainfall-data',
        siteID: process.env.NETLIFY_SITE_ID,
        token: process.env.NETLIFY_AUTH_TOKEN
      });
      console.log(`  🔑 Using explicit auth for site: ${process.env.NETLIFY_SITE_ID}`);
    } else {
      // Try with Netlify CLI environment
      store = getStore('rainfall-data');
      console.log('  🔑 Using Netlify CLI environment');
    }
  } catch (error) {
    console.log('❌ Could not initialize blob storage');
    console.log('💡 Make sure you are logged in with: netlify login');
    console.log('📋 Or set NETLIFY_AUTH_TOKEN environment variable');
    console.log(`📊 Error: ${error.message}`);
    throw error;
  }
  const dataDir = path.join(__dirname, '..', 'data', 'processed');
  
  let successCount = 0;
  let errorCount = 0;
  const results = [];

  for (const [stationKey, config] of Object.entries(STATIONS)) {
    console.log(`\n📊 Processing ${config.description} (${stationKey})...`);
    
    try {
      // Read the local JSON file
      const filePath = path.join(dataDir, config.file);
      const fileContent = await fs.readFile(filePath, 'utf-8');
      const jsonData = JSON.parse(fileContent);
      
      // Validate the data structure
      if (!jsonData.data || !Array.isArray(jsonData.data)) {
        throw new Error(`Invalid data structure in ${config.file}`);
      }
      
      const recordCount = jsonData.data.length;
      const fileSize = Buffer.byteLength(fileContent, 'utf8');
      
      console.log(`  📁 File: ${config.file}`);
      console.log(`  📈 Records: ${recordCount.toLocaleString()}`);
      console.log(`  💾 Size: ${(fileSize / 1024).toFixed(1)} KB`);
      
      // Upload to blob storage
      const blobKey = `stations/${stationKey}.json`;
      console.log(`  ☁️  Uploading to: ${blobKey}`);
      
      // Add metadata for tracking
      const blobData = {
        ...jsonData,
        uploadedAt: new Date().toISOString(),
        source: 'local-file',
        originalFile: config.file,
        stationKey: stationKey
      };
      
      // Store as JSON string
      await store.set(blobKey, JSON.stringify(blobData), {
        metadata: { 
          contentType: 'application/json',
          station: stationKey,
          records: recordCount.toString()
        }
      });
      
      // Verify the upload
      try {
        const uploaded = await store.get(blobKey);
        const parsedData = typeof uploaded === 'string' ? JSON.parse(uploaded) : uploaded;
        if (!parsedData || !parsedData.data) {
          throw new Error('Upload verification failed - no data found');
        }
        console.log(`  🔍 Verification: Found ${parsedData.data.length} records`);
      } catch (verifyError) {
        console.log(`  ⚠️  Verification failed, but upload may have succeeded: ${verifyError.message}`);
        // Don't throw here - the upload might have worked even if verification failed
      }
      
      console.log(`  ✅ Successfully uploaded ${recordCount.toLocaleString()} records`);
      
      results.push({
        station: stationKey,
        success: true,
        records: recordCount,
        size: fileSize,
        blobKey: blobKey
      });
      
      successCount++;
      
    } catch (error) {
      console.error(`  ❌ Error uploading ${stationKey}:`);
      console.error(`  📊 Error message: ${error.message}`);
      console.error(`  📋 Error details:`, error);
      
      results.push({
        station: stationKey,
        success: false,
        error: error.message
      });
      
      errorCount++;
    }
  }
  
  // Upload metadata about the upload process
  try {
    const metadata = {
      uploadedAt: new Date().toISOString(),
      totalStations: Object.keys(STATIONS).length,
      successfulUploads: successCount,
      failedUploads: errorCount,
      results: results,
      version: '1.0.0'
    };
    
    await store.set('metadata/upload-log.json', metadata);
    console.log('\n📋 Upload metadata saved');
    
  } catch (error) {
    console.error('\n⚠️  Warning: Could not save upload metadata:', error.message);
  }
  
  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('📊 UPLOAD SUMMARY');
  console.log('='.repeat(50));
  console.log(`✅ Successful uploads: ${successCount}`);
  console.log(`❌ Failed uploads: ${errorCount}`);
  console.log(`📈 Total stations processed: ${Object.keys(STATIONS).length}`);
  
  if (successCount > 0) {
    console.log('\n🎉 Blob storage is ready!');
    console.log('💡 To enable blob storage in production:');
    console.log('   1. Update USE_BLOB_STORAGE="true" in netlify.toml');
    console.log('   2. Redeploy your site');
    console.log('   3. Test with ?debug=1 to see blob vs fallback sources');
  }
  
  if (errorCount > 0) {
    console.log('\n⚠️  Some uploads failed. Check the error messages above.');
    process.exit(1);
  }
}

// Helper function to list current blobs (useful for debugging)
async function listBlobs() {
  console.log('📋 Listing current blobs...');
  
  try {
    // Dynamic import for @netlify/blobs
    const { getStore } = await import('@netlify/blobs');
    let store;
    
    if (process.env.NETLIFY_AUTH_TOKEN && process.env.NETLIFY_SITE_ID) {
      store = getStore({
        name: 'rainfall-data',
        siteID: process.env.NETLIFY_SITE_ID,
        token: process.env.NETLIFY_AUTH_TOKEN
      });
    } else {
      store = getStore('rainfall-data');
    }
    const { blobs } = await store.list();
    
    if (blobs.length === 0) {
      console.log('📭 No blobs found in storage');
      return;
    }
    
    console.log(`\n📦 Found ${blobs.length} blobs:`);
    for (const blob of blobs) {
      const uploadDate = blob.uploaded_at ? new Date(blob.uploaded_at).toISOString() : 'unknown';
      console.log(`  - ${blob.key} (${blob.size || 'unknown'} bytes, updated: ${uploadDate})`);
    }
    
  } catch (error) {
    console.error('❌ Error listing blobs:', error.message);
  }
}

// Command line interface
const command = process.argv[2];

if (command === 'list') {
  listBlobs();
} else if (command === 'upload' || !command) {
  uploadToBlobs();
} else {
  console.log('Usage:');
  console.log('  node scripts/upload-to-blobs.js upload  # Upload data to blobs');
  console.log('  node scripts/upload-to-blobs.js list    # List current blobs');
}
