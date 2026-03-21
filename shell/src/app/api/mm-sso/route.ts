import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const MM_URL = 'http://localhost:8065';
const MM_EMAIL = 'admin@asuite.local';
const MM_PASSWORD = 'Asuite2026!';

export async function GET(req: NextRequest) {
  const loginRes = await fetch(`${MM_URL}/api/v4/users/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
    },
    body: JSON.stringify({ login_id: MM_EMAIL, password: MM_PASSWORD }),
  });

  if (!loginRes.ok) {
    return NextResponse.json({ error: 'MM login failed' }, { status: 502 });
  }

  // Get token from response header and user ID from response body
  const token = loginRes.headers.get('Token');
  const user = await loginRes.json();
  const userId = user.id;

  if (!token || !userId) {
    return NextResponse.json({ error: 'MM login: missing token or user id' }, { status: 502 });
  }

  // Build cookies manually — getSetCookie() is unreliable in Next.js fetch
  const maxAge = 15552000; // 180 days, same as MM default
  const expires = new Date(Date.now() + maxAge * 1000).toUTCString();

  const redirectRes = NextResponse.redirect('https://mm.gridtabs.com/', { status: 302 });
  // SameSite=None; Secure required for cross-site iframe context
  redirectRes.headers.append('Set-Cookie', `MMAUTHTOKEN=${token}; Path=/; Expires=${expires}; Max-Age=${maxAge}; HttpOnly; SameSite=None; Secure`);
  redirectRes.headers.append('Set-Cookie', `MMUSERID=${userId}; Path=/; Expires=${expires}; Max-Age=${maxAge}; SameSite=None; Secure`);
  redirectRes.headers.append('Set-Cookie', `MMCSRF=${token}; Path=/; Expires=${expires}; Max-Age=${maxAge}; SameSite=None; Secure`);

  return redirectRes;
}
