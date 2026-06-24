import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

export default function Terms() {
  return (
    <main style={{ minHeight:'100vh', background:'#fff' }}>
      <Navbar />
      <section style={{ padding:'80px 24px 48px', background:'linear-gradient(180deg,#F8FAFC 0%,#fff 100%)', borderBottom:'1px solid #F1F5F9' }}>
        <div style={{ maxWidth:800, margin:'0 auto' }}>
          <h1 style={{ fontSize:'clamp(32px,5vw,48px)', fontWeight:900, color:'#0F172A', letterSpacing:'-0.04em', lineHeight:1.1, marginBottom:12 }}>
            Terms of Service
          </h1>
          <p style={{ fontSize:14, color:'#94A3B8', fontWeight:600 }}>Last updated: May 2026 · Attest Security Ltd.</p>
        </div>
      </section>

      <section style={{ padding:'64px 24px', maxWidth:800, margin:'0 auto' }}>
        <div style={{ display:'flex', flexDirection:'column', gap:40 }}>
          {[
            {
              title:'1. Acceptance of Terms',
              content:'By installing the Attest extension or creating an account, you agree to these Terms of Service. If you do not agree, do not use the service.',
            },
            {
              title:'2. Description of Service',
              content:'Attest provides a browser extension and verification backend that verifies a real human sent the email on Gmail send actions. The service does not read, store, or transmit email content. It logs only cryptographic hashes, timestamps, registered names, and verification results.',
            },
            {
              title:'3. Account Registration',
              content:'You must provide your real full name during registration. This name is used for the verified sender badge shown to email recipients. You are responsible for maintaining the security of your TOTP secret and authenticator device.',
            },
            {
              title:'4. Acceptable Use',
              content:'You may not use Attest to impersonate another person, circumvent security systems, or violate any applicable law. You may not attempt to reverse-engineer, decompile, or tamper with the extension or backend services.',
            },
            {
              title:'5. Privacy',
              content:'Our Privacy Policy governs the collection and use of your data. We do not sell your data. We do not read your emails. See the Privacy Policy for full details.',
            },
            {
              title:'6. Service Availability',
              content:'We aim for 99.9% uptime but do not guarantee uninterrupted service. Scheduled maintenance will be announced in advance. We are not liable for losses caused by service interruptions.',
            },
            {
              title:'7. Limitation of Liability',
              content:'Attest is a security enhancement tool. We do not guarantee that use of the service will prevent all security incidents. Our liability is limited to the amount you paid for the service in the 12 months preceding any claim.',
            },
            {
              title:'8. Termination',
              content:'You may cancel your account at any time. We may suspend or terminate accounts that violate these terms. Upon termination, your data will be deleted within 30 days.',
            },
            {
              title:'9. Changes to Terms',
              content:'We may update these terms with 30 days notice via email. Continued use after the notice period constitutes acceptance of the updated terms.',
            },
            {
              title:'10. Contact',
              content:'Support & Legal inquiries: support@attest.page\nAttest Security Ltd., 2026',
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
