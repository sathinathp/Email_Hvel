import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import Link from 'next/link';

export default function Whitepaper() {
  return (
    <main style={{ minHeight:'100vh', background:'#fff' }}>
      <Navbar />
      <section style={{ padding:'80px 24px 48px', background:'linear-gradient(180deg,#F8FAFC 0%,#fff 100%)', borderBottom:'1px solid #F1F5F9' }}>
        <div style={{ maxWidth:800, margin:'0 auto' }}>
          <div style={{ display:'inline-flex', alignItems:'center', gap:8, background:'#EFF6FF', border:'1px solid #DBEAFE', borderRadius:9999, padding:'4px 14px', fontSize:12, fontWeight:700, color:'#2563EB', marginBottom:20 }}>
            📄 Security Whitepaper — v2.1
          </div>
          <h1 style={{ fontSize:'clamp(32px,5vw,52px)', fontWeight:900, color:'#0F172A', letterSpacing:'-0.04em', lineHeight:1.1, marginBottom:16 }}>
            Attest Security Whitepaper
          </h1>
          <p style={{ fontSize:17, color:'#64748B', lineHeight:1.7, maxWidth:640, marginBottom:24 }}>
            A technical overview of the Attest architecture, threat model, cryptographic
            protocols, and privacy guarantees.
          </p>
          <div style={{ display:'flex', gap:12, flexWrap:'wrap' }}>
            <span style={{ fontSize:12, color:'#64748B', fontWeight:600 }}>Version 2.1.0</span>
            <span style={{ color:'#E2E8F0' }}>·</span>
            <span style={{ fontSize:12, color:'#64748B', fontWeight:600 }}>Published May 2026</span>
            <span style={{ color:'#E2E8F0' }}>·</span>
            <span style={{ fontSize:12, color:'#64748B', fontWeight:600 }}>Attest Security Ltd.</span>
          </div>
        </div>
      </section>

      <section style={{ padding:'64px 24px', maxWidth:800, margin:'0 auto' }}>
        <div style={{ display:'flex', flexDirection:'column', gap:48 }}>

          <div>
            <h2 style={{ fontSize:24, fontWeight:800, color:'#0F172A', marginBottom:12 }}>1. Executive Summary</h2>
            <p style={{ color:'#64748B', lineHeight:1.75 }}>
              Business Email Compromise (BEC) caused over $2.9 billion in losses in 2023 (FBI IC3).
              The root cause is not weak passwords — it is the absence of verification that a real
              human sent the email. Attest introduces a mandatory out-of-band verification step
              that proves a real human sent the email, using frictionless behavioral dynamics (mouse movement patterns),
              without ever accessing email content.
            </p>
          </div>

          <div>
            <h2 style={{ fontSize:24, fontWeight:800, color:'#0F172A', marginBottom:12 }}>2. Threat Model</h2>
            <p style={{ color:'#64748B', lineHeight:1.75, marginBottom:16 }}>Attest is designed to defend against:</p>
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {[
                ['Session Hijacking','Attacker steals browser session cookie and sends emails from victim\'s account. Attest blocks this — the attacker cannot mimic the victim\'s physical human interaction dynamics.'],
                ['AI-Generated Phishing','AI writes convincing emails from compromised accounts. Attest ensures every sent email has cryptographic proof of being sent by a real human.'],
                ['Malware-Driven Sending','Malware on the victim\'s machine attempts to send emails silently. The extension intercepts all send actions, including programmatic ones.'],
                ['Insider Threats','An employee sends unauthorized emails. The audit log provides a timestamped, cryptographically signed record of every verified send action.'],
              ].map(([threat, desc]) => (
                <div key={threat} style={{ padding:'16px 20px', background:'#F8FAFC', borderRadius:12, border:'1px solid #E2E8F0' }}>
                  <p style={{ fontWeight:700, color:'#0F172A', fontSize:14, marginBottom:4 }}>{threat}</p>
                  <p style={{ fontSize:13, color:'#64748B', margin:0, lineHeight:1.6 }}>{desc}</p>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h2 style={{ fontSize:24, fontWeight:800, color:'#0F172A', marginBottom:12 }}>3. Cryptographic Protocol</h2>
            <p style={{ color:'#64748B', lineHeight:1.75, marginBottom:16 }}>
              The verification flow uses standard, auditable cryptographic primitives:
            </p>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))', gap:14 }}>
              {[
                { label:'Hash Function', value:'SHA-256 (NIST FIPS 180-4)' },
                { label:'Behavioral Dynamics', value:'Local mouse movement & click vector analysis' },
                { label:'Verification Log', value:'Secure backend verification & Trust Record' },
                { label:'Transport', value:'TLS 1.3' },
                { label:'Storage Encryption', value:'AES-256-GCM' },
                { label:'Key Exchange', value:'ECDH P-256' },
              ].map((item) => (
                <div key={item.label} style={{ padding:'12px 16px', background:'#F8FAFC', border:'1px solid #E2E8F0', borderRadius:10 }}>
                  <p style={{ fontSize:11, fontWeight:700, color:'#94A3B8', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:4 }}>{item.label}</p>
                  <p style={{ fontSize:13, fontWeight:700, color:'#0F172A', margin:0, fontFamily:'monospace' }}>{item.value}</p>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h2 style={{ fontSize:24, fontWeight:800, color:'#0F172A', marginBottom:12 }}>4. Privacy Architecture</h2>
            <p style={{ color:'#64748B', lineHeight:1.75, marginBottom:16 }}>
              Attest is designed with a zero-knowledge architecture. The extension has no
              Gmail API permissions and cannot read email content. The server receives only a
              cryptographic hash — never the email itself. This is enforced at the protocol level,
              not just by policy.
            </p>
            <div style={{ background:'rgba(22,163,74,0.06)', border:'1px solid rgba(22,163,74,0.15)', borderRadius:14, padding:20 }}>
              <p style={{ fontWeight:700, color:'#15803D', fontSize:14, marginBottom:8 }}>Data Minimization Principle</p>
              <p style={{ fontSize:13, color:'#64748B', margin:0, lineHeight:1.6 }}>
                We collect the minimum data required to prove a real human sent the email. The four stored fields
                (hash, timestamp, name, result) are the irreducible minimum for a verifiable audit
                trail. No additional data is collected, inferred, or retained.
              </p>
            </div>
          </div>

          <div style={{ borderTop:'1px solid #E2E8F0', paddingTop:32 }}>
            <p style={{ fontSize:13, color:'#94A3B8', lineHeight:1.6 }}>
              For security disclosures, contact{' '}
              <a href="mailto:support@attest.page" style={{ color:'#2563EB', fontWeight:600 }}>support@attest.page</a>.
              For the full technical specification, see the{' '}
              <Link href="/docs" style={{ color:'#2563EB', fontWeight:600 }}>Documentation</Link>.
            </p>
          </div>
        </div>
      </section>
      <Footer />
    </main>
  );
}
