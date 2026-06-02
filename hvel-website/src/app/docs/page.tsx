'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

/* ── Shared styles ── */
const S = {
  h3: { fontSize:22, fontWeight:700, color:'var(--text-main)', marginBottom:12 } as React.CSSProperties,
  p:  { color:'var(--text-secondary)', lineHeight:1.75, marginBottom:16 } as React.CSSProperties,
  callout: (color: string) => ({
    background:`${color}0d`, borderLeft:`4px solid ${color}`,
    padding:'16px 20px', borderRadius:'0 12px 12px 0', marginBottom:16,
  } as React.CSSProperties),
  tag: (color: string) => ({
    display:'inline-block', background:`${color}15`, color, fontSize:11,
    fontWeight:700, textTransform:'uppercase' as const, letterSpacing:'0.1em',
    padding:'3px 10px', borderRadius:9999, marginBottom:8,
  }),
  li: { display:'flex', alignItems:'flex-start', gap:10, fontSize:14, color:'var(--text-secondary)', marginBottom:10 } as React.CSSProperties,
  check: { color:'#16A34A', fontWeight:700, flexShrink:0, marginTop:2 } as React.CSSProperties,
  cross: { color:'#DC2626', fontWeight:700, flexShrink:0, marginTop:2 } as React.CSSProperties,
  code: { background:'#F1F5F9', color:'#0F172A', fontFamily:'monospace', fontSize:13, padding:'2px 8px', borderRadius:6 } as React.CSSProperties,
};

const DOCS_CONTENT = {
  introduction: {
    title: 'Introduction to Attest',
    subsections: [
      { id:'mission',      title:'Mission & Vision' },
      { id:'how-it-works', title:'How it Works' },
      { id:'why-hvel',     title:'Why Attest?' },
    ],
    content: (
      <div>
        <p style={{ ...S.p, fontSize:17 }}>
          Attest (HVEL — Human Verified Email Layer) is a browser extension + verification
          backend that proves a real human intentionally sent an email — without ever reading,
          storing, or transmitting your email content.
        </p>

        <section id="mission" style={{ scrollMarginTop:96, marginBottom:40 }}>
          <h3 style={S.h3}>Mission &amp; Vision</h3>
          <p style={S.p}>
            AI can now write emails indistinguishable from humans. Session hijacking lets attackers
            send emails from your account without your knowledge. Traditional spam filters and 2FA
            protect your <em>login</em> — but nothing protects your <em>send action</em>.
          </p>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))', gap:16, marginTop:20 }}>
            <div style={{ padding:20, background:'rgba(66,133,244,0.05)', border:'1px solid rgba(66,133,244,0.12)', borderRadius:14 }}>
              <div style={S.tag('#4285F4')}>The Problem</div>
              <p style={{ ...S.p, marginBottom:0, fontSize:14 }}>
                Bots and hijacked sessions can send emails from your account. Recipients have no way
                to know if a human actually pressed send.
              </p>
            </div>
            <div style={{ padding:20, background:'rgba(52,168,83,0.05)', border:'1px solid rgba(52,168,83,0.12)', borderRadius:14 }}>
              <div style={S.tag('#34A853')}>The Solution</div>
              <p style={{ ...S.p, marginBottom:0, fontSize:14 }}>
                Attest requires a physical biometric or TOTP verification for every send action.
                No verification = no email sent. Simple.
              </p>
            </div>
          </div>
        </section>

        <section id="how-it-works" style={{ scrollMarginTop:96, marginBottom:40 }}>
          <h3 style={S.h3}>How it Works</h3>
          <p style={S.p}>
            The Chrome extension hooks into Gmail&apos;s send button at the DOM level. When you click
            send, the extension pauses the action and opens a verification challenge. Only after you
            pass the challenge (biometric or TOTP) does the email actually send.
          </p>
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            {[
              ['01','Send Intercepted','Extension detects the Gmail send click and pauses it. Your email stays in the browser.'],
              ['02','Challenge Issued','A TOTP code or WebAuthn biometric prompt appears. You verify your physical presence.'],
              ['03','Hash Logged','A SHA-256 hash of the send-action metadata is logged to our server. No email content is sent.'],
              ['04','Email Released','The send action is released and your email goes out normally through Gmail.'],
            ].map(([step, title, desc]) => (
              <div key={step} style={{ display:'flex', gap:16, alignItems:'flex-start', padding:'16px 20px', background:'#F8FAFC', borderRadius:12, border:'1px solid #E2E8F0' }}>
                <div style={{ width:36, height:36, background:'#EFF6FF', color:'#2563EB', borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center', fontWeight:900, fontSize:13, flexShrink:0 }}>{step}</div>
                <div>
                  <p style={{ fontWeight:700, color:'#0F172A', marginBottom:4, fontSize:14 }}>{title}</p>
                  <p style={{ fontSize:13, color:'#64748B', margin:0 }}>{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section id="why-hvel" style={{ scrollMarginTop:96 }}>
          <h3 style={S.h3}>Why Attest?</h3>
          <p style={S.p}>
            Standard 2FA protects your <strong>login</strong>. Attest protects your <strong>actions</strong>.
            Even if an attacker has your session cookie, they cannot send an email without your physical device.
          </p>
          <div style={S.callout('#4285F4')}>
            <strong style={{ color:'#1D4ED8' }}>Key insight:</strong>{' '}
            <span style={{ color:'#475569', fontSize:14 }}>
              Session hijacking is the #1 vector for business email compromise (BEC). Attest is
              the only tool that blocks it at the send layer — not the login layer.
            </span>
          </div>
        </section>
      </div>
    ),
  },

  privacy: {
    title: 'Privacy & Zero-Risk Policy',
    subsections: [
      { id:'no-email-read',  title:'We Never Read Emails' },
      { id:'what-we-store',  title:'What Is Stored' },
      { id:'what-not-stored',title:'What Is Never Stored' },
      { id:'legality',       title:'Global Legality' },
    ],
    content: (
      <div>
        <p style={{ ...S.p, fontSize:17 }}>
          Privacy is not a feature — it is the foundation of Attest. Our architecture is
          designed so that it is <strong>technically impossible</strong> for us to read your emails,
          even if we wanted to.
        </p>

        <section id="no-email-read" style={{ scrollMarginTop:96, marginBottom:40 }}>
          <h3 style={S.h3}>We Never Read Your Emails</h3>
          <div style={{ ...S.callout('#DC2626'), borderLeftColor:'#DC2626' }}>
            <strong style={{ color:'#DC2626', display:'block', marginBottom:6 }}>
              🚫 Zero Email Access — Guaranteed
            </strong>
            <p style={{ ...S.p, marginBottom:0, fontSize:14 }}>
              The Attest Chrome extension does <strong>NOT</strong> request the{' '}
              <code style={S.code}>gmail.readonly</code> or any Gmail content permission.
              It only hooks the send button click event. Your email body, subject, recipients,
              and attachments are <strong>never accessible</strong> to our extension or servers.
            </p>
          </div>
          <p style={S.p}>
            You can verify this yourself by inspecting the extension&apos;s{' '}
            <code style={S.code}>manifest.json</code> — the permissions list contains only{' '}
            <code style={S.code}>activeTab</code> and <code style={S.code}>storage</code>.
            No Gmail API scopes. No OAuth email access.
          </p>
        </section>

        <section id="what-we-store" style={{ scrollMarginTop:96, marginBottom:40 }}>
          <h3 style={S.h3}>What Is Stored</h3>
          <p style={S.p}>
            When you successfully verify a send action, we log exactly four fields to our
            encrypted PostgreSQL database:
          </p>
          <div style={{ background:'rgba(22,163,74,0.06)', border:'1px solid rgba(22,163,74,0.15)', borderRadius:14, padding:24, marginBottom:16 }}>
            {[
              ['SHA-256 hash of the send-action event','A one-way cryptographic fingerprint. Cannot be reversed to reveal email content.'],
              ['Verification timestamp (UTC)','When the human verification occurred.'],
              ['Your registered full name','Used only for the recipient-facing verified badge.'],
              ['TOTP/WebAuthn result','Pass or fail. No biometric data is transmitted — verification happens locally.'],
            ].map(([field, note]) => (
              <div key={field} style={{ display:'flex', gap:12, marginBottom:16, paddingBottom:16, borderBottom:'1px solid rgba(22,163,74,0.1)' }}>
                <span style={{ color:'#16A34A', fontWeight:700, flexShrink:0, marginTop:2 }}>✓</span>
                <div>
                  <p style={{ fontWeight:700, color:'#0F172A', fontSize:14, marginBottom:2 }}>{field}</p>
                  <p style={{ fontSize:13, color:'#64748B', margin:0 }}>{note}</p>
                </div>
              </div>
            ))}
          </div>
          <p style={{ ...S.p, fontSize:13 }}>
            All stored data is encrypted at rest using AES-256. You can request deletion of your
            records at any time by contacting support.
          </p>
        </section>

        <section id="what-not-stored" style={{ scrollMarginTop:96, marginBottom:40 }}>
          <h3 style={S.h3}>What Is Never Stored</h3>
          <div style={{ background:'rgba(220,38,38,0.05)', border:'1px solid rgba(220,38,38,0.12)', borderRadius:14, padding:24 }}>
            {[
              'Your Gmail address or Google account ID',
              'Email subject line',
              'Email body or message content',
              'Recipient email addresses (To / CC / BCC)',
              'Attachments or file names',
              'Draft folder contents',
              'Any Google OAuth tokens or session cookies',
              'Browser history or tab URLs',
              'Biometric data (fingerprint, face scan)',
            ].map((item) => (
              <div key={item} style={S.li}>
                <span style={S.cross}>✕</span>
                <span>{item}</span>
              </div>
            ))}
          </div>
        </section>

        <section id="legality" style={{ scrollMarginTop:96 }}>
          <h3 style={S.h3}>Global Legality</h3>
          <p style={S.p}>
            Attest is <strong style={{ color:'#16A34A' }}>legal in all countries</strong>.
            It functions as a security enhancement tool — similar to a hardware security key —
            and does not intercept, store, or process personal communications.
          </p>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))', gap:12 }}>
            {[
              { law:'GDPR', region:'European Union', status:'Compliant' },
              { law:'CCPA', region:'California, USA', status:'Compliant' },
              { law:'PIPEDA', region:'Canada', status:'Compliant' },
              { law:'PDPA', region:'Thailand / Singapore', status:'Compliant' },
            ].map((r) => (
              <div key={r.law} style={{ padding:'14px 18px', background:'rgba(22,163,74,0.06)', border:'1px solid rgba(22,163,74,0.15)', borderRadius:12 }}>
                <p style={{ fontWeight:900, color:'#0F172A', fontSize:15, marginBottom:2 }}>{r.law}</p>
                <p style={{ fontSize:12, color:'#64748B', marginBottom:6 }}>{r.region}</p>
                <span style={{ fontSize:11, fontWeight:700, color:'#16A34A', background:'rgba(22,163,74,0.1)', padding:'2px 8px', borderRadius:9999 }}>✓ {r.status}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    ),
  },

  installation: {
    title: 'Installation Guide',
    subsections: [
      { id:'requirements',  title:'Requirements' },
      { id:'extension',     title:'Chrome Extension' },
      { id:'registration',  title:'Account Registration' },
      { id:'test-send',     title:'Test Your First Send' },
    ],
    content: (
      <div>
        <p style={{ ...S.p, fontSize:17 }}>
          Get Attest running in under 5 minutes. No server setup required for individual use.
        </p>

        <section id="requirements" style={{ scrollMarginTop:96, marginBottom:40 }}>
          <h3 style={S.h3}>Requirements</h3>
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {[
              'Google Chrome 110+ (or any Chromium-based browser)',
              'A Gmail account (personal or Google Workspace)',
              'A smartphone with an authenticator app (Google Authenticator, Authy, etc.)',
            ].map((r) => (
              <div key={r} style={S.li}>
                <span style={S.check}>✓</span><span>{r}</span>
              </div>
            ))}
          </div>
        </section>

        <section id="extension" style={{ scrollMarginTop:96, marginBottom:40 }}>
          <h3 style={S.h3}>Install the Chrome Extension</h3>
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            {[
              ['1','Download the extension','Click the Download Extension button on the homepage to get the <code>.zip</code> file.'],
              ['2','Open Chrome Extensions','Navigate to <code>chrome://extensions</code> in your browser.'],
              ['3','Enable Developer Mode','Toggle the "Developer mode" switch in the top-right corner.'],
              ['4','Load Unpacked','Click "Load unpacked" and select the extracted extension folder.'],
              ['5','Pin the extension','Click the puzzle icon in Chrome toolbar and pin Attest for easy access.'],
            ].map(([num, title, desc]) => (
              <div key={num} style={{ display:'flex', gap:16, padding:'16px 20px', background:'#F8FAFC', borderRadius:12, border:'1px solid #E2E8F0' }}>
                <div style={{ width:32, height:32, background:'#2563EB', color:'white', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:900, fontSize:13, flexShrink:0 }}>{num}</div>
                <div>
                  <p style={{ fontWeight:700, color:'#0F172A', marginBottom:4, fontSize:14 }}>{title}</p>
                  <p style={{ fontSize:13, color:'#64748B', margin:0 }} dangerouslySetInnerHTML={{ __html: desc }} />
                </div>
              </div>
            ))}
          </div>
        </section>

        <section id="registration" style={{ scrollMarginTop:96, marginBottom:40 }}>
          <h3 style={S.h3}>Account Registration</h3>
          <p style={S.p}>
            Visit the Attest portal and register with your full name and email. You will receive
            a QR code to scan with your authenticator app. This sets up your TOTP secret — stored
            only on your device.
          </p>
          <div style={S.callout('#4285F4')}>
            <strong style={{ color:'#1D4ED8' }}>Note:</strong>{' '}
            <span style={{ fontSize:14, color:'#475569' }}>
              We register your <strong>full name</strong> only — not your Gmail address.
              Your name is used solely to display the verified sender badge to recipients.
            </span>
          </div>
        </section>

        <section id="test-send" style={{ scrollMarginTop:96 }}>
          <h3 style={S.h3}>Test Your First Send</h3>
          <p style={S.p}>
            Open Gmail, compose a test email to yourself, and click Send. The Attest overlay
            will appear asking for your 6-digit TOTP code. Enter it and the email will send normally.
            Check the <a href="/verify" style={{ color:'#2563EB', fontWeight:600 }}>Verify page</a> to
            confirm the hash was logged.
          </p>
        </section>
      </div>
    ),
  },

  quickstart: {
    title: 'Quickstart Guide',
    subsections: [
      { id:'daily-use',    title:'Daily Use' },
      { id:'verify-email', title:'Verifying an Email' },
      { id:'faq',          title:'FAQ' },
    ],
    content: (
      <div>
        <p style={{ ...S.p, fontSize:17 }}>
          Once installed, Attest runs silently in the background. You only see it when you
          click Send in Gmail.
        </p>

        <section id="daily-use" style={{ scrollMarginTop:96, marginBottom:40 }}>
          <h3 style={S.h3}>Daily Use</h3>
          <p style={S.p}>
            Compose your email as normal. When you click Send, a small overlay appears with a
            6-digit TOTP field. Open your authenticator app, enter the code, and your email sends.
            The whole process takes under 5 seconds.
          </p>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))', gap:12, marginTop:16 }}>
            {[
              { icon:'✍️', label:'Compose email normally' },
              { icon:'📤', label:'Click Send in Gmail' },
              { icon:'📱', label:'Open authenticator app' },
              { icon:'🔢', label:'Enter 6-digit code' },
              { icon:'✅', label:'Email sent & verified' },
            ].map((s) => (
              <div key={s.label} style={{ padding:'16px 14px', background:'#F8FAFC', border:'1px solid #E2E8F0', borderRadius:12, textAlign:'center' }}>
                <div style={{ fontSize:24, marginBottom:8 }}>{s.icon}</div>
                <p style={{ fontSize:13, color:'#475569', fontWeight:600, margin:0 }}>{s.label}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="verify-email" style={{ scrollMarginTop:96, marginBottom:40 }}>
          <h3 style={S.h3}>Verifying an Email You Received</h3>
          <p style={S.p}>
            If you receive an email with an Attest verification badge, you can confirm it is
            genuine. Copy the SHA-256 hash from the email header (or the badge tooltip) and paste
            it into the <a href="/verify" style={{ color:'#2563EB', fontWeight:600 }}>Verify page</a>.
            The result will show the sender&apos;s registered name and the exact timestamp of verification.
          </p>
        </section>

        <section id="faq" style={{ scrollMarginTop:96 }}>
          <h3 style={S.h3}>Frequently Asked Questions</h3>
          <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
            {[
              ['Does Attest read my emails?','No. The extension has no Gmail read permission. It only intercepts the send button click. Your email content is never accessible to us.'],
              ['Does it store my Gmail address?','No. We never store your Gmail address or any Google account identifier. Registration only requires your full name.'],
              ['What if I lose my phone?','You can reset your TOTP secret from the portal using your registered email. Contact support for account recovery.'],
              ['Does it work with Google Workspace?','Yes. Attest works with any Gmail interface — personal accounts and Google Workspace (G Suite) accounts.'],
              ['Is it free?','The Individual plan is free forever. See the Pricing page for team and enterprise options.'],
            ].map(([q, a]) => (
              <div key={q} style={{ padding:'18px 20px', background:'#F8FAFC', border:'1px solid #E2E8F0', borderRadius:12 }}>
                <p style={{ fontWeight:700, color:'#0F172A', fontSize:14, marginBottom:6 }}>{q}</p>
                <p style={{ fontSize:13, color:'#64748B', margin:0, lineHeight:1.6 }}>{a}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    ),
  },
};

const DOC_KEYS = Object.keys(DOCS_CONTENT) as (keyof typeof DOCS_CONTENT)[];

function DocsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<keyof typeof DOCS_CONTENT>('introduction');

  useEffect(() => {
    const tab = searchParams.get('tab') as keyof typeof DOCS_CONTENT;
    if (tab && DOCS_CONTENT[tab]) setActiveTab(tab);
  }, [searchParams]);

  const changeTab = (tab: keyof typeof DOCS_CONTENT) => {
    setActiveTab(tab);
    router.push(`/docs?tab=${tab}`, { scroll: true });
  };

  const handleNext = () => {
    const i = DOC_KEYS.indexOf(activeTab);
    changeTab(DOC_KEYS[(i + 1) % DOC_KEYS.length]);
  };

  const handlePrev = () => {
    const i = DOC_KEYS.indexOf(activeTab);
    changeTab(DOC_KEYS[(i - 1 + DOC_KEYS.length) % DOC_KEYS.length]);
  };

  const tabLabels: Record<string, string> = {
    introduction: 'Introduction',
    privacy:      'Privacy & Zero-Risk',
    installation: 'Installation',
    quickstart:   'Quickstart',
  };

  return (
    <div style={{ maxWidth:1280, margin:'0 auto', display:'grid', gridTemplateColumns:'1fr', gap:48, padding:'48px 24px' }} className="docs-layout">
      {/* Sidebar */}
      <aside className="docs-sidebar">
        <div style={{ position:'sticky', top:96 }}>
          <p style={{ fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.2em', color:'var(--text-secondary)', marginBottom:16, opacity:0.6 }}>
            Documentation
          </p>
          <ul style={{ listStyle:'none', padding:0, margin:0, display:'flex', flexDirection:'column', gap:4 }}>
            {DOC_KEYS.map((tab) => (
              <li key={tab}>
                <button
                  onClick={() => changeTab(tab)}
                  style={{
                    width:'100%', textAlign:'left', padding:'10px 14px', borderRadius:10,
                    border:'none', cursor:'pointer', fontSize:14, fontWeight: activeTab===tab ? 800 : 600,
                    background: activeTab===tab ? 'rgba(66,133,244,0.1)' : 'transparent',
                    color: activeTab===tab ? '#4285F4' : 'var(--text-secondary)',
                    transition:'all 0.2s',
                  }}
                >
                  {tabLabels[tab]}
                </button>
              </li>
            ))}
          </ul>

          {/* Privacy trust badge in sidebar */}
          <div style={{ marginTop:32, padding:'16px', background:'rgba(22,163,74,0.06)', border:'1px solid rgba(22,163,74,0.15)', borderRadius:12 }}>
            <p style={{ fontSize:11, fontWeight:800, color:'#16A34A', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:8 }}>
              🔒 Zero Email Storage
            </p>
            <p style={{ fontSize:12, color:'#64748B', lineHeight:1.5, margin:0 }}>
              We never read, store, or transmit your email content. Ever.
            </p>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="docs-main" style={{ minHeight:800 }}>
        <div key={activeTab} className="animate-in">
          <div style={{ marginBottom:40 }}>
            <h1 style={{ fontSize:42, fontWeight:900, color:'var(--text-main)', letterSpacing:'-0.04em', lineHeight:1.1, marginBottom:16 }}>
              {DOCS_CONTENT[activeTab].title}
            </h1>
            <div style={{ width:56, height:5, background:'#4285F4', borderRadius:9999 }}></div>
          </div>
          {DOCS_CONTENT[activeTab].content}
        </div>

        <div style={{ display:'flex', justifyContent:'space-between', borderTop:'1px solid var(--border)', paddingTop:40, marginTop:64 }}>
          <button onClick={handlePrev} style={{ display:'flex', alignItems:'center', gap:8, color:'var(--text-secondary)', background:'none', border:'none', cursor:'pointer', fontWeight:700, fontSize:14 }}>
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ transform:'rotate(180deg)' }}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            Previous
          </button>
          <button onClick={handleNext} style={{ display:'flex', alignItems:'center', gap:8, color:'#4285F4', background:'none', border:'none', cursor:'pointer', fontWeight:700, fontSize:14 }}>
            Next
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          </button>
        </div>
      </div>

      {/* Right TOC */}
      <aside className="docs-toc">
        <div style={{ position:'sticky', top:96, borderLeft:'2px solid var(--border)', paddingLeft:24 }}>
          <p style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.2em', color:'var(--text-main)', marginBottom:24, opacity:0.4 }}>
            On this page
          </p>
          <ul style={{ listStyle:'none', padding:0, margin:0, display:'flex', flexDirection:'column', gap:16 }}>
            {DOCS_CONTENT[activeTab].subsections.map((sub) => (
              <li key={sub.id}>
                <a href={`#${sub.id}`} style={{ display:'flex', alignItems:'center', gap:10, fontSize:13, fontWeight:600, color:'var(--text-secondary)', textDecoration:'none', transition:'color 0.2s' }}
                  onMouseEnter={e => (e.currentTarget.style.color='#4285F4')}
                  onMouseLeave={e => (e.currentTarget.style.color='var(--text-secondary)')}>
                  <span style={{ width:6, height:6, borderRadius:'50%', background:'var(--border)', flexShrink:0 }}></span>
                  {sub.title}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </div>
  );
}

export default function Docs() {
  return (
    <main style={{ minHeight:'100vh', background:'var(--background)' }}>
      <Navbar />
      <Suspense fallback={<div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', color:'#4285F4', fontWeight:700 }}>Loading Documentation...</div>}>
        <DocsContent />
      </Suspense>
      <Footer />

      <style>{`
        @media (min-width: 1024px) {
          .docs-layout {
            grid-template-columns: 220px 1fr 200px !important;
          }
          .docs-sidebar { display: block; }
          .docs-toc { display: block; }
        }
        .docs-toc { display: none; }
      `}</style>
    </main>
  );
}
