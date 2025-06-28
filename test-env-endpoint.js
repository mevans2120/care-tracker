const https = require('https');

console.log('🧪 Testing Environment Variable Endpoint...');

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
  console.log(`📡 Response status: ${res.statusCode} ${res.statusMessage}`);
  console.log('📋 Response headers:', res.headers);
  
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    console.log('📄 Response body:', data);
    
    if (res.statusCode === 200) {
      try {
        const parsed = JSON.parse(data);
        console.log('✅ Environment Variable Check:');
        console.log('- Has API Key:', parsed.hasApiKey);
        console.log('- Key Length:', parsed.keyLength);
        console.log('- Key Prefix:', parsed.keyPrefix);
        console.log('- Key Suffix:', parsed.keySuffix);
        console.log('- Starts with sk-ant:', parsed.startsWithSkAnt);
      } catch (e) {
        console.log('❌ Failed to parse JSON response');
      }
    } else {
      console.log('❌ Request failed');
    }
  });
});

req.on('error', (e) => {
  console.error('❌ Request error:', e.message);
});

req.end();