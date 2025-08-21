import { BrewfatherAPI } from './src/api/brewfather-api.js';
import dotenv from 'dotenv';

dotenv.config();

const api = new BrewfatherAPI(
  process.env.BREWFATHER_USER_ID,
  process.env.BREWFATHER_API_KEY
);

async function testSingleRequest() {
  try {
    console.log('Getting hops...');
    const hops = await api.getHops();
    
    const chinook = hops.find(hop => hop.name && hop.name.toLowerCase().includes('chinook'));
    
    if (!chinook) {
      console.log('No Chinook hop found');
      return;
    }
    
    console.log('Found Chinook:', JSON.stringify(chinook, null, 2));
    
    // Test the exact same request as in the main code
    const updateData = { inventory_adjust: 100 };
    const fullUrl = `${api.baseURL}/inventory/hops/${chinook._id}`;
    
    console.log('\n=== REQUEST DETAILS ===');
    console.log('URL:', fullUrl);
    console.log('Method: PATCH');
    console.log('Headers:', JSON.stringify(api.client.defaults.headers, null, 2));
    console.log('Body:', JSON.stringify(updateData, null, 2));
    
    console.log('\n=== MAKING REQUEST ===');
    const response = await api.client.patch(`/inventory/hops/${chinook._id}`, updateData);
    
    console.log('\n=== RESPONSE ===');
    console.log('Status:', response.status);
    console.log('Data:', JSON.stringify(response.data, null, 2));
    console.log('Headers:', JSON.stringify(response.headers, null, 2));
    
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
}

testSingleRequest();
