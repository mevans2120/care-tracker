import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  return NextResponse.json({ message: 'Test API route working!' }, { status: 200 });
}

export async function POST(request: NextRequest) {
  return NextResponse.json({ message: 'Test POST route working!' }, { status: 200 });
}