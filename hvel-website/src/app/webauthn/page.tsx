import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import Link from 'next/link';

export default function WebAuthn() {
  return (
    <main style={{ minHeight:'100vh', background:'#fff' }}>
      <Navbar />
      <section style={{ padding:'80px 24px 48px', background:'linear-gradient(180deg,#F8FAFC 0%,#fff 100%)', borderBottom:'1px solid #F1F5F9' }}>
        <div style={{ maxWidth:800, margin:'0 auto' }}>
          <Link href="/docs?tab=introduction" style={{ fontSize:13, color:'#2563EB', fontWeight:600, textDecoration:'none', display:'inline-flex', alignItems:'center', gap:6, marginBottom:24 }}>
            ← Back to Docs
          </Link>
          <div style={{ display:'inline-flex', alignItems:'center', gap:8, background:'#EFF6FF', border:'1px solid #DBEAFE', borderRadius:9999, padding:'4px 14px', fontSize:12, fontWeight:700, color:'#2563EB', marginBottom:20 }}>
            🛡️ FIDO2 / WebAuthn Protocol
          </div>
          <h1 style={{ fontSize:'clamp(32px,5vw,52px)', fontWeight:900, color:'#0F172A', letterSpacing:'-0.04em', lineHeight:1.1, marginBottom:16 }}>
            WebAuthn Biometric Authentication
          </h1>
          <p style={{ fontSize:17, color:'#64748B', lineHeight:1.7, maxWidth:640 }}>
            Attest uses the W3C WebAuthn standard to verify physical human presence using your
            device&apos;s built-in biometric sensor — Touch ID, Face ID, or a hardware security key.
            No passwords. No phishing. No remote bypass.
          </p>
        </div>
      </section>

      <section style={{ padding:'64px 24px', maxWidth:800, margin:'0 auto' }}>
        <div style={{ display:'flex', flexDirection:'column', gap:48 }}>

          <div>
            <h2 style={{ fontSize:24, fontWeight:800, color:'#0F172A', marginBottom:12 }}>What is WebAuthn?</h2>
            <p style={{ color:'#64748B', lineHeight:1.75, marginBottom:16 }}>
              WebAuthn (Web Authentication) is a W3C standard that allows websites to authenticate
              users using public-key cryptography instead of passwords. It is the core of the FIDO2
              specification and is natively supported in Chrome, Firefox, Safari, and Edge.
            </p>
            <p style={{ color:'#64748B', lineHeight:1.75 }}>
              When you register with Attest, your device generates a unique cryptographic key
              pair. The private key never leaves your device. The public key is stored on our server.
              Every verification challenge is signed locally — we never see your biometric data.
            </p>
          </div>

          <div>
            <h2 style={{ fontSize:24, fontWeight:800, color:'#0F172A', marginBottom:16 }}>How Attest Uses WebAuthn</h2>
            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              {[
                ['Registration','You register once. Your device creates a key pair. The public key is stored on our server. Your fingerprint or face scan stays on your device — always.'],
                ['Send Interception','When you click Send in Gmail, the extension pauses the action and requests a WebAuthn assertion from your device.'],
                ['Local Signing','Your device prompts for biometric confirmation (Touch ID / Face ID / PIN). The challenge is signed locally using your private key.'],
                ['Server Verification','Our server verifies the signature using your stored public key. If valid, the send action is released and a SHA-256 hash is logged.'],
              ].map(([title, desc]) => (
                <div key={title} style={{ display:'flex', gap:16, padding:'18px 20px', background:'#F8FAFC', borderRadius:12, border:'1px solid #E2E8F0' }}>
                  <div style={{ width:8, height:8, borderRadius:'50%', background:'#2563EB', flexShrink:0, marginTop:6 }}></div>
                  <div>
                    <p style={{ fontWeight:700, color:'#0F172A', fontSize:15, marginBottom:4 }}>{title}</p>
                    <p style={{ fontSize:14, color:'#64748B', margin:0, lineHeight:1.6 }}>{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h2 style={{ fontSize:24, fontWeight:800, color:'#0F172A', marginBottom:12 }}>Security Guarantees</h2>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))', gap:16 }}>
              {[
                { icon:'🔑', title:'Phishing-Resistant', desc:'Private keys are bound to the origin domain. A fake site cannot steal your credentials.' },
                { icon:'📵', title:'No Remote Bypass', desc:'Biometric verification requires physical device presence. Session hijackers cannot pass this check.' },
                { icon:'🧬', title:'Zero Biometric Transmission', desc:'Your fingerprint or face scan is processed entirely on-device by the OS. We never receive it.' },
                { icon:'🔒', title:'Replay-Proof', desc:'Each challenge is unique and time-bound. Captured responses cannot be reused.' },
              ].map((item) => (
                <div key={item.title} style={{ padding:20, background:'#F8FAFC', border:'1px solid #E2E8F0', borderRadius:14 }}>
                  <div style={{ fontSize:24, marginBottom:10 }}>{item.icon}</div>
                  <p style={{ fontWeight:700, color:'#0F172A', fontSize:14, marginBottom:6 }}>{item.title}</p>
                  <p style={{ fontSize:13, color:'#64748B', margin:0, lineHeight:1.6 }}>{item.desc}</p>
                </div>
              ))}
            </div>
          </div>

          <div style={{ background:'#EFF6FF', border:'1px solid #DBEAFE', borderRadius:16, padding:28 }}>
            <p style={{ fontWeight:800, color:'#1D4ED8', fontSize:15, marginBottom:8 }}>Supported Authenticators</p>
            <div style={{ display:'flex', flexWrap:'wrap', gap:10 }}>
              {['Touch ID (macOS / iOS)','Face ID (iPhone / iPad)','Windows Hello','YubiKey (FIDO2)','Android Fingerprint','Chrome on Android'].map((a) => (
                <span key={a} style={{ background:'white', border:'1px solid #BFDBFE', borderRadius:9999, padding:'4px 14px', fontSize:13, fontWeight:600, color:'#1D4ED8' }}>{a}</span>
              ))}
            </div>
          </div>
        </div>
      </section>
      <Footer />
    </main>
  );
}
