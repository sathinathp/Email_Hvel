'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

// API Base URL Detection (supports LAN IP and localhost)
const API_BASE = (typeof window !== 'undefined' && window.location?.hostname)
  ? (['localhost', '127.0.0.1'].includes(window.location.hostname) || window.location.hostname.startsWith('192.168.') || window.location.hostname.startsWith('10.') || window.location.hostname.endsWith('.local')
      ? `http://${window.location.hostname}:5000`
      : (process.env.NEXT_PUBLIC_BACKEND_URL || 'https://api.attest.page'))
  : (process.env.NEXT_PUBLIC_BACKEND_URL || 'https://api.attest.page');

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
  type: string;
  subject: string;
  sender: string;
  recipient: string;
  account: string;
  direction: 'incoming' | 'outgoing';
  timestamp: string;
  hash: string;
  securityProof: string;
  status: 'VERIFIED' | 'UNVERIFIED' | 'WARNING';
}

const ACCOUNT_FONT_COLORS = [
  '#059669', // Emerald Green (Primary)
  '#2563EB', // Blue
  '#7C3AED', // Purple
  '#D97706', // Warm Amber
  '#0284C7', // Sky Blue
  '#DC2626', // Crimson
  '#0D9488', // Teal
  '#4F46E5', // Indigo
];

function getAccountFontColor(accountEmail: string, primaryEmail: string = '', aliases: string[] = []): string {
  if (!accountEmail) return '#0F172A';
  const low = accountEmail.toLowerCase().trim();
  if (primaryEmail && low === primaryEmail.toLowerCase().trim()) {
    return '#059669'; // Emerald Green for Primary
  }
  const idx = aliases.findIndex(a => (a || '').toLowerCase().trim() === low);
  if (idx !== -1) {
    return ACCOUNT_FONT_COLORS[(idx + 1) % ACCOUNT_FONT_COLORS.length];
  }
  let hash = 0;
  for (let i = 0; i < low.length; i++) {
    hash = (hash << 5) - hash + low.charCodeAt(i);
  }
  return ACCOUNT_FONT_COLORS[Math.abs(hash) % ACCOUNT_FONT_COLORS.length];
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
  const [signupConfirmPassword, setSignupConfirmPassword] = useState('');
  const [showSignupConfirmPassword, setShowSignupConfirmPassword] = useState(false);
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [toastMessage, setToastMessage] = useState('');
  const [isToastVisible, setIsToastVisible] = useState(false);

  // Dashboard states once signed in
  const [activeTab, setActiveTab] = useState<'dashboard' | 'audit' | 'accounts' | 'plan'>('dashboard');
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [dbStats, setDbStats] = useState<{
    sent_verified: number;
    sent_unstamped: number;
    received_verified: number;
    received_unstamped: number;
  } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'sent_verified' | 'recv_verified' | 'recv_unstamped' | 'verified' | 'unstamped' | 'warning'>('all');
  const [accountFilter, setAccountFilter] = useState<string>('all');
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [isFilterMenuOpen, setIsFilterMenuOpen] = useState(false);

  // Audit Log Selection & Deletion State
  const [selectedLogIds, setSelectedLogIds] = useState<string[]>([]);
  const [isDeletingLogs, setIsDeletingLogs] = useState(false);
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState<'selected' | 'all' | null>(null);

  // Profile & Account Management Modal
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profileModalTab, setProfileModalTab] = useState<'profile' | 'password' | 'plan' | 'danger'>('profile');

  // Change Password Form State
  const [currentPasswordInput, setCurrentPasswordInput] = useState('');
  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [confirmPasswordInput, setConfirmPasswordInput] = useState('');
  const [showPasswordInputs, setShowPasswordInputs] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [changePasswordError, setChangePasswordError] = useState('');
  const [changePasswordSuccess, setChangePasswordSuccess] = useState('');

  // Delete Account Form State
  const [deleteConfirmInput, setDeleteConfirmInput] = useState('');
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [deleteAccountError, setDeleteAccountError] = useState('');

  // Interactive Guide & Animation States
  const [guideTab, setGuideTab] = useState<'simulator' | 'video' | 'setup'>('simulator');
  const [simStep, setSimStep] = useState<number>(0);
  const [simScenario, setSimScenario] = useState<'verified' | 'phishing'>('verified');
  const [isSimPlaying, setIsSimPlaying] = useState<boolean>(true);
  const [activeSignalStage, setActiveSignalStage] = useState<number | null>(null);

  // Alias form
  const [isAddingAlias, setIsAddingAlias] = useState(false);
  const [aliasStep, setAliasStep] = useState<'email' | 'otp'>('email');
  const [newAliasEmail, setNewAliasEmail] = useState('');
  const [aliasOtpInput, setAliasOtpInput] = useState('');
  const [isLoadingAlias, setIsLoadingAlias] = useState(false);
  const [aliasError, setAliasError] = useState('');

  // Linked Inboxes Table Search & Filter State
  const [inboxSearchQuery, setInboxSearchQuery] = useState('');
  const [inboxStatusFilter, setInboxStatusFilter] = useState<'all' | 'active' | 'issue'>('all');
  const [openInboxMenuId, setOpenInboxMenuId] = useState<string | null>(null);

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setIsToastVisible(true);
    setTimeout(() => setIsToastVisible(false), 3500);
  };

  // Synchronized slow verification transmission signal loop (8.4s duration)
  useEffect(() => {
    let animationFrameId: number;
    const DURATION = 8400;
    const startTime = performance.now();

    const checkFrame = (now: number) => {
      const elapsed = (now - startTime) % DURATION;
      const progress = elapsed / DURATION;

      if (progress >= 0.09 && progress <= 0.22) {
        setActiveSignalStage(0);
      } else if (progress >= 0.34 && progress <= 0.47) {
        setActiveSignalStage(1);
      } else if (progress >= 0.59 && progress <= 0.72) {
        setActiveSignalStage(2);
      } else if (progress >= 0.84 && progress <= 0.97) {
        setActiveSignalStage(3);
      } else {
        setActiveSignalStage(null);
      }

      animationFrameId = requestAnimationFrame(checkFrame);
    };

    animationFrameId = requestAnimationFrame(checkFrame);
    return () => cancelAnimationFrame(animationFrameId);
  }, []);

  // Fetch real data directly from backend PostgreSQL database
  const fetchUserData = useCallback(async (email: string, token?: string) => {
    const bearer = token || authToken || (typeof window !== 'undefined' ? localStorage.getItem('hvel_token') : null);
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-User-Email': email.toLowerCase()
    };
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

      // 2. Fetch Real Aliases first to have full list of accounts for mapping logs
      const aliasRes = await fetch(`${API_BASE}/api/aliases`, { headers }).catch(() => null);
      let aliasesList: string[] = [];
      if (aliasRes && aliasRes.ok) {
        const aliasData = await aliasRes.json();
        if (Array.isArray(aliasData.aliases)) {
          aliasesList = aliasData.aliases;
        }
      }

      // 3. Fetch Real Audit Logs & Stats from PostgreSQL `audit_logs` table
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
          // Deduplicate logs if any duplicates exist in data
          const seenKeys = new Set<string>();
          const uniqueLogs: any[] = [];

          for (const l of auditData.logs) {
            const extra = l.extra || l.metadata || {};
            const dedupeKey = extra.verificationId
              ? `v_${extra.verificationId}`
              : (extra.contentHash
                ? `h_${l.type}_${extra.contentHash}`
                : `${l.type}_${(l.email || '').toLowerCase()}_${extra.subject || ''}_${Math.floor((l.timestamp || 0) / 30000)}`);

            if (!seenKeys.has(dedupeKey)) {
              seenKeys.add(dedupeKey);
              uniqueLogs.push(l);
            }
          }

          const allUserAccounts = [email.toLowerCase(), ...aliasesList.map(a => a.toLowerCase())];
          const outlookAccounts = allUserAccounts.filter(a => !a.endsWith('@gmail.com') && !a.endsWith('@googlemail.com'));
          const gmailAccounts = allUserAccounts.filter(a => a.endsWith('@gmail.com') || a.endsWith('@googlemail.com'));

          const mappedLogs: AuditLog[] = uniqueLogs.map((l: any, idx: number) => {
            const extra = l.extra || l.metadata || {};
            const typeStr = (l.type || '').toLowerCase();
            const isSent = typeStr.startsWith('sent');
            const isUnstamped = typeStr.includes('unstamped') || typeStr.includes('unverified');
            const isWarning = typeStr.includes('warning') || typeStr.includes('alert') || typeStr.includes('tampered');
            const isVerified = !isUnstamped && !isWarning && (typeStr.includes('stamped') || typeStr.includes('verified'));

            const status = isVerified ? 'VERIFIED' : (isWarning ? 'WARNING' : 'UNVERIFIED');
            const defaultSubject = isSent
              ? (isVerified ? 'Outgoing Attested Communication' : 'Outgoing Standard Email')
              : (isVerified ? 'Incoming Verified Communication' : (isWarning ? 'Incoming Suspicious Communication' : 'Incoming Standard Email'));

            const isOutlookEvent = extra.provider === 'outlook' || extra.siteType === 'outlook' || extra.client === 'outlook' || l.provider === 'outlook' || typeStr.includes('outlook');

            // Identify which user inbox/account received or sent this email
            let accountEmail = email.toLowerCase();

            if (isOutlookEvent && outlookAccounts.length > 0) {
              if (extra.account && outlookAccounts.includes(extra.account.toLowerCase())) {
                accountEmail = extra.account.toLowerCase();
              } else if (isSent && extra.sender && outlookAccounts.includes(extra.sender.toLowerCase())) {
                accountEmail = extra.sender.toLowerCase();
              } else if (!isSent && extra.recipient && outlookAccounts.includes(extra.recipient.toLowerCase())) {
                accountEmail = extra.recipient.toLowerCase();
              } else if (l.userEmail && outlookAccounts.includes(l.userEmail.toLowerCase())) {
                accountEmail = l.userEmail.toLowerCase();
              } else {
                accountEmail = outlookAccounts[0];
              }
            } else if (extra.account && allUserAccounts.includes(extra.account.toLowerCase())) {
              accountEmail = extra.account.toLowerCase();
            } else if (isSent && extra.sender && allUserAccounts.includes(extra.sender.toLowerCase())) {
              accountEmail = extra.sender.toLowerCase();
            } else if (!isSent && extra.recipient && allUserAccounts.includes(extra.recipient.toLowerCase())) {
              accountEmail = extra.recipient.toLowerCase();
            } else if (extra.sender && allUserAccounts.includes(extra.sender.toLowerCase())) {
              accountEmail = extra.sender.toLowerCase();
            } else if (extra.recipient && allUserAccounts.includes(extra.recipient.toLowerCase())) {
              accountEmail = extra.recipient.toLowerCase();
            } else if (l.email && allUserAccounts.includes(l.email.toLowerCase())) {
              accountEmail = l.email.toLowerCase();
            } else if (l.userEmail && allUserAccounts.includes(l.userEmail.toLowerCase())) {
              accountEmail = l.userEmail.toLowerCase();
            } else if (l.user_email && allUserAccounts.includes(l.user_email.toLowerCase())) {
              accountEmail = l.user_email.toLowerCase();
            }

            const sender = isSent ? (extra.sender || accountEmail) : (extra.sender || l.email || 'sender@domain.com');
            const recipient = isSent ? (extra.recipient || l.email || 'recipient@domain.com') : (extra.recipient || accountEmail);

            const rawTime = extra.emailTimestamp || extra.timestamp || extra.date || l.timestamp;
            let formattedTime = 'Recent';
            if (rawTime) {
              const d = new Date(rawTime);
              if (!isNaN(d.getTime())) {
                formattedTime = d.toLocaleString(undefined, {
                  year: 'numeric',
                  month: 'numeric',
                  day: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                  second: '2-digit',
                  hour12: true
                });
              } else {
                formattedTime = String(rawTime);
              }
            }

            return {
              id: l.id ? `log_${l.id}` : `log_${idx}_${l.timestamp || Date.now()}`,
              type: l.type,
              subject: defaultSubject,
              sender,
              recipient,
              account: accountEmail,
              direction: isSent ? 'outgoing' : 'incoming',
              timestamp: formattedTime,
              hash: extra.contentHash || extra.hash || (extra.totp ? `TOTP-SHA256-${extra.totp}` : '—'),
              securityProof: extra.proof || (isVerified ? 'Level 3 · Cryptographic Human Verification' : (isWarning ? 'Security Warning · Suspicious' : 'Standard Unsigned Message')),
              status
            };
          });
          setAuditLogs(mappedLogs);
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
          } catch { }
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
      const linkedAlias = urlParams.get('linkedAlias');

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
          plan: 'free',
          planRenewal: 'Free Tier',
          dailyUsage: 0,
          dailyLimit: 3,
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
        if (linkedAlias) {
          triggerToast(`Signed in via linked alias (${linkedAlias}) → Primary Account: ${callbackEmail}`);
        } else {
          triggerToast(`Signed in successfully with ${callbackProvider === 'google' ? 'Google' : 'Microsoft'}!`);
        }
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

    if (authMode === 'signup') {
      if (!signupConfirmPassword) {
        triggerToast('Please type password again to confirm.');
        return;
      }
      if (passwordInput !== signupConfirmPassword) {
        triggerToast('Passwords do not match. Please verify your password.');
        return;
      }
    }

    setIsLoadingAuth(true);

    try {
      const endpoint = authMode === 'signin' ? '/api/auth/login' : '/api/auth/signup';
      const res = await fetch(`${API_BASE}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail, password: passwordInput })
      }).catch(() => null);

      if (!res) {
        triggerToast('Unable to connect to authentication server.');
        setIsLoadingAuth(false);
        return;
      }

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        triggerToast(errorData.message || (authMode === 'signup' ? 'Failed to create account.' : 'Invalid email or password.'));
        setIsLoadingAuth(false);
        return;
      }

      const data = await res.json();
      const token = data.token || 'local_session_' + Math.random().toString(36).substring(2, 10);
      const plan: 'free' | 'professional' | 'enterprise' = data.plan || 'free';
      const planExpiry: string | null = data.plan_expires_at || null;
      const actualEmail: string = data.email || cleanEmail;

      if (data.linkedAliasUsed) {
        triggerToast(`Signed in via linked alias (${data.linkedAliasUsed}) → Primary Account: ${actualEmail}`);
      } else {
        triggerToast(authMode === 'signin' ? 'Signed in successfully!' : 'Account registered successfully!');
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
          'Authorization': `Bearer ${bearer}`,
          'X-User-Email': currentUser.email.toLowerCase()
        },
        body: JSON.stringify({ aliasEmail: email, primaryEmail: currentUser.email.toLowerCase() })
      });
      let data: any = {};
      try {
        data = await res.json();
      } catch {
        data = { error: 'SERVER_RESPONSE_ERROR', message: `Server error (${res.status}). Please verify backend service.` };
      }

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
          'Authorization': `Bearer ${bearer}`,
          'X-User-Email': currentUser.email.toLowerCase()
        },
        body: JSON.stringify({ aliasEmail: email, otp, primaryEmail: currentUser.email.toLowerCase() })
      });
      let data: any = {};
      try {
        data = await res.json();
      } catch {
        data = { error: 'SERVER_RESPONSE_ERROR', message: `Server error (${res.status}). Please verify backend service.` };
      }

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
          'Authorization': `Bearer ${bearer}`,
          'X-User-Email': currentUser.email.toLowerCase()
        },
        body: JSON.stringify({ aliasEmail: alias, primaryEmail: currentUser.email.toLowerCase() })
      });
    } catch { }

    const updated: UserProfile = {
      ...currentUser,
      aliases: currentUser.aliases.filter(a => a.toLowerCase() !== alias.toLowerCase())
    };
    setCurrentUser(updated);
    localStorage.setItem('hvel_portal_user', JSON.stringify(updated));
    triggerToast(`Removed linked alias: ${alias}`);
  };

  // Toggle select all logs in current displayed view
  const handleToggleSelectAllLogs = () => {
    const targetLogs = activeTab === 'dashboard' ? filteredLogs.slice(0, 5) : filteredLogs;
    if (targetLogs.length === 0) return;
    const allTargetIds = targetLogs.map(l => l.id);
    const areAllSelected = allTargetIds.every(id => selectedLogIds.includes(id));

    if (areAllSelected) {
      setSelectedLogIds(prev => prev.filter(id => !allTargetIds.includes(id)));
    } else {
      setSelectedLogIds(prev => Array.from(new Set([...prev, ...allTargetIds])));
    }
  };

  // Toggle select single log
  const handleToggleSelectLog = (id: string) => {
    setSelectedLogIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  // Execute deletion of audit logs directly from our database
  const executeDeleteLogs = async (type: 'selected' | 'all') => {
    if (!currentUser) return;
    setIsDeletingLogs(true);

    try {
      const bearer = authToken || (typeof window !== 'undefined' ? localStorage.getItem('hvel_token') : null);
      const payload = type === 'all'
        ? { all: true }
        : { ids: selectedLogIds };

      const res = await fetch(`${API_BASE}/api/audit-logs/delete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${bearer}`,
          'X-User-Email': currentUser.email.toLowerCase()
        },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        if (type === 'all') {
          setAuditLogs([]);
          setSelectedLogIds([]);
          setDbStats({
            sent_verified: 0,
            sent_unstamped: 0,
            received_verified: 0,
            received_unstamped: 0
          });
          triggerToast('All audit logs have been deleted from the database.');
        } else {
          setAuditLogs(prev => prev.filter(l => !selectedLogIds.includes(l.id)));
          triggerToast(`${selectedLogIds.length} audit logs deleted from database.`);
          setSelectedLogIds([]);
        }
      } else {
        const data = await res.json().catch(() => ({}));
        triggerToast(data.message || 'Failed to delete audit logs.');
      }
    } catch (err: any) {
      console.error('[Delete Logs Error]', err);
      triggerToast('Error connecting to database to delete logs.');
    } finally {
      setIsDeletingLogs(false);
      setShowDeleteConfirmModal(null);
    }
  };

  // Handle Change Password directly in Database
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    setChangePasswordError('');
    setChangePasswordSuccess('');

    if (!currentPasswordInput) {
      setChangePasswordError('Please enter your current password.');
      return;
    }
    if (newPasswordInput.length < 8) {
      setChangePasswordError('New password must be at least 8 characters long.');
      return;
    }
    if (newPasswordInput !== confirmPasswordInput) {
      setChangePasswordError('New password and confirmation password do not match.');
      return;
    }

    setIsChangingPassword(true);
    try {
      const bearer = authToken || (typeof window !== 'undefined' ? localStorage.getItem('hvel_token') : null);
      const res = await fetch(`${API_BASE}/api/auth/change-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${bearer}`,
          'X-User-Email': currentUser.email.toLowerCase()
        },
        body: JSON.stringify({
          currentPassword: currentPasswordInput,
          newPassword: newPasswordInput
        })
      });

      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        setChangePasswordSuccess('Password updated successfully in database!');
        setCurrentPasswordInput('');
        setNewPasswordInput('');
        setConfirmPasswordInput('');
        triggerToast('Password successfully updated!');
      } else {
        setChangePasswordError(data.message || data.error || 'Failed to update password.');
      }
    } catch (err: any) {
      setChangePasswordError(err.message || 'Server connection error.');
    } finally {
      setIsChangingPassword(false);
    }
  };

  // Handle Permanent Account Deletion from PostgreSQL Database
  const handleDeleteAccount = async () => {
    if (!currentUser) return;
    setDeleteAccountError('');

    const confirmTarget = currentUser.email.toLowerCase();
    const inputVal = deleteConfirmInput.trim().toLowerCase();
    if (inputVal !== confirmTarget && inputVal !== 'delete') {
      setDeleteAccountError(`Please type "${currentUser.email}" or "DELETE" to confirm.`);
      return;
    }

    setIsDeletingAccount(true);
    try {
      const bearer = authToken || (typeof window !== 'undefined' ? localStorage.getItem('hvel_token') : null);
      const res = await fetch(`${API_BASE}/api/user/delete-account`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${bearer}`,
          'X-User-Email': currentUser.email.toLowerCase()
        },
        body: JSON.stringify({ email: currentUser.email.toLowerCase() })
      });

      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        localStorage.removeItem('hvel_portal_user');
        localStorage.removeItem('hvel_token');
        setCurrentUser(null);
        setAuthToken(null);
        setAuditLogs([]);
        setShowProfileModal(false);
        triggerToast('Your account and all associated database records have been permanently deleted.');
      } else {
        setDeleteAccountError(data.message || data.error || 'Failed to delete account.');
      }
    } catch (err: any) {
      setDeleteAccountError(err.message || 'Failed to connect to database.');
    } finally {
      setIsDeletingAccount(false);
    }
  };

  // Real Metric Calculations for the 4 Blocks (Computed directly from our database)
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
      log.account.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.hash.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;
    if (statusFilter === 'sent_verified') {
      const isSent = log.direction === 'outgoing' || log.type === 'sent_stamped' || log.type === 'sent_stamped_link' || log.type === 'sent_stamped_hash';
      const isVer = log.status === 'VERIFIED';
      if (!(isSent && isVer)) return false;
    }
    if (statusFilter === 'recv_verified') {
      const isRecv = log.direction === 'incoming' || log.type === 'recv_verified' || log.type === 'received_stamped';
      const isVer = log.status === 'VERIFIED';
      if (!(isRecv && isVer)) return false;
    }
    if (statusFilter === 'recv_unstamped') {
      const isRecv = log.direction === 'incoming' || log.type === 'recv_unverified' || log.type === 'received_unstamped';
      const isUnstamped = log.status === 'UNVERIFIED' || log.status === 'WARNING' || log.type === 'recv_unverified' || log.type === 'received_unstamped';
      if (!(isRecv && isUnstamped)) return false;
    }
    if (statusFilter === 'verified' && log.status !== 'VERIFIED') return false;
    if (statusFilter === 'unstamped' && !(log.status === 'UNVERIFIED' || log.type === 'sent_unstamped' || log.type === 'received_unstamped' || log.type === 'recv_unverified')) return false;
    if (statusFilter === 'warning' && log.status !== 'WARNING') return false;
    if (accountFilter !== 'all' && log.account.toLowerCase() !== accountFilter.toLowerCase()) return false;
    return true;
  });

  // Display only 5 recent logs on Dashboard tab, full logs on Audit Logs tab
  const displayedLogs = activeTab === 'dashboard' ? filteredLogs.slice(0, 5) : filteredLogs;

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

                {authMode === 'signup' && (
                  <div>
                    <label style={{ fontSize: 11.5, fontWeight: 600, color: '#334155', display: 'block', marginBottom: 4 }}>
                      Confirm password
                    </label>
                    <div style={{ position: 'relative' }}>
                      <span style={{ position: 'absolute', left: 12, top: 9, color: '#94A3B8', fontSize: 14 }}>🔒</span>
                      <input
                        type={showSignupConfirmPassword ? 'text' : 'password'}
                        placeholder="Type password again"
                        value={signupConfirmPassword}
                        onChange={(e) => setSignupConfirmPassword(e.target.value)}
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
                        onClick={() => setShowSignupConfirmPassword(!showSignupConfirmPassword)}
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
                        {showSignupConfirmPassword ? '🙈' : '👁️'}
                      </button>
                    </div>
                  </div>
                )}

                {authMode === 'signin' && (
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: -2 }}>
                    <Link
                      href="/forgot-password"
                      style={{ textDecoration: 'none', fontSize: 11.5, color: '#007A5E', fontWeight: 600, cursor: 'pointer', padding: 0 }}
                    >
                      Forgot password?
                    </Link>
                  </div>
                )}

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
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
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
                    <path fill="#f35325" d="M1 1h10v10H1z" />
                    <path fill="#81bc06" d="M12 1h10v10H12z" />
                    <path fill="#05a6f0" d="M1 12h10v10H1z" />
                    <path fill="#ffba08" d="M12 12h10v12H12z" />
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
                      onClick={() => {
                        setAuthMode('signup');
                        setPasswordInput('');
                        setSignupConfirmPassword('');
                      }}
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
                      onClick={() => {
                        setAuthMode('signin');
                        setPasswordInput('');
                        setSignupConfirmPassword('');
                      }}
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

      {/* Keyframe Animations */}
      <style>{`
        @keyframes pulseDot {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.3); opacity: 0.6; }
        }
        @keyframes flowBeam {
          0% { stroke-dashoffset: 24; }
          100% { stroke-dashoffset: 0; }
        }
        @keyframes sparkleTwinkle {
          0%, 100% { opacity: 0.25; transform: scale(0.85); }
          50% { opacity: 0.95; transform: scale(1.3); }
        }
        @keyframes nodePulse1 {
          0%, 12%, 92%, 100% {
            box-shadow: 0 0 0 7px rgba(16, 185, 129, 0.22), 0 0 24px rgba(16, 185, 129, 0.35);
            border-color: #10B981;
            transform: scale(1.04);
          }
          18%, 88% {
            box-shadow: 0 3px 12px rgba(0, 122, 94, 0.08);
            border-color: #BBF7D0;
            transform: scale(1);
          }
        }
        @keyframes nodePulse2 {
          20%, 35% {
            box-shadow: 0 0 0 7px rgba(16, 185, 129, 0.22), 0 0 24px rgba(16, 185, 129, 0.35);
            border-color: #10B981;
            transform: scale(1.04);
          }
          0%, 14%, 42%, 100% {
            box-shadow: 0 3px 12px rgba(0, 122, 94, 0.08);
            border-color: #BBF7D0;
            transform: scale(1);
          }
        }
        @keyframes nodePulse3 {
          44%, 60% {
            box-shadow: 0 0 0 7px rgba(16, 185, 129, 0.22), 0 0 24px rgba(16, 185, 129, 0.35);
            border-color: #10B981;
            transform: scale(1.04);
          }
          0%, 38%, 68%, 100% {
            box-shadow: 0 3px 12px rgba(0, 122, 94, 0.08);
            border-color: #BBF7D0;
            transform: scale(1);
          }
        }
        @keyframes nodePulse4 {
          69%, 85% {
            box-shadow: 0 0 0 7px rgba(16, 185, 129, 0.22), 0 0 24px rgba(16, 185, 129, 0.35);
            border-color: #10B981;
            transform: scale(1.04);
          }
          0%, 63%, 92%, 100% {
            box-shadow: 0 3px 12px rgba(0, 122, 94, 0.08);
            border-color: #BBF7D0;
            transform: scale(1);
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .anim-signal {
            animation: none !important;
          }
          .anim-pulse-node {
            animation: none !important;
            box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.2) !important;
          }
        }
      `}</style>

      {/* Standalone Portal Top Header with Integrated Nav Bar */}
      <header style={{
        background: '#FFFFFF',
        borderBottom: '1px solid #E2E8F0',
        padding: '10px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'sticky',
        top: 0,
        zIndex: 50,
        boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
      }}>
        {/* Brand */}
        <div
          onClick={() => setActiveTab('dashboard')}
          style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', userSelect: 'none' }}
        >
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

        {/* Center: Top Navigation Bar Tabs (Open Type) */}
        <nav style={{
          display: 'flex',
          alignItems: 'center',
          gap: 24
        }}>
          {/* Dashboard Tab */}
          <button
            onClick={() => setActiveTab('dashboard')}
            style={{
              padding: '10px 4px',
              background: 'transparent',
              border: 'none',
              borderBottom: activeTab === 'dashboard' ? '2.5px solid #007A5E' : '2.5px solid transparent',
              color: activeTab === 'dashboard' ? '#007A5E' : '#64748B',
              fontSize: 13.5,
              fontWeight: activeTab === 'dashboard' ? 700 : 500,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 7,
              transition: 'all 0.15s ease'
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="7" />
              <rect x="14" y="3" width="7" height="7" />
              <rect x="14" y="14" width="7" height="7" />
              <rect x="3" y="14" width="7" height="7" />
            </svg>
            <span>Dashboard</span>
          </button>

          {/* Audit Logs Tab */}
          <button
            onClick={() => setActiveTab('audit')}
            style={{
              padding: '10px 4px',
              background: 'transparent',
              border: 'none',
              borderBottom: activeTab === 'audit' ? '2.5px solid #007A5E' : '2.5px solid transparent',
              color: activeTab === 'audit' ? '#007A5E' : '#64748B',
              fontSize: 13.5,
              fontWeight: activeTab === 'audit' ? 700 : 500,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 7,
              transition: 'all 0.15s ease'
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
            </svg>
            <span>Audit Logs</span>
            <span style={{
              fontSize: 10.5,
              padding: '1px 6px',
              borderRadius: 9999,
              background: activeTab === 'audit' ? '#DCFCE7' : '#F1F5F9',
              color: activeTab === 'audit' ? '#166534' : '#64748B',
              fontWeight: 700
            }}>
              {auditLogs.length}
            </span>
          </button>

          {/* Linked Email Inboxes Tab */}
          <button
            onClick={() => setActiveTab('accounts')}
            style={{
              padding: '10px 4px',
              background: 'transparent',
              border: 'none',
              borderBottom: activeTab === 'accounts' ? '2.5px solid #007A5E' : '2.5px solid transparent',
              color: activeTab === 'accounts' ? '#007A5E' : '#64748B',
              fontSize: 13.5,
              fontWeight: activeTab === 'accounts' ? 700 : 500,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 7,
              transition: 'all 0.15s ease'
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
              <polyline points="22,6 12,13 2,6" />
            </svg>
            <span>Linked Email Inboxes</span>
            <span style={{
              fontSize: 10.5,
              padding: '1px 6px',
              borderRadius: 9999,
              background: activeTab === 'accounts' ? '#DCFCE7' : '#F1F5F9',
              color: activeTab === 'accounts' ? '#166534' : '#64748B',
              fontWeight: 700
            }}>
              {1 + currentUser.aliases.length}
            </span>
          </button>

          {/* Plan & Billing Details Tab */}
          <button
            onClick={() => setActiveTab('plan')}
            style={{
              padding: '10px 4px',
              background: 'transparent',
              border: 'none',
              borderBottom: activeTab === 'plan' ? '2.5px solid #007A5E' : '2.5px solid transparent',
              color: activeTab === 'plan' ? '#007A5E' : '#64748B',
              fontSize: 13.5,
              fontWeight: activeTab === 'plan' ? 700 : 500,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 7,
              transition: 'all 0.15s ease'
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
              <line x1="1" y1="10" x2="23" y2="10" />
            </svg>
            <span>Plan & Billing Details</span>
          </button>
        </nav>

        {/* User Identity, Plan Click Badge & Logout */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          {/* Clickable Profile & Plan Pill */}
          <div
            onClick={() => { setProfileModalTab('profile'); setShowProfileModal(true); }}
            title="Click to view profile, change password, or manage account"
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
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="16" x2="12" y2="12" />
                <line x1="12" y1="8" x2="12.01" y2="8" />
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
      <main style={{ flex: 1, padding: '24px 0 60px 0' }}>
        <div style={{ width: '100%', maxWidth: 1200, margin: '0 auto', padding: '0 24px' }}>

          {/* ==================================================== */}
          {/* TAB 0 & 1: DASHBOARD & AUDIT LOGS (3 Metric Blocks + Live Audit Trail) */}
          {/* ==================================================== */}
          {(activeTab === 'dashboard' || activeTab === 'audit') && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

              {/* 3 TOP METRIC BLOCKS */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                gap: 16
              }}>
                {/* Block 1: Sent Verified */}
                <div
                  onClick={() => {
                    setStatusFilter(statusFilter === 'sent_verified' ? 'all' : 'sent_verified');
                  }}
                  style={{
                    background: '#FFFFFF',
                    border: statusFilter === 'sent_verified' ? '2px solid #166534' : '1px solid #E2E8F0',
                    borderRadius: 12,
                    padding: '18px 22px',
                    boxShadow: statusFilter === 'sent_verified' ? '0 0 0 3px rgba(22, 101, 52, 0.15)' : '0 1px 3px rgba(0,0,0,0.02)',
                    cursor: 'pointer',
                    transition: 'transform 0.15s ease, box-shadow 0.15s ease'
                  }}
                  title="Click to filter by Sent Verified events in Audit Logs"
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#166534', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Send Verified
                    </span>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#166534" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                      <polyline points="9 12 11.5 14.5 15.5 9.5" />
                    </svg>
                  </div>
                  <div style={{ fontSize: 28, fontWeight: 900, color: '#0F172A', marginTop: 6 }}>
                    {countSentVerified}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 }}>
                    <span style={{ fontSize: 11, color: '#166534', fontWeight: 600 }}>
                      Cryptographically Sealed Outgoing
                    </span>
                    <span style={{ fontSize: 10.5, color: '#007A5E', fontWeight: 700 }}>
                      {statusFilter === 'sent_verified' ? '● Active Filter' : 'Filter →'}
                    </span>
                  </div>
                </div>

                {/* Block 2: Received Verified */}
                <div
                  onClick={() => {
                    setStatusFilter(statusFilter === 'recv_verified' ? 'all' : 'recv_verified');
                  }}
                  style={{
                    background: '#FFFFFF',
                    border: statusFilter === 'recv_verified' ? '2px solid #007A5E' : '1px solid #E2E8F0',
                    borderRadius: 12,
                    padding: '18px 22px',
                    boxShadow: statusFilter === 'recv_verified' ? '0 0 0 3px rgba(0, 122, 94, 0.15)' : '0 1px 3px rgba(0,0,0,0.02)',
                    cursor: 'pointer',
                    transition: 'transform 0.15s ease, box-shadow 0.15s ease'
                  }}
                  title="Click to filter by Received Verified events in Audit Logs"
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#007A5E', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Received Verified
                    </span>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#007A5E" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
                      <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
                      <polyline points="10 9 12 11 15 8" />
                    </svg>
                  </div>
                  <div style={{ fontSize: 28, fontWeight: 900, color: '#0F172A', marginTop: 6 }}>
                    {countReceivedVerified}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 }}>
                    <span style={{ fontSize: 11, color: '#007A5E', fontWeight: 600 }}>
                      Valid Human Senders Verified
                    </span>
                    <span style={{ fontSize: 10.5, color: '#007A5E', fontWeight: 700 }}>
                      {statusFilter === 'recv_verified' ? '● Active Filter' : 'Filter →'}
                    </span>
                  </div>
                </div>

                {/* Block 3: Received Unstamped */}
                <div
                  onClick={() => {
                    setStatusFilter(statusFilter === 'recv_unstamped' ? 'all' : 'recv_unstamped');
                  }}
                  style={{
                    background: '#FFFFFF',
                    border: statusFilter === 'recv_unstamped' ? '2px solid #B45309' : '1px solid #E2E8F0',
                    borderRadius: 12,
                    padding: '18px 22px',
                    boxShadow: statusFilter === 'recv_unstamped' ? '0 0 0 3px rgba(180, 83, 9, 0.15)' : '0 1px 3px rgba(0,0,0,0.02)',
                    cursor: 'pointer',
                    transition: 'transform 0.15s ease, box-shadow 0.15s ease'
                  }}
                  title="Click to filter by Received Unstamped / Risk events in Audit Logs"
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#B45309', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Received Unstamped
                    </span>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#B45309" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                      <line x1="12" y1="9" x2="12" y2="13" />
                      <line x1="12" y1="17" x2="12.01" y2="17" />
                    </svg>
                  </div>
                  <div style={{ fontSize: 28, fontWeight: 900, color: '#0F172A', marginTop: 6 }}>
                    {countReceivedUnstamped}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 }}>
                    <span style={{ fontSize: 11, color: '#B45309', fontWeight: 600 }}>
                      Unverified / Potential Phishing Risk
                    </span>
                    <span style={{ fontSize: 10.5, color: '#B45309', fontWeight: 700 }}>
                      {statusFilter === 'recv_unstamped' ? '● Active Filter' : 'Filter →'}
                    </span>
                  </div>
                </div>
              </div>

              {/* LIVE AUDIT VERIFICATION TRAIL TABLE */}
              <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 16, padding: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14, marginBottom: 20 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <h3 style={{ fontSize: 17, fontWeight: 800, color: '#0F172A', margin: 0 }}>
                      {activeTab === 'dashboard' ? 'Recent Audit Verification Trail' : 'Audit Verification Trail'}
                    </h3>
                    <span style={{ fontSize: 12, fontWeight: 700, padding: '2px 8px', borderRadius: 9999, background: '#F1F5F9', color: '#475569' }}>
                      {activeTab === 'dashboard' ? `Showing ${Math.min(5, filteredLogs.length)} of ${filteredLogs.length} Records` : `${filteredLogs.length} Records`}
                    </span>
                    {statusFilter !== 'all' && (
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '3px 10px',
                        borderRadius: 9999,
                        fontSize: 11,
                        fontWeight: 700,
                        background: statusFilter === 'sent_verified' || statusFilter === 'recv_verified' || statusFilter === 'verified' ? '#ECFDF5' : '#FEF2F2',
                        color: statusFilter === 'sent_verified' || statusFilter === 'recv_verified' || statusFilter === 'verified' ? '#065F46' : '#991B1B',
                        border: statusFilter === 'sent_verified' || statusFilter === 'recv_verified' || statusFilter === 'verified' ? '1px solid #A7F3D0' : '1px solid #FECACA'
                      }}>
                        <span>Filter: {
                          statusFilter === 'sent_verified' ? 'Send Verified Only' :
                          statusFilter === 'recv_verified' ? 'Received Verified Only' :
                          statusFilter === 'recv_unstamped' ? 'Received Unstamped Only' :
                          statusFilter === 'verified' ? 'All Verified' :
                          statusFilter === 'unstamped' ? 'All Unstamped' : 'Flagged Alerts'
                        }</span>
                        <button
                          onClick={() => setStatusFilter('all')}
                          title="Clear filter and show all logs"
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'inherit',
                            fontWeight: 900,
                            cursor: 'pointer',
                            fontSize: 12,
                            padding: 0,
                            display: 'inline-flex',
                            alignItems: 'center',
                            marginLeft: 2
                          }}
                        >
                          ✕
                        </button>
                      </span>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                  {/* Single Clear Selected Logs Button (Hidden by default, shown only when items are selected) */}
                  {selectedLogIds.length > 0 && (
                    <button
                      onClick={() => setShowDeleteConfirmModal('selected')}
                      disabled={isDeletingLogs}
                      style={{
                        padding: '7px 14px',
                        background: '#DC2626',
                        color: '#FFFFFF',
                        border: 'none',
                        borderRadius: 8,
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        boxShadow: '0 2px 6px rgba(220, 38, 38, 0.25)',
                        transition: 'all 0.15s ease'
                      }}
                      title="Clear selected logs"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                      </svg>
                      <span>Clear Logs ({selectedLogIds.length})</span>
                    </button>
                  )}

                  {/* Lock / Filter Popover Button */}
                  <div style={{ position: 'relative' }}>
                    <button
                      onClick={() => setIsFilterMenuOpen(!isFilterMenuOpen)}
                      style={{
                        padding: '7px 12px',
                        background: (statusFilter !== 'all' || accountFilter !== 'all' || isFilterMenuOpen) ? '#F0FDF4' : '#FFFFFF',
                        color: (statusFilter !== 'all' || accountFilter !== 'all' || isFilterMenuOpen) ? '#166534' : '#334155',
                        border: (statusFilter !== 'all' || accountFilter !== 'all' || isFilterMenuOpen) ? '1.5px solid #16A34A' : '1px solid #CBD5E1',
                        borderRadius: 8,
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        transition: 'all 0.15s ease'
                      }}
                      title="Filter audit logs by account or status"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                      </svg>
                      <span>Filter Options</span>
                      {(statusFilter !== 'all' || accountFilter !== 'all') && (
                        <span style={{
                          background: '#16A34A',
                          color: '#FFFFFF',
                          fontSize: 10,
                          fontWeight: 800,
                          padding: '1px 6px',
                          borderRadius: 9999
                        }}>
                          {(statusFilter !== 'all' ? 1 : 0) + (accountFilter !== 'all' ? 1 : 0)}
                        </span>
                      )}
                      <span style={{ fontSize: 9, color: '#64748B', transform: isFilterMenuOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>▼</span>
                    </button>

                    {/* Popover Menu */}
                    {isFilterMenuOpen && (
                      <div style={{
                        position: 'absolute',
                        top: 'calc(100% + 6px)',
                        left: 0,
                        background: '#FFFFFF',
                        border: '1px solid #E2E8F0',
                        borderRadius: 12,
                        padding: 14,
                        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.12), 0 8px 10px -6px rgba(0, 0, 0, 0.08)',
                        zIndex: 50,
                        minWidth: 260,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 12
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #F1F5F9', paddingBottom: 8 }}>
                          <div style={{ fontSize: 12, fontWeight: 800, color: '#0F172A', display: 'flex', alignItems: 'center', gap: 6 }}>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#166534" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                            </svg>
                            Filter Options
                          </div>
                          {(statusFilter !== 'all' || accountFilter !== 'all') && (
                            <button
                              onClick={() => {
                                setStatusFilter('all');
                                setAccountFilter('all');
                              }}
                              style={{
                                background: 'none',
                                border: 'none',
                                color: '#DC2626',
                                fontSize: 11,
                                fontWeight: 700,
                                cursor: 'pointer',
                                padding: 0
                              }}
                            >
                              Reset
                            </button>
                          )}
                        </div>

                        {/* Filter 1: By Inbox / Account */}
                        <div>
                          <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#475569', marginBottom: 5 }}>
                            Inbox / Account
                          </label>
                          <select
                            value={accountFilter}
                            onChange={(e) => setAccountFilter(e.target.value)}
                            style={{
                              width: '100%',
                              padding: '7px 10px',
                              border: '1px solid #CBD5E1',
                              borderRadius: 6,
                              fontSize: 12,
                              background: '#FFFFFF',
                              fontWeight: 600,
                              color: '#0F172A',
                              cursor: 'pointer',
                              outline: 'none'
                            }}
                          >
                            <option value="all">All Inboxes ({1 + currentUser.aliases.length})</option>
                            <option value={currentUser.email.toLowerCase()}>
                              {currentUser.email} (Primary)
                            </option>
                            {currentUser.aliases.map((alias) => {
                              const isOutlook = alias.toLowerCase().includes('outlook') || alias.toLowerCase().includes('microsoft') || alias.toLowerCase().includes('office');
                              const isGmail = alias.toLowerCase().includes('gmail');
                              return (
                                <option key={alias} value={alias.toLowerCase()}>
                                  {alias} ({isOutlook ? 'Outlook' : isGmail ? 'Gmail' : 'Linked'})
                                </option>
                              );
                            })}
                          </select>
                        </div>

                        {/* Filter 2: By Verification Status / Event */}
                        <div>
                          <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#475569', marginBottom: 5 }}>
                            Verification Status
                          </label>
                          <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value as any)}
                            style={{
                              width: '100%',
                              padding: '7px 10px',
                              border: '1px solid #CBD5E1',
                              borderRadius: 6,
                              fontSize: 12,
                              background: '#FFFFFF',
                              fontWeight: 600,
                              color: '#0F172A',
                              cursor: 'pointer',
                              outline: 'none'
                            }}
                          >
                            <option value="all">All Events</option>
                            <option value="sent_verified">Send Verified Only</option>
                            <option value="recv_verified">Received Verified Only</option>
                            <option value="recv_unstamped">Received Unstamped Only</option>
                            <option value="verified">All Verified</option>
                            <option value="unstamped">All Unstamped</option>
                            <option value="warning">Flagged Alerts</option>
                          </select>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Search Bar on the Right */}
                  <div style={{ position: 'relative', minWidth: 200 }}>
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#94A3B8"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
                    >
                      <circle cx="11" cy="11" r="8" />
                      <line x1="21" y1="21" x2="16.65" y2="16.65" />
                    </svg>
                    <input
                      type="text"
                      placeholder="Search subject, party, inbox..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      style={{
                        padding: '7px 11px 7px 30px',
                        border: '1px solid #CBD5E1',
                        borderRadius: 8,
                        fontSize: 12,
                        outline: 'none',
                        width: '100%',
                        background: '#FFFFFF'
                      }}
                    />
                  </div>
                </div>
              </div>

              {filteredLogs.length === 0 ? (
                <div style={{ padding: '40px 20px', textAlign: 'center', color: '#64748B' }}>
                  <div style={{
                    width: 44,
                    height: 44,
                    borderRadius: 10,
                    background: '#F1F5F9',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 12px auto',
                    color: '#64748B'
                  }}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                      <line x1="16" y1="13" x2="12" y2="13" />
                      <line x1="16" y1="17" x2="8" y2="17" />
                    </svg>
                  </div>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: '#0F172A' }}>No Audit Logs Found</div>
                  <div style={{ fontSize: 11.5, marginTop: 4 }}>
                    {accountFilter !== 'all'
                      ? `No audit events found for ${accountFilter}. Select "All Inboxes" or send/receive emails with that account.`
                      : 'Logs will populate automatically as you send and receive stamped emails with the Attest Extension.'}
                  </div>
                </div>
              ) : (
                <div style={{ overflowX: 'auto', border: '1px solid #F1F5F9', borderRadius: 8 }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                        {/* Select All Checkbox Column */}
                        <th style={{ width: 38, padding: '10px 10px 10px 14px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                          <input
                            type="checkbox"
                            checked={displayedLogs.length > 0 && displayedLogs.every(l => selectedLogIds.includes(l.id))}
                            onChange={handleToggleSelectAllLogs}
                            title="Select all displayed records"
                            style={{ width: 15, height: 15, cursor: 'pointer', accentColor: '#007A5E', display: 'block', margin: '0 auto' }}
                          />
                        </th>
                        <th style={{ padding: '10px 12px', fontSize: 10.5, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.03em', whiteSpace: 'nowrap' }}>Status</th>
                        <th style={{ padding: '10px 12px', fontSize: 10.5, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.03em', whiteSpace: 'nowrap' }}>Inbox / Account</th>
                        <th style={{ padding: '10px 12px', fontSize: 10.5, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.03em', whiteSpace: 'nowrap' }}>Subject</th>
                        <th style={{ padding: '10px 12px', fontSize: 10.5, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.03em', whiteSpace: 'nowrap' }}>Party & Flow</th>
                        <th style={{ padding: '10px 12px', fontSize: 10.5, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.03em', whiteSpace: 'nowrap' }}>Time</th>
                        <th style={{ padding: '10px 12px', fontSize: 10.5, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.03em', whiteSpace: 'nowrap' }}>Inspect</th>
                      </tr>
                    </thead>
                    <tbody>
                      {displayedLogs.map(log => {
                        const isPrimary = log.account.toLowerCase() === currentUser.email.toLowerCase();
                        const isOutlook = !log.account.toLowerCase().endsWith('@gmail.com') && !log.account.toLowerCase().endsWith('@googlemail.com');
                        const isGmail = log.account.toLowerCase().endsWith('@gmail.com') || log.account.toLowerCase().endsWith('@googlemail.com');
                        const isIncoming = log.direction === 'incoming';
                        const isSelected = selectedLogIds.includes(log.id);

                        return (
                          <tr key={log.id} style={{ borderBottom: '1px solid #F1F5F9', background: isSelected ? '#F0FDF4' : 'transparent', transition: 'background 0.15s ease' }}>
                            {/* Row Checkbox */}
                            <td style={{ width: 38, padding: '10px 10px 10px 14px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => handleToggleSelectLog(log.id)}
                                title="Select record"
                                style={{ width: 15, height: 15, cursor: 'pointer', accentColor: '#007A5E', display: 'block', margin: '0 auto' }}
                              />
                            </td>
                            {/* Status Badge Column - Strictly Single Line */}
                            <td style={{ padding: '10px 12px', whiteSpace: 'nowrap', width: 115, minWidth: 115 }}>
                              <span style={{
                                display: 'inline-flex',
                                flexDirection: 'row',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: 6,
                                padding: '3.5px 10px',
                                borderRadius: 9999,
                                fontSize: 11,
                                fontWeight: 700,
                                whiteSpace: 'nowrap',
                                wordBreak: 'keep-all',
                                flexShrink: 0,
                                width: 'fit-content',
                                lineHeight: 1.2,
                                background: log.status === 'VERIFIED' ? '#F0FDF4' : log.status === 'WARNING' ? '#FEF2F2' : '#F1F5F9',
                                color: log.status === 'VERIFIED' ? '#166534' : log.status === 'WARNING' ? '#DC2626' : '#475569',
                                border: log.status === 'VERIFIED' ? '1px solid #BBF7D0' : log.status === 'WARNING' ? '1px solid #FECACA' : '1px solid #CBD5E1'
                              }}>
                                <span style={{ fontSize: 11, lineHeight: 1, flexShrink: 0 }}>
                                  {log.status === 'VERIFIED' ? '✓' : log.status === 'WARNING' ? '⚠️' : '○'}
                                </span>
                                <span style={{ fontSize: 11, lineHeight: 1, whiteSpace: 'nowrap', wordBreak: 'keep-all' }}>
                                  {log.status === 'VERIFIED' ? 'Verified' : log.status === 'WARNING' ? 'Alert' : 'Unstamped'}
                                </span>
                              </span>
                            </td>
                            {/* Account / Inbox font column - Clean typography with unique account color, NO background block */}
                            <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
                              <div style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 6,
                                fontSize: 12,
                                fontWeight: 700,
                                color: getAccountFontColor(log.account, currentUser.email, currentUser.aliases),
                                maxWidth: 240
                              }}>
                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={log.account}>
                                  {log.account}
                                </span>
                                <span style={{
                                  fontSize: 9.5,
                                  fontWeight: 800,
                                  color: isPrimary ? '#059669' : '#64748B',
                                  textTransform: 'uppercase',
                                  letterSpacing: '0.04em',
                                  opacity: 0.85
                                }}>
                                  {isPrimary ? '(Primary)' : '(Linked)'}
                                </span>
                              </div>
                            </td>
                            <td style={{ padding: '10px 12px', fontWeight: 600, color: '#0F172A', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 11.5 }}>
                              {log.subject}
                            </td>
                            <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span style={{
                                  fontSize: 9.5,
                                  fontWeight: 700,
                                  padding: '2px 5px',
                                  borderRadius: 4,
                                  background: isIncoming ? '#E0F2FE' : '#FEF3C7',
                                  color: isIncoming ? '#0369A1' : '#92400E',
                                  whiteSpace: 'nowrap'
                                }}>
                                  {isIncoming ? 'FROM' : 'TO'}
                                </span>
                                <span style={{ color: '#0F172A', fontWeight: 500, fontSize: 11.5, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={isIncoming ? log.sender : log.recipient}>
                                  {isIncoming ? log.sender : log.recipient}
                                </span>
                              </div>
                            </td>
                            <td style={{ padding: '10px 12px', color: '#64748B', fontSize: 11.5, whiteSpace: 'nowrap' }}>{log.timestamp}</td>
                            <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
                              <button
                                onClick={() => setSelectedLog(log)}
                                style={{ padding: '3px 8px', background: '#FFFFFF', border: '1px solid #CBD5E1', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}
                              >
                                Inspect ↗
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* View All Audit Logs Footer on Dashboard Tab */}
              {activeTab === 'dashboard' && filteredLogs.length > 0 && (
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '14px 18px',
                  borderTop: '1px solid #F1F5F9',
                  background: '#F8FAFC',
                  borderRadius: 10,
                  marginTop: 14,
                  flexWrap: 'wrap',
                  gap: 10
                }}>
                  <span style={{ fontSize: 12, color: '#64748B', fontWeight: 500 }}>
                    Displaying recent <strong>{Math.min(5, filteredLogs.length)}</strong> of <strong>{filteredLogs.length}</strong> total audit records
                  </span>
                  <button
                    onClick={() => setActiveTab('audit')}
                    style={{
                      padding: '7px 16px',
                      background: '#007A5E',
                      color: '#FFFFFF',
                      border: 'none',
                      borderRadius: 8,
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      boxShadow: '0 2px 5px rgba(0, 122, 94, 0.22)',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <span>View All Audit Logs</span>
                    <span>→</span>
                  </button>
                </div>
              )}

            </div>
            </div>
          )}

          {/* TAB 2: LINKED EMAIL INBOXES (Clean Simple Table Design) */}
          {activeTab === 'accounts' && (
            <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 16, padding: '24px 28px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
              
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
                <div>
                  <h2 style={{ fontSize: 22, fontWeight: 800, color: '#0F172A', margin: 0, letterSpacing: '-0.02em' }}>
                    Linked Email Inboxes
                  </h2>
                  <div style={{ fontSize: 13, color: '#64748B', marginTop: 4 }}>
                    Connect your Gmail and Outlook inboxes to use Attest Pro across all your personal and work emails.
                  </div>
                </div>

                <button
                  onClick={handleStartAddAlias}
                  style={{
                    padding: '9px 18px',
                    background: '#004D40',
                    color: '#FFFFFF',
                    border: 'none',
                    borderRadius: 8,
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    boxShadow: '0 2px 5px rgba(0, 77, 64, 0.25)',
                    transition: 'background 0.15s ease'
                  }}
                >
                  <span style={{ fontSize: 16, lineHeight: 1 }}>+</span>
                  <span>Link Inbox</span>
                </button>
              </div>

              {/* MODAL / CARD: MULTI-STEP OTP VERIFICATION FLOW */}
              {isAddingAlias && (
                <div style={{
                  background: '#F8FAFC',
                  border: '1.5px solid #007A5E',
                  borderRadius: 12,
                  padding: 20,
                  marginBottom: 24,
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

              {/* Search & Filter Controls */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, flexWrap: 'wrap', gap: 12 }}>
                <div style={{ position: 'relative', width: 280, maxWidth: '100%' }}>
                  <svg
                    width="15"
                    height="15"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#94A3B8"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }}
                  >
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                  <input
                    type="text"
                    placeholder="Search inboxes..."
                    value={inboxSearchQuery}
                    onChange={(e) => setInboxSearchQuery(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px 8px 36px',
                      border: '1px solid #E2E8F0',
                      borderRadius: 8,
                      fontSize: 12.5,
                      outline: 'none',
                      background: '#FFFFFF',
                      color: '#0F172A'
                    }}
                  />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <select
                    value={inboxStatusFilter}
                    onChange={(e) => setInboxStatusFilter(e.target.value as any)}
                    style={{
                      padding: '8px 14px',
                      border: '1px solid #E2E8F0',
                      borderRadius: 8,
                      fontSize: 12.5,
                      background: '#FFFFFF',
                      fontWeight: 600,
                      color: '#0F172A',
                      cursor: 'pointer',
                      outline: 'none'
                    }}
                  >
                    <option value="all">All Status</option>
                    <option value="active">Active & Synced</option>
                    <option value="issue">Sync Issue</option>
                  </select>
                </div>
              </div>

              {/* Inboxes Table */}
              {(() => {
                const allInboxes = [
                  { email: currentUser.email, isPrimary: true },
                  ...currentUser.aliases.map(alias => ({ email: alias, isPrimary: false }))
                ];

                const filteredInboxes = allInboxes.filter(item => {
                  if (inboxSearchQuery) {
                    const q = inboxSearchQuery.toLowerCase();
                    if (!item.email.toLowerCase().includes(q)) return false;
                  }
                  if (inboxStatusFilter === 'issue') return false;
                  return true;
                });

                return (
                  <div style={{ overflowX: 'auto', border: '1px solid #F1F5F9', borderRadius: 8 }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 12.5 }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid #E2E8F0', background: '#FAFAFA' }}>
                          <th style={{ padding: '12px 16px', fontSize: 11.5, fontWeight: 700, color: '#64748B', whiteSpace: 'nowrap' }}>Inbox</th>
                          <th style={{ padding: '12px 16px', fontSize: 11.5, fontWeight: 700, color: '#64748B', whiteSpace: 'nowrap' }}>Status</th>
                          <th style={{ padding: '12px 16px', fontSize: 11.5, fontWeight: 700, color: '#64748B', whiteSpace: 'nowrap' }}>Total Events</th>
                          <th style={{ padding: '12px 16px', fontSize: 11.5, fontWeight: 700, color: '#64748B', whiteSpace: 'nowrap' }}>Sent Sealed</th>
                          <th style={{ padding: '12px 16px', fontSize: 11.5, fontWeight: 700, color: '#64748B', whiteSpace: 'nowrap' }}>Received Verified</th>
                          <th style={{ padding: '12px 16px', fontSize: 11.5, fontWeight: 700, color: '#64748B', whiteSpace: 'nowrap' }}>Unstamped / Risk</th>
                          <th style={{ padding: '12px 16px', fontSize: 11.5, fontWeight: 700, color: '#64748B', whiteSpace: 'nowrap' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredInboxes.map(item => {
                          const email = item.email;
                          const isPrimary = item.isPrimary;
                          const subtitle = isPrimary ? 'Primary Account' : 'Linked Inbox';

                          const inboxLogs = auditLogs.filter(l => l.account.toLowerCase() === email.toLowerCase());
                          const totalEvents = inboxLogs.length;
                          const sentSealed = inboxLogs.filter(l => (l.type === 'sent_stamped' || l.type === 'sent_stamped_link' || l.type === 'sent_stamped_hash') && l.status === 'VERIFIED').length;
                          const receivedVerified = inboxLogs.filter(l => (l.type === 'recv_verified' || l.type === 'received_stamped') && l.status === 'VERIFIED').length;
                          const unstampedRisk = inboxLogs.filter(l => l.status === 'UNVERIFIED' || l.status === 'WARNING' || l.type === 'sent_unstamped' || l.type === 'received_unstamped' || l.type === 'recv_unverified').length;

                          return (
                            <tr key={email} style={{ borderBottom: '1px solid #F1F5F9', transition: 'background 0.15s ease' }}>
                              {/* Inbox Email Address + Subtitle - Clean, No logos */}
                              <td style={{ padding: '14px 16px', whiteSpace: 'nowrap' }}>
                                <div>
                                  <div style={{
                                    fontSize: 13.5,
                                    fontWeight: 700,
                                    color: getAccountFontColor(email, currentUser.email, currentUser.aliases)
                                  }}>
                                    {email}
                                  </div>
                                  <div style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>
                                    {subtitle}
                                  </div>
                                </div>
                              </td>

                              {/* Status Badge - Clean text, no background block */}
                              <td style={{ padding: '14px 16px', whiteSpace: 'nowrap' }}>
                                <div style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 6,
                                  fontSize: 12,
                                  fontWeight: 600,
                                  color: '#059669'
                                }}>
                                  <span style={{ width: 6.5, height: 6.5, borderRadius: '50%', background: '#10B981', display: 'inline-block' }}></span>
                                  <span>Active & Synced</span>
                                </div>
                              </td>

                              {/* Total Events */}
                              <td style={{ padding: '14px 16px', fontWeight: 800, fontSize: 14, color: '#0F172A', whiteSpace: 'nowrap' }}>
                                {totalEvents}
                              </td>

                              {/* Sent Sealed */}
                              <td style={{ padding: '14px 16px', fontWeight: 800, fontSize: 14, color: '#0F172A', whiteSpace: 'nowrap' }}>
                                {sentSealed}
                              </td>

                              {/* Received Verified */}
                              <td style={{ padding: '14px 16px', fontWeight: 800, fontSize: 14, color: '#0F172A', whiteSpace: 'nowrap' }}>
                                {receivedVerified}
                              </td>

                              {/* Unstamped / Risk */}
                              <td style={{ padding: '14px 16px', fontWeight: 800, fontSize: 14, color: '#D97706', whiteSpace: 'nowrap' }}>
                                {unstampedRisk}
                              </td>

                              {/* Actions */}
                              <td style={{ padding: '14px 16px', whiteSpace: 'nowrap' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, position: 'relative' }}>
                                  <button
                                    onClick={() => {
                                      setAccountFilter(email.toLowerCase());
                                      setActiveTab('audit');
                                    }}
                                    style={{
                                      padding: '5px 12px',
                                      background: '#FFFFFF',
                                      border: '1px solid #CBD5E1',
                                      borderRadius: 6,
                                      fontSize: 11.5,
                                      fontWeight: 600,
                                      color: '#0F172A',
                                      cursor: 'pointer',
                                      whiteSpace: 'nowrap',
                                      transition: 'all 0.15s ease'
                                    }}
                                  >
                                    View Logs ({totalEvents})
                                  </button>

                                  {!isPrimary && (
                                    <div style={{ position: 'relative' }}>
                                      <button
                                        onClick={() => setOpenInboxMenuId(openInboxMenuId === email ? null : email)}
                                        style={{
                                          width: 28,
                                          height: 28,
                                          background: '#FFFFFF',
                                          border: '1px solid #CBD5E1',
                                          borderRadius: 6,
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'center',
                                          fontSize: 14,
                                          fontWeight: 900,
                                          color: '#475569',
                                          cursor: 'pointer'
                                        }}
                                        title="More actions"
                                      >
                                        ⋮
                                      </button>

                                      {openInboxMenuId === email && (
                                        <div style={{
                                          position: 'absolute',
                                          right: 0,
                                          top: '100%',
                                          marginTop: 4,
                                          background: '#FFFFFF',
                                          border: '1px solid #E2E8F0',
                                          borderRadius: 8,
                                          boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                                          zIndex: 20,
                                          minWidth: 140,
                                          overflow: 'hidden'
                                        }}>
                                          <button
                                            onClick={() => {
                                              setOpenInboxMenuId(null);
                                              setAccountFilter(email.toLowerCase());
                                              setActiveTab('audit');
                                            }}
                                            style={{
                                              width: '100%',
                                              padding: '8px 12px',
                                              background: 'none',
                                              border: 'none',
                                              textAlign: 'left',
                                              fontSize: 12,
                                              fontWeight: 600,
                                              color: '#0F172A',
                                              cursor: 'pointer'
                                            }}
                                          >
                                            View Audit Logs
                                          </button>
                                          <button
                                            onClick={() => {
                                              setOpenInboxMenuId(null);
                                              handleRemoveAlias(email);
                                            }}
                                            style={{
                                              width: '100%',
                                              padding: '8px 12px',
                                              background: 'none',
                                              border: 'none',
                                              borderTop: '1px solid #F1F5F9',
                                              textAlign: 'left',
                                              fontSize: 12,
                                              fontWeight: 600,
                                              color: '#DC2626',
                                              cursor: 'pointer'
                                            }}
                                          >
                                            Unlink Inbox
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                );
              })()}

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
                    {currentUser.plan === 'professional' ? '$1.00 / month' : currentUser.plan === 'enterprise' ? 'Enterprise Custom License' : '$0.00 / month (Free)'}
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

      {/* USER PROFILE & ACCOUNT MANAGEMENT MODAL */}
      {showProfileModal && (
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
            maxWidth: 540,
            maxHeight: '90vh',
            overflowY: 'auto',
            padding: '24px 28px',
            border: '1px solid #E2E8F0',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)'
          }}>
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <img
                  src={currentUser.avatar}
                  alt={currentUser.name}
                  style={{ width: 34, height: 34, borderRadius: '50%', objectFit: 'cover', border: '1.5px solid #007A5E' }}
                />
                <div>
                  <h3 style={{ fontSize: 17, fontWeight: 800, color: '#0F172A', margin: 0 }}>Account & Profile Settings</h3>
                  <p style={{ fontSize: 11.5, color: '#64748B', margin: 0 }}>{currentUser.email}</p>
                </div>
              </div>
              <button
                onClick={() => setShowProfileModal(false)}
                style={{ background: 'none', border: 'none', fontSize: 22, color: '#64748B', cursor: 'pointer', lineHeight: 1 }}
              >
                ×
              </button>
            </div>

            {/* Modal Tabs Bar */}
            <div style={{ display: 'flex', borderBottom: '1px solid #E2E8F0', marginBottom: 20, gap: 12 }}>
              <button
                onClick={() => setProfileModalTab('profile')}
                style={{
                  padding: '8px 4px',
                  background: 'none',
                  border: 'none',
                  borderBottom: profileModalTab === 'profile' ? '2.5px solid #007A5E' : '2.5px solid transparent',
                  color: profileModalTab === 'profile' ? '#007A5E' : '#64748B',
                  fontSize: 13,
                  fontWeight: profileModalTab === 'profile' ? 700 : 500,
                  cursor: 'pointer'
                }}
              >
                Profile Overview
              </button>
              <button
                onClick={() => setProfileModalTab('password')}
                style={{
                  padding: '8px 4px',
                  background: 'none',
                  border: 'none',
                  borderBottom: profileModalTab === 'password' ? '2.5px solid #007A5E' : '2.5px solid transparent',
                  color: profileModalTab === 'password' ? '#007A5E' : '#64748B',
                  fontSize: 13,
                  fontWeight: profileModalTab === 'password' ? 700 : 500,
                  cursor: 'pointer'
                }}
              >
                Change Password
              </button>
              <button
                onClick={() => setProfileModalTab('danger')}
                style={{
                  padding: '8px 4px',
                  background: 'none',
                  border: 'none',
                  borderBottom: profileModalTab === 'danger' ? '2.5px solid #DC2626' : '2.5px solid transparent',
                  color: profileModalTab === 'danger' ? '#DC2626' : '#94A3B8',
                  fontSize: 13,
                  fontWeight: profileModalTab === 'danger' ? 700 : 500,
                  cursor: 'pointer'
                }}
              >
                Delete Account
              </button>
            </div>

            {/* TAB 1: PROFILE OVERVIEW */}
            {profileModalTab === 'profile' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ background: '#F8FAFC', padding: 16, borderRadius: 12, border: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', gap: 14 }}>
                  <img
                    src={currentUser.avatar}
                    alt={currentUser.name}
                    style={{ width: 52, height: 52, borderRadius: '50%', objectFit: 'cover' }}
                  />
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: '#0F172A' }}>{currentUser.name}</div>
                    <div style={{ fontSize: 12.5, color: '#475569', marginTop: 2 }}>{currentUser.email}</div>
                    <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                      <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 7px', borderRadius: 9999, background: '#DCFCE7', color: '#166534' }}>
                        ✓ PRIMARY ACCOUNT
                      </span>
                      <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 7px', borderRadius: 9999, background: '#F1F5F9', color: '#475569', textTransform: 'uppercase' }}>
                        {currentUser.plan} TIER
                      </span>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 12.5 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #F1F5F9', paddingBottom: 8 }}>
                    <span style={{ color: '#64748B' }}>Account ID</span>
                    <span style={{ fontWeight: 600, color: '#0F172A' }}>{currentUser.id}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #F1F5F9', paddingBottom: 8 }}>
                    <span style={{ color: '#64748B' }}>Primary Domain</span>
                    <span style={{ fontWeight: 600, color: '#0F172A' }}>{currentUser.company}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #F1F5F9', paddingBottom: 8 }}>
                    <span style={{ color: '#64748B' }}>Active Linked Inboxes</span>
                    <span style={{ fontWeight: 700, color: '#007A5E' }}>{1 + currentUser.aliases.length} inboxes configured</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #F1F5F9', paddingBottom: 8 }}>
                    <span style={{ color: '#64748B' }}>Hardware Passkey Enclave</span>
                    <span style={{ fontWeight: 700, color: '#166534' }}>✓ ECDSA P-256 Registered</span>
                  </div>
                </div>

                <button
                  onClick={() => setShowProfileModal(false)}
                  style={{ width: '100%', padding: '10px', background: '#0F172A', color: '#FFFFFF', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer', marginTop: 8 }}
                >
                  Close Settings
                </button>
              </div>
            )}

            {/* TAB 2: CHANGE PASSWORD */}
            {profileModalTab === 'password' && (
              <form onSubmit={handleChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ fontSize: 12.5, color: '#475569', lineHeight: 1.4 }}>
                  Update your Attest account password. This will directly synchronize with our database.
                </div>

                {changePasswordError && (
                  <div style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', color: '#DC2626', padding: '10px 12px', borderRadius: 8, fontSize: 12 }}>
                    ⚠️ {changePasswordError}
                  </div>
                )}

                {changePasswordSuccess && (
                  <div style={{ background: '#F0FDF4', border: '1px solid #86EFAC', color: '#166534', padding: '10px 12px', borderRadius: 8, fontSize: 12 }}>
                    ✓ {changePasswordSuccess}
                  </div>
                )}

                <div>
                  <label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: '#334155', marginBottom: 4, textTransform: 'uppercase' }}>
                    Current Password
                  </label>
                  <input
                    type={showPasswordInputs ? 'text' : 'password'}
                    required
                    placeholder="Enter current password"
                    value={currentPasswordInput}
                    onChange={(e) => { setCurrentPasswordInput(e.target.value); setChangePasswordError(''); }}
                    style={{ width: '100%', padding: '9px 12px', border: '1px solid #CBD5E1', borderRadius: 8, fontSize: 13, outline: 'none' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: '#334155', marginBottom: 4, textTransform: 'uppercase' }}>
                    New Password
                  </label>
                  <input
                    type={showPasswordInputs ? 'text' : 'password'}
                    required
                    placeholder="At least 8 chars (uppercase, lowercase, number, symbol)"
                    value={newPasswordInput}
                    onChange={(e) => { setNewPasswordInput(e.target.value); setChangePasswordError(''); }}
                    style={{ width: '100%', padding: '9px 12px', border: '1px solid #CBD5E1', borderRadius: 8, fontSize: 13, outline: 'none' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: '#334155', marginBottom: 4, textTransform: 'uppercase' }}>
                    Confirm New Password
                  </label>
                  <input
                    type={showPasswordInputs ? 'text' : 'password'}
                    required
                    placeholder="Re-type new password"
                    value={confirmPasswordInput}
                    onChange={(e) => { setConfirmPasswordInput(e.target.value); setChangePasswordError(''); }}
                    style={{ width: '100%', padding: '9px 12px', border: '1px solid #CBD5E1', borderRadius: 8, fontSize: 13, outline: 'none' }}
                  />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#64748B' }}>
                  <input
                    type="checkbox"
                    id="showPassModal"
                    checked={showPasswordInputs}
                    onChange={(e) => setShowPasswordInputs(e.target.checked)}
                    style={{ cursor: 'pointer' }}
                  />
                  <label htmlFor="showPassModal" style={{ cursor: 'pointer' }}>Show password characters</label>
                </div>

                <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
                  <button
                    type="submit"
                    disabled={isChangingPassword}
                    style={{
                      flex: 1,
                      padding: '10px 16px',
                      background: '#007A5E',
                      color: '#FFFFFF',
                      border: 'none',
                      borderRadius: 8,
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: isChangingPassword ? 'not-allowed' : 'pointer',
                      opacity: isChangingPassword ? 0.7 : 1
                    }}
                  >
                    {isChangingPassword ? 'Updating Database...' : 'Update Password'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setCurrentPasswordInput('');
                      setNewPasswordInput('');
                      setConfirmPasswordInput('');
                      setChangePasswordError('');
                      setChangePasswordSuccess('');
                    }}
                    style={{ padding: '10px 14px', background: '#F1F5F9', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, color: '#475569', cursor: 'pointer' }}
                  >
                    Reset
                  </button>
                </div>
              </form>
            )}

            {/* TAB 3: DELETE ACCOUNT */}
            {profileModalTab === 'danger' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', padding: 14, borderRadius: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#DC2626', fontWeight: 800, fontSize: 14 }}>
                    <span>⚠️</span>
                    <span>Permanent Account Deletion</span>
                  </div>
                  <div style={{ fontSize: 12, color: '#991B1B', marginTop: 6, lineHeight: 1.45 }}>
                    This action is <strong>irreversible</strong>. Deleting your account will immediately purge all your registered data from our database, including:
                    <ul style={{ margin: '6px 0 0 16px', padding: 0 }}>
                      <li>Primary account and linked email aliases</li>
                      <li>Cryptographic audit ledger & verification history</li>
                      <li>Active sessions and security credentials</li>
                    </ul>
                  </div>
                </div>

                {deleteAccountError && (
                  <div style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', color: '#DC2626', padding: '10px 12px', borderRadius: 8, fontSize: 12 }}>
                    ⚠️ {deleteAccountError}
                  </div>
                )}

                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#0F172A', marginBottom: 4 }}>
                    To confirm, please type <strong>{currentUser.email}</strong> or <strong>DELETE</strong> below:
                  </label>
                  <input
                    type="text"
                    placeholder={`Type ${currentUser.email}`}
                    value={deleteConfirmInput}
                    onChange={(e) => { setDeleteConfirmInput(e.target.value); setDeleteAccountError(''); }}
                    style={{ width: '100%', padding: '9px 12px', border: '1.5px solid #FCA5A5', borderRadius: 8, fontSize: 13, outline: 'none' }}
                  />
                </div>

                <button
                  type="button"
                  onClick={handleDeleteAccount}
                  disabled={isDeletingAccount || (deleteConfirmInput.trim().toLowerCase() !== currentUser.email.toLowerCase() && deleteConfirmInput.trim().toUpperCase() !== 'DELETE')}
                  style={{
                    width: '100%',
                    padding: '11px',
                    background: '#DC2626',
                    color: '#FFFFFF',
                    border: 'none',
                    borderRadius: 8,
                    fontSize: 13,
                    fontWeight: 800,
                    cursor: (isDeletingAccount || (deleteConfirmInput.trim().toLowerCase() !== currentUser.email.toLowerCase() && deleteConfirmInput.trim().toUpperCase() !== 'DELETE')) ? 'not-allowed' : 'pointer',
                    opacity: (isDeletingAccount || (deleteConfirmInput.trim().toLowerCase() !== currentUser.email.toLowerCase() && deleteConfirmInput.trim().toUpperCase() !== 'DELETE')) ? 0.5 : 1,
                    boxShadow: '0 2px 8px rgba(220, 38, 38, 0.25)'
                  }}
                >
                  {isDeletingAccount ? 'Purging Account from Database...' : 'Permanently Delete My Account'}
                </button>
              </div>
            )}

          </div>
        </div>
      )}

      {/* AUDIT LOGS DELETE CONFIRMATION MODAL */}
      {showDeleteConfirmModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          background: 'rgba(15,23,42,0.6)',
          backdropFilter: 'blur(4px)',
          zIndex: 10001,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 20
        }}>
          <div style={{
            background: '#FFFFFF',
            borderRadius: 16,
            width: '100%',
            maxWidth: 440,
            padding: '24px 28px',
            border: '1px solid #E2E8F0',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#FEE2E2', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#DC2626', fontSize: 18 }}>
                🗑️
              </div>
              <h3 style={{ fontSize: 17, fontWeight: 800, color: '#0F172A', margin: 0 }}>
                {showDeleteConfirmModal === 'all' ? 'Clear All Audit Logs?' : `Delete ${selectedLogIds.length} Selected Logs?`}
              </h3>
            </div>

            <p style={{ fontSize: 13, color: '#475569', lineHeight: 1.5, margin: '0 0 20px 0' }}>
              {showDeleteConfirmModal === 'all'
                ? 'Are you sure you want to permanently delete ALL audit verification logs from the database? This action cannot be undone.'
                : `Are you sure you want to permanently delete the ${selectedLogIds.length} selected audit verification log(s) from the database?`}
            </p>

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => executeDeleteLogs(showDeleteConfirmModal)}
                disabled={isDeletingLogs}
                style={{
                  flex: 1,
                  padding: '10px 16px',
                  background: '#DC2626',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: isDeletingLogs ? 'not-allowed' : 'pointer',
                  opacity: isDeletingLogs ? 0.7 : 1
                }}
              >
                {isDeletingLogs ? 'Deleting from DB...' : 'Confirm & Delete'}
              </button>
              <button
                onClick={() => setShowDeleteConfirmModal(null)}
                disabled={isDeletingLogs}
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
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* INSPECT AUDIT MODAL */}
      {selectedLog && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(4px)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: '#FFFFFF', borderRadius: 16, width: '100%', maxWidth: 520, padding: 24, border: '1px solid #E2E8F0', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#007A5E" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  <polyline points="9 12 11.5 14.5 15.5 9.5" />
                </svg>
                <h3 style={{ fontSize: 17, fontWeight: 800, margin: 0, color: '#0F172A' }}>Audit Certificate & Verification</h3>
              </div>
              <button onClick={() => setSelectedLog(null)} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#64748B', lineHeight: 1 }}>×</button>
            </div>

            <div style={{ fontSize: 13, display: 'flex', flexDirection: 'column', gap: 12 }}>
              {/* Account / Inbox card */}
              <div style={{ background: '#F8FAFC', padding: '12px 14px', borderRadius: 10, border: '1px solid #E2E8F0' }}>
                <div style={{ fontSize: 10.5, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>
                  Assigned Inbox Account
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <strong style={{ color: '#0F172A', fontSize: 13.5 }}>{selectedLog.account}</strong>
                  </div>
                  <span style={{
                    fontSize: 10.5,
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: 9999,
                    background: selectedLog.account.toLowerCase() === currentUser.email.toLowerCase() ? '#DCFCE7' : '#EFF6FF',
                    color: selectedLog.account.toLowerCase() === currentUser.email.toLowerCase() ? '#166534' : '#1E40AF',
                    border: selectedLog.account.toLowerCase() === currentUser.email.toLowerCase() ? '1px solid #BBF7D0' : '1px solid #BFDBFE'
                  }}>
                    {selectedLog.account.toLowerCase() === currentUser.email.toLowerCase() ? 'Primary Account' : 'Linked Inbox'}
                  </span>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div style={{ background: '#F8FAFC', padding: '10px 12px', borderRadius: 8, border: '1px solid #E2E8F0' }}>
                  <span style={{ fontSize: 10.5, color: '#64748B', display: 'block', fontWeight: 700, textTransform: 'uppercase' }}>FLOW DIRECTION</span>
                  <strong style={{ color: '#0F172A', fontSize: 12.5, marginTop: 2, display: 'inline-block' }}>
                    {selectedLog.direction === 'incoming' ? 'Incoming (Received)' : 'Outgoing (Sent)'}
                  </strong>
                </div>
                <div style={{ background: '#F8FAFC', padding: '10px 12px', borderRadius: 8, border: '1px solid #E2E8F0' }}>
                  <span style={{ fontSize: 10.5, color: '#64748B', display: 'block', fontWeight: 700, textTransform: 'uppercase' }}>STATUS</span>
                  <span style={{
                    display: 'inline-block',
                    marginTop: 2,
                    padding: '2px 8px',
                    borderRadius: 9999,
                    fontSize: 11,
                    fontWeight: 700,
                    background: selectedLog.status === 'VERIFIED' ? '#F0FDF4' : selectedLog.status === 'WARNING' ? '#FEF2F2' : '#F1F5F9',
                    color: selectedLog.status === 'VERIFIED' ? '#166534' : selectedLog.status === 'WARNING' ? '#DC2626' : '#475569'
                  }}>
                    {selectedLog.status === 'VERIFIED' ? '✓ Verified Human' : selectedLog.status === 'WARNING' ? '⚠️ Alert / Unverified' : '○ Unstamped'}
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, background: '#FFFFFF', border: '1px solid #F1F5F9', borderRadius: 8, padding: 12 }}>
                <div><strong>Subject:</strong> <span style={{ color: '#0F172A', fontWeight: 600 }}>{selectedLog.subject}</span></div>
                <div><strong>Sender (From):</strong> <span style={{ color: '#0F172A' }}>{selectedLog.sender}</span></div>
                <div><strong>Recipient (To):</strong> <span style={{ color: '#0F172A' }}>{selectedLog.recipient}</span></div>
                <div><strong>Timestamp:</strong> <span style={{ color: '#64748B' }}>{selectedLog.timestamp}</span></div>
                <div><strong>Verification Proof:</strong> <span style={{ color: '#0F172A', fontWeight: 600 }}>{selectedLog.securityProof}</span></div>
              </div>

              <div>
                <strong style={{ fontSize: 11.5, color: '#475569', textTransform: 'uppercase' }}>Cryptographic SHA-256 Digest:</strong>
                <code style={{ wordBreak: 'break-all', display: 'block', background: '#F8FAFC', padding: 8, marginTop: 4, borderRadius: 6, border: '1px solid #E2E8F0', fontSize: 11 }}>
                  {selectedLog.hash}
                </code>
              </div>
            </div>

            <button onClick={() => setSelectedLog(null)} style={{ marginTop: 20, width: '100%', padding: '10px', background: '#0F172A', color: '#FFFFFF', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer' }}>
              Close Certificate
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
