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
  filled += check(!!p.email?.trim() && !p.email.includes('@internal.auth') && !p.email.includes('@pepnationlab.com'), 'email', 'Real Email Address', 'Add Now', 'nav:/account#email');
  filled += check(!!p.phone?.trim(), 'phone', 'Phone Number', 'Add Now', 'nav:/account#phone');
  filled += check(!!p.timezone?.trim(), 'timezone', 'Timezone', 'Select Now', 'nav:/account#timezone');
  filled += check(!!p.avatar_url, 'avatar', 'Profile Picture', 'Upload Now', 'nav:/account#avatar');

  if (ap) {
    requiredCount += 4; // slug, warehouse, payment, active
    filled += check(!!ap.slug && !/^agent(?:-|$)/i.test(ap.slug), 'username', 'Custom Username', 'Edit Now', 'nav:/dashboard/agent');
    
    const warehouse = ap.warehouse_address;
    filled += check(!!(warehouse && warehouse.street1 && warehouse.city && warehouse.state && warehouse.zip), 'warehouse', 'Warehouse Address', 'Go to Agent Settings', 'nav:/dashboard/agent');
    
    const handles = ap.payment_handles;
    filled += check(!!(handles && Object.keys(handles).some((k: string) => handles[k])), 'payment', 'Payment Methods', 'Go to Agent Settings', 'nav:/dashboard/agent');
    
    filled += check(!!ap.is_active, 'active', 'Agent Status', 'Go to Agent Settings', 'nav:/dashboard/agent');
  }

  return {
    percent: Math.round((filled / requiredCount) * 100),
    missingTasks
  };
}
