import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// Outline API key for admin@asuite.local — bypasses JWT/jwtSecret which gets
// corrupted by sequelize-encrypted vault re-encryption on every save.
// API keys are validated against a stable DB column, not the encrypted vault.
const OUTLINE_API_KEY = process.env.OUTLINE_API_KEY ?? 'ol_api_62ZC2hwtI3F6GM4j9O38enMMQyzAJezUKDtzW6';

export async function GET() {
  // Return HTML page that sets accessToken cookie to the API key in first-party context,
  // then navigates to Outline home. This avoids third-party cookie issues in iframe contexts.
  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head><body><script>
document.cookie = "accessToken=${OUTLINE_API_KEY}; path=/; max-age=${90 * 24 * 60 * 60}; SameSite=Lax";
location.replace("/home");
</script></body></html>`;

  return new NextResponse(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}
