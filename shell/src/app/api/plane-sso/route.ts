import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const PLANE_URL = 'http://localhost:8000';
const PLANE_EMAIL = process.env.PLANE_EMAIL ?? 'admin@asuite.local';
const PLANE_PASSWORD = process.env.PLANE_PASSWORD ?? 'Asuite2026!';

export async function GET() {
  // Step 1: get CSRF token
  const csrfRes = await fetch(`${PLANE_URL}/auth/get-csrf-token/`);
  if (!csrfRes.ok) return NextResponse.json({ error: 'plane csrf failed' }, { status: 502 });

  const { csrf_token } = await csrfRes.json();
  const csrfCookieHeader = csrfRes.headers.getSetCookie?.() ?? [];
  const csrfCookie = csrfCookieHeader.find(c => c.startsWith('csrftoken=')) ?? '';
  const csrfCookieValue = csrfCookie.split(';')[0]; // "csrftoken=xxx"

  // Step 2: sign in with form POST
  const loginRes = await fetch(`${PLANE_URL}/auth/sign-in/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'X-CSRFToken': csrf_token,
      'Referer': PLANE_URL,
      'Cookie': csrfCookieValue,
    },
    body: new URLSearchParams({ email: PLANE_EMAIL, password: PLANE_PASSWORD }),
    redirect: 'manual',
  });

  const allCookies = loginRes.headers.getSetCookie?.() ?? [];
  const sessionCookie = allCookies.find(c => c.startsWith('session-id='));

  if (!sessionCookie) {
    return NextResponse.json({ error: 'plane login failed' }, { status: 502 });
  }

  // Step 3: forward session-id + csrftoken cookies and redirect to Plane root
  // Rewrite cookies to add SameSite=None; Secure for cross-site iframe context
  const redirectRes = NextResponse.redirect('https://plane.gridtabs.com/', { status: 302 });
  for (const cookie of allCookies) {
    // Remove existing SameSite and add SameSite=None; Secure
    const cleaned = cookie.replace(/;\s*SameSite=\w+/gi, '').replace(/;\s*Secure/gi, '');
    redirectRes.headers.append('Set-Cookie', `${cleaned}; SameSite=None; Secure`);
  }
  return redirectRes;
}
