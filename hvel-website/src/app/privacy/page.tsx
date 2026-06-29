import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

export default function PrivacyPolicy() {
  return (
    <main style={{ minHeight:'100vh', background:'#fff' }}>
      <Navbar />
      <section style={{ padding:'80px 24px 48px', background:'linear-gradient(180deg,#F8FAFC 0%,#fff 100%)', borderBottom:'1px solid #F1F5F9' }}>
        <div style={{ maxWidth:800, margin:'0 auto' }}>
          <h1 style={{ fontSize:'clamp(32px,5vw,48px)', fontWeight:900, color:'#0F172A', letterSpacing:'-0.04em', lineHeight:1.1, marginBottom:12 }}>
            Privacy Policy
          </h1>
          <p style={{ fontSize:14, color:'#94A3B8', fontWeight:600 }}>Last updated: June 2026 · Attest Security Ltd.</p>
        </div>
      </section>

      <section style={{ padding:'64px 24px', maxWidth:800, margin:'0 auto' }}>
        <div style={{ display:'flex', flexDirection:'column', gap:40 }}>

          {[
            {
              title:'1. Our Core Privacy Commitment',
              content:`Attest is built on a zero-knowledge architecture. We do not read, store, or transmit your raw email body content, subject lines, or attachments. The extension reads the email body locally in your browser solely to compute a secure cryptographic hash (SHA-256) for verification. The raw text of your emails never leaves your device.`,
            },
            {
              title:'2. What We Collect',
              content:`When you register an account, we collect:\n- Your email address\n- Your registered full name\n\nWhen you verify an email send action, we collect and store:\n- The sender's email address (your Gmail address)\n- The recipient's email address\n- A SHA-256 cryptographic hash of the email body\n- The UTC timestamp of the verification event\n- The verification type and result (e.g. human/pass, fail)\n\nDuring email composition, the extension transiently analyzes mouse movement dynamics (coordinates, timing, and velocity) to verify physical human presence. This interaction telemetry is processed in memory on our API to perform bot detection and is not stored persistently.`,
            },
            {
              title:'3. What We Never Collect',
              content:`We never collect, read, or store: your raw email body text or subject lines, email attachments or file names, browser history or tab URLs outside of Gmail, biometric data (fingerprint, face scan — these are processed locally by your OS), Google OAuth tokens, passwords, or session cookies, or any raw data from emails you receive.`,
            },
            {
              title:'4. How We Use Your Data',
              content:`Your registered name is used to display the verified sender badge to email recipients. Recipient email addresses are used to allow validation of the trust stamp, check for verification relationships, and to route one-time security alerts or nudges if an unverified reply or identity mismatch is detected. Verification hashes and timestamps are stored to provide the public audit trail and trust record page. We do not sell, share, or use your data for advertising, profiling, or any purpose other than providing the Attest verification service.`,
            },
            {
              title:'5. Data Storage & Security',
              content:`All data is stored in an encrypted PostgreSQL database (AES-256-GCM at rest). Data is transmitted over TLS 1.3. Database access is restricted to verified engineers with multi-factor authentication. We conduct regular security audits and penetration tests.`,
            },
            {
              title:'6. Data Retention & Deletion',
              content:`Verification records are retained for 2 years, then automatically purged. You may request immediate deletion of all your records at any time by contacting support@attest.page or using the self-service account deletion feature. Account deletion permanently removes all associated records within 30 days.`,
            },
            {
              title:'7. Your Rights (GDPR / CCPA)',
              content:`You have the right to access, correct, export, or delete your personal data at any time. EU residents have additional rights under GDPR including the right to object to processing and the right to data portability. California residents have rights under CCPA including the right to know what data is collected and the right to opt out of sale (we do not sell data). To exercise any right, contact support@attest.page.`,
            },
            {
              title:'8. Contact',
              content:`Support & Privacy inquiries: support@attest.page\nSecurity disclosures: support@attest.page\nAttest Security Ltd., 2026`,
            },
          ].map((section) => (
            <div key={section.title}>
              <h2 style={{ fontSize:20, fontWeight:800, color:'#0F172A', marginBottom:12 }}>{section.title}</h2>
              <p style={{ color:'#64748B', lineHeight:1.75, whiteSpace:'pre-line' }}>{section.content}</p>
            </div>
          ))}
        </div>
      </section>
      <Footer />
    </main>
  );
}
