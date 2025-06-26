#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

async function testPdfUpload() {
    try {
        // Read the sample PDF file
        const pdfPath = path.join(__dirname, 'sample-data', 'FILE_0617.pdf');
        
        if (!fs.existsSync(pdfPath)) {
            console.error('❌ Sample PDF not found:', pdfPath);
            return;
        }

        console.log('📄 Reading PDF file:', pdfPath);
        const pdfBuffer = fs.readFileSync(pdfPath);
        const base64Pdf = pdfBuffer.toString('base64');
        
        console.log('📊 PDF size:', Math.round(pdfBuffer.length / 1024), 'KB');
        console.log('🔄 Uploading to localhost:3000/api/upload...');

        // Create the upload package as expected by the API
        const uploadPackage = {
            uploadMetadata: {
                uploadId: 'test_' + Date.now(),
                fileName: 'FILE_0617.pdf',
                fileSize: pdfBuffer.length,
                mimeType: 'application/pdf'
            },
            fileData: {
                base64Content: base64Pdf
            }
        };

        const response = await fetch('http://localhost:3000/api/upload', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(uploadPackage)
        });

        console.log('📡 Response status:', response.status);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ Upload failed:', errorText);
            return;
        }

        const result = await response.json();
        
        console.log('\n✅ PDF Processing Results:');
        console.log('==========================================');
        
        // The API returns the ProcessingResult directly, not wrapped in success/data
        console.log('📋 Tasks extracted:', result.tasks?.length || 0);
        if (result.tasks?.length > 0) {
            result.tasks.forEach((task, i) => {
                console.log(`  ${i + 1}. ${task.title} (${task.type})`);
                console.log(`     Description: ${task.description}`);
                console.log(`     Action: ${task.actionType}`);
                console.log(`     Category: ${task.category}`);
            });
        }
        
        console.log('\n💊 Medications:', result.medications?.length || 0);
        if (result.medications?.length > 0) {
            result.medications.forEach((med, i) => {
                console.log(`  ${i + 1}. ${med.name} - ${med.dosage}`);
                console.log(`     Frequency: ${med.frequency}`);
                console.log(`     Duration: ${med.duration}`);
            });
        }
        
        console.log('\n⚠️  Restrictions:', result.restrictions?.length || 0);
        if (result.restrictions?.length > 0) {
            result.restrictions.forEach((restriction, i) => {
                console.log(`  ${i + 1}. ${restriction.type}: ${restriction.description}`);
                console.log(`     Duration: ${restriction.duration}`);
                console.log(`     Severity: ${restriction.severity}`);
            });
        }
        
        console.log('\n🚨 Emergency Info:');
        if (result.emergencyInfo) {
            console.log(`  Warning Signs: ${result.emergencyInfo.warningSignsList?.length || 0} signs`);
            console.log(`  Doctor: ${result.emergencyInfo.doctorContact?.name || 'Not specified'}`);
            console.log(`  Emergency Contact: ${result.emergencyInfo.emergencyContact?.name || 'Not specified'}`);
        }
        
        console.log('\n📊 Processing Stats:');
        console.log(`  Confidence: ${result.confidence || 'N/A'}`);
        console.log(`  Processing Time: ${result.processingTime || 'N/A'}ms`);
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

// Run the test
testPdfUpload();