import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import Link from 'next/link';

export default function GmailHook() {
  return (
    <main style={{ minHeight:'100vh', background:'#fff' }}>
      <Navbar />
      <section style={{ padding:'80px 24px 48px', background:'linear-gradient(180deg,#F8FAFC 0%,#fff 100%)', borderBottom:'1px solid #F1F5F9' }}>
        <div style={{ maxWidth:800, margin:'0 auto' }}>
          <Link href="/docs?tab=introduction" style={{ fontSize:13, color:'#2563EB', fontWeight:600, textDecoration:'none', display:'inline-flex', alignItems:'center', gap:6, marginBottom:24 }}>
            ← Back to Docs
          </Link>
          <div style={{ display:'inline-flex', alignItems:'center', gap:8, background:'#FFF7ED', border:'1px solid #FED7AA', borderRadius:9999, padding:'4px 14px', fontSize:12, fontWeight:700, color:'#EA580C', marginBottom:20 }}>
            🔗 Native Gmail Integration
          </div>
          <h1 style={{ fontSize:'clamp(32px,5vw,52px)', fontWeight:900, color:'#0F172A', letterSpacing:'-0.04em', lineHeight:1.1, marginBottom:16 }}>
            Native Gmail Send Hook
          </h1>
          <p style={{ fontSize:17, color:'#64748B', lineHeight:1.7, maxWidth:640 }}>
            The Attest extension hooks directly into Gmail&apos;s send pipeline at the DOM level —
            intercepting the send action before any data leaves your browser, without reading a
            single character of your email.
          </p>
        </div>
      </section>

      <section style={{ padding:'64px 24px', maxWidth:800, margin:'0 auto' }}>
        <div style={{ display:'flex', flexDirection:'column', gap:48 }}>

          <div>
            <h2 style={{ fontSize:24, fontWeight:800, color:'#0F172A', marginBottom:12 }}>How the Hook Works</h2>
            <p style={{ color:'#64748B', lineHeight:1.75, marginBottom:16 }}>
              When the extension loads on <code style={{ background:'#F1F5F9', padding:'2px 6px', borderRadius:4, fontSize:13 }}>mail.google.com</code>, it attaches a
              click event listener to the Gmail Send button using a MutationObserver. This is a
              standard browser extension technique — the same approach used by Grammarly, Boomerang,
              and other Gmail extensions.
            </p>
            <p style={{ color:'#64748B', lineHeight:1.75 }}>
              When the Send button is clicked, the extension calls <code style={{ background:'#F1F5F9', padding:'2px 6px', borderRadius:4, fontSize:13 }}>event.preventDefault()</code> to
              pause the action, shows the verification overlay, and only calls the original send
              handler after successful verification.
            </p>
          </div>

          <div>
            <h2 style={{ fontSize:24, fontWeight:800, color:'#0F172A', marginBottom:16 }}>What the Extension Can and Cannot See</h2>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
              <div style={{ padding:20, background:'rgba(22,163,74,0.06)', border:'1px solid rgba(22,163,74,0.15)', borderRadius:14 }}>
                <p style={{ fontWeight:800, color:'#15803D', fontSize:13, marginBottom:12, textTransform:'uppercase', letterSpacing:'0.08em' }}>✓ Can Detect</p>
                {['Send button click event','That a send action was initiated','Current tab URL (mail.google.com)'].map((i) => (
                  <p key={i} style={{ fontSize:13, color:'#475569', marginBottom:6, display:'flex', gap:8 }}>
                    <span style={{ color:'#16A34A', fontWeight:700 }}>✓</span>{i}
                  </p>
                ))}
              </div>
              <div style={{ padding:20, background:'rgba(220,38,38,0.05)', border:'1px solid rgba(220,38,38,0.12)', borderRadius:14 }}>
                <p style={{ fontWeight:800, color:'#DC2626', fontSize:13, marginBottom:12, textTransform:'uppercase', letterSpacing:'0.08em' }}>✕ Cannot Access</p>
                {['Email subject or body','Recipient addresses','Attachments or files','Gmail account ID','Any Google API data'].map((i) => (
                  <p key={i} style={{ fontSize:13, color:'#475569', marginBottom:6, display:'flex', gap:8 }}>
                    <span style={{ color:'#DC2626', fontWeight:700 }}>✕</span>{i}
                  </p>
                ))}
              </div>
            </div>
          </div>

          <div>
            <h2 style={{ fontSize:24, fontWeight:800, color:'#0F172A', marginBottom:12 }}>Extension Permissions</h2>
            <p style={{ color:'#64748B', lineHeight:1.75, marginBottom:16 }}>
              You can verify this yourself. Open <code style={{ background:'#F1F5F9', padding:'2px 6px', borderRadius:4, fontSize:13 }}>chrome://extensions</code>, find
              Attest, and click &quot;Details&quot;. The permissions list contains only:
            </p>
            <div style={{ background:'#0F172A', borderRadius:12, padding:24, fontFamily:'monospace', fontSize:13, color:'#94A3B8' }}>
              <p style={{ color:'#60A5FA', marginBottom:8 }}>// manifest.json — permissions</p>
              <p style={{ margin:0 }}>{'"permissions": ['}</p>
              <p style={{ margin:'4px 0 4px 20px', color:'#86EFAC' }}>&quot;activeTab&quot;,</p>
              <p style={{ margin:'0 0 4px 20px', color:'#86EFAC' }}>&quot;storage&quot;</p>
              <p style={{ margin:0 }}>]</p>
              <p style={{ marginTop:12, color:'#475569' }}>// No gmail.readonly. No Gmail API. No OAuth scopes.</p>
            </div>
          </div>

          <div>
            <h2 style={{ fontSize:24, fontWeight:800, color:'#0F172A', marginBottom:12 }}>Compatibility</h2>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))', gap:12 }}>
              {[
                { label:'Gmail Web', status:'Full Support' },
                { label:'Google Workspace', status:'Full Support' },
                { label:'Chrome 110+', status:'Full Support' },
                { label:'Edge (Chromium)', status:'Full Support' },
                { label:'Brave Browser', status:'Full Support' },
                { label:'Firefox', status:'Coming Soon' },
              ].map((c) => (
                <div key={c.label} style={{ padding:'12px 16px', background:'#F8FAFC', border:'1px solid #E2E8F0', borderRadius:10, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <span style={{ fontSize:13, fontWeight:600, color:'#0F172A' }}>{c.label}</span>
                  <span style={{ fontSize:11, fontWeight:700, color: c.status==='Full Support'?'#16A34A':'#EA580C', background: c.status==='Full Support'?'rgba(22,163,74,0.08)':'rgba(234,88,12,0.08)', padding:'2px 8px', borderRadius:9999 }}>
                    {c.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
      <Footer />
    </main>
  );
}
