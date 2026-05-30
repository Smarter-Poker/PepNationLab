import type { Metadata } from 'next';
import PageShell from '@/components/PageShell';
import LegalDocument from '@/components/LegalDocument';

export const metadata: Metadata = {
  title: 'Compliance | Pep Nation Lab',
  description:
    'The compliance framework and research-only distribution policy that govern the Pep Nation Lab platform.',
};

export default function CompliancePage() {
  return (
    <PageShell>
      <LegalDocument
        title="Compliance Policy"
        lastUpdated="May 21, 2026"
        intro={[
          'This Compliance Policy describes the standards Pep Nation Lab LLC ("Pep Nation Lab", "we", "us") applies to the distribution of research compounds through PepNationLab.com (the "Platform").',
          'Compliance is central to how the Platform operates. Every researcher and every agent is expected to uphold the standards set out below.',
        ]}
        sections={[
          {
            heading: 'Our Compliance Commitment',
            body: [
              'Pep Nation Lab operates as a research-only distributor. Our policies are designed to keep research compounds within legitimate research channels and to prevent any use that is unlawful or unsafe.',
            ],
          },
          {
            heading: 'Research-Only Distribution Policy',
            body: [
              'All products are distributed solely for in vitro laboratory research and analytical purposes. Marketing, product descriptions, and storefront content must never describe or imply human or animal use, dosing, or therapeutic benefit.',
            ],
          },
          {
            heading: 'Prohibited Products Policy',
            body: [
              'Pep Nation Lab Strictly Prohibits The Sale Of Needles, Syringes, Or Any Medical Injection Delivery Devices By Our Company Or Our Agents. We Only Provide Research-Grade Peptides And Authorized Laboratory Diluents Exclusively For In Vitro Testing. Products flagged as prohibited are permanently blocked from sale at the database level and cannot be listed by any agent.',
            ],
          },
          {
            heading: 'Purchaser Verification',
            body: [
              'Accounts are intended for qualified researchers and institutional purchasers who are at least 21 years of age. Registration requires acceptance of the research-only acknowledgment, and we may verify researcher credentials before approving or continuing an account.',
            ],
          },
          {
            heading: 'Anti-Diversion Measures',
            body: [
              'We monitor for ordering patterns and conduct that suggest diversion of products outside legitimate research use. We may decline, cancel, hold, or limit orders, and may suspend accounts, where diversion or misuse is suspected.',
            ],
          },
          {
            heading: 'Disclaimer Acknowledgment Records',
            body: [
              'The Platform enforces a four-layer disclaimer: at site entry, at registration, when adding products to a cart, and at checkout. Acknowledgments are logged with a timestamp, IP address, and browser information to maintain a compliance audit trail.',
            ],
          },
          {
            heading: 'Agent Compliance Obligations',
            body: [
              'Agents must operate their storefronts in full compliance with this Policy, the Terms of Service, and applicable law. Agents must not sell prohibited items, must not make non-research claims, and must not misrepresent products. Violations may result in suspension or removal from the agent program.',
            ],
          },
          {
            heading: 'Record Keeping',
            body: [
              'We maintain records of orders, fulfillment, disclaimer acknowledgments, and agent activity for the periods required by applicable legal, tax, and regulatory obligations.',
            ],
          },
          {
            heading: 'Reporting Concerns',
            body: [
              'If you become aware of misuse, prohibited sales, or any compliance concern involving the Platform or an agent, please report it to research@pepnationlab.com so we can investigate.',
            ],
          },
          {
            heading: 'Contact',
            body: [
              'Compliance questions may be directed to research@pepnationlab.com.',
            ],
          },
        ]}
      />
    </PageShell>
  );
}
