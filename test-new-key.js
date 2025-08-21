import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

async function quickInventoryTest() {
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
    console.log('Testing inventory update with new API key...');
    
    const hopsResponse = await client.get('/inventory/hops');
    const hop = hopsResponse.data[0];
    
    console.log(`Testing with: ${hop.name} (current: ${hop.inventory}g)`);
    
    const response = await client.patch(`/inventory/hops/${hop._id}`, {
      inventory_adjust: 1
    });
    
    console.log(`Result: ${response.status} "${response.data}"`);
    
    if (response.data === "Updated") {
      console.log('🎉 SUCCESS! API key now has Edit Inventory permissions!');
    } else {
      console.log('❌ Still getting "Nothing to update" - API key issue persists');
    }
    
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
}

quickInventoryTest();
