#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

async function debugFrontendFlow() {
    try {
        console.log('🔍 Testing Frontend PDF Upload Flow');
        console.log('=====================================');
        
        // Read the sample PDF file
        const pdfPath = path.join(__dirname, 'sample-data', 'FILE_0617.pdf');
        
        if (!fs.existsSync(pdfPath)) {
            console.error('❌ Sample PDF not found:', pdfPath);
            return;
        }

        const pdfBuffer = fs.readFileSync(pdfPath);
        const base64Pdf = pdfBuffer.toString('base64');
        
        // Create the upload package exactly as the frontend does
        const uploadPackage = {
            uploadMetadata: {
                uploadId: crypto.randomUUID(),
                fileName: 'FILE_0617.pdf',
                fileSize: pdfBuffer.length,
                mimeType: 'application/pdf',
                timestamp: new Date().toISOString()
            },
            fileData: {
                base64Content: base64Pdf,
                mimeType: 'application/pdf'
            }
        };

        console.log('📤 Step 1: Uploading PDF (simulating frontend)...');
        console.log(`   Upload ID: ${uploadPackage.uploadMetadata.uploadId}`);
        console.log(`   File: ${uploadPackage.uploadMetadata.fileName}`);
        console.log(`   Size: ${Math.round(uploadPackage.uploadMetadata.fileSize / 1024)} KB`);

        // Upload to API
        const uploadResponse = await fetch('http://localhost:3000/api/upload', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(uploadPackage)
        });

        console.log(`📡 Step 2: API Response - Status ${uploadResponse.status}`);
        
        if (!uploadResponse.ok) {
            const errorText = await uploadResponse.text();
            console.error('❌ Upload failed:', errorText);
            return;
        }

        const uploadResult = await uploadResponse.json();
        console.log('📋 Step 3: Upload Result Structure:');
        console.log('   Keys:', Object.keys(uploadResult));
        console.log('   Success:', uploadResult.success);
        console.log('   Status:', uploadResult.status);
        
        // Check if this is the direct ProcessingResult or wrapped response
        if (uploadResult.tasks) {
            console.log('\n✅ DIRECT PROCESSING RESULT DETECTED');
            console.log('   Tasks:', uploadResult.tasks?.length || 0);
            console.log('   Medications:', uploadResult.medications?.length || 0);
            console.log('   Restrictions:', uploadResult.restrictions?.length || 0);
            console.log('   Confidence:', uploadResult.confidence);
            
            console.log('\n📝 Sample Task:');
            if (uploadResult.tasks?.[0]) {
                const task = uploadResult.tasks[0];
                console.log(`   Title: ${task.title}`);
                console.log(`   Type: ${task.type}`);
                console.log(`   Action: ${task.actionType}`);
                console.log(`   Category: ${task.category}`);
            }
            
            console.log('\n🎯 CONCLUSION: Claude is sending data in the correct format!');
            console.log('   The frontend should be able to process this directly.');
            
        } else if (uploadResult.success && uploadResult.statusUrl) {
            console.log('\n⏳ WRAPPED RESPONSE DETECTED');
            console.log('   Status URL:', uploadResult.statusUrl);
            console.log('   Estimated Time:', uploadResult.estimatedTime);
            
            // This means we need to poll for status
            console.log('\n📊 Step 4: This would trigger status polling in the frontend...');
            console.log('   The UploadManager would call pollStatus() repeatedly');
            console.log('   Until it gets a "completed" status with the result');
        }
        
    } catch (error) {
        console.error('❌ Debug failed:', error.message);
    }
}

// Run the debug
debugFrontendFlow();