'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { EXTENSION_DOWNLOAD_URL } from '@/lib/constants';

/* ── Design tokens matching homepage ── */
const ACCENT = '#007A5E';
const ACCENT_BG = '#F0FDF4';
const ACCENT_BORDER = '#DCFCE7';

const docStyles = `
  @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;700&display=swap');
  .docs-page * { font-family: 'Plus+Jakarta+Sans', system-ui, sans-serif; }
  .docs-sidebar-btn:hover { background: ${ACCENT_BG} !important; color: ${ACCENT} !important; }
  .docs-toc a:hover { color: ${ACCENT} !important; }
  .doc-step-item { transition: background 0.2s; }
  .doc-step-item:hover { background: ${ACCENT_BG} !important; }
  @media (min-width: 1024px) {
    .docs-layout { grid-template-columns: 220px 1fr 200px !important; }
    .docs-sidebar { display: block !important; }
    .docs-toc { display: block !important; }
  }
  .docs-toc { display: none; }
  .animate-in { animation: fadeInUp 0.35s ease both; }
  @keyframes fadeInUp { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
`;

const S = {
  h3: { fontSize: 22, fontWeight: 800, color: '#0F172A', marginBottom: 12 } as React.CSSProperties,
  p:  { color: '#64748B', lineHeight: 1.75, marginBottom: 16 } as React.CSSProperties,
  callout: (color: string) => ({
    background: `${color}0d`, borderLeft: `4px solid ${color}`,
    padding: '16px 20px', borderRadius: '0 12px 12px 0', marginBottom: 16,
  } as React.CSSProperties),
  tag: (color: string) => ({
    display: 'inline-block', background: `${color}15`, color, fontSize: 11,
    fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.1em',
    padding: '3px 10px', borderRadius: 9999, marginBottom: 8,
  }),
  li: { display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 14, color: '#64748B', marginBottom: 10 } as React.CSSProperties,
  check: { color: ACCENT, fontWeight: 700, flexShrink: 0, marginTop: 2 } as React.CSSProperties,
  cross: { color: '#DC2626', fontWeight: 700, flexShrink: 0, marginTop: 2 } as React.CSSProperties,
  code: { background: '#F1F5F9', color: '#0F172A', fontFamily: 'JetBrains Mono, monospace', fontSize: 12, padding: '2px 8px', borderRadius: 6 } as React.CSSProperties,
};

const DOCS_CONTENT = {
  introduction: {
    title: 'Introduction to Attest',
    subsections: [
      { id:'why-attest',    title:'Why Do We Need This?' },
      { id:'how-it-works',  title:'How It Works' },
      { id:'benefits',      title:'Key Benefits' },
    ],
    content: (
      <div>
        <p style={{ ...S.p, fontSize:17 }}>
          Attest (HVEL — Human Verified Email Layer) is a smart browser extension and verification system. 
          It proves that a real, physical human actually clicked the "Send" button on an email, rather than a malicious script, 
          an automated bot, or an AI. Best of all, it does this without ever reading, storing, or sending your email content anywhere.
        </p>

        <section id="why-attest" style={{ scrollMarginTop:96, marginBottom:40 }}>
          <h3 style={S.h3}>Why Do We Need This?</h3>
          <p style={S.p}>
            With modern AI, bots can write and send emails that look exactly like they were written by humans. 
            Additionally, hackers use session hijacking to take control of active browser sessions. Once they do, they can send 
            emails directly from your real account without you knowing. 
          </p>
          <p style={S.p}>
            Standard security (like passwords and 2FA) only protects your <em>login</em>. Once a session is hijacked, those protections 
            don't help. Attest is different: it protects the actual <strong>send action</strong> itself.
          </p>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))', gap:16, marginTop:20 }}>
            <div style={{ padding:20, background:'rgba(66,133,244,0.05)', border:'1px solid rgba(66,133,244,0.12)', borderRadius:14 }}>
              <div style={S.tag('#4285F4')}>The Hidden Threat</div>
              <p style={{ ...S.p, marginBottom:0, fontSize:14 }}>
                If a hacker steals your browser cookies, they can send unauthorized emails from your account. Spam filters won't catch it because it's coming from your real address.
              </p>
            </div>
            <div style={{ padding:20, background:'rgba(52,168,83,0.05)', border:'1px solid rgba(52,168,83,0.12)', borderRadius:14 }}>
              <div style={S.tag('#34A853')}>The Attest Shield</div>
              <p style={{ ...S.p, marginBottom:0, fontSize:14 }}>
                Attest verifies that a physical human is interacting with the screen when the email is sent. If there's no human behavior, the email doesn't go out.
              </p>
            </div>
          </div>
        </section>

        <section id="how-it-works" style={{ scrollMarginTop:96, marginBottom:40 }}>
          <h3 style={S.h3}>How It Works</h3>
          <p style={S.p}>
            The Chrome extension runs quietly in your browser. The moment you click the "Send" button in Gmail, Attest temporarily pauses the action to perform a split-second check.
          </p>
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            {[
              ['01','Intent Captured','When you press Send, Attest intercepts the click event. Your email stays safely in your browser.'],
              ['02','Frictionless Check','The extension analyzes mouse movement dynamics (speed, curvature, and timing) to distinguish human physical behavior from automated bot activity.'],
              ['03','Secure Hash Logged','A SHA-256 cryptographic fingerprint of the email metadata is sent to our verification server. No email body content is ever shared.'],
              ['04','Trust Badge Appended','A verified stamp is added to the footer of the email with a link to its verification record, and Gmail sends it out normally.'],
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

        <section id="benefits" style={{ scrollMarginTop:96 }}>
          <h3 style={S.h3}>Key Benefits</h3>
          <p style={S.p}>
            Traditional security works at the front door. Attest stays with you to make sure your identity is verified at the exact moment of transaction.
          </p>
          <div style={S.callout('#4285F4')}>
            <strong style={{ color:'#1D4ED8' }}>Zero Friction:</strong>{' '}
            <span style={{ color:'#475569', fontSize:14 }}>
              You don't need to copy 6-digit codes or solve puzzles. The mouse dynamics engine works silently in the background. Write and send your email just like you always do.
            </span>
          </div>
        </section>
      </div>
    ),
  },

  privacy: {
    title: 'Privacy & Zero-Risk Policy',
    subsections: [
      { id:'no-email-read',  title:'We Never Read Your Emails' },
      { id:'what-we-store',  title:'What We Store' },
      { id:'what-not-stored',title:'What We Never Store' },
      { id:'legality',       title:'Security & Compliance' },
    ],
    content: (
      <div>
        <p style={{ ...S.p, fontSize:17 }}>
          Privacy is the core foundation of Attest. Our architecture is deliberately designed so that it is 
          <strong> technically impossible </strong> for us to read your emails, even if we wanted to.
        </p>

        <section id="no-email-read" style={{ scrollMarginTop:96, marginBottom:40 }}>
          <h3 style={S.h3}>We Never Read Your Emails</h3>
          <div style={{ ...S.callout('#DC2626'), borderLeftColor:'#DC2626' }}>
            <strong style={{ color:'#DC2626', display:'block', marginBottom:6 }}>
              🚫 Zero Email Access — Guaranteed
            </strong>
            <p style={{ ...S.p, marginBottom:0, fontSize:14 }}>
              The Attest extension does <strong>not</strong> request read permissions for your inbox. 
              It cannot read your email drafts, see your inbox, or access messages you receive. 
              It only interacts with the Send button event to trigger the human verification process.
            </p>
          </div>
          <p style={S.p}>
            You can verify this by checking the extension’s permissions in <code style={S.code}>manifest.json</code>. 
            There are no Gmail API scopes, no OAuth email access requests, and no server-side ingestion of your messages.
          </p>
        </section>

        <section id="what-we-store" style={{ scrollMarginTop:96, marginBottom:40 }}>
          <h3 style={S.h3}>What We Store</h3>
          <p style={S.p}>
            When a verification is successfully completed, we log only the following metadata to our encrypted database:
          </p>
          <div style={{ background:'rgba(22,163,74,0.06)', border:'1px solid rgba(22,163,74,0.15)', borderRadius:14, padding:24, marginBottom:16 }}>
            {[
              ['SHA-256 hash of the send-action event','A one-way cryptographic signature. It is physically impossible to reverse-engineer this to read the original email text.'],
              ['Verification timestamp','The exact date and time the email was verified.'],
              ['Sender\'s registered name','Used strictly to show your verified name on the badge to recipients.'],
              ['Verification status','Whether the action was verified as a physical human or flagged as automated.'],
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
        </section>

        <section id="what-not-stored" style={{ scrollMarginTop:96, marginBottom:40 }}>
          <h3 style={S.h3}>What We Never Store</h3>
          <div style={{ background:'rgba(220,38,38,0.05)', border:'1px solid rgba(220,38,38,0.12)', borderRadius:14, padding:24 }}>
            {[
              'Your Gmail password, Google credentials, or session cookies',
              'The body content or subject line of your email',
              'Recipient email addresses (To, CC, BCC)',
              'Email attachments or filenames',
              'Biometric data (our mouse dynamics analysis is mathematical, not biometric-identifying)',
              'Your browsing history or other tabs',
            ].map((item) => (
              <div key={item} style={S.li}>
                <span style={S.cross}>✕</span>
                <span>{item}</span>
              </div>
            ))}
          </div>
        </section>

        <section id="legality" style={{ scrollMarginTop:96 }}>
          <h3 style={S.h3}>Security &amp; Compliance</h3>
          <p style={S.p}>
            Since Attest does not read, store, or process personal data from your emails, it is completely compatible with global privacy laws, including GDPR and CCPA. It operates as a local client assistant rather than a data interceptor.
          </p>
        </section>
      </div>
    ),
  },

  installation: {
    title: 'Installation Guide',
    subsections: [
      { id:'requirements',  title:'Requirements' },
      { id:'extension',     title:'Installing the Extension' },
      { id:'setup',         title:'Account Setup' },
    ],
    content: (
      <div>
        <p style={{ ...S.p, fontSize:17 }}>
          Set up Attest in under 3 minutes.
        </p>

        <section id="requirements" style={{ scrollMarginTop:96, marginBottom:40 }}>
          <h3 style={S.h3}>Requirements</h3>
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {[
              'Google Chrome (or any Chromium browser like Brave, Edge, or Opera)',
              'A standard Gmail or Google Workspace account',
              'An Attest user account'
            ].map((r) => (
              <div key={r} style={S.li}>
                <span style={S.check}>✓</span><span>{r}</span>
              </div>
            ))}
          </div>
        </section>

        <section id="extension" style={{ scrollMarginTop:96, marginBottom:40 }}>
          <h3 style={S.h3}>Installing the Extension</h3>
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            {[
              ['1','Install from Chrome Web Store','Visit the <a href="' + EXTENSION_DOWNLOAD_URL + '" style="color:#007A5E;text-decoration:underline;font-weight:600;" target="_blank">HVEL Chrome Web Store page</a> and click "Add to Chrome".'],
              ['2','Pin the Extension Icon','Click the puzzle piece icon on your Chrome toolbar and pin HVEL so you can see your status.'],
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

        <section id="setup" style={{ scrollMarginTop:96 }}>
          <h3 style={S.h3}>Account Setup</h3>
          <p style={S.p}>
            Once the extension is loaded, click on the Attest toolbar icon. Sign in or register with your name. 
            This name will be displayed on the green badge to tell recipients who verified the email.
          </p>
        </section>
      </div>
    ),
  },

  quickstart: {
    title: 'Quickstart & Daily Use',
    subsections: [
      { id:'daily-use',    title:'Daily Use' },
      { id:'verification', title:'Verifying Received Emails' },
      { id:'faq',          title:'FAQ' },
    ],
    content: (
      <div>
        <p style={{ ...S.p, fontSize:17 }}>
          Attest is designed to be invisible. You don't have to change the way you use email.
        </p>

        <section id="daily-use" style={{ scrollMarginTop:96, marginBottom:40 }}>
          <h3 style={S.h3}>Daily Use</h3>
          <p style={S.p}>
            Open Gmail and compose your email as normal. When you click the <strong>Send</strong> button:
          </p>
          <ol style={{ paddingLeft: 20, color: '#64748B', lineHeight: 1.75, marginBottom: 20 }}>
            <li style={{ marginBottom: 8 }}>The Send button briefly changes to <span style={{ color: ACCENT, fontWeight: 700 }}>"Verifying..."</span> with a small spinner.</li>
            <li style={{ marginBottom: 8 }}>Our background engine checks your mouse dynamics to verify you're a real human. This takes less than a second.</li>
            <li style={{ marginBottom: 8 }}>A beautiful, green "Human Verified" badge is automatically inserted at the bottom of your email.</li>
            <li style={{ marginBottom: 8 }}>The email is sent out.</li>
          </ol>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))', gap:12, marginTop:16 }}>
            {[
              { icon:'✍️', label:'Compose email normally' },
              { icon:'📤', label:'Click Send in Gmail' },
              { icon:'🧠', label:'Silent human check' },
              { icon:'🛡️', label:'Badge automatically added' },
              { icon:'✅', label:'Email sent & logged' },
            ].map((s) => (
              <div key={s.label} style={{ padding:'16px 14px', background:'#F8FAFC', border:'1px solid #E2E8F0', borderRadius:12, textAlign:'center' }}>
                <div style={{ fontSize:24, marginBottom:8 }}>{s.icon}</div>
                <p style={{ fontSize:13, color:'#475569', fontWeight:600, margin:0 }}>{s.label}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="verification" style={{ scrollMarginTop:96, marginBottom:40 }}>
          <h3 style={S.h3}>Verifying Received Emails</h3>
          <p style={S.p}>
            When someone receives an email you sent with Attest, they will see a clean green badge. 
            They can click the <strong>"Trust Record"</strong> link directly in the badge to view the cryptographic proof on our verification portal.
          </p>
          <p style={S.p}>
            Alternatively, anyone can copy the SHA-256 fingerprint from the badge and paste it into the 
            <a href="/verify" style={{ color:'#2563EB', fontWeight:600 }}> Verify page</a> on our website to verify the timestamp and sender identity.
          </p>
        </section>

        <section id="faq" style={{ scrollMarginTop:96 }}>
          <h3 style={S.h3}>Frequently Asked Questions</h3>
          <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
            {[
              ['Do I need to type in a 6-digit authenticator code every time?','No! The old manual TOTP step has been completely replaced with a frictionless behavior check. You write and send emails exactly as you did before.'],
              ['What if the verification server is down or I am offline?','Attest will fail open to ensure you never lose an email. If the server is offline or cannot be reached, the extension stamps the email with a neutral "Unverified Sender (Offline)" badge and sends it anyway.'],
              ['Does Attest read my email content?','Never. The extension only calculates a cryptographic fingerprint (SHA-256 hash) of the message locally in your browser. We never see or store the contents of your messages.'],
              ['Does it work with Google Workspace accounts?','Yes. Attest works seamlessly on standard consumer Gmail accounts and corporate Google Workspace (G Suite) accounts.'],
              ['Is it free?','Yes, the basic plan is free forever. For high-volume teams and advanced options, check out our Pricing page.'],
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
    <div style={{ maxWidth: 1280, margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr', gap: 48, padding: '48px 24px' }} className="docs-layout">

      {/* ── Sidebar ── */}
      <aside className="docs-sidebar" style={{ display: 'none' }}>
        <div style={{ position: 'sticky', top: 96 }}>
          <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.2em', color: '#94A3B8', marginBottom: 16 }}>Documentation</p>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
            {DOC_KEYS.map(tab => (
              <li key={tab}>
                <button onClick={() => changeTab(tab)} className="docs-sidebar-btn" style={{ width: '100%', textAlign: 'left', padding: '10px 14px', borderRadius: 10, border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: activeTab === tab ? 800 : 600, background: activeTab === tab ? ACCENT_BG : 'transparent', color: activeTab === tab ? ACCENT : '#64748B', transition: 'all 0.2s' }}>
                  {tabLabels[tab]}
                </button>
              </li>
            ))}
          </ul>
          <div style={{ marginTop: 28, padding: 16, background: ACCENT_BG, border: `1px solid ${ACCENT_BORDER}`, borderRadius: 14 }}>
            <p style={{ fontSize: 11, fontWeight: 800, color: ACCENT, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>🔒 Zero Email Storage</p>
            <p style={{ fontSize: 12, color: '#64748B', lineHeight: 1.5, margin: 0 }}>We never read, store, or transmit your email content. Ever.</p>
          </div>
        </div>
      </aside>

      {/* ── Main content ── */}
      <div style={{ minHeight: 800 }}>
        <div key={activeTab} className="animate-in">
          <div style={{ marginBottom: 40 }}>
            <h1 style={{ fontSize: 40, fontWeight: 950, color: '#0F172A', letterSpacing: '-0.04em', lineHeight: 1.1, marginBottom: 14 }}>
              {DOCS_CONTENT[activeTab].title}
            </h1>
            <div style={{ width: 56, height: 5, background: `linear-gradient(90deg, ${ACCENT}, #059669)`, borderRadius: 9999 }} />
          </div>
          {DOCS_CONTENT[activeTab].content}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #E2E8F0', paddingTop: 40, marginTop: 64 }}>
          <button onClick={handlePrev} style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#64748B', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 14 }}>
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ transform: 'rotate(180deg)' }}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            Previous
          </button>
          <button onClick={handleNext} style={{ display: 'flex', alignItems: 'center', gap: 8, color: ACCENT, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 14 }}>
            Next
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          </button>
        </div>
      </div>

      {/* ── Right TOC ── */}
      <aside className="docs-toc" style={{ display: 'none' }}>
        <div style={{ position: 'sticky', top: 96, borderLeft: `2px solid ${ACCENT_BORDER}`, paddingLeft: 24 }}>
          <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.2em', color: '#94A3B8', marginBottom: 24 }}>On this page</p>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
            {DOCS_CONTENT[activeTab].subsections.map(sub => (
              <li key={sub.id}>
                <a href={`#${sub.id}`} className="docs-toc" style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, fontWeight: 600, color: '#64748B', textDecoration: 'none', transition: 'color 0.2s' }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: ACCENT_BORDER, flexShrink: 0 }} />
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
    <main className="docs-page" style={{ minHeight: '100vh', background: '#ffffff' }}>
      <style>{docStyles}</style>
      <Navbar />

      {/* ── Hero ── */}
      <section style={{ padding: '96px 24px 56px', background: 'linear-gradient(180deg, #F8FFF8 0%, #ffffff 100%)', borderBottom: '1px solid #F1F5F9' }}>
        <div style={{ maxWidth: 900, margin: '0 auto', textAlign: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
            <div style={{ background: ACCENT_BG, border: `1px solid ${ACCENT_BORDER}`, color: ACCENT, display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 18px', borderRadius: 9999, fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" /></svg>
              Documentation
            </div>
          </div>
          <h1 style={{ fontSize: 'clamp(32px, 5vw, 48px)', fontWeight: 950, color: '#0F172A', letterSpacing: '-0.04em', lineHeight: 1.1, marginBottom: 14 }}>
            Attest <span style={{ color: ACCENT }}>Knowledge Base</span>
          </h1>
          <p style={{ fontSize: 16, color: '#64748B', fontWeight: 500, maxWidth: 520, margin: '0 auto' }}>
            Everything you need to understand, install, and use the Attest human verification protocol.
          </p>
        </div>
      </section>

      <Suspense fallback={<div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: ACCENT, fontWeight: 700 }}>Loading Documentation…</div>}>
        <DocsContent />
      </Suspense>
      <Footer />
    </main>
  );
}
