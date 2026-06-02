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

type TabType = 'protocol' | 'workflow' | 'features';

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

  // Tabs state synced with hash
  const [activeTab, setActiveTab] = useState<TabType>('protocol');

  useEffect(() => {
    let lastHash = window.location.hash;

    const handleHash = () => {
      const currentHash = window.location.hash;
      if (currentHash !== lastHash) {
        lastHash = currentHash;
        const cleanHash = currentHash.replace('#', '') as TabType;
        if (cleanHash === 'protocol' || cleanHash === 'workflow' || cleanHash === 'features') {
          setActiveTab(cleanHash);
          if (window.scrollY < 400) {
            const el = document.getElementById('tabs-section');
            if (el) {
              el.scrollIntoView({ behavior: 'smooth' });
            }
          }
        }
      }
    };

    handleHash();
    const interval = setInterval(handleHash, 100);
    window.addEventListener('hashchange', handleHash);

    return () => {
      clearInterval(interval);
      window.removeEventListener('hashchange', handleHash);
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

  // Handle canvas resizing dynamically using ResizeObserver to avoid initial 0x0 issues
  useEffect(() => {
    if (activeTab !== 'protocol') return;
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
  }, [activeTab]);

  // Draw sandbox trails
  useEffect(() => {
    if (activeTab !== 'protocol') return;
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
  }, [points, activeTab]);

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
      <style dangerouslySetInnerHTML={{ __html: `
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
        <a href="#tabs-section" style={{ color: '#ffffff', textDecoration: 'underline', marginLeft: 6, fontWeight: 800 }}>
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
                Add Proof of Human Intent <br />
                for Every Email <span style={{ color: '#2563EB', background: 'linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>in the Era of AI.</span>
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

              <p style={{ fontSize: 11, color: '#94A3B8', marginTop: 12, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                (ENTERPRISE-GRADE PROTECTION · CHROME &amp; GOOGLE WORKSPACE)
              </p>
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
                          color: isActive ? '#475569' : '#64748B',
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

      {/* ── INBOX EXPERIENCE COMPARISON SECTION (Restored & Styled Premium) ── */}
      <section style={{ padding: '96px 24px', background: '#ffffff', borderTop: '1px solid #F1F5F9', borderBottom: '1px solid #F1F5F9' }}>
        <div className="container-custom">
          
          <div style={{ textAlign: 'center', marginBottom: 56 }}>
            <h3 style={{ fontSize: 32, fontWeight: 900, color: '#0F172A', letterSpacing: '-0.03em' }}>
              The Inbox <span style={{ color: '#2563EB' }}>Experience</span>
            </h3>
            <p style={{ fontSize: 16, color: '#64748B', marginTop: 12, fontWeight: 500, maxWidth: 640, margin: '12px auto 0 auto' }}>
              See how verified human emails display trust cues seamlessly across different recipient setups.
            </p>
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 48 }}>
            
            {/* Scenario 1: Extension User */}
            <div className="hover-lift" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <p style={{ fontSize: 13, fontWeight: 800, color: '#2563EB', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 18 }}>
                Receiver HAS Extension
              </p>
              <div style={{ width: '100%', background: '#0F172A', borderRadius: 20, padding: 28, boxShadow: '0 20px 40px -12px rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20, borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: 12 }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#FF5F56' }}></div>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#FFBD2E' }}></div>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#27C93F' }}></div>
                </div>
                <div style={{ color: 'white', fontSize: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#3B82F6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900 }}>S</div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 700, color: '#ffffff' }}>Sender Name</span>
                        <span style={{ background: '#059669', color: 'white', fontSize: 9, padding: '2px 8px', borderRadius: 99, fontWeight: 900, letterSpacing: '0.03em' }}>🛡️ VERIFIED HUMAN</span>
                      </div>
                      <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 2 }}>sender@example.com</div>
                    </div>
                  </div>
                  <div style={{ height: 1, background: 'rgba(255,255,255,0.05)', marginBottom: 16 }}></div>
                  <div style={{ color: '#CBD5E1', lineHeight: 1.6, fontSize: 13.5 }}>
                    Hello, I have verified my physical intent for this sensitive request...
                  </div>
                </div>
              </div>
              <p style={{ fontSize: 14, color: '#64748B', marginTop: 20, textAlign: 'center', lineHeight: 1.5, maxWidth: 420 }}>
                <strong>Native Integration:</strong> The extension automatically detects the cryptographic header hash and injects a real-time trust badge into the Gmail interface.
              </p>
            </div>

            {/* Scenario 2: Non-Extension User */}
            <div className="hover-lift" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <p style={{ fontSize: 13, fontWeight: 800, color: '#16A34A', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 18 }}>
                Receiver NO Extension
              </p>
              <div style={{ width: '100%', background: 'white', borderRadius: 20, padding: 28, border: '1px solid #E2E8F0' }} className="premium-shadow-lg">
                <div style={{ color: '#1E293B', fontSize: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748B', fontWeight: 900 }}>S</div>
                    <div>
                      <span style={{ fontWeight: 700, color: '#0F172A' }}>Sender Name</span>
                      <div style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>sender@example.com</div>
                    </div>
                  </div>
                  <div style={{ color: '#475569', lineHeight: 1.6, marginBottom: 24, fontSize: 13.5 }}>
                    Hello, please find the sensitive documents attached...
                  </div>
                  <div style={{ borderTop: '1px solid #F1F5F9', paddingTop: 16 }}>
                    <div style={{ background: '#F8FAFC', padding: 12, borderRadius: 12, border: '1px solid #E2E8F0', cursor: 'pointer' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        {/* Soft blue small stamp icon */}
                        <div style={{ width: 24, height: 24, borderRadius: 6, background: '#2563EB', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 12 }}>A</div>
                        <div>
                          <div style={{ fontWeight: 800, fontSize: 11, color: '#0F172A', letterSpacing: '0.02em' }}>ATTEST TRUST STAMP</div>
                          <div style={{ fontSize: 9, color: '#2563EB', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 1 }}>CLICK TO VERIFY CRYPTOGRAPHIC IDENTITY</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <p style={{ fontSize: 14, color: '#64748B', marginTop: 20, textAlign: 'center', lineHeight: 1.5, maxWidth: 420 }}>
                <strong>Universal Portal:</strong> Non-users see a professional Trust Stamp. Clicking it opens a secure hosted verification page showing the full audit trail.
              </p>
            </div>

          </div>

          {/* Integration Note / Pro Tip */}
          <div style={{ marginTop: 48, background: '#EFF6FF', border: '1px dashed #BFDBFE', borderRadius: 16, padding: 24, textAlign: 'center', maxWidth: 900, margin: '48px auto 0 auto' }}>
            <p style={{ margin: 0, fontSize: 14, color: '#1E40AF', fontWeight: 600 }}>
              🚀 <span style={{ color: '#2563EB' }}>Pro Tip:</span> Non-extension users are automatically nudged to join the protocol upon their first reply, ensuring viral network security.
            </p>
          </div>

        </div>
      </section>

      {/* ── LOGO WALL (SEO Studio Style) ── */}
      <section style={{ padding: '48px 24px 64px 24px', borderBottom: '1px solid #F1F5F9', background: '#ffffff' }}>
        <div className="container-custom" style={{ textAlign: 'center' }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 32 }}>
            Trusted by security-first teams and modern enterprises worldwide
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', gap: '32px 56px' }}>
            {['Google Workspace', 'Microsoft 365', 'Okta Identity', 'Yubico Keys', 'SOC 2 Compliant', 'AES-256 Security'].map((logo) => (
              <div 
                key={logo} 
                className="logo-grayscale"
                style={{ fontSize: 18, fontWeight: 800, color: '#475569', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <span style={{ color: '#2563EB' }}>❖</span> {logo}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURES SECTION (SEO Studio Grid style) ── */}
      <section style={{ padding: '96px 24px', background: '#FFFFFF' }}>
        <div className="container-custom">
          
          <div style={{ textAlign: 'center', marginBottom: 64, maxWidth: 640, margin: '0 auto 64px auto' }}>
            <span style={{ fontSize: 13, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.15em', color: '#2563EB', display: 'block', marginBottom: 12 }}>
              FEATURES
            </span>
            <h2 style={{ fontSize: 'clamp(30px, 3.8vw, 42px)', fontWeight: 900, color: '#0F172A', letterSpacing: '-0.03em', lineHeight: 1.15, marginBottom: 16 }}>
              Everything you need to secure communication
            </h2>
            <p style={{ fontSize: 16, color: '#64748B', lineHeight: 1.6, margin: 0, fontWeight: 500 }}>
              Action-level local cryptographic security for modern workforces. No content access.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 24 }}>
            {[
              {
                title: 'Verify Human Participation',
                desc: 'Capture kinetic cursor curve tracing directly at the browser client. Bots move in perfect linear formulas; human muscles carry micro-jitters that cannot be faked.',
                bg: '#FAF5FF',
                color: '#9333EA',
                icon: '✍️'
              },
              {
                title: 'Privacy-First Design',
                desc: 'Our zero-access framework is mathematically isolated. Storing or routing your message body, headers, or credentials is technically impossible.',
                bg: '#ECFDF5',
                color: '#10B981',
                icon: '🔒'
              },
              {
                title: 'Never Reads Email',
                desc: 'The Chrome extension intercepts actions purely at the DOM layer without OAuth Gmail API authorization permissions. Fully auditable.',
                bg: '#FEF2F2',
                color: '#EF4444',
                icon: '🚫'
              },
              {
                title: 'One Click Integration',
                desc: 'Deploy without modifying DNS, installing central server systems, or restructuring workflows. Ready for teams in minutes.',
                bg: '#EFF6FF',
                color: '#2563EB',
                icon: '🔌'
              },
              {
                title: 'Immutable Audit Trail',
                desc: 'Store simple hash event payloads securely. Recipients verify signatures instantly, matching timestamps and verified records transparently.',
                bg: '#FFFBEB',
                color: '#F59E0B',
                icon: '🔎'
              },
              {
                title: 'Enterprise BEC Protection',
                desc: 'Block script sessions even if attackers compromise admin accounts, duplicate session cookies, or bypass multi-factor authentications.',
                bg: '#EEF2FF',
                color: '#4F46E5',
                icon: '👔'
              }
            ].map((f) => (
              <div 
                key={f.title} 
                style={{ 
                  background: '#ffffff', 
                  border: '1px solid #E2E8F0', 
                  borderRadius: 16, 
                  padding: 32, 
                  transition: 'all 0.2s', 
                  display: 'flex', 
                  flexDirection: 'column', 
                  gap: 16 
                }} 
                className="premium-shadow"
              >
                {/* Rounded Icon square */}
                <div style={{ width: 48, height: 48, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, background: f.bg, color: f.color }}>
                  {f.icon}
                </div>
                <h3 style={{ fontSize: 18, fontWeight: 800, color: '#0F172A', margin: 0 }}>
                  {f.title}
                </h3>
                <p style={{ fontSize: 14, color: '#64748B', lineHeight: 1.6, margin: 0, fontWeight: 500 }}>
                  {f.desc}
                </p>
              </div>
            ))}
          </div>

        </div>
      </section>

      {/* ── PROBLEM / LIMITATION / SOLUTION SECTION (SEO Studio style) ── */}
      <section id="problem-intro-section" style={{ padding: '96px 24px', background: '#F8FAFC', borderTop: '1px solid #E2E8F0', borderBottom: '1px solid #E2E8F0' }}>
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
                Attest verifies real human interaction like active keyboard and mouse behavior during message creation and adds a trusted human-authenticated signature that recipients can instantly recognize.
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
              THE PROBLEM & THE ANTIDOTE
            </span>
            <h2 style={{ fontSize: 'clamp(30px, 3.8vw, 42px)', fontWeight: 900, color: '#0F172A', letterSpacing: '-0.03em', lineHeight: 1.15, margin: 0 }}>
              Digital communication is losing trust.
            </h2>
          </div>

          <div style={{ border: '1px solid #E2E8F0', borderRadius: 24, overflow: 'hidden', background: '#ffffff' }} className="premium-shadow-lg">
            {[
              {
                issue: 'AI-generated emails flood inboxes',
                issueDesc: 'Autonomous software agents send thousands of perfectly worded emails with zero active human involvement. Recipients have no reliable way to verify presence.',
                solution: 'Human activity verification',
                solDesc: 'Attest captures and traces natural physical cursor velocity, path deviations, and steering configurations at the exact moment of click.'
              },
              {
                issue: 'Impersonation and spoofed senders',
                issueDesc: 'Attackers spoof corporate email identities to bypass standard filters, impersonating leadership or legal representatives with full credentials.',
                solution: 'Human-attested signature layer',
                solDesc: 'Add cryptographic signature header stamps that can only be generated through real, physical user calibration on local systems.'
              },
              {
                issue: 'Authentication verifies domains, not humans',
                issueDesc: 'Standard algorithms prove server authorization records — leaving a massive structural gap between email servers and physical senders.',
                solution: 'Verified intent proof layer',
                solDesc: 'Trace the physical send actions dynamically, sealing the gap between server credentials and the actual human session.'
              },
              {
                issue: 'Billing and payment invoice fraud',
                issueDesc: 'Wire-transfer approvals and banking instructions are modified through active browser hijacking scripts, looking completely genuine.',
                solution: 'Verifiable physical approval trail',
                solDesc: 'Protect high-value outbox operations by forcing physical calibration checks, preventing autonomous scripts from dispatching orders.'
              }
            ].map((row, idx) => (
              <div 
                key={idx} 
                style={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', 
                  borderBottom: idx === 3 ? 'none' : '1px solid #E2E8F0',
                  position: 'relative'
                }}
              >
                {/* Left Side: Issue Column */}
                <div style={{ padding: '36px 40px', background: '#ffffff', borderRight: '1px solid #F1F5F9' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#EF4444', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
                    🚨 ISSUE DETECTED
                  </div>
                  <h3 style={{ fontSize: 18, fontWeight: 800, color: '#0F172A', margin: '0 0 10px 0' }}>
                    {row.issue}
                  </h3>
                  <p style={{ fontSize: 14, color: '#64748B', lineHeight: 1.6, margin: 0, fontWeight: 500 }}>
                    {row.issueDesc}
                  </p>
                </div>

                {/* Right Side: Solution Column */}
                <div style={{ padding: '36px 40px', background: '#F8FAFC' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#10B981', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
                    🛡️ ATTEST SOLUTION
                  </div>
                  <h3 style={{ fontSize: 18, fontWeight: 800, color: '#047857', margin: '0 0 10px 0' }}>
                    {row.solution}
                  </h3>
                  <p style={{ fontSize: 14, color: '#64748B', lineHeight: 1.6, margin: 0, fontWeight: 500 }}>
                    {row.solDesc}
                  </p>
                </div>
              </div>
            ))}
          </div>

        </div>
      </section>

      {/* ── TAB INTERFACE (Protocol Interactive whiteboard & Scenarios) ── */}
      <section id="tabs-section" style={{ padding: '96px 24px', background: '#FFFFFF', scrollMarginTop: 64 }}>
        <div className="container-custom">
          
          {/* Tab Selection Switcher exactly like SEO Studio pricing toggle */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 56 }}>
            <div style={{ background: '#F1F5F9', padding: 4, borderRadius: 10, display: 'inline-flex', gap: 4 }}>
              {(['protocol', 'workflow', 'features'] as const).map((tab) => {
                const isActive = activeTab === tab;
                return (
                  <button
                    key={tab}
                    onClick={() => {
                      setActiveTab(tab);
                      window.location.hash = tab;
                    }}
                    style={{
                      background: isActive ? '#ffffff' : 'transparent',
                      color: isActive ? '#2563EB' : '#475569',
                      border: 'none',
                      borderRadius: 8,
                      padding: '10px 24px',
                      fontSize: 14,
                      fontWeight: 700,
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      textTransform: 'capitalize',
                      outline: 'none',
                      boxShadow: isActive ? '0 1px 3px rgba(0,0,0,0.08)' : 'none'
                    }}
                  >
                    {tab === 'protocol' ? 'Whiteboard Sandbox' : tab === 'workflow' ? 'Scenario Workflows' : 'High-Trust Industries'}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Tab Contents */}
          <div className="tab-content-active">
            
            {/* PROTOCOL SANDBOX */}
            {activeTab === 'protocol' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 64 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 64, alignItems: 'center' }}>
                  
                  {/* Left Side: Interactive canvas */}
                  <div>
                    <div style={{ marginBottom: 24 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#2563EB', display: 'block', marginBottom: 6 }}>
                        Interactive calibration tool
                      </span>
                      <h2 style={{ fontSize: 32, fontWeight: 900, color: '#0F172A', letterSpacing: '-0.02em', margin: 0 }}>
                        Test your trajectory signature
                      </h2>
                      <p style={{ color: '#64748B', fontSize: 15, marginTop: 12, lineHeight: 1.6, fontWeight: 500 }}>
                        Bots move in mathematically straight lines or uniform speeds. Humans have natural muscle micro-variance, acceleration curves, and steering fluctuations.
                      </p>
                    </div>

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
                        overflow: 'hidden'
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
                        🤖 Simulate Bot Script (Perfect Line)
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

                  {/* Right Side: Telemetry admin dashboard console */}
                  <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <div style={{ background: '#ffffff', border: '1px solid #E2E8F0', borderRadius: 16, padding: 32 }} className="premium-shadow">
                      <h3 style={{ fontSize: 13, fontWeight: 800, color: '#2563EB', marginBottom: 20, textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #F1F5F9', paddingBottom: 8 }}>
                        Live Mathematical Output
                      </h3>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #F1F5F9', paddingBottom: 8 }}>
                          <span style={{ color: '#64748B' }}>Cursor Coordinates:</span>
                          <span style={{ fontWeight: 700, color: '#0F172A' }}>{stats.coords}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #F1F5F9', paddingBottom: 8 }}>
                          <span style={{ color: '#64748B' }}>Average Velocity:</span>
                          <span style={{ fontWeight: 700, color: '#0F172A' }}>{stats.velocity}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #F1F5F9', paddingBottom: 8 }}>
                          <span style={{ color: '#64748B' }}>Jitter StdDev:</span>
                          <span style={{ fontWeight: 700, color: '#0F172A' }}>{stats.speedStdDev}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #F1F5F9', paddingBottom: 8 }}>
                          <span style={{ color: '#64748B' }}>Linear Deviation:</span>
                          <span style={{ fontWeight: 700, color: '#0F172A' }}>{stats.avgDeviation}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #F1F5F9', paddingBottom: 8 }}>
                          <span style={{ color: '#64748B' }}>Steering Entropy:</span>
                          <span style={{ fontWeight: 700, color: '#0F172A' }}>{stats.steeringEntropy}</span>
                        </div>
                      </div>

                      <div style={{ marginTop: 28 }}>
                        <span style={{ fontSize: 10, fontWeight: 800, color: '#64748B', textTransform: 'uppercase', display: 'block', marginBottom: 8, letterSpacing: '0.05em' }}>
                          Classification Verdict
                        </span>
                        <div style={{ 
                          background: stats.verdict.includes('BOT') ? '#FEF2F2' : stats.verdict.includes('HUMAN') ? '#ECFDF5' : '#F8FAFC', 
                          border: `1px solid ${stats.verdict.includes('BOT') ? '#FCA5A5' : stats.verdict.includes('HUMAN') ? '#A7F3D0' : '#E2E8F0'}`, 
                          borderRadius: 10, 
                          padding: '14px', 
                          textAlign: 'center'
                        }}>
                          <span style={{ 
                            fontSize: 13, 
                            fontWeight: 800, 
                            color: stats.verdict.includes('BOT') ? '#DC2626' : stats.verdict.includes('HUMAN') ? '#047857' : '#2563EB',
                          }}>
                            {stats.verdict}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                </div>

                {/* Adding Proof of Human Intent Steps (EXACT USER STEPS) */}
                <div style={{ borderTop: '1px solid #E2E8F0', paddingTop: 48 }}>
                  <div style={{ marginBottom: 36, maxWidth: 640 }}>
                    <h3 style={{ fontSize: 24, fontWeight: 900, color: '#0F172A', letterSpacing: '-0.02em', marginBottom: 12 }}>
                      Adding Proof of Human Intent Takes Just 5 Steps
                    </h3>
                    <p style={{ fontSize: 15, color: '#64748B', lineHeight: 1.5, fontWeight: 500 }}>
                      No complex integrations, workflow changes, or content access required. Attest adds proof of human intent to every verified email in just a few simple steps.
                    </p>
                  </div>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 20 }}>
                    {[
                      { step: '01', icon: '💻', title: 'Step 1: Install Attest', desc: 'Add the extension to your Gmail in seconds.' },
                      { step: '02', icon: '✉️', title: 'Step 2: Communicate Normally', desc: 'Continue using your existing email workflows as usual.' },
                      { step: '03', icon: '⚡', title: 'Step 3: Verify Human Activity', desc: 'Attest tracks cursor movement before every email send.' },
                      { step: '04', icon: '🔏', title: 'Step 4: Verification Signature Added', desc: 'A trusted human-authenticated signature is securely attached.' },
                      { step: '05', icon: '🏅', title: 'Step 5: Recipient Sees the Trust Badge', desc: 'Recipients instantly recognize verified human communication.' }
                    ].map((item) => (
                      <div key={item.step} style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 24, background: '#ffffff', border: '1px solid #E2E8F0', borderRadius: 14 }} className="premium-shadow">
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: 22 }}>{item.icon}</span>
                          <div style={{ width: 28, height: 28, background: '#EFF6FF', color: '#2563EB', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6, fontWeight: 900, fontSize: 12 }}>
                            {item.step}
                          </div>
                        </div>
                        <div>
                          <h4 style={{ fontWeight: 800, color: '#0F172A', fontSize: 15, marginBottom: 6, margin: 0 }}>
                            {item.title}
                          </h4>
                          <p style={{ fontSize: 13, color: '#64748B', lineHeight: 1.5, margin: 0, fontWeight: 500 }}>{item.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* WORKFLOWS TAB (EXACT SCENARIOS VERBATIM) */}
            {activeTab === 'workflow' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 40 }}>
                <div style={{ maxWidth: 640 }}>
                  <h3 style={{ fontSize: 26, fontWeight: 900, color: '#0F172A', letterSpacing: '-0.02em', marginBottom: 12 }}>
                    Trust and Protection for Everyone in the Conversation
                  </h3>
                  <p style={{ fontSize: 15, color: '#64748B', lineHeight: 1.6, fontWeight: 500 }}>
                    Whether you are sending emails or receiving them, Attest helps identify human-verified communication and warns users when emails come from unverified senders.
                  </p>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 32 }}>
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
            )}

            {/* HIGH-TRUST INDUSTRIES TAB (EXACT VERBATIM TEXT) */}
            {activeTab === 'features' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 40 }}>
                <div style={{ maxWidth: 640 }}>
                  <h3 style={{ fontSize: 26, fontWeight: 900, color: '#0F172A', letterSpacing: '-0.02em', marginBottom: 12 }}>
                    Built for Industries Where Human Trust Still Matters in the Age of AI
                  </h3>
                  <p style={{ fontSize: 15, color: '#64748B', lineHeight: 1.6, fontWeight: 500 }}>
                    When emails involve money, access, legal decisions, or sensitive information, Attest helps ensure real human involvement before sending.
                  </p>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 24 }}>
                  {[
                    { icon: '🏦', title: 'Finance & Banking', desc: 'Add confidence to payment approvals, invoices, and transaction-related communication by verifying real human participation.' },
                    { icon: '🏥', title: 'Healthcare', desc: 'Increase trust in patient, insurance, and operational communications involving sensitive information and decisions.' },
                    { icon: '⚖️', title: 'Legal & Compliance', desc: 'Strengthen accountability for legal notices, approvals, and other important communications with verified human involvement.' },
                    { icon: '🛡️', title: 'Enterprise Security', desc: 'Reduce risks from spoofed, impersonated, or AI-generated communication by providing proof of human intent.' },
                    { icon: '👔', title: 'Executive Communication', desc: 'Verify leadership announcements, executive directives, and other high-impact communications.' },
                    { icon: '⚙️', title: 'High Trust Workflows', desc: 'Ensure critical decisions and approvals involve verified human participation within AI-assisted and digital workflows.' }
                  ].map((item) => (
                    <div 
                      key={item.title} 
                      style={{ 
                        display: 'flex', 
                        flexDirection: 'column', 
                        gap: 14, 
                        background: '#ffffff', 
                        padding: 32, 
                        borderRadius: 16, 
                        border: '1px solid #E2E8F0' 
                      }} 
                      className="premium-shadow"
                    >
                      <div style={{ width: 44, height: 44, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, background: '#EFF6FF', color: '#2563EB' }}>
                        {item.icon}
                      </div>
                      <h4 style={{ fontWeight: 800, color: '#0F172A', fontSize: 16, margin: 0 }}>{item.title}</h4>
                      <p style={{ fontSize: 14, color: '#64748B', lineHeight: 1.6, margin: 0, fontWeight: 500 }}>{item.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>

        </div>
      </section>

      {/* ── PRIVACY CONFIDENCE SECTION (EXACT USER NEVER BULLETS) ── */}
      <section style={{ padding: '96px 24px', background: '#F8FAFC', borderTop: '1px solid #E2E8F0', borderBottom: '1px solid #E2E8F0' }}>
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
                Let Attest verify that a real person intentionally sent an email or message without ever reading content, interrupting workflows, or requiring complex integrations.
              </p>

              {/* Dynamic Badges below */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 32 }}>
                {[
                  'AES-256 Encrypted',
                  'Zero Data Retention',
                  'SOC 2 Ready',
                  'GDPR Compliant'
                ].map((badge) => (
                  <span 
                    key={badge} 
                    style={{ 
                      fontSize: 10, 
                      fontWeight: 800, 
                      color: '#2563EB', 
                      background: '#EFF6FF', 
                      border: '1px solid #DBEAFE', 
                      padding: '6px 12px', 
                      borderRadius: 6,
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em'
                    }}
                  >
                    {badge}
                  </span>
                ))}
              </div>
            </div>

            {/* Right side: 6 Never Bullets inside White Card */}
            <div style={{ background: '#ffffff', border: '1px solid #E2E8F0', borderRadius: 20, padding: '36px 32px' }} className="premium-shadow">
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

        </div>
      </section>

      {/* ── TESTIMONIALS & CASE STUDIES (Loved by SEO Professionals style) ── */}
      <section style={{ padding: '96px 24px', background: '#FFFFFF' }}>
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

      {/* ── FOOTER CALL TO ACTION BANNER (SEO Studio Style block) ── */}
      <section style={{ padding: '96px 24px', background: '#ffffff', borderTop: '1px solid #F1F5F9' }}>
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

            <div style={{ position: 'relative', zIndex: 2, maxWidth: 640, margin: '0 auto' }}>
              <h2 style={{ fontSize: 'clamp(28px, 4vw, 42px)', fontWeight: 900, color: '#ffffff', letterSpacing: '-0.03em', lineHeight: 1.15, marginBottom: 16 }}>
                Ready to secure your communication?
              </h2>
              <p style={{ fontSize: 16, color: '#EFF6FF', lineHeight: 1.6, marginBottom: 36, fontWeight: 500 }}>
                Join thousands of secure organizations establishing local, cryptographic outbox verification. Set up complete protection in under 15 seconds.
              </p>

              <div style={{ display: 'inline-flex', flexWrap: 'wrap', gap: 16, justifyContent: 'center' }}>
                <a 
                  href={EXTENSION_DOWNLOAD_URL} 
                  style={{ background: '#ffffff', color: '#2563EB', padding: '16px 36px', borderRadius: 8, fontWeight: 800, textDecoration: 'none', transition: 'all 0.2s', fontSize: 15 }}
                  className="premium-shadow"
                >
                  Install Extension Now
                </a>
                <a 
                  href="/docs" 
                  style={{ background: 'transparent', color: '#ffffff', border: '1.5px solid rgba(255, 255, 255, 0.6)', padding: '15px 36px', borderRadius: 8, fontWeight: 800, textDecoration: 'none', transition: 'all 0.2s', fontSize: 15 }}
                >
                  Read Documentation
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
