import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  console.log('=== DEBUG UPLOAD API - Environment Variable Test ===');
  
  try {
    // Get the environment variable exactly like the upload endpoint does
    const apiKey = process.env.ANTHROPIC_API_KEY;
    
    // Comprehensive debugging
    console.log('API Key present:', !!apiKey);
    console.log('API Key type:', typeof apiKey);
    console.log('API Key length:', apiKey?.length || 0);
    console.log('API Key starts with sk-ant:', apiKey?.startsWith('sk-ant-') || false);
    console.log('API Key first 20 chars:', apiKey?.substring(0, 20) || 'undefined');
    console.log('API Key last 10 chars:', apiKey?.substring(apiKey.length - 10) || 'undefined');
    console.log('All ANTHROPIC env vars:', Object.keys(process.env).filter(key => key.startsWith('ANTHROPIC')));
    console.log('Deployment timestamp:', new Date().toISOString());
    
    // Test the exact same Claude API call structure
    if (!apiKey) {
      throw new Error('Missing Anthropic API Key');
    }
    
    // Make a minimal Claude API call to test authentication
    const testResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 10,
        messages: [
          { 
            role: 'user', 
            content: 'Hello'
          }
        ]
      })
    });
    
    console.log('Claude API test response status:', testResponse.status);
    console.log('Claude API test response headers:', Object.fromEntries(testResponse.headers.entries()));
    
    if (!testResponse.ok) {
      const errorText = await testResponse.text();
      console.error('Claude API test error:', errorText);
      
      return NextResponse.json({
        success: false,
        error: `Claude API test failed: ${testResponse.status} - ${errorText}`,
        debug: {
          apiKeyPresent: !!apiKey,
          apiKeyLength: apiKey?.length || 0,
          apiKeyFormat: apiKey?.substring(0, 20) + '...' + apiKey?.substring(apiKey.length - 10),
          claudeStatus: testResponse.status,
          claudeError: errorText
        }
      }, { status: 500 });
    }
    
    const result = await testResponse.json();
    console.log('Claude API test successful!');
    
    return NextResponse.json({
      success: true,
      message: 'Environment variable and Claude API access working correctly',
      debug: {
        apiKeyPresent: !!apiKey,
        apiKeyLength: apiKey?.length || 0,
        apiKeyFormat: apiKey?.substring(0, 20) + '...' + apiKey?.substring(apiKey.length - 10),
        claudeStatus: testResponse.status,
        claudeResponse: result.content?.[0]?.text || 'Success'
      }
    });
    
  } catch (error) {
    console.error('Debug upload API error:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      debug: {
        errorType: error instanceof Error ? error.constructor.name : 'Unknown',
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      }
    }, { status: 500 });
  }
}