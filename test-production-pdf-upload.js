const fs = require('fs');
const path = require('path');

// Test the production PDF upload API endpoint
async function testProductionPdfUpload() {
  console.log('🧪 Testing Production PDF Upload API...');
  
  // Use one of the sample PDFs
  const pdfPath = path.join(__dirname, 'sample-data', 'FILE_5300.pdf');
  
  if (!fs.existsSync(pdfPath)) {
    console.error('❌ Sample PDF not found:', pdfPath);
    return;
  }
  
  // Read and encode PDF
  const pdfBuffer = fs.readFileSync(pdfPath);
  const base64Content = pdfBuffer.toString('base64');
  
  console.log(`📄 PDF loaded: ${pdfPath}`);
  console.log(`📊 PDF size: ${pdfBuffer.length} bytes`);
  console.log(`🔢 Base64 length: ${base64Content.length} characters`);
  
  // Create upload package matching frontend format
  const uploadPackage = {
    uploadMetadata: {
      uploadId: 'test_' + Date.now(),
      fileName: 'FILE_5300.pdf',
      fileSize: pdfBuffer.length,
      fileType: 'application/pdf',
      timestamp: new Date().toISOString()
    },
    fileData: {
      base64Content: base64Content
    },
    userProfile: {
      name: 'Test User',
      procedureType: 'Heart Catheterization',
      procedureDate: '2025-06-24',
      procedureTime: '17:00'
    }
  };
  
  console.log('🚀 Sending request to production API...');
  
  try {
    const response = await fetch('https://care-tracker-v0.vercel.app/api/upload', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(uploadPackage)
    });
    
    console.log(`📡 Response status: ${response.status} ${response.statusText}`);
    console.log('📋 Response headers:', Object.fromEntries(response.headers.entries()));
    
    const responseText = await response.text();
    console.log('📄 Response body length:', responseText.length);
    
    if (response.ok) {
      console.log('✅ SUCCESS! PDF upload worked');
      try {
        const jsonResponse = JSON.parse(responseText);
        console.log('📊 Tasks extracted:', jsonResponse.tasks?.length || 0);
        console.log('💊 Medications found:', jsonResponse.medications?.length || 0);
        console.log('🚫 Restrictions found:', jsonResponse.restrictions?.length || 0);
        console.log('🎯 Confidence:', jsonResponse.confidence);
      } catch (e) {
        console.log('📄 Raw response:', responseText.substring(0, 500) + '...');
      }
    } else {
      console.log('❌ FAILED! Error response:');
      console.log(responseText);
      
      // Check if it's the 401 error we're debugging
      if (response.status === 500 && responseText.includes('401 Unauthorized')) {
        console.log('🔍 This is the 401 Unauthorized error we\'re debugging!');
        console.log('🔧 Check Vercel function logs for detailed debug information');
      }
    }
    
  } catch (error) {
    console.error('💥 Network error:', error.message);
  }
}

// Run the test
testProductionPdfUpload().catch(console.error);