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
  const diagnostics = { attempts: [], decided: null };

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

  try {
    // 1) Remote live sources (prefer live data, no rebuilds)
    const remoteSources = [
      'https://raw.githubusercontent.com/Bankesy20/rainfall.tracker/main/data/processed/rainfall-history.json',
      'https://cdn.jsdelivr.net/gh/Bankesy20/rainfall.tracker@main/data/processed/rainfall-history.json'
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

    // 2) Local file fallbacks
    const possiblePaths = [
      path.join(__dirname, 'rainfall-data.json'),
      path.join(__dirname, 'data', 'processed', 'rainfall-history.json'),
      path.join(process.cwd(), 'data', 'processed', 'rainfall-history.json'),
      path.join(process.cwd(), 'public', 'data', 'processed', 'rainfall-history.json'),
      path.join(process.cwd(), 'build', 'data', 'processed', 'rainfall-history.json'),
      path.join(process.cwd(), '..', 'data', 'processed', 'rainfall-history.json'),
      path.join(process.cwd(), '..', 'public', 'data', 'processed', 'rainfall-history.json'),
      path.join(__dirname, 'rainfall-history.json'),
      '/var/task/data/processed/rainfall-history.json',
      '/var/task/rainfall-history.json'
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