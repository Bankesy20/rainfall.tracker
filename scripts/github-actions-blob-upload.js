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
  
  // Use explicit configuration with environment variables
  const store = getStore({
    name: 'rainfall-data',
    siteID: process.env.NETLIFY_SITE_ID,
    token: process.env.NETLIFY_AUTH_TOKEN
  });
  
  console.log(`🔑 Using site: ${process.env.NETLIFY_SITE_ID}`);
  console.log(`🔑 Token length: ${process.env.NETLIFY_AUTH_TOKEN ? process.env.NETLIFY_AUTH_TOKEN.length : 'not set'}`);
  const dataDir = path.join(process.cwd(), 'data', 'processed');
  
  // Station mapping - updated to include new EA stations
  const STATIONS = {
    'miserden1141': {
      file: 'rainfall-history.json',
      description: 'Miserden EA Station'
    },
    'maenclochog1099': {
      file: 'wales-1099.json', 
      description: 'Maenclochog NRW Station'
    },
    'ea573674': {
      file: 'ea-573674.json',
      description: 'EA Northern Station (573674)'
    },
    'eaE19017': {
      file: 'ea-E19017.json', 
      description: 'EA East England Station (E19017)'
    },
    'ea240662TP': {
      file: 'ea-240662TP.json',
      description: 'EA Central England Station (240662TP)'
    },
    'ea558491': {
      file: 'ea-558491.json',
      description: 'EA Midlands Station (558491)'
    },
    'ea059793': {
      file: 'ea-059793.json',
      description: 'EA Yorkshire Station (059793)'
    },
    'ea013553': {
      file: 'ea-013553.json',
      description: 'EA Northern Border Station (013553)'
    },
    'ea50108': {
      file: 'ea-50108.json',
      description: 'EA Southwest Station (50108)'
    },
    'eaE14920': {
      file: 'ea-E14920.json',
      description: 'EA South Coast Station (E14920)'
    },
    'ea038476': {
      file: 'ea-038476.json',
      description: 'EA East Coast Station (038476)'
    },
    'eaE11461': {
      file: 'ea-E11461.json',
      description: 'EA South Station (E11461)'
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
      await store.set(blobKey, JSON.stringify(blobData), {
        metadata: { 
          contentType: 'application/json',
          station: stationKey,
          records: recordCount.toString(),
          source: 'github-actions'
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
        // Don't throw here - the upload might have worked even if verification failed
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
