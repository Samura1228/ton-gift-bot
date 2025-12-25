require('dotenv').config();
const axios = require('axios');

// TON API configuration
const tonApiConfig = {
  baseURL: process.env.TON_API_URL || 'https://tonapi.io/v2',
  fallbackURL: process.env.FALLBACK_TON_API_URL || 'https://toncenter.com/api/v2',
  headers: {
    'Content-Type': 'application/json',
    'X-API-Key': process.env.TON_API_KEY
  }
};

// Test address (can be changed)
const testAddress = 'UQCXCt_Mz3GV_79RWQa0dikSOdS-7YjUsIfgovtgzfOk_W3q';

// Helper function to make API requests
async function makeApiRequest(endpoint, params = {}, method = 'get') {
  console.log(`\n=== Testing ${tonApiConfig.baseURL}${endpoint} ===`);
  console.log('Request params:', params);
  console.log('Headers:', tonApiConfig.headers);
  
  try {
    const response = await axios({
      method,
      url: `${tonApiConfig.baseURL}${endpoint}`,
      headers: tonApiConfig.headers,
      params: method === 'get' ? params : undefined,
      data: method === 'post' ? params : undefined,
      timeout: 10000 // 10 seconds timeout
    });
    
    console.log('Status:', response.status);
    console.log('Response data:', JSON.stringify(response.data, null, 2).substring(0, 500) + '...');
    return response.data;
  } catch (error) {
    console.error('Error:', error.message);
    console.error('Status:', error.response?.status);
    console.error('Response data:', error.response?.data);
    
    console.log(`\n=== Testing fallback ${tonApiConfig.fallbackURL}${endpoint} ===`);
    
    try {
      const fallbackResponse = await axios({
        method,
        url: `${tonApiConfig.fallbackURL}${endpoint}`,
        headers: tonApiConfig.headers,
        params: method === 'get' ? params : undefined,
        data: method === 'post' ? params : undefined,
        timeout: 10000
      });
      
      console.log('Fallback Status:', fallbackResponse.status);
      console.log('Fallback Response data:', JSON.stringify(fallbackResponse.data, null, 2).substring(0, 500) + '...');
      return fallbackResponse.data;
    } catch (fallbackError) {
      console.error('Fallback Error:', fallbackError.message);
      console.error('Fallback Status:', fallbackError.response?.status);
      console.error('Fallback Response data:', fallbackError.response?.data);
      throw new Error(`API request failed: ${error.message}, Fallback: ${fallbackError.message}`);
    }
  }
}

// Test functions
async function testGetTransactions() {
  try {
    console.log('\n\n=== TESTING GET TRANSACTIONS ===');
    const endpoint = `/accounts/${testAddress}/transactions`;
    const params = { limit: 5 };
    await makeApiRequest(endpoint, params);
  } catch (error) {
    console.error('Test failed:', error.message);
  }
}

async function testGetNfts() {
  try {
    console.log('\n\n=== TESTING GET NFTS ===');
    const endpoint = `/accounts/${testAddress}/nfts`;
    await makeApiRequest(endpoint);
  } catch (error) {
    console.error('Test failed:', error.message);
  }
}

async function testAlternativeEndpoints() {
  try {
    console.log('\n\n=== TESTING ALTERNATIVE ENDPOINTS ===');
    
    // Test alternative transaction endpoint
    console.log('\n--- Testing alternative transaction endpoint ---');
    const txEndpoint = `/v2/blockchain/accounts/${testAddress}/transactions`;
    await makeApiRequest(txEndpoint, { limit: 5 });
    
    // Test alternative NFT endpoint
    console.log('\n--- Testing alternative NFT endpoint ---');
    const nftEndpoint = `/nft/owners/${testAddress}`;
    await makeApiRequest(nftEndpoint);
  } catch (error) {
    console.error('Test failed:', error.message);
  }
}

// Run tests
async function runTests() {
  console.log('=== TON API TEST SCRIPT ===');
  console.log('API URL:', tonApiConfig.baseURL);
  console.log('Fallback URL:', tonApiConfig.fallbackURL);
  console.log('Test Address:', testAddress);
  
  await testGetTransactions();
  await testGetNfts();
  await testAlternativeEndpoints();
  
  console.log('\n=== TESTS COMPLETED ===');
}

runTests().catch(console.error);