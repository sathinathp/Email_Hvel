'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { EXTENSION_DOWNLOAD_URL } from '@/lib/constants';

export default function Navbar() {
  const pathname = usePathname();

  const navLinks = [
    { href: '/#protocol',  label: 'Protocol' },
    { href: '/#features',  label: 'Features' },
    { href: '/docs',       label: 'Docs' },
    { href: '/pricing',    label: 'Pricing' },
    { href: '/verify',     label: 'Verify Hash' },
    { href: '/contact',    label: 'Contact' },
  ];

  const isActive = (href: string) => {
    if (href.startsWith('/#')) return pathname === '/';
    return pathname === href || pathname.startsWith(href + '/');
  };

  return (
    <nav className="nav-full">
      <div className="container-custom">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>

          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 40 }}>
            <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
              <div style={{
                width: 34, height: 34, borderRadius: 10,
                background: 'linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'white', fontWeight: 900, fontSize: 15,
                boxShadow: '0 4px 12px rgba(37,99,235,0.35)', flexShrink: 0,
              }}>H</div>
              <span style={{ fontSize: 18, fontWeight: 900, letterSpacing: '-0.04em', color: '#0F172A' }}>
                HumanAttest
              </span>
            </Link>

            {/* Nav links */}
            <div className="nav-links">
              {navLinks.map(({ href, label }) => (
                <Link
                  key={href}
                  href={href}
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
                  onMouseEnter={e => { if (!isActive(href)) (e.currentTarget as HTMLElement).style.color = '#0F172A'; }}
                  onMouseLeave={e => { if (!isActive(href)) (e.currentTarget as HTMLElement).style.color = '#64748B'; }}
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
