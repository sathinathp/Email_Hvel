'use client';

import { useState } from 'react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

const INQUIRY_TYPES = [
  'General Inquiry', 'Enterprise Sales', 'Security Audit Request',
  'Technical Support', 'Partnership', 'Press / Media', 'Bug Report', 'Privacy / Data Request',
];

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'https://api.attest.page';

const sharedStyles = `
  @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap');
  .contact-page * { font-family: 'Plus Jakarta Sans', system-ui, sans-serif; }
  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes fadeInUp { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform:translateY(0); } }
  .contact-input:focus { border-color: #007A5E !important; background: #fff !important; box-shadow: 0 0 0 3px rgba(0,122,94,0.1) !important; }
  @media (min-width: 768px) { .contact-layout { grid-template-columns: 300px 1fr !important; } }
  @media (max-width: 600px) { .form-row { grid-template-columns: 1fr !important; } }
`;

export default function Contact() {
  const [form, setForm] = useState({ name: '', email: '', company: '', type: 'General Inquiry', subject: '', message: '' });
  const [status, setStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim() || !form.message.trim()) return;
    setStatus('sending'); setErrorMsg('');
    try {
      const res = await fetch(`${BACKEND_URL}/api/contact`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      const data = await res.json();
      if (data.success) { setStatus('success'); setForm({ name: '', email: '', company: '', type: 'General Inquiry', subject: '', message: '' }); }
      else { setStatus('error'); setErrorMsg(data.error || 'Something went wrong. Please try again.'); }
    } catch { setStatus('error'); setErrorMsg('Network error. Please check your connection and try again.'); }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '12px 16px', borderRadius: 10,
    border: '1.5px solid #E2E8F0', background: '#FAFAFA',
    fontSize: 14, color: '#0F172A', outline: 'none',
    transition: 'all 0.2s', fontFamily: 'inherit', boxSizing: 'border-box',
  };
  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: 12, fontWeight: 700,
    color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6,
  };

  return (
    <main className="contact-page" style={{ minHeight: '100vh', background: '#ffffff' }}>
      <style>{sharedStyles}</style>
      <Navbar />

      {/* ── Hero ── */}
      <section style={{ padding: '80px 24px 56px', background: 'linear-gradient(180deg, #F8FFF8 0%, #ffffff 100%)', borderBottom: '1px solid #F1F5F9' }}>
        <div style={{ maxWidth: 720, margin: '0 auto', textAlign: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
            <div style={{ background: '#E6FDF0', border: '1px solid #DCFCE7', color: '#007A5E', display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 18px', borderRadius: 9999, fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" /></svg>
              Get in Touch
            </div>
          </div>
          <h1 style={{ fontSize: 'clamp(32px, 5vw, 52px)', fontWeight: 950, color: '#0F172A', letterSpacing: '-0.04em', lineHeight: 1.1, marginBottom: 16 }}>
            Contact <span style={{ color: '#007A5E' }}>Attest</span>
          </h1>
          <p style={{ fontSize: 16, color: '#64748B', lineHeight: 1.7, maxWidth: 500, margin: '0 auto', fontWeight: 500 }}>
            Questions about the protocol, enterprise pricing, security audits, or anything else — we read every message and reply within 24 hours.
          </p>
        </div>
      </section>

      {/* ── Main layout ── */}
      <section style={{ padding: '64px 24px 96px' }}>
        <div style={{ maxWidth: 1020, margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr', gap: 48 }} className="contact-layout">

          {/* ── Left: info cards ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Contact Channel */}
            <div style={{ padding: 28, background: 'white', border: '1px solid #E2E8F0', borderRadius: 20, boxShadow: '0 2px 12px rgba(0,0,0,0.04)' }}>
              <p style={{ fontSize: 11, fontWeight: 800, color: '#0F172A', marginBottom: 20, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                Contact Us
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: '#F0FDF4', border: '1px solid #DCFCE7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>📧</div>
                  <div>
                    <p style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 4px' }}>General & Sales</p>
                    <a href="mailto:info@attest.page" style={{ fontSize: 15, fontWeight: 700, color: '#007A5E', textDecoration: 'none' }}>info@attest.page</a>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: '#F0FDF4', border: '1px solid #DCFCE7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>🛠️</div>
                  <div>
                    <p style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 4px' }}>Support & Privacy</p>
                    <a href="mailto:support@attest.page" style={{ fontSize: 15, fontWeight: 700, color: '#007A5E', textDecoration: 'none' }}>support@attest.page</a>
                  </div>
                </div>
              </div>
            </div>

            {/* Response Times */}
            <div style={{ padding: 28, background: 'white', border: '1px solid #E2E8F0', borderRadius: 20, boxShadow: '0 2px 12px rgba(0,0,0,0.04)' }}>
              <p style={{ fontSize: 11, fontWeight: 800, color: '#0F172A', marginBottom: 20, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                Response Times
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {[
                  { type: 'General Inquiry', time: 'Within 24 hours' },
                  { type: 'Enterprise Sales', time: 'Within 4 hours' },
                  { type: 'Security Issues', time: 'Within 2 hours' },
                  { type: 'Technical Support', time: 'Within 8 hours' },
                ].map(r => (
                  <div key={r.type} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13, paddingBottom: 10, borderBottom: '1px solid #F1F5F9' }}>
                    <span style={{ color: '#475569', fontWeight: 500 }}>{r.type}</span>
                    <span style={{ color: '#007A5E', fontWeight: 700, fontSize: 12, background: '#F0FDF4', padding: '2px 10px', borderRadius: 9999 }}>{r.time}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Privacy Note */}
            <div style={{ padding: '20px 24px', background: '#F0FDF4', border: '1px solid #DCFCE7', borderRadius: 16 }}>
              <p style={{ fontSize: 12, fontWeight: 800, color: '#007A5E', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
                🔒 Privacy Note
              </p>
              <p style={{ fontSize: 13, color: '#64748B', lineHeight: 1.6, margin: 0 }}>
                Your contact form submission is sent directly to our team. We never share your information with third parties. See our{' '}
                <a href="/privacy" style={{ color: '#007A5E', fontWeight: 600 }}>Privacy Policy</a>.
              </p>
            </div>
          </div>

          {/* ── Right: form ── */}
          <div>
            {status === 'success' ? (
              <div style={{ padding: '56px 32px', background: '#F0FDF4', border: '1px solid #DCFCE7', borderRadius: 24, textAlign: 'center', animation: 'fadeInUp 0.4s ease' }}>
                <div style={{ fontSize: 52, marginBottom: 16 }}>✅</div>
                <h2 style={{ fontSize: 26, fontWeight: 950, color: '#0F172A', marginBottom: 10 }}>Message Sent!</h2>
                <p style={{ fontSize: 15, color: '#64748B', lineHeight: 1.7, maxWidth: 360, margin: '0 auto 28px' }}>
                  Thanks for reaching out. We&apos;ll reply to <strong style={{ color: '#0F172A' }}>{form.email || 'your email'}</strong> within 24 hours.
                </p>
                <button onClick={() => setStatus('idle')} style={{ background: 'linear-gradient(135deg, #007A5E, #059669)', color: 'white', border: 'none', borderRadius: 12, padding: '12px 28px', fontWeight: 700, fontSize: 14, cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,122,94,0.25)' }}>
                  Send Another Message
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} style={{ background: '#FAFAFA', border: '1px solid #E2E8F0', borderRadius: 24, padding: '40px 36px', display: 'flex', flexDirection: 'column', gap: 22, boxShadow: '0 2px 16px rgba(0,0,0,0.04)' }}>
                <div>
                  <h2 style={{ fontSize: 20, fontWeight: 800, color: '#0F172A', marginBottom: 4 }}>Send us a message</h2>
                  <p style={{ fontSize: 13, color: '#94A3B8', margin: 0 }}>All fields marked * are required.</p>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }} className="form-row">
                  <div>
                    <label style={labelStyle}>Full Name *</label>
                    <input type="text" required value={form.name} onChange={e => set('name', e.target.value)} placeholder="Jane Smith" style={inputStyle} className="contact-input" />
                  </div>
                  <div>
                    <label style={labelStyle}>Email Address *</label>
                    <input type="email" required value={form.email} onChange={e => set('email', e.target.value)} placeholder="jane@company.com" style={inputStyle} className="contact-input" />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }} className="form-row">
                  <div>
                    <label style={labelStyle}>Company / Organisation</label>
                    <input type="text" value={form.company} onChange={e => set('company', e.target.value)} placeholder="Acme Corp (optional)" style={inputStyle} className="contact-input" />
                  </div>
                  <div>
                    <label style={labelStyle}>Inquiry Type *</label>
                    <select value={form.type} onChange={e => set('type', e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }} className="contact-input">
                      {INQUIRY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                </div>

                <div>
                  <label style={labelStyle}>Subject</label>
                  <input type="text" value={form.subject} onChange={e => set('subject', e.target.value)} placeholder="Brief description of your inquiry" style={inputStyle} className="contact-input" />
                </div>

                <div>
                  <label style={labelStyle}>Message *</label>
                  <textarea required value={form.message} onChange={e => set('message', e.target.value)} placeholder="Tell us what you need. The more detail you provide, the faster we can help." rows={6} style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.6 }} className="contact-input" />
                </div>

                {status === 'error' && (
                  <div style={{ padding: '12px 16px', background: 'rgba(220,38,38,0.06)', border: '1px solid rgba(220,38,38,0.2)', borderRadius: 10, fontSize: 13, color: '#DC2626', fontWeight: 600 }}>
                    ⚠️ {errorMsg}
                  </div>
                )}

                <button type="submit" disabled={status === 'sending' || !form.name || !form.email || !form.message} style={{ background: status === 'sending' ? '#6EE7B7' : 'linear-gradient(135deg, #007A5E 0%, #059669 100%)', color: 'white', border: 'none', borderRadius: 12, padding: '14px 0', fontWeight: 800, fontSize: 15, cursor: status === 'sending' ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, boxShadow: '0 4px 14px rgba(0,122,94,0.25)', transition: 'all 0.2s', opacity: (!form.name || !form.email || !form.message) ? 0.65 : 1 }}>
                  {status === 'sending' ? (
                    <><span style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: 'white', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.7s linear infinite' }} />Sending…</>
                  ) : '📬 Send Message'}
                </button>

                <p style={{ fontSize: 12, color: '#94A3B8', textAlign: 'center', margin: 0 }}>
                  Your message is sent to our team at <span style={{ fontWeight: 700, color: '#64748B' }}>noreply.hvel@gmail.com</span>
                </p>
              </form>
            )}
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}
