import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { EXTENSION_DOWNLOAD_URL } from '@/lib/constants';

const Check = () => (
  <svg style={{ width:18, height:18, color:'#34A853', flexShrink:0 }} fill="currentColor" viewBox="0 0 20 20">
    <path d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"/>
  </svg>
);

export default function Pricing() {
  return (
    <main style={{ minHeight:'100vh', background:'#ffffff' }}>
      <Navbar />

      {/* ── Hero ── */}
      <section style={{ padding:'96px 24px 64px', textAlign:'center', background:'linear-gradient(180deg,#F8FAFC 0%,#ffffff 100%)' }}>
        <p style={{ fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.15em', color:'#2563EB', marginBottom:12 }}>
          Transparent Pricing
        </p>
        <h1 style={{ fontSize:'clamp(36px,5vw,56px)', fontWeight:900, color:'#0F172A', letterSpacing:'-0.04em', lineHeight:1.1, marginBottom:16 }}>
          Simple, <span style={{ color:'#4285F4' }}>Business-First</span> Pricing
        </h1>
        <p style={{ fontSize:17, color:'#64748B', maxWidth:520, margin:'0 auto 16px', lineHeight:1.7, fontWeight:500 }}>
          No hidden fees. No email scanning. No data selling. Just pure human-verified trust.
        </p>
        {/* Trust badge */}
        <div style={{ display:'inline-flex', alignItems:'center', gap:8, background:'rgba(22,163,74,0.08)', border:'1px solid rgba(22,163,74,0.2)', borderRadius:9999, padding:'6px 16px', fontSize:13, fontWeight:700, color:'#16A34A' }}>
          <span>🔒</span> Zero email storage — we never read your Gmail
        </div>
      </section>

      {/* ── Plans ── */}
      <section style={{ padding:'0 24px 96px' }}>
        <div style={{ maxWidth:1100, margin:'0 auto', display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(280px,1fr))', gap:24, alignItems:'start' }}>

          {/* Individual — Free */}
          <div style={{ background:'white', border:'1px solid #E2E8F0', borderRadius:20, padding:36, display:'flex', flexDirection:'column' }}>
            <div style={{ marginBottom:24 }}>
              <h2 style={{ fontSize:22, fontWeight:900, color:'#0F172A', marginBottom:4 }}>Individual</h2>
              <p style={{ fontSize:13, color:'#64748B', fontWeight:500 }}>Perfect for personal security.</p>
            </div>
            <div style={{ marginBottom:28 }}>
              <span style={{ fontSize:48, fontWeight:900, color:'#0F172A', letterSpacing:'-0.04em' }}>$0</span>
              <span style={{ fontSize:15, color:'#94A3B8', fontWeight:600 }}>/month</span>
            </div>
            <ul style={{ listStyle:'none', padding:0, margin:'0 0 32px', display:'flex', flexDirection:'column', gap:12, flexGrow:1 }}>
              {[
                'Basic TOTP Verification',
                'Native Gmail Send Hook',
                '1 Active Gmail Account',
                'Verification Audit Log',
                'Zero email data stored',
                'Community support',
              ].map((f) => (
                <li key={f} style={{ display:'flex', alignItems:'center', gap:10, fontSize:14, color:'#475569', fontWeight:500 }}>
                  <Check /> {f}
                </li>
              ))}
            </ul>
            <a href={EXTENSION_DOWNLOAD_URL} style={{ display:'block', textAlign:'center', padding:'13px 0', borderRadius:12, border:'1.5px solid #E2E8F0', fontWeight:700, fontSize:15, color:'#0F172A', textDecoration:'none', transition:'all 0.2s' }}>
              Get Started Free
            </a>
          </div>

          {/* Professional — Recommended */}
          <div style={{ background:'white', border:'2px solid #4285F4', borderRadius:20, padding:36, display:'flex', flexDirection:'column', position:'relative', boxShadow:'0 20px 60px -10px rgba(66,133,244,0.2)', transform:'scale(1.03)' }}>
            <div style={{ position:'absolute', top:-14, left:'50%', transform:'translateX(-50%)', background:'#4285F4', color:'white', padding:'4px 18px', borderRadius:9999, fontSize:11, fontWeight:900, textTransform:'uppercase', letterSpacing:'0.1em', whiteSpace:'nowrap' }}>
              Most Popular
            </div>
            <div style={{ marginBottom:24 }}>
              <h2 style={{ fontSize:22, fontWeight:900, color:'#0F172A', marginBottom:4 }}>Professional</h2>
              <p style={{ fontSize:13, color:'#64748B', fontWeight:500 }}>For high-stakes security teams.</p>
            </div>
            <div style={{ marginBottom:28 }}>
              <span style={{ fontSize:48, fontWeight:900, color:'#0F172A', letterSpacing:'-0.04em' }}>$12</span>
              <span style={{ fontSize:15, color:'#94A3B8', fontWeight:600 }}>/month per user</span>
            </div>
            <ul style={{ listStyle:'none', padding:0, margin:'0 0 32px', display:'flex', flexDirection:'column', gap:12, flexGrow:1 }}>
              {[
                'Unlimited TOTP Verifications',
                'WebAuthn Biometric Support',
                'Up to 5 Gmail Accounts',
                'Security Trust-Nudge Badges',
                'Priority email support',
                'Advanced Audit Dashboard',
                'Zero email data stored',
                'GDPR & CCPA compliant',
              ].map((f) => (
                <li key={f} style={{ display:'flex', alignItems:'center', gap:10, fontSize:14, color:'#475569', fontWeight:500 }}>
                  <Check /> {f}
                </li>
              ))}
            </ul>
            <button style={{ display:'block', width:'100%', padding:'15px 0', borderRadius:12, border:'none', background:'linear-gradient(135deg,#4285F4 0%,#2563EB 100%)', color:'white', fontWeight:800, fontSize:16, cursor:'pointer', boxShadow:'0 4px 14px rgba(66,133,244,0.35)' }}>
              Start 14-Day Free Trial
            </button>
            <p style={{ textAlign:'center', fontSize:12, color:'#94A3B8', marginTop:10, fontWeight:500 }}>No credit card required</p>
          </div>

          {/* Enterprise */}
          <div style={{ background:'white', border:'1px solid #E2E8F0', borderRadius:20, padding:36, display:'flex', flexDirection:'column' }}>
            <div style={{ marginBottom:24 }}>
              <h2 style={{ fontSize:22, fontWeight:900, color:'#0F172A', marginBottom:4 }}>Enterprise</h2>
              <p style={{ fontSize:13, color:'#64748B', fontWeight:500 }}>For large-scale deployments.</p>
            </div>
            <div style={{ marginBottom:28 }}>
              <span style={{ fontSize:40, fontWeight:900, color:'#0F172A', letterSpacing:'-0.04em' }}>Custom</span>
            </div>
            <ul style={{ listStyle:'none', padding:0, margin:'0 0 32px', display:'flex', flexDirection:'column', gap:12, flexGrow:1 }}>
              {[
                'Unlimited accounts & verifications',
                'SSO & SAML Integration',
                'Real-time Audit Log API',
                'Dedicated Account Manager',
                'Custom retention policies',
                'On-premise deployment option',
                'SLA guarantee',
                'Zero email data stored',
              ].map((f) => (
                <li key={f} style={{ display:'flex', alignItems:'center', gap:10, fontSize:14, color:'#475569', fontWeight:500 }}>
                  <Check /> {f}
                </li>
              ))}
            </ul>
            <button style={{ display:'block', width:'100%', padding:'13px 0', borderRadius:12, border:'1.5px solid #E2E8F0', background:'transparent', fontWeight:700, fontSize:15, color:'#0F172A', cursor:'pointer' }}>
              Contact Sales
            </button>
          </div>
        </div>
      </section>

      {/* ── Privacy Trust Section ── */}
      <section style={{ background:'#0F172A', padding:'72px 24px' }}>
        <div style={{ maxWidth:900, margin:'0 auto', textAlign:'center' }}>
          <p style={{ fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.15em', color:'#60A5FA', marginBottom:12 }}>
            Our Privacy Promise
          </p>
          <h2 style={{ fontSize:32, fontWeight:900, color:'white', letterSpacing:'-0.04em', marginBottom:16 }}>
            Every Plan. Zero Email Risk.
          </h2>
          <p style={{ color:'#94A3B8', fontSize:15, lineHeight:1.7, maxWidth:560, margin:'0 auto 48px' }}>
            Regardless of which plan you choose, HumanAttest <strong style={{ color:'white' }}>never reads, stores, or transmits</strong> your email content. This is not a policy — it is a technical guarantee baked into our architecture.
          </p>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))', gap:16 }}>
            {[
              { icon:'🚫', title:'No Gmail ID stored', desc:'We never record your Google account identifier or email address.' },
              { icon:'📧', title:'No email content', desc:'Subject, body, recipients, and attachments are never accessible to us.' },
              { icon:'🔐', title:'Local verification', desc:'Biometric checks happen on your device. No biometric data leaves your machine.' },
              { icon:'📋', title:'Only 4 fields logged', desc:'Hash, timestamp, your name, and pass/fail. That\'s the entire database record.' },
            ].map((item) => (
              <div key={item.title} style={{ background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:14, padding:24, textAlign:'left' }}>
                <div style={{ fontSize:24, marginBottom:12 }}>{item.icon}</div>
                <p style={{ fontWeight:700, color:'white', fontSize:14, marginBottom:6 }}>{item.title}</p>
                <p style={{ fontSize:13, color:'#94A3B8', lineHeight:1.6, margin:0 }}>{item.desc}</p>
              </div>
            ))}
          </div>
          <p style={{ marginTop:32, fontSize:13, color:'#64748B' }}>
            Read the full details in our{' '}
            <a href="/docs?tab=privacy" style={{ color:'#60A5FA', fontWeight:600 }}>Privacy &amp; Zero-Risk Policy →</a>
          </p>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section style={{ padding:'72px 24px', background:'#F8FAFC' }}>
        <div style={{ maxWidth:720, margin:'0 auto' }}>
          <h2 style={{ fontSize:28, fontWeight:900, color:'#0F172A', letterSpacing:'-0.03em', marginBottom:32, textAlign:'center' }}>
            Pricing FAQ
          </h2>
          <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
            {[
              ['Do you store my Gmail address?','No. We never store your Gmail address or any Google account identifier. We only store your registered full name for the verified sender badge.'],
              ['Can I cancel anytime?','Yes. Cancel from your account dashboard at any time. No cancellation fees.'],
              ['Is the free plan really free?','Yes, forever. The Individual plan has no time limit and no credit card required.'],
              ['What happens to my data if I cancel?','Your verification logs are retained for 90 days after cancellation, then permanently deleted. You can request immediate deletion at any time.'],
              ['Does HumanAttest work with Google Workspace?','Yes. It works with any Gmail interface — personal @gmail.com accounts and Google Workspace (formerly G Suite) accounts.'],
            ].map(([q, a]) => (
              <div key={q} style={{ padding:'20px 24px', background:'white', border:'1px solid #E2E8F0', borderRadius:14 }}>
                <p style={{ fontWeight:700, color:'#0F172A', fontSize:15, marginBottom:8 }}>{q}</p>
                <p style={{ fontSize:14, color:'#64748B', margin:0, lineHeight:1.6 }}>{a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}
