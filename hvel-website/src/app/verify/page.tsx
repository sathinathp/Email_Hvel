'use client';

import { useState, useEffect } from 'react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'https://hvel-backend.onrender.com';

export default function Verify() {
  const [hash, setHash] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [focused, setFocused] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const handleVerify = async () => {
    if (!hash.trim()) return;
    setLoading(true);
    setResult(null);
    setError(null);
    try {
      const response = await fetch(`${BACKEND_URL}/api/verify-hash`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hash: hash.trim() }),
      });
      const data = await response.json();
      if (data.success) setResult(data.data);
      else setError(data.message || 'Verification failed. Please check the hash.');
    } catch {
      setError('Network error. Ensure the HVEL backend is running.');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleVerify();
  };

  if (!mounted) return null;

  return (
    <main style={{ minHeight: '100vh', background: '#060B18', display: 'flex', flexDirection: 'column' }}>
      <Navbar />

      {/* ── Hero section with animated background ── */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 24px 80px' }}>

        {/* Animated orbs */}
        <div style={{ position: 'absolute', top: '-10%', left: '50%', transform: 'translateX(-50%)', width: 800, height: 500, background: 'radial-gradient(ellipse, rgba(37,99,235,0.18) 0%, transparent 70%)', pointerEvents: 'none', animation: 'orbFloat 8s ease-in-out infinite' }} />
        <div style={{ position: 'absolute', bottom: '5%', left: '10%', width: 400, height: 400, background: 'radial-gradient(ellipse, rgba(99,102,241,0.1) 0%, transparent 70%)', pointerEvents: 'none', animation: 'orbFloat 10s ease-in-out infinite reverse' }} />
        <div style={{ position: 'absolute', top: '20%', right: '5%', width: 300, height: 300, background: 'radial-gradient(ellipse, rgba(16,185,129,0.08) 0%, transparent 70%)', pointerEvents: 'none', animation: 'orbFloat 12s ease-in-out infinite' }} />

        {/* Grid pattern overlay */}
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)', backgroundSize: '48px 48px', pointerEvents: 'none' }} />

        {/* Content */}
        <div style={{ position: 'relative', zIndex: 10, width: '100%', maxWidth: 640 }}>

          {/* Badge */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 28 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(37,99,235,0.15)', border: '1px solid rgba(37,99,235,0.3)', borderRadius: 9999, padding: '6px 18px', fontSize: 12, fontWeight: 700, color: '#93C5FD', textTransform: 'uppercase', letterSpacing: '0.12em' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#3B82F6', display: 'inline-block', animation: 'pulse 2s infinite' }} />
              HumanAttest Verification Engine
            </div>
          </div>

          {/* Title */}
          <div style={{ textAlign: 'center', marginBottom: 48 }}>
            <h1 style={{ fontSize: 'clamp(36px,6vw,64px)', fontWeight: 900, letterSpacing: '-0.04em', lineHeight: 1.05, color: 'white', marginBottom: 16 }}>
              Verify{' '}
              <span style={{ background: 'linear-gradient(135deg, #3B82F6 0%, #818CF8 50%, #06B6D4 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                Human Intent
              </span>
            </h1>
            <p style={{ fontSize: 17, color: '#94A3B8', lineHeight: 1.7, maxWidth: 480, margin: '0 auto', fontWeight: 400 }}>
              Paste a SHA-256 hash from an email header to cryptographically confirm
              a real human sent that message.
            </p>
          </div>

          {/* Main card */}
          <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 24, padding: 32, backdropFilter: 'blur(20px)', boxShadow: '0 32px 64px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.08)' }}>

            {/* Card header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24, paddingBottom: 20, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg,#2563EB,#4F46E5)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(37,99,235,0.4)' }}>
                <svg width="18" height="18" fill="none" stroke="white" viewBox="0 0 24 24" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <div>
                <p style={{ fontWeight: 700, color: 'white', fontSize: 15, margin: 0, lineHeight: 1 }}>Hash Verification</p>
                <p style={{ fontSize: 12, color: '#64748B', margin: '3px 0 0', fontFamily: 'monospace' }}>SHA-256 · FIDO2 · AES-256</p>
              </div>
              <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, color: '#22C55E', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22C55E', display: 'inline-block', animation: 'pulse 2s infinite' }} />
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
                  onFocus={() => setFocused(true)}
                  onBlur={() => setFocused(false)}
                  onKeyDown={handleKeyDown}
                  placeholder="e3b0c44298fc1c149afb...  (paste hash from email X-HumanAttest-Hash header)"
                  rows={4}
                  style={{
                    width: '100%', padding: '16px 18px', borderRadius: 14,
                    border: `1.5px solid ${focused ? '#3B82F6' : 'rgba(255,255,255,0.1)'}`,
                    background: focused ? 'rgba(59,130,246,0.05)' : 'rgba(255,255,255,0.03)',
                    color: '#E2E8F0', fontSize: 13, fontFamily: 'monospace',
                    lineHeight: 1.6, resize: 'none', outline: 'none',
                    transition: 'all 0.2s', boxSizing: 'border-box',
                    boxShadow: focused ? '0 0 0 3px rgba(59,130,246,0.15)' : 'none',
                  }}
                />
                {hash && (
                  <button
                    onClick={() => setHash('')}
                    style={{ position: 'absolute', top: 12, right: 12, width: 22, height: 22, borderRadius: '50%', background: 'rgba(255,255,255,0.1)', border: 'none', color: '#94A3B8', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, lineHeight: 1 }}
                  >×</button>
                )}
              </div>
              <p style={{ fontSize: 11, color: '#475569', marginTop: 8, fontFamily: 'monospace' }}>
                Tip: Ctrl+Enter to verify
              </p>
            </div>

            {/* Verify button */}
            <button
              onClick={handleVerify}
              disabled={loading || !hash.trim()}
              style={{
                width: '100%', padding: '16px 0', borderRadius: 14, border: 'none',
                background: loading || !hash.trim()
                  ? 'rgba(255,255,255,0.06)'
                  : 'linear-gradient(135deg, #2563EB 0%, #4F46E5 100%)',
                color: loading || !hash.trim() ? '#475569' : 'white',
                fontWeight: 800, fontSize: 15, cursor: loading || !hash.trim() ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                transition: 'all 0.2s',
                boxShadow: loading || !hash.trim() ? 'none' : '0 4px 20px rgba(37,99,235,0.4)',
              }}
            >
              {loading ? (
                <>
                  <span style={{ width: 18, height: 18, border: '2px solid rgba(255,255,255,0.2)', borderTopColor: 'white', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.7s linear infinite' }} />
                  Verifying Trust Layer…
                </>
              ) : (
                <>
                  <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                  Verify Authenticity
                </>
              )}
            </button>
          </div>

          {/* ── Error state ── */}
          {error && (
            <div style={{ marginTop: 20, padding: '18px 20px', background: 'rgba(220,38,38,0.1)', border: '1px solid rgba(220,38,38,0.25)', borderRadius: 16, display: 'flex', alignItems: 'flex-start', gap: 14, animation: 'slideUp 0.4s ease' }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(220,38,38,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="18" height="18" fill="none" stroke="#F87171" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <p style={{ fontWeight: 700, color: '#F87171', fontSize: 14, margin: '0 0 4px' }}>Verification Failed</p>
                <p style={{ fontSize: 13, color: '#94A3B8', margin: 0, lineHeight: 1.5 }}>{error}</p>
              </div>
            </div>
          )}

          {/* ── Success result ── */}
          {result && (
            <div style={{ marginTop: 20, animation: 'slideUp 0.5s cubic-bezier(0.16,1,0.3,1)' }}>
              <div style={{
                background: 'white',
                border: '2px solid #22C55E',
                borderRadius: 20,
                padding: '28px 28px 24px',
                boxShadow: '0 8px 32px rgba(34,197,94,0.12)',
              }}>
                {/* VERIFIED HUMAN badge */}
                <div style={{ marginBottom: 24 }}>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#DCFCE7', border: '1px solid #86EFAC', borderRadius: 8, padding: '5px 12px' }}>
                    <svg width="14" height="14" viewBox="0 0 20 20" fill="#16A34A">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                    </svg>
                    <span style={{ fontSize: 11, fontWeight: 800, color: '#15803D', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Verified Human</span>
                  </div>
                </div>

                {/* Rows */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                  {[
                    { label: 'Sender Name',    value: result.full_name || 'HVEL Verified User',                    mono: false },
                    { label: 'Verified Email', value: result.sender_email,                                          mono: true  },
                    { label: 'Email Sent At',  value: new Date(result.timestamp).toLocaleString(),                  mono: false },
                  ].map((row, i, arr) => (
                    <div key={row.label} style={{
                      padding: '14px 0',
                      borderBottom: i < arr.length - 1 ? '1px solid #F1F5F9' : 'none',
                    }}>
                      <p style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 4px' }}>
                        {row.label}
                      </p>
                      <p style={{ fontSize: 16, fontWeight: 700, color: '#0F172A', margin: 0, fontFamily: row.mono ? 'monospace' : 'inherit', wordBreak: 'break-all' }}>
                        {row.value}
                      </p>
                    </div>
                  ))}

                  {/* Sender Status */}
                  <div style={{ padding: '14px 0' }}>
                    <p style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 4px' }}>
                      Sender Status
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#22C55E', display: 'inline-block', flexShrink: 0 }} />
                      <p style={{ fontSize: 16, fontWeight: 700, color: '#0F172A', margin: 0 }}>
                        {result.last_active
                          ? `Active today at ${new Date(result.last_active).toLocaleTimeString()}`
                          : 'Active — Verified Member'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer note */}
              <p style={{ textAlign: 'center', fontSize: 12, color: '#475569', marginTop: 14, fontWeight: 500 }}>
                © 2026 HumanAttest Security Protocol. All identities are verified via 2FA &amp; WebAuthn.
              </p>
            </div>
          )}

          {/* ── How it works strip ── */}
          {!result && !error && (
            <div style={{ marginTop: 32, display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
              {[
                { icon: '📧', title: 'Get the Hash', desc: 'Copy the X-HumanAttest-Hash from the email header' },
                { icon: '🔍', title: 'Paste & Verify', desc: 'Paste it above and click Verify Authenticity' },
                { icon: '✅', title: 'See the Proof', desc: 'View the verified sender name and timestamp' },
              ].map((s) => (
                <div key={s.title} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 14, padding: '16px 14px', textAlign: 'center' }}>
                  <div style={{ fontSize: 22, marginBottom: 8 }}>{s.icon}</div>
                  <p style={{ fontSize: 12, fontWeight: 700, color: '#E2E8F0', marginBottom: 4 }}>{s.title}</p>
                  <p style={{ fontSize: 11, color: '#475569', lineHeight: 1.5, margin: 0 }}>{s.desc}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <Footer />

      <style>{`
        @keyframes orbFloat {
          0%, 100% { transform: translateX(-50%) translateY(0px); }
          50% { transform: translateX(-50%) translateY(-30px); }
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes ping {
          0%   { transform: scale(1); opacity: 1; }
          75%, 100% { transform: scale(2); opacity: 0; }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        textarea::placeholder { color: #334155; }
        textarea::-webkit-scrollbar { width: 4px; }
        textarea::-webkit-scrollbar-track { background: transparent; }
        textarea::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 2px; }
      `}</style>
    </main>
  );
}
