'use client';

import { useState, useEffect } from 'react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'https://api.attest.com';

const sharedStyles = `
  @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;700&display=swap');
  .verify-page * { font-family: 'Plus Jakarta Sans', system-ui, sans-serif; }
  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes slideUp { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform:translateY(0); } }
  @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
  @keyframes orbFloat { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-18px)} }
  textarea::placeholder { color:#94A3B8; }
  textarea::-webkit-scrollbar { width:4px; }
  textarea::-webkit-scrollbar-thumb { background:rgba(0,122,94,0.2); border-radius:2px; }
  .verify-input:focus { border-color:#007A5E !important; box-shadow:0 0 0 3px rgba(0,122,94,0.12) !important; background:#fff !important; }
`;

export default function Verify() {
  const [hash, setHash] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const handleVerify = async () => {
    if (!hash.trim()) return;
    setLoading(true); setResult(null); setError(null);
    try {
      const response = await fetch(`${BACKEND_URL}/api/verify-hash`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ hash: hash.trim() }) });
      const data = await response.json();
      if (data.success) setResult(data.data);
      else setError(data.message || 'Verification failed. Please check the hash.');
    } catch { setError('Network error. Ensure the HVEL backend is running.'); }
    finally { setLoading(false); }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleVerify(); };
  if (!mounted) return null;

  return (
    <main className="verify-page" style={{ minHeight: '100vh', background: '#ffffff', display: 'flex', flexDirection: 'column' }}>
      <style>{sharedStyles}</style>
      <Navbar />

      {/* ── Hero ── */}
      <section style={{ background: 'linear-gradient(180deg, #F8FFF8 0%, #ffffff 100%)', padding: '80px 24px 56px', borderBottom: '1px solid #F1F5F9' }}>
        <div style={{ maxWidth: 720, margin: '0 auto', textAlign: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
            <div style={{ background: '#E6FDF0', border: '1px solid #DCFCE7', color: '#007A5E', display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 18px', borderRadius: 9999, fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#007A5E', display: 'inline-block', animation: 'pulse 2s infinite' }} />
              Attest Verification Engine
            </div>
          </div>
          <h1 style={{ fontSize: 'clamp(36px, 5vw, 56px)', fontWeight: 950, color: '#0F172A', letterSpacing: '-0.04em', lineHeight: 1.1, marginBottom: 16 }}>
            Verify a <span style={{ color: '#007A5E' }}>Human Sender</span>
          </h1>
          <p style={{ fontSize: 17, color: '#64748B', lineHeight: 1.7, maxWidth: 500, margin: '0 auto', fontWeight: 500 }}>
            Paste a SHA-256 hash from an email header to cryptographically confirm a real human sent that message.
          </p>
        </div>
      </section>

      {/* ── Verification Card ── */}
      <section style={{ flex: 1, padding: '64px 24px 96px' }}>
        <div style={{ maxWidth: 640, margin: '0 auto' }}>

          {/* Main card */}
          <div style={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: 24, padding: 36, boxShadow: '0 8px 32px rgba(0,0,0,0.06)' }}>

            {/* Card header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 28, paddingBottom: 24, borderBottom: '1px solid #F1F5F9' }}>
              <div style={{ width: 44, height: 44, borderRadius: 14, background: 'linear-gradient(135deg, #007A5E, #059669)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(0,122,94,0.3)', flexShrink: 0 }}>
                <svg width="20" height="20" fill="none" stroke="white" viewBox="0 0 24 24" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="M9 11l2 2 4-4" />
                </svg>
              </div>
              <div>
                <p style={{ fontWeight: 800, color: '#0F172A', fontSize: 16, margin: 0, lineHeight: 1 }}>Hash Verification</p>
                <p style={{ fontSize: 12, color: '#94A3B8', margin: '4px 0 0', fontFamily: 'JetBrains Mono, monospace' }}>SHA-256 · FIDO2 · AES-256</p>
              </div>
              <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, color: '#007A5E', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#007A5E', display: 'inline-block', animation: 'pulse 2s infinite' }} />
                Engine Online
              </div>
            </div>

            {/* Input area */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 10 }}>
                Content SHA-256 Hash
              </label>
              <div style={{ position: 'relative' }}>
                <textarea
                  value={hash}
                  onChange={e => setHash(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="e3b0c44298fc1c149afb...  (paste hash from email X-Attest-Hash header)"
                  rows={4}
                  className="verify-input"
                  style={{ width: '100%', padding: '14px 18px', borderRadius: 14, border: '1.5px solid #E2E8F0', background: '#FAFAFA', color: '#0F172A', fontSize: 13, fontFamily: 'JetBrains Mono, monospace', lineHeight: 1.6, resize: 'none', outline: 'none', transition: 'all 0.2s', boxSizing: 'border-box' }}
                />
                {hash && (
                  <button onClick={() => setHash('')} style={{ position: 'absolute', top: 12, right: 12, width: 22, height: 22, borderRadius: '50%', background: '#F1F5F9', border: 'none', color: '#64748B', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, lineHeight: 1 }}>×</button>
                )}
              </div>
              <p style={{ fontSize: 11, color: '#94A3B8', marginTop: 8, fontFamily: 'JetBrains Mono, monospace' }}>Tip: Ctrl+Enter to verify</p>
            </div>

            {/* Verify button */}
            <button onClick={handleVerify} disabled={loading || !hash.trim()} style={{ width: '100%', padding: '15px 0', borderRadius: 14, border: 'none', background: loading || !hash.trim() ? '#E2E8F0' : 'linear-gradient(135deg, #007A5E 0%, #059669 100%)', color: loading || !hash.trim() ? '#94A3B8' : 'white', fontWeight: 800, fontSize: 15, cursor: loading || !hash.trim() ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, transition: 'all 0.2s', boxShadow: loading || !hash.trim() ? 'none' : '0 4px 16px rgba(0,122,94,0.3)' }}>
              {loading ? (
                <><span style={{ width: 18, height: 18, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.7s linear infinite' }} />Verifying Trust Layer…</>
              ) : (
                <><svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="M9 11l2 2 4-4" /></svg>Verify Authenticity</>
              )}
            </button>
          </div>

          {/* Error */}
          {error && (
            <div style={{ marginTop: 20, padding: '20px 24px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 16, display: 'flex', alignItems: 'flex-start', gap: 14, animation: 'slideUp 0.4s ease' }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(220,38,38,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="18" height="18" fill="none" stroke="#DC2626" viewBox="0 0 24 24" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 9v2m0 4h.01M5.07 19h13.86c1.54 0 2.5-1.67 1.73-3L13.73 4c-.77-1.33-2.69-1.33-3.46 0L3.34 16c-.77 1.33.19 3 1.73 3z" />
                </svg>
              </div>
              <div>
                <p style={{ fontWeight: 700, color: '#DC2626', fontSize: 14, margin: '0 0 4px' }}>Verification Failed</p>
                <p style={{ fontSize: 13, color: '#64748B', margin: 0, lineHeight: 1.5 }}>{error}</p>
              </div>
            </div>
          )}

          {/* Success result */}
          {result && (
            <div style={{ marginTop: 20, animation: 'slideUp 0.5s cubic-bezier(0.16,1,0.3,1)' }}>
              <div style={{ background: 'white', border: '2px solid #007A5E', borderRadius: 20, padding: '28px 28px 24px', boxShadow: '0 8px 32px rgba(0,122,94,0.1)' }}>
                <div style={{ marginBottom: 24 }}>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#DCFCE7', border: '1px solid #86EFAC', borderRadius: 8, padding: '5px 14px' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#007A5E" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
                    <span style={{ fontSize: 11, fontWeight: 800, color: '#007A5E', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Verified Human</span>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                  {[
                    { label: 'Sender Name', value: result.full_name || 'HVEL Verified User', mono: false },
                    { label: 'Verified Email', value: result.sender_email, mono: true },
                    { label: 'Email Sent At', value: new Date(result.timestamp).toLocaleString(), mono: false },
                  ].map((row, i, arr) => (
                    <div key={row.label} style={{ padding: '14px 0', borderBottom: i < arr.length - 1 ? '1px solid #F1F5F9' : 'none' }}>
                      <p style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 4px' }}>{row.label}</p>
                      <p style={{ fontSize: 16, fontWeight: 700, color: '#0F172A', margin: 0, fontFamily: row.mono ? 'JetBrains Mono, monospace' : 'inherit', wordBreak: 'break-all' }}>{row.value}</p>
                    </div>
                  ))}
                  <div style={{ padding: '14px 0' }}>
                    <p style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 4px' }}>Sender Status</p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#007A5E', display: 'inline-block', flexShrink: 0 }} />
                      <p style={{ fontSize: 16, fontWeight: 700, color: '#0F172A', margin: 0 }}>
                        {result.last_active ? `Active today at ${new Date(result.last_active).toLocaleTimeString()}` : 'Active — Verified Member'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              <p style={{ textAlign: 'center', fontSize: 12, color: '#94A3B8', marginTop: 14, fontWeight: 500 }}>
                © 2026 Attest Security. All identities are verified via 2FA & WebAuthn.
              </p>
            </div>
          )}

          {/* How it works strip */}
          {!result && !error && (
            <div style={{ marginTop: 32, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
              {[
                { icon: '📧', title: 'Get the Hash', desc: 'Copy the X-Attest-Hash from the email header' },
                { icon: '🔍', title: 'Paste & Verify', desc: 'Paste it above and click Verify Authenticity' },
                { icon: '✅', title: 'See the Proof', desc: 'View the verified sender name and timestamp' },
              ].map(s => (
                <div key={s.title} style={{ background: '#FAFAFA', border: '1px solid #E2E8F0', borderRadius: 14, padding: '16px 14px', textAlign: 'center' }}>
                  <div style={{ fontSize: 22, marginBottom: 8 }}>{s.icon}</div>
                  <p style={{ fontSize: 12, fontWeight: 700, color: '#0F172A', marginBottom: 4 }}>{s.title}</p>
                  <p style={{ fontSize: 11, color: '#64748B', lineHeight: 1.5, margin: 0 }}>{s.desc}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <Footer />
    </main>
  );
}
