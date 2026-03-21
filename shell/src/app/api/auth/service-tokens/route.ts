import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../../lib/auth';

export const dynamic = 'force-dynamic';

// Credentials for each service — same account across all services
const MM_URL = 'http://localhost:8065';
const NC_URL = 'http://localhost:8080';
const NC_EMAIL = 'admin@asuite.local';
const NC_PASSWORD = 'Asuite2026!';
const MM_EMAIL = 'admin@asuite.local';
const MM_PASSWORD = 'Asuite2026!';

async function getMattermostToken() {
  const res = await fetch(`${MM_URL}/api/v4/users/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ login_id: MM_EMAIL, password: MM_PASSWORD }),
  });
  if (!res.ok) return null;
  const token = res.headers.get('Token');
  const user = await res.json();
  return { token, userId: user.id };
}

async function getNocobToken() {
  const res = await fetch(`${NC_URL}/api/v1/auth/user/signin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: NC_EMAIL, password: NC_PASSWORD }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  return { token: data.token };
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const [mm, noco] = await Promise.all([getMattermostToken(), getNocobToken()]);

  return NextResponse.json({
    mm: mm || null,
    noco: noco || null,
  });
}
