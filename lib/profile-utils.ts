export const REQUIRED_FIELDS = [
  'first_name',
  'last_name',
  'email',
  'phone',
  'timezone',
  'avatar_url',
];

export function getCompletenessData(p: any, ap?: any) {
  if (!p) return { percent: 0, missingTasks: [] };
  
  const missingTasks: Array<{ id: string; label: string; actionText: string; target: string }> = [];

  const check = (condition: boolean, id: string, label: string, actionText: string, target: string) => {
    if (!condition) missingTasks.push({ id, label, actionText, target });
    return condition ? 1 : 0;
  };

  let requiredCount = REQUIRED_FIELDS.length;
  let filled = 0;

  filled += check(!!p.first_name?.trim(), 'first-name', 'First Name', 'Add Now', 'nav:/account#first-name');
  filled += check(!!p.last_name?.trim(), 'last-name', 'Last Name', 'Add Now', 'nav:/account#last-name');
  // A real email may live in either `email` (Google/OAuth signups) or
  // `contact_email` (storefront/username signups, where `email` is null and the
  // auth record carries a synthetic <username>@internal.auth address). Treat the
  // task as complete when EITHER column holds a genuine, non-synthetic address —
  // otherwise we ask users to re-enter an email we already captured at signup.
  const isRealEmail = (e: unknown): boolean =>
    typeof e === 'string' &&
    e.trim() !== '' &&
    !e.includes('@internal.auth') &&
    !e.includes('@pepnationlab.com');
  const hasRealEmail = isRealEmail(p.email) || isRealEmail(p.contact_email);
  filled += check(hasRealEmail, 'email', 'Email Address', 'Add Now', 'nav:/account#email');
  filled += check(!!p.phone?.trim(), 'phone', 'Phone Number', 'Add Now', 'nav:/account#phone');
  filled += check(!!p.timezone?.trim(), 'timezone', 'Timezone', 'Select Now', 'nav:/account#timezone');
  filled += check(!!p.avatar_url, 'avatar', 'Profile Picture', 'Upload', 'nav:/account#avatar');

  if (ap) {
    requiredCount += 4; // slug, warehouse, payment, active
    filled += check(!!ap.slug && !/^agent(?:-|$)/i.test(ap.slug), 'username', 'Custom Username', 'Edit Now', 'nav:/dashboard/agent');
    
    const warehouse = ap.warehouse_address;
    filled += check(!!(warehouse && warehouse.street1 && warehouse.city && warehouse.state && warehouse.zip), 'warehouse', 'Warehouse Address', 'Add Now', 'inline:warehouse');
    
    const handles = ap.payment_handles;
    filled += check(!!(handles && Object.keys(handles).some((k: string) => handles[k])), 'payment', 'Payment Methods', 'Go to Agent Settings', 'nav:/dashboard/agent');
    
    filled += check(!!ap.is_active, 'active', 'Agent Status', 'Go to Agent Settings', 'nav:/dashboard/agent');
  }

  return {
    percent: Math.round((filled / requiredCount) * 100),
    missingTasks
  };
}

export function getRealEmail(profile?: { email?: string | null, contact_email?: string | null } | null): string | null {
  if (!profile) return null;
  const isRealEmail = (e: unknown): boolean =>
    typeof e === 'string' && e.trim() !== '' && !e.includes('@internal.auth') && !e.includes('@pepnationlab.com');
  
  if (isRealEmail(profile.contact_email)) return profile.contact_email!;
  if (isRealEmail(profile.email)) return profile.email!;
  return null;
}

export function getOrderEmail(order?: any): string | null {
  if (!order) return null;
  const isRealEmail = (e: unknown): boolean =>
    typeof e === 'string' && e.trim() !== '' && !e.includes('@internal.auth') && !e.includes('@pepnationlab.com');

  if (isRealEmail(order.buyer_email)) return order.buyer_email;
  if (isRealEmail(order.shipping_address?.email)) return order.shipping_address.email;
  
  if (order.profiles) {
    const realProfileEmail = getRealEmail(order.profiles);
    if (realProfileEmail) return realProfileEmail;
  }
  
  return null;
}
