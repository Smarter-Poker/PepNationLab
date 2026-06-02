import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

// Compatibility redirect: the agent sidebar historically linked "Sales
// Performance" to /dashboard/agent/sales, but the page lives at
// /dashboard/agent/sales-v2. Without this route that link 404s. Redirect
// keeps both paths working so no nav link can dead-end.
export default function AgentSalesRedirect() {
  redirect('/dashboard/agent/sales-v2');
}
