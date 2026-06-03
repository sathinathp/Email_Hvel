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

  return (
    <nav className="nav-full">
      <div className="container-custom">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>

          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 40 }}>
            <Link href="/" onClick={() => setActiveHash('#protocol')} style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
              <img 
                src="/logo.png" 
                alt="Attest Logo" 
                style={{ width: 34, height: 34, objectFit: 'contain', flexShrink: 0 }} 
              />
              <span style={{ fontSize: 18, fontWeight: 900, letterSpacing: '-0.04em', color: '#0F172A' }}>
                Attest
              </span>
            </Link>

            {/* Nav links */}
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
                    color: isActive(href) ? '#2563EB' : '#64748B',
                    textDecoration: 'none',
                    transition: 'color 0.15s',
                    position: 'relative',
                    paddingBottom: 2,
                    borderBottom: isActive(href) ? '2px solid #2563EB' : '2px solid transparent',
                  }}
                >
                  {label}
                </Link>
              ))}
            </div>
          </div>

          {/* CTA */}
          <a
            href={EXTENSION_DOWNLOAD_URL}
            className="btn-blue"
            style={{ padding: '10px 22px', fontSize: 14, flexShrink: 0 }}
          >
            Install Extension
          </a>
        </div>
      </div>
    </nav>
  );
}
