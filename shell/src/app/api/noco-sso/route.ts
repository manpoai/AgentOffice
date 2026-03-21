import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const NC_URL = 'http://localhost:8080';
const NC_EMAIL = 'admin@asuite.local';
const NC_PASSWORD = 'Asuite2026!';

export async function GET() {
  try {
    // Step 1: Sign in to get JWT token
    const signinRes = await fetch(`${NC_URL}/api/v1/auth/user/signin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: NC_EMAIL, password: NC_PASSWORD }),
      cache: 'no-store',
    });

    if (!signinRes.ok) {
      return NextResponse.json({ error: 'nocodb signin failed' }, { status: 502 });
    }

    const data = await signinRes.json();
    const token = data.token;

    if (!token) {
      return NextResponse.json({ error: 'nocodb token missing' }, { status: 502 });
    }

    // Step 2: Fetch NocoDB dashboard HTML server-side
    const dashRes = await fetch(`${NC_URL}/dashboard/`, { cache: 'no-store' });
    if (!dashRes.ok) {
      return NextResponse.json({ error: 'nocodb dashboard fetch failed' }, { status: 502 });
    }
    let html = await dashRes.text();

    // Step 3: Inject auth bootstrap script before </head>
    // This runs BEFORE the Vue entry module, ensuring localStorage has the token
    // when NocoDB's signedIn computed property checks it on init.
    // This avoids the localStorage-then-redirect approach which fails in Safari iframe
    // because Safari may block/partition localStorage differently across navigations.
    const authScript = `<script>
(function(){
  try {
    var s = JSON.parse(localStorage.getItem('nocodb-gui-v2') || '{}');
    s.token = ${JSON.stringify(token)};
    localStorage.setItem('nocodb-gui-v2', JSON.stringify(s));
  } catch(e) {}
  document.cookie = "xc-auth=${token}; path=/; max-age=${10 * 24 * 60 * 60}; SameSite=None; Secure";
})();
</script>`;
    html = html.replace('</head>', `${authScript}</head>`);

    // Step 4: Fix relative asset paths — NocoDB HTML uses "./" relative to /dashboard/
    // but we serve from /sso-inject, so "./" would resolve to "/".
    // Rewrite to absolute paths under /dashboard/.
    html = html.replace(/"\.\//g, '"/dashboard/');
    html = html.replace(/'\.\//g, "'/dashboard/");

    // Also fix the __NUXT__ config cdnURL from "." to "/dashboard"
    // so dynamic imports resolve correctly
    html = html.replace('cdnURL:"."', 'cdnURL:"/dashboard"');

    const maxAge = 10 * 24 * 60 * 60;
    const expires = new Date(Date.now() + maxAge * 1000).toUTCString();

    const resp = new NextResponse(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    });

    // Set xc-auth cookie server-side for API calls
    resp.headers.append(
      'Set-Cookie',
      `xc-auth=${token}; Path=/; Expires=${expires}; Max-Age=${maxAge}; SameSite=None; Secure`
    );

    // Proxy NocoDB's refresh_token cookie
    const setCookies = signinRes.headers.getSetCookie?.() ?? [];
    for (const cookie of setCookies) {
      const cleaned = cookie.replace(/;\s*SameSite=\w+/gi, '').replace(/;\s*Secure/gi, '');
      resp.headers.append('Set-Cookie', `${cleaned}; SameSite=None; Secure`);
    }

    return resp;
  } catch (err: any) {
    return NextResponse.json({ error: 'nocodb sso failed', detail: err.message }, { status: 502 });
  }
}
