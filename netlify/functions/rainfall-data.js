const fs = require('fs');
const path = require('path');

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

  try {
    // Try multiple possible paths for the rainfall data file
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
    
    // Debug: Log current directory and available files
    console.log('Current directory:', process.cwd());
    console.log('Function directory:', __dirname);
    console.log('Available files in function dir:', fs.readdirSync(__dirname));
    
    let dataPath = null;
    for (const path of possiblePaths) {
      console.log('Checking path:', path);
      if (fs.existsSync(path)) {
        console.log('Found data file at:', path);
        dataPath = path;
        break;
      }
    }
    
    // Check if file exists
    if (!dataPath) {
      console.log('No data file found, trying to read from public directory...');
      
      // Try to read from the public directory as a last resort
      try {
        const publicDataPath = path.join(process.cwd(), '..', 'public', 'data', 'processed', 'rainfall-history.json');
        if (fs.existsSync(publicDataPath)) {
          console.log('Found data in public directory');
          const data = fs.readFileSync(publicDataPath, 'utf8');
          const rainfallData = JSON.parse(data);
          
          return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
              success: true,
              data: rainfallData,
              timestamp: new Date().toISOString(),
              source: 'netlify-function-public'
            }),
          };
        }
      } catch (error) {
        console.log('Error reading from public directory:', error.message);
      }
      
      console.log('No data file found, returning embedded data');
      
      // Return embedded data with actual rainfall records
      const embeddedData = {
        lastUpdated: "2025-08-07T19:46:48.562Z",
        station: "1141",
        data: [
          {
            "date": "2025-08-04",
            "time": "09:30",
            "rainfall_mm": 0.2,
            "total_mm": 0
          },
          {
            "date": "2025-08-04",
            "time": "10:15",
            "rainfall_mm": 0.2,
            "total_mm": 0
          },
          {
            "date": "2025-08-04",
            "time": "11:45",
            "rainfall_mm": 0.2,
            "total_mm": 0
          },
          {
            "date": "2025-08-04",
            "time": "12:30",
            "rainfall_mm": 0.4,
            "total_mm": 0
          },
          {
            "date": "2025-08-04",
            "time": "13:45",
            "rainfall_mm": 0.2,
            "total_mm": 0
          }
        ]
      };
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          data: embeddedData,
          timestamp: new Date().toISOString(),
          source: 'netlify-function-embedded',
          note: 'Using embedded data with actual rainfall - file access issue being debugged'
        }),
      };
    }

    // Read and parse the JSON file
    const data = fs.readFileSync(dataPath, 'utf8');
    const rainfallData = JSON.parse(data);

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
        source: 'netlify-function'
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