import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    
    console.log('=== Environment Variable Debug ===');
    console.log('API Key present:', !!apiKey);
    console.log('API Key type:', typeof apiKey);
    console.log('API Key length:', apiKey?.length || 0);
    console.log('API Key value (first 20 chars):', apiKey?.substring(0, 20) || 'undefined');
    console.log('API Key value (last 10 chars):', apiKey?.substring(apiKey.length - 10) || 'undefined');
    console.log('All environment variables starting with ANTHROPIC:', 
      Object.keys(process.env).filter(key => key.startsWith('ANTHROPIC')));
    
    return NextResponse.json({
      success: true,
      debug: {
        apiKeyPresent: !!apiKey,
        apiKeyType: typeof apiKey,
        apiKeyLength: apiKey?.length || 0,
        apiKeyFirst20: apiKey?.substring(0, 20) || 'undefined',
        apiKeyLast10: apiKey?.substring(apiKey.length - 10) || 'undefined',
        anthropicEnvVars: Object.keys(process.env).filter(key => key.startsWith('ANTHROPIC'))
      }
    });
  } catch (error) {
    console.error('Environment test error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}