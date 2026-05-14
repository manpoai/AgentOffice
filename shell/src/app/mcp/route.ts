import { NextRequest } from 'next/server';
import { proxyToGateway } from '@/lib/gateway-proxy';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  return proxyToGateway(req, '/mcp', { streaming: true });
}

export async function POST(req: NextRequest) {
  return proxyToGateway(req, '/mcp', { hasBody: true, streaming: true });
}

export async function DELETE(req: NextRequest) {
  return proxyToGateway(req, '/mcp');
}
