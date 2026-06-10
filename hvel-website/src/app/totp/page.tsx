import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import Link from 'next/link';

export default function TOTPPage() {
  return (
    <main style={{ minHeight:'100vh', background:'#fff' }}>
      <Navbar />
      <section style={{ padding:'80px 24px 48px', background:'linear-gradient(180deg,#F8FAFC 0%,#fff 100%)', borderBottom:'1px solid #F1F5F9' }}>
        <div style={{ maxWidth:800, margin:'0 auto' }}>
          <Link href="/docs?tab=quickstart" style={{ fontSize:13, color:'#2563EB', fontWeight:600, textDecoration:'none', display:'inline-flex', alignItems:'center', gap:6, marginBottom:24 }}>
            ← Back to Docs
          </Link>
          <div style={{ display:'inline-flex', alignItems:'center', gap:8, background:'#F0FDF4', border:'1px solid #BBF7D0', borderRadius:9999, padding:'4px 14px', fontSize:12, fontWeight:700, color:'#16A34A', marginBottom:20 }}>
            🛡️ Frictionless Verification
          </div>
          <h1 style={{ fontSize:'clamp(32px,5vw,52px)', fontWeight:900, color:'#0F172A', letterSpacing:'-0.04em', lineHeight:1.1, marginBottom:16 }}>
            No More Manual Codes
          </h1>
          <p style={{ fontSize:17, color:'#64748B', lineHeight:1.7, maxWidth:640 }}>
            Early versions of Attest required users to enter a 6-digit TOTP code every time they sent an email. 
            We realized that was too slow. Today, verification is completely silent and automatic.
          </p>
        </div>
      </section>

      <section style={{ padding:'64px 24px', maxWidth:800, margin:'0 auto' }}>
        <div style={{ display:'flex', flexDirection:'column', gap:48 }}>

          <div>
            <h2 style={{ fontSize:24, fontWeight:800, color:'#0F172A', marginBottom:12 }}>How Silent Verification Works</h2>
            <p style={{ color:'#64748B', lineHeight:1.75, marginBottom:16 }}>
              Instead of forcing you to open an authenticator app and manually type codes, Attest uses 
              <strong> behavioral dynamics </strong>. When you compose an email, the browser extension measures subtle physical interactions 
              such as mouse movement speeds, curves, and click patterns.
            </p>
            <p style={{ color:'#64748B', lineHeight:1.75 }}>
              These human interactions are mathematically unique and impossible for bots, scripts, or AI engines to replicate. 
              The check takes place locally on your computer in milliseconds when you click "Send" and is completely seamless.
            </p>
          </div>

          <div>
            <h2 style={{ fontSize:24, fontWeight:800, color:'#0F172A', marginBottom:16 }}>Why we removed TOTP for daily use</h2>
            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              {[
                ['1','Zero Friction','You write and send emails exactly as you did before. There is no disruption to your workflow.'],
                ['2','Instant Verification','Verification completes in less than 200ms right after you hit Send.'],
                ['3','Identical Security','Since automated bots cannot mimic physical human mouse dynamics, it blocks automated session hijacking just as effectively as a manual code.'],
              ].map(([num, title, desc]) => (
                <div key={num} style={{ display:'flex', gap:16, padding:'18px 20px', background:'#F8FAFC', borderRadius:12, border:'1px solid #E2E8F0' }}>
                  <div style={{ width:36, height:36, background:'#16A34A', color:'white', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:900, fontSize:14, flexShrink:0 }}>{num}</div>
                  <div>
                    <p style={{ fontWeight:700, color:'#0F172A', fontSize:15, marginBottom:4 }}>{title}</p>
                    <p style={{ fontSize:14, color:'#64748B', margin:0, lineHeight:1.6 }}>{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ background:'rgba(22,163,74,0.06)', border:'1px solid rgba(22,163,74,0.15)', borderRadius:16, padding:24 }}>
            <p style={{ fontWeight:800, color:'#15803D', fontSize:14, marginBottom:6 }}>🔒 Privacy & Data</p>
            <p style={{ fontSize:14, color:'#64748B', margin:0, lineHeight:1.6 }}>
              Our behavioral analysis parses movement speeds and vectors locally. We do not track or record your actual coordinates, biometric identifiers, or keystrokes. Only the validation result (human or robotic) is sent to our verification server.
            </p>
          </div>
        </div>
      </section>
      <Footer />
    </main>
  );
}
