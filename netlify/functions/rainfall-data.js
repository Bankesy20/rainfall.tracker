const fs = require('fs');
const path = require('path');
const https = require('https');

exports.handler = async (event, context) => {
  // Set CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Content-Type': 'application/json',
    'Cache-Control': 'public, max-age=300', // Cache for 5 minutes
  };

  // Handle preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: '',
    };
  }

  // Only allow GET requests
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  // Helper to fetch JSON via HTTPS GET
  const fetchJson = (url) => new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'User-Agent': 'rainfall-tracker/1.0' }, timeout: 10000 }, (res) => {
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode} fetching ${url}`));
      }
      let data = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error(`Invalid JSON from ${url}: ${e.message}`));
        }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`Timeout fetching ${url}`));
    });
  });

  try {
    // 1) Prefer live data from GitHub raw (always latest on main, no Netlify rebuild required)
    const githubRawUrl = 'https://raw.githubusercontent.com/Bankesy20/rainfall.tracker/main/data/processed/rainfall-history.json';
    try {
      const githubData = await fetchJson(githubRawUrl);
      if (githubData && githubData.data && Array.isArray(githubData.data)) {
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: true,
            data: githubData,
            timestamp: new Date().toISOString(),
            source: 'github-raw'
          }),
        };
      }
    } catch (e) {
      // Continue to local fallbacks
      console.log('GitHub raw fetch failed:', e.message);
    }

    // 2) Local file fallbacks (for local dev or when packaged in function bundle)
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
        if (fs.existsSync(candidate)) {
          dataPath = candidate;
          break;
        }
      } catch (_) {
        // ignore
      }
    }

    // Check if file exists
    if (!dataPath) {
      console.log('No data file found locally, returning embedded data with actual rainfall');

      // 3) Embedded minimal sample with actual rainfall
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

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          data: embeddedData,
          timestamp: new Date().toISOString(),
          source: 'embedded-fallback',
          note: 'Using embedded data - could not fetch from GitHub or local file'
        }),
      };
    }

    // Read and parse the JSON file
    const fileData = fs.readFileSync(dataPath, 'utf8');
    const rainfallData = JSON.parse(fileData);

    // Validate the data structure
    if (!rainfallData || !rainfallData.data || !Array.isArray(rainfallData.data)) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ 
          error: 'Invalid data format',
          message: 'Data file is corrupted or invalid'
        }),
      };
    }

    // Return the data with success status
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: rainfallData,
        timestamp: new Date().toISOString(),
        source: dataPath.startsWith('http') ? 'github-raw' : 'local-file'
      }),
    };

  } catch (error) {
    console.error('Error reading rainfall data:', error);

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Internal server error',
        message: 'Failed to load rainfall data',
        timestamp: new Date().toISOString()
      }),
    };
  }
}; 