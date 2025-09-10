const axios = require('axios');

exports.handler = async (event) => {
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

    try {
        // Parse the request body
        const { userId, apiKey } = JSON.parse(event.body);

        if (!userId || !apiKey) {
        return {
            statusCode: 400,
            body: JSON.stringify({ 
            success: false, 
            message: 'Missing credentials' 
            })
        };
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
            return {
                statusCode: 401,
                body: JSON.stringify({ 
                success: false, 
                message: 'Invalid credentials' 
                })
            };
        }

        return {
            statusCode: 500,
            body: JSON.stringify({ 
                success: false, 
                message: 'Failed to connect to Brewfather' 
            })
        };
    }
};