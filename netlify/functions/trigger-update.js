exports.handler = async (event, context) => {
  // Set CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  };

  // Handle preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: '',
    };
  }

  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    // Parse the request body
    const body = event.body ? JSON.parse(event.body) : {};
    
    // Log the trigger request
    console.log('Trigger update requested:', {
      timestamp: new Date().toISOString(),
      source: body.source || 'unknown',
      reason: body.reason || 'manual'
    });

    // For now, just return success
    // In the future, this could trigger a GitHub Actions webhook
    // or perform other cache invalidation tasks
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'Update trigger received',
        timestamp: new Date().toISOString(),
        note: 'This endpoint is for future use - cache invalidation not yet implemented'
      }),
    };

  } catch (error) {
    console.error('Error in trigger-update:', error);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Internal server error',
        message: 'Failed to process trigger request',
        timestamp: new Date().toISOString()
      }),
    };
  }
}; 