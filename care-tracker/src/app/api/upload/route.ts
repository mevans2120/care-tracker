import { NextRequest, NextResponse } from 'next/server';

// Generate a simple UUID
// Force deployment to pick up updated environment variable
function generateId(): string {
  return 'task_' + Math.random().toString(36).substr(2, 9);
}

// Build prompt for Claude API with PDF processing - using exact TypeScript interfaces
function buildPromptWithPdf(base64Content: string, procTime: string = "2025-06-24T08:00:00Z"): string {
  return `Read the provided PDF file and extract medical discharge instructions. Return ONLY a valid JSON object that matches this exact TypeScript interface:

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
  type: "medication" | "appointment" | "exercise" | "wound_care" | "diet" | "activity_restriction" | "monitoring" | "education" | "other";
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

Extract all care instructions, restrictions, and medications from the PDF. The procedure time is: ${procTime}

Return ONLY the JSON object, no other text or explanation.`;
}

// Call Claude API with PDF
async function callClaudeWithPdf(base64Content: string, procTime: string): Promise<any> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  
  // Comprehensive environment variable debugging
  console.log('=== Upload API Environment Variable Debug ===');
  console.log('API Key present:', !!apiKey);
  console.log('API Key type:', typeof apiKey);
  console.log('API Key length:', apiKey?.length || 0);
  console.log('API Key starts with sk-ant:', apiKey?.startsWith('sk-ant-') || false);
  console.log('API Key first 20 chars:', apiKey?.substring(0, 20) || 'undefined');
  console.log('API Key last 10 chars:', apiKey?.substring(apiKey.length - 10) || 'undefined');
  console.log('All environment variables starting with ANTHROPIC:',
    Object.keys(process.env).filter(key => key.startsWith('ANTHROPIC')));
  console.log('Deployment timestamp:', new Date().toISOString());
  
  if (!apiKey) {
    throw new Error('Missing Anthropic API Key');
  }
  
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
    
    // Step 3: Use Claude to read PDF and extract tasks directly
    const procTime = new Date().toISOString();
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