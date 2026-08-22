import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Enable Microphone And Camera | Pep Nation Lab',
  robots: { index: false, follow: true },
};

export default function MessengerCallPermissionsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
