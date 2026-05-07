import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { EXTENSION_DOWNLOAD_URL } from '@/lib/constants';

export default function Home() {
  return (
    <main className="min-h-screen bg-white">
      {/* Announcement Bar */}
      <div className="announcement-bar">
        Mandatory Proof of Humanity for Gmail is here.{' '}
        <a href="#protocol">Deploy HumanAttest Security →</a>
      </div>

      <Navbar />

      {/* Status Bar */}
      <div className="status-bar">
        <div className="container-custom">
          <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:10, fontSize:13, fontWeight:700, color:'#2563EB' }}>
            <span style={{ width:6, height:6, borderRadius:'50%', background:'#2563EB', display:'inline-block' }}></span>
            TOTP Verification for Gmail is Live — Zero email data stored
          </div>
        </div>
      </div>

      {/* ── Hero ── */}
      <section className="pt-12 pb-16 text-center">
        <div className="container-custom space-y-8">
          <h1 className="hero-title">
            Secure Your <span className="text-gradient-blue">Human Intent.</span><br />
            Definitive Email Protection.
          </h1>
          <p style={{ fontSize:17, color:'#64748B', maxWidth:600, margin:'0 auto', lineHeight:1.7, fontWeight:500 }}>
            HumanAttest eliminates session hijacking and bot-driven emails through mandatory
            biometric and physical device verification — without ever reading your emails.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            {['WebAuthn Biometrics','Native Gmail Hook','Session Lockdown','Zero Email Storage'].map((f) => (
              <div key={f} className="feature-pill-green">
                <span style={{ color:'#16A34A' }}>✓</span> {f}
              </div>
            ))}
          </div>
          <div style={{ paddingTop:16, display:'flex', flexDirection:'column', alignItems:'center', gap:24 }}>
            <div style={{ display:'flex', alignItems:'center', gap:16, flexWrap:'wrap', justifyContent:'center' }}>
              <a href={EXTENSION_DOWNLOAD_URL} className="btn-blue" style={{ padding:'14px 40px' }}>
                <span style={{ fontSize:12 }}>↓</span> Download Extension
              </a>
              <a href="#protocol" className="btn-outline" style={{ padding:'14px 40px' }}>
                View Security Protocol
              </a>
            </div>
            <p style={{ fontSize:11, color:'#94A3B8', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.2em' }}>
              ENTERPRISE-GRADE PROTECTION · CHROME & GOOGLE WORKSPACE
            </p>
          </div>
        </div>
      </section>

      {/* ── Zero-Risk Privacy Banner ── */}
      <section style={{ background:'linear-gradient(135deg,#0A0F1E 0%,#0F172A 100%)', padding:'56px 24px' }}>
        <div className="container-custom">
          <div style={{ textAlign:'center', marginBottom:40 }}>
            <p style={{ fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.15em', color:'#60A5FA', marginBottom:8 }}>
              Zero-Risk Architecture
            </p>
            <h2 style={{ fontSize:32, fontWeight:900, color:'white', letterSpacing:'-0.04em', lineHeight:1.1 }}>
              We Never Touch Your Emails.{' '}
              <span style={{ color:'#3B82F6' }}>Ever.</span>
            </h2>
            <p style={{ color:'#94A3B8', marginTop:12, fontSize:15, maxWidth:520, margin:'12px auto 0' }}>
              HumanAttest works entirely at the <strong style={{ color:'white' }}>send-action layer</strong>.
              We intercept the click — not the content. Your Gmail data stays 100% private.
            </p>
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(260px,1fr))', gap:16, maxWidth:960, margin:'0 auto' }}>
            {/* Never stored */}
            <div style={{ background:'rgba(220,38,38,0.08)', border:'1px solid rgba(220,38,38,0.2)', borderRadius:16, padding:28 }}>
              <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:16 }}>
                <span style={{ fontSize:20 }}>🚫</span>
                <span style={{ fontWeight:800, color:'#FCA5A5', fontSize:13, textTransform:'uppercase', letterSpacing:'0.1em' }}>
                  We NEVER Store
                </span>
              </div>
              <ul style={{ listStyle:'none', padding:0, margin:0, display:'flex', flexDirection:'column', gap:10 }}>
                {[
                  'Your Gmail address or account ID',
                  'Email subject lines or body text',
                  'Recipient email addresses',
                  'Attachments or file contents',
                  'Draft or sent folder data',
                  'Any Google OAuth tokens',
                ].map((item) => (
                  <li key={item} style={{ display:'flex', alignItems:'center', gap:8, fontSize:13, color:'#CBD5E1' }}>
                    <span style={{ color:'#F87171', fontWeight:700, flexShrink:0 }}>✕</span> {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* What we store */}
            <div style={{ background:'rgba(22,163,74,0.08)', border:'1px solid rgba(22,163,74,0.2)', borderRadius:16, padding:28 }}>
              <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:16 }}>
                <span style={{ fontSize:20 }}>✅</span>
                <span style={{ fontWeight:800, color:'#86EFAC', fontSize:13, textTransform:'uppercase', letterSpacing:'0.1em' }}>
                  Only This Is Stored
                </span>
              </div>
              <ul style={{ listStyle:'none', padding:0, margin:0, display:'flex', flexDirection:'column', gap:10 }}>
                {[
                  'SHA-256 cryptographic hash of send-action',
                  'Verification timestamp (UTC)',
                  'Your registered full name (for audit)',
                  'TOTP verification result (pass/fail)',
                ].map((item) => (
                  <li key={item} style={{ display:'flex', alignItems:'center', gap:8, fontSize:13, color:'#CBD5E1' }}>
                    <span style={{ color:'#4ADE80', fontWeight:700, flexShrink:0 }}>✓</span> {item}
                  </li>
                ))}
              </ul>
              <div style={{ marginTop:20, padding:'12px 16px', background:'rgba(22,163,74,0.12)', borderRadius:10, fontSize:12, color:'#86EFAC', fontWeight:600 }}>
                All stored data is encrypted at rest with AES-256.
              </div>
            </div>

            {/* Why safe */}
            <div style={{ background:'rgba(37,99,235,0.08)', border:'1px solid rgba(37,99,235,0.2)', borderRadius:16, padding:28 }}>
              <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:16 }}>
                <span style={{ fontSize:20 }}>🔐</span>
                <span style={{ fontWeight:800, color:'#93C5FD', fontSize:13, textTransform:'uppercase', letterSpacing:'0.1em' }}>
                  Why It&apos;s Safe
                </span>
              </div>
              <ul style={{ listStyle:'none', padding:0, margin:0, display:'flex', flexDirection:'column', gap:10 }}>
                {[
                  'Extension has no Gmail read permission',
                  'Verification runs locally on your device',
                  'No server ever sees email content',
                  'Open audit log — you own your data',
                  'GDPR & CCPA compliant by design',
                  'Legal in all jurisdictions worldwide',
                ].map((item) => (
                  <li key={item} style={{ display:'flex', alignItems:'center', gap:8, fontSize:13, color:'#CBD5E1' }}>
                    <span style={{ color:'#60A5FA', fontWeight:700, flexShrink:0 }}>→</span> {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ── How it Works / Protocol ── */}
      <section id="protocol" style={{ padding:'56px 24px 56px', borderTop:'1px solid #F1F5F9', scrollMarginTop:'72px' }}>
        <div className="container-custom">
          {/* Always side-by-side: text left, card right */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:64, alignItems:'center' }} className="protocol-grid">

            {/* LEFT — text */}
            <div>
              <p style={{ fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.15em', color:'#2563EB', marginBottom:8 }}>
                The Protocol
              </p>
              <h2 style={{ fontSize:36, fontWeight:900, color:'#0F172A', letterSpacing:'-0.04em', lineHeight:1.1, marginBottom:16 }}>
                How HumanAttest <span className="text-gradient-blue">Enforces</span> Trust.
              </h2>
              <p style={{ color:'#64748B', lineHeight:1.7, fontSize:16, marginBottom:40 }}>
                HumanAttest intercepts the Gmail &apos;Send&apos; event at the browser level.
                No email leaves without a verified physical handshake — and no email content is ever read.
              </p>
              <div style={{ display:'flex', flexDirection:'column', gap:28 }}>
                {[
                  { step:'01', icon:'🛡️', title:'Send Action Intercepted', desc:'The extension detects the Gmail send click and immediately pauses the action. Your email stays in the browser — nothing is transmitted yet.' },
                  { step:'02', icon:'🔑', title:'Biometric Handshake', desc:'You verify your physical presence using WebAuthn (Touch ID / Face ID / hardware key). This happens entirely on your local device.' },
                  { step:'03', icon:'🔒', title:'Cryptographic Release', desc:'A one-time SHA-256 token is generated and logged. The send action is released. Only the hash — never the email — reaches our servers.' },
                ].map((item) => (
                  <div key={item.step} style={{ display:'flex', gap:16, alignItems:'flex-start' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:10, flexShrink:0 }}>
                      <div style={{ width:40, height:34, background:'#EFF6FF', color:'#2563EB', display:'flex', alignItems:'center', justifyContent:'center', borderRadius:8, fontWeight:900, fontSize:12, border:'1px solid #DBEAFE' }}>
                        {item.step}
                      </div>
                      <div style={{ width:34, height:34, background:'#EFF6FF', color:'#2563EB', display:'flex', alignItems:'center', justifyContent:'center', borderRadius:'50%', fontSize:15 }}>
                        {item.icon}
                      </div>
                    </div>
                    <div>
                      <h3 style={{ fontWeight:700, color:'#0F172A', fontSize:15, marginBottom:4 }}>{item.title}</h3>
                      <p style={{ fontSize:13, color:'#64748B', lineHeight:1.6, margin:0 }}>{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* RIGHT — 3D Card */}
            <div className="perspective-container" style={{ width:'100%' }}>
              <div className="card-3d" style={{ border:'1px solid #F1F5F9', borderRadius:20, padding:28, background:'white', overflow:'hidden', boxShadow:'0 25px 50px -12px rgba(0,0,0,0.15)' }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', paddingBottom:20, borderBottom:'1px solid #F8FAFC', marginBottom:20 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                    <div className="logo-pulse" style={{ width:42, height:42, borderRadius:12, background:'#2563EB', display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontSize:17, fontWeight:900, boxShadow:'0 4px 12px rgba(37,99,235,0.35)', flexShrink:0 }}>H</div>
                    <div>
                      <p style={{ fontWeight:900, color:'#0F172A', fontSize:13, letterSpacing:'-0.02em', lineHeight:1, margin:0 }}>HumanAttest Security Hub</p>
                      <p className="animate-shimmer" style={{ fontSize:10, textTransform:'uppercase', letterSpacing:'0.12em', fontWeight:700, marginTop:4, marginBottom:0 }}>PENDING: INTENT AUTH</p>
                    </div>
                  </div>
                  <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:5, flexShrink:0 }}>
                    <div style={{ background:'#F0FDF4', color:'#16A34A', fontSize:10, fontWeight:900, padding:'3px 9px', borderRadius:9999, border:'1px solid #DCFCE7' }}>SECURE</div>
                    <div style={{ display:'flex', alignItems:'center', gap:5, color:'#22C55E' }}>
                      <span className="animate-pulse" style={{ width:6, height:6, borderRadius:'50%', background:'#22C55E', display:'inline-block' }}></span>
                      <span style={{ fontSize:10, fontWeight:900, textTransform:'uppercase', letterSpacing:'0.12em' }}>VERIFIED</span>
                    </div>
                  </div>
                </div>
                <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', fontSize:10, fontWeight:900, color:'#94A3B8', textTransform:'uppercase', letterSpacing:'0.12em' }}>
                    <span style={{ color:'#0F172A' }}>WebAuthn Status</span>
                    <span>SCAN TO AUTHORIZE</span>
                  </div>
                  <div style={{ width:'100%', height:190, background:'#0F172A', borderRadius:16, display:'flex', alignItems:'center', justifyContent:'center', overflow:'hidden', position:'relative', boxShadow:'inset 0 2px 8px rgba(0,0,0,0.4)' }}>
                    <img src="/security_qr.png" alt="Security QR" className="floating" style={{ position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'cover', opacity:0.7, mixBlendMode:'screen', transform:'scale(1.1)' }} />
                    <div style={{ position:'absolute', inset:0, background:'linear-gradient(to top, #0F172A, transparent, transparent)', opacity:0.9 }}></div>
                  </div>
                  <button className="btn-blue" style={{ width:'100%', padding:'16px 0', fontSize:15 }}>
                    <span style={{ fontSize:18 }}>🔒</span> Release Action
                  </button>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section id="features" style={{ padding:'56px 24px', background:'rgba(248,250,252,0.5)', scrollMarginTop:'72px' }}>
        <div className="container-custom">
          <div style={{ marginBottom:32 }}>
            <p style={{ fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.15em', color:'#2563EB', marginBottom:8 }}>
              Modern Security Stack
            </p>
            <h2 style={{ fontSize:36, fontWeight:900, color:'#0F172A', letterSpacing:'-0.04em' }}>
              Engineered for Absolute Assurance.
            </h2>
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))', gap:20, marginBottom:48 }}>
            {[
              { icon:'🛡️', title:'FIDO2 WebAuthn', color:'blue', desc:'Military-grade biometric authentication using your device\'s built-in fingerprint or face sensor. No passwords, no phishing.' },
              { icon:'🔗', title:'Native Gmail Hook', color:'green', desc:'Direct injection into the Gmail send pipeline. The extension intercepts the action before any data leaves your browser.' },
              { icon:'🔔', title:'Security Nudges', color:'orange', desc:'Recipients see a verified human badge on emails sent through HumanAttest, building trust at the inbox level.' },
              { icon:'🔍', title:'Audit Engine', color:'purple', desc:'Every verification is logged as a cryptographic hash to a secure PostgreSQL database. Full audit trail, zero email content.' },
            ].map((item) => (
              <div key={item.title} className="card-stack" style={{ display:'flex', flexDirection:'column', gap:14 }}>
                <div style={{ width:44, height:44, borderRadius:12, display:'flex', alignItems:'center', justifyContent:'center', fontSize:20,
                  background: item.color==='blue'?'#EFF6FF':item.color==='green'?'#F0FDF4':item.color==='orange'?'#FFF7ED':'#FAF5FF',
                  color: item.color==='blue'?'#2563EB':item.color==='green'?'#16A34A':item.color==='orange'?'#EA580C':'#9333EA',
                }}>
                  {item.icon}
                </div>
                <h3 style={{ fontWeight:700, color:'#0F172A', fontSize:16 }}>{item.title}</h3>
                <p style={{ fontSize:13, color:'#64748B', lineHeight:1.6 }}>{item.desc}</p>
              </div>
            ))}
          </div>

          <div className="business-profile-bar">
            <div style={{ display:'flex', alignItems:'center', gap:20 }}>
              <div style={{ width:52, height:52, borderRadius:14, background:'#2563EB', display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontSize:22, boxShadow:'0 4px 12px rgba(37,99,235,0.4)', flexShrink:0 }}>🏢</div>
              <div>
                <h4 style={{ fontSize:18, fontWeight:900, color:'white', letterSpacing:'-0.03em' }}>Business Profile</h4>
                <p style={{ fontSize:11, color:'#60A5FA', textTransform:'uppercase', letterSpacing:'0.12em', fontWeight:700 }}>HUMANATTEST SECURITY LTD.</p>
              </div>
            </div>
            <div className="biz-stats">
              {[
                { label:'Network', value:'Decentralized' },
                { label:'Protocols', value:'WebAuthn, TOTP' },
                { label:'Data Policy', value:'Zero Email Storage' },
                { label:'Compliance', value:'SOC2 Ready' },
              ].map((s) => (
                <div key={s.label} style={{ display:'flex', flexDirection:'column', gap:4 }}>
                  <p style={{ color:'#94A3B8', fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.12em' }}>{s.label}</p>
                  <p style={{ fontWeight:700, color:'white', fontSize:14 }}>{s.value}</p>
                </div>
              ))}
            </div>
            <a href="/pricing" className="btn-blue" style={{ padding:'16px 28px', whiteSpace:'nowrap' }}>
              <span style={{ fontSize:18 }}>🛡️</span> View Plans
            </a>
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section style={{ padding:'80px 24px', background:'#0F172A', color:'white', overflow:'hidden', position:'relative' }}>
        <div style={{ position:'absolute', inset:0, opacity:0.08, backgroundImage:'radial-gradient(#2563EB 1px, transparent 1px)', backgroundSize:'40px 40px' }}></div>
        <div className="container-custom" style={{ textAlign:'center', position:'relative', zIndex:10 }}>
          <h2 style={{ fontSize:'clamp(36px,5vw,60px)', fontWeight:900, letterSpacing:'-0.04em', lineHeight:1.1, marginBottom:20 }}>
            Secure Your <span style={{ color:'#3B82F6' }}>Intent.</span>
          </h2>
          <p style={{ fontSize:18, color:'#94A3B8', maxWidth:560, margin:'0 auto 40px', lineHeight:1.7, fontWeight:500 }}>
            Deployment takes seconds. Protection lasts forever. Your emails stay private — always.
          </p>
          <div style={{ display:'flex', flexWrap:'wrap', justifyContent:'center', gap:16 }}>
            <a href={EXTENSION_DOWNLOAD_URL} className="btn-blue" style={{ padding:'16px 44px', fontSize:16 }}>
              <span style={{ fontSize:18 }}>🔒</span> Install HumanAttest Extension
            </a>
            <a href="/docs" className="btn-outline" style={{ padding:'16px 44px', fontSize:16, background:'transparent', borderColor:'rgba(255,255,255,0.15)', color:'white' }}>
              Read the Docs
            </a>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}
