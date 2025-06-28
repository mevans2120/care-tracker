const https = require('https');

async function testMinimalUpload() {
  console.log('🧪 Testing Upload Endpoint with Minimal Data...\n');
  
  // Create the exact same request structure as the real upload, but with minimal data
  const minimalPayload = {
    uploadMetadata: {
      uploadId: 'test-env-debug',
      fileName: 'test.pdf',
      fileSize: 100
    },
    fileData: {
      base64Content: 'JVBERi0xLjQKJcOkw7zDtsOgCjIgMCBvYmoKPDwvTGVuZ3RoIDMgMCBSL0ZpbHRlci9GbGF0ZURlY29kZT4+CnN0cmVhbQp4nDPQM1Qo5ypUMFAw0DMwULCx0XfOzCtJzSvRBQQAAP//BiwCHAplbmRzdHJlYW0KZW5kb2JqCgozIDAgb2JqCjI4CmVuZG9iagoKMSAwIG9iago8PC9UeXBlL0NhdGFsb2cvUGFnZXMgNCAwIFI+PgplbmRvYmoKCjQgMCBvYmoKPDwvVHlwZS9QYWdlcy9LaWRzWzUgMCBSXS9Db3VudCAxPj4KZW5kb2JqCgo1IDAgb2JqCjw8L1R5cGUvUGFnZS9QYXJlbnQgNCAwIFIvTWVkaWFCb3hbMCAwIDYxMiA3OTJdL0NvbnRlbnRzIDIgMCBSPj4KZW5kb2JqCgp4cmVmCjAgNgowMDAwMDAwMDAwIDY1NTM1IGYgCjAwMDAwMDAxNDkgMDAwMDAgbiAKMDAwMDAwMDAwOSAwMDAwMCBuIAowMDAwMDAwMTI1IDAwMDAwIG4gCjAwMDAwMDAxOTYgMDAwMDAgbiAKMDAwMDAwMDI1MyAwMDAwMCBuIAp0cmFpbGVyCjw8L1NpemUgNi9Sb290IDEgMCBSPj4Kc3RhcnR4cmVmCjM1MwolJUVPRg=='
    }
  };

  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(minimalPayload);
    
    const options = {
      hostname: 'care-tracker.vercel.app',
      port: 443,
      path: '/api/upload',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      }
    };

    console.log('🚀 Sending minimal upload request...');
    console.log('📊 Payload size:', Buffer.byteLength(postData), 'bytes');
    
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        console.log('📡 Response Status:', res.statusCode);
        console.log('📋 Response Headers:');
        Object.entries(res.headers).forEach(([key, value]) => {
          console.log(`  ${key}: ${value}`);
        });
        
        console.log('\n📄 Response Body:');
        console.log(data);
        
        console.log('\n🔍 Key Observations:');
        if (res.headers['x-deployment-time']) {
          console.log('✅ Using latest deployment (has cache-busting headers)');
        } else {
          console.log('❌ Using older deployment (missing cache-busting headers)');
        }
        
        if (data.includes('401 Unauthorized')) {
          console.log('❌ Still getting 401 error - environment variable issue persists');
        } else if (data.includes('success')) {
          console.log('✅ Request successful - environment variable working');
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
  try {
    await testMinimalUpload();
    console.log('\n💡 Next step: Check Vercel function logs for the comprehensive debugging output');
    console.log('   Look for "Upload API Environment Variable Debug" entries');
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

main().catch(console.error);