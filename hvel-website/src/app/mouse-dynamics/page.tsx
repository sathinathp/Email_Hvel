'use client';

import { useState, useEffect, useRef } from 'react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import Link from 'next/link';

interface MousePoint {
  x: number;
  y: number;
  t: number;
}

export default function MouseDynamicsPage() {
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

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const trackingAreaRef = useRef<HTMLDivElement | null>(null);
  const animationRef = useRef<number | null>(null);
  const pointsRef = useRef<MousePoint[]>([]);

  // Handle canvas resizing dynamically using ResizeObserver to avoid initial 0x0 issues
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

  // Draw sandbox trails (no layout thrashing / resizing inside this render loop!)
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
    <main style={{ minHeight: '100vh', background: '#fff', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <Navbar />
      
      <section style={{ padding: '80px 24px 48px', background: '#ffffff', borderBottom: '2px solid #2563EB' }}>
        <div style={{ maxWidth: 800, margin: '0 auto' }}>
          <Link href="/docs" style={{ fontSize: 13, color: '#2563EB', fontWeight: 800, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 24 }}>
            ← Back to Docs
          </Link>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#ffffff', border: '2px solid #2563EB', borderRadius: 9999, padding: '4px 14px', fontSize: 12, fontWeight: 800, color: '#2563EB', marginBottom: 20 }}>
            ✍️ Mouse dynamics verification
          </div>
          <h1 style={{ fontSize: 'clamp(32px,5vw,52px)', fontWeight: 900, color: '#0F172A', letterSpacing: '-0.04em', lineHeight: 1.1, marginBottom: 16 }}>
            Kinetic Mouse Trajectory Analysis
          </h1>
          <p style={{ fontSize: 17, color: '#475569', lineHeight: 1.7, maxWidth: 640, fontWeight: 500 }}>
            Attest proves physical human presence during the email dispatch action by analyzing fine-grained mouse movements. By validating organic physical movement signature curves, automated malware bot sessions are blocked.
          </p>
        </div>
      </section>

      <section style={{ padding: '64px 24px', maxWidth: 1000, margin: '0 auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 48 }}>
          
          {/* Left side: Interactive Canvas */}
          <div>
            <h2 style={{ fontSize: 24, fontWeight: 800, color: '#0F172A', marginBottom: 12 }}>Live Telemetry Sandbox</h2>
            <p style={{ color: '#475569', fontSize: 14, lineHeight: 1.6, marginBottom: 20, fontWeight: 500 }}>
              Draw curves inside the canvas using your physical pointer. The analyzer will calculate real-time kinematics. Click the bot simulator to see a script's execution.
            </p>

            <div 
              ref={trackingAreaRef}
              onPointerMove={handlePointerMove}
              onPointerLeave={handlePointerLeave}
              style={{ 
                width: '100%', 
                height: 280, 
                background: '#ffffff', 
                backgroundImage: 'radial-gradient(rgba(37, 99, 235, 0.15) 1px, transparent 1px)',
                backgroundSize: '16px 16px',
                border: '2px solid #2563EB', 
                borderRadius: 16, 
                position: 'relative', 
                cursor: 'crosshair',
                overflow: 'hidden'
              }}
            >
              <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }} />
              {!isTracking && points.length === 0 && (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: '#0F172A' }}>✍️ Draw a path in this box</span>
                  <span style={{ fontSize: 11, color: '#475569', marginTop: 4, fontWeight: 600 }}>Or trigger a robotic bot path below</span>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
              <button 
                onClick={simulateBot}
                style={{ flex: 1, padding: '10px 16px', background: 'white', border: '2px solid #2563EB', color: '#2563EB', borderRadius: 8, fontSize: 12, fontWeight: 800, cursor: 'pointer' }}
              >
                🤖 Simulate Bot (Perfect Line)
              </button>
              <button 
                onClick={resetCanvas}
                style={{ padding: '10px 16px', background: '#2563EB', border: 'none', color: '#ffffff', borderRadius: 8, fontSize: 12, fontWeight: 800, cursor: 'pointer' }}
              >
                Reset
              </button>
            </div>
          </div>

          {/* Right side: Calculations */}
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <div style={{ background: '#ffffff', border: '2px solid #2563EB', borderRadius: 16, padding: 24 }}>
              <h3 style={{ fontSize: 14, fontWeight: 800, color: '#2563EB', marginBottom: 16, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Kinetic Calculations
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #2563EB', paddingBottom: 6 }}>
                  <span style={{ color: '#475569' }}>Coordinates:</span>
                  <span style={{ fontWeight: 700, color: '#0F172A' }}>{stats.coords}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #2563EB', paddingBottom: 6 }}>
                  <span style={{ color: '#475569' }}>Avg Velocity:</span>
                  <span style={{ fontWeight: 700, color: '#0F172A' }}>{stats.velocity}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #2563EB', paddingBottom: 6 }}>
                  <span style={{ color: '#475569' }}>Jitter StdDev:</span>
                  <span style={{ fontWeight: 700, color: '#0F172A' }}>{stats.speedStdDev}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #2563EB', paddingBottom: 6 }}>
                  <span style={{ color: '#475569' }}>Linear Deviation:</span>
                  <span style={{ fontWeight: 700, color: '#0F172A' }}>{stats.avgDeviation}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #2563EB', paddingBottom: 6 }}>
                  <span style={{ color: '#475569' }}>Steering Entropy:</span>
                  <span style={{ fontWeight: 700, color: '#0F172A' }}>{stats.steeringEntropy}</span>
                </div>
              </div>

              <div style={{ marginTop: 24 }}>
                <span style={{ fontSize: 9, fontWeight: 800, color: '#475569', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
                  Classification Result
                </span>
                <div style={{ 
                  background: '#ffffff', 
                  border: '2px solid #2563EB', 
                  borderRadius: 12, 
                  padding: 14, 
                  textAlign: 'center'
                }}>
                  <span style={{ 
                    fontSize: 12, 
                    fontWeight: 800, 
                    color: '#2563EB',
                  }}>
                    {stats.verdict}
                  </span>
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* Math explanation details */}
        <div style={{ marginTop: 64, borderTop: '2px solid #2563EB', paddingTop: 48 }}>
          <h2 style={{ fontSize: 24, fontWeight: 800, color: '#0F172A', marginBottom: 24 }}>Trajectory Analysis Metrics</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 24 }}>
            {[
              {
                title: 'Jitter & Acceleration (Velocity Variance)',
                desc: 'Humans naturally speed up and slow down dynamically while steering. Perfect or constant speeds indicate automated playback.'
              },
              {
                title: 'Linear Path Deviation',
                desc: 'Bots draw geometrically straight lines between coordinate targets. Human movement curves contain organic, hand-drawn fluctuations.'
              },
              {
                title: 'Steering Entropy (Direction Changes)',
                desc: 'Measures unexpected directional changes along the path. Higher micro-corrections prove biological presence.'
              }
            ].map(m => (
              <div key={m.title} style={{ padding: 20, background: '#ffffff', borderRadius: 12, border: '2px solid #2563EB' }}>
                <h3 style={{ fontSize: 15, fontWeight: 700, color: '#0F172A', marginBottom: 8 }}>{m.title}</h3>
                <p style={{ fontSize: 13, color: '#475569', lineHeight: 1.6, margin: 0, fontWeight: 500 }}>{m.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Setup steps */}
        <div style={{ marginTop: 48 }}>
          <h2 style={{ fontSize: 24, fontWeight: 800, color: '#0F172A', marginBottom: 24 }}>Verification Flow</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[
              ['1', 'Gmail Send Interception', 'Clicking Send on Gmail triggers the Chrome extension to pause the message dispatch immediately.'],
              ['2', 'Trace & Calibrate', 'A small calibration widget slides in. You perform a quick 1-second cursor trajectory gesture.'],
              ['3', 'Cryptographic Seal & Send', 'Once approved locally, a verification token hash is embedded in your email headers and released.']
            ].map(([num, title, desc]) => (
              <div key={num} style={{ display: 'flex', gap: 16, padding: '18px 20px', background: '#ffffff', borderRadius: 12, border: '2px solid #2563EB' }}>
                <div style={{ width: 36, height: 36, background: '#2563EB', color: 'white', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 14, flexShrink: 0 }}>{num}</div>
                <div>
                  <p style={{ fontWeight: 700, color: '#0F172A', fontSize: 15, marginBottom: 4 }}>{title}</p>
                  <p style={{ fontSize: 14, color: '#475569', margin: 0, lineHeight: 1.6, fontWeight: 500 }}>{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Privacy container */}
        <div style={{ background: '#ffffff', border: '2px solid #2563EB', borderRadius: 16, padding: 24, marginTop: 48 }}>
          <p style={{ fontWeight: 800, color: '#0F172A', fontSize: 14, marginBottom: 6 }}>🔒 Local Privacy Guarantee</p>
          <p style={{ fontSize: 14, color: '#475569', margin: 0, lineHeight: 1.6, fontWeight: 500 }}>
            Mouse coordinate recordings never leave your machine. Calculations are done entirely within the local Chrome extension sandbox. Only the final cryptographically hashed confirmation token is registered to the audit engine.
          </p>
        </div>

      </section>

      <Footer />
    </main>
  );
}
