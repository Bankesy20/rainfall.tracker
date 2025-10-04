#!/usr/bin/env node

/**
 * Upload corrected Exmouth data to Netlify Blob Storage
 * This script uploads the corrected Exmouth station data to replace the existing blob
 */

const fs = require('fs').promises;
const path = require('path');

async function uploadExmouthToBlobs() {
  console.log('🚀 Uploading corrected Exmouth data to Netlify Blob Storage...');
  
  // Dynamic import for @netlify/blobs
  const { getStore } = await import('@netlify/blobs');
  
  // Configure store with explicit site ID
  const siteId = process.env.NETLIFY_SITE_ID || 'f9735549-2ceb-4b4b-8263-fd2d52f641bb';
  
  let store;
  try {
    if (process.env.NETLIFY_AUTH_TOKEN && process.env.NETLIFY_SITE_ID) {
      store = getStore({
        name: 'rainfall-data',
        siteID: process.env.NETLIFY_SITE_ID,
        token: process.env.NETLIFY_AUTH_TOKEN
      });
      console.log(`  🔑 Using explicit auth for site: ${process.env.NETLIFY_SITE_ID}`);
    } else {
      store = getStore('rainfall-data');
      console.log('  🔑 Using Netlify CLI environment');
    }
  } catch (error) {
    console.log('❌ Could not initialize blob storage');
    console.log('💡 Make sure you are logged in with: netlify login');
    console.log('📋 Or set NETLIFY_AUTH_TOKEN environment variable');
    throw error;
  }

  // Load the corrected Exmouth data
  console.log('📊 Loading corrected Exmouth data...');
  const correctedDataPath = 'data/processed/ea-45164.json';
  const correctedData = JSON.parse(await fs.readFile(correctedDataPath, 'utf8'));
  
  // Validate the data structure
  if (!correctedData.data || !Array.isArray(correctedData.data)) {
    throw new Error('Invalid corrected data structure');
  }
  
  const recordCount = correctedData.data.length;
  const fileSize = Buffer.byteLength(JSON.stringify(correctedData), 'utf8');
  
  console.log(`  📁 File: ea-45164.json`);
  console.log(`  📈 Records: ${recordCount.toLocaleString()}`);
  console.log(`  💾 Size: ${(fileSize / 1024).toFixed(1)} KB`);
  
  // Check if corrections were applied
  const correctionsApplied = correctedData.correctionsApplied || {};
  if (correctionsApplied.count > 0) {
    console.log(`  🔧 Corrections applied: ${correctionsApplied.count}`);
    console.log(`  📅 Corrected at: ${correctionsApplied.appliedAt}`);
  }
  
  // Upload to blob storage
  const blobKey = 'stations/exmouth-45164.json';
  console.log(`  ☁️  Uploading to: ${blobKey}`);
  
  // Add metadata for tracking
  const blobData = {
    ...correctedData,
    uploadedAt: new Date().toISOString(),
    source: 'corrected-local-file',
    originalFile: 'ea-45164.json',
    stationKey: 'exmouth-45164',
    stationId: '45164',
    stationName: 'Exmouth',
    correctionsInfo: {
      correctionsApplied: correctionsApplied.count || 0,
      correctedAt: correctionsApplied.appliedAt || new Date().toISOString(),
      method: correctionsApplied.method || 'nearby_station_analysis'
    }
  };
  
  // Store as JSON string
  await store.set(blobKey, JSON.stringify(blobData), {
    metadata: { 
      contentType: 'application/json',
      station: 'exmouth-45164',
      stationId: '45164',
      records: recordCount.toString(),
      corrected: 'true',
      correctionsApplied: (correctionsApplied.count || 0).toString()
    }
  });
  
  // Verify the upload
  try {
    const verification = await store.get(blobKey);
    if (verification) {
      const parsedVerification = JSON.parse(verification);
      console.log(`  ✅ Upload verified successfully`);
      console.log(`  📊 Verified records: ${parsedVerification.data.length}`);
      console.log(`  🔧 Corrections in blob: ${parsedVerification.correctionsInfo?.correctionsApplied || 0}`);
    } else {
      throw new Error('Verification failed - no data returned');
    }
  } catch (verifyError) {
    console.log(`  ⚠️  Upload completed but verification failed: ${verifyError.message}`);
  }
  
  console.log('\n🎉 Exmouth data successfully uploaded to Netlify Blob Storage!');
  console.log(`📍 Blob key: ${blobKey}`);
  console.log(`📊 Records uploaded: ${recordCount.toLocaleString()}`);
  console.log(`🔧 Corrections included: ${correctionsApplied.count || 0}`);
  
  // Test the blob by retrieving it
  console.log('\n🧪 Testing blob retrieval...');
  try {
    const testData = await store.get(blobKey);
    const parsedTestData = JSON.parse(testData);
    console.log(`✅ Blob retrieval test successful`);
    console.log(`📊 Retrieved records: ${parsedTestData.data.length}`);
    console.log(`🔧 Retrieved corrections: ${parsedTestData.correctionsInfo?.correctionsApplied || 0}`);
  } catch (testError) {
    console.log(`❌ Blob retrieval test failed: ${testError.message}`);
  }
  
  return {
    success: true,
    blobKey,
    recordCount,
    correctionsApplied: correctionsApplied.count || 0
  };
}

// Run the upload
if (require.main === module) {
  uploadExmouthToBlobs()
    .then(result => {
      console.log('\n✅ Upload completed successfully!');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n❌ Upload failed:', error.message);
      process.exit(1);
    });
}

module.exports = { uploadExmouthToBlobs };
