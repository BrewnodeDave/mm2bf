import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

async function testAPIv1() {
  const userId = process.env.BREWFATHER_USER_ID;
  const apiKey = process.env.BREWFATHER_API_KEY;
  
  const clientV1 = axios.create({
    baseURL: 'https://api.brewfather.app/v1',
    headers: {
      'Authorization': `Basic ${Buffer.from(`${userId}:${apiKey}`).toString('base64')}`,
      'Content-Type': 'application/json'
    }
  });
  
  const clientV2 = axios.create({
    baseURL: 'https://api.brewfather.app/v2',
    headers: {
      'Authorization': `Basic ${Buffer.from(`${userId}:${apiKey}`).toString('base64')}`,
      'Content-Type': 'application/json'
    }
  });
  
  try {
    console.log('Testing API v1 vs v2...');
    
    // Test v1 inventory read
    console.log('\n=== API v1 ===');
    try {
      const v1Response = await clientV1.get('/inventory/hops');
      console.log(`✅ v1 Read hops: ${v1Response.data.length} items`);
      
      if (v1Response.data.length > 0) {
        const hop = v1Response.data[0];
        console.log(`v1 hop example:`, JSON.stringify(hop, null, 2));
        
        // Try v1 update
        console.log('\nTrying v1 inventory update...');
        const v1UpdateResponse = await clientV1.patch(`/inventory/hops/${hop._id}`, {
          inventory: hop.inventory + 1
        });
        console.log(`v1 Update result: ${v1UpdateResponse.status} "${v1UpdateResponse.data}"`);
      }
    } catch (v1Error) {
      console.log(`❌ v1 Error: ${v1Error.response?.status} ${v1Error.response?.data || v1Error.message}`);
    }
    
    // Test v2 for comparison
    console.log('\n=== API v2 ===');
    try {
      const v2Response = await clientV2.get('/inventory/hops');
      console.log(`✅ v2 Read hops: ${v2Response.data.length} items`);
      
      if (v2Response.data.length > 0) {
        const hop = v2Response.data[0];
        console.log(`v2 hop example:`, JSON.stringify(hop, null, 2));
        
        // Try v2 update
        console.log('\nTrying v2 inventory update...');
        const v2UpdateResponse = await clientV2.patch(`/inventory/hops/${hop._id}`, {
          inventory: hop.inventory + 1
        });
        console.log(`v2 Update result: ${v2UpdateResponse.status} "${v2UpdateResponse.data}"`);
      }
    } catch (v2Error) {
      console.log(`❌ v2 Error: ${v2Error.response?.status} ${v2Error.response?.data || v2Error.message}`);
    }
    
    // Check if it's a Brewfather service issue
    console.log('\n=== Service Status Check ===');
    try {
      // Simple GET request to see if the service is working normally
      const statusResponse = await clientV2.get('/recipes?limit=1');
      console.log('✅ Brewfather service appears to be working normally');
    } catch (statusError) {
      console.log(`❌ Potential service issue: ${statusError.response?.status} ${statusError.message}`);
    }
    
  } catch (error) {
    console.error('General error:', error.message);
  }
}

testAPIv1();
