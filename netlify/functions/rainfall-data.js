const fs = require('fs');
const path = require('path');

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Cache-Control, Pragma, Expires',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Content-Type': 'application/json',
    'Cache-Control': 'public, max-age=300',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const qs = event.queryStringParameters || {};
  const debugMode = qs.debug === '1';
  const station = qs.station || 'miserden1141'; // Default to Miserden
  const diagnostics = { attempts: [], decided: null };
  
  // Feature flags for blob storage
  const useBlobStorage = process.env.USE_BLOB_STORAGE === 'true';
  const blobFallbackEnabled = process.env.BLOB_FALLBACK_ENABLED !== 'false';
  
  if (debugMode) {
    diagnostics.config = { useBlobStorage, blobFallbackEnabled };
  }

  const tryFetchJson = async (url, timeoutMs = 10000) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        headers: {
          'Accept': 'application/json,text/plain;q=0.9,*/*;q=0.8',
          'User-Agent': 'rainfall-tracker/1.0 (+netlify-function)'
        },
        signal: controller.signal,
      });
      const status = res.status;
      let bodyText = '';
      try { bodyText = await res.text(); } catch (_) {}
      if (status !== 200) {
        diagnostics.attempts.push({ url, ok: false, status, note: 'non-200', sample: bodyText.slice(0, 200) });
        throw new Error(`HTTP ${status}`);
      }
      try {
        const json = JSON.parse(bodyText);
        diagnostics.attempts.push({ url, ok: true, status, size: bodyText.length });
        return json;
      } catch (e) {
        diagnostics.attempts.push({ url, ok: false, status, note: 'invalid json', error: e.message });
        throw new Error(`Invalid JSON: ${e.message}`);
      }
    } finally {
      clearTimeout(timeout);
    }
  };

  // Helper function to load stations metadata
  const loadStationsMetadata = async () => {
    try {
      const metadataPath = path.join(__dirname, 'data', 'processed', 'stations-metadata.json');
      if (fs.existsSync(metadataPath)) {
        const metadataContent = fs.readFileSync(metadataPath, 'utf8');
        return JSON.parse(metadataContent);
      }
    } catch (error) {
      console.warn('Failed to load stations metadata:', error.message);
    }
    return null;
  };

  // Helper function to try blob storage
  const tryBlobStorage = async (station) => {
    if (!useBlobStorage) return null;
    
    try {
      // Import @netlify/blobs using dynamic import to avoid ES Module issues
      const { getStore } = await import('@netlify/blobs');
      
      // Use explicit configuration with environment variables
      const store = getStore({
        name: 'rainfall-data',
        siteID: process.env.NETLIFY_SITE_ID || 'f9735549-2ceb-4b4b-8263-fd2d52f641bb',
        token: process.env.NETLIFY_AUTH_TOKEN || 'nfp_DfAAJ5BgQ3FX7HtRJkaJWsYRwUozjtw73a99'
      });
      
      // Load stations metadata to get the correct blob key
      const metadata = await loadStationsMetadata();
      let blobKey = null;
      
      if (metadata && metadata.stations && metadata.stations[station]) {
        blobKey = metadata.stations[station].blobKey;
        diagnostics.attempts.push({ type: 'blob', key: 'metadata-lookup', ok: true, foundKey: blobKey, station });
      }
      
      // Try the mapped blob key first
      if (blobKey) {
        const mappedBlobKey = `stations/${blobKey}.json`;
        diagnostics.attempts.push({ type: 'blob', key: mappedBlobKey, attempting: true, note: 'using metadata mapping' });
        
        try {
          const blobContent = await store.get(mappedBlobKey);
          const blobData = typeof blobContent === 'string' ? JSON.parse(blobContent) : blobContent;
          
          if (blobData && blobData.data && Array.isArray(blobData.data)) {
            diagnostics.attempts.push({ type: 'blob', key: mappedBlobKey, ok: true, size: blobContent.length, records: blobData.data.length, foundBy: 'metadata-mapping' });
            return blobData;
          }
        } catch (mappedError) {
          diagnostics.attempts.push({ type: 'blob', key: mappedBlobKey, ok: false, error: mappedError.message });
        }
      }
      
      // Fallback: try direct key lookup (for backward compatibility)
      const directBlobKey = `stations/${station}.json`;
      diagnostics.attempts.push({ type: 'blob', key: directBlobKey, attempting: true, note: 'fallback direct lookup' });
      
      try {
        const blobContent = await store.get(directBlobKey);
        const blobData = typeof blobContent === 'string' ? JSON.parse(blobContent) : blobContent;
        
        if (blobData && blobData.data && Array.isArray(blobData.data)) {
          diagnostics.attempts.push({ type: 'blob', key: directBlobKey, ok: true, size: blobContent.length, records: blobData.data.length, foundBy: 'direct-lookup' });
          return blobData;
        }
      } catch (directError) {
        diagnostics.attempts.push({ type: 'blob', key: directBlobKey, ok: false, error: directError.message });
      }
      
      // Final fallback: search through all station blobs to find matching station ID
      diagnostics.attempts.push({ type: 'blob', key: 'search', attempting: true, note: 'searching for station by ID' });
      
      const { blobs } = await store.list({ prefix: 'stations/' });
      const stationBlobs = blobs.filter(blob => blob.key.startsWith('stations/') && blob.key.endsWith('.json'));
      
      for (const blob of stationBlobs) {
        try {
          const blobContent = await store.get(blob.key);
          const blobData = typeof blobContent === 'string' ? JSON.parse(blobContent) : blobContent;
          
          // Check if this blob contains data for the requested station
          if (blobData && blobData.station === station && blobData.data && Array.isArray(blobData.data)) {
            diagnostics.attempts.push({ type: 'blob', key: blob.key, ok: true, size: blobContent.length, records: blobData.data.length, foundBy: 'station-id-search' });
            return blobData;
          }
        } catch (blobError) {
          // Skip this blob and continue searching
          continue;
        }
      }
      
      // No matching station found
      diagnostics.attempts.push({ type: 'blob', key: 'search', ok: false, note: 'station not found in any blob' });
      return null;
      
    } catch (error) {
      diagnostics.attempts.push({ type: 'blob', ok: false, error: error.message });
      if (debugMode) {
        console.log('Blob storage failed:', error.message);
      }
      return null;
    }
  };

  // Helper function to normalize data format
  const normalizeData = (data, station) => {
    if (!data) return null;
    
    // Normalize root-level fields
    const normalized = {
      lastUpdated: data.lastUpdated,
      station: data.station || station,
      stationName: data.stationName || data.nameEN || data.nameCY || `Station ${data.station || station}`,
      region: data.region || (data.nameEN || data.nameCY ? 'Wales' : 'England'),
      location: data.location || {},
      dataSource: data.dataSource || 'Blob Storage',
      recordCount: data.recordCount || (data.data ? data.data.length : 0),
      data: data.data || []
    };
    
    // Normalize individual records if they don't have metadata
    if (normalized.data.length > 0 && !normalized.data[0].station) {
      normalized.data = normalized.data.map(record => ({
        ...record,
        station: normalized.station,
        stationName: normalized.stationName,
        region: normalized.region
      }));
    }
    
    return normalized;
  };

  try {
    // 1) Try blob storage first (if enabled)
    if (useBlobStorage) {
      const blobData = await tryBlobStorage(station);
      if (blobData) {
        diagnostics.decided = { type: 'blob', station };
        const normalizedData = normalizeData(blobData, station);
        const body = { success: true, data: normalizedData, timestamp: new Date().toISOString(), source: 'blob-storage', station };
        if (debugMode) body.diagnostics = diagnostics;
        return { statusCode: 200, headers, body: JSON.stringify(body) };
      }
    }
    
    // 2) Remote live sources (prefer live data, no rebuilds)
    // Determine the correct data file based on station metadata
    let dataFile = 'rainfall-history.json'; // Default fallback
    const metadata = await loadStationsMetadata();
    if (metadata && metadata.stations && metadata.stations[station]) {
      dataFile = metadata.stations[station].dataFile || 'rainfall-history.json';
    } else if (station === 'maenclochog1099') {
      dataFile = 'wales-1099.json'; // Special case for Welsh station
    }
    
    const remoteSources = [
      `https://raw.githubusercontent.com/Bankesy20/rainfall.tracker/main/data/processed/${dataFile}`,
      `https://cdn.jsdelivr.net/gh/Bankesy20/rainfall.tracker@main/data/processed/${dataFile}`
    ];

    for (const url of remoteSources) {
      try {
        const remoteData = await tryFetchJson(url, 10000);
        if (remoteData && remoteData.data && Array.isArray(remoteData.data)) {
          diagnostics.decided = { type: 'remote', url };
          const normalizedData = normalizeData(remoteData, station);
          const body = { success: true, data: normalizedData, timestamp: new Date().toISOString(), source: 'remote', url };
          if (debugMode) body.diagnostics = diagnostics;
          return { statusCode: 200, headers, body: JSON.stringify(body) };
        }
      } catch (e) {
        // continue to next source
      }
    }

    // 3) Local file fallbacks (always available)
    const possiblePaths = [
      path.join(__dirname, 'rainfall-data.json'),
      path.join(__dirname, 'data', 'processed', dataFile),
      path.join(process.cwd(), 'data', 'processed', dataFile),
      path.join(process.cwd(), 'public', 'data', 'processed', dataFile),
      path.join(process.cwd(), 'build', 'data', 'processed', dataFile),
      path.join(process.cwd(), '..', 'data', 'processed', dataFile),
      path.join(process.cwd(), '..', 'public', 'data', 'processed', dataFile),
      path.join(__dirname, dataFile),
      `/var/task/data/processed/${dataFile}`,
      `/var/task/${dataFile}`
    ];

    let dataPath = null;
    for (const candidate of possiblePaths) {
      try {
        if (fs.existsSync(candidate)) { dataPath = candidate; break; }
      } catch (_) {}
    }

    if (!dataPath) {
      const embeddedData = {
        lastUpdated: new Date().toISOString(),
        station: '1141',
        data: [
          { date: '2025-08-04', time: '09:30', rainfall_mm: 0.2, total_mm: 0 },
          { date: '2025-08-04', time: '10:15', rainfall_mm: 0.2, total_mm: 0 },
          { date: '2025-08-04', time: '11:45', rainfall_mm: 0.2, total_mm: 0 },
          { date: '2025-08-04', time: '12:30', rainfall_mm: 0.4, total_mm: 0 },
          { date: '2025-08-04', time: '13:45', rainfall_mm: 0.2, total_mm: 0 }
        ]
      };
      diagnostics.decided = { type: 'embedded' };
      const body = { success: true, data: embeddedData, timestamp: new Date().toISOString(), source: 'embedded-fallback' };
      if (debugMode) body.diagnostics = diagnostics;
      return { statusCode: 200, headers, body: JSON.stringify(body) };
    }

    const fileData = fs.readFileSync(dataPath, 'utf8');
    const rainfallData = JSON.parse(fileData);
    if (!rainfallData || !rainfallData.data || !Array.isArray(rainfallData.data)) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'Invalid data format', message: 'Data file is corrupted or invalid' }) };
    }
    diagnostics.decided = { type: 'local', path: dataPath };
    const normalizedData = normalizeData(rainfallData, station);
    const body = { success: true, data: normalizedData, timestamp: new Date().toISOString(), source: 'local-file', path: dataPath };
    if (debugMode) body.diagnostics = diagnostics;
    return { statusCode: 200, headers, body: JSON.stringify(body) };

  } catch (error) {
    const body = { error: 'Internal server error', message: 'Failed to load rainfall data', timestamp: new Date().toISOString() };
    if (debugMode) body.diagnostics = diagnostics;
    return { statusCode: 500, headers, body: JSON.stringify(body) };
  }
}; 