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
              <div style={{ width:36, height:36, borderRadius:10, background:'linear-gradient(135deg,#007A5E,#005A44)', display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontWeight:900, fontSize:16, boxShadow:'0 4px 12px rgba(0,122,94,0.4)', flexShrink:0 }}>H</div>
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
              {[
                { icon:'𝕏', label:'Twitter', href:'#' },
                { icon:'in', label:'LinkedIn', href:'#' },
                { icon:'⌥', label:'GitHub', href:'#' },
              ].map((s) => (
                <a key={s.label} href={s.href} aria-label={s.label}
                  style={{ width:34, height:34, borderRadius:'50%', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.08)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:700, color:'#64748B', textDecoration:'none', transition:'all 0.2s' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background='rgba(255,255,255,0.1)'; (e.currentTarget as HTMLElement).style.color='white'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background='rgba(255,255,255,0.05)'; (e.currentTarget as HTMLElement).style.color='#64748B'; }}>
                  {s.icon}
                </a>
              ))}
            </div>
          </div>

          {/* Protocol column */}
          <div style={col}>
            <p style={heading}>Verification</p>
            <FooterLink href="/webauthn">WebAuthn / FIDO2</FooterLink>
            <FooterLink href="/totp">TOTP Verification</FooterLink>
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
            <FooterLink href="/soc2">SOC 2 Compliance</FooterLink>
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
