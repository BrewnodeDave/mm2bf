const { logApiCall } = require( './utils/logger.cjs');
const { BrewfatherAPI } = require('../../src/api/brewfather-api.js');
exports.handler = async (event) => {
  
  if (event.httpMethod !== 'POST') {
    const errorResponse = {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
    await logApiCall('analyze-matches', event, errorResponse);
    return errorResponse;
  }else{

    try {
      const { ingredients, userId, apiKey } = JSON.parse(event.body);

      if (!ingredients || !Array.isArray(ingredients)) {
        const errorResponse = {
          statusCode: 400,
          body: JSON.stringify({ error: 'Invalid ingredients data' })
        };
        await logApiCall('analyze-matches', event, errorResponse);
        return errorResponse;
      }
      else
      if (!userId || !apiKey) {
        const errorResponse = {
          statusCode: 400,
          body: JSON.stringify({ error: 'Brewfather credentials are required' })
        };
        await logApiCall('analyze-matches', event, errorResponse);
        return errorResponse;

      }else{

        const brewfatherAPI = new BrewfatherAPI(userId, apiKey);
        const matches = await brewfatherAPI.findMatchingIngredients(ingredients);

        if (!matches || Object.keys(matches).length === 0) {
          const errorResponse = {
            statusCode: 404,
            body: JSON.stringify({ error: 'No matching ingredients found' })
          };
          await logApiCall('analyze-matches', event, errorResponse);
          return errorResponse;
        }

        const result = {
          statusCode: 200,
          body: JSON.stringify({ matches })
        };
        await logApiCall('analyze-matches', event, result);

        return result;
      }
    } catch (error) {
      console.error('Analyze matches error:', error.response?.data || error.message);
      const errorResponse = {
        statusCode: 500,
        body: JSON.stringify({ error: 'Failed to analyze matches' })
      };
      await logApiCall('analyze-matches', event, errorResponse);
      return errorResponse
    }
  }
};