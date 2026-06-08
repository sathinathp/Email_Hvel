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
    link.href = 'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;700&family=Lora:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500;1,600;1,700&display=swap';
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
          ctx.strokeStyle = '#007A5E';
          ctx.lineWidth = 3.5;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.stroke();

          const last = pointsRef.current[pointsRef.current.length - 1];
          ctx.beginPath();
          ctx.arc(last.x, last.y, 5, 0, 2 * Math.PI);
          ctx.fillStyle = '#00634B';
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
    ctx.strokeStyle = '#007A5E';
    ctx.lineWidth = 3.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();

    const last = points[points.length - 1];
    ctx.beginPath();
    ctx.arc(last.x, last.y, 5, 0, 2 * Math.PI);
    ctx.fillStyle = '#00634B';
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

  // ── Scroll-triggered animation observer ──────────────────────
  useEffect(() => {
    const selectors = [
      '.animate-on-scroll',
      '.animate-from-left',
      '.animate-from-right',
      '.animate-scale-in',
      '.number-pop',
      '.heading-underline',
      '.step-badge-animated',
      '.fade-in-blur',
      '.hero-title-word',
      '.testimonial-card-animate',
      '.line-grow',
    ].join(',');

    const els = document.querySelectorAll<HTMLElement>(selectors);

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('in-view');
          }
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
    );

    els.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

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
          box-shadow: 0 8px 20px -6px rgba(0, 122, 94, 0.4);
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

      <Navbar />

      {/* ── HERO SECTION ── */}
      <section style={{ paddingTop: 120, paddingBottom: 96, background: '#F6FAF5', position: 'relative', overflow: 'hidden' }}>

        {/* Subtle grid pattern overlay */}
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(#e1e8df 1px, transparent 1px)', backgroundSize: '24px 24px', opacity: 0.8, pointerEvents: 'none' }} />

        {/* Decorative blobs */}
        <div className="decorative-blob" style={{ width: 400, height: 400, background: 'rgba(0,122,94,0.06)', top: '-80px', right: '-60px', animationDelay: '0s' }} />
        <div className="decorative-blob" style={{ width: 300, height: 300, background: 'rgba(0,185,140,0.05)', bottom: '-40px', left: '5%', animationDelay: '4s' }} />

        <div className="container-custom" style={{ position: 'relative', zIndex: 2 }}>

          {/* Social Proof Reviews Badge */}
          <div className="animate-on-scroll" style={{ display: 'flex', justifyContent: 'center', marginBottom: 40 }}>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              background: '#ffffff',
              border: '1px solid #E4EBE3',
              borderRadius: 9999,
              padding: '6px 20px',
              boxShadow: '0 4px 16px rgba(0, 0, 0, 0.03)',
              gap: 16,
              flexWrap: 'wrap',
              justifyContent: 'center'
            }}>
              {/* Overlapping Senders replaced with Gmail & Outlook logos */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  {/* Gmail Icon */}
                  <svg width="18" height="18" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
                    <path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2z" fill="#EA4335" />
                    <path d="M22 6l-10 6L2 6v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6z" fill="#F1F5F9" />
                    <path d="M2 6v12h4V8l6 4 6-4v10h4V6l-10 7L2 6z" fill="#4285F4" />
                  </svg>
                  {/* Outlook Icon */}
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
                    <rect x="2" y="4" width="20" height="16" rx="2.5" fill="#0078D4" />
                    <path d="M22 6L12 13L2 6" stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    <rect x="2" y="6" width="7" height="12" rx="1.5" fill="#106EBE" />
                    <text x="3.5" y="15" fill="#FFFFFF" fontSize="9" fontWeight="950" fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif">O</text>
                  </svg>
                </div>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#1F2937' }}>Emails Verified</span>
              </div>

              {/* Divider */}
              <div style={{ width: 1, height: 16, background: '#E4EBE3' }} />

              {/* Zero-Knowledge Privacy */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: '#1F2937' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#007A5E" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline-block' }}>
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                </svg>
                <span>Zero-Knowledge Privacy</span>
              </div>

              {/* Divider */}
              <div style={{ width: 1, height: 16, background: '#E4EBE3' }} />

              {/* Gmail & Outlook Integrated */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: '#1F2937' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#007A5E" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline-block' }}>
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                  <polyline points="22,6 12,13 2,6"></polyline>
                </svg>
                <span>Gmail &amp; Outlook Integrated</span>
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 64, alignItems: 'center' }}>

            {/* Left Column: Authentic Copy & Typography */}
            <div className="animate-from-left">
              {/* Rounded Green Badge */}
              <div className="hero-badge-pop" style={{
                background: '#E6F4EA',
                border: '1px solid #C2E7CD',
                color: '#0D7A5E',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 14px',
                borderRadius: 9999,
                fontSize: 11,
                fontWeight: 800,
                marginBottom: 20,
                letterSpacing: '0.04em',
                textTransform: 'uppercase'
              }}>
                <span style={{ fontSize: 10 }}>🛡️</span> Instant Human vs AI Email Verification
              </div>

              <h1 style={{
                fontFamily: "'Lora', 'Playfair Display', Georgia, serif",
                fontSize: 'clamp(36px, 4.2vw, 54px)',
                fontWeight: 700,
                lineHeight: 1.15,
                color: '#111827',
                letterSpacing: '-0.02em',
                margin: 0
              }}>
                Prove a Real Human <br />
                Sent Every Email <br />
                in the <span style={{ fontStyle: 'italic', color: '#007A5E' }}>Era of AI</span>.
              </h1>

              <p style={{
                fontSize: 16,
                color: '#4B5563',
                lineHeight: 1.6,
                marginTop: 20,
                marginBottom: 28,
                maxWidth: 520,
                fontWeight: 500
              }}>
                Let <strong style={{ color: '#111827', fontWeight: 600 }}>Attest</strong> prove that a real human sent your emails, without reading contents, interrupting workflows, or requiring complex setup.
              </p>

              {/* CTAs */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center' }}>
                <a
                  href={EXTENSION_DOWNLOAD_URL}
                  style={{
                    background: '#007A5E',
                    color: '#ffffff',
                    padding: '14px 28px',
                    borderRadius: 8,
                    fontWeight: 700,
                    textDecoration: 'none',
                    transition: 'all 0.2s',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    border: 'none',
                    fontSize: 15,
                    boxShadow: '0 4px 12px rgba(0, 122, 94, 0.2)'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#00634B';
                    e.currentTarget.style.transform = 'translateY(-1px)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = '#007A5E';
                    e.currentTarget.style.transform = 'translateY(0)';
                  }}
                >
                  Download Extension
                  <span style={{ fontSize: 16 }}>→</span>
                </a>
                <button
                  onClick={() => {
                    const el = document.getElementById('problem-intro-section');
                    if (el) el.scrollIntoView({ behavior: 'smooth' });
                  }}
                  style={{
                    background: '#ffffff',
                    color: '#4B5563',
                    border: '1px solid #D1D5DB',
                    padding: '14px 28px',
                    borderRadius: 8,
                    fontWeight: 700,
                    transition: 'all 0.2s',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    fontSize: 15,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = '#9CA3AF';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.03)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = '#D1D5DB';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#4B5563' }}>
                    <polygon points="5 3 19 12 5 21 5 3"></polygon>
                  </svg>
                  See How it Works
                </button>
              </div>

              {/* Trust Indicators below the Buttons */}
              <div style={{ marginTop: 28, display: 'flex', flexWrap: 'wrap', gap: '12px 24px', color: '#4B5563', fontSize: 13, fontWeight: 600 }}>
                {[
                  'Verify Human Participation',
                  'Privacy-First Design',
                  'Never Reads Email',
                  'One Click Integration'
                ].map((item) => (
                  <div key={item} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#007A5E" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                    {item}
                  </div>
                ))}
              </div>

            </div>

            {/* Right Column: Workflow Interactive Animation (Styled like scale.jobs console) */}
            <div className="animate-from-right" style={{ display: 'flex', justifyContent: 'center' }}>
              <div
                className="float-slow"
                style={{
                  background: '#ffffff',
                  border: '1px solid #E2E8F0',
                  borderRadius: 24,
                  padding: 0,
                  width: '100%',
                  maxWidth: 460,
                  position: 'relative',
                  overflow: 'hidden',
                  boxShadow: '0 20px 40px -15px rgba(0, 0, 0, 0.08)'
                }}
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
                          background: isActive ? '#007A5E' : 'transparent',
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
                      <div className="animate-on-scroll" style={{ fontSize: 11, fontWeight: 800, color: '#007A5E', textTransform: 'uppercase', letterSpacing: '0.05em' }}>GMAIL OUTBOX INTERCEPTION</div>
                      <div style={{ background: '#ffffff', border: '1px solid #E2E8F0', borderRadius: 12, padding: 14, position: 'relative', overflow: 'hidden', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 11 }}>
                          <div><strong style={{ color: '#007A5E' }}>To:</strong> partner@firm.com</div>
                          <div><strong style={{ color: '#007A5E' }}>Subject:</strong> Secure Transaction payload</div>
                          <div style={{ borderTop: '1px solid #E2E8F0', paddingTop: 6, color: '#64748B' }}>
                            Please review the attached release payload...
                          </div>
                        </div>
                        {/* Send Button */}
                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
                          <div style={{ background: '#007A5E', color: 'white', padding: '6px 14px', borderRadius: 6, fontSize: 11, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', position: 'relative' }}>
                            Send 📤
                            {/* Glowing Click indicator */}
                            <div style={{ position: 'absolute', right: -6, bottom: -6, width: 16, height: 16, borderRadius: '50%', background: 'rgba(0, 122, 94, 0.4)', animation: 'pulseDot 1.5s infinite' }} />
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
                      <div style={{ fontSize: 11, fontWeight: 800, color: '#007A5E', textTransform: 'uppercase', letterSpacing: '0.05em' }}>KINETIC CALIBRATION POPUP</div>
                      <div style={{ background: '#ffffff', border: '1px solid #E2E8F0', borderRadius: 12, padding: 12, position: 'relative', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #F1F5F9', paddingBottom: 6, marginBottom: 8 }}>
                          <span style={{ fontSize: 11, fontWeight: 800, color: '#0F172A' }}>🛡️ Attest verification</span>
                          <span style={{ fontSize: 9, background: '#E6F4EA', color: '#0D7A5E', padding: '2px 6px', borderRadius: 4, fontWeight: 800 }}>ACTIVE</span>
                        </div>
                        {/* Simulation grid */}
                        <div style={{ height: 70, background: '#F8FAFC', border: '1px dashed #CBD5E1', borderRadius: 8, position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <svg width="180" height="40" style={{ opacity: 0.8 }}>
                            <path d="M 10 20 Q 50 5, 90 20 T 170 20" fill="none" stroke="#007A5E" strokeWidth="2.5" strokeDasharray="4 4" />
                            {/* Animated Cursor dot moving */}
                            <circle r="4" fill="#007A5E">
                              <animateMotion dur="2.5s" repeatCount="indefinite" path="M 10 20 Q 50 5, 90 20 T 170 20" />
                            </circle>
                          </svg>
                          <span style={{ position: 'absolute', bottom: 4, right: 6, fontSize: 8, fontFamily: "'JetBrains Mono', monospace", color: '#64748B' }}>Analyzing...</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, marginTop: 6, fontFamily: "'JetBrains Mono', monospace", color: '#64748B' }}>
                          <span>Jitter: Natural (0.819)</span>
                          <span style={{ color: '#0D7A5E', fontWeight: 700 }}>VERDICT : PASSED</span>
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
                      <div style={{ fontSize: 11, fontWeight: 800, color: '#007A5E', textTransform: 'uppercase', letterSpacing: '0.05em' }}>CRYPTOGRAPHIC STAMP RELEASE</div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, background: '#ffffff', border: '1px solid #E2E8F0', borderRadius: 12, padding: 16, boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
                        <div style={{ fontSize: 32 }}>🔑</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <span style={{ fontSize: 10, fontWeight: 800, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>RELEASE TOKEN</span>
                          <span style={{ fontSize: 10, fontFamily: "'JetBrains Mono', monospace", background: '#F0FDF4', padding: '4px 8px', borderRadius: 4, border: '1px solid #C2E7CD', color: '#0D7A5E' }}>
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
                      <div style={{ fontSize: 11, fontWeight: 800, color: '#007A5E', textTransform: 'uppercase', letterSpacing: '0.05em' }}>RECIPIENT TRUST STAMP</div>
                      <div style={{ background: '#ffffff', border: '1px solid #E2E8F0', borderRadius: 12, padding: 14, boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, borderBottom: '1px solid #F1F5F9', paddingBottom: 8, marginBottom: 8 }}>
                          <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#0D7A5E' }} />
                          <strong style={{ color: '#0F172A' }}>From: CEO (ceo@company.com)</strong>
                        </div>
                        {/* Glowing Verified Badge */}
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#E6F4EA', border: '1px solid #A7F3D0', padding: '6px 12px', borderRadius: 8 }}>
                          <span style={{ fontSize: 12 }}>🛡️</span>
                          <span style={{ fontSize: 10, fontWeight: 950, color: '#0D7A5E', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Verified Human Attestation</span>
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



      {/* ── THE PROBLEM & THE SOLUTION UNIFIED FLOW ── */}
      <section id="flow-section" style={{ padding: '96px 24px', background: '#F9FBF8', borderBottom: '1px solid #E4EBE3', overflow: 'hidden' }}>
        <style dangerouslySetInnerHTML={{
          __html: `
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
          .attest-spinner {
            animation: spin 1.2s linear infinite;
          }
          @media (max-width: 1024px) {
            .flow-arrow {
              transform: rotate(90deg) !important;
              margin: 16px 0 !important;
            }
          }
        `}} />
        <div className="container-custom">

          {/* Section Header */}
          <div className="animate-on-scroll" style={{ textAlign: 'center', marginBottom: 64, maxWidth: 900, margin: '0 auto 64px auto' }}>
            <h2 style={{
              fontFamily: "'Lora', 'Playfair Display', Georgia, serif",
              fontSize: 'clamp(28px, 3.5vw, 42px)',
              fontWeight: 700,
              color: '#111827',
              letterSpacing: '-0.02em',
              lineHeight: 1.2,
              margin: '0 auto 16px auto',
              maxWidth: 900
            }}>
              As AI Agents Scale, Human Authenticity <br /> Becomes Harder to Prove. <span style={{ color: '#007A5E', fontStyle: 'italic' }}>Attest</span> Solves That.
            </h2>

            <p style={{ fontSize: 15, color: '#4B5563', lineHeight: 1.6, maxWidth: 720, margin: '0 auto', fontWeight: 500 }}>
              Let <strong style={{ color: '#111827', fontWeight: 600 }}>Attest</strong> prove that a real human sent your emails, without reading contents, interrupting workflows, or requiring complex setup.
            </p>
          </div>

          {/* 3-Column flowchart container */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 24 }}>

              {/* COLUMN 1: Problem */}
              <div className="card-hover-lift animate-from-left" style={{
                background: 'linear-gradient(135deg, #FFFDF5 0%, #FFF9E6 100%)',
                border: '1px solid #FEF3C7',
                borderRadius: 24,
                padding: '32px 24px',
                display: 'flex',
                flexDirection: 'column',
                gap: 24,
                position: 'relative',
                boxShadow: '0 10px 30px -10px rgba(217, 119, 6, 0.05)'
              }}>
                {/* Floating Warning Card */}
                <div style={{
                  position: 'absolute',
                  top: 24,
                  right: 24,
                  background: '#ffffff',
                  border: '1px solid #FDE68A',
                  borderRadius: 16,
                  width: 52,
                  height: 52,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 10px 25px -5px rgba(217, 119, 6, 0.12)',
                  transform: 'rotate(12deg)'
                }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                    <path d="M12 2L2 22h20L12 2z" fill="#F59E0B" />
                    <path d="M12 9v5" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" />
                    <circle cx="12" cy="17" r="1.25" fill="#ffffff" />
                  </svg>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <h3 style={{ fontSize: 20, fontWeight: 800, color: '#1F2937', margin: 0 }}>
                    <span style={{ color: '#D97706', marginRight: 6 }}>1.</span> Problem
                  </h3>
                  <p style={{ fontSize: 13, color: '#4B5563', lineHeight: 1.6, margin: 0, fontWeight: 500, maxWidth: '82%' }}>
                    AI-generated communication is becoming increasingly difficult to distinguish from human communication.
                  </p>
                </div>

                {/* Overlapping Mockup Inbox Screens */}
                <div style={{ position: 'relative', height: 250, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '8px 0' }}>
                  {/* Behind Card */}
                  <div style={{
                    position: 'absolute',
                    left: '4%',
                    top: '18%',
                    width: '78%',
                    height: 180,
                    background: '#ffffff',
                    border: '1px solid #E2E8F0',
                    borderRadius: 16,
                    boxShadow: '0 4px 15px rgba(0,0,0,0.02)',
                    opacity: 0.7,
                    transform: 'translate(-8px, 8px) rotate(-3deg)',
                    padding: '12px 14px',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 10
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 800, color: '#1F2937' }}>
                      <span>📥 Inbox</span>
                      <span style={{ background: '#EF4444', color: '#ffffff', borderRadius: 9999, padding: '1px 5px', fontSize: 8 }}>127</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 9, color: '#6B7280', fontWeight: 600 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span>📬</span> Starred</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span>📤</span> Sent</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span>📝</span> Drafts</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span>🚫</span> Spam
                        <span style={{ background: '#EF4444', color: '#ffffff', borderRadius: 9999, padding: '1px 5px', fontSize: 7, marginLeft: 'auto' }}>84</span>
                      </div>
                    </div>
                  </div>

                  {/* Front Card */}
                  <div style={{
                    position: 'absolute',
                    right: '4%',
                    top: '4%',
                    width: '84%',
                    background: '#ffffff',
                    border: '1px solid #E2E8F0',
                    borderRadius: 16,
                    boxShadow: '0 10px 30px rgba(0,0,0,0.05)',
                    padding: '14px 16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 10,
                    zIndex: 2
                  }}>
                    {/* Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, fontWeight: 800, borderBottom: '1px solid #F1F5F9', paddingBottom: 6 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#1F2937' }}>
                        <span>Inbox</span>
                        <span style={{ background: '#EF4444', color: '#ffffff', borderRadius: 9999, padding: '1px 5px', fontSize: 8 }}>127</span>
                      </div>
                      <div style={{ display: 'flex', gap: 8, color: '#9CA3AF', fontSize: 10 }}>
                        <span>🔍</span>
                        <span>☷</span>
                      </div>
                    </div>
                    {/* Email Items */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {[
                        { sender: 'Exclusive Offer Just for You!', time: '10:42 AM', unread: true, bg: '#F3E8FF', emoji: '🤖' },
                        { sender: 'Investment Opportunity', time: '9:35 AM', unread: false, bg: '#D1FAE5', emoji: '🤖' },
                        { sender: 'Urgent: Verify Your Account', time: '8:15 AM', unread: false, bg: '#E5E7EB', emoji: '👤' },
                        { sender: 'Meeting Request', time: '7:42 AM', unread: false, bg: '#F3F4F6', emoji: '👤' }
                      ].map((item, idx) => (
                        <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          {/* Avatar Icon */}
                          <div style={{
                            width: 22,
                            height: 22,
                            borderRadius: '50%',
                            background: item.bg,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 11,
                            flexShrink: 0
                          }}>
                            {item.emoji}
                          </div>
                          {/* Content */}
                          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ fontSize: 9, fontWeight: 700, color: '#1F2937', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.sender}</span>
                              <span style={{ fontSize: 7.5, color: '#9CA3AF', whiteSpace: 'nowrap' }}>{item.time}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              {/* AI Generated Badge */}
                              <span style={{
                                background: '#FEE2E2',
                                color: '#EF4444',
                                fontSize: 7,
                                fontWeight: 800,
                                padding: '1px 5px',
                                borderRadius: 4,
                                textTransform: 'uppercase',
                                letterSpacing: '0.02em'
                              }}>
                                AI Generated
                              </span>
                              {item.unread && <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#EF4444' }} />}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Curved dotted pointer arrow */}
                  <div style={{ position: 'absolute', left: 4, bottom: 8, pointerEvents: 'none', zIndex: 3 }}>
                    <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
                      <path d="M 5 35 C 5 20, 20 15, 25 15" stroke="#F59E0B" strokeWidth="1.5" strokeDasharray="3 3" strokeLinecap="round" />
                      <polygon points="23,11 29,15 23,19" fill="#F59E0B" />
                    </svg>
                  </div>
                </div>

                {/* Bottom Banner */}
                <div style={{
                  background: '#FFFBEB',
                  border: '1px solid #FDE68A',
                  borderRadius: 16,
                  padding: '12px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  marginTop: 'auto'
                }}>
                  <span style={{ fontSize: 16 }}>⚠️</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#B45309' }}>
                    Hard to tell if this was written by a human
                  </span>
                </div>
              </div>

              {/* COLUMN 2: Limitation of Current Systems */}
              <div className="card-hover-lift animate-on-scroll" style={{
                background: 'linear-gradient(135deg, #FFF5F5 0%, #FFF0F0 100%)',
                border: '1px solid #FEE2E2',
                borderRadius: 24,
                padding: '32px 24px',
                display: 'flex',
                flexDirection: 'column',
                gap: 24,
                position: 'relative',
                boxShadow: '0 10px 30px -10px rgba(219, 39, 119, 0.05)'
              }}>
                {/* Floating Padlock Card */}
                <div style={{
                  position: 'absolute',
                  top: 24,
                  right: 24,
                  background: '#ffffff',
                  border: '1px solid #FEE2E2',
                  borderRadius: 16,
                  width: 52,
                  height: 52,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 10px 25px -5px rgba(219, 39, 119, 0.12)',
                  transform: 'rotate(-8deg)'
                }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#DB2777" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <h3 style={{ fontSize: 20, fontWeight: 800, color: '#1F2937', margin: 0 }}>
                    <span style={{ color: '#DB2777', marginRight: 6 }}>2.</span> Limitation of Current Systems
                  </h3>
                  <p style={{ fontSize: 13, color: '#4B5563', lineHeight: 1.6, margin: 0, fontWeight: 500, maxWidth: '82%' }}>
                    Existing authentication can verify systems and domains, but not if a real human sent it.
                  </p>
                </div>

                {/* Authentication list and Question Mark visual */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 250, margin: '8px 0', position: 'relative' }}>
                  {/* Left checklist */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '48%', zIndex: 2 }}>
                    {[
                      'SPF',
                      'DKIM',
                      'DMARC',
                      'Domain',
                      'TLS',
                      'Sender'
                    ].map((item) => (
                      <div key={item} style={{
                        background: '#ffffff',
                        border: '1px solid #F3F4F6',
                        borderRadius: 8,
                        padding: '6px 10px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.01)'
                      }}>
                        <span style={{ fontSize: 9, fontWeight: 800, color: '#374151' }}>{item}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <span style={{ fontSize: 8, color: '#007A5E', fontWeight: 800 }}>Verified</span>
                          <div style={{
                            width: 12,
                            height: 12,
                            borderRadius: '50%',
                            background: '#D1FAE5',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}>
                            <span style={{ color: '#007A5E', fontSize: 8, fontWeight: 900 }}>✓</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* SVG Connector Lines */}
                  <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 1 }}>
                    <svg width="100%" height="100%" viewBox="0 0 300 240" style={{ position: 'absolute', inset: 0 }}>
                      <path d="M 140 30 C 170 30, 180 110, 210 110" fill="none" stroke="#FBCFE8" strokeWidth="1.5" strokeDasharray="3 3" />
                      <path d="M 140 66 C 170 66, 180 115, 210 115" fill="none" stroke="#FBCFE8" strokeWidth="1.5" strokeDasharray="3 3" />
                      <path d="M 140 102 C 170 102, 180 120, 210 120" fill="none" stroke="#FBCFE8" strokeWidth="1.5" strokeDasharray="3 3" />
                      <path d="M 140 138 C 170 138, 180 125, 210 125" fill="none" stroke="#FBCFE8" strokeWidth="1.5" strokeDasharray="3 3" />
                      <path d="M 140 174 C 170 174, 180 130, 210 130" fill="none" stroke="#FBCFE8" strokeWidth="1.5" strokeDasharray="3 3" />
                      <path d="M 140 210 C 170 210, 180 135, 210 135" fill="none" stroke="#FBCFE8" strokeWidth="1.5" strokeDasharray="3 3" />
                    </svg>
                  </div>

                  {/* Right circle */}
                  <div style={{
                    width: '46%',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 10,
                    zIndex: 2
                  }}>
                    {/* Dotted Circle */}
                    <div style={{
                      width: 86,
                      height: 86,
                      borderRadius: '50%',
                      border: '2px dashed #F472B6',
                      background: '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 4px 12px rgba(244, 114, 182, 0.06)'
                    }}>
                      <span style={{ fontSize: 32, fontWeight: 900, color: '#DB2777' }}>?</span>
                    </div>
                    {/* Label and Badge */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                      <span style={{ fontSize: 10, fontWeight: 800, color: '#374151' }}>Human Sender</span>
                      <span style={{
                        background: '#FCE7F3',
                        color: '#DB2777',
                        fontSize: 8,
                        fontWeight: 900,
                        padding: '2px 7px',
                        borderRadius: 9999,
                        textTransform: 'uppercase',
                        letterSpacing: '0.02em'
                      }}>
                        Not Verifiable
                      </span>
                    </div>
                  </div>
                </div>

                {/* Bottom Banner */}
                <div style={{
                  background: '#FFF5F5',
                  border: '1px solid #FCA5A5',
                  borderRadius: 16,
                  padding: '12px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  marginTop: 'auto'
                }}>
                  <div style={{
                    width: 20,
                    height: 20,
                    borderRadius: '50%',
                    background: '#EF4444',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    <span style={{ color: '#ffffff', fontSize: 11, fontWeight: 900 }}>!</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    <span style={{ fontSize: 10, fontWeight: 800, color: '#9D174D', lineHeight: 1.2 }}>
                      Systems verify everything except the human.
                    </span>
                    <span style={{ fontSize: 9, color: '#DB2777', fontWeight: 650, lineHeight: 1.2 }}>
                      The most important factor remains unknown.
                    </span>
                  </div>
                </div>
              </div>

              {/* COLUMN 3: How Attest Solves It */}
              <div className="card-hover-lift animate-from-right" style={{
                background: 'linear-gradient(135deg, #F0FDF4 0%, #E6FDF0 100%)',
                border: '1px solid #DCFCE7',
                borderRadius: 24,
                padding: '32px 24px',
                display: 'flex',
                flexDirection: 'column',
                gap: 24,
                position: 'relative',
                boxShadow: '0 10px 30px -10px rgba(5, 150, 105, 0.05)'
              }}>
                {/* Floating Shield Card */}
                <div style={{
                  position: 'absolute',
                  top: 24,
                  right: 24,
                  background: '#ffffff',
                  border: '1px solid #DCFCE7',
                  borderRadius: 16,
                  width: 52,
                  height: 52,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 10px 25px -5px rgba(5, 150, 105, 0.12)',
                  transform: 'rotate(10deg)'
                }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#007A5E" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    <path d="M9 11l2 2 4-4" />
                  </svg>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <h3 style={{ fontSize: 20, fontWeight: 800, color: '#1F2937', margin: 0 }}>
                    <span style={{ color: '#007A5E', marginRight: 6 }}>3.</span> How Attest Solves It
                  </h3>
                  <p style={{ fontSize: 13, color: '#4B5563', lineHeight: 1.6, margin: 0, fontWeight: 500, maxWidth: '82%' }}>
                    Attest verifies real human interaction and adds a trusted human-authenticated signature.
                  </p>
                </div>

                {/* Trust Record Visual Card */}
                <div style={{
                  background: '#ffffff',
                  border: '1px solid #E2E8F0',
                  borderRadius: 16,
                  padding: 14,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                  boxShadow: '0 6px 20px rgba(0,0,0,0.02)',
                  margin: '8px 0',
                  height: 250,
                  justifyContent: 'space-between'
                }}>
                  {/* Trust Record Header */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#007A5E' }} />
                      <span style={{ fontSize: 10, fontWeight: 800, color: '#1F2937' }}>Human Verified Trust Record</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 7.5 }}>
                      <span style={{ fontFamily: "'JetBrains Mono', monospace", color: '#6B7280' }}>Hash: 043a718774c572bd...</span>
                      <span style={{ color: '#007A5E', fontWeight: 700, cursor: 'pointer', textDecoration: 'underline' }}>Verify on HVEL Portal ↗</span>
                    </div>
                  </div>

                  {/* Mouse Activity Inner Box */}
                  <div style={{
                    background: '#F0FDF4',
                    border: '1px solid #DCFCE7',
                    borderRadius: 12,
                    padding: '8px 10px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                    position: 'relative'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ fontSize: 10 }}>🖱️</span>
                        <span style={{ fontSize: 8.5, fontWeight: 800, color: '#1F2937' }}>Mouse Activity</span>
                      </div>
                      <span style={{
                        background: '#D1FAE5',
                        color: '#007A5E',
                        fontSize: 7.5,
                        fontWeight: 800,
                        padding: '1px 5px',
                        borderRadius: 4
                      }}>
                        Verified ✓
                      </span>
                    </div>

                    {/* Mouse Trace Line Chart */}
                    <div style={{ height: 46, position: 'relative', overflow: 'hidden' }}>
                      <svg width="100%" height="100%" viewBox="0 0 160 50">
                        <path d="M 10 35 C 30 10, 50 40, 80 20 C 110 5, 130 35, 150 15" fill="none" stroke="#A7F3D0" strokeWidth="1.5" strokeDasharray="3 3" />
                        <path d="M 10 35 C 30 10, 50 40, 80 20 C 110 5, 130 35, 150 15" fill="none" stroke="#007A5E" strokeWidth="2.5" strokeLinecap="round" />
                        <circle cx="10" cy="35" r="2.5" fill="#007A5E" />
                        <circle cx="28" cy="12" r="2.5" fill="#007A5E" />
                        <circle cx="51" cy="39" r="2.5" fill="#007A5E" />
                        <circle cx="80" cy="20" r="2.5" fill="#007A5E" />
                        <circle cx="108" cy="6" r="2.5" fill="#007A5E" />
                        <circle cx="132" cy="33" r="2.5" fill="#007A5E" />
                        <circle cx="150" cy="15" r="2.5" fill="#007A5E" />
                        <g transform="translate(108, 6) scale(0.55)">
                          <polygon points="0,0 4,13 8,9 13,14 14,13 9,8 13,4" fill="#007A5E" stroke="#ffffff" strokeWidth="1" />
                        </g>
                      </svg>

                      {/* Small floating green badge */}
                      <div style={{
                        position: 'absolute',
                        bottom: 2,
                        right: 2,
                        background: '#ffffff',
                        border: '1px solid #A7F3D0',
                        borderRadius: 6,
                        padding: '2px 5px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 3,
                        boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
                      }}>
                        <span style={{ fontSize: 9 }}>🛡️</span>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontSize: 6.5, fontWeight: 800, color: '#1F2937', lineHeight: 1.1 }}>Human Movement</span>
                          <span style={{ fontSize: 6, color: '#007A5E', fontWeight: 800, lineHeight: 1.1 }}>Pattern Detected</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Trust Score */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 9, fontWeight: 800, color: '#475569' }}>Trust Score</span>
                      <span style={{ fontSize: 13, fontWeight: 900, color: '#007A5E' }}>100%</span>
                    </div>
                    <div style={{ height: 5, background: '#E2E8F0', borderRadius: 9999, overflow: 'hidden' }}>
                      <div style={{ width: '100%', height: '100%', background: '#007A5E', borderRadius: 9999 }} />
                    </div>
                  </div>
                </div>

                {/* Bottom Footer links */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  borderTop: '1px solid #DCFCE7',
                  paddingTop: 12,
                  fontSize: 9,
                  color: '#047857',
                  fontWeight: 700,
                  marginTop: 'auto'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span>🔒</span> Cryptographically Signed
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span>🛡️</span> Tamper-proof
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span>✓</span> Verifiable
                  </div>
                </div>
              </div>

            </div>
          </div>

          {/* Bottom Features Row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 20, marginTop: 64, background: '#ffffff', borderRadius: 24, border: '1px solid #E4EBE3', padding: '24px 32px', boxShadow: '0 8px 32px rgba(0,0,0,0.02)' }}>
            {[
              {
                title: 'Human verification',
                desc: 'Not bots. Real people.',
                icon: (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#007A5E" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  </svg>
                )
              },
              {
                title: 'Sender proof',
                desc: 'Proves a real human sent every email.',
                icon: (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#007A5E" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M2 12a10 10 0 0 1 10-10c5.52 0 10 4.48 10 10" />
                    <path d="M6 12a6 6 0 0 1 6-6" />
                    <path d="M10 12a2 2 0 0 1 2-2" />
                  </svg>
                )
              },
              {
                title: 'Tamper proof',
                desc: 'Cryptographic signatures prevent manipulation.',
                icon: (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#007A5E" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                )
              },
              {
                title: 'Enterprise ready',
                desc: 'Works across your existing email workflow.',
                icon: (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#007A5E" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="4" y="2" width="16" height="20" rx="2" ry="2" />
                    <line x1="9" y1="22" x2="9" y2="16" />
                    <line x1="15" y1="22" x2="15" y2="16" />
                    <line x1="9" y1="16" x2="15" y2="16" />
                    <path d="M8 6h8M8 10h8" />
                  </svg>
                )
              }
            ].map((card, idx) => (
              <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <div style={{ background: '#E6F4EA', padding: 8, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {card.icon}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{ fontSize: 13, fontWeight: 800, color: '#1F2937' }}>{card.title}</span>
                  <span style={{ fontSize: 11, color: '#4B5563', lineHeight: 1.4 }}>{card.desc}</span>
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
          <div className="animate-on-scroll" style={{ marginBottom: 48, maxWidth: 800 }}>
            <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#007A5E', display: 'block', marginBottom: 6 }}>
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
            <div className="animate-from-left" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              {/* Interactive Canvas Grid (Clean Grid mockup) */}
              <div
                ref={trackingAreaRef}
                onPointerMove={handlePointerMove}
                onPointerLeave={handlePointerLeave}
                style={{
                  width: '100%',
                  height: 280,
                  background: '#ffffff',
                  backgroundImage: 'radial-gradient(rgba(0, 122, 94, 0.12) 1px, transparent 1px)',
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
                  style={{ padding: '12px 24px', background: '#007A5E', border: 'none', color: '#ffffff', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s' }}
                  className="premium-shadow"
                >
                  Reset Canvas
                </button>
              </div>
            </div>

            {/* Right Side: Simplified Behavior Analysis Card */}
            <div className="animate-from-right" style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ background: '#ffffff', border: '1px solid #E2E8F0', borderRadius: 16, padding: 36, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }} className="premium-shadow">
                <div>
                  <h3 style={{ fontSize: 13, fontWeight: 800, color: '#007A5E', marginBottom: 24, textTransform: 'uppercase', letterSpacing: '0.08em', borderBottom: '1px solid #F1F5F9', paddingBottom: 10 }}>
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
                      color: stats.verdict.includes('BOT') ? '#DC2626' : stats.verdict.includes('HUMAN') ? '#047857' : '#007A5E',
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
      <section style={{ padding: '96px 24px', background: '#FDFDFD', borderBottom: '1px solid #E2E8F0' }}>
        <div className="container-custom">
          <style>{`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
            .attest-spinner-animate {
              animation: spin 1.2s linear infinite;
            }
          `}</style>

          {/* Top Pill Badge */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
            <div style={{ background: '#E6FDF0', border: '1px solid #DCFCE7', color: '#007A5E', display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 16px', borderRadius: 9999, fontSize: 12, fontWeight: 700, letterSpacing: '0.03em', textTransform: 'uppercase' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                <path d="M9 11l2 2 4-4" />
              </svg>
              Simple. Secure. Human.
            </div>
          </div>

          <div className="animate-on-scroll" style={{ textAlign: 'center', marginBottom: 64 }}>
            <h3 style={{ fontSize: 'clamp(32px, 4.2vw, 48px)', fontWeight: 950, color: '#0F172A', letterSpacing: '-0.03em', lineHeight: 1.15, marginBottom: 20 }}>
              Proving a Real Human Sent It <br />
              Takes Just <span style={{ color: '#007A5E', fontStyle: 'italic' }}>5 Steps</span>
            </h3>

            <p style={{ fontSize: 16, color: '#64748B', lineHeight: 1.6, fontWeight: 500, margin: '0 auto 6px auto', maxWidth: 700 }}>
              No complex integrations, workflow changes, or content access required.
            </p>
            <p style={{ fontSize: 16, color: '#64748B', lineHeight: 1.6, fontWeight: 500, margin: '0 auto', maxWidth: 700 }}>
              Attest proves a real human sent every verified email in just a few simple steps.
            </p>
          </div>

          {/* 5-Card Step Layout */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(5, minmax(180px, 1fr))',
            gap: 20,
            marginTop: 28,
            paddingTop: 20,
            paddingBottom: 16,
            paddingLeft: 8,
            paddingRight: 8,
            overflowX: 'auto'
          }}>

            {/* STEP 1: Install Attest */}
            <div style={{
              background: 'linear-gradient(180deg, #FFFDF5 0%, #FFFBEB 100%)',
              border: '1px solid #FEF3C7',
              borderRadius: 24,
              padding: '36px 16px 24px 16px',
              display: 'flex',
              flexDirection: 'column',
              gap: 20,
              position: 'relative',
              boxShadow: '0 8px 30px rgba(245, 158, 11, 0.03)'
            }}>
              {/* Floating Step Number */}
              <div style={{
                position: 'absolute',
                top: -16,
                left: '50%',
                transform: 'translateX(-50%)',
                background: '#ffffff',
                border: '1px solid #FDE68A',
                color: '#D97706',
                width: 32,
                height: 32,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 12,
                fontWeight: 900,
                boxShadow: '0 4px 10px rgba(217, 119, 6, 0.08)'
              }}>01</div>

              {/* Inside Mockup: Chrome Web Store card */}
              <div style={{
                background: '#ffffff',
                border: '1px solid #F1F5F9',
                borderRadius: 16,
                padding: '14px 12px',
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.01)',
                height: 230,
                justifyContent: 'space-between'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 8.5, fontWeight: 700, color: '#6B7280', borderBottom: '1px solid #F1F5F9', paddingBottom: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 10 }}>🌐</span>
                    <span>chrome web store</span>
                  </div>
                  <span>⋮</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 6 }}>
                  <div style={{
                    width: 34,
                    height: 34,
                    borderRadius: 8,
                    background: '#007A5E',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#ffffff',
                    fontSize: 18,
                    fontWeight: 900
                  }}>A</div>
                  <span style={{ fontSize: 11, fontWeight: 800, color: '#1F2937' }}>Attest for Gmail</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 2, fontSize: 8 }}>
                    <span style={{ color: '#F59E0B' }}>★★★★★</span>
                    <span style={{ color: '#6B7280', fontWeight: 600 }}>4.9</span>
                    <span style={{ color: '#9CA3AF' }}>1,250 reviews</span>
                  </div>
                  <span style={{ fontSize: 8.5, color: '#6B7280', fontWeight: 550, lineHeight: 1.2 }}>
                    Prove a real human sent every email you send.
                  </span>
                </div>
                <button style={{
                  width: '100%',
                  background: '#007A5E',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: 6,
                  padding: '7px 0',
                  fontSize: 10,
                  fontWeight: 800,
                  cursor: 'pointer'
                }}>Add to Chrome</button>
              </div>

              {/* Below Mockup */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center', textAlign: 'center' }}>
                <div style={{
                  width: 30,
                  height: 30,
                  borderRadius: '50%',
                  background: '#FEF3C7',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 12
                }}>💛</div>
                <h4 style={{ fontSize: 13, fontWeight: 800, color: '#1F2937', margin: 0 }}>Install Attest</h4>
                <p style={{ fontSize: 11, color: '#6B7280', lineHeight: 1.4, margin: 0, fontWeight: 550 }}>
                  Add the Attest extension to your Gmail in seconds.
                </p>
              </div>
            </div>

            {/* STEP 2: Communicate Normally */}
            <div style={{
              background: 'linear-gradient(180deg, #FFF5F5 0%, #FFF0F2 100%)',
              border: '1px solid #FEE2E2',
              borderRadius: 24,
              padding: '36px 16px 24px 16px',
              display: 'flex',
              flexDirection: 'column',
              gap: 20,
              position: 'relative',
              boxShadow: '0 8px 30px rgba(239, 68, 68, 0.02)'
            }}>
              {/* Floating Step Number */}
              <div style={{
                position: 'absolute',
                top: -16,
                left: '50%',
                transform: 'translateX(-50%)',
                background: '#ffffff',
                border: '1px solid #FCA5A5',
                color: '#DB2777',
                width: 32,
                height: 32,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 12,
                fontWeight: 900,
                boxShadow: '0 4px 10px rgba(219, 39, 119, 0.08)'
              }}>02</div>

              {/* Inside Mockup: Gmail Compose window */}
              <div style={{
                background: '#ffffff',
                border: '1px solid #F1F5F9',
                borderRadius: 16,
                padding: 10,
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.01)',
                height: 230,
                justifyContent: 'space-between'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #F1F5F9', paddingBottom: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 8.5, fontWeight: 700, color: '#1F2937' }}>
                    <span style={{ color: '#EA4335', fontWeight: 900 }}>M</span>
                    <span>Gmail</span>
                  </div>
                  <div style={{ display: 'flex', gap: 4, color: '#9CA3AF', fontSize: 7 }}>
                    <span>─</span>
                    <span>⤢</span>
                    <span>✕</span>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 7.5 }}>
                  <div style={{ alignSelf: 'flex-start', background: '#FCE7F3', color: '#DB2777', padding: '2px 6px', borderRadius: 4, fontWeight: 800 }}>Compose ▾</div>
                  <div style={{ borderBottom: '1px solid #F1F5F9', paddingBottom: 2, color: '#4B5563', fontWeight: 500 }}>
                    <span style={{ color: '#9CA3AF' }}>To</span> client@company.com
                  </div>
                  <div style={{ borderBottom: '1px solid #F1F5F9', paddingBottom: 2, color: '#4B5563', fontWeight: 500 }}>
                    <span style={{ color: '#9CA3AF' }}>Subject</span> Project Update
                  </div>
                </div>
                <div style={{ fontSize: 7.5, color: '#4B5563', lineHeight: 1.25, fontWeight: 500, flex: 1, marginTop: 4 }}>
                  Hi Sarah,<br />
                  The final design files are attached. Please review them before Friday.<br />
                  Let me know your feedback.<br />
                  Regards,<br />
                  John
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #F1F5F9', paddingTop: 4 }}>
                  <button style={{
                    background: '#DB2777',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: 4,
                    padding: '2px 8px',
                    fontSize: 8,
                    fontWeight: 800,
                    cursor: 'pointer'
                  }}>Send</button>
                  <div style={{ display: 'flex', gap: 5, color: '#9CA3AF', fontSize: 8 }}>
                    <span>📎</span>
                    <span>🔗</span>
                    <span>😊</span>
                    <span>🗑️</span>
                  </div>
                </div>
              </div>

              {/* Below Mockup */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center', textAlign: 'center' }}>
                <div style={{
                  width: 30,
                  height: 30,
                  borderRadius: '50%',
                  background: '#FEE2E2',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 12
                }}>💗</div>
                <h4 style={{ fontSize: 13, fontWeight: 800, color: '#1F2937', margin: 0 }}>Communicate Normally</h4>
                <p style={{ fontSize: 11, color: '#6B7280', lineHeight: 1.4, margin: 0, fontWeight: 550 }}>
                  Continue using your existing email workflows as usual. No changes needed.
                </p>
              </div>
            </div>

            {/* STEP 3: Verify Human Activity */}
            <div style={{
              background: 'linear-gradient(180deg, #F5F3FF 0%, #EEF2FF 100%)',
              border: '1px solid #DDD6FE',
              borderRadius: 24,
              padding: '36px 16px 24px 16px',
              display: 'flex',
              flexDirection: 'column',
              gap: 20,
              position: 'relative',
              boxShadow: '0 8px 30px rgba(124, 58, 237, 0.02)'
            }}>
              {/* Floating Step Number */}
              <div style={{
                position: 'absolute',
                top: -16,
                left: '50%',
                transform: 'translateX(-50%)',
                background: '#ffffff',
                border: '1px solid #C7D2FE',
                color: '#6366F1',
                width: 32,
                height: 32,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 12,
                fontWeight: 900,
                boxShadow: '0 4px 10px rgba(99, 102, 241, 0.08)'
              }}>03</div>

              {/* Inside Mockup: Attest verification screen */}
              <div style={{
                background: '#ffffff',
                border: '1px solid #F1F5F9',
                borderRadius: 16,
                padding: '12px 10px',
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.01)',
                height: 230,
                justifyContent: 'space-between'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9.5, fontWeight: 800, color: '#007A5E' }}>
                    <span>A</span>
                    <span style={{ color: '#1F2937' }}>Attest</span>
                  </div>
                  <span style={{ color: '#9CA3AF', fontSize: 9 }}>✕</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 6, margin: '8px 0' }}>
                  <div className="attest-spinner-animate" style={{
                    width: 24,
                    height: 24,
                    border: '2.5px solid #E2E8F0',
                    borderTop: '2.5px solid #6366F1',
                    borderRadius: '50%'
                  }} />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    <span style={{ fontSize: 9, fontWeight: 800, color: '#1F2937' }}>Verifying human sender...</span>
                    <span style={{ fontSize: 7, color: '#6B7280', fontWeight: 550 }}>Analyzing before email is sent</span>
                  </div>
                </div>
                <div style={{
                  background: '#F5F3FF',
                  border: '1px solid #DDD6FE',
                  borderRadius: 10,
                  padding: '6px 8px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 3
                }}>
                  <div style={{
                    width: 12,
                    height: 12,
                    borderRadius: '50%',
                    background: '#C4B5FD',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <span style={{ color: '#7C3AED', fontSize: 7, fontWeight: 900 }}>✓</span>
                  </div>
                  <span style={{ fontSize: 8, fontWeight: 800, color: '#1F2937' }}>Human sender verified</span>
                  <span style={{ fontSize: 6.5, color: '#7C3AED', fontWeight: 700 }}>Real human activity detected</span>
                </div>
              </div>

              {/* Below Mockup */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center', textAlign: 'center' }}>
                <div style={{
                  width: 30,
                  height: 30,
                  borderRadius: '50%',
                  background: '#E0E7FF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 12
                }}>🔍</div>
                <h4 style={{ fontSize: 13, fontWeight: 800, color: '#1F2937', margin: 0 }}>Verify Human Activity</h4>
                <p style={{ fontSize: 11, color: '#6B7280', lineHeight: 1.4, margin: 0, fontWeight: 550 }}>
                  Attest quietly verifies that a real human is behind every email you send.
                </p>
              </div>
            </div>

            {/* STEP 4: Verification Added */}
            <div style={{
              background: 'linear-gradient(180deg, #F0FDF4 0%, #E6FDF0 100%)',
              border: '1px solid #DCFCE7',
              borderRadius: 24,
              padding: '36px 16px 24px 16px',
              display: 'flex',
              flexDirection: 'column',
              gap: 20,
              position: 'relative',
              boxShadow: '0 8px 30px rgba(16, 185, 129, 0.02)'
            }}>
              {/* Floating Step Number */}
              <div style={{
                position: 'absolute',
                top: -16,
                left: '50%',
                transform: 'translateX(-50%)',
                background: '#ffffff',
                border: '1px solid #A7F3D0',
                color: '#007A5E',
                width: 32,
                height: 32,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 12,
                fontWeight: 900,
                boxShadow: '0 4px 10px rgba(5, 150, 105, 0.08)'
              }}>04</div>

              {/* Inside Mockup: Attest verification confirmation */}
              <div style={{
                background: '#ffffff',
                border: '1px solid #F1F5F9',
                borderRadius: 16,
                padding: '12px 10px',
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.01)',
                height: 230,
                justifyContent: 'space-between'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9.5, fontWeight: 800, color: '#007A5E' }}>
                    <span>A</span>
                    <span style={{ color: '#1F2937' }}>Attest</span>
                  </div>
                  <span style={{ background: '#D1FAE5', color: '#007A5E', fontSize: 7, fontWeight: 800, padding: '1px 4px', borderRadius: 3 }}>Added</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, textAlign: 'center' }}>
                  <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#D1FAE5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11 }}>🛡️</div>
                  <span style={{ fontSize: 9, fontWeight: 800, color: '#007A5E' }}>Verification Added</span>
                  <span style={{ fontSize: 7, color: '#6B7280', fontWeight: 550, lineHeight: 1.2 }}>
                    A trusted human-authenticated signature is securely attached.
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3, borderTop: '1px solid #F1F5F9', paddingTop: 6, fontSize: 7 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#9CA3AF', fontWeight: 600 }}>Signature ID</span>
                    <span style={{ color: '#1F2937', fontWeight: 800 }}>ATT-847291</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#9CA3AF', fontWeight: 600 }}>Timestamp</span>
                    <span style={{ color: '#1F2937', fontWeight: 700 }}>May 15, 2025</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#9CA3AF', fontWeight: 600 }}>Trust Score</span>
                    <span style={{ color: '#007A5E', fontWeight: 900 }}>100%</span>
                  </div>
                </div>
              </div>

              {/* Below Mockup */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center', textAlign: 'center' }}>
                <div style={{
                  width: 30,
                  height: 30,
                  borderRadius: '50%',
                  background: '#D1FAE5',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 12
                }}>💚</div>
                <h4 style={{ fontSize: 13, fontWeight: 800, color: '#1F2937', margin: 0 }}>Verification Added</h4>
                <p style={{ fontSize: 11, color: '#6B7280', lineHeight: 1.4, margin: 0, fontWeight: 550 }}>
                  A tamper-proof signature is attached without changing your workflow.
                </p>
              </div>
            </div>

            {/* STEP 5: Recipient Sees the Trust Badge */}
            <div style={{
              background: 'linear-gradient(180deg, #F0FDF4 0%, #E6FDF0 100%)',
              border: '1px solid #DCFCE7',
              borderRadius: 24,
              padding: '36px 16px 24px 16px',
              display: 'flex',
              flexDirection: 'column',
              gap: 20,
              position: 'relative',
              boxShadow: '0 8px 30px rgba(5, 150, 105, 0.03)'
            }}>
              {/* Floating Step Number */}
              <div style={{
                position: 'absolute',
                top: -16,
                left: '50%',
                transform: 'translateX(-50%)',
                background: '#ffffff',
                border: '1px solid #A7F3D0',
                color: '#007A5E',
                width: 32,
                height: 32,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 12,
                fontWeight: 900,
                boxShadow: '0 4px 10px rgba(5, 150, 105, 0.08)'
              }}>05</div>

              {/* Inside Mockup: Gmail email view + Trust Badge popover overlay */}
              <div style={{
                background: '#ffffff',
                border: '1px solid #F1F5F9',
                borderRadius: 16,
                padding: 10,
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.01)',
                height: 230,
                justifyContent: 'space-between',
                position: 'relative',
                overflow: 'hidden'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #F1F5F9', paddingBottom: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 8, fontWeight: 700, color: '#1F2937' }}>
                    <span style={{ color: '#EA4335', fontWeight: 900 }}>M</span>
                    <span>Gmail</span>
                  </div>
                  <div style={{ display: 'flex', gap: 3, color: '#9CA3AF', fontSize: 7.5 }}>
                    <span>📥</span>
                    <span>🗑️</span>
                    <span>⋮</span>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2, fontSize: 7 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                    <span style={{ fontWeight: 800, fontSize: 8.5 }}>Project Update</span>
                    <span style={{ background: '#E2E8F0', padding: '1px 3px', borderRadius: 2, fontSize: 6 }}>Inbox x</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 7 }}>👤</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 6.5 }}>
                        <span style={{ fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>John Smith</span>
                        <span style={{ color: '#9CA3AF' }}>10:44 AM</span>
                      </div>
                    </div>
                  </div>
                </div>
                <div style={{ fontSize: 7, color: '#4B5563', lineHeight: 1.2, fontWeight: 500, flex: 1, marginTop: 2 }}>
                  Hi Sarah,<br />
                  The final design files are attached.
                </div>

                {/* Overlaid Floating Trust Badge */}
                <div style={{
                  position: 'absolute',
                  bottom: 4,
                  right: 4,
                  background: '#ffffff',
                  border: '1px solid #DCFCE7',
                  borderRadius: 10,
                  padding: '6px 8px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 3,
                  boxShadow: '0 4px 15px rgba(0, 0, 0, 0.08)',
                  width: '82%',
                  zIndex: 10
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                    <span style={{ fontSize: 9 }}>🛡️</span>
                    <span style={{ fontSize: 7.5, fontWeight: 800, color: '#007A5E' }}>Attest Verified</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                    <span style={{ fontSize: 7, fontWeight: 800, color: '#1F2937' }}>Human Verified</span>
                    <span style={{ fontSize: 5.5, color: '#6B7280', fontWeight: 550 }}>Sent by a real person.</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 6.5, fontWeight: 800, borderTop: '1px solid #F1F5F9', paddingTop: 3 }}>
                    <span style={{ color: '#4B5563' }}>Score</span>
                    <span style={{ color: '#007A5E' }}>100%</span>
                  </div>
                </div>
              </div>

              {/* Below Mockup */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center', textAlign: 'center' }}>
                <div style={{
                  width: 30,
                  height: 30,
                  borderRadius: '50%',
                  background: '#D1FAE5',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 12
                }}>💚</div>
                <h4 style={{ fontSize: 13, fontWeight: 800, color: '#1F2937', margin: 0 }}>Recipient Sees the Trust Badge</h4>
                <p style={{ fontSize: 11, color: '#6B7280', lineHeight: 1.4, margin: 0, fontWeight: 550 }}>
                  Recipients instantly recognize verified human communication with 100% trust.
                </p>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── HIGH-TRUST INDUSTRIES GRID (Fully Open!) ── */}
      <section style={{ padding: '96px 24px', background: '#FDFDFD', borderBottom: '1px solid #E2E8F0' }}>
        <div className="container-custom">

          {/* Top Pill Badge */}
          <div className="animate-on-scroll" style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
            <div style={{ background: '#E6FDF0', border: '1px solid #DCFCE7', color: '#007A5E', display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 16px', borderRadius: 9999, fontSize: 12, fontWeight: 700, letterSpacing: '0.03em', textTransform: 'uppercase' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
              HIGH-TRUST FIELDS
            </div>
          </div>

          <div className="animate-on-scroll" style={{ textAlign: 'center', marginBottom: 56 }}>
            <h3 style={{ fontSize: 'clamp(32px, 4.2vw, 48px)', fontWeight: 950, color: '#0F172A', letterSpacing: '-0.03em', lineHeight: 1.15, marginBottom: 20 }}>
              Built for Industries Where <br />
              <span style={{ color: '#007A5E' }}>Human Trust</span> Still Matters in the Age of AI
            </h3>

            <p style={{ fontSize: 16, color: '#64748B', lineHeight: 1.6, fontWeight: 500, margin: '0 auto', maxWidth: 800 }}>
              When emails involve money, access, legal decisions, or sensitive information,<br />
              Attest helps ensure real human involvement before sending.
            </p>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: 24,
            marginTop: 48
          }}>
            {[
              {
                title: 'Finance & Banking',
                desc: 'Add confidence to payment approvals, invoices, and transactions by verifying real human participation.',
                icon: (
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#007A5E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="3" y1="21" x2="21" y2="21" />
                    <line x1="3" y1="18" x2="21" y2="18" />
                    <path d="M4 18v-8M8 18v-8M12 18v-8M16 18v-8M20 18v-8" />
                    <path d="M12 2L2 7h20L12 2z" />
                  </svg>
                )
              },
              {
                title: 'Healthcare',
                desc: 'Increase trust in patient, insurance, and operational communications involving sensitive information and decisions.',
                icon: (
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#007A5E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20.44 4.94a6 6 0 0 0-8.48 0L12 5.06l-.04.04a6 6 0 0 0-8.48 8.48l8.48 8.48 8.48-8.48a6 6 0 0 0 0-8.48v0z" />
                    <path d="M7 12h2l1.5-3 1.5 5 1.5-4 1.5 2h2" />
                  </svg>
                )
              },
              {
                title: 'Legal & Compliance',
                desc: 'Strengthen accountability for legal notices, approvals, and other important communications with verified human involvement.',
                icon: (
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#007A5E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 3v17M19 8.5L16 14h6l-3-5.5zM5 8.5L2 14h6L5-5.5zM8 21h8M12 5l-7 3.5M12 5l7 3.5" />
                  </svg>
                )
              },
              {
                title: 'Enterprise Security',
                desc: 'Reduce risks from spoofed, impersonated, or AI-generated communication by proving a real human sent it.',
                icon: (
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#007A5E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    <path d="M9 11l2 2 4-4" />
                  </svg>
                )
              },
              {
                title: 'Executive Communication',
                desc: 'Verify leadership announcements, executive directives, and other high-impact communications with human proof.',
                icon: (
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#007A5E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                )
              },
              {
                title: 'High Trust Workflows',
                desc: 'Ensure critical decisions and approvals involve verified human participation within AI-assisted and digital workflows.',
                icon: (
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#007A5E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="5" r="3" />
                    <circle cx="6" cy="19" r="3" />
                    <circle cx="18" cy="19" r="3" />
                    <path d="M12 8v8M6 16v-3a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v3" />
                  </svg>
                )
              }
            ].map((item) => (
              <div key={item.title} style={{
                background: '#ffffff',
                border: '1px solid #F1F5F9',
                borderRadius: 24,
                padding: '32px 24px',
                display: 'flex',
                gap: 20,
                alignItems: 'flex-start',
                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.02)',
                position: 'relative'
              }}>
                {/* Left Icon Container */}
                <div style={{
                  width: 56,
                  height: 56,
                  borderRadius: '50%',
                  background: '#E6FDF0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  {item.icon}
                </div>
                {/* Right Content */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <h4 style={{ fontSize: 18, fontWeight: 800, color: '#0F172A', margin: 0 }}>
                    {item.title}
                  </h4>
                  <p style={{ fontSize: 14, color: '#4B5563', lineHeight: 1.5, margin: 0, fontWeight: 550 }}>
                    {item.desc}
                  </p>
                  {/* Small Pill Badge */}
                  <div style={{
                    alignSelf: 'flex-start',
                    background: '#E6FDF0',
                    color: '#007A5E',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    padding: '4px 10px',
                    borderRadius: 9999,
                    fontSize: 12,
                    fontWeight: 700,
                    marginTop: 4
                  }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    High Trust
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── THE THREAT & SAFEGUARD SPLIT MATRIX (REDESIGNED TO FLOWCHART) ── */}
      <section style={{ padding: '96px 24px', background: '#FFFFFF', borderBottom: '1px solid #E2E8F0' }}>
        <style dangerouslySetInnerHTML={{
          __html: `
          .flowchart-grid {
            display: grid;
            grid-template-columns: 1fr;
            gap: 24px;
            margin-bottom: 32px;
          }
          .flowchart-headers {
            display: none;
          }
          @media (min-width: 768px) {
            .flowchart-grid {
              grid-template-columns: 1.1fr 40px 1.3fr 1.2fr 1.4fr;
              align-items: center;
              gap: 16px;
            }
            .flowchart-headers {
              display: grid !important;
            }
            .gmail-span-2 {
              grid-column: span 2;
            }
          }
          .gmail-mock-card {
            background: #FFFFFF;
            border: 1.5px solid #E2E8F0;
            border-radius: 16px;
            padding: 16px;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.015);
            min-height: 180px;
            display: flex;
            flex-direction: column;
            gap: 8px;
          }
          .problem-card {
            background: #FFFFFF;
            border: 1.5px solid #FEE2E2;
            border-radius: 16px;
            padding: 20px;
            display: flex;
            gap: 16px;
            align-items: flex-start;
            box-shadow: 0 4px 15px rgba(239, 68, 68, 0.01);
            min-height: 180px;
          }
          .solution-card {
            background: #FFFFFF;
            border: 1.5px solid #DCFCE7;
            border-radius: 16px;
            padding: 20px;
            display: flex;
            gap: 16px;
            align-items: flex-start;
            box-shadow: 0 4px 15px rgba(22, 163, 74, 0.01);
            min-height: 180px;
          }
          .flowchart-arrow {
            display: none;
          }
          @media (min-width: 768px) {
            .flowchart-arrow {
              display: flex;
              align-items: center;
              justify-content: center;
            }
          }
          .features-footer-grid {
            display: grid;
            grid-template-columns: 1fr;
            gap: 24px;
            background: #FFFFFF;
            border: 1px solid #E2E8F0;
            border-radius: 20px;
            padding: 24px;
            margin-top: 64px;
          }
          @media (min-width: 768px) {
            .features-footer-grid {
              grid-template-columns: repeat(2, 1fr);
            }
          }
          @media (min-width: 1024px) {
            .features-footer-grid {
              grid-template-columns: repeat(4, 1fr);
            }
          }
          .features-footer-item {
            display: flex;
            align-items: center;
            gap: 16px;
            padding: 12px;
          }
          @media (min-width: 1024px) {
            .features-footer-item:not(:last-child) {
              border-right: 1px solid #E2E8F0;
            }
          }
        `}} />

        <div className="container-custom">

          {/* Header Title */}
          <div className="animate-on-scroll" style={{ textAlign: 'center', marginBottom: 64 }}>
            <h2 style={{ fontSize: 'clamp(32px, 4.2vw, 48px)', fontWeight: 950, color: '#0F172A', letterSpacing: '-0.03em', lineHeight: 1.15, marginBottom: 16 }}>
              Digital communication is <span style={{ color: '#007A5E' }}>losing trust.</span>
            </h2>
            <p style={{ fontSize: 16, color: '#64748B', lineHeight: 1.6, fontWeight: 550, margin: '0 auto', maxWidth: 800 }}>
              Attest brings back trust with human verification at every step.
            </p>
          </div>

          {/* Desktop Headers (Fixed class name to flowchart-headers) */}
          <div className="flowchart-headers" style={{
            gridTemplateColumns: '1.1fr 40px 1.3fr 1.2fr 1.4fr',
            gap: '16px',
            marginBottom: '24px',
            textAlign: 'center'
          }}>
            <div style={{ gridColumn: 'span 3', display: 'flex', justifyContent: 'center' }}>
              <span style={{ border: '1.5px solid #FCA5A5', color: '#DC2626', background: '#FFFFFF', borderRadius: 9999, padding: '4px 16px', fontSize: 11, fontWeight: 800, letterSpacing: '0.05em' }}>
                THE PROBLEM
              </span>
            </div>
            <div style={{ gridColumn: 'span 2', display: 'flex', justifyContent: 'center' }}>
              <span style={{ border: '1.5px solid #86EFAC', color: '#007A5E', background: '#FFFFFF', borderRadius: 9999, padding: '4px 16px', fontSize: 11, fontWeight: 800, letterSpacing: '0.05em' }}>
                THE SOLUTION WITH ATTEST
              </span>
            </div>
          </div>

          {/* Grid rows */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* ROW 1: 5 Columns (Problem, Arrow, Unverified Gmail, Solution, Verified Gmail) */}
            <div className="flowchart-grid">

              {/* Problem 1 */}
              <div className="problem-card card-hover-lift animate-on-scroll">
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                  <div style={{ background: '#EF4444', color: '#FFFFFF', borderRadius: '50%', width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 900 }}>1</div>
                  <div style={{ background: '#FEF2F2', borderRadius: '50%', width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2.5">
                      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                      <polyline points="22,6 12,13 2,6" />
                    </svg>
                  </div>
                </div>
                <div>
                  <h4 style={{ fontSize: 16, fontWeight: 800, color: '#1E293B', margin: '0 0 6px 0' }}>AI-generated emails</h4>
                  <p style={{ fontSize: 13, color: '#64748B', lineHeight: 1.5, margin: 0, fontWeight: 550 }}>AI-generated emails flood inboxes with convincing but fake content.</p>
                </div>
              </div>

              {/* Arrow */}
              <div className="flowchart-arrow">
                <div style={{ width: 32, height: 32, borderRadius: '50%', border: '1px solid #E2E8F0', background: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, color: '#94A3B8', fontWeight: 'bold' }}>
                  →
                </div>
              </div>

              {/* Gmail Mockup 1 (Unverified) */}
              <div className="gmail-mock-card card-hover-lift animate-on-scroll">
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
                    <path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2z" fill="#EA4335" />
                    <path d="M22 6l-10 6L2 6v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6z" fill="#F1F5F9" />
                    <path d="M2 6v12h4V8l6 4 6-4v10h4V6l-10 7L2 6z" fill="#4285F4" />
                  </svg>
                  <span style={{ fontSize: 9, fontWeight: 700, color: '#475569' }}>Gmail</span>
                  <span style={{ fontSize: 9.5, fontWeight: 800, color: '#1E293B', marginLeft: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Urgent: Invoice Approval Needed</span>
                  <span style={{ background: '#E2E8F0', color: '#475569', fontSize: 6.5, padding: '1px 3px', borderRadius: 2, fontWeight: 700, marginLeft: 'auto', whiteSpace: 'nowrap' }}>Inbox x</span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', margin: '2px 0' }}>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: 8, flexShrink: 0 }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="2.5">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                      <circle cx="12" cy="7" r="4" />
                    </svg>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 }}>
                    <span style={{ fontSize: 9, fontWeight: 800, color: '#1E293B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>billing@invoice-service.co</span>
                    <span style={{ fontSize: 7.5, color: '#94A3B8' }}>to me ▾</span>
                  </div>
                  <span style={{ fontSize: 8, color: '#94A3B8', marginLeft: 'auto', flexShrink: 0 }}>10:43 AM</span>
                </div>

                <div style={{ fontSize: 9.5, color: '#475569', lineHeight: 1.45, marginTop: 4 }}>
                  Hi,<br />
                  Please approve the attached invoice for $9,850. This is urgent and needs to be processed today.
                </div>
              </div>

              {/* Solution Concept 1 */}
              <div className="solution-card card-hover-lift animate-on-scroll">
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                  <div style={{ background: '#007A5E', color: '#FFFFFF', borderRadius: '50%', width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 900 }}>1</div>
                  <div style={{ background: '#E6FDF0', borderRadius: '50%', width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#007A5E" strokeWidth="2.5">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                      <circle cx="12" cy="7" r="4" />
                    </svg>
                  </div>
                </div>
                <div>
                  <h4 style={{ fontSize: 16, fontWeight: 800, color: '#1E293B', margin: '0 0 6px 0' }}>Human activity verification</h4>
                  <p style={{ fontSize: 13, color: '#64748B', lineHeight: 1.5, margin: 0, fontWeight: 550 }}>Attest verifies real human activity before the email is sent.</p>
                </div>
              </div>

              {/* Gmail Mockup 1 (Verified) */}
              <div className="gmail-mock-card card-hover-lift animate-on-scroll">
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
                    <path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2z" fill="#EA4335" />
                    <path d="M22 6l-10 6L2 6v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6z" fill="#F1F5F9" />
                    <path d="M2 6v12h4V8l6 4 6-4v10h4V6l-10 7L2 6z" fill="#4285F4" />
                  </svg>
                  <span style={{ fontSize: 9, fontWeight: 700, color: '#475569' }}>Gmail</span>
                  <span style={{ fontSize: 9.5, fontWeight: 800, color: '#1E293B', marginLeft: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Urgent: Invoice Approval Needed</span>
                  <span style={{ background: '#E2E8F0', color: '#475569', fontSize: 6.5, padding: '1px 3px', borderRadius: 2, fontWeight: 700, marginLeft: 'auto', whiteSpace: 'nowrap' }}>Inbox x</span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', margin: '2px 0' }}>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: 8, flexShrink: 0 }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="2.5">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                      <circle cx="12" cy="7" r="4" />
                    </svg>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 }}>
                    <span style={{ fontSize: 9, fontWeight: 800, color: '#1E293B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>billing@invoice-service.co</span>
                    <span style={{ fontSize: 7.5, color: '#94A3B8' }}>to me ▾</span>
                  </div>
                  <span style={{ fontSize: 8, color: '#94A3B8', marginLeft: 'auto', flexShrink: 0 }}>10:43 AM</span>
                </div>

                <div style={{ fontSize: 9.5, color: '#475569', lineHeight: 1.45, marginTop: 4 }}>
                  Hi,<br />
                  Please approve the attached invoice for $9,850. This is urgent and needs to be processed today.
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 'auto' }}>
                  <div style={{
                    background: '#F0FDF4',
                    border: '1px solid #BBF7D0',
                    color: '#16A34A',
                    fontSize: 8.5,
                    fontWeight: 800,
                    borderRadius: 6,
                    padding: '3px 8px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4
                  }}>
                    <span>✓ Human Verified</span>
                  </div>
                </div>
              </div>

            </div>

            {/* ROW 2: 4 Columns (Problem, Arrow, Solution, Verified Gmail spanning 2 columns) */}
            <div className="flowchart-grid">

              {/* Problem 2 */}
              <div className="problem-card card-hover-lift animate-on-scroll">
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                  <div style={{ background: '#EF4444', color: '#FFFFFF', borderRadius: '50%', width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 900 }}>2</div>
                  <div style={{ background: '#FEF2F2', borderRadius: '50%', width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2.5">
                      <path d="M12 2a5 5 0 0 0-5 5v3a5 5 0 0 0 10 0V7a5 5 0 0 0-5-5z" />
                      <path d="M17 14h-1a6 6 0 0 0-8 0H7a3 3 0 0 0-3 3v2h16v-2a3 3 0 0 0-3-3z" />
                    </svg>
                  </div>
                </div>
                <div>
                  <h4 style={{ fontSize: 16, fontWeight: 800, color: '#1E293B', margin: '0 0 6px 0' }}>Impersonation & spoofed senders</h4>
                  <p style={{ fontSize: 13, color: '#64748B', lineHeight: 1.5, margin: 0, fontWeight: 550 }}>Attackers impersonate trusted senders to steal money or sensitive data.</p>
                </div>
              </div>

              {/* Arrow */}
              <div className="flowchart-arrow">
                <div style={{ width: 32, height: 32, borderRadius: '50%', border: '1px solid #E2E8F0', background: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, color: '#94A3B8', fontWeight: 'bold' }}>
                  →
                </div>
              </div>

              {/* Solution Concept 2 */}
              <div className="solution-card card-hover-lift animate-on-scroll">
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                  <div style={{ background: '#007A5E', color: '#FFFFFF', borderRadius: '50%', width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 900 }}>2</div>
                  <div style={{ background: '#E6FDF0', borderRadius: '50%', width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#007A5E" strokeWidth="2.5">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                      <circle cx="12" cy="7" r="4" />
                    </svg>
                  </div>
                </div>
                <div>
                  <h4 style={{ fontSize: 16, fontWeight: 800, color: '#1E293B', margin: '0 0 6px 0' }}>Human-attested signature layer</h4>
                  <p style={{ fontSize: 13, color: '#64748B', lineHeight: 1.5, margin: 0, fontWeight: 550 }}>Every email includes a tamper-proof signature from a verified human.</p>
                </div>
              </div>

              {/* Gmail Mockup 2 */}
              <div className="gmail-mock-card gmail-span-2 card-hover-lift animate-on-scroll">
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
                    <path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2z" fill="#EA4335" />
                    <path d="M22 6l-10 6L2 6v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6z" fill="#F1F5F9" />
                    <path d="M2 6v12h4V8l6 4 6-4v10h4V6l-10 7L2 6z" fill="#4285F4" />
                  </svg>
                  <span style={{ fontSize: 9, fontWeight: 700, color: '#475569' }}>Gmail</span>
                  <span style={{ fontSize: 9.5, fontWeight: 800, color: '#1E293B', marginLeft: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Action Required: Update Payment Details</span>
                  <span style={{ background: '#E2E8F0', color: '#475569', fontSize: 6.5, padding: '1px 3px', borderRadius: 2, fontWeight: 700, marginLeft: 'auto', whiteSpace: 'nowrap' }}>Inbox x</span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', margin: '2px 0' }}>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: 8, flexShrink: 0 }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="2.5">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                      <circle cx="12" cy="7" r="4" />
                    </svg>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 }}>
                    <span style={{ fontSize: 9, fontWeight: 800, color: '#1E293B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>ceo@company.co</span>
                    <span style={{ fontSize: 7.5, color: '#94A3B8' }}>to Finance Team ▾</span>
                  </div>
                  <span style={{ fontSize: 8, color: '#94A3B8', marginLeft: 'auto', flexShrink: 0 }}>9:18 AM</span>
                </div>

                <div style={{ fontSize: 9.5, color: '#475569', lineHeight: 1.45, marginTop: 4 }}>
                  Hi Team,<br />
                  Please transfer $25,000 to the new vendor account immediately and confirm once done.<br />
                  Thanks,<br />
                  CEO
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 'auto' }}>
                  <div style={{
                    background: '#F0FDF4',
                    border: '1px solid #BBF7D0',
                    color: '#16A34A',
                    fontSize: 8.5,
                    fontWeight: 800,
                    borderRadius: 6,
                    padding: '3px 8px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4
                  }}>
                    <span>✓ Attest Signature Attached</span>
                  </div>
                </div>
              </div>

            </div>

            {/* ROW 3: 4 Columns (Problem, Arrow, Solution, Verified Gmail spanning 2 columns) */}
            <div className="flowchart-grid">

              {/* Problem 3 */}
              <div className="problem-card card-hover-lift animate-on-scroll">
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                  <div style={{ background: '#EF4444', color: '#FFFFFF', borderRadius: '50%', width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 900 }}>3</div>
                  <div style={{ background: '#FEF2F2', borderRadius: '50%', width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2.5">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="2" y1="12" x2="22" y2="12" />
                      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                    </svg>
                  </div>
                </div>
                <div>
                  <h4 style={{ fontSize: 16, fontWeight: 800, color: '#1E293B', margin: '0 0 6px 0' }}>Authentication verifies domains, not humans</h4>
                  <p style={{ fontSize: 13, color: '#64748B', lineHeight: 1.5, margin: 0, fontWeight: 550 }}>SPF, DKIM, and DMARC protect domains — not against human impersonators.</p>
                </div>
              </div>

              {/* Arrow */}
              <div className="flowchart-arrow">
                <div style={{ width: 32, height: 32, borderRadius: '50%', border: '1px solid #E2E8F0', background: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, color: '#94A3B8', fontWeight: 'bold' }}>
                  →
                </div>
              </div>

              {/* Solution Concept 3 */}
              <div className="solution-card card-hover-lift animate-on-scroll">
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                  <div style={{ background: '#007A5E', color: '#FFFFFF', borderRadius: '50%', width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 900 }}>3</div>
                  <div style={{ background: '#E6FDF0', borderRadius: '50%', width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#007A5E" strokeWidth="2.5">
                      <path d="M2 12a10 10 0 0 1 20 0" />
                      <path d="M5 12a7 7 0 0 1 14 0" />
                      <path d="M8 12a4 4 0 0 1 8 0" />
                      <path d="M11 12a1 1 0 0 1 2 0" />
                    </svg>
                  </div>
                </div>
                <div>
                  <h4 style={{ fontSize: 16, fontWeight: 800, color: '#1E293B', margin: '0 0 6px 0' }}>Verified intent proof layer</h4>
                  <p style={{ fontSize: 13, color: '#64748B', lineHeight: 1.5, margin: 0, fontWeight: 550 }}>Attest confirms the real human intent behind every email.</p>
                </div>
              </div>

              {/* Gmail Mockup 3 */}
              <div className="gmail-mock-card gmail-span-2 card-hover-lift animate-on-scroll">
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
                    <path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2z" fill="#EA4335" />
                    <path d="M22 6l-10 6L2 6v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6z" fill="#F1F5F9" />
                    <path d="M2 6v12h4V8l6 4 6-4v10h4V6l-10 7L2 6z" fill="#4285F4" />
                  </svg>
                  <span style={{ fontSize: 9, fontWeight: 700, color: '#475569' }}>Gmail</span>
                  <span style={{ fontSize: 9.5, fontWeight: 800, color: '#1E293B', marginLeft: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Quarterly Report</span>
                  <span style={{ background: '#E2E8F0', color: '#475569', fontSize: 6.5, padding: '1px 3px', borderRadius: 2, fontWeight: 700, marginLeft: 'auto', whiteSpace: 'nowrap' }}>Inbox x</span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', margin: '2px 0' }}>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: 8, flexShrink: 0 }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="2.5">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                      <circle cx="12" cy="7" r="4" />
                    </svg>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 }}>
                    <span style={{ fontSize: 9, fontWeight: 800, color: '#1E293B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>reports@company.com</span>
                    <span style={{ fontSize: 7.5, color: '#94A3B8' }}>to me ▾</span>
                  </div>
                  <span style={{ fontSize: 8, color: '#94A3B8', marginLeft: 'auto', flexShrink: 0 }}>8:32 AM</span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
                  <div style={{
                    background: '#F0FDF4',
                    border: '1px solid #BBF7D0',
                    color: '#16A34A',
                    fontSize: 8.5,
                    fontWeight: 800,
                    borderRadius: 6,
                    padding: '3px 8px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    alignSelf: 'flex-start'
                  }}>
                    <span>✓ Human Intent Verified</span>
                  </div>
                  <div style={{ fontSize: 9.5, color: '#475569', lineHeight: 1.45 }}>
                    Real human intent confirmed before sending.
                  </div>
                </div>
              </div>

            </div>

            {/* ROW 4: 4 Columns (Problem, Arrow, Solution, Verified Gmail spanning 2 columns) */}
            <div className="flowchart-grid">

              {/* Problem 4 */}
              <div className="problem-card card-hover-lift animate-on-scroll">
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                  <div style={{ background: '#EF4444', color: '#FFFFFF', borderRadius: '50%', width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 900 }}>4</div>
                  <div style={{ background: '#FEF2F2', borderRadius: '50%', width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2.5">
                      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                      <circle cx="9" cy="7" r="4" />
                      <line x1="19" y1="8" x2="19" y2="14" />
                      <line x1="19" y1="18" x2="19.01" y2="18" />
                    </svg>
                  </div>
                </div>
                <div>
                  <h4 style={{ fontSize: 16, fontWeight: 800, color: '#1E293B', margin: '0 0 6px 0' }}>Billing & payment invoice fraud</h4>
                  <p style={{ fontSize: 13, color: '#64748B', lineHeight: 1.5, margin: 0, fontWeight: 550 }}>Fake invoices and payment requests lead to financial losses every day.</p>
                </div>
              </div>

              {/* Arrow */}
              <div className="flowchart-arrow">
                <div style={{ width: 32, height: 32, borderRadius: '50%', border: '1px solid #E2E8F0', background: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, color: '#94A3B8', fontWeight: 'bold' }}>
                  →
                </div>
              </div>

              {/* Solution Concept 4 */}
              <div className="solution-card card-hover-lift animate-on-scroll">
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                  <div style={{ background: '#007A5E', color: '#FFFFFF', borderRadius: '50%', width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 900 }}>4</div>
                  <div style={{ background: '#E6FDF0', borderRadius: '50%', width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#007A5E" strokeWidth="2.5">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                  </div>
                </div>
                <div>
                  <h4 style={{ fontSize: 16, fontWeight: 800, color: '#1E293B', margin: '0 0 6px 0' }}>Verifiable approval trail</h4>
                  <p style={{ fontSize: 13, color: '#64748B', lineHeight: 1.5, margin: 0, fontWeight: 550 }}>Every approval, payment request, and attachment is human-verified.</p>
                </div>
              </div>

              {/* Gmail Mockup 4 */}
              <div className="gmail-mock-card gmail-span-2 card-hover-lift animate-on-scroll">
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
                    <path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2z" fill="#EA4335" />
                    <path d="M22 6l-10 6L2 6v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6z" fill="#F1F5F9" />
                    <path d="M2 6v12h4V8l6 4 6-4v10h4V6l-10 7L2 6z" fill="#4285F4" />
                  </svg>
                  <span style={{ fontSize: 9, fontWeight: 700, color: '#475569' }}>Gmail</span>
                  <span style={{ fontSize: 9.5, fontWeight: 800, color: '#1E293B', marginLeft: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Payment Overdue</span>
                  <span style={{ background: '#E2E8F0', color: '#475569', fontSize: 6.5, padding: '1px 3px', borderRadius: 2, fontWeight: 700, marginLeft: 'auto', whiteSpace: 'nowrap' }}>Inbox x</span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', margin: '2px 0' }}>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: 8, flexShrink: 0 }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="2.5">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                      <circle cx="12" cy="7" r="4" />
                    </svg>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 }}>
                    <span style={{ fontSize: 9, fontWeight: 800, color: '#1E293B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>billing@pay-services.net</span>
                    <span style={{ fontSize: 7.5, color: '#94A3B8' }}>to me ▾</span>
                  </div>
                  <span style={{ fontSize: 8, color: '#94A3B8', marginLeft: 'auto', flexShrink: 0 }}>Yesterday</span>
                </div>

                <div style={{ fontSize: 9.5, color: '#475569', lineHeight: 1.45, marginTop: 4 }}>
                  Your payment of $4,200 is overdue. Please make the payment using the link below.<br />
                  <span style={{ color: '#2563EB', fontWeight: 700, textDecoration: 'underline', cursor: 'pointer' }}>Pay Now</span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto' }}>
                  {/* PDF Attachment card */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    border: '1px solid #E2E8F0',
                    borderRadius: 4,
                    padding: '2px 6px',
                    background: '#F8FAFC',
                    width: 120
                  }}>
                    <span style={{ background: '#EF4444', color: '#FFFFFF', fontSize: 6.5, fontWeight: 900, borderRadius: 2, padding: '1px 2.5px' }}>PDF</span>
                    <span style={{ fontSize: 7.5, fontWeight: 700, color: '#1E293B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Invoice_4200.pdf</span>
                  </div>

                  {/* Verification Pill */}
                  <div style={{
                    background: '#F0FDF4',
                    border: '1px solid #BBF7D0',
                    color: '#16A34A',
                    fontSize: 8.5,
                    fontWeight: 800,
                    borderRadius: 6,
                    padding: '3px 8px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4
                  }}>
                    <span>✓ Human Verified</span>
                  </div>
                </div>
              </div>

            </div>

          </div>

          {/* BOTTOM GRID BAR: 4 Feature cards */}
          <div className="features-footer-grid stagger-children">
            <div className="features-footer-item animate-on-scroll">
              <div style={{
                width: 44,
                height: 44,
                borderRadius: '50%',
                background: '#F0FDF4',
                border: '1.5px solid #DCFCE7',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#007A5E" strokeWidth="2.5">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontSize: 14, fontWeight: 800, color: '#0F172A' }}>Zero-trust security</span>
                <span style={{ fontSize: 12, color: '#64748B', fontWeight: 550 }}>Tamper-proof assurance.</span>
              </div>
            </div>

            <div className="features-footer-item animate-on-scroll">
              <div style={{
                width: 44,
                height: 44,
                borderRadius: '50%',
                background: '#F0FDF4',
                border: '1.5px solid #DCFCE7',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#007A5E" strokeWidth="2.5">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontSize: 14, fontWeight: 800, color: '#0F172A' }}>Sub-second latency</span>
                <span style={{ fontSize: 12, color: '#64748B', fontWeight: 550 }}>Zero workflow disruption.</span>
              </div>
            </div>

            <div className="features-footer-item animate-on-scroll">
              <div style={{
                width: 44,
                height: 44,
                borderRadius: '50%',
                background: '#F0FDF4',
                border: '1.5px solid #DCFCE7',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#007A5E" strokeWidth="2.5">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontSize: 14, fontWeight: 800, color: '#0F172A' }}>Built for everyone</span>
                <span style={{ fontSize: 12, color: '#64748B', fontWeight: 550 }}>No complex onboarding.</span>
              </div>
            </div>

            <div className="features-footer-item animate-on-scroll">
              <div style={{
                width: 44,
                height: 44,
                borderRadius: '50%',
                background: '#F0FDF4',
                border: '1.5px solid #DCFCE7',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#007A5E" strokeWidth="2.5">
                  <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                  <line x1="8" y1="21" x2="16" y2="21" />
                  <line x1="12" y1="17" x2="12" y2="21" />
                </svg>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontSize: 14, fontWeight: 800, color: '#0F172A' }}>Enterprise ready</span>
                <span style={{ fontSize: 12, color: '#64748B', fontWeight: 550 }}>Works across workflows.</span>
              </div>
            </div>
          </div>

        </div>
      </section>
      {/* ── TRUST & SCENARIO WORKFLOWS (Fully Open!) ── */}
      <section style={{ padding: '96px 24px', background: '#ffffff', borderBottom: '1px solid #E2E8F0' }}>
        <div className="container-custom">
          <div className="animate-on-scroll" style={{ maxWidth: 640, marginBottom: 48 }}>
            <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.15em', color: '#007A5E', display: 'block', marginBottom: 12 }}>
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
            <div className="card-hover-lift animate-from-left premium-shadow" style={{ background: '#ffffff', padding: 36, borderRadius: 20, border: '1px solid #E2E8F0' }}>
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
                  <div key={idx} style={{ borderLeft: '3px solid #007A5E', paddingLeft: 16 }}>
                    <span style={{ fontWeight: 800, fontSize: 14, color: '#007A5E', display: 'block', marginBottom: 4 }}>{item.t}</span>
                    <span style={{ fontSize: 13, color: '#64748B', lineHeight: 1.5, fontWeight: 500, display: 'block' }}>{item.d}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Scenario 2 */}
            <div className="card-hover-lift animate-from-right premium-shadow" style={{ background: '#ffffff', padding: 36, borderRadius: 20, border: '1px solid #E2E8F0' }}>
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
                  <div key={idx} style={{ borderLeft: '3px solid #007A5E', paddingLeft: 16 }}>
                    <span style={{ fontWeight: 800, fontSize: 14, color: '#007A5E', display: 'block', marginBottom: 4 }}>{item.t}</span>
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
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#007A5E', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
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
            <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 20, padding: '36px 32px' }} className="premium-shadow card-hover-lift animate-from-right">
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

          {/* ── TRUST & COMPLIANCE LOGOS (Redesigned to infinite marquee slider) ── */}
          <div style={{ marginTop: 80, borderTop: '1px solid #E2E8F0', paddingTop: 48, textAlign: 'center' }}>
            <p style={{ fontSize: 13, fontWeight: 800, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 28 }}>
              VERIFIED TRUST &amp; COMPLIANCE STANDARDS
            </p>

            <style dangerouslySetInnerHTML={{
              __html: `
              @keyframes marquee-badges {
                0% { transform: translateX(0); }
                100% { transform: translateX(-50%); }
              }
              .marquee-badges-container {
                overflow: hidden;
                white-space: nowrap;
                position: relative;
                width: 100%;
                margin-top: 40px;
                padding: 10px 0;
                display: flex;
              }
              .marquee-badges-inner {
                display: flex;
                width: max-content;
                gap: 96px;
                animation: marquee-badges 20s linear infinite;
              }
              .marquee-badges-inner:hover {
                animation-play-state: paused;
              }
              .marquee-badge-item {
                flex-shrink: 0;
                display: flex;
                align-items: center;
                justify-content: center;
                opacity: 0.85;
                transition: opacity 0.2s, transform 0.2s;
              }
              .marquee-badge-item:hover {
                opacity: 1;
                transform: scale(1.05);
              }
            `}} />

            <div className="marquee-badges-container">
              <div className="marquee-badges-inner">
                {/* SET 1 */}
                <div className="marquee-badge-item">
                  <img src="/aes-256.png" alt="AES-256 Encrypted" style={{ height: 90, width: 'auto', objectFit: 'contain' }} />
                </div>
                <div className="marquee-badge-item">
                  <img src="/zero-data.png" alt="Zero Data Retention" style={{ height: 90, width: 'auto', objectFit: 'contain' }} />
                </div>
                <div className="marquee-badge-item">
                  <img src="/soc2.png" alt="SOC 2 Ready" style={{ height: 90, width: 'auto', objectFit: 'contain' }} />
                </div>
                <div className="marquee-badge-item">
                  <img src="/gdpr.png" alt="GDPR Compliant" style={{ height: 90, width: 'auto', objectFit: 'contain' }} />
                </div>

                {/* SET 2 (Duplicate for seamless wrapping) */}
                <div className="marquee-badge-item">
                  <img src="/aes-256.png" alt="AES-256 Encrypted" style={{ height: 90, width: 'auto', objectFit: 'contain' }} />
                </div>
                <div className="marquee-badge-item">
                  <img src="/zero-data.png" alt="Zero Data Retention" style={{ height: 90, width: 'auto', objectFit: 'contain' }} />
                </div>
                <div className="marquee-badge-item">
                  <img src="/soc2.png" alt="SOC 2 Ready" style={{ height: 90, width: 'auto', objectFit: 'contain' }} />
                </div>
                <div className="marquee-badge-item">
                  <img src="/gdpr.png" alt="GDPR Compliant" style={{ height: 90, width: 'auto', objectFit: 'contain' }} />
                </div>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* ── TESTIMONIALS & CASE STUDIES (Loved by SEO Professionals style) ── */}
      <section style={{ padding: '96px 24px', background: '#FFFFFF', borderBottom: '1px solid #E2E8F0' }}>
        <div className="container-custom">

          <div className="animate-on-scroll" style={{ textAlign: 'center', marginBottom: 64 }}>
            <span className="animate-on-scroll" style={{ fontSize: 13, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.15em', color: '#007A5E', display: 'block', marginBottom: 12 }}>
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
                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#E6FDF0', color: '#007A5E', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 12 }}>
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
              background: 'linear-gradient(135deg, #005A44 0%, #007A5E 100%)',
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
              <p style={{ fontSize: 16, color: '#E6FDF0', lineHeight: 1.6, marginBottom: 36, fontWeight: 500 }}>
                Deploy complete protection in under 15 seconds. Let Attest prove a real human sent every message.
              </p>

              <div style={{ display: 'inline-flex', flexWrap: 'wrap', gap: 16, justifyContent: 'center' }}>
                <a
                  href={EXTENSION_DOWNLOAD_URL}
                  style={{ background: '#ffffff', color: '#007A5E', padding: '16px 36px', borderRadius: 8, fontWeight: 800, textDecoration: 'none', transition: 'all 0.2s', fontSize: 15 }}
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
