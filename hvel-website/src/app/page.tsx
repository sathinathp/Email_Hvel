'use client';

import { useState, useEffect, useRef } from 'react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { EXTENSION_DOWNLOAD_URL } from '@/lib/constants';

interface MousePoint {
  x: number;
  y: number;
  t: number;
}

export default function Home() {
  // Load premium typography fonts
  useEffect(() => {
    const link = document.createElement('link');
    link.href = 'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;700&display=swap';
    link.rel = 'stylesheet';
    document.head.appendChild(link);
    return () => {
      document.head.removeChild(link);
    };
  }, []);

  // Sandbox State
  const [points, setPoints] = useState<MousePoint[]>([]);
  const [isTracking, setIsTracking] = useState(false);
  const [stats, setStats] = useState({
    coords: 'X: 0px, Y: 0px',
    velocity: '0.00 px/ms',
    speedStdDev: '0.0000 px/ms',
    avgDeviation: '0.000 px',
    steeringEntropy: '0.000 rad',
    verdict: 'Waiting for cursor path...',
  });

  // Interactive Workflow Animation State
  const [workflowStep, setWorkflowStep] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setWorkflowStep((prev) => (prev + 1) % 4);
    }, 4500);
    return () => clearInterval(timer);
  }, []);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const trackingAreaRef = useRef<HTMLDivElement | null>(null);
  const animationRef = useRef<number | null>(null);
  const pointsRef = useRef<MousePoint[]>([]);

  // Handle canvas resizing dynamically using ResizeObserver
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const rect = entry.contentRect;

      if (rect.width > 0 && rect.height > 0) {
        canvas.width = rect.width;
        canvas.height = rect.height;

        const ctx = canvas.getContext('2d');
        if (ctx && pointsRef.current.length >= 2) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.beginPath();
          ctx.moveTo(pointsRef.current[0].x, pointsRef.current[0].y);
          for (let i = 1; i < pointsRef.current.length; i++) {
            ctx.lineTo(pointsRef.current[i].x, pointsRef.current[i].y);
          }
          ctx.strokeStyle = '#2563EB';
          ctx.lineWidth = 3.5;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.stroke();

          const last = pointsRef.current[pointsRef.current.length - 1];
          ctx.beginPath();
          ctx.arc(last.x, last.y, 5, 0, 2 * Math.PI);
          ctx.fillStyle = '#1D4ED8';
          ctx.fill();
        }
      }
    });

    resizeObserver.observe(canvas);
    return () => resizeObserver.disconnect();
  }, []);

  // Draw sandbox trails
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (points.length < 2) return;

    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.strokeStyle = '#2563EB';
    ctx.lineWidth = 3.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();

    const last = points[points.length - 1];
    ctx.beginPath();
    ctx.arc(last.x, last.y, 5, 0, 2 * Math.PI);
    ctx.fillStyle = '#1D4ED8';
    ctx.fill();
  }, [points]);

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (animationRef.current) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const t = Date.now();

    setIsTracking(true);
    pointsRef.current.push({ x, y, t });
    if (pointsRef.current.length > 50) {
      pointsRef.current.shift();
    }
    const updated = [...pointsRef.current];
    setPoints(updated);
    analyzePoints(updated);
  };

  const handlePointerLeave = () => {
    setIsTracking(false);
  };

  const resetCanvas = () => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    pointsRef.current = [];
    setPoints([]);
    setStats({
      coords: 'X: 0px, Y: 0px',
      velocity: '0.00 px/ms',
      speedStdDev: '0.0000 px/ms',
      avgDeviation: '0.000 px',
      steeringEntropy: '0.000 rad',
      verdict: 'Waiting for cursor path...',
    });
  };

  const analyzePoints = (pts: MousePoint[]) => {
    if (pts.length < 5) {
      setStats((prev) => ({
        ...prev,
        coords: `X: ${pts[pts.length - 1]?.x.toFixed(0) || 0}px, Y: ${pts[pts.length - 1]?.y.toFixed(0) || 0}px`,
        verdict: 'Analyzing gesture curves...',
      }));
      return;
    }

    const start = pts[0];
    const end = pts[pts.length - 1];
    const displacement = Math.sqrt(Math.pow(end.x - start.x, 2) + Math.pow(end.y - start.y, 2));

    const A = end.y - start.y;
    const B = start.x - end.x;
    const C = end.x * start.y - start.x * end.y;
    const denom = Math.sqrt(A * A + B * B);

    let totalDeviation = 0;
    for (const p of pts) {
      const dist = denom > 0 ? Math.abs(A * p.x + B * p.y + C) / denom : 0;
      totalDeviation += dist;
    }
    const avgDeviation = totalDeviation / pts.length;

    const speeds: number[] = [];
    let prevPoint = pts[0];
    for (let i = 1; i < pts.length; i++) {
      const curr = pts[i];
      const dx = curr.x - prevPoint.x;
      const dy = curr.y - prevPoint.y;
      const dt = curr.t - prevPoint.t || 1;
      const dist = Math.sqrt(dx * dx + dy * dy);
      speeds.push(dist / dt);
      prevPoint = curr;
    }

    const avgSpeed = speeds.reduce((sum, s) => sum + s, 0) / speeds.length;
    const variance = speeds.reduce((sum, s) => sum + Math.pow(s - avgSpeed, 2), 0) / speeds.length;
    const speedStdDev = Math.sqrt(variance);

    const angles: number[] = [];
    for (let i = 2; i < pts.length; i++) {
      const p1 = pts[i - 2];
      const p2 = pts[i - 1];
      const p3 = pts[i];
      const v1 = { x: p2.x - p1.x, y: p2.y - p1.y };
      const v2 = { x: p3.x - p2.x, y: p3.y - p2.y };
      const dot = v1.x * v2.x + v1.y * v2.y;
      const len1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y);
      const len2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y);
      if (len1 > 0 && len2 > 0) {
        const cos = dot / (len1 * len2);
        const boundedCos = Math.max(-1, Math.min(1, cos));
        angles.push(Math.acos(boundedCos));
      }
    }
    const steeringEntropy = angles.reduce((sum, a) => sum + a, 0);

    let verdict = 'VERIFIED HUMAN (Natural acceleration & micro-jitter)';
    if (displacement > 15) {
      if (avgDeviation < 0.15) {
        verdict = 'FLAGGED AS BOT (Robotic linear path)';
      } else if (speedStdDev < 0.012) {
        verdict = 'FLAGGED AS BOT (Perfect constant velocity)';
      } else if (steeringEntropy < 0.012) {
        verdict = 'FLAGGED AS BOT (No directional deviation)';
      }
    }

    setStats({
      coords: `X: ${end.x.toFixed(0)}px, Y: ${end.y.toFixed(0)}px`,
      velocity: `${avgSpeed.toFixed(2)} px/ms`,
      speedStdDev: `${speedStdDev.toFixed(4)} px/ms`,
      avgDeviation: `${avgDeviation.toFixed(3)} px`,
      steeringEntropy: `${steeringEntropy.toFixed(3)} rad`,
      verdict,
    });
  };

  const simulateBot = () => {
    resetCanvas();
    const canvas = canvasRef.current;
    if (!canvas) return;

    const startX = 40;
    const startY = canvas.height / 3;
    const endX = canvas.width - 40;
    const endY = (canvas.height / 3) * 2;

    const duration = 1000;
    const steps = 30;
    const startTime = Date.now();
    let currentStep = 0;

    const run = () => {
      if (currentStep > steps) {
        animationRef.current = null;
        return;
      }
      const ratio = currentStep / steps;
      const x = startX + (endX - startX) * ratio;
      const y = startY + (endY - startY) * ratio;
      const t = startTime + (duration * ratio);

      pointsRef.current.push({ x, y, t });
      const updated = [...pointsRef.current];
      setPoints(updated);
      analyzePoints(updated);

      currentStep++;
      animationRef.current = requestAnimationFrame(run);
    };

    animationRef.current = requestAnimationFrame(run);
  };

  return (
    <main
      className="min-h-screen bg-white"
      style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", color: '#0F172A', overflowX: 'hidden' }}
    >
      {/* Dynamic Keyframes & CSS Custom Injections */}
      <style dangerouslySetInnerHTML={{
        __html: `
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulseDot {
          0% { transform: scale(0.95); opacity: 0.8; }
          50% { transform: scale(1.4); opacity: 0.15; }
          100% { transform: scale(0.95); opacity: 0.8; }
        }
        .premium-shadow {
          box-shadow: 0 10px 30px -10px rgba(0, 0, 0, 0.04), 0 1px 3px rgba(0, 0, 0, 0.02);
        }
        .premium-shadow-lg {
          box-shadow: 0 20px 40px -15px rgba(0, 0, 0, 0.06), 0 1px 3px rgba(0, 0, 0, 0.02);
        }
        .btn-hover:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 20px -6px rgba(37,99,235,0.4);
        }
        .logo-grayscale {
          filter: grayscale(100%);
          opacity: 0.6;
          transition: all 0.3s;
        }
        .logo-grayscale:hover {
          filter: grayscale(0%);
          opacity: 1;
        }
        .container-custom {
          max-width: 1200px;
          margin: 0 auto;
          padding: 0 24px;
        }
        .hover-lift {
          transition: transform 0.25s ease, box-shadow 0.25s ease;
        }
        .hover-lift:hover {
          transform: translateY(-4px);
        }
      `}} />

      {/* ── TOP ANNOUNCEMENT BAR (SEO Studio Style) ── */}
      <div style={{ background: '#2563EB', color: '#ffffff', textAlign: 'center', padding: '12px 24px', fontSize: 13, fontWeight: 700, letterSpacing: '0.02em' }}>
        🛡️ Verify Human Participation securely. Protect your organization against AI outbox hijacking instantly.{' '}
        <a href="#sandbox-section" style={{ color: '#ffffff', textDecoration: 'underline', marginLeft: 6, fontWeight: 800 }}>
          Try the Whiteboard Sandbox →
        </a>
      </div>

      <Navbar />

      {/* ── HERO SECTION ── */}
      <section style={{ paddingTop: 80, paddingBottom: 96, background: 'linear-gradient(180deg, #F8FAFC 0%, #FFFFFF 100%)', position: 'relative', overflow: 'hidden' }}>

        {/* Subtle grid pattern overlay */}
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(rgba(37, 99, 235, 0.08) 1px, transparent 1px)', backgroundSize: '32px 32px', opacity: 0.5, pointerEvents: 'none' }} />

        <div className="container-custom" style={{ position: 'relative', zIndex: 2 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 64, alignItems: 'center' }}>

            {/* Left Column: Authentic Copy & Typography */}
            <div>
              {/* Rounded Blue Badge */}
              <div style={{ background: '#EFF6FF', border: '1px solid #DBEAFE', color: '#2563EB', display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 16px', borderRadius: 9999, fontSize: 12, fontWeight: 700, marginBottom: 24, letterSpacing: '0.03em', textTransform: 'uppercase' }}>
                🛡️ #1 secure email verified protocol
              </div>

              <h1 style={{ fontSize: 'clamp(38px, 4.5vw, 56px)', fontWeight: 900, lineHeight: 1.15, color: '#0F172A', letterSpacing: '-0.04em' }}>
                Add Proof of Human <br />
                Intent for Every Email <br />
                in the Era of AI.
              </h1>

              <p style={{ fontSize: 17, color: '#475569', lineHeight: 1.6, marginTop: 24, marginBottom: 32, maxWidth: 540, fontWeight: 500 }}>
                Let Attest verify that a real person intentionally sent an email or message without ever reading content, interrupting workflows, or requiring complex integrations.
              </p>

              {/* CTAs Styled exactly like SEO Studio */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center' }}>
                <a
                  href={EXTENSION_DOWNLOAD_URL}
                  className="btn-hover"
                  style={{ background: '#2563EB', color: '#ffffff', padding: '16px 32px', borderRadius: 8, fontWeight: 700, textDecoration: 'none', transition: 'all 0.2s', display: 'inline-flex', alignItems: 'center', gap: 8, border: 'none', fontSize: 15 }}
                >
                  Download Extension
                  <span style={{ fontSize: 16 }}>→</span>
                </a>
                <button
                  onClick={() => {
                    const el = document.getElementById('problem-intro-section');
                    if (el) {
                      el.scrollIntoView({ behavior: 'smooth' });
                    }
                  }}
                  style={{ background: '#ffffff', color: '#475569', border: '1px solid #D1D5DB', padding: '16px 32px', borderRadius: 8, fontWeight: 700, transition: 'all 0.2s', cursor: 'pointer', fontFamily: 'inherit', fontSize: 15, display: 'inline-flex', alignItems: 'center' }}
                >
                  See How it Works
                </button>
              </div>

              {/* Trust Indicators below the Buttons */}
              <div style={{ marginTop: 24, display: 'flex', flexWrap: 'wrap', gap: '12px 24px', color: '#64748B', fontSize: 13, fontWeight: 600 }}>
                {[
                  'Verify Human Participation',
                  'Privacy-First Design',
                  'Never Reads Email',
                  'One Click Integration'
                ].map((item) => (
                  <div key={item} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ color: '#2563EB', fontSize: 14 }}>✓</span>
                    {item}
                  </div>
                ))}
              </div>


            </div>

            {/* Right Column: Workflow Interactive Animation (Styled like SEO Studio console) */}
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <div
                style={{
                  background: '#ffffff',
                  border: '1px solid #E2E8F0',
                  borderRadius: 24,
                  padding: 0,
                  width: '100%',
                  maxWidth: 460,
                  position: 'relative',
                  overflow: 'hidden'
                }}
                className="premium-shadow-lg"
              >
                {/* Step Indicators Header */}
                <div style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 4 }}>
                  {[
                    { step: 0, label: '1. Intercept' },
                    { step: 1, label: '2. Verify' },
                    { step: 2, label: '3. Cryptography' },
                    { step: 3, label: '4. Stamp' }
                  ].map((s) => {
                    const isActive = workflowStep === s.step;
                    return (
                      <button
                        key={s.step}
                        onClick={() => setWorkflowStep(s.step)}
                        style={{
                          background: isActive ? '#2563EB' : 'transparent',
                          color: isActive ? '#ffffff' : '#64748B',
                          border: 'none',
                          padding: '6px 12px',
                          borderRadius: 6,
                          fontSize: 11,
                          fontWeight: 700,
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                          outline: 'none'
                        }}
                      >
                        {s.label}
                      </button>
                    );
                  })}
                </div>

                {/* Central Animation Area */}
                <div style={{ height: 280, padding: 24, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', background: '#ffffff', position: 'relative' }}>

                  {/* STEP 1: Click Send */}
                  {workflowStep === 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, height: '100%', justifyContent: 'center', animation: 'fadeIn 0.3s' }}>
                      <div style={{ fontSize: 11, fontWeight: 800, color: '#2563EB', textTransform: 'uppercase', letterSpacing: '0.05em' }}>GMAIL OUTBOX INTERCEPTION</div>
                      <div style={{ background: '#ffffff', border: '1px solid #E2E8F0', borderRadius: 12, padding: 14, position: 'relative', overflow: 'hidden' }} className="premium-shadow">
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 11 }}>
                          <div><strong style={{ color: '#2563EB' }}>To:</strong> partner@firm.com</div>
                          <div><strong style={{ color: '#2563EB' }}>Subject:</strong> Secure Transaction payload</div>
                          <div style={{ borderTop: '1px solid #E2E8F0', paddingTop: 6, color: '#64748B' }}>
                            Please review the attached release payload...
                          </div>
                        </div>
                        {/* Send Button */}
                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
                          <div style={{ background: '#2563EB', color: 'white', padding: '6px 14px', borderRadius: 6, fontSize: 11, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', position: 'relative' }}>
                            Send 📤
                            {/* Glowing Click indicator */}
                            <div style={{ position: 'absolute', right: -6, bottom: -6, width: 16, height: 16, borderRadius: '50%', background: 'rgba(37, 99, 235, 0.4)', animation: 'pulseDot 1.5s infinite' }} />
                          </div>
                        </div>
                      </div>
                      <p style={{ fontSize: 12, color: '#64748B', margin: 0, lineHeight: 1.4, fontWeight: 500 }}>
                        When any process tries to trigger a "Send" action on Gmail, Attest intercepts and pauses it instantly in the browser.
                      </p>
                    </div>
                  )}

                  {/* STEP 2: Calibrate */}
                  {workflowStep === 1 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, height: '100%', justifyContent: 'center', animation: 'fadeIn 0.3s' }}>
                      <div style={{ fontSize: 11, fontWeight: 800, color: '#2563EB', textTransform: 'uppercase', letterSpacing: '0.05em' }}>KINETIC CALIBRATION POPUP</div>
                      <div style={{ background: '#ffffff', border: '1px solid #E2E8F0', borderRadius: 12, padding: 12, position: 'relative' }} className="premium-shadow">
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #F1F5F9', paddingBottom: 6, marginBottom: 8 }}>
                          <span style={{ fontSize: 11, fontWeight: 800, color: '#0F172A' }}>🛡️ Attest verification</span>
                          <span style={{ fontSize: 9, background: '#2563EB', color: '#ffffff', padding: '2px 6px', borderRadius: 4, fontWeight: 800 }}>ACTIVE</span>
                        </div>
                        {/* Simulation grid */}
                        <div style={{ height: 70, background: '#F8FAFC', border: '1px dashed #CBD5E1', borderRadius: 8, position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <svg width="180" height="40" style={{ opacity: 0.7 }}>
                            <path d="M 10 20 Q 50 5, 90 20 T 170 20" fill="none" stroke="#2563EB" strokeWidth="2.5" strokeDasharray="4 4" />
                            {/* Animated Cursor dot moving */}
                            <circle r="4" fill="#2563EB">
                              <animateMotion dur="2.5s" repeatCount="indefinite" path="M 10 20 Q 50 5, 90 20 T 170 20" />
                            </circle>
                          </svg>
                          <span style={{ position: 'absolute', bottom: 4, right: 6, fontSize: 8, fontFamily: "'JetBrains Mono', monospace", color: '#64748B' }}>Analyzing...</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, marginTop: 6, fontFamily: "'JetBrains Mono', monospace", color: '#64748B' }}>
                          <span>Jitter: Natural (0.019)</span>
                          <span style={{ color: '#16A34A', fontWeight: 700 }}>VERDICT: PASSED</span>
                        </div>
                      </div>
                      <p style={{ fontSize: 12, color: '#64748B', margin: 0, lineHeight: 1.4, fontWeight: 500 }}>
                        A fast, local calibration popup requires a simple cursor curve trace to mathematically distinguish human movement from a script.
                      </p>
                    </div>
                  )}

                  {/* STEP 3: Release */}
                  {workflowStep === 2 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, height: '100%', justifyContent: 'center', animation: 'fadeIn 0.3s' }}>
                      <div style={{ fontSize: 11, fontWeight: 800, color: '#2563EB', textTransform: 'uppercase', letterSpacing: '0.05em' }}>CRYPTOGRAPHIC STAMP RELEASE</div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, background: '#ffffff', border: '1px solid #E2E8F0', borderRadius: 12, padding: 16 }} className="premium-shadow">
                        <div style={{ fontSize: 32 }}>🔑</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <span style={{ fontSize: 10, fontWeight: 800, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>RELEASE TOKEN</span>
                          <span style={{ fontSize: 10, fontFamily: "'JetBrains Mono', monospace", background: '#F8FAFC', padding: '4px 8px', borderRadius: 4, border: '1px solid #E2E8F0', color: '#2563EB' }}>
                            SHA-256: 4f8d5e9e...
                          </span>
                        </div>
                      </div>
                      <p style={{ fontSize: 12, color: '#64748B', margin: 0, lineHeight: 1.4, fontWeight: 500 }}>
                        Once verified, a cryptographic hash release token is appended to the email header and it is instantly released into the mail server.
                      </p>
                    </div>
                  )}

                  {/* STEP 4: Verified */}
                  {workflowStep === 3 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, height: '100%', justifyContent: 'center', animation: 'fadeIn 0.3s' }}>
                      <div style={{ fontSize: 11, fontWeight: 800, color: '#2563EB', textTransform: 'uppercase', letterSpacing: '0.05em' }}>RECIPIENT TRUST STAMP</div>
                      <div style={{ background: '#ffffff', border: '1px solid #E2E8F0', borderRadius: 12, padding: 14 }} className="premium-shadow">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, borderBottom: '1px solid #F1F5F9', paddingBottom: 8, marginBottom: 8 }}>
                          <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#16A34A' }} />
                          <strong style={{ color: '#0F172A' }}>From: CEO (ceo@company.com)</strong>
                        </div>
                        {/* Glowing Verified Badge */}
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#ECFDF5', border: '1px solid #A7F3D0', padding: '6px 12px', borderRadius: 8 }}>
                          <span style={{ fontSize: 12 }}>🛡️</span>
                          <span style={{ fontSize: 10, fontWeight: 950, color: '#047857', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Verified Human Attestation</span>
                        </div>
                      </div>
                      <p style={{ fontSize: 12, color: '#64748B', margin: 0, lineHeight: 1.4, fontWeight: 500 }}>
                        The recipient’s inbox displays a verified signature stamp, proving the email was sent by a physical human session.
                      </p>
                    </div>
                  )}

                </div>
              </div>
            </div>

          </div>
        </div>
      </section>



      {/* ── PROBLEM / LIMITATION / SOLUTION SECTION (Problem Matrix) ── */}
      <section id="problem-intro-section" style={{ padding: '96px 24px', background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
        <div className="container-custom">

          <div style={{ textAlign: 'center', marginBottom: 64, maxWidth: 800, margin: '0 auto 64px auto' }}>
            <span style={{ fontSize: 13, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.15em', color: '#2563EB', display: 'block', marginBottom: 12 }}>
              THE REALITY OF DIGITAL IDENTITY
            </span>
            <h2 style={{ fontSize: 'clamp(30px, 3.8vw, 42px)', fontWeight: 900, color: '#0F172A', letterSpacing: '-0.03em', lineHeight: 1.15, margin: 0 }}>
              As AI Agents Scale, Human Authenticity Becomes Harder to Prove. Attest Solves That.
            </h2>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 24 }}>
            {/* PROBLEM CARD */}
            <div
              style={{
                background: '#ffffff',
                borderRadius: 16,
                border: '1px solid #E2E8F0',
                padding: 36,
                display: 'flex',
                flexDirection: 'column',
                gap: 18
              }}
              className="premium-shadow"
            >
              <div style={{ width: 48, height: 48, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, background: '#FEF2F2', color: '#EF4444' }}>
                ⚠️
              </div>
              <h3 style={{ fontSize: 19, fontWeight: 800, color: '#0F172A', margin: 0 }}>
                Problem
              </h3>
              <p style={{ fontSize: 14, color: '#64748B', lineHeight: 1.6, margin: 0, fontWeight: 500 }}>
                AI-generated communication is becoming increasingly difficult to distinguish from human communication.
              </p>
            </div>

            {/* LIMITATION CARD */}
            <div
              style={{
                background: '#ffffff',
                borderRadius: 16,
                border: '1px solid #E2E8F0',
                padding: 36,
                display: 'flex',
                flexDirection: 'column',
                gap: 18
              }}
              className="premium-shadow"
            >
              <div style={{ width: 48, height: 48, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, background: '#FFFBEB', color: '#F59E0B' }}>
                🔒
              </div>
              <h3 style={{ fontSize: 19, fontWeight: 800, color: '#0F172A', margin: 0 }}>
                Limitation of Current Systems
              </h3>
              <p style={{ fontSize: 14, color: '#64748B', lineHeight: 1.6, margin: 0, fontWeight: 500 }}>
                Existing authentication can verify systems and senders, but not human intent.
              </p>
            </div>

            {/* HOW ATTEST SOLVES IT CARD */}
            <div
              style={{
                background: '#ffffff',
                borderRadius: 16,
                border: '1px solid #E2E8F0',
                padding: 36,
                display: 'flex',
                flexDirection: 'column',
                gap: 18
              }}
              className="premium-shadow"
            >
              <div style={{ width: 48, height: 48, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, background: '#ECFDF5', color: '#10B981' }}>
                🛡️
              </div>
              <h3 style={{ fontSize: 19, fontWeight: 800, color: '#0F172A', margin: 0 }}>
                How Attest Solves It
              </h3>
              <p style={{ fontSize: 14, color: '#64748B', lineHeight: 1.6, margin: 0, fontWeight: 500 }}>
                Attest verifies real human interaction like active keyboard & mouse behavior & adds a trusted human-authenticated signature.
              </p>
            </div>
          </div>

        </div>
      </section>

      {/* ── THE THREAT & SAFEGUARD SPLIT MATRIX ── */}
      <section style={{ padding: '96px 24px', background: '#ffffff' }}>
        <div className="container-custom">

          <div style={{ textAlign: 'center', marginBottom: 64 }}>
            <span style={{ fontSize: 13, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.15em', color: '#2563EB', display: 'block', marginBottom: 12 }}>
              THE PROBLEM &amp; THE SOLUTION
            </span>
            <h2 style={{ fontSize: 'clamp(30px, 3.8vw, 42px)', fontWeight: 900, color: '#0F172A', letterSpacing: '-0.03em', lineHeight: 1.15, margin: 0 }}>
              Digital communication is losing trust.
            </h2>
            <p style={{ fontSize: 16, color: '#64748B', margin: '16px auto 0 auto', maxWidth: 600, fontWeight: 500, lineHeight: 1.6 }}>
              Attest brings back trust with human verification at every step.
            </p>
          </div>

          <div style={{ border: '1px solid #E2E8F0', borderRadius: 24, overflow: 'hidden', background: '#ffffff' }} className="premium-shadow-lg">
            {[
              {
                issueTitle: 'AI-generated emails flood inboxes',
                issueDesc: 'Autonomous software agents send thousands of perfectly worded emails with zero human involvement. Recipients have no reliable way to verify presence.',
                solutionTitle: 'Human activity verification',
                solDesc: 'Attest captures and traces natural physical cursor velocity, path deviations, and steering configurations at the exact moment of click.',
                problemIcon: (
                  <svg width="56" height="56" viewBox="0 0 56 56" fill="none">
                    <circle cx="28" cy="28" r="24" fill="#FEF2F2" />
                    <circle cx="28" cy="28" r="27" stroke="#FECACA" strokeWidth="1" strokeDasharray="3 3" opacity="0.6" />
                    <circle cx="8" cy="16" r="2" fill="#EF4444" opacity="0.5" />
                    <circle cx="48" cy="40" r="1.5" fill="#EF4444" opacity="0.5" />
                    <rect x="16" y="20" width="24" height="16" rx="2" stroke="#475569" strokeWidth="2.5" fill="#ffffff" />
                    <path d="M16 22l12 8 12-8" stroke="#475569" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                    <circle cx="40" cy="34" r="7.5" fill="#EF4444" />
                    <text x="40" y="34.5" textAnchor="middle" dominantBaseline="middle" fill="#ffffff" fontSize="10" fontWeight="950" fontFamily="system-ui, sans-serif">!</text>
                  </svg>
                ),
                solutionIcon: (
                  <svg width="56" height="56" viewBox="0 0 56 56" fill="none">
                    <circle cx="28" cy="28" r="24" fill="#ECFDF5" />
                    <circle cx="28" cy="28" r="27" stroke="#A7F3D0" strokeWidth="1" strokeDasharray="3 3" opacity="0.6" />
                    <circle cx="8" cy="16" r="2" fill="#10B981" opacity="0.5" />
                    <circle cx="48" cy="40" r="1.5" fill="#10B981" opacity="0.5" />
                    <rect x="16" y="18" width="24" height="20" rx="3" stroke="#475569" strokeWidth="2.5" fill="#ffffff" />
                    <line x1="16" y1="24" x2="40" y2="24" stroke="#475569" strokeWidth="2" />
                    <circle cx="20" cy="21" r="1" fill="#475569" />
                    <circle cx="23" cy="21" r="1" fill="#475569" />
                    <circle cx="26" cy="21" r="1" fill="#475569" />
                    <circle cx="28" cy="29" r="3.5" fill="#475569" />
                    <path d="M22 36c0-3 3-4 6-4s6 1 6 4" stroke="#475569" strokeWidth="2" strokeLinecap="round" />
                    <circle cx="40" cy="34" r="7.5" fill="#10B981" />
                    <path d="M37 34l2 2 4-4" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )
              },
              {
                issueTitle: 'Impersonation and spoofed senders',
                issueDesc: 'Attackers spoof corporate email identities to bypass standard filters, impersonating leadership or legal representatives with full credentials.',
                solutionTitle: 'Human-attested signature layer',
                solDesc: 'Add cryptographic signature header stamps that can only be generated through real, physical user calibration on local systems.',
                problemIcon: (
                  <svg width="56" height="56" viewBox="0 0 56 56" fill="none">
                    <circle cx="28" cy="28" r="24" fill="#FEF2F2" />
                    <circle cx="28" cy="28" r="27" stroke="#FECACA" strokeWidth="1" strokeDasharray="3 3" opacity="0.6" />
                    <circle cx="8" cy="16" r="2" fill="#EF4444" opacity="0.5" />
                    <circle cx="48" cy="40" r="1.5" fill="#EF4444" opacity="0.5" />
                    <mask id="hacker-mask">
                      <circle cx="28" cy="28" r="18" fill="#ffffff" />
                    </mask>
                    <g mask="url(#hacker-mask)">
                      <path d="M28 14c-6.5 0-10 5-10 11c0 3.5 2.5 8 2.5 8s.5-3.5 3-4.5c2-1 3-3 4.5-3s2.5 2 4.5 3c2.5 1 3 4.5 3 4.5s2.5-4.5 2.5-8c0-6-3.5-11-10-11z" fill="#1E293B" />
                      <circle cx="28" cy="25" r="3.5" fill="#F8FAFC" />
                      <path d="M24.5 25h7" stroke="#1E293B" strokeWidth="1.5" />
                      <rect x="22" y="23" width="12" height="4" rx="2" fill="#1E293B" />
                      <circle cx="25.5" cy="25" r="1" fill="#ffffff" />
                      <circle cx="30.5" cy="25" r="1" fill="#ffffff" />
                      <path d="M16 38c0-5 5-7 12-7s12 2 12 7" stroke="#1E293B" strokeWidth="2.5" fill="#1E293B" />
                    </g>
                    <circle cx="40" cy="34" r="7.5" fill="#EF4444" />
                    <text x="40" y="34.5" textAnchor="middle" dominantBaseline="middle" fill="#ffffff" fontSize="10" fontWeight="950" fontFamily="system-ui, sans-serif">!</text>
                  </svg>
                ),
                solutionIcon: (
                  <svg width="56" height="56" viewBox="0 0 56 56" fill="none">
                    <circle cx="28" cy="28" r="24" fill="#ECFDF5" />
                    <circle cx="28" cy="28" r="27" stroke="#A7F3D0" strokeWidth="1" strokeDasharray="3 3" opacity="0.6" />
                    <circle cx="8" cy="16" r="2" fill="#10B981" opacity="0.5" />
                    <circle cx="48" cy="40" r="1.5" fill="#10B981" opacity="0.5" />
                    <rect x="18" y="16" width="20" height="24" rx="2" stroke="#475569" strokeWidth="2.5" fill="#ffffff" />
                    <line x1="22" y1="22" x2="34" y2="22" stroke="#94A3B8" strokeWidth="2" />
                    <line x1="22" y1="26" x2="30" y2="26" stroke="#94A3B8" strokeWidth="2" />
                    <path d="M22 33 q 2 -4 4 -2 t 3 1 t 2 -3 t 3 2" stroke="#10B981" strokeWidth="2" fill="none" strokeLinecap="round" />
                    <circle cx="40" cy="34" r="7.5" fill="#10B981" />
                    <path d="M37 34l2 2 4-4" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )
              },
              {
                issueTitle: 'Authentication verifies domains, not humans',
                issueDesc: 'Standard algorithms prove server authorization records—leaving a massive structural gap between email servers and physical senders.',
                solutionTitle: 'Verified intent proof layer',
                solDesc: 'Trace the physical send actions dynamically, sealing the gap between server credentials and the actual human session.',
                problemIcon: (
                  <svg width="56" height="56" viewBox="0 0 56 56" fill="none">
                    <circle cx="28" cy="28" r="24" fill="#FEF2F2" />
                    <circle cx="28" cy="28" r="27" stroke="#FECACA" strokeWidth="1" strokeDasharray="3 3" opacity="0.6" />
                    <circle cx="8" cy="16" r="2" fill="#EF4444" opacity="0.5" />
                    <circle cx="48" cy="40" r="1.5" fill="#EF4444" opacity="0.5" />
                    <circle cx="26" cy="26" r="10" stroke="#475569" strokeWidth="2" fill="#ffffff" />
                    <path d="M16 26h20" stroke="#475569" strokeWidth="1.5" />
                    <path d="M26 16c3 3 4 7 4 10s-1 7-4 10c-3-3-4-7-4-10s1-7 4-10z" stroke="#475569" strokeWidth="1.5" fill="none" />
                    <circle cx="38" cy="34" r="7.5" fill="#EF4444" />
                    <rect x="35" y="33" width="6" height="5" rx="1" fill="#ffffff" />
                    <path d="M36 33v-2a2 2 0 114 0v2" stroke="#ffffff" strokeWidth="1.2" fill="none" />
                  </svg>
                ),
                solutionIcon: (
                  <svg width="56" height="56" viewBox="0 0 56 56" fill="none">
                    <circle cx="28" cy="28" r="24" fill="#ECFDF5" />
                    <circle cx="28" cy="28" r="27" stroke="#A7F3D0" strokeWidth="1" strokeDasharray="3 3" opacity="0.6" />
                    <circle cx="8" cy="16" r="2" fill="#10B981" opacity="0.5" />
                    <circle cx="48" cy="40" r="1.5" fill="#10B981" opacity="0.5" />
                    <path d="M28 16c6 0 10 3 10 3s0 9-2 13c-2.5 5-8 7-8 7s-5.5-2-8-7c-2-4-2-13-2-13s4-3 10-3z" stroke="#047857" strokeWidth="2.5" fill="#ffffff" strokeLinejoin="round" />
                    <path d="M24 27l3 3 5-5" stroke="#10B981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )
              },
              {
                issueTitle: 'Billing and payment invoice fraud',
                issueDesc: 'Wire-transfer approvals and banking instructions are modified through active browser hijacking scripts, looking completely genuine.',
                solutionTitle: 'Verifiable physical approval trail',
                solDesc: 'Protect high-value outbox operations by forcing physical calibration checks, preventing autonomous scripts from dispatching orders.',
                problemIcon: (
                  <svg width="56" height="56" viewBox="0 0 56 56" fill="none">
                    <circle cx="28" cy="28" r="24" fill="#FEF2F2" />
                    <circle cx="28" cy="28" r="27" stroke="#FECACA" strokeWidth="1" strokeDasharray="3 3" opacity="0.6" />
                    <circle cx="8" cy="16" r="2" fill="#EF4444" opacity="0.5" />
                    <circle cx="48" cy="40" r="1.5" fill="#EF4444" opacity="0.5" />
                    <rect x="18" y="16" width="18" height="24" rx="2" stroke="#475569" strokeWidth="2.5" fill="#ffffff" />
                    <line x1="22" y1="21" x2="32" y2="21" stroke="#94A3B8" strokeWidth="2" />
                    <line x1="22" y1="25" x2="30" y2="25" stroke="#94A3B8" strokeWidth="2" />
                    <line x1="22" y1="29" x2="26" y2="29" stroke="#94A3B8" strokeWidth="2" />
                    <circle cx="38" cy="34" r="7.5" fill="#EF4444" />
                    <text x="38" y="34.5" textAnchor="middle" dominantBaseline="middle" fill="#ffffff" fontSize="9" fontWeight="950" fontFamily="system-ui, sans-serif">$</text>
                  </svg>
                ),
                solutionIcon: (
                  <svg width="56" height="56" viewBox="0 0 56 56" fill="none">
                    <circle cx="28" cy="28" r="24" fill="#ECFDF5" />
                    <circle cx="28" cy="28" r="27" stroke="#A7F3D0" strokeWidth="1" strokeDasharray="3 3" opacity="0.6" />
                    <circle cx="8" cy="16" r="2" fill="#10B981" opacity="0.5" />
                    <circle cx="48" cy="40" r="1.5" fill="#10B981" opacity="0.5" />
                    <path d="M16 36h24v2H16zm3-12h2v12h-2zm5 0h2v12h-2zm5 0h2v12h-2zm5 0h2v12h-2zm-16-4l12-5 12 5z" stroke="#047857" strokeWidth="2" fill="#ffffff" strokeLinejoin="round" />
                    <circle cx="40" cy="34" r="7.5" fill="#10B981" />
                    <path d="M37 34l2 2 4-4" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )
              }
            ].map((row, idx) => (
              <div
                key={idx}
                className="split-matrix-row"
                style={{
                  borderBottom: idx === 3 ? 'none' : '1px solid #E2E8F0',
                }}
              >
                {/* Left Side: Problem Column */}
                <div className="split-matrix-left-col" style={{ display: 'flex', gap: 20, padding: '36px 40px', background: '#ffffff' }}>
                  <div style={{ flexShrink: 0 }}>
                    {row.problemIcon}
                  </div>
                  <div>
                    <div style={{ color: '#EF4444', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
                      PROBLEM
                    </div>
                    <h3 style={{ fontSize: 18, fontWeight: 800, color: '#0F172A', margin: '0 0 8px 0', lineHeight: 1.3 }}>
                      {row.issueTitle}
                    </h3>
                    <p style={{ fontSize: 14, color: '#64748B', lineHeight: 1.6, margin: 0, fontWeight: 500 }}>
                      {row.issueDesc}
                    </p>
                  </div>
                </div>

                {/* Arrow Connector Button */}
                <div className="split-matrix-arrow-container" style={{
                  width: 36,
                  height: 36,
                  borderRadius: '50%',
                  background: '#ffffff',
                  border: '1px solid #E2E8F0',
                  justifyContent: 'center',
                  alignItems: 'center',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.06)'
                }}>
                  <span style={{ color: '#64748B', fontWeight: 800, fontSize: 15 }}>→</span>
                </div>

                {/* Right Side: Solution Column */}
                <div style={{ display: 'flex', gap: 20, padding: '36px 40px', background: '#ffffff' }}>
                  <div style={{ flexShrink: 0 }}>
                    {row.solutionIcon}
                  </div>
                  <div>
                    <div style={{ color: '#10B981', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
                      SOLUTION
                    </div>
                    <h3 style={{ fontSize: 18, fontWeight: 800, color: '#0F172A', margin: '0 0 8px 0', lineHeight: 1.3 }}>
                      {row.solutionTitle}
                    </h3>
                    <p style={{ fontSize: 14, color: '#64748B', lineHeight: 1.6, margin: 0, fontWeight: 500 }}>
                      {row.solDesc}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>

        </div>
      </section>

      {/* ── INTERACTIVE WHITEBOARD SANDBOX (Fully Open, Not in tabs!) ── */}
      <section id="sandbox-section" style={{ padding: '96px 24px', background: '#F8FAFC', borderTop: '1px solid #E2E8F0', borderBottom: '1px solid #E2E8F0' }}>
        <div className="container-custom">
          {/* Header moved outside the column layout to align both cards side-by-side at the same top baseline */}
          <div style={{ marginBottom: 48, maxWidth: 800 }}>
            <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#2563EB', display: 'block', marginBottom: 6 }}>
              Interactive calibration tool
            </span>
            <h2 style={{ fontSize: 32, fontWeight: 900, color: '#0F172A', letterSpacing: '-0.02em', margin: 0 }}>
              Check how a human and a bot will interact.
            </h2>
            <p style={{ color: '#64748B', fontSize: 15, marginTop: 12, lineHeight: 1.6, fontWeight: 500 }}>
              Bots move in mathematically straight lines or uniform speeds. Humans have natural muscle micro-variance, acceleration curves, and steering fluctuations.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 64, alignItems: 'stretch' }}>

            {/* Left Side: Interactive canvas */}
            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              {/* Interactive Canvas Grid (Clean Grid mockup) */}
              <div
                ref={trackingAreaRef}
                onPointerMove={handlePointerMove}
                onPointerLeave={handlePointerLeave}
                style={{
                  width: '100%',
                  height: 280,
                  background: '#ffffff',
                  backgroundImage: 'radial-gradient(rgba(37, 99, 235, 0.12) 1px, transparent 1px)',
                  backgroundSize: '16px 16px',
                  border: '1px solid #E2E8F0',
                  borderRadius: 16,
                  position: 'relative',
                  cursor: 'crosshair',
                  overflow: 'hidden',
                  flexGrow: 1,
                  display: 'flex',
                  flexDirection: 'column'
                }}
                className="premium-shadow"
              >
                <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }} />
                {!isTracking && points.length === 0 && (
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', padding: 24, textAlign: 'center' }}>
                    <span style={{ fontSize: 15, fontWeight: 700, color: '#0F172A' }}>✍️ Draw a trajectory signature in this canvas grid</span>
                    <span style={{ fontSize: 12, color: '#64748B', marginTop: 4, fontWeight: 500 }}>Move your mouse to trace curves, or simulate robotic scripts below</span>
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
                <button
                  onClick={simulateBot}
                  style={{ flex: 1, padding: '12px 18px', background: 'white', border: '1px solid #D1D5DB', color: '#475569', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s' }}
                  className="premium-shadow"
                >
                  🤖 Check how a Bot moves
                </button>
                <button
                  onClick={resetCanvas}
                  style={{ padding: '12px 24px', background: '#2563EB', border: 'none', color: '#ffffff', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s' }}
                  className="premium-shadow"
                >
                  Reset Canvas
                </button>
              </div>
            </div>

            {/* Right Side: Simplified Behavior Analysis Card */}
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ background: '#ffffff', border: '1px solid #E2E8F0', borderRadius: 16, padding: 36, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }} className="premium-shadow">
                <div>
                  <h3 style={{ fontSize: 13, fontWeight: 800, color: '#2563EB', marginBottom: 24, textTransform: 'uppercase', letterSpacing: '0.08em', borderBottom: '1px solid #F1F5F9', paddingBottom: 10 }}>
                    Behavioral Analysis
                  </h3>

                  <p style={{ fontSize: 14, color: '#64748B', lineHeight: 1.6, marginBottom: 24, fontWeight: 500 }}>
                    Our AI models analyze micro-jitter, velocity profiles, and steering configurations in real time to verify human participation.
                  </p>
                </div>

                <div>
                  <span style={{ fontSize: 10, fontWeight: 800, color: '#94A3B8', textTransform: 'uppercase', display: 'block', marginBottom: 8, letterSpacing: '0.05em' }}>
                    Classification Verdict
                  </span>

                  <div style={{
                    background: stats.verdict.includes('BOT') ? '#FEF2F2' : stats.verdict.includes('HUMAN') ? '#ECFDF5' : '#F8FAFC',
                    border: `1px solid ${stats.verdict.includes('BOT') ? '#FCA5A5' : stats.verdict.includes('HUMAN') ? '#A7F3D0' : '#E2E8F0'}`,
                    borderRadius: 12,
                    padding: '24px 16px',
                    textAlign: 'center',
                    transition: 'all 0.3s ease'
                  }}>
                    <span style={{
                      fontSize: 16,
                      fontWeight: 900,
                      color: stats.verdict.includes('BOT') ? '#DC2626' : stats.verdict.includes('HUMAN') ? '#047857' : '#2563EB',
                      display: 'block',
                      letterSpacing: '-0.01em'
                    }}>
                      {stats.verdict.includes('BOT')
                        ? '❌ Robotic / AI Sender Detected'
                        : stats.verdict.includes('HUMAN')
                          ? '✅ Verified Human (Passed)'
                          : stats.verdict}
                    </span>
                    <span style={{ fontSize: 11, color: '#64748B', marginTop: 6, display: 'block', fontWeight: 500 }}>
                      {stats.verdict.includes('BOT')
                        ? 'Trajectory flagged for perfect constant velocity and zero directional deviation.'
                        : stats.verdict.includes('HUMAN')
                          ? 'Natural physical muscle acceleration and micro-jitter patterns detected.'
                          : 'Draw curves on the whiteboard canvas to begin security analysis.'}
                    </span>
                  </div>
                </div>

              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── THE 5 STEPS TO ADD PROOF OF HUMAN INTENT (Fully Open!) ── */}
      <section style={{ padding: '96px 24px', background: '#ffffff', borderBottom: '1px solid #E2E8F0' }}>
        <div className="container-custom">
          
          {/* Top Pill Badge */}
          <div style={{ background: '#EFF6FF', border: '1px solid #DBEAFE', color: '#2563EB', display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 16px', borderRadius: 9999, fontSize: 12, fontWeight: 700, marginBottom: 24, letterSpacing: '0.03em', textTransform: 'uppercase' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              <path d="M9 11l2 2 4-4" />
            </svg>
            Simple. Secure. Human.
          </div>

          <div style={{ marginBottom: 48 }}>
            <h3 style={{ fontSize: 'clamp(32px, 4.2vw, 48px)', fontWeight: 900, color: '#0F172A', letterSpacing: '-0.03em', lineHeight: 1.15, marginBottom: 20 }}>
              Adding Proof of Human Intent <br />
              Takes Just <span style={{ color: '#2563EB' }}>5 Steps</span>
            </h3>
            
            {/* Left aligned horizontal blue bar */}
            <div style={{ width: 48, height: 4, background: '#2563EB', borderRadius: 2, marginBottom: 24 }} />

            <p style={{ fontSize: 16, color: '#64748B', lineHeight: 1.6, fontWeight: 500, margin: '0 0 6px 0', maxWidth: 700 }}>
              No complex integrations, workflow changes, or content access required.
            </p>
            <p style={{ fontSize: 16, color: '#64748B', lineHeight: 1.6, fontWeight: 500, margin: 0, maxWidth: 700 }}>
              Attest adds proof of human intent to every verified email in just a few simple steps.
            </p>
          </div>

          <div className="stepper-container" style={{ marginTop: 64 }}>
            {/* Timeline connectors */}
            <div className="stepper-line" />
            <div className="stepper-start-dot" />
            <div className="stepper-end-dot" />

            {[
              { step: '01', title: 'Install Attest', desc: 'Add the extension to your Gmail in seconds.' },
              { step: '02', title: 'Communicate Normally', desc: 'Continue using your existing email workflows as usual.' },
              { step: '03', title: 'Verify Human Activity', desc: 'Attest tracks cursor movement before every email send.' },
              { step: '04', title: 'Verification Added', desc: 'A trusted human-authenticated signature is securely attached.' },
              { step: '05', title: 'Recipient Sees the Trust Badge', desc: 'Recipients instantly recognize verified human communication.' }
            ].map((item) => (
              <div key={item.step} className="stepper-item">
                <div className="stepper-circle">
                  {item.step}
                </div>
                <div>
                  <h4 style={{ fontWeight: 800, color: '#0F172A', fontSize: 15, marginBottom: 8, margin: 0, lineHeight: 1.3 }}>
                    {item.title}
                  </h4>
                  <p style={{ fontSize: 13, color: '#64748B', lineHeight: 1.5, margin: 0, fontWeight: 500 }}>
                    {item.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── HIGH-TRUST INDUSTRIES GRID (Fully Open!) ── */}
      <section style={{ padding: '96px 24px 0 24px', background: '#ffffff' }}>
        <div className="container-custom">
          
          <div style={{ marginBottom: 48 }}>
            <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#2563EB', display: 'block', marginBottom: 12 }}>
              HIGH-TRUST FIELDS
            </span>
            {/* Left aligned horizontal blue bar */}
            <div style={{ width: 40, height: 3, background: '#2563EB', borderRadius: 1.5, marginBottom: 24 }} />

            <h3 style={{ fontSize: 'clamp(28px, 3.8vw, 40px)', fontWeight: 900, color: '#0F172A', letterSpacing: '-0.02em', marginBottom: 16, lineHeight: 1.2 }}>
              Built for Industries Where <br />Human Trust Still Matters in the Age of AI
            </h3>
            <p style={{ fontSize: 16, color: '#64748B', lineHeight: 1.6, fontWeight: 500, margin: 0 }}>
              When emails involve money, access, legal decisions, or sensitive information,<br />
              Attest helps ensure real human involvement before sending.
            </p>
          </div>

          <div className="fields-grid" style={{ borderTop: '1px solid #E2E8F0', borderBottom: '1px solid #E2E8F0' }}>
            {[
              {
                title: 'Finance & Banking',
                desc: 'Add confidence to payment approvals, invoices, and transaction-related communication by verifying real human participation.',
                icon: (
                  <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                    <circle cx="24" cy="24" r="22" fill="#EFF6FF" />
                    <path d="M12 34h24v2H12v-2zm3-12h2v12h-2zm6 0h2v12h-2zm6 0h2v12h-2zm6 0h2v12h-2zm-18-4l12-5 12 5H15z" stroke="#2563EB" strokeWidth="2" strokeLinejoin="round" fill="none" />
                  </svg>
                )
              },
              {
                title: 'Healthcare',
                desc: 'Increase trust in patient, insurance, and operational communications involving sensitive information and decisions.',
                icon: (
                  <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                    <circle cx="24" cy="24" r="22" fill="#F0FDF4" />
                    <path d="M16 23.5h3.5l2-5 3.5 10 2-7.5 2.5 2.5H32" stroke="#16A34A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M24 35c-8-6-10-10-10-13.5a5.5 5.5 0 019.5-3.5l.5.5.5-.5a5.5 5.5 0 019.5 3.5c0 3.5-2 7.5-10 13.5z" stroke="#16A34A" strokeWidth="2" strokeLinejoin="round" />
                  </svg>
                )
              },
              {
                title: 'Legal & Compliance',
                desc: 'Strengthen accountability for legal notices, approvals, and other important communications with verified human involvement.',
                icon: (
                  <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                    <circle cx="24" cy="24" r="22" fill="#FAF5FF" />
                    <path d="M24 14v22M20 36h8M16 18h16" stroke="#9333EA" strokeWidth="2" strokeLinecap="round" />
                    <path d="M20 18l-4 6h8l-4-6zm-4 6a4 4 0 008 0" stroke="#9333EA" strokeWidth="1.5" strokeLinejoin="round" />
                    <path d="M28 18l-4 6h8l-4-6zm-4 6a4 4 0 008 0" stroke="#9333EA" strokeWidth="1.5" strokeLinejoin="round" />
                  </svg>
                )
              },
              {
                title: 'Enterprise Security',
                desc: 'Reduce risks from spoofed, impersonated, or AI-generated communication by providing proof of human intent.',
                icon: (
                  <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                    <circle cx="24" cy="24" r="22" fill="#EFF6FF" />
                    <path d="M24 14c4.5 0 8 2 8 2s0 7-1.5 10c-2 4-6.5 6-6.5 6s-4.5-2-6.5-6C16 23 16 16 16 16s3.5-2 8-2z" stroke="#2563EB" strokeWidth="2" strokeLinejoin="round" />
                    <path d="M21 23l2 2 4-4" stroke="#2563EB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )
              },
              {
                title: 'Executive Communication',
                desc: 'Verify leadership announcements, executive directives, and other high-impact communications.',
                icon: (
                  <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                    <circle cx="24" cy="24" r="22" fill="#FFF7ED" />
                    <circle cx="24" cy="20" r="5" stroke="#EA580C" strokeWidth="2" />
                    <path d="M16 32c0-4 4-5 8-5s8 1 8 5M24 27v6l-1-1v-4" stroke="#EA580C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )
              },
              {
                title: 'High Trust Workflows',
                desc: 'Ensure critical decisions and approvals involve verified human participation within AI-assisted and digital workflows.',
                icon: (
                  <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                    <circle cx="24" cy="24" r="22" fill="#F0FDFA" />
                    <rect x="22" y="14" width="4" height="4" rx="1" stroke="#0D9488" strokeWidth="2" fill="#ffffff" />
                    <rect x="16" y="26" width="4" height="4" rx="1" stroke="#0D9488" strokeWidth="2" fill="#ffffff" />
                    <rect x="28" y="26" width="4" height="4" rx="1" stroke="#0D9488" strokeWidth="2" fill="#ffffff" />
                    <path d="M24 18v5M18 26v-3h12v3" stroke="#0D9488" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                )
              }
            ].map((item, idx) => (
              <div key={item.title} className={`fields-cell fields-cell-${idx + 1}`}>
                <div style={{ flexShrink: 0 }}>
                  {item.icon}
                </div>
                <div>
                  <h4 style={{ fontWeight: 800, color: '#0F172A', fontSize: 16, margin: '0 0 10px 0', lineHeight: 1.3 }}>
                    {item.title}
                  </h4>
                  <p style={{ fontSize: 14, color: '#64748B', lineHeight: 1.6, margin: 0, fontWeight: 500 }}>
                    {item.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── TRUST & SCENARIO WORKFLOWS (Fully Open!) ── */}
      <section style={{ padding: '96px 24px', background: '#ffffff', borderBottom: '1px solid #E2E8F0' }}>
        <div className="container-custom">
          <div style={{ maxWidth: 640, marginBottom: 48 }}>
            <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.15em', color: '#2563EB', display: 'block', marginBottom: 12 }}>
              CONVERSATIONAL SEGMENTS
            </span>
            <h3 style={{ fontSize: 32, fontWeight: 900, color: '#0F172A', letterSpacing: '-0.02em', marginBottom: 12 }}>
              Trust and Protection for Everyone in the Conversation
            </h3>
            <p style={{ fontSize: 16, color: '#64748B', lineHeight: 1.6, fontWeight: 500 }}>
              Whether you are sending emails or receiving them, Attest helps identify human-verified communication and warns users when emails come from unverified senders.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 32 }}>

            {/* Scenario 1 */}
            <div style={{ background: '#ffffff', padding: 36, borderRadius: 20, border: '1px solid #E2E8F0' }} className="premium-shadow">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 28 }}>
                <span style={{ fontSize: 24 }}>📬</span>
                <h4 style={{ fontSize: 17, fontWeight: 900, margin: 0, color: '#0F172A' }}>Scenario 1 — Recipient Does Not Have Extension</h4>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                {[
                  { t: '1️⃣ See Trust Badge', d: 'Verified emails display a visible trust badge if sender has extension.' },
                  { t: '2️⃣ Recognize Trusted Emails', d: 'Know which emails came from verified humans.' },
                  { t: '3️⃣ Spot Unverified Senders', d: 'Emails without badges appear less trustworthy.' },
                  { t: '4️⃣ Stay Protected Automatically', d: 'No install needed to benefit from verification.' }
                ].map((item, idx) => (
                  <div key={idx} style={{ borderLeft: '3px solid #2563EB', paddingLeft: 16 }}>
                    <span style={{ fontWeight: 800, fontSize: 14, color: '#2563EB', display: 'block', marginBottom: 4 }}>{item.t}</span>
                    <span style={{ fontSize: 13, color: '#64748B', lineHeight: 1.5, fontWeight: 500, display: 'block' }}>{item.d}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Scenario 2 */}
            <div style={{ background: '#ffffff', padding: 36, borderRadius: 20, border: '1px solid #E2E8F0' }} className="premium-shadow">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 28 }}>
                <span style={{ fontSize: 24 }}>🔍</span>
                <h4 style={{ fontSize: 17, fontWeight: 900, margin: 0, color: '#0F172A' }}>Scenario 2 — Sender Does Not has Extension</h4>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                {[
                  { t: '1️⃣ Scan Incoming Emails', d: 'Extension checks sender verification automatically if receiver has the extension' },
                  { t: '2️⃣ Detect Missing Verification', d: 'Unverified emails are clearly highlighted.' },
                  { t: '3️⃣ Get Risk Warnings', d: 'Potential AI-generated emails become easier to spot.' },
                  { t: '4️⃣ Encourage Sender Verification', d: 'Prompt senders to become human-verified.' }
                ].map((item, idx) => (
                  <div key={idx} style={{ borderLeft: '3px solid #10B981', paddingLeft: 16 }}>
                    <span style={{ fontWeight: 800, fontSize: 14, color: '#10B981', display: 'block', marginBottom: 4 }}>{item.t}</span>
                    <span style={{ fontSize: 13, color: '#64748B', lineHeight: 1.5, fontWeight: 500, display: 'block' }}>{item.d}</span>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── PRIVACY CONFIDENCE SECTION (EXACT USER NEVER BULLETS) ── */}
      <section style={{ padding: '96px 24px', background: '#ffffff', borderBottom: '1px solid #E2E8F0' }}>
        <div className="container-custom">

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 64, alignItems: 'center' }}>

            {/* Left side: Bold Title & Subtext */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#2563EB', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
                🔒 ZERO-ACCESS ARCHITECTURE
              </div>
              <h2 style={{ fontSize: 'clamp(30px, 3.8vw, 42px)', fontWeight: 900, color: '#0F172A', letterSpacing: '-0.03em', lineHeight: 1.15, margin: '0 0 16px 0' }}>
                Your Emails Stay Private. Always.
              </h2>
              <p style={{ fontSize: 16, color: '#64748B', lineHeight: 1.6, margin: 0, fontWeight: 500 }}>
                Attest never reads, stores, or accesses your email content, attachments, or inbox data.
              </p>
            </div>

            {/* Right side: 6 Never Bullets inside White Card */}
            <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 20, padding: '36px 32px' }} className="premium-shadow">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {[
                  'Never reads email content or conversations',
                  'Never stores messages or communication history',
                  'Never trains AI models on user data',
                  'Never requires access to sensitive communications',
                  'Never accesses attachments, contacts, or inbox data',
                  'Never collects passwords or login credentials'
                ].map((item) => (
                  <div key={item} style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                    <span style={{ color: '#EF4444', fontWeight: 900, fontSize: 15, flexShrink: 0 }}>✕</span>
                    <span style={{ fontSize: 14, fontWeight: 700, color: '#334155', lineHeight: 1.4 }}>{item}</span>
                  </div>
                ))}
              </div>
            </div>

          </div>

          {/* ── TRUST & COMPLIANCE LOGOS ── */}
          <div style={{ marginTop: 80, borderTop: '1px solid #E2E8F0', paddingTop: 48, textAlign: 'center' }}>
            <p style={{ fontSize: 13, fontWeight: 800, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 28 }}>
              VERIFIED TRUST &amp; COMPLIANCE STANDARDS
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 64, alignItems: 'center', marginTop: 40 }}>
              {/* AES-256 */}
              <div style={{ opacity: 0.9, transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <img src="/aes-256.png" alt="AES-256 Encrypted" style={{ height: 96, width: 'auto', objectFit: 'contain' }} />
              </div>

              {/* Zero Data Retention */}
              <div style={{ opacity: 0.9, transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <img src="/zero-data.png" alt="Zero Data Retention" style={{ height: 96, width: 'auto', objectFit: 'contain' }} />
              </div>

              {/* SOC 2 Ready */}
              <div style={{ opacity: 0.9, transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <img src="/soc2.png" alt="SOC 2 Ready" style={{ height: 96, width: 'auto', objectFit: 'contain' }} />
              </div>

              {/* GDPR Compliant */}
              <div style={{ opacity: 0.9, transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <img src="/gdpr.png" alt="GDPR Compliant" style={{ height: 96, width: 'auto', objectFit: 'contain' }} />
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* ── TESTIMONIALS & CASE STUDIES (Loved by SEO Professionals style) ── */}
      <section style={{ padding: '96px 24px', background: '#FFFFFF', borderBottom: '1px solid #E2E8F0' }}>
        <div className="container-custom">

          <div style={{ textAlign: 'center', marginBottom: 64 }}>
            <span style={{ fontSize: 13, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.15em', color: '#2563EB', display: 'block', marginBottom: 12 }}>
              TESTIMONIALS
            </span>
            <h2 style={{ fontSize: 'clamp(30px, 3.8vw, 42px)', fontWeight: 900, color: '#0F172A', letterSpacing: '-0.03em', lineHeight: 1.15, margin: 0 }}>
              Loved by security-first teams
            </h2>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 24 }}>
            {[
              {
                quote: "Attest successfully blocked a critical session-hijacking attempt targeting our billing team. The attacker stole active browser session tokens, but without the physical mouse trajectory tracing, their invoice email commands failed instantly.",
                name: 'Sarah Jenkins',
                role: 'VP of Security, FinTech Global',
                rating: 5
              },
              {
                quote: "In the era of perfectly formulated AI phishing attempts, Attest is the missing authentication shield. Standard security processes verify DNS server configurations — but only Attest verifies actual physical human action.",
                name: 'Marcus Vance',
                role: 'Chief Information Security Officer',
                rating: 5
              },
              {
                quote: "Our administrative staff loves the zero-barrier integration. The calibration check takes less than 5 seconds at dispatch, yet provides our entire enterprise complete assurance that outbox actions remain 100% verified.",
                name: 'Alisha Patel',
                role: 'Founder, LeadScale',
                rating: 5
              }
            ].map((t, idx) => (
              <div
                key={idx}
                style={{
                  background: '#ffffff',
                  border: '1px solid #E2E8F0',
                  borderRadius: 20,
                  padding: 32,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: 20
                }}
                className="premium-shadow"
              >
                <div>
                  {/* Star Rating */}
                  <div style={{ display: 'flex', gap: 4, color: '#F59E0B', fontSize: 18, marginBottom: 16 }}>
                    {Array.from({ length: t.rating }).map((_, i) => (
                      <span key={i}>★</span>
                    ))}
                  </div>
                  <p style={{ fontSize: 14.5, color: '#475569', lineHeight: 1.6, margin: 0, fontWeight: 500, fontStyle: 'italic' }}>
                    "{t.quote}"
                  </p>
                </div>

                {/* Author Block */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, borderTop: '1px solid #F1F5F9', paddingTop: 16 }}>
                  {/* Decorative avatar block */}
                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#EFF6FF', color: '#2563EB', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 12 }}>
                    {t.name.split(' ').map(n => n[0]).join('')}
                  </div>
                  <div>
                    <h4 style={{ fontSize: 14, fontWeight: 800, color: '#0F172A', margin: 0 }}>{t.name}</h4>
                    <p style={{ fontSize: 12, color: '#64748B', margin: 0, fontWeight: 600 }}>{t.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

        </div>
      </section>

      {/* ── FOOTER CALL TO ACTION BANNER (VERBATIM BRING TRUST BACK BANNERS) ── */}
      <section style={{ padding: '96px 24px', background: '#ffffff' }}>
        <div className="container-custom">
          <div
            style={{
              background: 'linear-gradient(135deg, #1E40AF 0%, #2563EB 100%)',
              borderRadius: 24,
              padding: '64px 48px',
              textAlign: 'center',
              position: 'relative',
              overflow: 'hidden'
            }}
            className="premium-shadow-lg"
          >
            {/* White background grid overlay */}
            <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(rgba(255, 255, 255, 0.08) 1px, transparent 1px)', backgroundSize: '24px 24px', opacity: 0.5, pointerEvents: 'none' }} />

            <div style={{ position: 'relative', zIndex: 2, maxWidth: 720, margin: '0 auto' }}>
              <h2 style={{ fontSize: 'clamp(28px, 4.2vw, 44px)', fontWeight: 900, color: '#ffffff', letterSpacing: '-0.03em', lineHeight: 1.15, marginBottom: 16 }}>
                Bring Trust Back to Email Communication with HumanAttest.
              </h2>
              <p style={{ fontSize: 16, color: '#EFF6FF', lineHeight: 1.6, marginBottom: 36, fontWeight: 500 }}>
                Deploy complete protection in under 15 seconds. Let Attest verify human intent for every dispatch.
              </p>

              <div style={{ display: 'inline-flex', flexWrap: 'wrap', gap: 16, justifyContent: 'center' }}>
                <a
                  href={EXTENSION_DOWNLOAD_URL}
                  style={{ background: '#ffffff', color: '#2563EB', padding: '16px 36px', borderRadius: 8, fontWeight: 800, textDecoration: 'none', transition: 'all 0.2s', fontSize: 15 }}
                  className="premium-shadow"
                >
                  Install Extension Now
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}
