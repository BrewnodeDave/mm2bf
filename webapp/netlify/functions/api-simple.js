exports.handler = async (event, context) => {
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  // Handle preflight OPTIONS request
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  try {
    // Handle path extraction for both direct access and redirected access
    let path = event.path;
    
    // Remove function name prefix if present
    if (path.includes('/.netlify/functions/api-simple')) {
      path = path.replace('/.netlify/functions/api-simple', '');
    }
    
    // If path is empty, default to root
    if (!path || path === '') {
      path = '/';
    }
    
    console.log('Original path:', event.path);
    console.log('Processed path:', path);
    console.log('HTTP method:', event.httpMethod);
    
    // Health check endpoint
    if (path === '/health' && event.httpMethod === 'GET') {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          status: 'healthy',
          timestamp: new Date().toISOString(),
          environment: 'netlify',
          path: path,
          method: event.httpMethod
        })
      };
    }

    // Parse endpoint (simplified for testing)
    if (path === '/parse' && event.httpMethod === 'POST') {
      // For now, return mock data
      const mockData = {
        success: true,
        message: 'File upload endpoint working (mock data)',
        timestamp: new Date().toISOString(),
        mockInvoice: {
          invoiceNumber: 'TEST-001',
          date: new Date().toLocaleDateString(),
          total: '25.50',
          ingredients: [
            {
              name: 'Test Ingredient 1',
              quantity: 500,
              unit: 'g',
              unitPrice: 2.50,
              total: 2.50
            },
            {
              name: 'Test Ingredient 2',
              quantity: 1,
              unit: 'kg',
              unitPrice: 23.00,
              total: 23.00
            }
          ]
        }
      };

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(mockData)
      };
    }

    // Test connection endpoint
    if (path === '/test-connection' && event.httpMethod === 'POST') {
      const body = JSON.parse(event.body || '{}');
      const { userId, apiKey } = body;

      if (!userId || !apiKey) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'User ID and API Key are required' })
        };
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          message: 'Connection test successful (mock)',
          credentials: {
            userId: userId.substring(0, 3) + '***',
            apiKeyLength: apiKey.length
          }
        })
      };
    }

    // Default 404 response
    return {
      statusCode: 404,
      headers,
      body: JSON.stringify({ 
        error: 'Endpoint not found',
        path: path,
        method: event.httpMethod,
        availableEndpoints: ['/health', '/parse', '/test-connection']
      })
    };

  } catch (error) {
    console.error('Function error:', error);
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
