'use client';

import { useRouter } from 'next/navigation';
import MessageBell from './MessageBell';

/**
 * Wrapper for the admin layout (which is a server component).
 * Routes to /admin/moderation when "View All" is clicked.
 */
export default function AdminMessageBell() {
  const router = useRouter();
  return <MessageBell onViewAll={() => router.push('/admin/moderation')} dropUp />;
}
