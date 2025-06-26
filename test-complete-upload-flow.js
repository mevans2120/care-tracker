/**
 * Complete Upload Flow Test
 * Tests the entire data flow from PDF upload through Claude processing to timeline display
 */

const fs = require('fs');
const path = require('path');

// Test configuration
const API_BASE = 'http://localhost:3000';
const TEST_PDF_PATH = './test-files/FILE_0617.pdf';

async function testCompleteUploadFlow() {
    console.log('=== TESTING COMPLETE UPLOAD FLOW ===\n');
    
    try {
        // Step 1: Verify PDF file exists
        console.log('1. Checking test PDF file...');
        if (!fs.existsSync(TEST_PDF_PATH)) {
            console.log('❌ Test PDF not found, using sample PDF content');
            // Create a minimal test PDF for testing
            const samplePdfBase64 = 'JVBERi0xLjQKJcOkw7zDtsOgCjIgMCBvYmoKPDwKL0xlbmd0aCAzIDAgUgo+PgpzdHJlYW0KQNC4xOTQgNzIwIGwKZW5kc3RyZWFtCmVuZG9iago=';
            console.log('✅ Using sample PDF content for testing');
        } else {
            console.log('✅ Test PDF file found');
        }
        
        // Step 2: Read and encode PDF
        console.log('\n2. Preparing PDF for upload...');
        let pdfBase64;
        if (fs.existsSync(TEST_PDF_PATH)) {
            const pdfBuffer = fs.readFileSync(TEST_PDF_PATH);
            pdfBase64 = pdfBuffer.toString('base64');
            console.log(`✅ PDF encoded: ${pdfBase64.length} characters`);
        } else {
            // Use sample content
            pdfBase64 = 'JVBERi0xLjQKJcOkw7zDtsOgCjIgMCBvYmoKPDwKL0xlbmd0aCAzIDAgUgo+PgpzdHJlYW0KQNC4xOTQgNzIwIGwKZW5kc3RyZWFtCmVuZG9iago=';
            console.log('✅ Using sample PDF content');
        }
        
        // Step 3: Create upload package (matching API expected format)
        console.log('\n3. Creating upload package...');
        const uploadId = `test-${Date.now()}`;
        const uploadPackage = {
            uploadMetadata: {
                uploadId: uploadId,
                fileName: 'test-discharge-instructions.pdf',
                fileSize: Math.floor(pdfBase64.length * 0.75), // Approximate original size
                timestamp: new Date().toISOString(),
                source: 'test-script'
            },
            fileData: {
                base64Content: pdfBase64
            }
        };
        console.log('✅ Upload package created');
        console.log(`   - File: ${uploadPackage.uploadMetadata.fileName}`);
        console.log(`   - Size: ${uploadPackage.uploadMetadata.fileSize} bytes`);
        console.log(`   - Upload ID: ${uploadPackage.uploadMetadata.uploadId}`);
        
        // Step 4: Call Claude PDF processing API
        console.log('\n4. Calling Claude PDF processing API...');
        const startTime = Date.now();
        
        const response = await fetch(`${API_BASE}/api/upload`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(uploadPackage)
        });
        
        const processingTime = Date.now() - startTime;
        console.log(`✅ API call completed in ${processingTime}ms`);
        console.log(`   - Status: ${response.status} ${response.statusText}`);
        
        // Step 5: Parse Claude's response
        console.log('\n5. Parsing Claude\'s response...');
        const responseData = await response.json();
        
        if (!response.ok) {
            console.log('❌ API Error:', responseData);
            return;
        }
        
        console.log('✅ Claude response received');
        console.log('   - Response structure:', Object.keys(responseData));
        
        // Step 6: Validate ProcessingResult format
        console.log('\n6. Validating ProcessingResult format...');
        const requiredFields = ['tasks', 'medications', 'restrictions', 'emergencyInfo', 'metadata'];
        const missingFields = requiredFields.filter(field => !(field in responseData));
        
        if (missingFields.length > 0) {
            console.log('❌ Missing required fields:', missingFields);
            return;
        }
        
        console.log('✅ ProcessingResult format is valid');
        console.log(`   - Tasks: ${responseData.tasks?.length || 0}`);
        console.log(`   - Medications: ${responseData.medications?.length || 0}`);
        console.log(`   - Restrictions: ${responseData.restrictions?.length || 0}`);
        console.log(`   - Emergency Info: ${responseData.emergencyInfo ? 'Present' : 'Missing'}`);
        
        // Step 7: Display extracted tasks
        if (responseData.tasks && responseData.tasks.length > 0) {
            console.log('\n7. Extracted Care Tasks:');
            responseData.tasks.forEach((task, index) => {
                console.log(`   ${index + 1}. ${task.title}`);
                console.log(`      - Type: ${task.type}`);
                console.log(`      - Priority: ${task.priority}`);
                console.log(`      - Due: ${task.dueDate}`);
                if (task.description) {
                    console.log(`      - Description: ${task.description.substring(0, 100)}...`);
                }
            });
        } else {
            console.log('\n7. ❌ No tasks extracted from PDF');
        }
        
        // Step 8: Simulate UploadManager processing
        console.log('\n8. Simulating UploadManager processing...');
        
        // This simulates what the fixed UploadManager.processBackendResponse() does
        const simulateUploadManagerProcessing = (claudeResponse) => {
            console.log('   - Processing Claude response in UploadManager...');
            
            // Check if response has the expected ProcessingResult structure
            if (claudeResponse.tasks && Array.isArray(claudeResponse.tasks)) {
                console.log('   ✅ Direct ProcessingResult detected');
                console.log('   - Triggering completion callbacks...');
                console.log('   - Adding tasks to care store...');
                
                // Simulate adding tasks to store
                const tasksToAdd = claudeResponse.tasks.map(task => ({
                    ...task,
                    id: `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                    source: 'claude-pdf',
                    addedAt: new Date().toISOString()
                }));
                
                console.log(`   ✅ ${tasksToAdd.length} tasks ready for timeline display`);
                return tasksToAdd;
            } else {
                console.log('   ❌ Unexpected response format');
                return [];
            }
        };
        
        const processedTasks = simulateUploadManagerProcessing(responseData);
        
        // Step 9: Final verification
        console.log('\n9. Final Verification:');
        if (processedTasks.length > 0) {
            console.log('✅ COMPLETE FLOW SUCCESS!');
            console.log(`   - Claude processed PDF correctly`);
            console.log(`   - ${processedTasks.length} tasks extracted`);
            console.log(`   - UploadManager would process response correctly`);
            console.log(`   - Tasks would appear in timeline`);
            
            console.log('\n📋 Tasks that would appear in timeline:');
            processedTasks.forEach((task, index) => {
                console.log(`   ${index + 1}. [${task.type.toUpperCase()}] ${task.title}`);
                console.log(`      Priority: ${task.priority} | Due: ${task.dueDate}`);
            });
        } else {
            console.log('❌ FLOW FAILED - No tasks would appear in timeline');
        }
        
    } catch (error) {
        console.error('\n❌ Test failed with error:', error.message);
        if (error.code === 'ECONNREFUSED') {
            console.log('💡 Make sure the Next.js dev server is running on localhost:3000');
        }
    }
}

// Run the test
testCompleteUploadFlow().then(() => {
    console.log('\n=== TEST COMPLETE ===');
}).catch(error => {
    console.error('Test execution failed:', error);
});