'use client';

import { useEffect } from 'react';

/**
 * OAuthErrorRedirect
 *
 * When a Supabase OAuth flow fails (expired state, denied consent, provider
 * error), GoTrue redirects the browser to the Site URL with the error in the
 * URL hash fragment, e.g.:
 *   https://pepnationlab.com/#error=invalid_request&error_code=validation_failed
 *     &error_description=OAuth+state+has+expired
 *
 * Because the error lives in the fragment, the server never sees it and the
 * user just lands on the home page with no explanation. This component runs
 * globally, detects that fragment, and forwards the user to /login with a
 * visible error message so OAuth failures are never silent.
 */
export default function OAuthErrorRedirect() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const hash = window.location.hash;
    if (!hash || !hash.includes('error')) return;

    const params = new URLSearchParams(hash.replace(/^#/, ''));
    const error = params.get('error');
    if (!error) return;

    // Already on the login page: just clear the fragment so the page's own
    // ?error handling (or a retry) starts clean.
    if (window.location.pathname === '/login') {
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
      return;
    }

    window.location.replace('/login?error=oauth_failed');
  }, []);

  return null;
}
