const { logApiCall } = require( './utils/logger.cjs');
const axios = require('axios');

exports.handler = async (event) => {
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    const result = {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
    await logApiCall('test-connection', event, result);
    return result;
  }

  try {
        // Parse the request body
        const { userId, apiKey } = JSON.parse(event.body);

        if (!userId || !apiKey) {
            const errorResponse = {
                statusCode: 400,
                body: JSON.stringify({ 
                success: false, 
                message: 'Missing credentials' 
                })
            };
            await logApiCall('test-connection', event, errorResponse);
            return errorResponse;
        }

        const baseURL = 'https://api.brewfather.app/v2';
        
        const client = axios.create({
            baseURL: baseURL,
            headers: {
                'Authorization': `Basic ${Buffer.from(`${userId}:${apiKey}`).toString('base64')}`,
                'Content-Type': 'text/html; charset=utf-8'
            }
        });

        const response = await client.get('/recipes');
        return {
            statusCode: 200,
            body: JSON.stringify({ 
            success: true, 
            message: 'Connection successful' 
            })
        };
    } catch (error) {
        console.error('Connection test error:', error.response?.data || error.message);

        // Handle different error cases
        if (error.response?.status === 401) {
            const errorResponse =  {
                statusCode: 401,
                body: JSON.stringify({ 
                success: false, 
                message: 'Invalid credentials' 
                })
            };
            await logApiCall('test-connection', event, errorResponse);
            return errorResponse;
        }

        const errorResponse = {
            statusCode: 500,
            body: JSON.stringify({ 
                success: false, 
                message: 'Failed to connect to Brewfather' 
            })
        };
        await logApiCall('test-connection', event, errorResponse);
        return errorResponse;
    }
};