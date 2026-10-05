'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

// API Base URL Detection (localhost:5000 with production fallbacks)
const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL || (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
  ? 'http://localhost:5000'
  : 'https://api.attest.page');

// User Profile Interface
interface UserProfile {
  id: string;
  email: string;
  name: string;
  avatar: string;
  provider: 'google' | 'microsoft' | 'email';
  company: string;
  title: string;
  plan: 'free' | 'professional' | 'enterprise';
  planRenewal: string;
  planExpiresAt?: string | null;
  dailyUsage: number;
  dailyLimit: number | 'unlimited';
  aliases: string[];
  securityKeys: {
    id: string;
    name: string;
    type: string;
    lastUsed: string;
  }[];
}

// Audit Log Interface
interface AuditLog {
  id: string;
  type: 'sent_stamped' | 'sent_unstamped' | 'recv_verified' | 'recv_unverified' | 'sent_stamped_link' | 'sent_stamped_hash' | 'received_stamped' | 'received_unstamped';
  subject: string;
  sender: string;
  recipient: string;
  timestamp: string;
  hash: string;
  securityProof: string;
  status: 'VERIFIED' | 'UNVERIFIED' | 'WARNING';
}

export default function PortalPage() {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(false);

  // Form states for login / signup screen
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [toastMessage, setToastMessage] = useState('');
  const [isToastVisible, setIsToastVisible] = useState(false);

  // Dashboard states once signed in
  const [activeTab, setActiveTab] = useState<'audit' | 'accounts' | 'plan'>('audit');
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [dbStats, setDbStats] = useState<{
    sent_verified: number;
    sent_unstamped: number;
    received_verified: number;
    received_unstamped: number;
  } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'verified' | 'unstamped' | 'warning'>('all');
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [showPlanModal, setShowPlanModal] = useState(false);

  // Alias form
  const [isAddingAlias, setIsAddingAlias] = useState(false);
  const [aliasStep, setAliasStep] = useState<'email' | 'otp'>('email');
  const [newAliasEmail, setNewAliasEmail] = useState('');
  const [aliasOtpInput, setAliasOtpInput] = useState('');
  const [isLoadingAlias, setIsLoadingAlias] = useState(false);
  const [aliasError, setAliasError] = useState('');

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setIsToastVisible(true);
    setTimeout(() => setIsToastVisible(false), 3500);
  };

  // Fetch real data directly from backend PostgreSQL database
  const fetchUserData = useCallback(async (email: string, token?: string) => {
    const bearer = token || authToken || (typeof window !== 'undefined' ? localStorage.getItem('hvel_token') : null);
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (bearer) {
      headers['Authorization'] = `Bearer ${bearer}`;
    }

    try {
      // 1. Fetch Real Plan Status from PostgreSQL `users` table
      const planRes = await fetch(`${API_BASE}/api/plan/status?email=${encodeURIComponent(email)}`, { headers }).catch(() => null);
      let planData: any = null;
      if (planRes && planRes.ok) {
        planData = await planRes.json();
      }

      // 2. Fetch Real Audit Logs & Stats from PostgreSQL `audit_logs` table
      const auditRes = await fetch(`${API_BASE}/api/audit-logs`, { headers }).catch(() => null);
      if (auditRes && auditRes.ok) {
        const auditData = await auditRes.json();
        
        // Save database stats aggregation
        if (auditData.stats) {
          setDbStats({
            sent_verified: (auditData.stats.sent_stamped_link || 0) + (auditData.stats.sent_stamped_hash || 0) + (auditData.stats.sent_stamped || 0),
            sent_unstamped: auditData.stats.sent_unstamped || 0,
            received_verified: (auditData.stats.received_stamped || 0) + (auditData.stats.recv_verified || 0),
            received_unstamped: (auditData.stats.received_unstamped || 0) + (auditData.stats.recv_unverified || 0)
          });
        }

        if (Array.isArray(auditData.logs)) {
          const mappedLogs: AuditLog[] = auditData.logs.map((l: any, idx: number) => {
            const extra = l.extra || l.metadata || {};
            const isSent = (l.type || '').startsWith('sent');
            const isVerified = (l.type || '').includes('stamped') || (l.type || '').includes('verified');
            const isWarning = (l.type || '').includes('unverified') || (l.type || '').includes('warning');

            return {
              id: `log_${idx}_${l.timestamp || Date.now()}`,
              type: l.type,
              subject: extra.subject || (isSent ? 'Outgoing Attested Communication' : 'Incoming Verified Communication'),
              sender: isSent ? (extra.sender || email) : (l.email || extra.sender || 'sender@domain.com'),
              recipient: isSent ? (l.email || extra.recipient || 'recipient@domain.com') : (extra.recipient || email),
              timestamp: l.timestamp ? new Date(l.timestamp).toLocaleString() : 'Recent',
              hash: extra.contentHash || extra.hash || (extra.totp ? `TOTP-SHA256-${extra.totp}` : '—'),
              securityProof: extra.proof || (isVerified ? 'Level 3 · Cryptographic Human Verification' : 'Standard Unsigned Message'),
              status: isVerified ? 'VERIFIED' : (isWarning ? 'WARNING' : 'UNVERIFIED')
            };
          });
          setAuditLogs(mappedLogs);
        }
      }

      // 3. Fetch Real Aliases from PostgreSQL `user_aliases` table
      const aliasRes = await fetch(`${API_BASE}/api/aliases`, { headers }).catch(() => null);
      let aliasesList: string[] = [];
      if (aliasRes && aliasRes.ok) {
        const aliasData = await aliasRes.json();
        if (Array.isArray(aliasData.aliases)) {
          aliasesList = aliasData.aliases;
        }
      }

      // Update current user state with real plan & usage from DB
      if (planData && planData.success) {
        setCurrentUser(prev => {
          if (!prev) return null;
          const expiresDate = planData.plan_expires_at ? new Date(planData.plan_expires_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : null;
          const renewalText = expiresDate 
            ? expiresDate 
            : (planData.plan === 'free' ? 'Free Tier (No Expiry)' : 'Active Subscription (Auto-Renewing)');

          const updated: UserProfile = {
            ...prev,
            plan: planData.plan || 'free',
            planRenewal: renewalText,
            planExpiresAt: planData.plan_expires_at || null,
            dailyUsage: planData.usage?.totp_used_today || 0,
            dailyLimit: planData.planDetails?.totp_daily_limit || (planData.plan === 'free' ? 3 : 'unlimited'),
            aliases: aliasesList.length > 0 ? aliasesList : prev.aliases
          };
          try {
            localStorage.setItem('hvel_portal_user', JSON.stringify(updated));
          } catch {}
          return updated;
        });
      }
    } catch (err) {
      console.warn('[Portal] Database sync notice:', err);
    }
  }, [authToken]);

  // OAuth SSO Modal State
  const [ssoModalProvider, setSsoModalProvider] = useState<'google' | 'microsoft' | null>(null);
  const [ssoEmailInput, setSsoEmailInput] = useState('');
  const [ssoNameInput, setSsoNameInput] = useState('');

  // Handle OAuth Redirect Callbacks & Load active session from localStorage
  useEffect(() => {
    // 1. Check URL query params for OAuth callback
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const callbackToken = urlParams.get('token');
      const callbackEmail = urlParams.get('email');
      const callbackProvider = urlParams.get('provider') as ('google' | 'microsoft') || 'google';
      const callbackName = urlParams.get('name') || (callbackEmail ? callbackEmail.split('@')[0] : 'Member');

      if (callbackToken && callbackEmail) {
        const cleanDomain = callbackEmail.includes('@') ? callbackEmail.split('@')[1] : 'workspace';
        const oauthUser: UserProfile = {
          id: 'usr_' + Math.random().toString(36).substring(2, 8),
          email: callbackEmail,
          name: callbackName,
          avatar: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(callbackEmail)}&backgroundColor=004D40`,
          provider: callbackProvider,
          company: cleanDomain.charAt(0).toUpperCase() + cleanDomain.slice(1),
          title: 'Verified Member',
          plan: 'professional',
          planRenewal: 'Active Plan',
          dailyUsage: 0,
          dailyLimit: 'unlimited',
          aliases: [],
          securityKeys: [
            { id: 'key_oauth', name: `${callbackProvider === 'google' ? 'Google Workspace' : 'Microsoft 365'} Identity Token`, type: 'OAuth 2.0 / OIDC', lastUsed: 'Active Session' }
          ]
        };

        setAuthToken(callbackToken);
        localStorage.setItem('hvel_token', callbackToken);
        setCurrentUser(oauthUser);
        localStorage.setItem('hvel_portal_user', JSON.stringify(oauthUser));
        window.history.replaceState({}, document.title, window.location.pathname);
        triggerToast(`Signed in successfully with ${callbackProvider === 'google' ? 'Google' : 'Microsoft'}!`);
        fetchUserData(callbackEmail, callbackToken);
        setIsLoaded(true);
        return;
      }
    }

    const savedUser = localStorage.getItem('hvel_portal_user');
    const savedToken = localStorage.getItem('hvel_token');
    if (savedUser) {
      try {
        const parsed = JSON.parse(savedUser);
        setCurrentUser(parsed);
        if (savedToken) {
          setAuthToken(savedToken);
          fetchUserData(parsed.email, savedToken);
        }
      } catch {
        setCurrentUser(null);
      }
    }
    setIsLoaded(true);
  }, [fetchUserData]);

  // Automatic background real-time sync with PostgreSQL database (every 10s & on tab focus)
  useEffect(() => {
    if (!currentUser?.email) return;

    const interval = setInterval(() => {
      fetchUserData(currentUser.email);
    }, 10000);

    const handleFocus = () => {
      if (document.visibilityState === 'visible') {
        fetchUserData(currentUser.email);
      }
    };

    window.addEventListener('visibilitychange', handleFocus);
    window.addEventListener('focus', handleFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener('visibilitychange', handleFocus);
      window.removeEventListener('focus', handleFocus);
    };
  }, [currentUser?.email, fetchUserData]);

  // Handle Real Login / Signup from Database
  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = emailInput.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      triggerToast('Please enter a valid email address.');
      return;
    }
    if (!passwordInput || passwordInput.length < 4) {
      triggerToast('Password must be at least 4 characters.');
      return;
    }

    setIsLoadingAuth(true);

    try {
      const endpoint = authMode === 'signin' ? '/api/auth/login' : '/api/auth/signup';
      const res = await fetch(`${API_BASE}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail, password: passwordInput })
      }).catch(() => null);

      let token = 'local_session_' + Math.random().toString(36).substring(2, 10);
      let plan: 'free' | 'professional' | 'enterprise' = 'free';
      let planExpiry: string | null = null;

      if (res && res.ok) {
        const data = await res.json();
        if (data.token) token = data.token;
        if (data.plan) plan = data.plan;
        if (data.plan_expires_at) planExpiry = data.plan_expires_at;
        triggerToast(authMode === 'signin' ? 'Signed in successfully!' : 'Account registered successfully!');
      } else if (res && !res.ok) {
        const errorData = await res.json().catch(() => ({}));
        if (errorData.error === 'USER_NOT_FOUND' || errorData.error === 'INVALID_PASSWORD') {
          triggerToast(errorData.message || 'Invalid email or password.');
          setIsLoadingAuth(false);
          return;
        }
        triggerToast(`Connected to Attest account (${cleanEmail})`);
      } else {
        triggerToast(`Signed in to Attest Portal as ${cleanEmail}`);
      }

      const cleanDomain = cleanEmail.includes('@') ? cleanEmail.split('@')[1] : 'workspace';
      const userProfile: UserProfile = {
        id: 'usr_' + Math.random().toString(36).substring(2, 8),
        email: cleanEmail,
        name: cleanEmail.split('@')[0],
        avatar: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(cleanEmail)}&backgroundColor=004D40`,
        provider: 'email',
        company: cleanDomain.charAt(0).toUpperCase() + cleanDomain.slice(1),
        title: 'Attest Security Member',
        plan: plan,
        planRenewal: planExpiry ? new Date(planExpiry).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : (plan === 'free' ? 'Free Tier' : 'Active Plan'),
        planExpiresAt: planExpiry,
        dailyUsage: 0,
        dailyLimit: plan === 'free' ? 3 : 'unlimited',
        aliases: [],
        securityKeys: [
          { id: 'key_1', name: 'Browser Passkey Secure Enclave', type: 'Passkey ECDSA', lastUsed: 'Active Session' }
        ]
      };

      setAuthToken(token);
      localStorage.setItem('hvel_token', token);
      setCurrentUser(userProfile);
      localStorage.setItem('hvel_portal_user', JSON.stringify(userProfile));

      await fetchUserData(cleanEmail, token);
    } catch (err: any) {
      console.error('[Auth Error]', err);
      triggerToast('Authentication error. Please try again.');
    } finally {
      setIsLoadingAuth(false);
    }
  };

  // Sign In with Google / Microsoft Enterprise Work Account & Open Portal
  const handleSignInWithProvider = async (provider: 'google' | 'microsoft') => {
    setIsLoadingAuth(true);

    try {
      // 1. Fetch live SSO configuration & URL from backend
      const configRes = await fetch(`${API_BASE}/api/auth/sso/config`).catch(() => null);
      if (configRes && configRes.ok) {
        const config = await configRes.json();
        if (provider === 'google' && config.google?.authUrl) {
          window.location.href = config.google.authUrl;
          return;
        }
        if (provider === 'microsoft' && config.microsoft?.authUrl) {
          window.location.href = config.microsoft.authUrl;
          return;
        }
      }

      // Direct fallback to backend OAuth endpoint
      window.location.href = `${API_BASE}/api/auth/${provider}`;
    } catch (err) {
      console.error('[SSO Error]', err);
      window.location.href = `${API_BASE}/api/auth/${provider}`;
    } finally {
      setIsLoadingAuth(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('hvel_portal_user');
    localStorage.removeItem('hvel_token');
    setCurrentUser(null);
    setAuthToken(null);
    setAuditLogs([]);
    setShowPlanModal(false);
    triggerToast('Logged out of Attest User Portal.');
  };

  const handleStartAddAlias = () => {
    if (!currentUser) return;
    if (currentUser.plan === 'free') {
      triggerToast('Multi-inbox linking requires a Professional plan. Please upgrade to link accounts.');
      setShowPlanModal(true);
      return;
    }
    setAliasStep('email');
    setNewAliasEmail('');
    setAliasOtpInput('');
    setAliasError('');
    setIsAddingAlias(true);
  };

  const handleRequestAliasOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!currentUser) return;
    const email = newAliasEmail.trim().toLowerCase();
    if (!email || !email.includes('@')) {
      setAliasError('Please enter a valid email address.');
      return;
    }
    if (currentUser.aliases.map(a => a.toLowerCase()).includes(email) || email === currentUser.email.toLowerCase()) {
      setAliasError('This email is already linked to your account.');
      return;
    }

    setIsLoadingAlias(true);
    setAliasError('');
    try {
      const bearer = authToken || (typeof window !== 'undefined' ? localStorage.getItem('hvel_token') : null);
      const res = await fetch(`${API_BASE}/api/aliases/request-otp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${bearer}`
        },
        body: JSON.stringify({ aliasEmail: email })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setAliasStep('otp');
        triggerToast(`Verification code sent to ${email}`);
      } else {
        setAliasError(data.message || data.error || 'Failed to send verification code.');
        if (data.error === 'UPGRADE_REQUIRED') {
          setShowPlanModal(true);
        }
      }
    } catch (err: any) {
      setAliasError(err.message || 'Failed to connect to backend server.');
    } finally {
      setIsLoadingAlias(false);
    }
  };

  const handleVerifyAndLinkAlias = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    const email = newAliasEmail.trim().toLowerCase();
    const otp = aliasOtpInput.trim();
    if (!otp || otp.length < 4) {
      setAliasError('Please enter the 6-digit verification code.');
      return;
    }

    setIsLoadingAlias(true);
    setAliasError('');
    try {
      const bearer = authToken || (typeof window !== 'undefined' ? localStorage.getItem('hvel_token') : null);
      const res = await fetch(`${API_BASE}/api/aliases`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${bearer}`
        },
        body: JSON.stringify({ aliasEmail: email, otp })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        const updated: UserProfile = {
          ...currentUser,
          aliases: [...currentUser.aliases.filter(a => a.toLowerCase() !== email), email]
        };
        setCurrentUser(updated);
        localStorage.setItem('hvel_portal_user', JSON.stringify(updated));
        setIsAddingAlias(false);
        setNewAliasEmail('');
        setAliasOtpInput('');
        triggerToast(`Successfully linked ${email}!`);
        fetchUserData(currentUser.email, bearer || undefined);
      } else {
        setAliasError(data.message || data.error || 'Invalid verification code.');
      }
    } catch (err: any) {
      setAliasError(err.message || 'Failed to verify code.');
    } finally {
      setIsLoadingAlias(false);
    }
  };

  const handleRemoveAlias = async (alias: string) => {
    if (!currentUser) return;

    try {
      const bearer = authToken || (typeof window !== 'undefined' ? localStorage.getItem('hvel_token') : null);
      await fetch(`${API_BASE}/api/aliases`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${bearer}`
        },
        body: JSON.stringify({ aliasEmail: alias })
      });
    } catch {}

    const updated: UserProfile = {
      ...currentUser,
      aliases: currentUser.aliases.filter(a => a.toLowerCase() !== alias.toLowerCase())
    };
    setCurrentUser(updated);
    localStorage.setItem('hvel_portal_user', JSON.stringify(updated));
    triggerToast(`Removed linked alias: ${alias}`);
  };

  // Real Metric Calculations for the 4 Blocks (Computed directly from PostgreSQL database)
  const countSentVerified = dbStats !== null
    ? dbStats.sent_verified
    : auditLogs.filter(l => l.type === 'sent_stamped' || l.type === 'sent_stamped_link' || l.type === 'sent_stamped_hash').length;

  const countSentUnstamped = dbStats !== null
    ? dbStats.sent_unstamped
    : auditLogs.filter(l => l.type === 'sent_unstamped').length;

  const countReceivedVerified = dbStats !== null
    ? dbStats.received_verified
    : auditLogs.filter(l => l.type === 'recv_verified' || l.type === 'received_stamped').length;

  const countReceivedUnstamped = dbStats !== null
    ? dbStats.received_unstamped
    : auditLogs.filter(l => l.type === 'recv_unverified' || l.type === 'received_unstamped').length;

  // Filtered audit logs
  const filteredLogs = auditLogs.filter(log => {
    const matchesSearch = 
      log.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.sender.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.recipient.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.hash.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (!matchesSearch) return false;
    if (statusFilter === 'verified') return log.status === 'VERIFIED';
    if (statusFilter === 'unstamped') return log.type === 'sent_unstamped' || log.type === 'received_unstamped';
    if (statusFilter === 'warning') return log.status === 'WARNING';
    return true;
  });

  if (!isLoaded) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F8FAFC' }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: '#0F172A' }}>Loading Attest Portal...</div>
      </div>
    );
  }

  // ==========================================
  // VIEW 1: DEDICATED LOGIN PORTAL (100VH NO SCROLL)
  // ==========================================
  if (!currentUser) {
    return (
      <div style={{
        height: '100vh',
        maxHeight: '100vh',
        width: '100vw',
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
        background: '#FAFBFD',
        overflow: 'hidden',
        padding: '16px 24px',
        boxSizing: 'border-box'
      }}>
        {/* Background Visual Layer */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          backgroundImage: `
            linear-gradient(135deg, rgba(248, 250, 252, 0.94) 0%, rgba(241, 245, 249, 0.88) 100%),
            url('https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=2000&q=80')
          `,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          zIndex: 1
        }}></div>

        {/* Soft geometric accent lines */}
        <div style={{
          position: 'absolute',
          top: '15%',
          left: '10%',
          width: 500,
          height: 500,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(0, 122, 94, 0.08) 0%, rgba(0, 122, 94, 0) 70%)',
          zIndex: 2,
          pointerEvents: 'none'
        }}></div>

        {/* Toast Notification */}
        {isToastVisible && (
          <div style={{
            position: 'fixed',
            top: 20,
            right: 20,
            zIndex: 99999,
            background: '#0F172A',
            color: '#FFFFFF',
            padding: '10px 18px',
            borderRadius: 8,
            boxShadow: '0 10px 25px -5px rgba(0,0,0,0.25)',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            fontSize: 12.5,
            fontWeight: 600,
            border: '1px solid rgba(255,255,255,0.1)'
          }}>
            <span style={{ color: '#10B981', fontSize: 15 }}>✓</span>
            <span>{toastMessage}</span>
          </div>
        )}

        {/* Main Split Portal Container */}
        <div style={{
          position: 'relative',
          zIndex: 10,
          width: '100%',
          maxWidth: 1140,
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
          alignItems: 'center',
          gap: 'clamp(24px, 4vw, 56px)'
        }}>

          {/* LEFT SIDE: Hero Brand & Value Props */}
          <div style={{ paddingRight: 10 }}>
            {/* Attest Brand Monogram */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
              <div style={{
                width: 44,
                height: 44,
                borderRadius: 10,
                background: '#F0FDF4',
                border: '1px solid #BBF7D0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 2px 8px rgba(0, 122, 94, 0.12)'
              }}>
                <img
                  src="/icon-192.png"
                  alt="Attest"
                  style={{
                    width: 30,
                    height: 30,
                    objectFit: 'contain'
                  }}
                />
              </div>
              <div>
                <div style={{ fontSize: 24, fontWeight: 900, color: '#0F172A', letterSpacing: '-0.03em', lineHeight: 1 }}>
                  Attest
                </div>
                <div style={{ fontSize: 9, fontWeight: 800, color: '#64748B', letterSpacing: '0.16em', textTransform: 'uppercase', marginTop: 4 }}>
                  HUMAN VERIFICATION LAYER
                </div>
              </div>
            </div>

            {/* Headline */}
            <h1 style={{
              fontSize: 'clamp(26px, 3.2vw, 38px)',
              fontWeight: 900,
              color: '#0F172A',
              lineHeight: 1.15,
              letterSpacing: '-0.03em',
              marginBottom: 12
            }}>
              Zero-Trust Verification for Every Outgoing & Incoming Email.
            </h1>

            <p style={{
              fontSize: 14,
              lineHeight: 1.5,
              color: '#475569',
              marginBottom: 24,
              maxWidth: 460
            }}>
              Authenticate with your workspace credentials to access your real-time cryptographic audit trail, inbox verifications, and quota management.
            </p>

            {/* Feature Checkpoints */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ color: '#007A5E', fontSize: 15, fontWeight: 800 }}>✓</span>
                <span style={{ fontSize: 13, color: '#334155', fontWeight: 600 }}>Real-Time Live Sync & Cryptographic Ledger</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ color: '#007A5E', fontSize: 15, fontWeight: 800 }}>✓</span>
                <span style={{ fontSize: 13, color: '#334155', fontWeight: 600 }}>Sent & Received Stamped Email Tracking</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ color: '#007A5E', fontSize: 15, fontWeight: 800 }}>✓</span>
                <span style={{ fontSize: 13, color: '#334155', fontWeight: 600 }}>Full Plan & Expiration Details on Demand</span>
              </div>
            </div>
          </div>

          {/* RIGHT SIDE: Authentication Card */}
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <div style={{
              width: '100%',
              maxWidth: 400,
              background: '#FFFFFF',
              borderRadius: 16,
              padding: '24px 28px',
              border: '1px solid #E2E8F0',
              boxShadow: '0 20px 40px -15px rgba(15, 23, 42, 0.08), 0 0 0 1px rgba(0,0,0,0.02)'
            }}>
              {/* Card Header */}
              <div style={{ textAlign: 'center', marginBottom: 16 }}>
                <h2 style={{ fontSize: 21, fontWeight: 800, color: '#0F172A', marginTop: 4, marginBottom: 3, letterSpacing: '-0.02em' }}>
                  {authMode === 'signin' ? 'Sign in to Portal' : 'Create account'}
                </h2>
                <p style={{ fontSize: 12.5, color: '#64748B', margin: 0 }}>
                  {authMode === 'signin' ? 'Access your live account & audit metrics' : 'Register your verified email address'}
                </p>
              </div>

              {/* Email Form */}
              <form onSubmit={handleEmailSignIn} style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
                <div>
                  <label style={{ fontSize: 11.5, fontWeight: 600, color: '#334155', display: 'block', marginBottom: 4 }}>
                    Email address
                  </label>
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: 12, top: 9, color: '#94A3B8', fontSize: 14 }}>✉</span>
                    <input
                      type="email"
                      placeholder="user@company.com"
                      value={emailInput}
                      onChange={(e) => setEmailInput(e.target.value)}
                      required
                      style={{
                        width: '100%',
                        padding: '9px 12px 9px 36px',
                        border: '1.5px solid #E2E8F0',
                        borderRadius: 8,
                        fontSize: 13,
                        color: '#0F172A',
                        outline: 'none',
                        fontFamily: 'inherit',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: 11.5, fontWeight: 600, color: '#334155', display: 'block', marginBottom: 4 }}>
                    Password
                  </label>
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: 12, top: 9, color: '#94A3B8', fontSize: 14 }}>🔒</span>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Enter password"
                      value={passwordInput}
                      onChange={(e) => setPasswordInput(e.target.value)}
                      required
                      style={{
                        width: '100%',
                        padding: '9px 36px 9px 36px',
                        border: '1.5px solid #E2E8F0',
                        borderRadius: 8,
                        fontSize: 13,
                        color: '#0F172A',
                        outline: 'none',
                        fontFamily: 'inherit',
                        boxSizing: 'border-box'
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      style={{
                        position: 'absolute',
                        right: 10,
                        top: 9,
                        background: 'none',
                        border: 'none',
                        color: '#94A3B8',
                        cursor: 'pointer',
                        fontSize: 14,
                        padding: 0
                      }}
                    >
                      {showPassword ? '🙈' : '👁️'}
                    </button>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: -2 }}>
                  <Link
                    href="/forgot-password"
                    style={{ textDecoration: 'none', fontSize: 11.5, color: '#007A5E', fontWeight: 600, cursor: 'pointer', padding: 0 }}
                  >
                    Forgot password?
                  </Link>
                </div>

                {/* Primary Teal Sign In Button */}
                <button
                  type="submit"
                  disabled={isLoadingAuth}
                  style={{
                    width: '100%',
                    padding: '10px 16px',
                    background: '#004D40',
                    color: '#FFFFFF',
                    border: 'none',
                    borderRadius: 8,
                    fontSize: 13.5,
                    fontWeight: 700,
                    cursor: isLoadingAuth ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    marginTop: 2,
                    boxShadow: '0 3px 10px rgba(0, 77, 64, 0.2)',
                    opacity: isLoadingAuth ? 0.7 : 1
                  }}
                >
                  <span>{isLoadingAuth ? 'Connecting...' : authMode === 'signin' ? 'Sign in' : 'Create account'}</span>
                  <span>→</span>
                </button>
              </form>

              {/* Divider */}
              <div style={{ display: 'flex', alignItems: 'center', margin: '14px 0', gap: 10 }}>
                <div style={{ flex: 1, height: 1, background: '#E2E8F0' }}></div>
                <span style={{ fontSize: 11, color: '#94A3B8', fontWeight: 500 }}>or continue with SSO</span>
                <div style={{ flex: 1, height: 1, background: '#E2E8F0' }}></div>
              </div>

              {/* SSO Buttons */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {/* Google SSO */}
                <button
                  type="button"
                  onClick={() => handleSignInWithProvider('google')}
                  style={{
                    width: '100%',
                    padding: '9px 14px',
                    background: '#FFFFFF',
                    border: '1.5px solid #E2E8F0',
                    borderRadius: 8,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 10,
                    fontSize: 12.5,
                    fontWeight: 600,
                    color: '#1E293B',
                    cursor: 'pointer'
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                  </svg>
                  <span>Continue with Google</span>
                </button>

                {/* Microsoft SSO */}
                <button
                  type="button"
                  onClick={() => handleSignInWithProvider('microsoft')}
                  style={{
                    width: '100%',
                    padding: '9px 14px',
                    background: '#FFFFFF',
                    border: '1.5px solid #E2E8F0',
                    borderRadius: 8,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 10,
                    fontSize: 12.5,
                    fontWeight: 600,
                    color: '#1E293B',
                    cursor: 'pointer'
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 23 23">
                    <path fill="#f35325" d="M1 1h10v10H1z"/>
                    <path fill="#81bc06" d="M12 1h10v10H12z"/>
                    <path fill="#05a6f0" d="M1 12h10v10H1z"/>
                    <path fill="#ffba08" d="M12 12h10v12H12z"/>
                  </svg>
                  <span>Continue with Microsoft</span>
                </button>
              </div>

              {/* Bottom Mode Switch */}
              <div style={{ textAlign: 'center', marginTop: 14, fontSize: 12, color: '#64748B' }}>
                {authMode === 'signin' ? (
                  <>
                    Don&apos;t have an account?{' '}
                    <button
                      type="button"
                      onClick={() => setAuthMode('signup')}
                      style={{ background: 'none', border: 'none', color: '#007A5E', fontWeight: 700, cursor: 'pointer', padding: 0 }}
                    >
                      Sign up
                    </button>
                  </>
                ) : (
                  <>
                    Already have an account?{' '}
                    <button
                      type="button"
                      onClick={() => setAuthMode('signin')}
                      style={{ background: 'none', border: 'none', color: '#007A5E', fontWeight: 700, cursor: 'pointer', padding: 0 }}
                    >
                      Sign in
                    </button>
                  </>
                )}
              </div>

            </div>
          </div>

        </div>
      </div>
    );
  }

  // ==========================================
  // VIEW 2: DEDICATED USER PORTAL DASHBOARD
  // ==========================================
  return (
    <div style={{ minHeight: '100vh', background: '#FAFBFD', display: 'flex', flexDirection: 'column', fontFamily: "'Inter', system-ui, sans-serif" }}>
      
      {/* Toast Notification */}
      {isToastVisible && (
        <div style={{
          position: 'fixed',
          top: 24,
          right: 24,
          zIndex: 99999,
          background: '#0F172A',
          color: '#FFFFFF',
          padding: '12px 20px',
          borderRadius: 8,
          boxShadow: '0 10px 25px -5px rgba(0,0,0,0.25)',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          fontSize: 13,
          fontWeight: 600,
          border: '1px solid rgba(255,255,255,0.1)'
        }}>
          <span style={{ color: '#10B981', fontSize: 16 }}>✓</span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Standalone Portal Top Header */}
      <header style={{
        background: '#FFFFFF',
        borderBottom: '1px solid #E2E8F0',
        padding: '14px 32px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'sticky',
        top: 0,
        zIndex: 50
      }}>
        {/* Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <img
            src="/icon-192.png"
            alt="Attest"
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              objectFit: 'contain'
            }}
          />
          <div>
            <div style={{ fontSize: 16, fontWeight: 900, color: '#0F172A', letterSpacing: '-0.02em', lineHeight: 1 }}>
              Attest User Portal
            </div>
            <div style={{ fontSize: 10, color: '#64748B', marginTop: 2 }}>
              Human Verification & Audit Layer
            </div>
          </div>
        </div>

        {/* User Identity, Plan Click Badge & Logout */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          {/* Clickable Profile & Plan Pill */}
          <div 
            onClick={() => setShowPlanModal(true)}
            title="Click to view full plan, expiration & quota details"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '4px 12px 4px 6px',
              background: '#F8FAFC',
              borderRadius: 30,
              border: '1.5px solid #E2E8F0',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              userSelect: 'none'
            }}
          >
            <img
              src={currentUser.avatar}
              alt={currentUser.name}
              style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover' }}
            />
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#0F172A', lineHeight: 1.1 }}>{currentUser.name}</div>
              <div style={{ fontSize: 10, color: '#64748B' }}>{currentUser.email}</div>
            </div>

            {/* Clickable Plan Badge */}
            <span style={{
              fontSize: 10,
              fontWeight: 800,
              padding: '3px 9px',
              borderRadius: 9999,
              background: currentUser.plan === 'enterprise' ? '#FAF5FF' : currentUser.plan === 'professional' ? '#F0FDF4' : '#F1F5F9',
              color: currentUser.plan === 'enterprise' ? '#9333EA' : currentUser.plan === 'professional' ? '#166534' : '#475569',
              border: currentUser.plan === 'professional' ? '1px solid #BBF7D0' : currentUser.plan === 'enterprise' ? '1px solid #E9D5FF' : '1px solid #CBD5E1',
              textTransform: 'uppercase',
              display: 'flex',
              alignItems: 'center',
              gap: 5
            }}>
              <span>{currentUser.plan}</span>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="16" x2="12" y2="12"/>
                <line x1="12" y1="8" x2="12.01" y2="8"/>
              </svg>
            </span>
          </div>

          <button
            onClick={handleLogout}
            style={{
              padding: '8px 14px',
              background: '#FFFFFF',
              border: '1px solid #FCA5A5',
              borderRadius: 8,
              color: '#DC2626',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            Sign Out
          </button>
        </div>
      </header>

      {/* Main Dashboard Body */}
      <main style={{ flex: 1, padding: '28px 0 60px 0' }}>
        <div style={{ width: '100%', maxWidth: 1200, margin: '0 auto', padding: '0 24px' }}>

          {/* 4 TOP METRIC BLOCKS (Real SVG Vector Icons) */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: 16,
            marginBottom: 28
          }}>
            {/* Block 1: Sent Verified */}
            <div style={{
              background: '#FFFFFF',
              border: '1px solid #E2E8F0',
              borderRadius: 12,
              padding: '18px 22px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#166534', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Send Verified
                </span>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#166534" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                  <polyline points="9 12 11.5 14.5 15.5 9.5"/>
                </svg>
              </div>
              <div style={{ fontSize: 28, fontWeight: 900, color: '#0F172A', marginTop: 6 }}>
                {countSentVerified}
              </div>
              <div style={{ fontSize: 11, color: '#166534', fontWeight: 600, marginTop: 2 }}>
                Cryptographically Sealed Outgoing
              </div>
            </div>

            {/* Block 2: Sent Unstamped */}
            <div style={{
              background: '#FFFFFF',
              border: '1px solid #E2E8F0',
              borderRadius: 12,
              padding: '18px 22px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Send Unstamped
                </span>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="22" y1="2" x2="11" y2="13"/>
                  <polygon points="22 2 15 22 11 13 2 9 22 2"/>
                </svg>
              </div>
              <div style={{ fontSize: 28, fontWeight: 900, color: '#0F172A', marginTop: 6 }}>
                {countSentUnstamped}
              </div>
              <div style={{ fontSize: 11, color: '#64748B', fontWeight: 600, marginTop: 2 }}>
                Standard Delivery (No Seal)
              </div>
            </div>

            {/* Block 3: Received Verified */}
            <div style={{
              background: '#FFFFFF',
              border: '1px solid #E2E8F0',
              borderRadius: 12,
              padding: '18px 22px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#007A5E', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Received Verified
                </span>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#007A5E" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/>
                  <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>
                  <polyline points="10 9 12 11 15 8"/>
                </svg>
              </div>
              <div style={{ fontSize: 28, fontWeight: 900, color: '#0F172A', marginTop: 6 }}>
                {countReceivedVerified}
              </div>
              <div style={{ fontSize: 11, color: '#007A5E', fontWeight: 600, marginTop: 2 }}>
                Valid Human Senders Verified
              </div>
            </div>

            {/* Block 4: Received Unstamped */}
            <div style={{
              background: '#FFFFFF',
              border: '1px solid #E2E8F0',
              borderRadius: 12,
              padding: '18px 22px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#B45309', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Received Unstamped
                </span>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#B45309" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                  <line x1="12" y1="9" x2="12" y2="13"/>
                  <line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
              </div>
              <div style={{ fontSize: 28, fontWeight: 900, color: '#0F172A', marginTop: 6 }}>
                {countReceivedUnstamped}
              </div>
              <div style={{ fontSize: 11, color: '#B45309', fontWeight: 600, marginTop: 2 }}>
                Unverified / Potential Phishing Risk
              </div>
            </div>
          </div>

          {/* Navigation Tabs (With Clean SVG Icons) */}
          <div style={{ display: 'flex', borderBottom: '2px solid #E2E8F0', marginBottom: 24, gap: 8 }}>
            <button
              onClick={() => setActiveTab('audit')}
              style={{
                padding: '12px 20px',
                background: 'none',
                border: 'none',
                borderBottom: activeTab === 'audit' ? '2px solid #007A5E' : '2px solid transparent',
                marginBottom: -2,
                color: activeTab === 'audit' ? '#007A5E' : '#64748B',
                fontSize: 14,
                fontWeight: activeTab === 'audit' ? 800 : 600,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="16" y1="13" x2="8" y2="13"/>
                <line x1="16" y1="17" x2="8" y2="17"/>
                <polyline points="10 9 9 9 8 9"/>
              </svg>
              <span>Audit Logs ({auditLogs.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('accounts')}
              style={{
                padding: '12px 20px',
                background: 'none',
                border: 'none',
                borderBottom: activeTab === 'accounts' ? '2px solid #007A5E' : '2px solid transparent',
                marginBottom: -2,
                color: activeTab === 'accounts' ? '#007A5E' : '#64748B',
                fontSize: 14,
                fontWeight: activeTab === 'accounts' ? 800 : 600,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                <polyline points="22,6 12,13 2,6"/>
              </svg>
              <span>Linked Email Inboxes ({1 + currentUser.aliases.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('plan')}
              style={{
                padding: '12px 20px',
                background: 'none',
                border: 'none',
                borderBottom: activeTab === 'plan' ? '2px solid #007A5E' : '2px solid transparent',
                marginBottom: -2,
                color: activeTab === 'plan' ? '#007A5E' : '#64748B',
                fontSize: 14,
                fontWeight: activeTab === 'plan' ? 800 : 600,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/>
                <line x1="1" y1="10" x2="23" y2="10"/>
              </svg>
              <span>Plan & Billing Details</span>
            </button>
          </div>

          {/* TAB 1: AUDIT LOGS */}
          {activeTab === 'audit' && (
            <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 16, padding: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14, marginBottom: 20 }}>
                <div>
                  <h3 style={{ fontSize: 17, fontWeight: 800, color: '#0F172A', margin: 0 }}>Audit Verification Trail</h3>
                  <p style={{ fontSize: 12, color: '#64748B', margin: '3px 0 0 0' }}>Cryptographic ledger synced with database</p>
                </div>

                <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                  <input
                    type="text"
                    placeholder="Search subject, hash, sender..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{ padding: '8px 12px', border: '1px solid #CBD5E1', borderRadius: 8, fontSize: 13, outline: 'none' }}
                  />
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as any)}
                    style={{ padding: '8px 12px', border: '1px solid #CBD5E1', borderRadius: 8, fontSize: 13, background: '#FFFFFF' }}
                  >
                    <option value="all">All Events</option>
                    <option value="verified">Verified Only</option>
                    <option value="unstamped">Unstamped</option>
                    <option value="warning">Flagged Alerts</option>
                  </select>
                </div>
              </div>

              {filteredLogs.length === 0 ? (
                <div style={{ padding: '40px 20px', textAlign: 'center', color: '#64748B' }}>
                  <div style={{
                    width: 48,
                    height: 48,
                    borderRadius: 12,
                    background: '#F1F5F9',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 12px auto',
                    color: '#64748B'
                  }}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                      <polyline points="14 2 14 8 20 8"/>
                      <line x1="16" y1="13" x2="8" y2="13"/>
                      <line x1="16" y1="17" x2="8" y2="17"/>
                    </svg>
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#0F172A' }}>No Audit Logs Found</div>
                  <div style={{ fontSize: 12, marginTop: 4 }}>Logs will populate automatically as you send stamped emails with the Attest Extension.</div>
                </div>
              ) : (
                <div style={{ overflowX: 'auto', border: '1px solid #F1F5F9', borderRadius: 8 }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                        <th style={{ padding: '12px 14px', fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>Status</th>
                        <th style={{ padding: '12px 14px', fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>Subject</th>
                        <th style={{ padding: '12px 14px', fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>Party</th>
                        <th style={{ padding: '12px 14px', fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>Time</th>
                        <th style={{ padding: '12px 14px', fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>SHA-256 Hash</th>
                        <th style={{ padding: '12px 14px', fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>Inspect</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredLogs.map(log => (
                        <tr key={log.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                          <td style={{ padding: '12px 14px' }}>
                            <span style={{
                              padding: '3px 8px',
                              borderRadius: 9999,
                              fontSize: 11,
                              fontWeight: 700,
                              background: log.status === 'VERIFIED' ? '#F0FDF4' : log.status === 'WARNING' ? '#FEF2F2' : '#F1F5F9',
                              color: log.status === 'VERIFIED' ? '#166534' : log.status === 'WARNING' ? '#DC2626' : '#475569'
                            }}>
                              {log.status === 'VERIFIED' ? '✓ Verified' : log.status === 'WARNING' ? '⚠️ Alert' : '○ Unstamped'}
                            </span>
                          </td>
                          <td style={{ padding: '12px 14px', fontWeight: 600, color: '#0F172A', maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {log.subject}
                          </td>
                          <td style={{ padding: '12px 14px', color: '#475569' }}>
                            {log.recipient !== currentUser.email ? log.recipient : log.sender}
                          </td>
                          <td style={{ padding: '12px 14px', color: '#64748B' }}>{log.timestamp}</td>
                          <td style={{ padding: '12px 14px' }}>
                            <code style={{ background: '#F8FAFC', padding: '2px 6px', borderRadius: 4, fontSize: 11, border: '1px solid #E2E8F0' }}>
                              #{log.hash.substring(0, 8)}...
                            </code>
                          </td>
                          <td style={{ padding: '12px 14px' }}>
                            <button
                              onClick={() => setSelectedLog(log)}
                              style={{ padding: '4px 10px', background: '#FFFFFF', border: '1px solid #CBD5E1', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
                            >
                              Inspect ↗
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: LINKED EMAIL ACCOUNTS (With Multi-Step OTP Verification) */}
          {activeTab === 'accounts' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 16, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <h4 style={{ fontSize: 16, fontWeight: 800, color: '#0F172A', margin: 0 }}>Linked Email Accounts (Gmail & Outlook)</h4>
                      <span style={{
                        fontSize: 11,
                        fontWeight: 700,
                        padding: '2px 8px',
                        borderRadius: 9999,
                        background: currentUser.plan === 'free' ? '#F1F5F9' : '#F0FDF4',
                        color: currentUser.plan === 'free' ? '#64748B' : '#166534',
                        border: currentUser.plan === 'free' ? '1px solid #CBD5E1' : '1px solid #BBF7D0'
                      }}>
                        {1 + currentUser.aliases.length} of {currentUser.plan === 'free' ? '1 (Free Plan)' : '5 Inboxes'}
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: '#64748B', marginTop: 3 }}>
                      {currentUser.plan === 'free' 
                        ? 'Free tier includes 1 verified inbox. Upgrade to Professional to link up to 5 Gmail & Outlook accounts.'
                        : 'Share your Attest Pro human verification quota across multiple personal and work inboxes.'}
                    </div>
                  </div>

                  <button
                    onClick={handleStartAddAlias}
                    style={{
                      padding: '9px 16px',
                      background: currentUser.plan === 'free' ? '#0F172A' : '#004D40',
                      color: '#FFFFFF',
                      border: 'none',
                      borderRadius: 8,
                      fontSize: 12.5,
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      boxShadow: '0 2px 4px rgba(0,0,0,0.08)'
                    }}
                  >
                    <span>+ Link Inbox</span>
                    {currentUser.plan === 'free' && (
                      <span style={{ fontSize: 10, background: '#10B981', color: '#FFFFFF', padding: '1px 6px', borderRadius: 4, fontWeight: 800 }}>PRO</span>
                    )}
                  </button>
                </div>

                {/* MODAL / CARD: MULTI-STEP OTP VERIFICATION FLOW */}
                {isAddingAlias && (
                  <div style={{
                    background: '#F8FAFC',
                    border: '1.5px solid #007A5E',
                    borderRadius: 12,
                    padding: 20,
                    marginBottom: 20,
                    boxShadow: '0 4px 12px rgba(0, 122, 94, 0.08)'
                  }}>
                    {aliasStep === 'email' ? (
                      /* STEP 1: ENTER SECONDARY EMAIL */
                      <form onSubmit={handleRequestAliasOtp}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: '#0F172A', marginBottom: 4 }}>
                          Link Additional Email Inbox
                        </div>
                        <div style={{ fontSize: 12, color: '#64748B', marginBottom: 14 }}>
                          Enter the Outlook, work, or secondary Gmail address you want to link. A 6-digit one-time code (OTP) will be sent to verify ownership.
                        </div>

                        {aliasError && (
                          <div style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', color: '#DC2626', padding: '8px 12px', borderRadius: 6, fontSize: 12, marginBottom: 12 }}>
                            ⚠️ {aliasError}
                          </div>
                        )}

                        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                          <input
                            type="email"
                            required
                            placeholder="e.g. name@outlook.com or work@company.com"
                            value={newAliasEmail}
                            onChange={(e) => { setNewAliasEmail(e.target.value); setAliasError(''); }}
                            style={{
                              flex: 1,
                              minWidth: 260,
                              padding: '10px 14px',
                              border: '1px solid #CBD5E1',
                              borderRadius: 8,
                              fontSize: 13,
                              outline: 'none',
                              background: '#FFFFFF'
                            }}
                          />
                          <button
                            type="submit"
                            disabled={isLoadingAlias}
                            style={{
                              padding: '10px 18px',
                              background: '#007A5E',
                              color: '#FFFFFF',
                              border: 'none',
                              borderRadius: 8,
                              fontSize: 13,
                              fontWeight: 700,
                              cursor: isLoadingAlias ? 'not-allowed' : 'pointer',
                              opacity: isLoadingAlias ? 0.7 : 1
                            }}
                          >
                            {isLoadingAlias ? 'Sending Code...' : 'Send Verification Code ↗'}
                          </button>
                          <button
                            type="button"
                            onClick={() => { setIsAddingAlias(false); setAliasError(''); }}
                            style={{
                              padding: '10px 14px',
                              background: '#FFFFFF',
                              border: '1px solid #CBD5E1',
                              color: '#475569',
                              borderRadius: 8,
                              fontSize: 13,
                              fontWeight: 600,
                              cursor: 'pointer'
                            }}
                          >
                            Cancel
                          </button>
                        </div>
                      </form>
                    ) : (
                      /* STEP 2: ENTER 6-DIGIT OTP */
                      <form onSubmit={handleVerifyAndLinkAlias}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: '#0F172A', marginBottom: 4 }}>
                          Enter Verification Code (OTP)
                        </div>
                        <div style={{ fontSize: 12, color: '#475569', marginBottom: 14, lineHeight: 1.4 }}>
                          We sent a 6-digit verification code to <strong>{newAliasEmail}</strong>. Please check that inbox and enter the code below:
                        </div>

                        {aliasError && (
                          <div style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', color: '#DC2626', padding: '8px 12px', borderRadius: 6, fontSize: 12, marginBottom: 12 }}>
                            ⚠️ {aliasError}
                          </div>
                        )}

                        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: 14 }}>
                          <input
                            type="text"
                            maxLength={6}
                            required
                            placeholder="••••••"
                            value={aliasOtpInput}
                            onChange={(e) => { setAliasOtpInput(e.target.value); setAliasError(''); }}
                            style={{
                              width: 160,
                              padding: '10px 14px',
                              border: '2px solid #007A5E',
                              borderRadius: 8,
                              fontSize: 16,
                              fontWeight: 800,
                              letterSpacing: '6px',
                              textAlign: 'center',
                              background: '#FFFFFF',
                              outline: 'none'
                            }}
                          />
                          <button
                            type="submit"
                            disabled={isLoadingAlias}
                            style={{
                              padding: '10px 20px',
                              background: '#10B981',
                              color: '#FFFFFF',
                              border: 'none',
                              borderRadius: 8,
                              fontSize: 13,
                              fontWeight: 700,
                              cursor: isLoadingAlias ? 'not-allowed' : 'pointer',
                              opacity: isLoadingAlias ? 0.7 : 1
                            }}
                          >
                            {isLoadingAlias ? 'Verifying...' : '✓ Verify & Link Inbox'}
                          </button>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: 11.5, color: '#64748B' }}>
                          <button
                            type="button"
                            onClick={() => handleRequestAliasOtp()}
                            disabled={isLoadingAlias}
                            style={{ background: 'none', border: 'none', color: '#007A5E', fontWeight: 700, cursor: 'pointer', padding: 0, textDecoration: 'underline' }}
                          >
                            Resend Code
                          </button>
                          <span>•</span>
                          <button
                            type="button"
                            onClick={() => { setAliasStep('email'); setAliasOtpInput(''); setAliasError(''); }}
                            style={{ background: 'none', border: 'none', color: '#64748B', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}
                          >
                            Change Email
                          </button>
                          <span>•</span>
                          <button
                            type="button"
                            onClick={() => { setIsAddingAlias(false); setAliasError(''); }}
                            style={{ background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer', padding: 0 }}
                          >
                            Cancel
                          </button>
                        </div>
                      </form>
                    )}
                  </div>
                )}

                {/* INBOXES LIST */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {/* Primary Account */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 18px', background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#DCFCE7', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#166534', fontWeight: 800, fontSize: 14 }}>
                        {currentUser.email.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontSize: 13.5, fontWeight: 700, color: '#0F172A' }}>{currentUser.email}</div>
                        <div style={{ fontSize: 11, color: '#166534', fontWeight: 600 }}>Primary Verified Account • Default Attest Ledger</div>
                      </div>
                    </div>
                    <span style={{ fontSize: 10, fontWeight: 800, background: '#DCFCE7', color: '#166534', padding: '3px 10px', borderRadius: 9999, border: '1px solid #86EFAC' }}>
                      PRIMARY
                    </span>
                  </div>

                  {/* Linked Aliases */}
                  {currentUser.aliases.map(a => (
                    <div key={a} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 18px', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#475569', fontWeight: 800, fontSize: 14 }}>
                          {a.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontSize: 13.5, fontWeight: 700, color: '#0F172A' }}>{a}</div>
                          <div style={{ fontSize: 11, color: '#64748B' }}>
                            {a.includes('outlook') || a.includes('hotmail') || a.includes('office') ? 'Microsoft Outlook Inbox' : 'Secondary Gmail Inbox'} • Verified via OTP
                          </div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontSize: 10, fontWeight: 800, background: '#F1F5F9', color: '#475569', padding: '3px 8px', borderRadius: 6, border: '1px solid #E2E8F0' }}>
                          LINKED
                        </span>
                        <button
                          onClick={() => handleRemoveAlias(a)}
                          style={{
                            padding: '4px 10px',
                            background: '#FFFFFF',
                            border: '1px solid #FCA5A5',
                            color: '#DC2626',
                            borderRadius: 6,
                            fontSize: 11,
                            fontWeight: 600,
                            cursor: 'pointer'
                          }}
                        >
                          Unlink
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: PLAN DETAILS */}
          {activeTab === 'plan' && (
            <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 16, padding: 32 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16, marginBottom: 24 }}>
                <div>
                  <span style={{
                    background: currentUser.plan === 'professional' ? '#F0FDF4' : currentUser.plan === 'enterprise' ? '#FAF5FF' : '#F1F5F9',
                    color: currentUser.plan === 'professional' ? '#166534' : currentUser.plan === 'enterprise' ? '#9333EA' : '#475569',
                    padding: '4px 12px',
                    borderRadius: 9999,
                    fontSize: 11,
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    border: currentUser.plan === 'professional' ? '1px solid #BBF7D0' : currentUser.plan === 'enterprise' ? '1px solid #E9D5FF' : '1px solid #CBD5E1'
                  }}>
                    {currentUser.plan} Plan Active
                  </span>
                  <h3 style={{ fontSize: 24, fontWeight: 900, color: '#0F172A', marginTop: 12, marginBottom: 4 }}>
                    {currentUser.plan === 'professional' ? '$3.00 / month' : currentUser.plan === 'enterprise' ? 'Enterprise Custom License' : '$0.00 / month (Free)'}
                  </h3>
                  <p style={{ fontSize: 13, color: '#64748B', margin: 0 }}>
                    Plan Expiration / Renewal: <strong>{currentUser.planRenewal}</strong>
                  </p>
                </div>

                <Link
                  href="/pricing"
                  style={{
                    padding: '12px 24px',
                    background: '#007A5E',
                    color: '#FFFFFF',
                    borderRadius: 8,
                    fontSize: 13,
                    fontWeight: 700,
                    textDecoration: 'none',
                    display: 'inline-block'
                  }}
                >
                  Manage Subscription & Tier ↗
                </Link>
              </div>

              <div style={{ borderTop: '1px solid #F1F5F9', paddingTop: 20 }}>
                <h4 style={{ fontSize: 14, fontWeight: 700, color: '#0F172A', marginBottom: 12 }}>Included Tier Features:</h4>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 10, fontSize: 13, color: '#334155' }}>
                  <li>✓ {currentUser.dailyLimit === 'unlimited' ? 'Unlimited Daily Attestations & Stamps' : `${currentUser.dailyLimit} Daily Attestations`}</li>
                  <li>✓ {currentUser.plan === 'free' ? '1 Primary Inbox' : 'Up to 5 Linked Gmail & Outlook Inboxes'}</li>
                  <li>✓ SOC-2 Type II Cryptographic Audit Trail</li>
                  <li>✓ {currentUser.plan === 'free' ? 'Standard Verification' : 'Biometric FIDO2 / WebAuthn Sign-off'}</li>
                  <li>✓ Phishing Prevention & Unverified Email Warnings</li>
                </ul>
              </div>
            </div>
          )}

        </div>
      </main>

      {/* PLAN DETAILS MODAL (Opens on clicking "PROFESSIONAL" / Plan Badge in Header) */}
      {showPlanModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          background: 'rgba(15,23,42,0.6)',
          backdropFilter: 'blur(4px)',
          zIndex: 10000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 20
        }}>
          <div style={{
            background: '#FFFFFF',
            borderRadius: 16,
            width: '100%',
            maxWidth: 480,
            padding: '24px 28px',
            border: '1px solid #E2E8F0',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#007A5E" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/>
                  <line x1="1" y1="10" x2="23" y2="10"/>
                </svg>
                <h3 style={{ fontSize: 17, fontWeight: 800, color: '#0F172A', margin: 0 }}>Plan & Subscription Details</h3>
              </div>
              <button
                onClick={() => setShowPlanModal(false)}
                style={{ background: 'none', border: 'none', fontSize: 22, color: '#64748B', cursor: 'pointer', lineHeight: 1 }}
              >
                ×
              </button>
            </div>

            <div style={{ background: '#F8FAFC', borderRadius: 12, padding: 16, border: '1px solid #E2E8F0', marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: 12, color: '#64748B', fontWeight: 600 }}>CURRENT PLAN</span>
                <span style={{
                  fontSize: 11,
                  fontWeight: 800,
                  padding: '2px 8px',
                  borderRadius: 9999,
                  background: currentUser.plan === 'enterprise' ? '#FAF5FF' : currentUser.plan === 'professional' ? '#F0FDF4' : '#F1F5F9',
                  color: currentUser.plan === 'enterprise' ? '#9333EA' : currentUser.plan === 'professional' ? '#166534' : '#475569',
                  border: currentUser.plan === 'professional' ? '1px solid #BBF7D0' : currentUser.plan === 'enterprise' ? '1px solid #E9D5FF' : '1px solid #CBD5E1',
                  textTransform: 'uppercase'
                }}>
                  {currentUser.plan}
                </span>
              </div>
              
              <div style={{ fontSize: 22, fontWeight: 900, color: '#0F172A' }}>
                {currentUser.plan === 'professional' ? '$3.00 / month' : currentUser.plan === 'enterprise' ? 'Custom Enterprise Tier' : 'Free Tier ($0.00/mo)'}
              </div>

              <div style={{ fontSize: 12, color: '#475569', marginTop: 4 }}>
                Expires / Renews on: <strong>{currentUser.planRenewal}</strong>
              </div>
            </div>

            {/* Quota breakdown */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12.5, marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #F1F5F9', paddingBottom: 6 }}>
                <span style={{ color: '#64748B' }}>Daily Attestation Limit</span>
                <span style={{ fontWeight: 700, color: '#0F172A' }}>{currentUser.dailyLimit === 'unlimited' ? `Unlimited (${currentUser.dailyUsage} used today)` : `${currentUser.dailyLimit} per day (${currentUser.dailyUsage} used today)`}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #F1F5F9', paddingBottom: 6 }}>
                <span style={{ color: '#64748B' }}>Linked Inboxes Allowed</span>
                <span style={{ fontWeight: 700, color: '#0F172A' }}>{currentUser.plan === 'free' ? '1 Inbox (Primary)' : `Up to 5 Inboxes (${1 + currentUser.aliases.length} Active)`}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #F1F5F9', paddingBottom: 6 }}>
                <span style={{ color: '#64748B' }}>Cryptographic Ledger</span>
                <span style={{ fontWeight: 700, color: '#166534' }}>✓ Active & Synced</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748B' }}>Biometric Passkey Seal</span>
                <span style={{ fontWeight: 700, color: currentUser.plan === 'free' ? '#94A3B8' : '#166534' }}>
                  {currentUser.plan === 'free' ? 'Upgrade to Pro to Enable' : '✓ Enabled & Active'}
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <Link
                href="/pricing"
                onClick={() => setShowPlanModal(false)}
                style={{
                  flex: 1,
                  padding: '10px 14px',
                  background: '#007A5E',
                  color: '#FFFFFF',
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 700,
                  textAlign: 'center',
                  textDecoration: 'none'
                }}
              >
                Change or Upgrade Plan ↗
              </Link>
              <button
                onClick={() => setShowPlanModal(false)}
                style={{
                  padding: '10px 16px',
                  background: '#F1F5F9',
                  color: '#0F172A',
                  border: 'none',
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* INSPECT AUDIT MODAL */}
      {selectedLog && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(4px)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: '#FFFFFF', borderRadius: 16, width: '100%', maxWidth: 500, padding: 24, border: '1px solid #E2E8F0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0 }}>Audit Certificate</h3>
              <button onClick={() => setSelectedLog(null)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer' }}>×</button>
            </div>
            <div style={{ fontSize: 13, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div><strong>Subject:</strong> {selectedLog.subject}</div>
              <div><strong>Sender:</strong> {selectedLog.sender}</div>
              <div><strong>Recipient:</strong> {selectedLog.recipient}</div>
              <div><strong>Timestamp:</strong> {selectedLog.timestamp}</div>
              <div><strong>Proof:</strong> {selectedLog.securityProof}</div>
              <div><strong>SHA-256 Digest:</strong> <code style={{ wordBreak: 'break-all', display: 'block', background: '#F8FAFC', padding: 8, marginTop: 4, borderRadius: 4 }}>{selectedLog.hash}</code></div>
            </div>
            <button onClick={() => setSelectedLog(null)} style={{ marginTop: 20, width: '100%', padding: '10px', background: '#0F172A', color: '#FFFFFF', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer' }}>
              Close
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
