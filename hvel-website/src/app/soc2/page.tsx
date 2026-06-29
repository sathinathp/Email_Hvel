import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import Link from 'next/link';

export default function SOC2() {
  return (
    <main style={{ minHeight:'100vh', background:'#fff' }}>
      <Navbar />
      <section style={{ padding:'80px 24px 48px', background:'linear-gradient(180deg,#F8FAFC 0%,#fff 100%)', borderBottom:'1px solid #F1F5F9' }}>
        <div style={{ maxWidth:800, margin:'0 auto' }}>
          <div style={{ display:'inline-flex', alignItems:'center', gap:8, background:'#F0FDF4', border:'1px solid #BBF7D0', borderRadius:9999, padding:'4px 14px', fontSize:12, fontWeight:700, color:'#16A34A', marginBottom:20 }}>
            ✓ SOC 2 Type II — In Progress
          </div>
          <h1 style={{ fontSize:'clamp(32px,5vw,48px)', fontWeight:900, color:'#0F172A', letterSpacing:'-0.04em', lineHeight:1.1, marginBottom:16 }}>
            SOC 2 Compliance
            <span style={{ position: 'absolute', width: '1px', height: '1px', padding: '0', margin: '-1px', overflow: 'hidden', clip: 'rect(0,0,0,0)', border: '0' }}>
              Soc2
            </span>
          </h1>
          <p style={{ fontSize:17, color:'#64748B', lineHeight:1.7, maxWidth:640 }}>
            Attest is actively pursuing SOC 2 Type II certification. This page outlines our
            current security controls and compliance posture.
          </p>
        </div>
      </section>

      <section style={{ padding:'64px 24px', maxWidth:800, margin:'0 auto' }}>
        <div style={{ display:'flex', flexDirection:'column', gap:48 }}>

          <div>
            <h2 style={{ fontSize:24, fontWeight:800, color:'#0F172A', marginBottom:16 }}>Trust Service Criteria</h2>
            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              {[
                { criteria:'Security', status:'Implemented', desc:'Access controls, encryption at rest (AES-256), TLS 1.3 in transit, MFA for all engineers, regular penetration testing.' },
                { criteria:'Availability', status:'Implemented', desc:'99.9% uptime SLA, redundant infrastructure, automated failover, incident response procedures.' },
                { criteria:'Confidentiality', status:'Implemented', desc:'Zero email content storage, data minimization by design, strict access controls, NDA for all staff.' },
                { criteria:'Privacy', status:'Implemented', desc:'GDPR and CCPA compliant, data subject rights portal, privacy-by-design architecture, no data selling.' },
                { criteria:'Processing Integrity', status:'In Progress', desc:'Cryptographic audit trail for all verification events, immutable logs, hash verification for recipients.' },
              ].map((item) => (
                <div key={item.criteria} style={{ display:'flex', gap:16, padding:'18px 20px', background:'#F8FAFC', borderRadius:12, border:'1px solid #E2E8F0' }}>
                  <div style={{ flexShrink:0, paddingTop:2 }}>
                    <span style={{ fontSize:11, fontWeight:700, color: item.status==='Implemented'?'#16A34A':'#EA580C', background: item.status==='Implemented'?'rgba(22,163,74,0.08)':'rgba(234,88,12,0.08)', padding:'3px 10px', borderRadius:9999, whiteSpace:'nowrap' }}>
                      {item.status}
                    </span>
                  </div>
                  <div>
                    <p style={{ fontWeight:700, color:'#0F172A', fontSize:15, marginBottom:4 }}>{item.criteria}</p>
                    <p style={{ fontSize:13, color:'#64748B', margin:0, lineHeight:1.6 }}>{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h2 style={{ fontSize:24, fontWeight:800, color:'#0F172A', marginBottom:16 }}>Current Security Controls</h2>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))', gap:14 }}>
              {[
                { icon:'🔐', title:'AES-256 Encryption', desc:'All data encrypted at rest.' },
                { icon:'🔒', title:'TLS 1.3', desc:'All data encrypted in transit.' },
                { icon:'👤', title:'MFA Required', desc:'All engineer accounts require hardware MFA.' },
                { icon:'🔍', title:'Pen Testing', desc:'Quarterly third-party penetration tests.' },
                { icon:'📋', title:'Access Logs', desc:'All database access is logged and audited.' },
                { icon:'🚨', title:'Incident Response', desc:'24-hour incident response SLA.' },
              ].map((item) => (
                <div key={item.title} style={{ padding:18, background:'#F8FAFC', border:'1px solid #E2E8F0', borderRadius:12 }}>
                  <div style={{ fontSize:22, marginBottom:8 }}>{item.icon}</div>
                  <p style={{ fontWeight:700, color:'#0F172A', fontSize:13, marginBottom:4 }}>{item.title}</p>
                  <p style={{ fontSize:12, color:'#64748B', margin:0 }}>{item.desc}</p>
                </div>
              ))}
            </div>
          </div>

          <div style={{ background:'#EFF6FF', border:'1px solid #DBEAFE', borderRadius:16, padding:28 }}>
            <p style={{ fontWeight:800, color:'#1D4ED8', fontSize:15, marginBottom:8 }}>Request Security Documentation</p>
            <p style={{ fontSize:14, color:'#475569', marginBottom:16, lineHeight:1.6 }}>
              Enterprise customers can request our current security documentation, penetration test
              summaries, and compliance evidence package by contacting our security team.
            </p>
            <a href="mailto:support@attest.page" style={{ display:'inline-flex', alignItems:'center', gap:8, background:'#2563EB', color:'white', padding:'10px 22px', borderRadius:10, fontWeight:700, fontSize:14, textDecoration:'none' }}>
              Contact Security Team →
            </a>
          </div>

          <div>
            <p style={{ fontSize:13, color:'#94A3B8', lineHeight:1.6 }}>
              For the full technical security overview, see the{' '}
              <Link href="/whitepaper" style={{ color:'#2563EB', fontWeight:600 }}>Security Whitepaper</Link>.
              For privacy details, see the{' '}
              <Link href="/privacy" style={{ color:'#2563EB', fontWeight:600 }}>Privacy Policy</Link>.
            </p>
          </div>
        </div>
      </section>
      <Footer />
    </main>
  );
}
