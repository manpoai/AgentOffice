import { NextRequest, NextResponse } from 'next/server';

const OL_URL = process.env.OUTLINE_URL || 'http://localhost:3000';
const OL_KEY = process.env.OUTLINE_API_KEY || '';

/**
 * Proxy all /api/outline/* requests to Outline /api/*
 * Note: Outline uses POST for most read operations (documents.list, documents.info, etc.)
 * Supports both JSON and multipart/form-data (for file uploads)
 */
export async function GET(req: NextRequest, { params }: { params: { path: string[] } }) {
  return proxy(req, params.path);
}

export async function POST(req: NextRequest, { params }: { params: { path: string[] } }) {
  const contentType = req.headers.get('content-type') || '';
  if (contentType.includes('multipart/form-data')) {
    // Forward multipart as-is (for attachments.create etc.)
    return proxyMultipart(req, params.path);
  }
  return proxy(req, params.path, await req.text());
}

async function proxy(req: NextRequest, pathParts: string[], body?: string) {
  const olPath = '/api/' + pathParts.join('/');
  const url = new URL(olPath, OL_URL);

  req.nextUrl.searchParams.forEach((v, k) => url.searchParams.set(k, v));

  const headers: Record<string, string> = {
    'Authorization': `Bearer ${OL_KEY}`,
    'Content-Type': 'application/json',
  };

  const resp = await fetch(url.toString(), {
    method: req.method,
    headers,
    body: body || undefined,
  });

  const data = await resp.text();
  return new NextResponse(data, {
    status: resp.status,
    headers: { 'Content-Type': resp.headers.get('Content-Type') || 'application/json' },
  });
}

async function proxyMultipart(req: NextRequest, pathParts: string[]) {
  const olPath = '/api/' + pathParts.join('/');
  const url = new URL(olPath, OL_URL);
  req.nextUrl.searchParams.forEach((v, k) => url.searchParams.set(k, v));

  // Get raw body as arrayBuffer and forward with original content-type
  const body = await req.arrayBuffer();
  const contentType = req.headers.get('content-type')!;

  const resp = await fetch(url.toString(), {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OL_KEY}`,
      'Content-Type': contentType,
    },
    body,
  });

  const data = await resp.text();
  return new NextResponse(data, {
    status: resp.status,
    headers: { 'Content-Type': resp.headers.get('Content-Type') || 'application/json' },
  });
}
