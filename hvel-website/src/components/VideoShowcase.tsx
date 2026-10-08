'use client';

import { useState, useRef, useEffect } from 'react';
import { EXTENSION_DOWNLOAD_URL } from '@/lib/constants';

interface VideoShowcaseProps {
  id?: string;
}

export default function VideoShowcase({ id = 'demo-video' }: VideoShowcaseProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeNode, setActiveNode] = useState<number>(1);
  const [isManualHover, setIsManualHover] = useState<boolean>(false);

  // Auto cycle active security node for continuous dynamic animation
  useEffect(() => {
    if (isManualHover) return;
    const interval = setInterval(() => {
      setActiveNode((prev) => (prev % 4) + 1);
    }, 2800);
    return () => clearInterval(interval);
  }, [isManualHover]);

  const handlePlayToggle = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play();
      setIsPlaying(true);
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  };

  return (
    <section
      id={id}
      style={{
        padding: '44px 20px',
        background: 'linear-gradient(180deg, #F8FAF7 0%, #EFF6F2 50%, #F8FAF7 100%)',
        color: '#0F172A',
        position: 'relative',
        overflow: 'hidden',
        borderTop: '1px solid #E2E8F0',
        borderBottom: '1px solid #E2E8F0',
      }}
    >
      {/* Rich Keyframe Animations & Custom Styles */}
      <style dangerouslySetInnerHTML={{
        __html: `
        @keyframes floatNode1 {
          0%, 100% { transform: translateY(0px) scale(1); }
          50% { transform: translateY(-5px) scale(1.02); }
        }
        @keyframes floatNode2 {
          0%, 100% { transform: translateY(0px) scale(1); }
          50% { transform: translateY(-6px) scale(1.02); }
        }
        @keyframes pulseRing {
          0% { transform: scale(0.85); opacity: 0.8; }
          50% { transform: scale(1.25); opacity: 0.2; }
          100% { transform: scale(0.85); opacity: 0.8; }
        }
        @keyframes rotateOrbit {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes rotateRadar {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes laserDash {
          0% { stroke-dashoffset: 40; }
          100% { stroke-dashoffset: 0; }
        }
        @keyframes glowShield {
          0%, 100% { box-shadow: 0 15px 30px -8px rgba(0, 122, 94, 0.4), 0 0 0 8px rgba(255, 255, 255, 0.9); }
          50% { box-shadow: 0 20px 40px -5px rgba(0, 122, 94, 0.65), 0 0 0 10px rgba(16, 185, 129, 0.2); }
        }
        @keyframes playPulseRing {
          0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(0, 122, 94, 0.7), 0 0 30px rgba(0, 122, 94, 0.7); }
          70% { transform: scale(1.06); box-shadow: 0 0 0 14px rgba(0, 122, 94, 0), 0 0 40px rgba(0, 122, 94, 0.8); }
          100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(0, 122, 94, 0), 0 0 30px rgba(0, 122, 94, 0.7); }
        }
        .gradient-text-attest {
          background: linear-gradient(135deg, #007A5E 0%, #2563EB 50%, #7C3AED 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }
        .btn-gradient-cta {
          background: linear-gradient(135deg, #007A5E 0%, #3B82F6 50%, #8B5CF6 100%);
          color: white;
          transition: all 0.25s ease;
        }
        .btn-gradient-cta:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 20px -4px rgba(0, 122, 94, 0.4);
        }
        .pill-item {
          background: #FFFFFF;
          border: 1px solid #E2E8F0;
          color: #334155;
          transition: all 0.2s ease;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.02);
        }
        .pill-item:hover {
          border-color: #007A5E;
          color: #007A5E;
          transform: translateY(-1px);
        }
        .security-node {
          background: rgba(255, 255, 255, 0.95);
          border: 1.5px solid #E2E8F0;
          backdrop-filter: blur(12px);
          box-shadow: 0 6px 18px -4px rgba(0, 0, 0, 0.05);
          transition: all 0.35s cubic-bezier(0.4, 0, 0.2, 1);
          cursor: pointer;
        }
        .security-node.active-node {
          border-color: #3B82F6 !important;
          transform: scale(1.06) !important;
          box-shadow: 0 10px 25px -4px rgba(59, 130, 246, 0.25), 0 0 0 3px rgba(59, 130, 246, 0.1) !important;
        }
        .security-node:hover {
          transform: scale(1.04) !important;
          border-color: #3B82F6;
          box-shadow: 0 10px 20px -4px rgba(59, 130, 246, 0.18);
        }
      `}} />

      {/* Decorative Wave Graphics */}
      <div style={{ position: 'absolute', top: '5%', left: '2%', opacity: 0.35, pointerEvents: 'none' }}>
        <svg width="160" height="160" viewBox="0 0 200 200" fill="none">
          <circle cx="20" cy="20" r="3" fill="#007A5E" />
          <circle cx="50" cy="20" r="3" fill="#007A5E" />
          <circle cx="80" cy="20" r="3" fill="#007A5E" />
          <circle cx="20" cy="50" r="3" fill="#007A5E" />
          <circle cx="50" cy="50" r="3" fill="#007A5E" />
          <circle cx="80" cy="50" r="3" fill="#007A5E" />
        </svg>
      </div>

      <div style={{ maxWidth: 1140, margin: '0 auto', position: 'relative', zIndex: 2 }}>

        {/* Section Top Header */}
        <div style={{ textAlign: 'center', maxWidth: 800, margin: '0 auto 28px auto' }}>
          {/* Green Pill Badge */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              background: '#FFFFFF',
              border: '1px solid #D1FAE5',
              color: '#007A5E',
              padding: '4px 14px',
              borderRadius: 9999,
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              marginBottom: 10,
              boxShadow: '0 2px 8px rgba(0, 122, 94, 0.06)',
            }}
          >
            <span style={{ fontSize: 11, color: '#007A5E' }}>▶</span> PRODUCT DEMONSTRATIONS & WALKTHROUGHS
          </div>

          {/* Heading */}
          <h2
            style={{
              fontFamily: "'Lora', 'Playfair Display', Georgia, serif",
              fontSize: 'clamp(26px, 3.4vw, 40px)',
              fontWeight: 800,
              lineHeight: 1.18,
              letterSpacing: '-0.02em',
              color: '#0F172A',
              margin: '0 0 10px 0',
            }}
          >
            See <span className="gradient-text-attest" style={{ fontStyle: 'italic' }}>Attest</span> in Action
          </h2>

          {/* Subtitle */}
          <p style={{ fontSize: 14.5, color: '#475569', lineHeight: 1.55, fontWeight: 500, margin: 0 }}>
            Watch how Attest seamlessly integrates into your browser to intercept outbound messages, verify human presence using passive-knowledge checks and attach cryptographic proof of trust.
          </p>
        </div>

        {/* ── SIDE-BY-SIDE MAIN CONTAINER: 3D HOLOGRAPHIC SHIELD ANIMATION ON LEFT, VIDEO ON RIGHT ── */}
        <div className="responsive-video-showcase-grid">
          {/* ── LEFT COLUMN: SEAMLESS GLASSMORPHIC STAGE WITH WEBSITE LOGO & SECURITY NODES ── */}
          <div
            style={{
              background: 'linear-gradient(135deg, rgba(240, 253, 250, 0.7) 0%, rgba(248, 250, 252, 0.9) 50%, rgba(238, 242, 255, 0.7) 100%)',
              border: '1px solid #E2E8F0',
              borderRadius: 20,
              boxShadow: '0 12px 30px -10px rgba(0, 122, 94, 0.06)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              position: 'relative',
              padding: 16,
              minHeight: 300,
              overflow: 'hidden',
            }}
          >
            <div className="hologram-content-wrapper" style={{ width: 380, height: 280, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              {/* Dynamic SVG Energy Laser Lines connecting Shield to 4 Nodes */}
              <svg
                viewBox="0 0 380 280"
                style={{
                  position: 'absolute',
                  inset: 0,
                  width: '100%',
                  height: '100%',
                  pointerEvents: 'none',
                  zIndex: 2,
                }}
              >
                {/* Line 1: Center (190, 140) to Node 1 (Top-Left 80, 50) */}
                <path d="M 190 140 L 80 50" stroke={activeNode === 1 ? '#007A5E' : '#CBD5E1'} strokeWidth={activeNode === 1 ? '2.5' : '1'} fill="none" strokeDasharray="6 6" style={{ animation: 'laserDash 1.2s linear infinite' }} />

                {/* Line 2: Center (190, 140) to Node 2 (Top-Right 300, 50) */}
                <path d="M 190 140 L 300 50" stroke={activeNode === 2 ? '#6366F1' : '#CBD5E1'} strokeWidth={activeNode === 2 ? '2.5' : '1'} fill="none" strokeDasharray="6 6" style={{ animation: 'laserDash 1.2s linear infinite' }} />

                {/* Line 3: Center (190, 140) to Node 3 (Bottom-Left 80, 230) */}
                <path d="M 190 140 L 80 230" stroke={activeNode === 3 ? '#007A5E' : '#CBD5E1'} strokeWidth={activeNode === 3 ? '2.5' : '1'} fill="none" strokeDasharray="6 6" style={{ animation: 'laserDash 1.2s linear infinite' }} />

                {/* Line 4: Center (190, 140) to Node 4 (Bottom-Right 300, 230) */}
                <path d="M 190 140 L 300 230" stroke={activeNode === 4 ? '#8B5CF6' : '#CBD5E1'} strokeWidth={activeNode === 4 ? '2.5' : '1'} fill="none" strokeDasharray="6 6" style={{ animation: 'laserDash 1.2s linear infinite' }} />
              </svg>

              {/* Radial Glowing Background Pulse */}
              <div
                style={{
                  position: 'absolute',
                  width: 210,
                  height: 210,
                  borderRadius: '50%',
                  background: 'radial-gradient(circle, rgba(16, 185, 129, 0.25) 0%, rgba(16, 185, 129, 0) 70%)',
                  animation: 'pulseRing 4s infinite ease-in-out',
                  pointerEvents: 'none',
                }}
              />

              {/* Rotating Radar Sweeper Light Cone */}
              <div
                style={{
                  position: 'absolute',
                  width: 200,
                  height: 200,
                  borderRadius: '50%',
                  background: 'conic-gradient(from 0deg, rgba(16, 185, 129, 0.2) 0deg, transparent 60deg, transparent 360deg)',
                  animation: 'rotateRadar 8s linear infinite',
                  pointerEvents: 'none',
                  zIndex: 3,
                }}
              />

              {/* Orbiting Dotted Line Circle */}
              <div
                style={{
                  position: 'absolute',
                  width: 190,
                  height: 190,
                  borderRadius: '50%',
                  border: '1.5px dashed #CBD5E1',
                  animation: 'rotateOrbit 25s linear infinite',
                  pointerEvents: 'none',
                }}
              />

              {/* Central Glowing Shield with Official Attest Website Logo from favicon_io */}
              <div
                style={{
                  width: 76,
                  height: 76,
                  borderRadius: 20,
                  background: '#FFFFFF',
                  border: '1px solid #E2E8F0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 5,
                  position: 'relative',
                  cursor: 'pointer',
                  boxShadow: '0 10px 25px -4px rgba(0, 0, 0, 0.08), 0 0 20px rgba(37, 99, 235, 0.08)',
                  transition: 'all 0.3s ease',
                }}
                onClick={() => setActiveNode((prev) => (prev % 4) + 1)}
              >
                <img
                  src="/android-chrome-192x192.png"
                  alt="Attest Logo"
                  style={{
                    width: 52,
                    height: 52,
                    objectFit: 'contain',
                    borderRadius: 12,
                  }}
                />
              </div>

              {/* FLOATING NODE 1: TOP-LEFT (Human Presence Verified) */}
              <div
                className={`security-node ${activeNode === 1 ? 'active-node' : ''}`}
                onMouseEnter={() => { setActiveNode(1); setIsManualHover(true); }}
                onMouseLeave={() => setIsManualHover(false)}
                style={{
                  position: 'absolute',
                  top: '5%',
                  left: '3%',
                  borderRadius: 12,
                  padding: '6px 12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  animation: 'floatNode1 5s ease-in-out infinite',
                  zIndex: 6,
                }}
              >
                <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#E6F4EA', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#007A5E" strokeWidth="2.5">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', fontSize: 10 }}>
                  <span style={{ fontWeight: 600, color: '#475569' }}>Human Presence</span>
                  <span style={{ fontWeight: 900, color: '#007A5E' }}>Verified ✓</span>
                </div>
              </div>

              {/* FLOATING NODE 2: TOP-RIGHT (Message Secured) */}
              <div
                className={`security-node ${activeNode === 2 ? 'active-node' : ''}`}
                onMouseEnter={() => { setActiveNode(2); setIsManualHover(true); }}
                onMouseLeave={() => setIsManualHover(false)}
                style={{
                  position: 'absolute',
                  top: '6%',
                  right: '3%',
                  borderRadius: 12,
                  padding: '6px 12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  animation: 'floatNode2 6s ease-in-out infinite 0.5s',
                  zIndex: 6,
                }}
              >
                <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#EEF2FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#6366F1" strokeWidth="2.5">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                    <polyline points="22,6 12,13 2,6" />
                  </svg>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', fontSize: 10 }}>
                  <span style={{ fontWeight: 600, color: '#475569' }}>Message</span>
                  <span style={{ fontWeight: 900, color: '#6366F1' }}>Secured</span>
                </div>
              </div>

              {/* FLOATING NODE 3: BOTTOM-LEFT (Passive Verification) */}
              <div
                className={`security-node ${activeNode === 3 ? 'active-node' : ''}`}
                onMouseEnter={() => { setActiveNode(3); setIsManualHover(true); }}
                onMouseLeave={() => setIsManualHover(false)}
                style={{
                  position: 'absolute',
                  bottom: '6%',
                  left: '4%',
                  borderRadius: 12,
                  padding: '6px 12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  animation: 'floatNode2 5.5s ease-in-out infinite 1s',
                  zIndex: 6,
                }}
              >
                <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#F0FDF4', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#007A5E" strokeWidth="2.5">
                    <path d="M12 11c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
                    <path d="M12 2a10 10 0 0 0-10 10c0 5.5 4.5 10 10 10s10-4.5 10-10A10 10 0 0 0 12 2z" />
                  </svg>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', fontSize: 10 }}>
                  <span style={{ fontWeight: 600, color: '#475569' }}>Passive</span>
                  <span style={{ fontWeight: 900, color: '#007A5E' }}>Verification</span>
                </div>
              </div>

              {/* FLOATING NODE 4: BOTTOM-RIGHT (Crypto Proof Attached) */}
              <div
                className={`security-node ${activeNode === 4 ? 'active-node' : ''}`}
                onMouseEnter={() => { setActiveNode(4); setIsManualHover(true); }}
                onMouseLeave={() => setIsManualHover(false)}
                style={{
                  position: 'absolute',
                  bottom: '6%',
                  right: '4%',
                  borderRadius: 12,
                  padding: '6px 12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  animation: 'floatNode1 6.5s ease-in-out infinite 1.5s',
                  zIndex: 6,
                }}
              >
                <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#F3E8FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#8B5CF6" strokeWidth="2.5">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', fontSize: 10 }}>
                  <span style={{ fontWeight: 600, color: '#475569' }}>Crypto Proof</span>
                  <span style={{ fontWeight: 900, color: '#8B5CF6' }}>Attached</span>
                </div>
              </div>
            </div>
          </div>

          {/* ── RIGHT COLUMN: THE REAL VIDEO PLAYER ── */}
          <div
            style={{
              background: '#FFFFFF',
              border: '1px solid #E2E8F0',
              borderRadius: 20,
              boxShadow: '0 12px 30px -10px rgba(0, 0, 0, 0.05), 0 0 25px rgba(0, 122, 94, 0.05)',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {/* Light macOS Style Window Header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '9px 14px',
                background: '#F8FAFC',
                borderBottom: '1px solid #E2E8F0',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 9, height: 9, borderRadius: '50%', background: '#EF4444' }} />
                <div style={{ width: 9, height: 9, borderRadius: '50%', background: '#F59E0B' }} />
                <div style={{ width: 9, height: 9, borderRadius: '50%', background: '#10B981' }} />
              </div>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  fontSize: 11,
                  fontWeight: 700,
                  color: '#0F172A',
                  fontFamily: "'JetBrains Mono', monospace",
                }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#007A5E" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
                <span>Attest</span>
              </div>

              <div style={{ width: 36 }} />
            </div>

            {/* Video Canvas Container */}
            <div style={{ position: 'relative', width: '100%', flex: 1, background: '#0F172A', minHeight: 240, aspectRatio: '16/9' }}>
              <video
                ref={videoRef}
                src="/Attest_Webpage_Video.mp4"
                controls
                preload="metadata"
                playsInline
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                onEnded={() => setIsPlaying(false)}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  display: 'block',
                }}
              />

              {/* Play Overlay Button with Radiant Pulse Animation */}
              {!isPlaying && (
                <div
                  onClick={handlePlayToggle}
                  style={{
                    position: 'absolute',
                    inset: 0,
                    background: 'rgba(15, 23, 42, 0.35)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    backdropFilter: 'blur(2px)',
                    transition: 'all 0.25s ease',
                  }}
                >
                  <div
                    style={{
                      width: 60,
                      height: 60,
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, #007A5E 0%, #2563EB 100%)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 0 30px rgba(0, 122, 94, 0.7), 0 0 0 10px rgba(255, 255, 255, 0.2)',
                      animation: 'playPulseRing 2.5s infinite ease-in-out',
                      transition: 'transform 0.2s ease',
                    }}
                  >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="#FFFFFF" style={{ marginLeft: 3 }}>
                      <polygon points="5 3 19 12 5 21 5 3" />
                    </svg>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── BOTTOM PILL BUTTONS ── */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            marginBottom: 24,
          }}
        >
          <div className="pill-item" style={{ padding: '7px 14px', borderRadius: 9999, fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ color: '#007A5E' }}>⚡</span> Real-time Interception
          </div>
          <div className="pill-item" style={{ padding: '7px 14px', borderRadius: 9999, fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ color: '#2563EB' }}>🧠</span> Passive Knowledge Checks
          </div>
          <div className="pill-item" style={{ padding: '7px 14px', borderRadius: 9999, fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ color: '#007A5E' }}>🔒</span> Cryptographic Signature
          </div>
          <div className="pill-item" style={{ padding: '7px 14px', borderRadius: 9999, fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ color: '#7C3AED' }}>✉️</span> Zero-Data Messaging
          </div>
          <a
            href={EXTENSION_DOWNLOAD_URL}
            className="btn-gradient-cta"
            style={{
              padding: '7px 18px',
              borderRadius: 9999,
              fontSize: 12,
              fontWeight: 800,
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              boxShadow: '0 4px 12px rgba(0, 122, 94, 0.25)',
            }}
          >
            Try It Yourself →
          </a>
        </div>

        {/* ── BOTTOM STATS BAR ── */}
        <div
          style={{
            background: '#FFFFFF',
            border: '1px solid #E2E8F0',
            borderRadius: 16,
            padding: '16px 24px',
            boxShadow: '0 6px 20px -4px rgba(0, 0, 0, 0.03)',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: 16,
            alignItems: 'center',
          }}
        >
          {/* Stat 1 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: '#E6F4EA', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#007A5E" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                <polyline points="9 12 11 14 15 10" />
              </svg>
            </div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 900, color: '#0F172A', lineHeight: 1.1 }}>99.9%</div>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#64748B' }}>Threats Intercepted</div>
            </div>
          </div>

          {/* Stat 2 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: '#DBEAFE', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 900, color: '#0F172A', lineHeight: 1.1 }}>50K+</div>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#64748B' }}>Active Users</div>
            </div>
          </div>

          {/* Stat 3 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: '#F3E8FF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#7C3AED" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="2" y1="12" x2="22" y2="12" />
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
              </svg>
            </div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 900, color: '#0F172A', lineHeight: 1.1 }}>150+</div>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#64748B' }}>Countries Protected</div>
            </div>
          </div>

          {/* Stat 4 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: '#FEF3C7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
              </svg>
            </div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 900, color: '#0F172A', lineHeight: 1.1 }}>Real-time</div>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#64748B' }}>Protection</div>
            </div>
          </div>
        </div>

      </div>
    </section>
  );
}
