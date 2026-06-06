'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import SupportContextSidebar from '@/components/messenger/SupportContextSidebar';

/**
 * Customer Support v2 - thin client wrapper.
 *
 * The layout file is a server component, so we can't call useSearchParams()
 * there. This mount reads ?conversation= and only renders the sidebar when
 * a conversation id is in the URL. The sidebar itself self-gates on admin
 * role + is_support so non-admins and non-support threads silently render
 * nothing.
 */

function Inner() {
  const params = useSearchParams();
  const id = params?.get('conversation') || params?.get('conv') || null;
  if (!id) return null;
  return <SupportContextSidebar conversationId={id} />;
}

export default function SupportContextMount() {
  return (
    <Suspense fallback={null}>
      <Inner />
    </Suspense>
  );
}
