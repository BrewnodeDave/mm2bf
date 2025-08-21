import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

async function testAllFields() {
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
    const hopsResponse = await client.get('/inventory/hops');
    const hop = hopsResponse.data[0];
    
    console.log('Original hop object:');
    console.log(JSON.stringify(hop, null, 2));
    
    // Test updating each field individually
    const fieldsToTest = [
      { name: 'inventory', value: hop.inventory + 1 },
      { name: 'inventory_adjust', value: 1 },
      { name: 'inventory_adjustment', value: 1 },
      { name: 'amount', value: hop.inventory + 1 },
      { name: 'stock', value: hop.inventory + 1 },
      { name: 'alpha', value: hop.alpha + 0.1 },
      { name: 'cost', value: 5.99 },
      { name: 'costUnit', value: 'GBP' },
      { name: 'notes', value: 'Test update from API' }
    ];
    
    console.log('\nTesting individual field updates...');
    
    for (const field of fieldsToTest) {
      try {
        console.log(`\nTesting field: ${field.name} = ${field.value}`);
        const updateData = { [field.name]: field.value };
        
        const response = await client.patch(`/inventory/hops/${hop._id}`, updateData);
        console.log(`  Result: ${response.status} "${response.data}"`);
        
        if (response.data === "Updated") {
          console.log(`  ✅ SUCCESS! Field ${field.name} can be updated`);
          break; // Stop testing once we find a working field
        }
      } catch (error) {
        console.log(`  Error: ${error.response?.status} ${error.response?.data || error.message}`);
      }
    }
    
    // Test combination updates
    console.log('\nTesting combination updates...');
    try {
      const comboUpdate = {
        inventory: hop.inventory + 1,
        cost: 5.99,
        costUnit: 'GBP'
      };
      console.log(`Combo update data:`, JSON.stringify(comboUpdate));
      
      const response = await client.patch(`/inventory/hops/${hop._id}`, comboUpdate);
      console.log(`Combo result: ${response.status} "${response.data}"`);
    } catch (error) {
      console.log(`Combo error: ${error.response?.status} ${error.response?.data || error.message}`);
    }
    
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
}

testAllFields();
