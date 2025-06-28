const https = require('https');

async function testEndpoint(path, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'care-tracker-v0.vercel.app',
      port: 443,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      }
    };

    if (body) {
      const bodyString = JSON.stringify(body);
      options.headers['Content-Length'] = Buffer.byteLength(bodyString);
    }

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: data
        });
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function main() {
  console.log('🧪 Testing Both Endpoints for Environment Variable Consistency...\n');
  
  // Test 1: Test environment endpoint
  console.log('1️⃣ Testing /api/test-env endpoint:');
  try {
    const testEnvResponse = await testEndpoint('/api/test-env');
    console.log('Status:', testEnvResponse.status);
    const testEnvData = JSON.parse(testEnvResponse.body);
    console.log('API Key Length:', testEnvData.debug?.apiKeyLength);
    console.log('API Key First 20:', testEnvData.debug?.apiKeyFirst20);
    console.log('API Key Present:', testEnvData.debug?.apiKeyPresent);
  } catch (error) {
    console.error('Test env endpoint error:', error.message);
  }
  
  console.log('\n2️⃣ Testing /api/upload endpoint with minimal payload:');
  
  // Test 2: Test upload endpoint with minimal data to trigger environment variable check
  const minimalPayload = {
    uploadMetadata: {
      uploadId: 'test-env-check',
      fileName: 'test.pdf',
      fileSize: 1000
    },
    fileData: {
      base64Content: 'dGVzdA==' // Just "test" in base64
    }
  };
  
  try {
    const uploadResponse = await testEndpoint('/api/upload', 'POST', minimalPayload);
    console.log('Status:', uploadResponse.status);
    console.log('Response:', uploadResponse.body.substring(0, 200) + '...');
    
    // The logs should show our comprehensive debugging output
    console.log('\n🔍 Check Vercel function logs for the comprehensive environment variable debug output from the upload endpoint');
    
  } catch (error) {
    console.error('Upload endpoint error:', error.message);
  }
}

main().catch(console.error);