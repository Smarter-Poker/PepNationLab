import type { Metadata } from 'next';
import PageShell from '@/components/PageShell';
import LegalDocument from '@/components/LegalDocument';

export const metadata: Metadata = {
  title: 'Research-Only Disclaimer | Pep Nation Lab',
  description:
    'The mandatory research-only disclaimer governing the purchase and use of all products distributed through PepNationLab.com. All compounds for in vitro research use only.',
  robots: { index: true, follow: true },
  alternates: { canonical: 'https://pepnationlab.com/disclaimer' },
  openGraph: {
    title: 'Research-Only Disclaimer | Pep Nation Lab',
    description: 'Research-only disclaimer governing all products on PepNationLab.com. For in vitro research use only.',
    url: 'https://pepnationlab.com/disclaimer',
    type: 'website',
    images: [{ url: '/og-card.png', width: 1200, height: 630, alt: 'Pep Nation Lab Research Disclaimer' }],
  },
};

export default function DisclaimerPage() {
  return (
    <PageShell>
      <LegalDocument
        title="Research-Only Disclaimer"
        lastUpdated="May 21, 2026"
        intro={[
          'This Research-Only Disclaimer governs the purchase and use of all products and services offered through PepNationLab.com (the "Platform"), operated by Pep Nation Lab LLC ("Pep Nation Lab", "we", "us").',
          'By accessing the Platform, creating an account, or purchasing any product, you acknowledge that you have read, understood, and agree to be legally bound by every provision below. If you do not agree, you must not use the Platform or purchase any product.',
        ]}
        sections={[
          {
            heading: 'Research Use Only',
            body: [
              'All products sold through the Platform are intended strictly for in vitro (outside the body) laboratory research and analytical science purposes only.',
              'The products are NOT intended for, and must NOT be used for, human or animal consumption, ingestion, injection, inhalation, or any clinical, therapeutic, diagnostic, cosmetic, or household use.',
            ],
          },
          {
            heading: 'Not FDA Approved',
            body: [
              'None of the products offered on the Platform have been evaluated or approved by the U.S. Food and Drug Administration or any comparable regulatory authority for use in humans or animals.',
              'The products are not drugs, dietary supplements, food, cosmetics, or medical devices, and no claim is made that they are safe or effective for any such use.',
            ],
          },
          {
            heading: 'Qualified Purchaser Requirement',
            body: [
              'You represent and warrant that you are at least 21 years of age and that you are a qualified scientist, researcher, or institutional purchaser with the training, facilities, equipment, and legal authority required to safely handle research-grade chemical compounds.',
            ],
          },
          {
            heading: 'No Human Or Animal Use',
            body: [
              'You agree that you will not use any product purchased through the Platform for any human or veterinary purpose, and that you will not sell, transfer, or provide any product to any person for consumption, ingestion, or injection.',
            ],
          },
          {
            heading: 'Prohibited Items',
            body: [
              'Pep Nation Lab Strictly Prohibits The Sale Of Needles, Syringes, Or Any Medical Injection Delivery Devices By Our Company Or Our Agents. We Only Provide Research-Grade Peptides And Authorized Laboratory Diluents Exclusively For In Vitro Testing.',
            ],
          },
          {
            heading: 'Assumption Of Risk And Indemnification',
            body: [
              'You assume full and sole responsibility for the safe receipt, handling, storage, use, and disposal of all products purchased through the Platform.',
              'You agree to indemnify, defend, and hold harmless Pep Nation Lab LLC, its officers, employees, and agents from and against any and all claims, damages, liabilities, costs, and expenses arising out of or related to your purchase or use of any product.',
            ],
          },
          {
            heading: 'Legal Compliance',
            body: [
              'You are solely responsible for ensuring that your purchase, possession, and use of any product complies with all applicable local, state, federal, and international laws and regulations. Pep Nation Lab makes no representation that any product is lawful in your jurisdiction.',
            ],
          },
          {
            heading: 'No Medical Or Scientific Advice',
            body: [
              'Content provided on the Platform is for general informational purposes only and does not constitute medical, scientific, legal, or professional advice. You should rely solely on your own qualified judgment and applicable safety data.',
            ],
          },
          {
            heading: 'Acknowledgment And Logging',
            body: [
              'Acceptance of this disclaimer is required at site entry, at registration, when adding products to a cart, and at checkout. Each acceptance may be recorded together with a timestamp, IP address, and browser information for compliance and audit purposes.',
            ],
          },
        ]}
      />
    </PageShell>
  );
}
