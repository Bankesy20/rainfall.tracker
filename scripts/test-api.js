#!/usr/bin/env node

/**
 * Test the rainfall API locally to ensure it works before and after blob migration
 */

const http = require('http');

async function testAPI(baseURL, endpoint, params = {}) {
  const queryString = new URLSearchParams(params).toString();
  const url = `${baseURL}${endpoint}${queryString ? `?${queryString}` : ''}`;
  
  console.log(`🔍 Testing: ${url}`);
  
  return new Promise((resolve, reject) => {
    const request = http.get(url, (response) => {
      let data = '';
      
      response.on('data', (chunk) => {
        data += chunk;
      });
      
      response.on('end', () => {
        try {
          const result = JSON.parse(data);
          resolve({
            status: response.statusCode,
            data: result,
            url: url
          });
        } catch (error) {
          reject(new Error(`Invalid JSON response: ${data.substring(0, 200)}`));
        }
      });
    });
    
    request.on('error', (error) => {
      reject(error);
    });
    
    request.setTimeout(10000, () => {
      request.destroy();
      reject(new Error('Request timeout'));
    });
  });
}

async function runTests() {
  console.log('🧪 API Testing Suite');
  console.log('='.repeat(50));
  
  const baseURL = 'http://localhost:8888';
  const endpoint = '/.netlify/functions/rainfall-data';
  
  const tests = [
    {
      name: 'Default station (Miserden)',
      params: { debug: '1' }
    },
    {
      name: 'Miserden explicit',
      params: { station: 'miserden1141', debug: '1' }
    },
    {
      name: 'Maenclochog station',
      params: { station: 'maenclochog1099', debug: '1' }
    },
    {
      name: 'Unknown station',
      params: { station: 'unknown123', debug: '1' }
    }
  ];
  
  let passed = 0;
  let failed = 0;
  
  for (const test of tests) {
    console.log(`\n📋 Test: ${test.name}`);
    console.log('-'.repeat(30));
    
    try {
      const result = await testAPI(baseURL, endpoint, test.params);
      
      if (result.status === 200) {
        const data = result.data;
        
        console.log(`✅ Status: ${result.status}`);
        console.log(`📊 Success: ${data.success}`);
        console.log(`📁 Source: ${data.source || 'unknown'}`);
        
        if (data.data && data.data.data) {
          console.log(`📈 Records: ${data.data.data.length.toLocaleString()}`);
          console.log(`🕐 Last updated: ${data.data.lastUpdated || 'unknown'}`);
        }
        
        if (data.diagnostics) {
          console.log(`🔧 Blob enabled: ${data.diagnostics.config?.useBlobStorage || false}`);
          console.log(`🛡️  Fallback enabled: ${data.diagnostics.config?.blobFallbackEnabled !== false}`);
          
          if (data.diagnostics.decided) {
            console.log(`✨ Data source: ${data.diagnostics.decided.type}`);
          }
        }
        
        passed++;
      } else {
        console.log(`❌ Status: ${result.status}`);
        console.log(`📋 Response: ${JSON.stringify(result.data, null, 2)}`);
        failed++;
      }
      
    } catch (error) {
      console.log(`❌ Error: ${error.message}`);
      failed++;
    }
  }
  
  console.log('\n' + '='.repeat(50));
  console.log('📊 TEST RESULTS');
  console.log('='.repeat(50));
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📈 Total: ${tests.length}`);
  
  if (failed === 0) {
    console.log('\n🎉 All tests passed! API is working correctly.');
    
    console.log('\n💡 Next steps:');
    console.log('   1. Upload data to blobs: npm run blob:upload');
    console.log('   2. Enable blob storage: npm run blob:enable');
    console.log('   3. Run tests again to verify blob functionality');
    
  } else {
    console.log('\n⚠️  Some tests failed. Check the API setup.');
    console.log('💡 Make sure you\'re running: npm run dev:netlify');
  }
  
  return failed === 0;
}

// Check if Netlify dev server is running
async function checkServer() {
  try {
    await testAPI('http://localhost:8888', '/');
    return true;
  } catch (error) {
    console.log('❌ Netlify dev server not running');
    console.log('💡 Start it with: npm run dev:netlify');
    console.log('🔗 Then access: http://localhost:8888\n');
    return false;
  }
}

async function main() {
  const serverRunning = await checkServer();
  if (!serverRunning) {
    process.exit(1);
  }
  
  const success = await runTests();
  process.exit(success ? 0 : 1);
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { testAPI, runTests };
