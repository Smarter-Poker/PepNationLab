import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Peptide 101 | PepNationLab',
  description: 'The definitive guide to peptide research. Learn the foundations of peptide biology, mechanisms, safety, and protocols.',
};

export default function Peptide101Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
