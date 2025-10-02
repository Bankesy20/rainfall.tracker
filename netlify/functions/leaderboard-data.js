const handler = async (event, context) => {
  // Enable CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Cache-Control, Pragma, Expires',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Content-Type': 'application/json'
  };

  // Handle preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  // Only allow GET requests
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    // Extract metric and period from path
    const pathParts = event.path.split('/');
    const filename = pathParts[pathParts.length - 1];
    
    if (!filename || !filename.endsWith('.json')) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Invalid filename. Expected format: leaderboard-{metric}-{period}.json' })
      };
    }

    // Try to load from Netlify Blobs first
    try {
      // Dynamic import for @netlify/blobs
      const { getStore } = await import('@netlify/blobs');
      
      // Use explicit configuration with environment variables
      const store = getStore({
        name: 'rainfall-data',
        siteID: process.env.NETLIFY_SITE_ID || 'f9735549-2ceb-4b4b-8263-fd2d52f641bb',
        token: process.env.NETLIFY_AUTH_TOKEN || 'nfp_DfAAJ5BgQ3FX7HtRJkaJWsYRwUozjtw73a99'
      });
      
      const blobKey = `leaderboards/${filename}`;
      const blobContent = await store.get(blobKey);
      
      if (blobContent) {
        const blobData = typeof blobContent === 'string' ? JSON.parse(blobContent) : blobContent;
        
        // Add cache headers for better performance
        const responseHeaders = {
          ...headers,
          'Cache-Control': 'public, max-age=300', // 5 minutes cache
          'ETag': `"${blobData.generated_at || 'unknown'}"`
        };
        
        return {
          statusCode: 200,
          headers: responseHeaders,
          body: JSON.stringify(blobData)
        };
      }
    } catch (blobError) {
      console.warn('Failed to load from Netlify Blobs:', blobError.message);
      console.warn('Blob error details:', {
        message: blobError.message,
        stack: blobError.stack,
        siteID: process.env.NETLIFY_SITE_ID || 'f9735549-2ceb-4b4b-8263-fd2d52f641bb',
        hasToken: !!process.env.NETLIFY_AUTH_TOKEN,
        filename: filename
      });
    }

    // Fallback to local file
    try {
      const fs = require('fs').promises;
      const path = require('path');
      
      const localPath = path.join(process.cwd(), 'netlify/functions/data/processed/leaderboards', filename);
      const fileContent = await fs.readFile(localPath, 'utf-8');
      const jsonData = JSON.parse(fileContent);
      
      return {
        statusCode: 200,
        headers: {
          ...headers,
          'Cache-Control': 'public, max-age=300',
          'X-Data-Source': 'local-fallback'
        },
        body: fileContent
      };
    } catch (localError) {
      console.warn('Failed to load from local file:', localError.message);
    }

    // If both fail, return 404
    return {
      statusCode: 404,
      headers,
      body: JSON.stringify({ 
        error: 'Leaderboard not found',
        filename: filename,
        message: 'The requested leaderboard data could not be found in blob storage or local files.'
      })
    };

  } catch (error) {
    console.error('Error in leaderboard-data function:', error);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Internal server error',
        message: error.message 
      })
    };
  }
};

module.exports = { handler };
