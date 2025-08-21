import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

async function testAPIWrite() {
  const userId = process.env.BREWFATHER_USER_ID;
  const apiKey = process.env.BREWFATHER_API_KEY;
  
  console.log('Testing Brewfather API write permissions...');
  console.log('User ID:', userId);
  console.log('API Key:', apiKey.substring(0, 10) + '...');
  
  const client = axios.create({
    baseURL: 'https://api.brewfather.app/v2',
    headers: {
      'Authorization': `Basic ${Buffer.from(`${userId}:${apiKey}`).toString('base64')}`,
      'Content-Type': 'application/json'
    }
  });
  
  try {
    // First, test connection
    console.log('\n1. Testing connection...');
    const recipesResponse = await client.get('/recipes');
    console.log('✅ Connection successful, found', recipesResponse.data.length, 'recipes');
    
    // Get hops inventory
    console.log('\n2. Getting hops inventory...');
    const hopsResponse = await client.get('/inventory/hops');
    console.log('✅ Found', hopsResponse.data.length, 'hops in inventory');
    
    if (hopsResponse.data.length > 0) {
      const firstHop = hopsResponse.data[0];
      console.log('\n3. Testing with first hop:');
      console.log('   Name:', firstHop.name);
      console.log('   ID:', firstHop._id);
      console.log('   Current inventory:', firstHop.inventory || 0, 'g');
      
      // Try a very small adjustment (0.1g)
      console.log('\n4. Attempting inventory adjustment (+0.1g)...');
      const updateData = { inventory_adjust: 0.1 };
      console.log('   Update data:', JSON.stringify(updateData));
      
      const updateResponse = await client.patch(`/inventory/hops/${firstHop._id}`, updateData);
      console.log('   Response status:', updateResponse.status);
      console.log('   Response data:', JSON.stringify(updateResponse.data));
      
      if (updateResponse.data === "Updated") {
        console.log('✅ SUCCESS: Inventory update worked!');
        
        // Verify the change
        console.log('\n5. Verifying the change...');
        const verifyResponse = await client.get('/inventory/hops');
        const updatedHop = verifyResponse.data.find(h => h._id === firstHop._id);
        console.log('   New inventory:', updatedHop.inventory || 0, 'g');
      } else if (updateResponse.data === "Nothing to update") {
        console.log('❌ PROBLEM: API returned "Nothing to update"');
        console.log('   This could mean:');
        console.log('   - The inventory value is the same as current');
        console.log('   - There\'s a validation issue');
        console.log('   - The field is protected for some reason');
      } else {
        console.log('❓ UNEXPECTED: API returned:', updateResponse.data);
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
    if (error.response?.status === 403) {
      console.log('This indicates insufficient permissions');
    }
  }
}

testAPIWrite();
