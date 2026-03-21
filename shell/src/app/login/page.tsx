'use client';
import { useEffect } from 'react';

export default function LoginPage() {
  useEffect(() => {
    // Fetch CSRF token and POST to sign in with Dex — avoids the redirect loop
    // that happens when using signIn('dex') with a custom pages.signIn
    (async () => {
      const csrfRes = await fetch('/api/auth/csrf');
      const { csrfToken } = await csrfRes.json();
      const form = document.createElement('form');
      form.method = 'POST';
      form.action = '/api/auth/signin/dex';
      const csrf = document.createElement('input');
      csrf.type = 'hidden';
      csrf.name = 'csrfToken';
      csrf.value = csrfToken;
      const cb = document.createElement('input');
      cb.type = 'hidden';
      cb.name = 'callbackUrl';
      cb.value = window.location.origin;
      form.appendChild(csrf);
      form.appendChild(cb);
      document.body.appendChild(form);
      form.submit();
    })();
  }, []);

  return (
    <div style={{
      height: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#0f0f1a',
      color: '#aaa',
      fontSize: 14,
    }}>
      Redirecting to login...
    </div>
  );
}
