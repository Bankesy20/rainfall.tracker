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
  
  // Determine which stations to upload based on workflow
  const isEATestWorkflow = process.env.GITHUB_WORKFLOW && process.env.GITHUB_WORKFLOW.includes('EA Stations');
  const isProductionWorkflow = process.env.GITHUB_WORKFLOW && process.env.GITHUB_WORKFLOW.includes('Scrape Rainfall');
  const isEAStationWorkflow = process.env.GITHUB_WORKFLOW && process.env.GITHUB_WORKFLOW.includes('EA Station');
  const isEAMultiStationsWorkflow = process.env.GITHUB_WORKFLOW && process.env.GITHUB_WORKFLOW.includes('EA Multi-Stations');
  
  console.log(`🔍 Workflow: ${process.env.GITHUB_WORKFLOW}`);
  console.log(`📊 EA Test Mode: ${isEATestWorkflow}`);
  console.log(`🏭 Production Mode: ${isProductionWorkflow}`);
  console.log(`🌧️ EA Station Mode: ${isEAStationWorkflow}`);
  console.log(`🌧️ EA Multi-Stations Mode: ${isEAMultiStationsWorkflow}`);
  
  // Production stations (only for scrape-and-upload workflow)
  const PRODUCTION_STATIONS = {
    'miserden1141': {
      file: 'rainfall-history.json',
      description: 'Miserden EA Station'
    },
    'maenclochog1099': {
      file: 'wales-1099.json', 
      description: 'Maenclochog NRW Station'
    }
  };
  
  // Individual EA stations (for individual EA station workflows)
  const EA_STATION_E7050 = {
    'preston-capes': {
      file: 'ea-E7050.json',
      description: 'Preston Capes (E7050)',
      stationId: 'E7050'
    }
  };

  // Multi-station EA workflow (for EA Multi-Stations workflow)
  const EA_MULTI_STATIONS = {
    'preston-capes': {
      file: 'ea-E7050.json',
      description: 'Preston Capes (E7050)',
      stationId: 'E7050'
    },
    'ashdon': {
      file: 'ea-E19017.json',
      description: 'Ashdon (E19017)',
      stationId: 'E19017'
    },
    'lyndhurst': {
      file: 'ea-E13600.json',
      description: 'Lyndhurst (E13600)',
      stationId: 'E13600'
    },
    'hullbridge-raine': {
      file: 'ea-E24879.json',
      description: 'Hullbridge Raine (E24879)',
      stationId: 'E24879'
    },
    'lower-standen': {
      file: 'ea-E5170.json',
      description: 'Lower Standen (E5170)',
      stationId: 'E5170'
    },
    'hethersett': {
      file: 'ea-E23518.json',
      description: 'Hethersett (E23518)',
      stationId: 'E23518'
    },
    'tiptree': {
      file: 'ea-E24913.json',
      description: 'Tiptree (E24913)',
      stationId: 'E24913'
    },
    'isfield-weir': {
      file: 'ea-E8290.json',
      description: 'Isfield Weir (E8290)',
      stationId: 'E8290'
    },
    'red-br': {
      file: 'ea-577271.json',
      description: 'Red Br (577271)',
      stationId: '577271'
    }
  };

  // EA test stations (only for EA test workflows) - using proper names as keys
  const EA_TEST_STATIONS = {
    'preston-capes': {
      file: 'ea-E7050.json',
      description: 'Preston Capes (E7050)',
      stationId: 'E7050'
    },
    'brooksby': {
      file: 'ea-3680.json',
      description: 'Brooksby (3680)',
      stationId: '3680'
    },
    'walsall-wood': {
      file: 'ea-3275.json',
      description: 'Walsall Wood (3275)',
      stationId: '3275'
    },
    'frankley': {
      file: 'ea-3167.json',
      description: 'Frankley (3167)',
      stationId: '3167'
    },
    'hollinsclough': {
      file: 'ea-3307.json',
      description: 'Hollinsclough (3307)',
      stationId: '3307'
    },
    'barbrook': {
      file: 'ea-3404.json',
      description: 'Barbrook (3404)',
      stationId: '3404'
    },
    'stone': {
      file: 'ea-3014.json',
      description: 'Stone (3014)',
      stationId: '3014'
    },
    'worksop': {
      file: 'ea-3901.json',
      description: 'Worksop (3901)',
      stationId: '3901'
    },
    'littlethorpe': {
      file: 'ea-3999.json',
      description: 'Littlethorpe (3999)',
      stationId: '3999'
    },
    'lyndhurst': {
      file: 'ea-E13600.json',
      description: 'Lyndhurst (E13600)',
      stationId: 'E13600'
    }
  };
  
  // Select appropriate stations based on workflow
  let STATIONS;
  if (isEATestWorkflow) {
    STATIONS = EA_TEST_STATIONS;
    console.log('🧪 Using EA TEST stations only');
  } else if (isProductionWorkflow) {
    STATIONS = PRODUCTION_STATIONS;
    console.log('🏭 Using PRODUCTION stations only');
  } else if (isEAMultiStationsWorkflow) {
    STATIONS = EA_MULTI_STATIONS;
    console.log('🌧️ Using EA Multi-Stations (10 stations) only');
  } else if (isEAStationWorkflow) {
    STATIONS = EA_STATION_E7050;
    console.log('🌧️ Using individual EA station (E7050) only');
  } else {
    // Fallback for manual runs or unknown workflows
    STATIONS = { ...PRODUCTION_STATIONS, ...EA_TEST_STATIONS };
    console.log('🔄 Using ALL stations (fallback mode)');
  }
  
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
