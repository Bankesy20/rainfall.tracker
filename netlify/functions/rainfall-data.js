const fs = require('fs');
const path = require('path');

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
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

  // Helper function to try blob storage
  const tryBlobStorage = async (station) => {
    if (!useBlobStorage) return null;
    
    try {
      // Dynamic import for @netlify/blobs to avoid module compatibility issues
      const { getStore } = await import('@netlify/blobs');
      
      // Use explicit configuration with environment variables
      const store = getStore({
        name: 'rainfall-data',
        siteID: process.env.NETLIFY_SITE_ID || 'f9735549-2ceb-4b4b-8263-fd2d52f641bb',
        token: process.env.NETLIFY_AUTH_TOKEN || 'nfp_DfAAJ5BgQ3FX7HtRJkaJWsYRwUozjtw73a99'
      });
      const blobKey = `stations/${station}.json`;
      
      diagnostics.attempts.push({ type: 'blob', key: blobKey, attempting: true });
      
      const blobContent = await store.get(blobKey);
      
      // Parse the JSON string stored in the blob
      const blobData = typeof blobContent === 'string' ? JSON.parse(blobContent) : blobContent;
      
      if (blobData && blobData.data && Array.isArray(blobData.data)) {
        diagnostics.attempts.push({ type: 'blob', key: blobKey, ok: true, size: blobContent.length, records: blobData.data.length });
        return blobData;
      } else {
        diagnostics.attempts.push({ type: 'blob', key: blobKey, ok: false, note: 'invalid format or no data' });
        return null;
      }
    } catch (error) {
      diagnostics.attempts.push({ type: 'blob', ok: false, error: error.message });
      if (debugMode) {
        console.log('Blob storage failed:', error.message);
      }
      return null;
    }
  };

  try {
    // 1) Try blob storage first (if enabled)
    if (useBlobStorage) {
      const blobData = await tryBlobStorage(station);
      if (blobData) {
        diagnostics.decided = { type: 'blob', station };
        const body = { success: true, data: blobData, timestamp: new Date().toISOString(), source: 'blob-storage', station };
        if (debugMode) body.diagnostics = diagnostics;
        return { statusCode: 200, headers, body: JSON.stringify(body) };
      }
    }
    
    // 2) Remote live sources (prefer live data, no rebuilds)
    const dataFile = station === 'maenclochog1099' ? 'wales-1099.json' : 'rainfall-history.json';
    const remoteSources = [
      `https://raw.githubusercontent.com/Bankesy20/rainfall.tracker/main/data/processed/${dataFile}`,
      `https://cdn.jsdelivr.net/gh/Bankesy20/rainfall.tracker@main/data/processed/${dataFile}`
    ];

    for (const url of remoteSources) {
      try {
        const remoteData = await tryFetchJson(url, 10000);
        if (remoteData && remoteData.data && Array.isArray(remoteData.data)) {
          diagnostics.decided = { type: 'remote', url };
          const body = { success: true, data: remoteData, timestamp: new Date().toISOString(), source: 'remote', url };
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
    const body = { success: true, data: rainfallData, timestamp: new Date().toISOString(), source: 'local-file', path: dataPath };
    if (debugMode) body.diagnostics = diagnostics;
    return { statusCode: 200, headers, body: JSON.stringify(body) };

  } catch (error) {
    const body = { error: 'Internal server error', message: 'Failed to load rainfall data', timestamp: new Date().toISOString() };
    if (debugMode) body.diagnostics = diagnostics;
    return { statusCode: 500, headers, body: JSON.stringify(body) };
  }
}; 