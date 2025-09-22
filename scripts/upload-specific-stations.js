#!/usr/bin/env node

const fs = require('fs').promises;
const path = require('path');

// Specific stations to upload
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

async function uploadSpecificStations() {
  console.log('🚀 Uploading specific stations to Netlify Blobs...');
  
  // Dynamic import for @netlify/blobs
  const { getStore } = await import('@netlify/blobs');
  
  // Use explicit configuration with environment variables
  const store = getStore({
    name: 'rainfall-data',
    siteID: process.env.NETLIFY_SITE_ID,
    token: process.env.NETLIFY_AUTH_TOKEN
  });
  
  console.log(`🔑 Using site: ${process.env.NETLIFY_SITE_ID}`);
  const dataDir = path.join(process.cwd(), 'data', 'processed');
  
  let successCount = 0;
  let errorCount = 0;
  
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
        source: 'manual-upload',
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
      
      // Verify upload
      try {
        const uploaded = await store.get(blobKey);
        const parsedData = typeof uploaded === 'string' ? JSON.parse(uploaded) : uploaded;
        if (!parsedData || !parsedData.data) {
          throw new Error('Upload verification failed - no data found');
        }
        console.log(`  🔍 Verification: Found ${parsedData.data.length} records`);
      } catch (verifyError) {
        console.log(`  ⚠️  Verification failed, but upload may have succeeded: ${verifyError.message}`);
      }
      
      console.log(`  ✅ Successfully uploaded to ${blobKey}`);
      successCount++;
      
    } catch (error) {
      console.error(`  ❌ Error uploading ${stationKey}:`, error.message);
      errorCount++;
    }
  }
  
  console.log('\n📊 Upload Summary:');
  console.log(`✅ Uploaded: ${successCount} stations`);
  console.log(`❌ Failed: ${errorCount} stations`);
  
  if (errorCount > 0) {
    process.exit(1);
  }
}

uploadSpecificStations().catch(error => {
  console.error('❌ Upload failed:', error);
  process.exit(1);
});
