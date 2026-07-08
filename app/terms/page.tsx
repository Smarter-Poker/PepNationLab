import type { Metadata } from 'next';
import PageShell from '@/components/PageShell';
import LegalDocument from '@/components/LegalDocument';

export const metadata: Metadata = {
  title: 'Terms Of Service | Pep Nation Lab',
  description:
    'The Terms of Service governing use of the Pep Nation Lab research peptide distribution platform. Read before creating an account or purchasing research compounds.',
  robots: { index: true, follow: true },
  alternates: { canonical: 'https://pepnationlab.com/terms' },
  openGraph: {
    title: 'Terms Of Service | Pep Nation Lab',
    description: 'Terms governing use of the Pep Nation Lab research peptide distribution platform.',
    url: 'https://pepnationlab.com/terms',
    type: 'website',
    images: [{ url: '/og-card.png', width: 1200, height: 630, alt: 'Pep Nation Lab Terms of Service' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Terms Of Service | Pep Nation Lab',
    description: 'Terms governing use of the Pep Nation Lab research peptide distribution platform.',
    images: ['/og-card.png'],
  },
};

export default function TermsPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify({
          '@context': 'https://schema.org',
          '@graph': [
            {
              '@type': 'WebPage',
              '@id': 'https://pepnationlab.com/terms#webpage',
              url: 'https://pepnationlab.com/terms',
              name: 'Terms Of Service | Pep Nation Lab',
              isPartOf: { '@id': 'https://pepnationlab.com/#website' },
              publisher: { '@id': 'https://pepnationlab.com/#organization' },
            },
            {
              '@type': 'BreadcrumbList',
              itemListElement: [
                { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://pepnationlab.com' },
                { '@type': 'ListItem', position: 2, name: 'Terms Of Service', item: 'https://pepnationlab.com/terms' },
              ],
            },
          ],
        }) }}
      />
      <PageShell>
      <LegalDocument
        title="Terms Of Service"
        lastUpdated="May 21, 2026"
        intro={[
          'These Terms of Service ("Terms") form a binding agreement between you and Pep Nation Lab LLC ("Pep Nation Lab", "we", "us") governing your access to and use of PepNationLab.com and all related services (the "Platform").',
          'By creating an account or using the Platform, you agree to these Terms. If you do not agree, you must not use the Platform.',
        ]}
        sections={[
          {
            heading: 'Acceptance Of Terms',
            body: [
              'By accessing the Platform you confirm that you have read and agree to these Terms, the Research-Only Disclaimer, the Privacy Policy, and the Compliance Policy, each of which is incorporated by reference.',
            ],
          },
          {
            heading: 'Eligibility And Account Registration',
            body: [
              'You must be at least 21 years of age and a qualified researcher or institutional purchaser to register. You agree to provide accurate registration information and to keep it current.',
              'You are responsible for maintaining the confidentiality of your account credentials and for all activity that occurs under your account.',
            ],
          },
          {
            heading: 'Research-Only Use',
            body: [
              'All products are offered strictly for in vitro laboratory research use. You agree not to use, resell, or transfer any product for human or animal use, and you accept the Research-Only Disclaimer in full.',
            ],
          },
          {
            heading: 'Orders And Order Acceptance',
            body: [
              'Submitting an order constitutes an offer to purchase. An order is not accepted until payment is received and confirmed and the order status is advanced by Pep Nation Lab or the responsible agent.',
              'We may decline, cancel, or limit any order at our discretion, including orders that appear to violate these Terms or applicable law.',
            ],
          },
          {
            heading: 'Pricing And Payment',
            body: [
              'Prices are derived from a base cost and a configurable tier multiplier. Prices may change at any time without notice. The price displayed at checkout applies to that order.',
              'The Platform does not process credit cards. All payments are made off-platform using Zelle, Venmo, Cash App, or Apple Pay. Agents operate on either a weekly-settled credit line or a prepaid balance.',
            ],
          },
          {
            heading: 'Shipping And Fulfillment',
            body: [
              'Orders may be fulfilled by shipment or, where available, by agent pickup. Shipping fees are calculated by package weight. Delivery timeframes are estimates and are not guaranteed.',
              'Title and risk of loss pass to you upon delivery to the carrier.',
            ],
          },
          {
            heading: 'Agent Program',
            body: [
              'Qualified researchers may be approved as agents and granted a branded storefront. Agents are independent operators, are responsible for their own conduct and communications, and must comply with these Terms and the Compliance Policy. Agents are not employees or partners of Pep Nation Lab.',
            ],
          },
          {
            heading: 'Prohibited Conduct',
            body: [
              'You agree not to: misuse the Platform; attempt to purchase prohibited items; provide false information; use products for human or animal use; resell products in violation of law; or interfere with the security or operation of the Platform.',
            ],
          },
          {
            heading: 'Intellectual Property',
            body: [
              'The Platform, including its content, branding, and software, is owned by Pep Nation Lab and protected by applicable intellectual property laws. You are granted a limited, revocable license to use the Platform for its intended purpose only.',
            ],
          },
          {
            heading: 'Disclaimer Of Warranties',
            body: [
              'The Platform and all products are provided "as is" and "as available" without warranties of any kind, express or implied, including merchantability, fitness for a particular purpose, and non-infringement, to the fullest extent permitted by law.',
            ],
          },
          {
            heading: 'Limitation Of Liability',
            body: [
              'To the fullest extent permitted by law, Pep Nation Lab and its agents will not be liable for any indirect, incidental, special, consequential, or punitive damages, or for any loss arising from your use or misuse of any product. Our total aggregate liability for any claim will not exceed the amount you paid for the order giving rise to the claim.',
            ],
          },
          {
            heading: 'Indemnification',
            body: [
              'You agree to indemnify and hold harmless Pep Nation Lab LLC and its officers, employees, and agents from any claims, damages, and expenses arising out of your use of the Platform, your purchases, or your breach of these Terms.',
            ],
          },
          {
            heading: 'Account Suspension And Termination',
            body: [
              'We may suspend or terminate your account at any time for violation of these Terms, suspected unlawful activity, or to protect the Platform. You may stop using the Platform at any time.',
            ],
          },
          {
            heading: 'Governing Law And Dispute Resolution',
            body: [
              'These Terms are governed by the laws of the state in which Pep Nation Lab LLC is organized, without regard to conflict-of-law principles. Any dispute will be resolved in the courts located in that jurisdiction unless otherwise required by law.',
            ],
          },
          {
            heading: 'Changes To These Terms',
            body: [
              'We may update these Terms from time to time. Material changes will be reflected by the "Last Updated" date above. Continued use of the Platform after changes take effect constitutes acceptance of the revised Terms.',
            ],
          },
          {
            heading: 'Contact',
            body: [
              'Questions about these Terms may be directed to support@pepnationlab.com.',
            ],
          },
        ]}
      />
    </PageShell>
    </>
  );
}
