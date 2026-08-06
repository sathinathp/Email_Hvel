'use client';

import Link from 'next/link';

const col: React.CSSProperties = { display:'flex', flexDirection:'column', gap:0 };
const heading: React.CSSProperties = {
  fontSize:11, fontWeight:700, textTransform:'uppercase',
  letterSpacing:'0.14em', color:'white', marginBottom:18,
};

function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      style={{ fontSize:14, color:'#94A3B8', fontWeight:500, textDecoration:'none', padding:'5px 0', display:'block', transition:'color 0.15s' }}
      onMouseEnter={e => (e.currentTarget.style.color = 'white')}
      onMouseLeave={e => (e.currentTarget.style.color = '#94A3B8')}
    >
      {children}
    </Link>
  );
}

export default function Footer() {
  return (
    <footer style={{ background:'#0A0F1E', borderTop:'1px solid rgba(255,255,255,0.06)', color:'white' }}>

      {/* ── Main grid ── */}
      <div style={{ maxWidth:1200, margin:'0 auto', padding:'56px 24px 40px' }}>
        <div className="footer-grid">

          {/* Brand column */}
          <div style={{ ...col, gap:16 }} className="footer-brand">
            <Link href="/" style={{ display:'inline-flex', alignItems:'center', gap:10, textDecoration:'none' }}>
              <img src="/icon-symbol.png" alt="Attest" style={{ width:32, height:32, objectFit:'contain', flexShrink:0 }} />
              <span style={{ fontSize:20, fontWeight:900, letterSpacing:'-0.04em', color:'white' }}>Attest</span>
            </Link>

            <p style={{ fontSize:14, color:'#64748B', lineHeight:1.7, maxWidth:280, margin:0 }}>
              The easiest way to check if a human or AI sent the email — proving a real human
              sent every message, without ever reading your emails.
            </p>

            {/* Trust facts */}
            <div style={{ display:'flex', flexDirection:'column', gap:7, marginTop:4 }}>
              {[
                '🚫 Zero email content stored',
                '🔐 No Gmail ID collected',
                '✅ GDPR & CCPA compliant',
                '🌍 Legal in all countries',
              ].map((fact) => (
                <span key={fact} style={{ fontSize:12, color:'#475569', fontWeight:600 }}>{fact}</span>
              ))}
            </div>

            {/* Social */}
            <div style={{ display:'flex', gap:10, marginTop:4 }}>
              <a href="https://discord.gg/nVAyAzYe8" aria-label="Discord" target="_blank" rel="noopener noreferrer"
                style={{ width:34, height:34, borderRadius:'50%', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.08)', display:'flex', alignItems:'center', justifyContent:'center', color:'#64748B', textDecoration:'none', transition:'all 0.2s' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background='rgba(255,255,255,0.1)'; (e.currentTarget as HTMLElement).style.color='white'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background='rgba(255,255,255,0.05)'; (e.currentTarget as HTMLElement).style.color='#64748B'; }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.094 13.094 0 0 1-1.873-.894.077.077 0 0 1-.008-.128c.126-.093.252-.19.372-.287a.075.075 0 0 1 .077-.011c3.92 1.793 8.18 1.793 12.061 0a.073.073 0 0 1 .078.009c.12.099.246.195.373.289a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.894.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.156-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.156 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.156-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.156 2.418z" />
                </svg>
              </a>
            </div>
          </div>

          {/* Protocol column */}
          <div style={col}>
            <p style={heading}>Verification</p>
            <FooterLink href="/webauthn">WebAuthn / FIDO2</FooterLink>
            <FooterLink href="/totp">Frictionless Verification</FooterLink>
            <FooterLink href="/gmail-hook">Gmail Send Hook</FooterLink>
            <FooterLink href="/audit-engine">Audit Engine</FooterLink>
            <FooterLink href="/verify">Verify a Hash</FooterLink>
          </div>

          {/* Resources column */}
          <div style={col}>
            <p style={heading}>Resources</p>
            <FooterLink href="/docs">Documentation</FooterLink>
            <FooterLink href="/whitepaper">Security Whitepaper</FooterLink>
            <FooterLink href="/docs?tab=installation">Installation Guide</FooterLink>
            <FooterLink href="/pricing">Pricing &amp; Plans</FooterLink>
            <FooterLink href="/verify">Verify Portal</FooterLink>
          </div>

          {/* Compliance column */}
          <div style={col}>
            <p style={heading}>Compliance</p>
            <FooterLink href="/privacy">Privacy Policy</FooterLink>
            <FooterLink href="/terms">Terms of Service</FooterLink>
            <FooterLink href="/soc2">
              SOC 2 Compliance
              <span style={{ position: 'absolute', width: '1px', height: '1px', padding: '0', margin: '-1px', overflow: 'hidden', clip: 'rect(0,0,0,0)', border: '0' }}>
                Soc2
              </span>
            </FooterLink>
            <FooterLink href="/docs?tab=privacy">Zero-Risk Policy</FooterLink>
          </div>
        </div>
      </div>

      {/* ── Bottom bar — tight, no extra space ── */}
      <div style={{ borderTop:'1px solid rgba(255,255,255,0.06)', padding:'14px 24px' }}>
        <div style={{ maxWidth:1200, margin:'0 auto', display:'flex', flexWrap:'wrap', alignItems:'center', justifyContent:'space-between', gap:10 }}>
          <p style={{ fontSize:12, fontWeight:700, color:'#334155', textTransform:'uppercase', letterSpacing:'0.1em', margin:0 }}>
            © 2026 Attest Security Ltd.
          </p>
          <div style={{ display:'flex', alignItems:'center', gap:20, flexWrap:'wrap' }}>
            <span style={{ fontSize:12, fontWeight:700, color:'#334155', textTransform:'uppercase', letterSpacing:'0.1em', display:'flex', alignItems:'center', gap:6 }}>
              <span className="animate-pulse" style={{ width:7, height:7, borderRadius:'50%', background:'#22C55E', display:'inline-block' }}></span>
              Status: Operational
            </span>
            <span style={{ fontSize:12, fontWeight:700, color:'#334155', textTransform:'uppercase', letterSpacing:'0.1em' }}>
              Version 2.1.0
            </span>
          </div>
        </div>
      </div>

      <style>{`
        .footer-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 40px 32px;
        }
        .footer-brand { grid-column: span 2; }
        @media (max-width: 480px) {
          .footer-grid {
            grid-template-columns: 1fr;
          }
          .footer-brand { grid-column: span 1; }
        }
        @media (min-width: 768px) {
          .footer-grid {
            grid-template-columns: 2fr 1fr 1fr 1fr;
          }
          .footer-brand { grid-column: span 1; }
        }
      `}</style>
    </footer>
  );
}
