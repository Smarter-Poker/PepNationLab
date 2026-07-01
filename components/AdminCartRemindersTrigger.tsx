'use client';

import { useState } from 'react';
import { toast } from 'sonner';

export default function AdminCartRemindersTrigger() {
  const [loading, setLoading] = useState(false);

  const triggerReminders = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const res = await fetch('/api/admin/cart-reminders', { method: 'POST' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(json.error || 'Failed To Send Reminders');
        return;
      }
      const count = json.sentCount ?? 0;
      if (count === 0) {
        toast.success('No Abandoned Carts Found Needing Reminders');
      } else {
        toast.success(`Sent ${count} Cart Reminder${count === 1 ? '' : 's'} Successfully`);
      }
    } catch {
      toast.error('An Unexpected Error Occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={triggerReminders}
      disabled={loading}
      className="btn-primary"
      style={{ opacity: loading ? 0.65 : 1, cursor: loading ? 'not-allowed' : 'pointer' }}
    >
      {loading ? 'Sending Reminders...' : 'Send Cart Reminders'}
    </button>
  );
}
