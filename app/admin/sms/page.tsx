export const metadata = { title: 'Removed | Pep Nation Lab' };
export default function RemovedPage() {
  return (
    <div style={{ padding: '4rem 2rem', maxWidth: 600, margin: '0 auto', textAlign: 'center' }}>
      <h1 className="animated-gradient-text" style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>SMS Log Has Been Removed</h1>
      <p style={{ color: 'var(--silver)' }}>
        PepNationLab No Longer Uses Twilio. Buyer Notifications Are Delivered Via Web Push And In-App Messages.
      </p>
    </div>
  );
}
