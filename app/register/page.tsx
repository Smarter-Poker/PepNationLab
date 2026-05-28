import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

// Registration is permanently disabled. Middleware already redirects /register
// to /login at the edge, but this stub guarantees the same behaviour even if
// middleware is bypassed (e.g., during a direct file fetch).
export default function RegisterPage() {
  redirect('/login');
}
