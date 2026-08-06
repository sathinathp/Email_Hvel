'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { EXTENSION_DOWNLOAD_URL } from '@/lib/constants';

export default function Navbar() {
  const pathname = usePathname();
  const [activeHash, setActiveHash] = useState('');

  useEffect(() => {
    // 1. Handle URL hash changes
    const handleHashChange = () => {
      setActiveHash(window.location.hash || '#protocol');
    };
    handleHashChange();
    window.addEventListener('hashchange', handleHashChange);

    // 2. Scroll-based highlighting using IntersectionObserver
    const sections = ['protocol', 'workflow', 'features'];
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          setActiveHash('#' + entry.target.id);
        }
      });
    }, { threshold: 0.5, rootMargin: '-72px 0px 0px 0px' });

    sections.forEach(id => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });

    return () => {
      window.removeEventListener('hashchange', handleHashChange);
      observer.disconnect();
    };
  }, [pathname]);

  const navLinks = [
    { href: '/#demo-video', label: 'Watch Demo' },
    { href: '/docs',       label: 'Docs' },
    { href: '/pricing',    label: 'Pricing' },
    { href: '/verify',     label: 'Verify Hash' },
    { href: '/contact',    label: 'Contact' },
  ];

  const isActive = (href: string) => {
    if (href.startsWith('/#')) {
      const targetHash = href.substring(1);
      return pathname === '/' && activeHash === targetHash;
    }
    return pathname === href || pathname.startsWith(href + '/');
  };

  const [isOpen, setIsOpen] = useState(false);

  // Close menu when route/hash changes
  useEffect(() => {
    setIsOpen(false);
  }, [pathname, activeHash]);

  // Prevent scroll when mobile menu is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  return (
    <>
      <nav className="nav-full">
        <div className="container-custom">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>

            {/* Logo */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 40 }}>
              <Link href="/" onClick={() => setActiveHash('#protocol')} style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
                <img 
                  src="/icon-symbol.png" 
                  alt="Attest Logo" 
                  style={{ width: 32, height: 32, objectFit: 'contain', flexShrink: 0 }} 
                />
                <span style={{ fontSize: 18, fontWeight: 900, letterSpacing: '-0.04em', color: '#0F172A' }}>
                  Attest
                </span>
              </Link>

              {/* Nav links (Desktop only) */}
              <div className="nav-links">
                {navLinks.map(({ href, label }) => (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => {
                      if (href.startsWith('/#')) setActiveHash(href.substring(1));
                    }}
                    style={{
                      fontSize: 14,
                      fontWeight: isActive(href) ? 700 : 600,
                      color: isActive(href) ? '#007A5E' : '#64748B',
                      textDecoration: 'none',
                      transition: 'color 0.15s',
                      position: 'relative',
                      paddingBottom: 2,
                      borderBottom: isActive(href) ? '2px solid #007A5E' : '2px solid transparent',
                    }}
                  >
                    {label}
                  </Link>
                ))}
              </div>
            </div>

            {/* Actions: CTA and Hamburger Toggle */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {/* CTA (Hidden on tiny screens, shown on sm+) */}
              <a
                href={EXTENSION_DOWNLOAD_URL}
                className="btn-blue nav-cta-desktop"
                style={{ padding: '10px 22px', fontSize: 14, flexShrink: 0 }}
              >
                Install Extension
              </a>

              {/* Hamburger Button */}
              <button 
                onClick={() => setIsOpen(!isOpen)}
                className="mobile-menu-btn"
                aria-label="Toggle Navigation Menu"
              >
                {isOpen ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0F172A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0F172A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="3" y1="12" x2="21" y2="12"></line>
                    <line x1="3" y1="6" x2="21" y2="6"></line>
                    <line x1="3" y1="18" x2="21" y2="18"></line>
                  </svg>
                )}
              </button>
            </div>

          </div>
        </div>
      </nav>

      {/* Mobile Menu Drawer */}
      <div className={`mobile-drawer ${isOpen ? 'open' : ''}`}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {navLinks.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              onClick={() => {
                if (href.startsWith('/#')) setActiveHash(href.substring(1));
                setIsOpen(false);
              }}
              style={{
                fontSize: 18,
                fontWeight: isActive(href) ? 800 : 600,
                color: isActive(href) ? '#007A5E' : '#0F172A',
                textDecoration: 'none',
                padding: '12px 0',
                borderBottom: '1px solid #F1F5F9',
                display: 'block',
                transition: 'color 0.15s'
              }}
            >
              {label}
            </Link>
          ))}
        </div>

        <div style={{ marginTop: 'auto', paddingTop: 24 }}>
          <a
            href={EXTENSION_DOWNLOAD_URL}
            className="btn-blue"
            style={{ width: '100%', padding: '14px 0', fontSize: 16, display: 'flex', justifyContent: 'center' }}
            onClick={() => setIsOpen(false)}
          >
            Install Extension
          </a>
        </div>
      </div>

      {/* Local Styles for Hamburger Menu and Drawer */}
      <style>{`
        .mobile-menu-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 40px;
          height: 40px;
          border-radius: 8px;
          border: 1px solid #E2E8F0;
          background: #ffffff;
          cursor: pointer;
          transition: all 0.2s;
          padding: 0;
          z-index: 1000;
        }
        .mobile-menu-btn:hover {
          background: #F8FAFC;
          border-color: #CBD5E1;
        }
        .nav-cta-desktop {
          display: none;
        }
        
        .mobile-drawer {
          position: fixed;
          top: var(--nav-h);
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(255, 255, 255, 0.98);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          z-index: 998;
          display: flex;
          flex-direction: column;
          padding: 40px 24px;
          border-top: 1px solid #F1F5F9;
          transform: translateY(-100%);
          opacity: 0;
          pointer-events: none;
          transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.25s ease;
        }
        .mobile-drawer.open {
          transform: translateY(0);
          opacity: 1;
          pointer-events: auto;
        }

        @media (min-width: 640px) {
          .nav-cta-desktop {
            display: inline-flex;
          }
        }
        @media (min-width: 1024px) {
          .mobile-menu-btn {
            display: none;
          }
          .mobile-drawer {
            display: none;
          }
        }
      `}</style>
    </>
  );
}
