const https = require('https');
const fs = require('fs');

// Get the API key from our test endpoint first
async function getApiKeyFromTestEndpoint() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'care-tracker-v0.vercel.app',
      port: 443,
      path: '/api/test-env',
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          const fullKey = parsed.debug.apiKeyFirst20 + '...' + parsed.debug.apiKeyLast10;
          resolve({
            length: parsed.debug.apiKeyLength,
            first20: parsed.debug.apiKeyFirst20,
            last10: parsed.debug.apiKeyLast10,
            present: parsed.debug.apiKeyPresent
          });
        } catch (error) {
          reject(error);
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

// Test Claude API directly with the same key format
async function testClaudeApiDirectly(apiKeyInfo) {
  console.log('🧪 Testing Claude API directly with reconstructed key...');
  
  // We can't reconstruct the full key, but we can test with a known working key
  // Let's use the environment variable from our local test
  const testApiKey = process.env.ANTHROPIC_API_KEY;
  
  if (!testApiKey) {
    console.log('❌ No local ANTHROPIC_API_KEY found for direct testing');
    return;
  }
  
  console.log('🔑 Local API Key Length:', testApiKey.length);
  console.log('🔑 Local API Key First 20:', testApiKey.substring(0, 20));
  console.log('🔑 Local API Key Last 10:', testApiKey.substring(testApiKey.length - 10));
  
  // Test with minimal PDF content
  const testPdfBase64 = 'JVBERi0xLjQKJcOkw7zDtsOgCjIgMCBvYmoKPDwvTGVuZ3RoIDMgMCBSL0ZpbHRlci9GbGF0ZURlY29kZT4+CnN0cmVhbQp4nDPQM1Qo5ypUMFAw0DMwULCx0XfOzCtJzSvRBQQAAP//BiwCHAplbmRzdHJlYW0KZW5kb2JqCgozIDAgb2JqCjI4CmVuZG9iagoKMSAwIG9iago8PC9UeXBlL0NhdGFsb2cvUGFnZXMgNCAwIFI+PgplbmRvYmoKCjQgMCBvYmoKPDwvVHlwZS9QYWdlcy9LaWRzWzUgMCBSXS9Db3VudCAxPj4KZW5kb2JqCgo1IDAgb2JqCjw8L1R5cGUvUGFnZS9QYXJlbnQgNCAwIFIvTWVkaWFCb3hbMCAwIDYxMiA3OTJdL0NvbnRlbnRzIDIgMCBSPj4KZW5kb2JqCgp4cmVmCjAgNgowMDAwMDAwMDAwIDY1NTM1IGYgCjAwMDAwMDAxNDkgMDAwMDAgbiAKMDAwMDAwMDAwOSAwMDAwMCBuIAowMDAwMDAwMTI1IDAwMDAwIG4gCjAwMDAwMDAxOTYgMDAwMDAgbiAKMDAwMDAwMDI1MyAwMDAwMCBuIAp0cmFpbGVyCjw8L1NpemUgNi9Sb290IDEgMCBSPj4Kc3RhcnR4cmVmCjM1MwolJUVPRg==';
  
  const requestBody = {
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 1000,
    messages: [
      { 
        role: 'user', 
        content: [
          {
            type: 'text',
            text: 'Please read this PDF and tell me what it contains.'
          },
          {
            type: 'document',
            source: {
              type: 'base64',
              media_type: 'application/pdf',
              data: testPdfBase64
            }
          }
        ]
      }
    ]
  };

  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(requestBody);
    
    const options = {
      hostname: 'api.anthropic.com',
      port: 443,
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'x-api-key': testApiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    console.log('🚀 Making direct Claude API request...');
    
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        console.log('📡 Claude API Response Status:', res.statusCode);
        console.log('📋 Response Headers:', res.headers);
        
        if (res.statusCode === 200) {
          console.log('✅ Direct Claude API call SUCCESSFUL!');
          try {
            const parsed = JSON.parse(data);
            console.log('📄 Response preview:', data.substring(0, 200) + '...');
          } catch (e) {
            console.log('📄 Raw response:', data.substring(0, 200) + '...');
          }
        } else {
          console.log('❌ Direct Claude API call FAILED!');
          console.log('📄 Error response:', data);
        }
        
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: data
        });
      });
    });

    req.on('error', (error) => {
      console.error('🚨 Request error:', error);
      reject(error);
    });

    req.write(postData);
    req.end();
  });
}

async function main() {
  console.log('🔍 Debugging Claude API Key Issue...\n');
  
  try {
    // Step 1: Get API key info from test endpoint
    console.log('1️⃣ Getting API key info from test endpoint...');
    const apiKeyInfo = await getApiKeyFromTestEndpoint();
    console.log('Production API Key Info:');
    console.log('- Length:', apiKeyInfo.length);
    console.log('- First 20 chars:', apiKeyInfo.first20);
    console.log('- Last 10 chars:', apiKeyInfo.last10);
    console.log('- Present:', apiKeyInfo.present);
    
    console.log('\n2️⃣ Testing Claude API directly with local key...');
    await testClaudeApiDirectly(apiKeyInfo);
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

main().catch(console.error);