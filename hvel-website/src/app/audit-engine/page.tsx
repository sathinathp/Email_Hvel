import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import Link from 'next/link';

export default function AuditEngine() {
  return (
    <main style={{ minHeight:'100vh', background:'#fff' }}>
      <Navbar />
      <section style={{ padding:'80px 24px 48px', background:'linear-gradient(180deg,#F8FAFC 0%,#fff 100%)', borderBottom:'1px solid #F1F5F9' }}>
        <div style={{ maxWidth:800, margin:'0 auto' }}>
          <Link href="/docs?tab=introduction" style={{ fontSize:13, color:'#2563EB', fontWeight:600, textDecoration:'none', display:'inline-flex', alignItems:'center', gap:6, marginBottom:24 }}>
            ← Back to Docs
          </Link>
          <div style={{ display:'inline-flex', alignItems:'center', gap:8, background:'#FAF5FF', border:'1px solid #E9D5FF', borderRadius:9999, padding:'4px 14px', fontSize:12, fontWeight:700, color:'#9333EA', marginBottom:20 }}>
            🔍 Cryptographic Audit Trail
          </div>
          <h1 style={{ fontSize:'clamp(32px,5vw,52px)', fontWeight:900, color:'#0F172A', letterSpacing:'-0.04em', lineHeight:1.1, marginBottom:16 }}>
            Audit Engine
          </h1>
          <p style={{ fontSize:17, color:'#64748B', lineHeight:1.7, maxWidth:640 }}>
            Every Attest verification creates an immutable, cryptographically signed audit
            record. Recipients can verify any email&apos;s authenticity at any time — without ever
            exposing email content.
          </p>
        </div>
      </section>

      <section style={{ padding:'64px 24px', maxWidth:800, margin:'0 auto' }}>
        <div style={{ display:'flex', flexDirection:'column', gap:48 }}>

          <div>
            <h2 style={{ fontSize:24, fontWeight:800, color:'#0F172A', marginBottom:12 }}>What Gets Logged</h2>
            <p style={{ color:'#64748B', lineHeight:1.75, marginBottom:20 }}>
              Each verification event writes exactly one record to our database.
              The record contains only these four fields — nothing more:
            </p>
            <div style={{ background:'#0F172A', borderRadius:14, padding:28, fontFamily:'monospace', fontSize:13 }}>
              <p style={{ color:'#60A5FA', marginBottom:12 }}>// Audit record schema</p>
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {[
                  ['content_hash', 'string', 'SHA-256 of the send-action event. Cannot be reversed.'],
                  ['verified_at',  'timestamp', 'UTC timestamp of the verification.'],
                  ['sender_name',  'string', 'Your registered full name (not email address).'],
                  ['result',       'enum', '"pass" or "fail". No biometric data stored.'],
                ].map(([field, type, note]) => (
                  <div key={field} style={{ display:'grid', gridTemplateColumns:'160px 90px 1fr', gap:12, alignItems:'start' }}>
                    <span style={{ color:'#86EFAC' }}>{field}</span>
                    <span style={{ color:'#FCA5A5' }}>{type}</span>
                    <span style={{ color:'#64748B', fontSize:12 }}>// {note}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div>
            <h2 style={{ fontSize:24, fontWeight:800, color:'#0F172A', marginBottom:12 }}>How Verification Works for Recipients</h2>
            <p style={{ color:'#64748B', lineHeight:1.75, marginBottom:16 }}>
              When you send a verified email, a SHA-256 hash is embedded in the email header as
              <code style={{ background:'#F1F5F9', padding:'2px 6px', borderRadius:4, fontSize:13, margin:'0 4px' }}>X-Attest-Hash</code>.
              Recipients can copy this hash and paste it into the{' '}
              <Link href="/verify" style={{ color:'#2563EB', fontWeight:600 }}>Verify page</Link> to
              confirm the email was sent by a verified human.
            </p>
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {[
                ['Sender clicks Send','Extension intercepts and requests verification.'],
                ['Verification passes','SHA-256 hash is generated and logged to the audit database.'],
                ['Hash injected','The hash is added to the outgoing email header automatically.'],
                ['Recipient verifies','Recipient pastes the hash on the Verify page and sees sender name + timestamp.'],
              ].map(([step, desc]) => (
                <div key={step} style={{ display:'flex', gap:14, padding:'14px 18px', background:'#F8FAFC', borderRadius:10, border:'1px solid #E2E8F0' }}>
                  <span style={{ color:'#9333EA', fontWeight:700, fontSize:13, flexShrink:0, marginTop:1 }}>→</span>
                  <div>
                    <span style={{ fontWeight:700, color:'#0F172A', fontSize:14 }}>{step}: </span>
                    <span style={{ fontSize:14, color:'#64748B' }}>{desc}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h2 style={{ fontSize:24, fontWeight:800, color:'#0F172A', marginBottom:12 }}>Data Retention &amp; Deletion</h2>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))', gap:16 }}>
              {[
                { icon:'📅', title:'Retention Period', desc:'Audit records are retained for 2 years by default, then automatically purged.' },
                { icon:'🗑️', title:'Right to Deletion', desc:'Request deletion of all your records at any time from your account dashboard.' },
                { icon:'🔐', title:'Encryption at Rest', desc:'All records are encrypted with AES-256. Database access is restricted to verified engineers.' },
                { icon:'📤', title:'Data Export', desc:'Export your full audit log as CSV or JSON from the dashboard at any time.' },
              ].map((item) => (
                <div key={item.title} style={{ padding:20, background:'#F8FAFC', border:'1px solid #E2E8F0', borderRadius:14 }}>
                  <div style={{ fontSize:22, marginBottom:10 }}>{item.icon}</div>
                  <p style={{ fontWeight:700, color:'#0F172A', fontSize:14, marginBottom:6 }}>{item.title}</p>
                  <p style={{ fontSize:13, color:'#64748B', margin:0, lineHeight:1.6 }}>{item.desc}</p>
                </div>
              ))}
            </div>
          </div>

          <div style={{ textAlign:'center', padding:'32px 24px', background:'#F8FAFC', borderRadius:16, border:'1px solid #E2E8F0' }}>
            <p style={{ fontWeight:700, color:'#0F172A', fontSize:16, marginBottom:8 }}>Try the Audit Engine</p>
            <p style={{ color:'#64748B', fontSize:14, marginBottom:20 }}>Paste any Attest hash to verify a sender&apos;s identity.</p>
            <Link href="/verify" style={{ display:'inline-flex', alignItems:'center', gap:8, background:'#9333EA', color:'white', padding:'12px 28px', borderRadius:10, fontWeight:700, fontSize:14, textDecoration:'none' }}>
              Open Verify Page →
            </Link>
          </div>
        </div>
      </section>
      <Footer />
    </main>
  );
}
