'use client';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { useState } from 'react';

const sections = [
  {
    id: 'commitment',
    number: '01',
    title: 'Our Privacy Commitment',
    content: (
      <>
        <p>Attest is built around a <strong>privacy-first, zero-knowledge architecture</strong>.</p>
        <p>The Attest browser extension processes your email body locally within your browser solely to generate a secure SHA-256 cryptographic hash for verification. Your raw email body, subject line, and attachments are <strong>never transmitted to or stored on our servers</strong>.</p>
        <p>Only the minimum information required to verify an email and operate the Attest service is collected.</p>
      </>
    ),
  },
  {
    id: 'collect',
    number: '02',
    title: 'Information We Collect',
    content: (
      <>
        <h3>2.1 Account Information</h3>
        <p>When you create an account, we collect:</p>
        <ul>
          <li>Full name</li>
          <li>Email address</li>
          <li>Account credentials and authentication information</li>
        </ul>
        <h3>2.2 Verification Information</h3>
        <p>When you verify an email send event, we collect:</p>
        <ul>
          <li>Sender email address</li>
          <li>Recipient email address</li>
          <li>SHA-256 hash of the email body</li>
          <li>Verification timestamp (UTC)</li>
          <li>Verification result and verification type</li>
          <li>Internal verification identifiers necessary to maintain verification records</li>
        </ul>
        <h3>2.3 Human Verification Data</h3>
        <p>While composing an email, the browser extension temporarily analyzes mouse movement characteristics, including movement coordinates, timing, and velocity, to distinguish genuine human interaction from automated activity.</p>
        <p>This interaction telemetry is securely transmitted to our verification API, processed only in volatile memory, and <strong>immediately discarded after verification</strong>. It is never stored permanently.</p>
        <h3>2.4 Website & Usage Information</h3>
        <p>When you use our website, we may collect:</p>
        <ul>
          <li>IP address</li>
          <li>Browser type</li>
          <li>Operating system</li>
          <li>Device information</li>
          <li>Pages visited</li>
          <li>Error logs</li>
          <li>Basic usage analytics necessary to improve the security and reliability of our services</li>
        </ul>
        <h3>2.5 Communications</h3>
        <p>If you contact us, we may collect:</p>
        <ul>
          <li>Your name</li>
          <li>Email address</li>
          <li>Messages you send us</li>
          <li>Support correspondence</li>
        </ul>
        <h3>2.6 Payment Information</h3>
        <p>Subscription payments are securely processed by <strong>Stripe</strong>.</p>
        <p>Attest does not collect or store your credit card numbers or full payment details. Payment information is processed directly by Stripe in accordance with its Privacy Policy.</p>
      </>
    ),
  },
  {
    id: 'never-collect',
    number: '03',
    title: 'Information We Never Collect',
    content: (
      <>
        <p>Attest is intentionally designed <strong>not</strong> to collect or store:</p>
        <ul>
          <li>Raw email body content</li>
          <li>Email subject lines</li>
          <li>Email attachments</li>
          <li>Attachment filenames</li>
          <li>Gmail message contents after verification</li>
          <li>Browser history</li>
          <li>Browsing activity outside Gmail</li>
          <li>Passwords</li>
          <li>Session cookies from third-party services</li>
          <li>Google OAuth access tokens beyond what is temporarily required for authentication</li>
          <li>Biometric information such as fingerprints or facial recognition data</li>
        </ul>
        <p>We also do not collect any content from emails you receive.</p>
      </>
    ),
  },
  {
    id: 'use',
    number: '04',
    title: 'How We Use Your Information',
    content: (
      <>
        <p>We use your information solely to provide and improve the Attest service.</p>
        <p>Specifically, we use information to:</p>
        <ul>
          <li>Create and manage your account</li>
          <li>Verify email authenticity</li>
          <li>Generate public verification records</li>
          <li>Display verified sender information</li>
          <li>Detect bots and fraudulent activity</li>
          <li>Send security notifications and verification emails</li>
          <li>Process subscription payments</li>
          <li>Respond to customer support requests</li>
          <li>Maintain platform security</li>
          <li>Comply with applicable legal obligations</li>
        </ul>
        <p><strong>We do not sell, rent, or use your information for advertising or behavioral profiling.</strong></p>
      </>
    ),
  },
  {
    id: 'gdpr',
    number: '05',
    title: 'Legal Basis for Processing (GDPR)',
    content: (
      <>
        <p>Where the GDPR applies, we process personal data under the following legal bases:</p>
        <h3>5.1 Performance of a Contract</h3>
        <ul>
          <li>Providing the Attest verification service</li>
          <li>Creating user accounts</li>
          <li>Maintaining verification records</li>
        </ul>
        <h3>5.2 Legitimate Interests</h3>
        <ul>
          <li>Fraud detection</li>
          <li>Platform security</li>
          <li>Abuse prevention</li>
          <li>Service improvement</li>
          <li>System monitoring</li>
        </ul>
        <h3>5.3 Legal Obligation</h3>
        <ul>
          <li>Compliance with applicable laws</li>
          <li>Responding to lawful requests</li>
        </ul>
        <h3>5.4 Consent</h3>
        <ul>
          <li>Marketing communications (if you choose to receive them)</li>
        </ul>
      </>
    ),
  },
  {
    id: 'sharing',
    number: '06',
    title: 'Information Sharing & Third-Party Services',
    content: (
      <>
        <p>We only share personal information where necessary to provide our services.</p>
        <h3>6.1 Stripe</h3>
        <p>We use Stripe to process subscription payments securely.</p>
        <p>Stripe receives the information necessary to process payments, including billing information and payment details. Stripe processes this information under its own Privacy Policy.</p>
        <h3>6.2 Google SMTP</h3>
        <p>We use Google's SMTP infrastructure through Nodemailer to send transactional emails, including:</p>
        <ul>
          <li>Verification emails</li>
          <li>Account notifications</li>
          <li>Security alerts</li>
          <li>Password reset emails</li>
          <li>Contact form responses</li>
        </ul>
        <p>To deliver these emails, Google processes:</p>
        <ul>
          <li>Sender email address</li>
          <li>Recipient email address</li>
          <li>Sender and recipient display names (where available)</li>
          <li>Email subject</li>
          <li>Email content required to deliver the message</li>
        </ul>
        <p>These emails are transmitted through Google's secure mail infrastructure.</p>
        <h3>6.3 Legal Requirements</h3>
        <p>We may disclose information when required by law, legal process, or governmental request.</p>
        <h3>6.4 Transfers</h3>
        <p>If Attest is involved in a merger, acquisition, or sale of assets, user information may be transferred as part of that transaction.</p>
        <p><strong>We never sell personal information to advertisers or data brokers.</strong></p>
      </>
    ),
  },
  {
    id: 'security',
    number: '07',
    title: 'Data Security',
    content: (
      <>
        <p>We implement industry-standard security measures to protect your information, including:</p>
        <ul>
          <li>TLS 1.3 encryption during transmission</li>
          <li>AES-256 encryption for stored data</li>
          <li>Encrypted databases</li>
          <li>Multi-factor authentication for administrative access</li>
          <li>Access controls based on least privilege</li>
          <li>Continuous monitoring</li>
          <li>Regular security assessments</li>
        </ul>
        <p>While we employ strong safeguards, no system can guarantee absolute security.</p>
      </>
    ),
  },
  {
    id: 'retention',
    number: '08',
    title: 'Data Retention',
    content: (
      <>
        <p>Unless a longer retention period is required by law:</p>
        <ul>
          <li>Verification records are retained for 2 years</li>
          <li>Support communications are retained for up to 2 years</li>
          <li>Security logs are retained only as long as necessary for security and operational purposes</li>
          <li>Payment records are retained as required by financial and tax regulations</li>
        </ul>
        <p>If you delete your account, associated personal information will be <strong>permanently deleted within 30 days</strong>, except where retention is legally required.</p>
      </>
    ),
  },
  {
    id: 'transfers',
    number: '09',
    title: 'International Data Transfers',
    content: (
      <>
        <p>Your information may be processed in countries outside your country of residence.</p>
        <p>Where required, we implement appropriate safeguards, including Standard Contractual Clauses or equivalent legal mechanisms, to protect personal data transferred internationally.</p>
      </>
    ),
  },
  {
    id: 'cookies',
    number: '10',
    title: 'Cookies & Similar Technologies',
    content: (
      <>
        <p>Our website uses essential cookies required for authentication, security, and maintaining user sessions.</p>
        <p>We may also use limited analytics cookies to understand website performance and improve user experience.</p>
        <p>You can control cookies through your browser settings, although disabling essential cookies may affect website functionality.</p>
      </>
    ),
  },
  {
    id: 'rights',
    number: '11',
    title: 'Your Privacy Rights',
    content: (
      <>
        <p>Depending on your jurisdiction, you may have the right to:</p>
        <ul>
          <li>Access your personal data</li>
          <li>Correct inaccurate information</li>
          <li>Delete your personal data</li>
          <li>Restrict processing</li>
          <li>Object to processing</li>
          <li>Receive a portable copy of your data</li>
          <li>Withdraw consent where processing relies on consent</li>
        </ul>
        <p>California residents may also have rights under the California Consumer Privacy Act (CCPA).</p>
        <p>If you are located in the European Economic Area or the United Kingdom, you also have the right to lodge a complaint with your local data protection authority.</p>
        <p>To exercise any privacy right, contact us at <a href="mailto:support@attest.page">support@attest.page</a>.</p>
      </>
    ),
  },
  {
    id: 'changes',
    number: '12',
    title: 'Changes to this Privacy Policy',
    content: (
      <>
        <p>We may update this Privacy Policy from time to time to reflect changes in our services, technology, or legal obligations.</p>
        <p>When material changes are made, we will update the "Last Updated" date and, where appropriate, notify users through the website or by email.</p>
      </>
    ),
  },
  {
    id: 'contact',
    number: '13',
    title: 'Contact Us',
    content: (
      <>
        <p>For privacy questions or requests, please contact:</p>
        <p><a href="mailto:support@attest.page">support@attest.page</a></p>
        <p>If you have questions about this Privacy Policy or how we process your information, we are happy to assist.</p>
      </>
    ),
  },
];

export default function PrivacyPolicy() {
  return (
    <main style={{ minHeight: '100vh', background: '#fff' }}>
      <Navbar />
      <section style={{ padding: '130px 24px 48px', background: 'linear-gradient(180deg,#F8FAFC 0%,#fff 100%)', borderBottom: '1px solid #F1F5F9' }}>
        <div style={{ maxWidth: 800, margin: '0 auto' }}>
          <h1 style={{ fontSize: 'clamp(32px, 5vw, 48px)', fontWeight: 900, color: '#0F172A', letterSpacing: '-0.04em', lineHeight: 1.1, marginBottom: 12 }}>
            Privacy Policy
          </h1>
          <p style={{ fontSize: 14, color: '#94A3B8', fontWeight: 600 }}>Last Updated: June 2026 · Attest Security Ltd.</p>
        </div>
      </section>

      <section style={{ padding: '64px 24px', maxWidth: 800, margin: '0 auto' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 40 }}>
          {sections.map((s) => (
            <div key={s.id}>
              <h2 style={{ fontSize: 20, fontWeight: 800, color: '#0F172A', marginBottom: 16 }}>
                {s.number}. {s.title}
              </h2>
              <div className="privacy-content">
                {s.content}
              </div>
            </div>
          ))}

          {/* Footer CTA */}
          <div style={{ marginTop: 24, background: '#EFF6FF', border: '1px solid #DBEAFE', borderRadius: 16, padding: 28 }}>
            <p style={{ fontWeight: 800, color: '#1D4ED8', fontSize: 16, marginBottom: 8, margin: 0 }}>
              Questions about your privacy?
            </p>
            <p style={{ fontSize: 14, color: '#475569', marginBottom: 16, lineHeight: 1.6, marginTop: 8 }}>
              We're happy to explain anything in this policy. Reach out to our team and we'll respond promptly.
            </p>
            <a
              href="mailto:support@attest.page"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                background: '#2563EB',
                color: '#fff', fontWeight: 700, fontSize: 14,
                padding: '10px 22px', borderRadius: 10, textDecoration: 'none',
                width: 'fit-content',
                transition: 'background-color 0.2s',
              }}
            >
              ✉️ &nbsp;support@attest.page
            </a>
          </div>
        </div>
      </section>

      <Footer />

      <style>{`
        .privacy-content h3 {
          font-size: 15px;
          font-weight: 700;
          color: #0F172A;
          margin: 24px 0 10px;
        }
        .privacy-content p {
          color: #64748B;
          line-height: 1.75;
          font-size: 14px;
          margin: 0 0 14px;
        }
        .privacy-content ul {
          padding-left: 20px;
          margin: 0 0 14px;
        }
        .privacy-content li {
          color: #64748B;
          line-height: 1.75;
          font-size: 14px;
          margin-bottom: 4px;
        }
        .privacy-content strong {
          color: #0F172A;
          font-weight: 700;
        }
        .privacy-content em {
          color: #4F46E5;
          font-style: italic;
        }
        .privacy-content a {
          color: #2563EB;
          text-decoration: underline;
          text-underline-offset: 3px;
        }
        .privacy-content a:hover {
          color: #1D4ED8;
        }
      `}</style>
    </main>
  );
}


