'use client';

import { useState } from 'react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

const INQUIRY_TYPES = [
  'General Inquiry',
  'Enterprise Sales',
  'Security Audit Request',
  'Technical Support',
  'Partnership',
  'Press / Media',
  'Bug Report',
  'Privacy / Data Request',
];

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'https://hvel-backend.onrender.com';

export default function Contact() {
  const [form, setForm] = useState({
    name: '', email: '', company: '', type: 'General Inquiry', subject: '', message: '',
  });
  const [status, setStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim() || !form.message.trim()) return;
    setStatus('sending');
    setErrorMsg('');
    try {
      const res = await fetch(`${BACKEND_URL}/api/contact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (data.success) {
        setStatus('success');
        setForm({ name:'', email:'', company:'', type:'General Inquiry', subject:'', message:'' });
      } else {
        setStatus('error');
        setErrorMsg(data.error || 'Something went wrong. Please try again.');
      }
    } catch {
      setStatus('error');
      setErrorMsg('Network error. Please check your connection and try again.');
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '12px 16px', borderRadius: 10,
    border: '1.5px solid #E2E8F0', background: '#FAFAFA',
    fontSize: 14, color: '#0F172A', outline: 'none',
    transition: 'border-color 0.2s, background 0.2s',
    fontFamily: 'inherit', boxSizing: 'border-box',
  };
  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: 12, fontWeight: 700,
    color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6,
  };

  return (
    <main style={{ minHeight: '100vh', background: '#fff' }}>
      <Navbar />

      {/* ── Hero ── */}
      <section style={{ padding: '72px 24px 48px', background: 'linear-gradient(180deg,#F8FAFC 0%,#fff 100%)', borderBottom: '1px solid #F1F5F9' }}>
        <div style={{ maxWidth: 720, margin: '0 auto', textAlign: 'center' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#EFF6FF', border: '1px solid #DBEAFE', borderRadius: 9999, padding: '5px 16px', fontSize: 12, fontWeight: 700, color: '#2563EB', marginBottom: 20 }}>
            📬 Get in Touch
          </div>
          <h1 style={{ fontSize: 'clamp(32px,5vw,52px)', fontWeight: 900, color: '#0F172A', letterSpacing: '-0.04em', lineHeight: 1.1, marginBottom: 14 }}>
            Contact HumanAttest
          </h1>
          <p style={{ fontSize: 16, color: '#64748B', lineHeight: 1.7, maxWidth: 520, margin: '0 auto' }}>
            Questions about the protocol, enterprise pricing, security audits, or anything else —
            we read every message and reply within 24 hours.
          </p>
        </div>
      </section>

      {/* ── Main layout ── */}
      <section style={{ padding: '56px 24px 80px' }}>
        <div style={{ maxWidth: 1000, margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr', gap: 48 }} className="contact-layout">

          {/* ── Left: info cards ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }} className="contact-info">

            <div style={{ padding: '24px', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 16 }}>
              <p style={{ fontSize: 13, fontWeight: 800, color: '#0F172A', marginBottom: 16, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Contact Channels
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {[
                  { icon: '📧', label: 'General', value: 'hello@humanattest.com' },
                  { icon: '🔐', label: 'Security', value: 'security@humanattest.com' },
                  { icon: '⚖️', label: 'Legal / Privacy', value: 'privacy@humanattest.com' },
                  { icon: '💼', label: 'Enterprise Sales', value: 'sales@humanattest.com' },
                ].map((c) => (
                  <div key={c.label} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ fontSize: 18, flexShrink: 0 }}>{c.icon}</span>
                    <div>
                      <p style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0 }}>{c.label}</p>
                      <a href={`mailto:${c.value}`} style={{ fontSize: 13, fontWeight: 600, color: '#2563EB', textDecoration: 'none' }}>{c.value}</a>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ padding: '24px', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 16 }}>
              <p style={{ fontSize: 13, fontWeight: 800, color: '#0F172A', marginBottom: 16, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Response Times
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[
                  { type: 'General Inquiry', time: 'Within 24 hours' },
                  { type: 'Enterprise Sales', time: 'Within 4 hours' },
                  { type: 'Security Issues', time: 'Within 2 hours' },
                  { type: 'Technical Support', time: 'Within 8 hours' },
                ].map((r) => (
                  <div key={r.type} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13 }}>
                    <span style={{ color: '#475569', fontWeight: 500 }}>{r.type}</span>
                    <span style={{ color: '#16A34A', fontWeight: 700, fontSize: 12 }}>{r.time}</span>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ padding: '20px 24px', background: 'rgba(22,163,74,0.06)', border: '1px solid rgba(22,163,74,0.15)', borderRadius: 16 }}>
              <p style={{ fontSize: 12, fontWeight: 800, color: '#16A34A', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
                🔒 Privacy Note
              </p>
              <p style={{ fontSize: 13, color: '#64748B', lineHeight: 1.6, margin: 0 }}>
                Your contact form submission is sent directly to our team. We never share your
                information with third parties. See our{' '}
                <a href="/privacy" style={{ color: '#2563EB', fontWeight: 600 }}>Privacy Policy</a>.
              </p>
            </div>
          </div>

          {/* ── Right: form ── */}
          <div className="contact-form-col">
            {status === 'success' ? (
              <div style={{ padding: '48px 32px', background: 'rgba(22,163,74,0.06)', border: '1px solid rgba(22,163,74,0.2)', borderRadius: 20, textAlign: 'center' }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
                <h2 style={{ fontSize: 24, fontWeight: 900, color: '#0F172A', marginBottom: 10 }}>Message Sent</h2>
                <p style={{ fontSize: 15, color: '#64748B', lineHeight: 1.7, maxWidth: 360, margin: '0 auto 24px' }}>
                  Thanks for reaching out. We&apos;ve received your message and will reply to{' '}
                  <strong style={{ color: '#0F172A' }}>{form.email || 'your email'}</strong> within 24 hours.
                </p>
                <button
                  onClick={() => setStatus('idle')}
                  style={{ background: '#2563EB', color: 'white', border: 'none', borderRadius: 10, padding: '11px 28px', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}
                >
                  Send Another Message
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} style={{ background: '#FAFAFA', border: '1px solid #E2E8F0', borderRadius: 20, padding: '36px 32px', display: 'flex', flexDirection: 'column', gap: 20 }}>
                <div>
                  <h2 style={{ fontSize: 20, fontWeight: 800, color: '#0F172A', marginBottom: 4 }}>Send us a message</h2>
                  <p style={{ fontSize: 13, color: '#94A3B8', margin: 0 }}>All fields marked * are required.</p>
                </div>

                {/* Name + Email */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }} className="form-row">
                  <div>
                    <label style={labelStyle}>Full Name *</label>
                    <input
                      type="text" required value={form.name}
                      onChange={e => set('name', e.target.value)}
                      placeholder="Jane Smith"
                      style={inputStyle}
                      onFocus={e => { e.currentTarget.style.borderColor = '#2563EB'; e.currentTarget.style.background = '#fff'; }}
                      onBlur={e => { e.currentTarget.style.borderColor = '#E2E8F0'; e.currentTarget.style.background = '#FAFAFA'; }}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Email Address *</label>
                    <input
                      type="email" required value={form.email}
                      onChange={e => set('email', e.target.value)}
                      placeholder="jane@company.com"
                      style={inputStyle}
                      onFocus={e => { e.currentTarget.style.borderColor = '#2563EB'; e.currentTarget.style.background = '#fff'; }}
                      onBlur={e => { e.currentTarget.style.borderColor = '#E2E8F0'; e.currentTarget.style.background = '#FAFAFA'; }}
                    />
                  </div>
                </div>

                {/* Company + Type */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }} className="form-row">
                  <div>
                    <label style={labelStyle}>Company / Organisation</label>
                    <input
                      type="text" value={form.company}
                      onChange={e => set('company', e.target.value)}
                      placeholder="Acme Corp (optional)"
                      style={inputStyle}
                      onFocus={e => { e.currentTarget.style.borderColor = '#2563EB'; e.currentTarget.style.background = '#fff'; }}
                      onBlur={e => { e.currentTarget.style.borderColor = '#E2E8F0'; e.currentTarget.style.background = '#FAFAFA'; }}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Inquiry Type *</label>
                    <select
                      value={form.type}
                      onChange={e => set('type', e.target.value)}
                      style={{ ...inputStyle, cursor: 'pointer' }}
                      onFocus={e => { e.currentTarget.style.borderColor = '#2563EB'; e.currentTarget.style.background = '#fff'; }}
                      onBlur={e => { e.currentTarget.style.borderColor = '#E2E8F0'; e.currentTarget.style.background = '#FAFAFA'; }}
                    >
                      {INQUIRY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                </div>

                {/* Subject */}
                <div>
                  <label style={labelStyle}>Subject</label>
                  <input
                    type="text" value={form.subject}
                    onChange={e => set('subject', e.target.value)}
                    placeholder="Brief description of your inquiry"
                    style={inputStyle}
                    onFocus={e => { e.currentTarget.style.borderColor = '#2563EB'; e.currentTarget.style.background = '#fff'; }}
                    onBlur={e => { e.currentTarget.style.borderColor = '#E2E8F0'; e.currentTarget.style.background = '#FAFAFA'; }}
                  />
                </div>

                {/* Message */}
                <div>
                  <label style={labelStyle}>Message *</label>
                  <textarea
                    required value={form.message}
                    onChange={e => set('message', e.target.value)}
                    placeholder="Tell us what you need. The more detail you provide, the faster we can help."
                    rows={6}
                    style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.6 }}
                    onFocus={e => { e.currentTarget.style.borderColor = '#2563EB'; e.currentTarget.style.background = '#fff'; }}
                    onBlur={e => { e.currentTarget.style.borderColor = '#E2E8F0'; e.currentTarget.style.background = '#FAFAFA'; }}
                  />
                </div>

                {/* Error */}
                {status === 'error' && (
                  <div style={{ padding: '12px 16px', background: 'rgba(220,38,38,0.06)', border: '1px solid rgba(220,38,38,0.2)', borderRadius: 10, fontSize: 13, color: '#DC2626', fontWeight: 600 }}>
                    ⚠️ {errorMsg}
                  </div>
                )}

                {/* Submit */}
                <button
                  type="submit"
                  disabled={status === 'sending' || !form.name || !form.email || !form.message}
                  style={{
                    background: status === 'sending' ? '#93C5FD' : 'linear-gradient(135deg,#2563EB 0%,#1D4ED8 100%)',
                    color: 'white', border: 'none', borderRadius: 12,
                    padding: '14px 0', fontWeight: 800, fontSize: 15,
                    cursor: status === 'sending' ? 'not-allowed' : 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                    boxShadow: '0 4px 14px rgba(37,99,235,0.3)',
                    transition: 'all 0.2s', opacity: (!form.name || !form.email || !form.message) ? 0.6 : 1,
                  }}
                >
                  {status === 'sending' ? (
                    <>
                      <span style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: 'white', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.7s linear infinite' }}></span>
                      Sending…
                    </>
                  ) : (
                    <>📬 Send Message</>
                  )}
                </button>

                <p style={{ fontSize: 12, color: '#94A3B8', textAlign: 'center', margin: 0 }}>
                  Your message is sent to our team at{' '}
                  <span style={{ fontWeight: 700, color: '#64748B' }}>noreply.hvel@gmail.com</span>
                </p>
              </form>
            )}
          </div>
        </div>
      </section>

      <Footer />

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (min-width: 768px) {
          .contact-layout { grid-template-columns: 300px 1fr !important; }
        }
        @media (max-width: 600px) {
          .form-row { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </main>
  );
}
