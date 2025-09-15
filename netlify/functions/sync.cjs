const { logApiCall } = require( './utils/logger.cjs');
const { BrewfatherAPI } = require('../../src/api/brewfather-api.js');

exports.handler = async (event) => {
  await logApiCall('sync', event);

  if (event.httpMethod !== 'POST') {
    const errorResponse = {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
    await logApiCall('sync', event, errorResponse);
    return errorResponse;
  }

  try {
    const { ingredients, userId, apiKey } = JSON.parse(event.body);
    
    if (!ingredients || !Array.isArray(ingredients)) {
      const errorResponse = {
        statusCode: 400,
        body: JSON.stringify({ error: 'Ingredients array is required' })
      };
      await logApiCall('sync', event, errorResponse);
      return errorResponse;
    }
    
    if (!userId || !apiKey) {
      const errorResponse = {
        statusCode: 400,
        body: JSON.stringify({ error: 'Brewfather credentials are required' })
      };
      await logApiCall('sync', event, errorResponse);
      return errorResponse;
    }

    const brewfatherAPI = new BrewfatherAPI(userId, apiKey);
    
    // Group ingredients by type
    const groupedIngredients = ingredients.reduce((groups, ingredient) => {
      const type = ingredient.type;
      if (!groups[type]) {
        groups[type] = [];
      }
      groups[type].push(ingredient);
      return groups;
    }, {});

    const results = {};
    
    // Update each type
    for (const [type, typeIngredients] of Object.entries(groupedIngredients)) {
      try {
        switch (type) {
          case 'fermentable':
            results[type] = await brewfatherAPI.updateFermentables(typeIngredients);
            break;
          case 'hop':
            results[type] = await brewfatherAPI.updateHops(typeIngredients);
            break;
          case 'yeast':
            results[type] = await brewfatherAPI.updateYeasts(typeIngredients);
            break;
          case 'misc':
            results[type] = await brewfatherAPI.updateMiscs(typeIngredients);
            break;
        }
      } catch (error) {
        console.error(`Error updating ${type} ingredients:`, error);
        results[type] = { error: error.message };
        await logApiCall('sync', event, results);
      }
    }
    
    const result = {
      statusCode: 200,
      body: JSON.stringify({ results })
    };
    await logApiCall('sync', event, result);
    return result;

  } catch (error) {
    console.error('Error syncing with Brewfather:', error);
    const errorResponse = {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
    await logApiCall('sync', event, errorResponse);
    return errorResponse;
  }
}
