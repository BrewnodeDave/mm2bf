const axios = require('axios');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { ingredients, userId, apiKey } = JSON.parse(event.body);

    if (!Array.isArray(ingredients)) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Invalid ingredients data' })
      };
    }

    // Get fermentables from Brewfather
    const response = await axios.get('https://api.brewfather.app/v2/inventory/fermentables', {
      headers: {
        'Authorization': 'Basic ' + Buffer.from(`${userId}:${apiKey}`).toString('base64')
      }
    });

    // Match ingredients with Brewfather items
    const matches = {};
    ingredients.forEach(ingredient => {
      const matchingItems = response.data.filter(item => {
        const ingredientName = ingredient.name.toLowerCase();
        const itemName = item.name.toLowerCase();
        
        // Exact match
        if (itemName === ingredientName) {
          return { found: true, confidence: 'high', brewfatherItem: item };
        }
        
        // Partial match
        if (itemName.includes(ingredientName) || ingredientName.includes(itemName)) {
          return { found: true, confidence: 'partial', brewfatherItem: item };
        }
        
        return false;
      });

      if (matchingItems.length > 0) {
        matches[ingredient.name] = {
          found: true,
          confidence: matchingItems[0].name.toLowerCase() === ingredient.name.toLowerCase() ? 'high' : 'partial',
          brewfatherItem: matchingItems[0]
        };
      } else {
        matches[ingredient.name] = { found: false };
      }
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ matches })
    };

  } catch (error) {
    console.error('Analyze matches error:', error.response?.data || error.message);

    if (error.response?.status === 401) {
      return {
        statusCode: 401,
        body: JSON.stringify({ error: 'Invalid Brewfather credentials' })
      };
    }

    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to analyze matches' })
    };
  }
};