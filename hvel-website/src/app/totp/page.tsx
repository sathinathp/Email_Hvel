import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import Link from 'next/link';

export default function TOTPPage() {
  return (
    <main style={{ minHeight:'100vh', background:'#fff' }}>
      <Navbar />
      <section style={{ padding:'80px 24px 48px', background:'linear-gradient(180deg,#F8FAFC 0%,#fff 100%)', borderBottom:'1px solid #F1F5F9' }}>
        <div style={{ maxWidth:800, margin:'0 auto' }}>
          <Link href="/docs?tab=installation" style={{ fontSize:13, color:'#2563EB', fontWeight:600, textDecoration:'none', display:'inline-flex', alignItems:'center', gap:6, marginBottom:24 }}>
            ← Back to Docs
          </Link>
          <div style={{ display:'inline-flex', alignItems:'center', gap:8, background:'#F0FDF4', border:'1px solid #BBF7D0', borderRadius:9999, padding:'4px 14px', fontSize:12, fontWeight:700, color:'#16A34A', marginBottom:20 }}>
            🔢 TOTP Verification
          </div>
          <h1 style={{ fontSize:'clamp(32px,5vw,52px)', fontWeight:900, color:'#0F172A', letterSpacing:'-0.04em', lineHeight:1.1, marginBottom:16 }}>
            TOTP — Time-Based One-Time Password
          </h1>
          <p style={{ fontSize:17, color:'#64748B', lineHeight:1.7, maxWidth:640 }}>
            TOTP is the fallback verification method in Attest. It generates a fresh 6-digit
            code every 30 seconds using a secret stored only on your device — compatible with
            Google Authenticator, Authy, and any RFC 6238 app.
          </p>
        </div>
      </section>

      <section style={{ padding:'64px 24px', maxWidth:800, margin:'0 auto' }}>
        <div style={{ display:'flex', flexDirection:'column', gap:48 }}>

          <div>
            <h2 style={{ fontSize:24, fontWeight:800, color:'#0F172A', marginBottom:12 }}>How TOTP Works</h2>
            <p style={{ color:'#64748B', lineHeight:1.75, marginBottom:16 }}>
              During registration, Attest generates a shared secret and displays it as a QR code.
              You scan it once with your authenticator app. From that point, both your app and our
              server independently compute the same 6-digit code every 30 seconds using HMAC-SHA1
              and the current Unix timestamp.
            </p>
            <p style={{ color:'#64748B', lineHeight:1.75 }}>
              When you send an email, you enter the current code from your app. Our server verifies
              it matches the expected value (with a ±1 window for clock drift). The code is
              single-use — it cannot be replayed.
            </p>
          </div>

          <div>
            <h2 style={{ fontSize:24, fontWeight:800, color:'#0F172A', marginBottom:16 }}>Setup in 3 Steps</h2>
            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              {[
                ['1','Register on the portal','Create your Attest account with your full name. A QR code is generated for your TOTP secret.'],
                ['2','Scan with authenticator','Open Google Authenticator, Authy, or any TOTP app and scan the QR code. A 6-digit rotating code appears.'],
                ['3','Verify on first send','Click Send in Gmail. Enter the 6-digit code when prompted. Done — you are verified.'],
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

          <div>
            <h2 style={{ fontSize:24, fontWeight:800, color:'#0F172A', marginBottom:16 }}>Compatible Apps</h2>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))', gap:12 }}>
              {[
                { name:'Google Authenticator', platform:'iOS & Android', free:true },
                { name:'Authy', platform:'iOS, Android, Desktop', free:true },
                { name:'Microsoft Authenticator', platform:'iOS & Android', free:true },
                { name:'1Password', platform:'All platforms', free:false },
                { name:'Bitwarden', platform:'All platforms', free:true },
                { name:'Any RFC 6238 app', platform:'Universal standard', free:true },
              ].map((app) => (
                <div key={app.name} style={{ padding:'14px 16px', background:'#F8FAFC', border:'1px solid #E2E8F0', borderRadius:12 }}>
                  <p style={{ fontWeight:700, color:'#0F172A', fontSize:13, marginBottom:2 }}>{app.name}</p>
                  <p style={{ fontSize:12, color:'#94A3B8', marginBottom:6 }}>{app.platform}</p>
                  <span style={{ fontSize:11, fontWeight:700, color: app.free ? '#16A34A' : '#64748B', background: app.free ? 'rgba(22,163,74,0.08)' : '#F1F5F9', padding:'2px 8px', borderRadius:9999 }}>
                    {app.free ? 'Free' : 'Paid'}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div style={{ background:'rgba(22,163,74,0.06)', border:'1px solid rgba(22,163,74,0.15)', borderRadius:16, padding:24 }}>
            <p style={{ fontWeight:800, color:'#15803D', fontSize:14, marginBottom:6 }}>🔒 Privacy Note</p>
            <p style={{ fontSize:14, color:'#64748B', margin:0, lineHeight:1.6 }}>
              Your TOTP secret is stored only on your device. Attest stores only the
              verification result (pass/fail) and timestamp — never the secret itself, never your
              Gmail address, and never any email content.
            </p>
          </div>
        </div>
      </section>
      <Footer />
    </main>
  );
}
