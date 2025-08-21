import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

async function checkAPIScopes() {
  const userId = process.env.BREWFATHER_USER_ID;
  const apiKey = process.env.BREWFATHER_API_KEY;
  
  const client = axios.create({
    baseURL: 'https://api.brewfather.app/v2',
    headers: {
      'Authorization': `Basic ${Buffer.from(`${userId}:${apiKey}`).toString('base64')}`,
      'Content-Type': 'application/json'
    }
  });
  
  console.log('Testing API scope permissions...');
  
  const testScopes = [
    { name: 'Read Recipes', test: () => client.get('/recipes') },
    { name: 'Read Batches', test: () => client.get('/batches') },
    { name: 'Read Inventory', test: () => client.get('/inventory/hops') },
  ];
  
  for (const scope of testScopes) {
    try {
      const response = await scope.test();
      console.log(`✅ ${scope.name}: OK (${response.data.length} items)`);
    } catch (error) {
      if (error.response?.status === 403) {
        console.log(`❌ ${scope.name}: FORBIDDEN - Scope not granted`);
      } else {
        console.log(`❓ ${scope.name}: Error - ${error.response?.status} ${error.message}`);
      }
    }
  }
  
  // Now test Edit Inventory scope by trying to update
  console.log('\nTesting Edit Inventory scope...');
  try {
    const hopsResponse = await client.get('/inventory/hops');
    if (hopsResponse.data.length > 0) {
      const hop = hopsResponse.data[0];
      console.log(`Attempting to update hop: ${hop.name} (ID: ${hop._id})`);
      
      // Try with the exact field structure shown in the hop object
      const updateResponse = await client.patch(`/inventory/hops/${hop._id}`, {
        inventory: hop.inventory + 1  // Try setting absolute value
      });
      
      console.log(`Response: ${updateResponse.status} "${updateResponse.data}"`);
      
      if (updateResponse.data === "Nothing to update") {
        console.log('\n🤔 Possible reasons for "Nothing to update":');
        console.log('1. API key might not have "Edit Inventory" scope');
        console.log('2. The field name might be incorrect');
        console.log('3. The hop might be a "system" hop that cannot be modified');
        console.log('4. There might be validation rules preventing the update');
        
        // Let's try creating a test hop first
        console.log('\nTrying to create a new hop entry...');
        try {
          const createResponse = await client.post('/inventory/hops', {
            name: 'Test Hop API',
            alpha: 5.0,
            inventory: 100,
            type: 'Pellet',
            use: 'Boil'
          });
          console.log(`Create response: ${createResponse.status} ${JSON.stringify(createResponse.data)}`);
        } catch (createError) {
          console.log(`Create failed: ${createError.response?.status} ${createError.response?.data || createError.message}`);
        }
      }
    }
  } catch (error) {
    if (error.response?.status === 403) {
      console.log('❌ Edit Inventory: FORBIDDEN - API key does not have "Edit Inventory" scope');
    } else {
      console.log(`❓ Edit Inventory test failed: ${error.response?.status} ${error.message}`);
    }
  }
}

checkAPIScopes();
