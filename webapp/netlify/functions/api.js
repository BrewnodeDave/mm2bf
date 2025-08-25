const { Handler } = require('@netlify/functions');
const express = require('express');
const serverless = require('serverless-http');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Configure multer for file uploads (using /tmp for Netlify)
const upload = multer({
  dest: '/tmp/',
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'));
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    environment: 'netlify'
  });
});

// Simplified parse endpoint for testing
app.post('/parse', upload.single('invoice'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No PDF file uploaded' });
    }

    console.log(`Processing uploaded file: ${req.file.originalname}`);
    
    // For now, return basic file info to test the endpoint
    const fileInfo = {
      originalName: req.file.originalname,
      size: req.file.size,
      mimetype: req.file.mimetype,
      timestamp: new Date().toISOString()
    };

    // Basic mock data for testing
    const mockData = {
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
    };

    // Clean up uploaded file
    try {
      fs.unlinkSync(req.file.path);
    } catch (cleanupError) {
      console.warn('Failed to clean up file:', cleanupError.message);
    }

    res.json({
      success: true,
      fileInfo,
      mockData,
      message: 'File uploaded successfully (mock data returned)'
    });
    
  } catch (error) {
    console.error('Error in parse endpoint:', error);
    
    // Clean up uploaded file on error
    if (req.file && fs.existsSync(req.file.path)) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (cleanupError) {
        console.warn('Failed to clean up file on error:', cleanupError.message);
      }
    }
    
    res.status(500).json({ 
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Test Brewfather connection
app.post('/test-connection', async (req, res) => {
  try {
    const { userId, apiKey } = req.body;
    
    if (!userId || !apiKey) {
      return res.status(400).json({ error: 'User ID and API Key are required' });
    }

    // For now, return mock success for testing
    // TODO: Implement actual Brewfather API test
    res.json({ 
      success: true, 
      message: 'Connection test successful (mock)',
      credentials: {
        userId: userId.substring(0, 3) + '***',
        apiKeyLength: apiKey.length
      }
    });
    
  } catch (error) {
    console.error('Error testing connection:', error);
    res.status(500).json({ error: error.message });
  }
});

// Analyze ingredient matches (simplified)
app.post('/analyze-matches', async (req, res) => {
  try {
    const { ingredients, userId, apiKey } = req.body;
    
    if (!ingredients || !Array.isArray(ingredients)) {
      return res.status(400).json({ error: 'Ingredients array is required' });
    }
    
    if (!userId || !apiKey) {
      return res.status(400).json({ error: 'Brewfather credentials are required' });
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
    
    res.json({ matches: mockMatches });
    
  } catch (error) {
    console.error('Error analyzing matches:', error);
    res.status(500).json({ error: error.message });
  }
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Server error:', error);
  
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File too large. Maximum size is 10MB.' });
    }
  }
  
  res.status(500).json({ 
    error: 'Internal server error',
    details: process.env.NODE_ENV === 'development' ? error.message : undefined
  });
});

// Clean Netlify function - removing all Express code

exports.handler = async (event, context) => {
  // Set CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
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

  try {
    // Extract the path after /api from the event
    let path = event.path;
    
    // Remove the function path prefix if present
    if (path.startsWith('/.netlify/functions/api')) {
      path = path.replace('/.netlify/functions/api', '');
    }
    
    // If no path or just /, default to root
    if (!path || path === '') {
      path = '/';
    }
    
    console.log('API called:', {
      originalPath: event.path,
      processedPath: path,
      method: event.httpMethod,
      rawUrl: event.rawUrl
    });

    // Health check endpoint
    if (path === '/health' && event.httpMethod === 'GET') {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          status: 'healthy',
          timestamp: new Date().toISOString(),
          environment: 'netlify',
          path: path
        })
      };
    }

    // Parse endpoint for file uploads
    if (path === '/parse' && event.httpMethod === 'POST') {
      console.log('Processing parse request');
      
      // For now, return mock data (file upload in serverless is complex)
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
        ]
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
        path: event.path
      })
    };
  }
};
