import { redirect } from 'next/navigation';

// Legacy path: the flash sale builder lives at /admin/flash-sales (linked in
// the admin sidebar). This duplicate route now redirects instead of rendering
// a second unlinked copy of the same builder.
export default function LegacyFlashSalesPage() {
  redirect('/admin/flash-sales');
}
