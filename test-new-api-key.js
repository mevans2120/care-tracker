const fs = require('fs');
const path = require('path');

// Test the new API key directly
async function testNewApiKey() {
  console.log('🧪 Testing New API Key...');
  
  const newApiKey = process.env.ANTHROPIC_API_KEY || 'your-api-key-here';
  
  // Use a small sample PDF
  const pdfPath = path.join(__dirname, 'sample-data', 'FILE_5300.pdf');
  
  if (!fs.existsSync(pdfPath)) {
    console.error('❌ Sample PDF not found:', pdfPath);
    return;
  }
  
  const pdfBuffer = fs.readFileSync(pdfPath);
  const base64Content = pdfBuffer.toString('base64');
  
  console.log(`📄 Testing with PDF: ${path.basename(pdfPath)}`);
  console.log(`📊 PDF size: ${pdfBuffer.length} bytes`);
  
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': newApiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1000,
        messages: [
          { 
            role: 'user', 
            content: [
              {
                type: 'text',
                text: 'Read this PDF and extract 1-2 medical tasks. Return only JSON format: {"tasks": [{"title": "...", "description": "..."}]}'
              },
              {
                type: 'document',
                source: {
                  type: 'base64',
                  media_type: 'application/pdf',
                  data: base64Content
                }
              }
            ]
          }
        ]
      })
    });
    
    console.log(`📡 Response status: ${response.status} ${response.statusText}`);
    
    if (response.ok) {
      const result = await response.json();
      console.log('✅ SUCCESS! New API key works perfectly');
      console.log('📄 Claude response length:', result.content[0].text.length);
      console.log('🎯 Sample response:', result.content[0].text.substring(0, 200) + '...');
      return true;
    } else {
      const errorText = await response.text();
      console.log('❌ FAILED! Error response:');
      console.log('Status:', response.status);
      console.log('Error:', errorText);
      return false;
    }
    
  } catch (error) {
    console.error('💥 Network error:', error.message);
    return false;
  }
}

// Run the test
testNewApiKey().then(success => {
  if (success) {
    console.log('\n🚀 API key is valid! You can safely update it in Vercel.');
  } else {
    console.log('\n⚠️  API key test failed. Please check the key before updating Vercel.');
  }
}).catch(console.error);