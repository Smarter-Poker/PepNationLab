import type { Metadata } from 'next';
import PageShell from '@/components/PageShell';
import LegalDocument from '@/components/LegalDocument';

export const metadata: Metadata = {
  title: 'Privacy Policy | Pep Nation Lab',
  description:
    'How Pep Nation Lab collects, uses, stores, and protects information on the research peptide distribution platform.',
};

export default function PrivacyPage() {
  return (
    <PageShell>
      <LegalDocument
        title="Privacy Policy"
        lastUpdated="May 21, 2026"
        intro={[
          'This Privacy Policy explains how Pep Nation Lab LLC ("Pep Nation Lab", "we", "us") collects, uses, discloses, and protects information in connection with PepNationLab.com (the "Platform").',
          'By using the Platform, you consent to the practices described in this Policy.',
        ]}
        sections={[
          {
            heading: 'Information We Collect',
            body: [
              'We collect information you provide directly, including your name, email address, phone number, account password, shipping address, and any referral code used during registration.',
              'We also collect information generated through use of the Platform, including orders, order history, account role and tier, and agent storefront configuration where applicable.',
            ],
          },
          {
            heading: 'How We Use Your Information',
            body: [
              'We use information to create and manage accounts, process and fulfill orders, calculate pricing, operate the agent program, communicate with you, maintain platform security, and comply with legal and regulatory obligations.',
            ],
          },
          {
            heading: 'Disclaimer And Compliance Logging',
            body: [
              'Because the Platform distributes research-only compounds, we record acceptance of the research-only disclaimer. These records may include a timestamp, IP address, browser user-agent string, and the disclaimer version and layer accepted. This logging is performed for regulatory compliance and audit purposes.',
            ],
          },
          {
            heading: 'Sharing With Agents',
            body: [
              'If you register through an agent storefront or use an agent referral code, your account is associated with that agent. The agent may see limited information necessary to service your orders, such as your name, email, order details, and fulfillment status.',
            ],
          },
          {
            heading: 'Payment Information',
            body: [
              'The Platform does not process credit cards and does not collect or store card numbers or bank account credentials. Payments are completed off-platform through Zelle, Venmo, Cash App, or Apple Pay, and are governed by those providers own privacy practices.',
            ],
          },
          {
            heading: 'Cookies And Local Storage',
            body: [
              'We use browser cookies and local storage to keep you signed in, remember your disclaimer acceptance, and maintain your shopping cart. Disabling these technologies may prevent parts of the Platform from functioning.',
            ],
          },
          {
            heading: 'Data Retention',
            body: [
              'We retain account, order, and compliance records for as long as your account is active and for any additional period required to meet legal, tax, accounting, or regulatory obligations.',
            ],
          },
          {
            heading: 'Data Security',
            body: [
              'We use administrative and technical safeguards, including access controls and row-level database security, to protect information. No method of transmission or storage is completely secure, and we cannot guarantee absolute security.',
            ],
          },
          {
            heading: 'Your Choices And Rights',
            body: [
              'You may review and update your account information at any time. Depending on your jurisdiction, you may have rights to access, correct, or request deletion of your personal information. To make a request, contact us using the details below.',
            ],
          },
          {
            heading: 'Children And Minimum Age',
            body: [
              'The Platform is intended only for qualified purchasers who are at least 21 years of age. We do not knowingly collect information from anyone under that age.',
            ],
          },
          {
            heading: 'Third-Party Services',
            body: [
              'We rely on third-party infrastructure providers, including a hosted database and authentication provider, to operate the Platform. These providers process information on our behalf under their own security and privacy commitments.',
            ],
          },
          {
            heading: 'Changes To This Policy',
            body: [
              'We may update this Policy from time to time. Material changes will be reflected by the "Last Updated" date above. Continued use of the Platform after changes take effect constitutes acceptance of the revised Policy.',
            ],
          },
          {
            heading: 'Contact',
            body: [
              'Questions or privacy requests may be directed to research@pepnationlab.com.',
            ],
          },
        ]}
      />
    </PageShell>
  );
}
