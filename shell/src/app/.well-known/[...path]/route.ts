import { NextRequest } from 'next/server';
import { proxyToGateway } from '@/lib/gateway-proxy';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest, { params }: { params: { path: string[] } }) {
  return proxyToGateway(req, '/.well-known/' + params.path.join('/'));
}
