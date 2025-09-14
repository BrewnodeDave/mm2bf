const { BrewfatherAPI } = require('../../src/api/brewfather-api.js');
exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { ingredients, userId, apiKey } = JSON.parse(event.body);

    if (!ingredients || !Array.isArray(ingredients)) {
       return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Invalid ingredients data' })
      };
    }

    if (!userId || !apiKey) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Brewfather credentials are required' })
      };
    }

    const brewfatherAPI = new BrewfatherAPI(userId, apiKey);
    const matches = await brewfatherAPI.findMatchingIngredients(ingredients);

    if (!matches || Object.keys(matches).length === 0) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'No matching ingredients found' })
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ matches })
    };
  } catch (error) {
    console.error('Analyze matches error:', error.response?.data || error.message);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to analyze matches' })
    };
  }
};