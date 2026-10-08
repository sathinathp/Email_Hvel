'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [step, setStep] = useState<'email' | 'otp_and_password' | 'success'>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [resendTimer, setResendTimer] = useState(0);

  const API_BASE = (typeof window !== 'undefined' && window.location?.hostname)
  ? (['localhost', '127.0.0.1'].includes(window.location.hostname) || window.location.hostname.startsWith('192.168.') || window.location.hostname.startsWith('10.') || window.location.hostname.endsWith('.local')
      ? `http://${window.location.hostname}:5000`
      : (process.env.NEXT_PUBLIC_BACKEND_URL || 'https://api.attest.page'))
  : (process.env.NEXT_PUBLIC_BACKEND_URL || 'https://api.attest.page');

  // Timer countdown effect for resend OTP
  useEffect(() => {
    let interval: any = null;
    if (resendTimer > 0) {
      interval = setInterval(() => {
        setResendTimer((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [resendTimer]);

  // Step 1: Send OTP to email
  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch(`${API_BASE}/api/auth/forgot-password/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        if (data.error === 'USER_NOT_REGISTERED' || res.status === 404) {
          setErrorMessage('❌ This email is not registered yet. Please check your email or create a new account.');
        } else {
          setErrorMessage(data.message || 'Failed to send OTP. Please try again.');
        }
        setIsLoading(false);
        return;
      }

      setSuccessMessage('✅ Verification code sent! Please check your inbox.');
      setStep('otp_and_password');
      setResendTimer(60);
    } catch (err) {
      setErrorMessage('Network error. Unable to connect to authentication server.');
    } finally {
      setIsLoading(false);
    }
  };

  // Resend OTP
  const handleResendOtp = async () => {
    if (resendTimer > 0) return;
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsLoading(true);

    try {
      const res = await fetch(`${API_BASE}/api/auth/forgot-password/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setErrorMessage(data.message || 'Failed to resend code.');
      } else {
        setSuccessMessage('✅ A fresh 6-digit OTP code has been sent to your email.');
        setResendTimer(60);
      }
    } catch {
      setErrorMessage('Failed to connect to server.');
    } finally {
      setIsLoading(false);
    }
  };

  // Step 2: Verify OTP and Reset Password
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const cleanOtp = otp.trim();
    if (!cleanOtp || cleanOtp.length < 6) {
      setErrorMessage('Please enter the full 6-digit verification code.');
      return;
    }

    if (newPassword.length < 8) {
      setErrorMessage('Password must be at least 8 characters long.');
      return;
    }
    if (!/[A-Z]/.test(newPassword)) {
      setErrorMessage('Password must contain at least one uppercase letter (A-Z).');
      return;
    }
    if (!/[a-z]/.test(newPassword)) {
      setErrorMessage('Password must contain at least one lowercase letter (a-z).');
      return;
    }
    if (!/[0-9]/.test(newPassword)) {
      setErrorMessage('Password must contain at least one number (0-9).');
      return;
    }
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/.test(newPassword)) {
      setErrorMessage('Password must contain at least one special character (e.g. !@#$%^&*).');
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage('Passwords do not match. Please re-enter your password.');
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch(`${API_BASE}/api/auth/forgot-password/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          otp: cleanOtp,
          newPassword,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setErrorMessage(data.message || 'Failed to reset password. Please verify your OTP.');
        setIsLoading(false);
        return;
      }

      setStep('success');
    } catch {
      setErrorMessage('Server error occurred during password reset.');
    } finally {
      setIsLoading(false);
    }
  };

  // Live password policy checks
  const hasMinLength = newPassword.length >= 8;
  const hasUpper = /[A-Z]/.test(newPassword);
  const hasLower = /[a-z]/.test(newPassword);
  const hasNumber = /[0-9]/.test(newPassword);
  const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/.test(newPassword);
  const isPolicyComplete = hasMinLength && hasUpper && hasLower && hasNumber && hasSpecial;

  // Password strength helper (0-5)
  const getPasswordStrength = () => {
    if (!newPassword) return 0;
    let score = 0;
    if (hasMinLength) score += 1;
    if (hasUpper) score += 1;
    if (hasLower) score += 1;
    if (hasNumber) score += 1;
    if (hasSpecial) score += 1;
    return score;
  };

  const strength = getPasswordStrength();
  const strengthColors = ['#E2E8F0', '#EF4444', '#F97316', '#F59E0B', '#10B981', '#059669'];
  const strengthLabels = ['', 'Very Weak', 'Weak', 'Fair', 'Strong', 'Very Strong (Compliant)'];

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #F8FAFC 0%, #EDF2F7 100%)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px 16px',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    }}>
      {/* Brand Header */}
      <div style={{ marginBottom: 24, textAlign: 'center' }}>
        <Link href="/" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 10 }}>
          <img
            src="/icon-192.png"
            alt="Attest"
            style={{ width: 36, height: 36, borderRadius: 8, objectFit: 'contain' }}
          />
          <span style={{ fontSize: 24, fontWeight: 800, color: '#007A5E', letterSpacing: '-0.5px' }}>
            Attest
          </span>
        </Link>
      </div>

      {/* Main Card */}
      <div style={{
        width: '100%',
        maxWidth: 440,
        background: '#FFFFFF',
        borderRadius: 16,
        boxShadow: '0 10px 30px -5px rgba(0, 0, 0, 0.08), 0 0 0 1px rgba(0, 0, 0, 0.04)',
        padding: '36px 32px',
        position: 'relative'
      }}>

        {/* STEP 1: Request OTP */}
        {step === 'email' && (
          <div>
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <h1 style={{ fontSize: 22, fontWeight: 700, color: '#0F172A', margin: '0 0 8px 0', letterSpacing: '-0.3px' }}>
                Reset your password
              </h1>
              <p style={{ fontSize: 13.5, color: '#64748B', margin: 0, lineHeight: 1.5 }}>
                Enter your registered email address. If an account exists, we'll send a 6-digit verification code.
              </p>
            </div>

            {/* Error / Alert Banner */}
            {errorMessage && (
              <div style={{
                background: '#FEF2F2',
                border: '1px solid #FECACA',
                borderRadius: 8,
                padding: '12px 14px',
                fontSize: 13,
                color: '#B91C1C',
                marginBottom: 18,
                lineHeight: 1.4,
                display: 'flex',
                alignItems: 'flex-start',
                gap: 8
              }}>
                <span>⚠️</span>
                <span>{errorMessage}</span>
              </div>
            )}

            <form onSubmit={handleSendOtp}>
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: '#334155', marginBottom: 6 }}>
                  Registered Email Address
                </label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 15, color: '#94A3B8' }}>
                    ✉️
                  </span>
                  <input
                    type="email"
                    required
                    placeholder="user@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '11px 12px 11px 38px',
                      fontSize: 14,
                      border: '1.5px solid #E2E8F0',
                      borderRadius: 8,
                      outline: 'none',
                      color: '#0F172A',
                      background: '#F8FAFC',
                      transition: 'border-color 0.2s, box-shadow 0.2s'
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = '#007A5E';
                      e.target.style.background = '#FFFFFF';
                      e.target.style.boxShadow = '0 0 0 3px rgba(0, 122, 94, 0.12)';
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = '#E2E8F0';
                      e.target.style.background = '#F8FAFC';
                      e.target.style.boxShadow = 'none';
                    }}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  background: 'linear-gradient(135deg, #004D40 0%, #007A5E 100%)',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: 8,
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: isLoading ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  boxShadow: '0 4px 12px rgba(0, 77, 64, 0.25)',
                  opacity: isLoading ? 0.75 : 1,
                  transition: 'transform 0.1s'
                }}
              >
                {isLoading ? (
                  <span>Checking database & sending OTP...</span>
                ) : (
                  <>
                    <span>Send Verification Code</span>
                    <span>→</span>
                  </>
                )}
              </button>
            </form>

            <div style={{ marginTop: 22, textAlign: 'center', borderTop: '1px solid #F1F5F9', paddingTop: 18 }}>
              <Link
                href="/login"
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: '#007A5E',
                  textDecoration: 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6
                }}
              >
                ← Back to Sign in
              </Link>
            </div>
          </div>
        )}

        {/* STEP 2: Enter OTP & New Password */}
        {step === 'otp_and_password' && (
          <div>
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <div style={{
                width: 44,
                height: 44,
                borderRadius: '50%',
                background: '#ECFDF5',
                color: '#059669',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 20,
                marginBottom: 10
              }}>
                🔑
              </div>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: '#0F172A', margin: '0 0 6px 0' }}>
                Enter OTP & New Password
              </h2>
              <p style={{ fontSize: 13, color: '#64748B', margin: 0 }}>
                Code sent to <strong style={{ color: '#0F172A' }}>{email}</strong>
              </p>
            </div>

            {/* Success Banner */}
            {successMessage && (
              <div style={{
                background: '#F0FDF4',
                border: '1px solid #BBF7D0',
                borderRadius: 8,
                padding: '10px 12px',
                fontSize: 12.5,
                color: '#15803D',
                marginBottom: 16
              }}>
                {successMessage}
              </div>
            )}

            {/* Error Banner */}
            {errorMessage && (
              <div style={{
                background: '#FEF2F2',
                border: '1px solid #FECACA',
                borderRadius: 8,
                padding: '10px 12px',
                fontSize: 12.5,
                color: '#B91C1C',
                marginBottom: 16
              }}>
                ⚠️ {errorMessage}
              </div>
            )}

            <form onSubmit={handleResetPassword}>
              {/* OTP Field */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <label style={{ fontSize: 12.5, fontWeight: 600, color: '#334155' }}>
                    6-Digit Verification Code
                  </label>
                  <button
                    type="button"
                    onClick={handleResendOtp}
                    disabled={resendTimer > 0 || isLoading}
                    style={{
                      background: 'none',
                      border: 'none',
                      fontSize: 12,
                      fontWeight: 600,
                      color: resendTimer > 0 ? '#94A3B8' : '#007A5E',
                      cursor: resendTimer > 0 ? 'default' : 'pointer',
                      padding: 0
                    }}
                  >
                    {resendTimer > 0 ? `Resend in ${resendTimer}s` : 'Resend Code'}
                  </button>
                </div>
                <input
                  type="text"
                  maxLength={6}
                  required
                  placeholder="123456"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                  style={{
                    width: '100%',
                    padding: '12px',
                    fontSize: 20,
                    fontWeight: 700,
                    letterSpacing: '8px',
                    textAlign: 'center',
                    border: '2px solid #E2E8F0',
                    borderRadius: 8,
                    outline: 'none',
                    color: '#0F172A',
                    background: '#F8FAFC'
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = '#007A5E';
                    e.target.style.background = '#FFFFFF';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = '#E2E8F0';
                    e.target.style.background = '#F8FAFC';
                  }}
                />
              </div>

              {/* New Password */}
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: '#334155', marginBottom: 6 }}>
                  New Password
                </label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 14 }}>
                    🔒
                  </span>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="Minimum 6 characters"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 38px 10px 36px',
                      fontSize: 13.5,
                      border: '1.5px solid #E2E8F0',
                      borderRadius: 8,
                      outline: 'none',
                      color: '#0F172A',
                      background: '#F8FAFC'
                    }}
                    onFocus={(e) => (e.target.style.borderColor = '#007A5E')}
                    onBlur={(e) => (e.target.style.borderColor = '#E2E8F0')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{
                      position: 'absolute',
                      right: 10,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: 14
                    }}
                  >
                    {showPassword ? '🙈' : '👁️'}
                  </button>
                </div>

                {/* Password Strength Indicator */}
                {newPassword && (
                  <div style={{ marginTop: 8 }}>
                    <div style={{ display: 'flex', gap: 4, height: 4, borderRadius: 2, overflow: 'hidden' }}>
                      {[1, 2, 3, 4, 5].map((level) => (
                        <div
                          key={level}
                          style={{
                            flex: 1,
                            background: strength >= level ? strengthColors[strength] : '#E2E8F0',
                            transition: 'background 0.2s'
                          }}
                        />
                      ))}
                    </div>
                    <div style={{ fontSize: 11, color: strengthColors[strength], marginTop: 4, fontWeight: 600 }}>
                      Password Strength: {strengthLabels[strength]}
                    </div>
                  </div>
                )}

                {/* Interactive Password Policy Requirements Checklist */}
                <div style={{
                  marginTop: 10,
                  padding: '10px 12px',
                  background: '#F8FAFC',
                  border: '1px solid #E2E8F0',
                  borderRadius: 8,
                  fontSize: 11.5
                }}>
                  <div style={{ fontWeight: 600, color: '#475569', marginBottom: 6 }}>
                    Password Requirements:
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px 10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: hasMinLength ? '#059669' : '#94A3B8', fontWeight: hasMinLength ? 600 : 400 }}>
                      <span style={{ fontWeight: 700 }}>{hasMinLength ? '✓' : '○'}</span>
                      <span>8+ characters</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: hasUpper ? '#059669' : '#94A3B8', fontWeight: hasUpper ? 600 : 400 }}>
                      <span style={{ fontWeight: 700 }}>{hasUpper ? '✓' : '○'}</span>
                      <span>1 Uppercase (A-Z)</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: hasLower ? '#059669' : '#94A3B8', fontWeight: hasLower ? 600 : 400 }}>
                      <span style={{ fontWeight: 700 }}>{hasLower ? '✓' : '○'}</span>
                      <span>1 Lowercase (a-z)</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: hasNumber ? '#059669' : '#94A3B8', fontWeight: hasNumber ? 600 : 400 }}>
                      <span style={{ fontWeight: 700 }}>{hasNumber ? '✓' : '○'}</span>
                      <span>1 Number (0-9)</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: hasSpecial ? '#059669' : '#94A3B8', fontWeight: hasSpecial ? 600 : 400, gridColumn: 'span 2' }}>
                      <span style={{ fontWeight: 700 }}>{hasSpecial ? '✓' : '○'}</span>
                      <span>1 Special symbol (!@#$%^&*)</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Confirm Password */}
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: '#334155', marginBottom: 6 }}>
                  Confirm New Password
                </label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 14 }}>
                    🔒
                  </span>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="Re-enter password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 12px 10px 36px',
                      fontSize: 13.5,
                      border: `1.5px solid ${confirmPassword && confirmPassword !== newPassword ? '#EF4444' : '#E2E8F0'}`,
                      borderRadius: 8,
                      outline: 'none',
                      color: '#0F172A',
                      background: '#F8FAFC'
                    }}
                    onFocus={(e) => (e.target.style.borderColor = '#007A5E')}
                    onBlur={(e) => (e.target.style.borderColor = '#E2E8F0')}
                  />
                </div>
                {confirmPassword && confirmPassword !== newPassword && (
                  <span style={{ fontSize: 11.5, color: '#EF4444', marginTop: 3, display: 'block' }}>
                    Passwords do not match
                  </span>
                )}
              </div>

              <button
                type="submit"
                disabled={isLoading}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  background: 'linear-gradient(135deg, #004D40 0%, #007A5E 100%)',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: 8,
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: isLoading ? 'not-allowed' : 'pointer',
                  boxShadow: '0 4px 12px rgba(0, 77, 64, 0.25)',
                  opacity: isLoading ? 0.75 : 1
                }}
              >
                {isLoading ? 'Resetting password...' : 'Update Password & Save'}
              </button>
            </form>

            <div style={{ marginTop: 18, textAlign: 'center' }}>
              <button
                type="button"
                onClick={() => {
                  setStep('email');
                  setErrorMessage(null);
                  setSuccessMessage(null);
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: 12.5,
                  fontWeight: 600,
                  color: '#64748B',
                  cursor: 'pointer'
                }}
              >
                ← Use a different email
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: Success Confirmation */}
        {step === 'success' && (
          <div style={{ textAlign: 'center', padding: '12px 0' }}>
            <div style={{
              width: 56,
              height: 56,
              borderRadius: '50%',
              background: '#D1FAE5',
              color: '#059669',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 26,
              marginBottom: 16
            }}>
              ✓
            </div>
            <h2 style={{ fontSize: 22, fontWeight: 700, color: '#0F172A', margin: '0 0 8px 0' }}>
              Password Reset Complete
            </h2>
            <p style={{ fontSize: 13.5, color: '#64748B', margin: '0 0 24px 0', lineHeight: 1.5 }}>
              Your password has been securely updated. You can now log in to the HVEL Security Portal with your new credentials.
            </p>

            <Link
              href="/login"
              style={{
                display: 'block',
                width: '100%',
                padding: '12px 16px',
                background: 'linear-gradient(135deg, #004D40 0%, #007A5E 100%)',
                color: '#FFFFFF',
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 700,
                textDecoration: 'none',
                boxShadow: '0 4px 12px rgba(0, 77, 64, 0.25)'
              }}
            >
              Go to Sign In →
            </Link>
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div style={{ marginTop: 20, textAlign: 'center', fontSize: 12, color: '#94A3B8' }}>
        Protected by Attest Authentication Protocol
      </div>
    </div>
  );
}
