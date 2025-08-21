import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

async function testDifferentApproaches() {
  const userId = process.env.BREWFATHER_USER_ID;
  const apiKey = process.env.BREWFATHER_API_KEY;
  
  const client = axios.create({
    baseURL: 'https://api.brewfather.app/v2',
    headers: {
      'Authorization': `Basic ${Buffer.from(`${userId}:${apiKey}`).toString('base64')}`,
      'Content-Type': 'application/json'
    }
  });
  
  try {
    // Get hops inventory
    const hopsResponse = await client.get('/inventory/hops');
    const firstHop = hopsResponse.data[0];
    
    console.log('Testing different update approaches...');
    console.log('Hop:', firstHop.name, '- Current inventory:', firstHop.inventory, 'g');
    console.log('Hop ID:', firstHop._id);
    
    // Test 1: Try larger adjustment
    console.log('\n1. Trying larger adjustment (+5g)...');
    try {
      const response1 = await client.patch(`/inventory/hops/${firstHop._id}`, { inventory_adjust: 5 });
      console.log('   Result:', response1.status, response1.data);
    } catch (e) {
      console.log('   Error:', e.response?.data || e.message);
    }
    
    // Test 2: Try setting absolute inventory value
    console.log('\n2. Trying absolute inventory value...');
    try {
      const response2 = await client.patch(`/inventory/hops/${firstHop._id}`, { inventory: firstHop.inventory + 1 });
      console.log('   Result:', response2.status, response2.data);
    } catch (e) {
      console.log('   Error:', e.response?.data || e.message);
    }
    
    // Test 3: Try negative adjustment
    console.log('\n3. Trying negative adjustment (-1g)...');
    try {
      const response3 = await client.patch(`/inventory/hops/${firstHop._id}`, { inventory_adjust: -1 });
      console.log('   Result:', response3.status, response3.data);
    } catch (e) {
      console.log('   Error:', e.response?.data || e.message);
    }
    
    // Test 4: Try with different hop
    if (hopsResponse.data.length > 1) {
      const secondHop = hopsResponse.data[1];
      console.log('\n4. Trying with different hop:', secondHop.name);
      console.log('   Current inventory:', secondHop.inventory, 'g');
      try {
        const response4 = await client.patch(`/inventory/hops/${secondHop._id}`, { inventory_adjust: 1 });
        console.log('   Result:', response4.status, response4.data);
      } catch (e) {
        console.log('   Error:', e.response?.data || e.message);
      }
    }
    
    // Test 5: Check what fields are actually available for update
    console.log('\n5. Full hop object structure:');
    console.log(JSON.stringify(firstHop, null, 2));
    
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
}

testDifferentApproaches();
