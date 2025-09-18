#!/usr/bin/env node

/**
 * GitHub Actions script to upload new rainfall data to Netlify Blobs
 * This script will be used in your workflows to update blob storage
 */

const fs = require('fs').promises;
const path = require('path');

async function uploadNewData() {
  console.log('🚀 GitHub Actions: Uploading rainfall data to blobs...');
  
  // Check we're in GitHub Actions environment
  if (!process.env.GITHUB_ACTIONS) {
    console.log('⚠️  This script is designed for GitHub Actions');
    console.log('💡 For local uploads, use: npm run blob:upload');
    return;
  }
  
  // Dynamic import for @netlify/blobs
  const { getStore } = await import('@netlify/blobs');
  const store = getStore('rainfall-data');
  const dataDir = path.join(process.cwd(), 'data', 'processed');
  
  // Station mapping - same as local script but with GitHub Actions context
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
  
  let successCount = 0;
  let errorCount = 0;
  
  for (const [stationKey, config] of Object.entries(STATIONS)) {
    console.log(`\n📊 Processing ${config.description}...`);
    
    try {
      const filePath = path.join(dataDir, config.file);
      
      // Check if file exists (might not be updated)
      try {
        await fs.access(filePath);
      } catch (error) {
        console.log(`  ⏭️  Skipping ${stationKey} - file not found or not updated`);
        continue;
      }
      
      const fileContent = await fs.readFile(filePath, 'utf-8');
      const jsonData = JSON.parse(fileContent);
      
      if (!jsonData.data || !Array.isArray(jsonData.data)) {
        throw new Error(`Invalid data structure in ${config.file}`);
      }
      
      const recordCount = jsonData.data.length;
      console.log(`  📈 Records: ${recordCount.toLocaleString()}`);
      
      // Add GitHub Actions metadata
      const blobData = {
        ...jsonData,
        uploadedAt: new Date().toISOString(),
        source: 'github-actions',
        workflow: process.env.GITHUB_WORKFLOW,
        runId: process.env.GITHUB_RUN_ID,
        sha: process.env.GITHUB_SHA,
        originalFile: config.file,
        stationKey: stationKey
      };
      
      const blobKey = `stations/${stationKey}.json`;
      await store.set(blobKey, blobData);
      
      // Verify upload
      const uploaded = await store.get(blobKey, { type: 'json' });
      if (!uploaded || !uploaded.data) {
        throw new Error('Upload verification failed');
      }
      
      console.log(`  ✅ Successfully uploaded to ${blobKey}`);
      successCount++;
      
    } catch (error) {
      console.error(`  ❌ Error uploading ${stationKey}:`, error.message);
      errorCount++;
    }
  }
  
  // Update metadata
  try {
    const metadata = {
      lastGitHubUpdate: new Date().toISOString(),
      workflow: process.env.GITHUB_WORKFLOW,
      runId: process.env.GITHUB_RUN_ID,
      sha: process.env.GITHUB_SHA,
      successfulUploads: successCount,
      failedUploads: errorCount,
      totalStations: Object.keys(STATIONS).length
    };
    
    await store.set('metadata/github-actions-log.json', metadata);
    console.log('\n📋 GitHub Actions metadata updated');
    
  } catch (error) {
    console.error('\n⚠️  Warning: Could not update metadata:', error.message);
  }
  
  // Set GitHub Actions outputs
  console.log(`\n::set-output name=uploaded::${successCount}`);
  console.log(`::set-output name=failed::${errorCount}`);
  console.log(`::set-output name=total::${Object.keys(STATIONS).length}`);
  
  console.log('\n📊 GitHub Actions Upload Summary:');
  console.log(`✅ Uploaded: ${successCount} stations`);
  console.log(`❌ Failed: ${errorCount} stations`);
  
  if (errorCount > 0) {
    process.exit(1);
  }
}

uploadNewData().catch(error => {
  console.error('❌ GitHub Actions upload failed:', error);
  process.exit(1);
});
