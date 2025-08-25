// Clean Netlify function - ONLY Netlify handler, no Express

exports.handler = async (event, context) => {
  console.log('=== NETLIFY FUNCTION DEBUG ===');
  console.log('Event path:', event.path);
  console.log('Event method:', event.httpMethod);
  console.log('Event headers:', JSON.stringify(event.headers, null, 2));
  console.log('Event query:', event.queryStringParameters);
  console.log('Context:', JSON.stringify(context, null, 2));
  
  // Set CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  // Handle preflight requests
  if (event.httpMethod === 'OPTIONS') {
    console.log('=== HANDLING OPTIONS REQUEST ===');
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  try {
    // Extract the path after /api from the event
    let path = event.path;
    console.log('Original path:', path);
    
    // Remove /api prefix if present (this is what we need!)
    if (path.startsWith('/api')) {
      path = path.replace('/api', '');
      console.log('Removed /api prefix, new path:', path);
    }
    
    // Remove the function path prefix if present (for direct access)
    if (path.startsWith('/.netlify/functions/api')) {
      path = path.replace('/.netlify/functions/api', '');
      console.log('Removed function prefix, new path:', path);
    }
    
    // If no path or just /, default to root
    if (!path || path === '') {
      path = '/';
      console.log('Defaulted to root path:', path);
    }
    
    console.log('Final processed path:', path);
    console.log('=== END DEBUG INFO ===');

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
          version: '1.0.0'
        })
      };
    }

    // Parse endpoint for file uploads
    if (path === '/parse' && event.httpMethod === 'POST') {
      console.log('Processing parse request');
      
      // For serverless functions, file upload is complex
      // Return mock data to test the endpoint connectivity
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          message: 'File uploaded successfully (mock data)',
          fileInfo: {
            originalName: 'test-invoice.pdf',
            size: 12345,
            mimetype: 'application/pdf',
            timestamp: new Date().toISOString()
          },
          mockData: {
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
        })
      };
    }

    // Test connection endpoint
    if (path === '/test-connection' && event.httpMethod === 'POST') {
      console.log('Processing test-connection request');
      
      let body = {};
      try {
        body = JSON.parse(event.body || '{}');
      } catch (e) {
        console.warn('Failed to parse request body:', e.message);
      }
      
      const { userId, apiKey } = body;
      
      if (!userId || !apiKey) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ 
            error: 'User ID and API Key are required' 
          })
        };
      }
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          message: 'Connection test successful (mock)',
          brewery: {
            name: 'Test Brewery',
            id: 'test-123'
          },
          credentials: {
            userId: userId.substring(0, 3) + '***',
            apiKeyLength: apiKey.length
          }
        })
      };
    }

    // Analyze matches endpoint
    if (path === '/analyze-matches' && event.httpMethod === 'POST') {
      console.log('Processing analyze-matches request');
      
      let body = {};
      try {
        body = JSON.parse(event.body || '{}');
      } catch (e) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Invalid JSON in request body' })
        };
      }
      
      const { ingredients, userId, apiKey } = body;
      
      if (!ingredients || !Array.isArray(ingredients)) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Ingredients array is required' })
        };
      }
      
      if (!userId || !apiKey) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Brewfather credentials are required' })
        };
      }

      // Return mock matches for testing
      const mockMatches = ingredients.map((ingredient, index) => ({
        ...ingredient,
        matchStatus: index % 3 === 0 ? 'exact' : index % 3 === 1 ? 'partial' : 'none',
        brewfatherMatch: index % 3 !== 2 ? {
          id: `bf-${index}`,
          name: `Brewfather ${ingredient.name}`,
          type: ingredient.type || 'fermentable'
        } : null
      }));
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ matches: mockMatches })
      };
    }

    // Default response for unknown endpoints
    return {
      statusCode: 404,
      headers,
      body: JSON.stringify({
        error: 'Endpoint not found',
        requestedPath: path,
        method: event.httpMethod,
        originalPath: event.path,
        availableEndpoints: [
          'GET /health',
          'POST /parse', 
          'POST /test-connection',
          'POST /analyze-matches'
        ],
        debug: {
          eventPath: event.path,
          processedPath: path,
          httpMethod: event.httpMethod
        }
      })
    };

  } catch (error) {
    console.error('API Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Internal server error',
        message: error.message,
        path: event.path,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      })
    };
  }
};