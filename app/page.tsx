import { redirect } from 'next/navigation';

// The site is locked — the home route immediately sends visitors to the login page.
// Authenticated users will be redirected from /login → /dashboard by the middleware.
export default function HomePage() {
  redirect('/login');
}
