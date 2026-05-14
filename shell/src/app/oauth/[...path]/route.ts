import { NextRequest } from 'next/server';
import { proxyToGateway } from '@/lib/gateway-proxy';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest, { params }: { params: { path: string[] } }) {
  return proxyToGateway(req, '/oauth/' + params.path.join('/'));
}

export async function POST(req: NextRequest, { params }: { params: { path: string[] } }) {
  return proxyToGateway(req, '/oauth/' + params.path.join('/'), { hasBody: true });
}
