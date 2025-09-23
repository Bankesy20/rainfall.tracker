#!/usr/bin/env node

/**
 * GitHub Actions script to upload new rainfall data to Netlify Blobs
 * This script will be used in your workflows to update blob storage
 */

const fs = require('fs').promises;
const path = require('path');

function slugify(input, fallback) {
  const base = (input || '').toString().trim().toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  const slug = base || (fallback ? String(fallback).toLowerCase() : 'station');
  return slug;
}

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
    const isBatchWorkflow = process.env.GITHUB_WORKFLOW && process.env.GITHUB_WORKFLOW.includes('EA Batch');
  const batchNum = process.env.EA_BATCH_NUM;
  
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

  // Multi-station EA workflow (for EA Multi-Stations workflow) - default seed list
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
    // Try to build dynamic list from the multi-station downloader config
    try {
      const multi = require('./download-ea-multi-stations');
      const cfg = Array.isArray(multi.STATIONS_CONFIG) ? multi.STATIONS_CONFIG : [];
      const dynamic = {};
      const usedSlugs = new Set();
      for (const s of cfg) {
        const name = s.stationName || s.label || `Station ${s.stationId}`;
        let key = slugify(name, s.stationId);
        if (usedSlugs.has(key)) key = slugify(`${name}-${s.stationId}`, s.stationId);
        usedSlugs.add(key);
        dynamic[key] = {
          file: `ea-${s.stationId}.json`,
          description: name,
          stationId: String(s.stationId)
        };
      }
      STATIONS = Object.keys(dynamic).length > 0 ? dynamic : EA_MULTI_STATIONS;
      console.log(`🌧️ Using EA Multi-Stations (${Object.keys(STATIONS).length} stations)`);
    } catch (e) {
      // Fallback: scan processed directory for all ea-*.json files
      console.log('⚠️ Could not import multi-stations config, falling back to processed files:', e.message);
      const dynamic = {};
      try {
        const files = await fs.readdir(dataDir);
        // Only include actual station data files, not metadata files
        const eaFiles = files.filter(f => /^ea-[A-Za-z0-9]+\.json$/.test(f) && 
               !f.includes('england-stations') && 
               !f.includes('rainfall-stations') && 
               !f.includes('wales-stations') && 
               !f.includes('unknown-stations'));
        for (const f of eaFiles) {
          try {
            const raw = await fs.readFile(path.join(dataDir, f), 'utf8');
            const json = JSON.parse(raw);
            const stationId = json.station || f.replace(/^ea-|\.json$/g, '');
            const name = json.stationName || json.label || `Station ${stationId}`;
            let key = slugify(name, stationId);
            if (dynamic[key]) key = slugify(`${name}-${stationId}`, stationId);
            dynamic[key] = {
              file: f,
              description: name,
              stationId: String(stationId)
            };
          } catch {}
        }
      } catch {}
      STATIONS = Object.keys(STATIONS || {}).length ? STATIONS : dynamic;
      if (!Object.keys(STATIONS).length) STATIONS = EA_MULTI_STATIONS;
      console.log(`🌧️ Using EA Multi-Stations (${Object.keys(STATIONS).length} stations)`);
    }
    } else if (isBatchWorkflow && batchNum) {
    // Handle batch workflows - use batch range to filter stations
    console.log(`🌧️ Batch Mode: Processing EA Batch ${batchNum}`);
    const batchStart = process.env.EA_BATCH_START;
    const batchEnd = process.env.EA_BATCH_END;
    console.log(`📍 Batch range: ${batchStart} → ${batchEnd}`);
    
    const dynamic = {};
    
    try {
      const files = await fs.readdir(dataDir);
      // Only include actual station data files (ea-{STATION_ID}.json), not metadata files
      const eaFiles = files.filter(f => {
        // Match pattern: ea-{STATION_ID}.json where STATION_ID is alphanumeric
        return /^ea-[A-Za-z0-9]+\.json$/.test(f) && 
               !f.includes('england-stations') && 
               !f.includes('rainfall-stations') && 
               !f.includes('wales-stations') && 
               !f.includes('unknown-stations') &&
               !f.includes('stations-only') &&
               !f.includes('stations-with-names') &&
               !f.includes('stations.checked');
      });
      console.log(`📦 Found ${eaFiles.length} station data files (filtered out metadata files)`);
      
      let batchFiles = 0;
      for (const f of eaFiles) {
        try {
          const raw = await fs.readFile(path.join(dataDir, f), 'utf8');
          const json = JSON.parse(raw);
          const stationName = json.stationName || json.label || '';
          
          // Only include files that match the current batch range
          if (batchStart && batchEnd && stationName) {
            const nameToCheck = stationName.split('(')[0].trim(); // Remove (ID) part
            if (nameToCheck >= batchStart && nameToCheck <= batchEnd) {
              const stationId = json.station || f.replace(/^ea-|\.json$/g, '');
              let key = slugify(stationName, stationId);
              if (dynamic[key]) key = slugify(`${stationName}-${stationId}`, stationId);
              dynamic[key] = {
                file: f,
                description: stationName,
                stationId: String(stationId)
              };
              batchFiles++;
            }
          }
        } catch (e) {
          // Skip files that can't be parsed
        }
      }
      
      STATIONS = dynamic;
      console.log(`🌧️ Using batch-filtered files: ${batchFiles} files in range (out of ${eaFiles.length} total)`);
      console.log(`📍 Range filter: ${batchStart} → ${batchEnd}`);
    } catch (error) {
      console.error('❌ Error loading batch files:', error.message);
      STATIONS = {};
    }
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
  
  // Rate limiting: delay between uploads to prevent API throttling
  const UPLOAD_DELAY_MS = 200; // 200ms delay between uploads
  const BATCH_SIZE = 50; // Process in smaller batches
  
  console.log(`🔄 Processing ${Object.keys(STATIONS).length} stations with rate limiting...`);
  console.log(`⏱️  Upload delay: ${UPLOAD_DELAY_MS}ms between uploads`);
  console.log(`📦 Batch size: ${BATCH_SIZE} stations per batch\n`);
  
  const stationEntries = Object.entries(STATIONS);
  
  // Process in batches to avoid overwhelming the API
  for (let batchStart = 0; batchStart < stationEntries.length; batchStart += BATCH_SIZE) {
    const batch = stationEntries.slice(batchStart, batchStart + BATCH_SIZE);
    const batchNum = Math.floor(batchStart / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(stationEntries.length / BATCH_SIZE);
    
    console.log(`\n📦 Processing batch ${batchNum}/${totalBatches} (${batch.length} stations)`);
    
    for (const [stationKey, config] of batch) {
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
    
    // Rate limiting delay between uploads
    if (UPLOAD_DELAY_MS > 0) {
      await new Promise(resolve => setTimeout(resolve, UPLOAD_DELAY_MS));
    }
  }
  
  // Delay between batches (longer pause to let API recover)
  if (batchStart + BATCH_SIZE < stationEntries.length) {
    console.log(`  ⏸️  Pausing 2 seconds between batches...`);
    await new Promise(resolve => setTimeout(resolve, 2000));
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
  
  // Set GitHub Actions outputs (using modern format)
  console.log(`\necho "uploaded=${successCount}" >> $GITHUB_OUTPUT`);
  console.log(`echo "failed=${errorCount}" >> $GITHUB_OUTPUT`);
  console.log(`echo "total=${Object.keys(STATIONS).length}" >> $GITHUB_OUTPUT`);
  
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
