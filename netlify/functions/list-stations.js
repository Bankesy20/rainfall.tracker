const fs = require('fs');
const path = require('path');

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Content-Type': 'application/json',
    'Cache-Control': 'public, max-age=600', // Cache for 10 minutes
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    // Try to get stations from blob storage first
    let stations = [];
    
    try {
      // Dynamic import for @netlify/blobs
      const { getStore } = await import('@netlify/blobs');
      
      const store = getStore({
        name: 'rainfall-data',
        siteID: process.env.NETLIFY_SITE_ID,
        token: process.env.NETLIFY_AUTH_TOKEN
      });
      
      // List all blobs in the stations folder (paginate through all pages)
      let cursor = undefined;
      do {
        const page = await store.list({ prefix: 'stations/', cursor });
        const pageBlobs = page && Array.isArray(page.blobs) ? page.blobs : [];
        for (const blob of pageBlobs) {
          try {
            const content = await store.get(blob.key);
            const data = typeof content === 'string' ? JSON.parse(content) : content;
            
            if (data && data.station) {
              // Extract station key from blob path (stations/stationKey.json)
              const stationKey = blob.key.replace('stations/', '').replace('.json', '');
              
              stations.push({
                key: stationKey,
                id: data.station,
                label: data.label || data.stationName || data.nameEN || `Station ${data.station}`,
                name: data.stationName || data.nameEN || data.name,
                provider: data.provider || (data.source === 'NRW' ? 'Natural Resources Wales' : 'Environment Agency'),
                country: data.country || (data.source === 'NRW' ? 'Wales' : 'England'),
                location: data.location,
                lastUpdated: data.lastUpdated,
                recordCount: data.recordCount || (data.data ? data.data.length : 0),
                source: 'blob'
              });
            }
          } catch (error) {
            // Skip invalid blobs
            continue;
          }
        }
        cursor = page && page.cursor ? page.cursor : undefined;
      } while (cursor);
      
    } catch (blobError) {
      console.log('Blob storage failed, falling back to file system');
      
      // Fallback to file system
      const dataDir = path.join(process.cwd(), 'data', 'processed');
      
      // Add static stations
      const staticStations = [
        {
          key: 'miserden1141',
          id: '1141',
          label: 'Miserden (1141)',
          name: 'Miserden',
          provider: 'Environment Agency',
          country: 'England',
          source: 'file'
        },
        {
          key: 'maenclochog1099', 
          id: '1099',
          label: 'Maenclochog (1099)',
          name: 'Maenclochog',
          provider: 'Natural Resources Wales',
          country: 'Wales',
          source: 'file'
        }
      ];
      
      stations = staticStations;
      
      // Try to add EA stations from processed files
      try {
        const files = await fs.promises.readdir(dataDir);
        const eaFiles = files.filter(f => f.startsWith('ea-') && f.endsWith('.json'));
        
        for (const file of eaFiles) {
          try {
            const content = await fs.promises.readFile(path.join(dataDir, file), 'utf8');
            const data = JSON.parse(content);
            
            if (data && data.station) {
              const stationKey = file.replace('.json', '');
              stations.push({
                key: stationKey,
                id: data.station,
                label: data.label || data.stationName || data.nameEN || `Station ${data.station}`,
                name: data.stationName || data.nameEN || data.name,
                provider: data.provider || (data.source === 'NRW' ? 'Natural Resources Wales' : 'Environment Agency'),
                country: data.country || (data.source === 'NRW' ? 'Wales' : 'England'),
                location: data.location,
                lastUpdated: data.lastUpdated,
                recordCount: data.recordCount || (data.data ? data.data.length : 0),
                source: 'file'
              });
            }
          } catch (error) {
            continue;
          }
        }
      } catch (error) {
        // Directory doesn't exist or can't be read
      }
    }
    
    // Sort stations by label
    stations.sort((a, b) => a.label.localeCompare(b.label));
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        stations,
        count: stations.length,
        timestamp: new Date().toISOString()
      })
    };
    
  } catch (error) {
    console.error('Error listing stations:', error);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Failed to list stations',
        message: error.message
      })
    };
  }
};
