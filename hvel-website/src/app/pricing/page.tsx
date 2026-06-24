'use client';

import { useState, useEffect } from 'react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { EXTENSION_DOWNLOAD_URL } from '@/lib/constants';

const sharedStyles = `
  @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap');
  .pricing-page * { font-family: 'Plus Jakarta Sans', system-ui, sans-serif; }
  @keyframes fadeInUp { from { opacity:0; transform:translateY(24px); } to { opacity:1; transform:translateY(0); } }
  @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
  @keyframes slideInRight { from { opacity: 0; transform: translateX(30px); } to { opacity: 1; transform: translateX(0); } }
  .plan-card { transition: transform 0.25s ease, box-shadow 0.25s ease; }
  .plan-card:hover { transform: translateY(-4px); box-shadow: 0 24px 48px rgba(0,0,0,0.08) !important; }
  .faq-item { transition: background 0.2s; }
  .faq-item:hover { background: #F8FAFC !important; }
`;

const CheckIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#007A5E" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
    <path d="M20 6L9 17l-5-5" />
  </svg>
);

export default function Pricing() {
  const [email, setEmail] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000';

  useEffect(() => {
    // Check if redirecting back from checkout
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get('session_id');
    const userEmail = params.get('email');

    if (sessionId && userEmail) {
      if (sessionId === 'mock_session_id') {
        // Upgrade mock user immediately
        setLoading(true);
        fetch(`${BACKEND_URL}/api/plan/upgrade`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: userEmail, plan: 'professional' })
        })
          .then(res => res.json())
          .then(data => {
            setLoading(false);
            if (data.success) {
              setStatusMsg({
                type: 'success',
                text: `🎉 Mock Checkout Successful! Account ${userEmail} has been upgraded to the Professional plan.`
              });
            } else {
              setStatusMsg({
                type: 'error',
                text: data.error || 'Failed to complete mock upgrade.'
              });
            }
          })
          .catch(() => {
            setLoading(false);
            setStatusMsg({
              type: 'error',
              text: 'Failed to connect to backend for mock upgrade.'
            });
          });
      } else {
        // Real checkout session redirect success
        setStatusMsg({
          type: 'success',
          text: `🎉 Thank you for subscribing! Your Professional plan is now active for ${userEmail}.`
        });
      }
    }
  }, []);

  const handleCheckoutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    setStatusMsg(null);

    try {
      const res = await fetch(`${BACKEND_URL}/api/create-checkout-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error(data.error || 'Failed to generate checkout session.');
      }
    } catch (err: any) {
      setLoading(false);
      setStatusMsg({
        type: 'error',
        text: err.message || 'Checkout connection error.'
      });
    }
  };

  return (
    <main className="pricing-page" style={{ minHeight: '100vh', background: '#ffffff' }}>
      <style>{sharedStyles}</style>
      <Navbar />

      {/* ── Status Message Alert ── */}
      {statusMsg && (
        <div style={{
          position: 'fixed',
          top: '96px',
          right: '24px',
          zIndex: 1100,
          maxWidth: 420,
          width: 'calc(100% - 48px)',
          padding: '16px 20px',
          borderRadius: 16,
          background: statusMsg.type === 'success' ? 'rgba(240, 253, 244, 0.95)' : 'rgba(254, 242, 242, 0.95)',
          backdropFilter: 'blur(8px)',
          border: `1.5px solid ${statusMsg.type === 'success' ? '#bbf7d0' : '#fecaca'}`,
          color: statusMsg.type === 'success' ? '#166534' : '#991B1B',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
          fontSize: 14,
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          animation: 'slideInRight 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
        }}>
          <span style={{ fontSize: 18 }}>{statusMsg.type === 'success' ? '✅' : '❌'}</span>
          <span style={{ flexGrow: 1, lineHeight: 1.5 }}>{statusMsg.text}</span>
          <button 
            onClick={() => setStatusMsg(null)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', fontWeight: 'bold', fontSize: 16, padding: '0 4px' }}
          >
            ✕
          </button>
        </div>
      )}

      {/* ── Hero ── */}
      <section style={{ padding: '96px 24px 72px', textAlign: 'center', background: 'linear-gradient(180deg, #F8FFF8 0%, #ffffff 100%)' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
          <div style={{ background: '#E6FDF0', border: '1px solid #DCFCE7', color: '#007A5E', display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 18px', borderRadius: 9999, fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="M9 11l2 2 4-4" /></svg>
            Transparent Pricing
          </div>
        </div>
        <h1 style={{ fontSize: 'clamp(36px, 5vw, 56px)', fontWeight: 950, color: '#0F172A', letterSpacing: '-0.04em', lineHeight: 1.1, marginBottom: 18 }}>
          Simple, <span style={{ color: '#007A5E' }}>Human-First</span> Pricing
        </h1>
        <p style={{ fontSize: 17, color: '#64748B', maxWidth: 540, margin: '0 auto 24px', lineHeight: 1.7, fontWeight: 500 }}>
          No hidden fees. No email scanning. No data selling. Just pure human-verified trust delivered at every tier.
        </p>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(0,122,94,0.07)', border: '1px solid rgba(0,122,94,0.2)', borderRadius: 9999, padding: '7px 18px', fontSize: 13, fontWeight: 700, color: '#007A5E' }}>
          🔒 Zero email storage — we never read your Gmail
        </div>
      </section>

      {/* ── Plans ── */}
      <section style={{ padding: '0 24px 100px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))', gap: 24, alignItems: 'start' }}>

          {/* Individual — Free */}
          <div className="plan-card" style={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: 24, padding: 36, display: 'flex', flexDirection: 'column', boxShadow: '0 4px 16px rgba(0,0,0,0.04)' }}>
            <div style={{ marginBottom: 8 }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, background: '#F0FDF4', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#007A5E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
              </div>
              <h2 style={{ fontSize: 22, fontWeight: 900, color: '#0F172A', marginBottom: 4 }}>Individual</h2>
              <p style={{ fontSize: 13, color: '#64748B', fontWeight: 500 }}>Perfect for personal security.</p>
            </div>
            <div style={{ marginBottom: 28 }}>
              <span style={{ fontSize: 48, fontWeight: 950, color: '#0F172A', letterSpacing: '-0.04em' }}>$0</span>
              <span style={{ fontSize: 15, color: '#94A3B8', fontWeight: 600 }}>/month</span>
            </div>
            <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 32px', display: 'flex', flexDirection: 'column', gap: 12, flexGrow: 1 }}>
              {['Basic Behavioral Verification', 'Native Gmail Send Hook', '1 Active Gmail Account', 'Verification Audit Log', 'Zero email data stored', 'Community support'].map(f => (
                <li key={f} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, color: '#475569', fontWeight: 500 }}>
                  <CheckIcon /> {f}
                </li>
              ))}
            </ul>
            <a href={EXTENSION_DOWNLOAD_URL} style={{ display: 'block', textAlign: 'center', padding: '13px 0', borderRadius: 12, border: '1.5px solid #E2E8F0', fontWeight: 700, fontSize: 15, color: '#0F172A', textDecoration: 'none', transition: 'all 0.2s' }}>
              Get Started Free
            </a>
          </div>

          {/* Professional — Recommended */}
          <div className="plan-card" style={{ background: 'linear-gradient(180deg, #F0FDF4 0%, #ffffff 100%)', border: '2px solid #007A5E', borderRadius: 24, padding: 36, display: 'flex', flexDirection: 'column', position: 'relative', boxShadow: '0 20px 60px -10px rgba(0,122,94,0.18)', transform: 'scale(1.03)' }}>
            <div style={{ position: 'absolute', top: -14, left: '50%', transform: 'translateX(-50%)', background: 'linear-gradient(135deg, #007A5E, #059669)', color: 'white', padding: '4px 18px', borderRadius: 9999, fontSize: 11, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em', whiteSpace: 'nowrap' }}>
              Most Popular
            </div>
            <div style={{ marginBottom: 8 }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, background: '#DCFCE7', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#007A5E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="M9 11l2 2 4-4" /></svg>
              </div>
              <h2 style={{ fontSize: 22, fontWeight: 900, color: '#0F172A', marginBottom: 4 }}>Professional</h2>
              <p style={{ fontSize: 13, color: '#64748B', fontWeight: 500 }}>For high-stakes security teams.</p>
            </div>
            <div style={{ marginBottom: 28 }}>
              {/* Launch discount badge */}
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#FEF9C3', border: '1px solid #FDE047', borderRadius: 9999, padding: '3px 10px', fontSize: 11, fontWeight: 800, color: '#854D0E', marginBottom: 10 }}>
                🎉 Launch Discount — Available Now
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                <span style={{ fontSize: 48, fontWeight: 950, color: '#0F172A', letterSpacing: '-0.04em' }}>$3</span>
                <span style={{ fontSize: 15, color: '#94A3B8', fontWeight: 600 }}>/month per user</span>
              </div>
              <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 18, fontWeight: 700, color: '#94A3B8', textDecoration: 'line-through' }}>$12</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#007A5E', background: '#DCFCE7', padding: '2px 8px', borderRadius: 9999 }}>75% off</span>
              </div>
            </div>
            <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 32px', display: 'flex', flexDirection: 'column', gap: 12, flexGrow: 1 }}>
              {['Unlimited Behavioral Verifications', 'WebAuthn Biometric Support', 'Up to 5 Gmail Accounts', 'Security Trust-Nudge Badges', 'Priority email support', 'Advanced Audit Dashboard', 'Zero email data stored', 'GDPR & CCPA compliant'].map(f => (
                <li key={f} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, color: '#475569', fontWeight: 500 }}>
                  <CheckIcon /> {f}
                </li>
              ))}
            </ul>
            <button 
              onClick={() => setShowModal(true)}
              style={{ display: 'block', width: '100%', padding: '15px 0', borderRadius: 12, border: 'none', background: 'linear-gradient(135deg, #007A5E 0%, #059669 100%)', color: 'white', fontWeight: 800, fontSize: 16, cursor: 'pointer', boxShadow: '0 4px 14px rgba(0,122,94,0.3)' }}
            >
              Start 14-Day Free Trial
            </button>
            <p style={{ textAlign: 'center', fontSize: 12, color: '#94A3B8', marginTop: 10, fontWeight: 500 }}>No credit card required</p>
          </div>

          {/* Enterprise */}
          <div className="plan-card" style={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: 24, padding: 36, display: 'flex', flexDirection: 'column', boxShadow: '0 4px 16px rgba(0,0,0,0.04)' }}>
            <div style={{ marginBottom: 8 }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, background: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0F172A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" /></svg>
              </div>
              <h2 style={{ fontSize: 22, fontWeight: 900, color: '#0F172A', marginBottom: 4 }}>Enterprise</h2>
              <p style={{ fontSize: 13, color: '#64748B', fontWeight: 500 }}>For large-scale deployments.</p>
            </div>
            <div style={{ marginBottom: 28 }}>
              <span style={{ fontSize: 40, fontWeight: 950, color: '#0F172A', letterSpacing: '-0.04em' }}>Custom</span>
            </div>
            <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 32px', display: 'flex', flexDirection: 'column', gap: 12, flexGrow: 1 }}>
              {['Unlimited accounts & verifications', 'SSO & SAML Integration', 'Real-time Audit Log API', 'Dedicated Account Manager', 'Custom retention policies', 'On-premise deployment option', 'SLA guarantee', 'Zero email data stored'].map(f => (
                <li key={f} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, color: '#475569', fontWeight: 500 }}>
                  <CheckIcon /> {f}
                </li>
              ))}
            </ul>
            <button style={{ display: 'block', width: '100%', padding: '13px 0', borderRadius: 12, border: '1.5px solid #E2E8F0', background: 'transparent', fontWeight: 700, fontSize: 15, color: '#0F172A', cursor: 'pointer' }}>
              Contact Sales
            </button>
          </div>
        </div>
      </section>

      {/* ── Privacy Trust Section ── */}
      <section style={{ background: '#0F172A', padding: '80px 24px' }}>
        <div style={{ maxWidth: 960, margin: '0 auto', textAlign: 'center' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(0,122,94,0.15)', border: '1px solid rgba(0,122,94,0.3)', borderRadius: 9999, padding: '6px 16px', fontSize: 12, fontWeight: 700, color: '#6EE7B7', marginBottom: 20, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Our Privacy Promise
          </div>
          <h2 style={{ fontSize: 'clamp(28px, 4vw, 40px)', fontWeight: 950, color: 'white', letterSpacing: '-0.03em', marginBottom: 16 }}>
            Every Plan. Zero Email Risk.
          </h2>
          <p style={{ color: '#94A3B8', fontSize: 15, lineHeight: 1.7, maxWidth: 560, margin: '0 auto 48px' }}>
            Regardless of which plan you choose, Attest <strong style={{ color: 'white' }}>never reads, stores, or transmits</strong> your email content. This is a technical guarantee, not just a policy.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 16 }}>
            {[
              { icon: '🚫', title: 'No Gmail ID stored', desc: 'We never record your Google account identifier or email address.' },
              { icon: '📧', title: 'No email content', desc: 'Subject, body, recipients, and attachments are never accessible to us.' },
              { icon: '🔐', title: 'Local verification', desc: 'Biometric checks happen on your device. No biometric data leaves your machine.' },
              { icon: '📋', title: 'Only 4 fields logged', desc: "Hash, timestamp, your name, and pass/fail. That's the entire database record." },
            ].map(item => (
              <div key={item.title} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: 24, textAlign: 'left' }}>
                <div style={{ fontSize: 24, marginBottom: 12 }}>{item.icon}</div>
                <p style={{ fontWeight: 700, color: 'white', fontSize: 14, marginBottom: 6 }}>{item.title}</p>
                <p style={{ fontSize: 13, color: '#94A3B8', lineHeight: 1.6, margin: 0 }}>{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section style={{ padding: '80px 24px', background: '#FAFAFA', borderTop: '1px solid #E2E8F0' }}>
        <div style={{ maxWidth: 740, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 48 }}>
            <h2 style={{ fontSize: 'clamp(26px, 3.5vw, 36px)', fontWeight: 950, color: '#0F172A', letterSpacing: '-0.03em', marginBottom: 12 }}>
              Pricing FAQ
            </h2>
            <p style={{ color: '#64748B', fontSize: 15, fontWeight: 500 }}>Everything you need to know before choosing a plan.</p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[
              ['Do you store my Gmail address?', 'No. We never store your Gmail address or any Google account identifier. We only store your registered full name for the verified sender badge.'],
              ['Can I cancel anytime?', 'Yes. Cancel from your account dashboard at any time. No cancellation fees or lock-in periods.'],
              ['Is the free plan really free?', 'Yes, forever. The Individual plan has no time limit and no credit card required.'],
              ['What happens to my data if I cancel?', 'Your verification logs are retained for 90 days after cancellation, then permanently deleted. You can request immediate deletion at any time.'],
              ['Does Attest work with Google Workspace?', 'Yes. It works with any Gmail interface — personal @gmail.com accounts and Google Workspace (formerly G Suite) accounts.'],
            ].map(([q, a]) => (
              <div key={q} className="faq-item" style={{ padding: '20px 24px', background: 'white', border: '1px solid #E2E8F0', borderRadius: 16 }}>
                <p style={{ fontWeight: 700, color: '#0F172A', fontSize: 15, marginBottom: 8 }}>{q}</p>
                <p style={{ fontSize: 14, color: '#64748B', margin: 0, lineHeight: 1.65 }}>{a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Email Modal ── */}
      {showModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, animation: 'fadeIn 0.2s ease-out' }}>
          <div style={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: 24, padding: 36, maxWidth: 440, width: '90%', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', position: 'relative' }}>
            <button 
              onClick={() => setShowModal(false)}
              style={{ position: 'absolute', top: 20, right: 20, background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8' }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
            <h3 style={{ fontSize: 20, fontWeight: 900, color: '#0F172A', marginBottom: 8, letterSpacing: '-0.02em' }}>Activate Professional</h3>
            <p style={{ fontSize: 14, color: '#64748B', lineHeight: 1.6, marginBottom: 24, fontWeight: 500 }}>
              Enter your email address. This email will be used to link your premium subscription with your browser extension.
            </p>
            <form onSubmit={handleCheckoutSubmit}>
              <div style={{ marginBottom: 20 }}>
                <label style={{ fontSize: 11, fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 8 }}>Email Address</label>
                <input 
                  type="email" 
                  required
                  placeholder="name@company.com" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={{ width: '100%', padding: '12px 16px', borderRadius: 12, border: '1.5px solid #E2E8F0', fontSize: 15, outline: 'none', transition: 'border-color 0.15s', color: '#0F172A' }}
                />
              </div>
              <button 
                type="submit" 
                disabled={loading}
                style={{ display: 'block', width: '100%', padding: '14px 0', borderRadius: 12, border: 'none', background: 'linear-gradient(135deg, #007A5E 0%, #059669 100%)', color: 'white', fontWeight: 800, fontSize: 15, cursor: 'pointer', transition: 'background 0.15s', boxShadow: '0 4px 14px rgba(0,122,94,0.3)' }}
              >
                {loading ? 'Processing...' : 'Proceed to Stripe Checkout'}
              </button>
            </form>
          </div>
        </div>
      )}

      <Footer />
    </main>
  );
}
