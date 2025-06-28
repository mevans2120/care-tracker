import { NextRequest, NextResponse } from 'next/server';

// Generate a simple UUID
// Force deployment without vercel.json - auto-detect Next.js - v4
function generateId(): string {
  return 'task_' + Math.random().toString(36).substr(2, 9);
}

// Build prompt for Claude API with PDF processing - using exact TypeScript interfaces
function buildPromptWithPdf(base64Content: string, procTime: string = "2025-06-24T08:00:00Z"): string {
  return `Read the provided PDF file and extract ALL medical discharge instructions and recovery activities. Return ONLY a valid JSON object that matches this exact TypeScript interface:

interface ProcessingResult {
  tasks: CareTask[];
  emergencyInfo: EmergencyInfo;
  medications: Medication[];
  restrictions: Restriction[];
  confidence: number;
  processingTime: number;
}

interface CareTask {
  id: string;
  title: string;
  description: string;
  type: "medication" | "appointment" | "exercise" | "wound_care" | "diet" | "activity_restriction" | "monitoring" | "education" | "physical_therapy" | "mobility" | "bathing" | "dressing" | "pain_management" | "breathing_exercises" | "equipment_usage" | "follow_up" | "symptom_tracking" | "positioning" | "other";
  status: "pending" | "in_progress" | "completed" | "skipped" | "overdue";
  actionType: "do" | "do_not";
  scheduledTime: string; // ISO date string
  estimatedDuration: number; // minutes
  instructions: string[];
  reminders: any[];
  dependencies: string[];
  category: "immediate" | "short_term" | "medium_term" | "long_term";
  metadata: {
    source: string;
    confidence: number;
    originalText?: string;
    pageNumber?: number;
  };
}

interface Medication {
  id: string;
  name: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions: string;
  sideEffects?: string[];
  interactions?: string[];
}

interface EmergencyInfo {
  warningSignsTitle: string;
  warningSignsDescription: string;
  warningSignsList: string[];
  emergencyContact: {
    name: string;
    phone: string;
    relationship: string;
  };
  doctorContact: {
    name: string;
    phone: string;
    specialty: string;
  };
}

interface Restriction {
  id: string;
  type: "activity" | "dietary" | "medication" | "lifestyle";
  description: string;
  duration: string;
  severity: "mild" | "moderate" | "severe";
  consequences?: string;
}

Extract ALL recovery and care activities from this medical discharge PDF. Be comprehensive and thorough. Look for:

**PHYSICAL ACTIVITIES:**
- Physical therapy exercises, stretches, movement restrictions (type: "physical_therapy")
- Mobility instructions: walking, sitting, standing limitations (type: "mobility")
- Positioning requirements: elevation, sleeping positions (type: "positioning")
- General exercise routines and fitness activities (type: "exercise")

**DAILY CARE ACTIVITIES:**
- Bathing/showering instructions and restrictions (type: "bathing")
- Dressing assistance or clothing restrictions (type: "dressing")
- Wound care procedures: cleaning, dressing changes (type: "wound_care")
- Equipment usage: crutches, braces, monitors, assistive devices (type: "equipment_usage")

**HEALTH MONITORING:**
- Symptom tracking: pain levels, swelling, temperature (type: "symptom_tracking")
- Vital sign monitoring requirements (type: "monitoring")
- Warning sign recognition and response (type: "monitoring")
- Pain management techniques and schedules (type: "pain_management")
- Breathing exercises and respiratory care (type: "breathing_exercises")

**SCHEDULED ACTIVITIES:**
- Medical appointments and follow-up visits (type: "appointment" or "follow_up")
- Medication schedules and administration (type: "medication")
- Dietary instructions and restrictions (type: "diet")
- Activity restrictions and limitations (type: "activity_restriction")
- Educational materials to review (type: "education")

**TASK CLASSIFICATION AND TIMELINE GUIDELINES:**
- Use "immediate" category for first 24 hours post-procedure
- Use "short_term" for 1-7 days recovery activities
- Use "medium_term" for 1-4 weeks rehabilitation
- Use "long_term" for ongoing maintenance (1+ months)
- Set actionType to "do" for recommended activities, "do_not" for restrictions
- Estimate realistic duration for each task (5-60 minutes typical)
- Include specific instructions and timing when mentioned in PDF

**CRITICAL: CREATE COMPREHENSIVE TIMELINE SPANNING FULL DURATION:**

The procedure time is: ${procTime}

**FOR DURATION-BASED RESTRICTIONS (activities to avoid for a period), CREATE MULTIPLE DAILY TASKS:**

When you see restrictions lasting multiple days, create separate tasks for EACH DAY of the restriction period:

- "Do not drive for 7 days" → Create 7 separate tasks, one for each day:
  * Day 1: "No Driving - Day 1 of 7" (scheduledTime: procedure time)
  * Day 2: "No Driving - Day 2 of 7" (scheduledTime: procedure time + 1 day)
  * Day 3: "No Driving - Day 3 of 7" (scheduledTime: procedure time + 2 days)
  * ... and so on for all 7 days

- "Do not shower for 48 hours" → Create 2 separate tasks:
  * Day 1: "No Showering - Day 1 of 2" (scheduledTime: procedure time)
  * Day 2: "No Showering - Day 2 of 2" (scheduledTime: procedure time + 1 day)

- "No heavy lifting for 2 weeks" → Create 14 separate daily tasks spanning the full period

**FOR SINGLE-POINT EVENTS, schedule them when they should occur:**
- "Follow up in 2 weeks" → scheduledTime: procedure time + 14 days
- "Start physical therapy in 3 days" → scheduledTime: procedure time + 3 days
- "Remove bandage tomorrow" → scheduledTime: procedure time + 1 day

**EXAMPLES of comprehensive timeline creation:**

RESTRICTION: "Do not take tub baths for 1 week"
CREATE: 7 separate tasks:
- "No Tub Baths - Day 1 of 7" (scheduledTime: procedure time)
- "No Tub Baths - Day 2 of 7" (scheduledTime: procedure time + 1 day)
- "No Tub Baths - Day 3 of 7" (scheduledTime: procedure time + 2 days)
- "No Tub Baths - Day 4 of 7" (scheduledTime: procedure time + 3 days)
- "No Tub Baths - Day 5 of 7" (scheduledTime: procedure time + 4 days)
- "No Tub Baths - Day 6 of 7" (scheduledTime: procedure time + 5 days)
- "No Tub Baths - Day 7 of 7" (scheduledTime: procedure time + 6 days)

RESTRICTION: "Limit activity for 3 days"
CREATE: 3 separate tasks:
- "Limited Activity - Day 1 of 3" (scheduledTime: procedure time)
- "Limited Activity - Day 2 of 3" (scheduledTime: procedure time + 1 day)
- "Limited Activity - Day 3 of 3" (scheduledTime: procedure time + 2 days)

This ensures patients see their restrictions every day they apply, creating a complete recovery timeline.

Extract EVERY activity mentioned, no matter how minor. Be thorough and comprehensive.
Return ONLY the JSON object, no other text or explanation.`;
}

// Environment variable retry logic for Vercel cold starts
async function getApiKeyWithRetry(maxRetries = 3, delay = 1000): Promise<string> {
  console.log('=== API Key Retry Logic Started ===');
  
  for (let i = 0; i < maxRetries; i++) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    
    console.log(`Retry ${i + 1}/${maxRetries}:`);
    console.log('- API Key present:', !!apiKey);
    console.log('- API Key type:', typeof apiKey);
    console.log('- API Key length:', apiKey?.length || 0);
    console.log('- API Key starts with sk-ant:', apiKey?.startsWith('sk-ant-') || false);
    console.log('- API Key first 20 chars:', apiKey?.substring(0, 20) || 'undefined');
    console.log('- API Key last 10 chars:', apiKey?.substring(apiKey.length - 10) || 'undefined');
    
    if (apiKey && apiKey.startsWith('sk-ant-')) {
      console.log('✅ API key successfully retrieved on retry', i + 1);
      return apiKey;
    }
    
    if (i < maxRetries - 1) {
      console.log(`⏳ Waiting ${delay}ms before retry...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  // Final debug info if all retries failed
  console.log('=== Final Debug Info After All Retries Failed ===');
  console.log('All environment variables starting with ANTHROPIC:',
    Object.keys(process.env).filter(key => key.startsWith('ANTHROPIC')));
  console.log('Deployment timestamp:', new Date().toISOString());
  
  throw new Error('API key not available after retries - check Vercel environment variables');
}

// Call Claude API with PDF
async function callClaudeWithPdf(base64Content: string, procTime: string): Promise<any> {
  // Use retry logic instead of direct access
  const apiKey = await getApiKeyWithRetry();
  
  console.log('Calling Claude API with PDF content...');
  
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 8000,
      messages: [
        { 
          role: 'user', 
          content: [
            {
              type: 'text',
              text: buildPromptWithPdf(base64Content, procTime)
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

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Claude API error details:');
    console.error('- Status:', response.status);
    console.error('- Status Text:', response.statusText);
    console.error('- Response Headers:', Object.fromEntries(response.headers.entries()));
    console.error('- Error Body:', errorText);
    throw new Error(`Claude API error: ${response.status} ${response.statusText} - ${errorText}`);
  }

  const result = await response.json();
  console.log('Claude API response received');
  return result;
}

// Extract JSON from Claude response with better error handling
function extractJsonFromClaude(claudeResponseText: string, procTime: string): any {
  let text = claudeResponseText.trim();
  
  console.log('Raw Claude response:', text.substring(0, 200) + '...');
  
  // Remove code blocks if present
  if (text.startsWith('```json')) {
    text = text.replace(/^```json\s*/, '').replace(/\s*```$/, '').trim();
  } else if (text.startsWith('```')) {
    text = text.replace(/^```\s*/, '').replace(/\s*```$/, '').trim();
  }
  
  // Look for JSON object in the response
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    text = jsonMatch[0];
  }
  
  // If still not valid JSON, try to find the first { and last }
  if (!text.startsWith('{')) {
    const startIndex = text.indexOf('{');
    const endIndex = text.lastIndexOf('}');
    if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
      text = text.substring(startIndex, endIndex + 1);
    }
  }
  
  console.log('Extracted JSON text:', text.substring(0, 200) + '...');
  
  try {
    const parsed = JSON.parse(text);
    
    // Validate the structure matches ProcessingResult
    if (!parsed.tasks || !Array.isArray(parsed.tasks)) {
      throw new Error('Invalid response: missing or invalid tasks array');
    }
    
    // Ensure each task has required fields and convert scheduledTime to Date objects
    parsed.tasks = parsed.tasks.map((task: any) => ({
      ...task,
      id: task.id || generateId(),
      scheduledTime: new Date(task.scheduledTime || procTime),
      reminders: task.reminders || [],
      dependencies: task.dependencies || [],
      metadata: {
        source: 'discharge_instructions',
        confidence: task.metadata?.confidence || 0.9,
        originalText: task.metadata?.originalText || task.description,
        pageNumber: task.metadata?.pageNumber || 1,
        ...task.metadata
      }
    }));
    
    // Ensure medications array exists
    if (!parsed.medications) {
      parsed.medications = [];
    }
    
    // Ensure restrictions array exists
    if (!parsed.restrictions) {
      parsed.restrictions = [];
    }
    
    // Ensure emergencyInfo exists with defaults
    if (!parsed.emergencyInfo) {
      parsed.emergencyInfo = {
        warningSignsTitle: 'When to Call 911',
        warningSignsDescription: 'Call emergency services immediately if you experience:',
        warningSignsList: [
          'Severe chest pain or pressure',
          'Difficulty breathing',
          'Excessive bleeding',
          'Signs of infection (fever, chills)'
        ],
        emergencyContact: {
          name: 'Emergency Services',
          phone: '911',
          relationship: 'emergency'
        },
        doctorContact: {
          name: 'Your Doctor',
          phone: 'Contact your healthcare provider',
          specialty: 'General'
        }
      };
    }
    
    // Set confidence and processing time
    parsed.confidence = parsed.confidence || 0.9;
    parsed.processingTime = parsed.processingTime || 1000;
    
    return parsed;
    
  } catch (error) {
    console.error('JSON parse error:', error);
    console.error('Failed to parse text:', text);
    throw new Error(`Failed to parse Claude response as JSON: ${error}`);
  }
}

// Main API handler
export async function POST(request: NextRequest) {
  console.log('=== PDF Upload API Called (Claude PDF Processing) ===');
  
  try {
    const data = await request.json();
    
    // Step 1: Unpack incoming data
    const metadata = data.uploadMetadata;
    const fileData = data.fileData;
    const uploadId = metadata.uploadId;
    
    console.log(`Processing upload ${uploadId} for file ${metadata.fileName}`);
    console.log(`File size: ${metadata.fileSize} bytes`);
    
    // Step 2: Get base64 PDF content
    const base64Content = fileData.base64Content;
    console.log(`Base64 content length: ${base64Content.length} characters`);
    
    // Step 3: Use user's actual procedure time from their profile
    const userProfile = data.userProfile;
    const procTime = userProfile?.dischargeDate || new Date().toISOString();
    console.log(`Using procedure time: ${procTime} (from user profile: ${!!userProfile?.dischargeDate})`);
    const claudeResponse = await callClaudeWithPdf(base64Content, procTime);
    
    // Step 4: Parse Claude response
    const rawText = claudeResponse.content[0].text;
    console.log(`Claude response: ${rawText.length} characters`);
    
    const parsedData = extractJsonFromClaude(rawText, procTime);
    console.log(`Successfully processed PDF with Claude, extracted ${parsedData.tasks?.length || 0} tasks`);
    
    // Step 5: Return structured response matching ProcessingResult interface
    return NextResponse.json(parsedData, {
      status: 200,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        'X-Deployment-Time': new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('PDF processing error:', error);
    
    return NextResponse.json({
      uploadId: 'unknown',
      status: 'failed',
      message: 'Failed to process upload.',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, {
      status: 500,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        'X-Deployment-Time': new Date().toISOString()
      }
    });
  }
}

// Handle OPTIONS for CORS
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}