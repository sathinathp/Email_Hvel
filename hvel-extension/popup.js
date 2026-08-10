let currentMode = 'with_link';
let activeTab = 'login'; // 'login' or 'signup'
let currentSiteType = 'gmail'; // 'gmail' or 'outlook'

// Load saved settings and check auth status on popup open
document.addEventListener('DOMContentLoaded', () => {
  // Query active tab to check the current site context
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs && tabs[0] && tabs[0].url) {
      const url = tabs[0].url;
      if (
        url.includes('outlook.live.com') ||
        url.includes('outlook.office.com') ||
        url.includes('outlook.office365.com') ||
        url.includes('outlook.cloud.microsoft') ||
        url.includes('mail.dialog.office.com')
      ) {
        currentSiteType = 'outlook';
      }
    }

    // Update UI headers / indicators for Gmail vs Outlook
    updateSiteTypeUI();

    // Load global settings
    chrome.storage.local.get(['hvel_stamp_mode', 'hvel_verify_received', 'hvel_enable_nudge'], (result) => {
      currentMode = result.hvel_stamp_mode || 'with_link';
      applyModeUI(currentMode);
      
      const verifyCheckbox = document.getElementById('verifyReceivedCheckbox');
      if (verifyCheckbox) {
        verifyCheckbox.checked = !!result.hvel_verify_received;
      }

      const nudgeCheckbox = document.getElementById('enableNudgeCheckbox');
      if (nudgeCheckbox) {
        nudgeCheckbox.checked = !!result.hvel_enable_nudge;
      }
    });

    const linkCard = document.getElementById('optionLink');
    const hashCard = document.getElementById('optionHash');
    const saveBtn = document.getElementById('saveBtn');
    const verifyCheckbox = document.getElementById('verifyReceivedCheckbox');
    const nudgeCheckbox = document.getElementById('enableNudgeCheckbox');

    if (linkCard) {
      linkCard.addEventListener('click', () => selectMode('with_link'));
    }
    if (hashCard) {
      hashCard.addEventListener('click', () => selectMode('hash_only'));
    }
    if (verifyCheckbox) {
      verifyCheckbox.addEventListener('change', saveSettings);
    }
    if (nudgeCheckbox) {
      nudgeCheckbox.addEventListener('change', saveSettings);
    }
    if (saveBtn) {
      saveBtn.addEventListener('click', saveSettings);
    }

    // View tab switching (Settings vs Linked Accounts vs Audit Log)
    const btnTabSettings = document.getElementById('btnTabSettings');
    const btnTabAliases = document.getElementById('btnTabAliases');
    const btnTabAudit = document.getElementById('btnTabAudit');
    const settingsTabContent = document.getElementById('settingsTabContent');
    const aliasesTabContent = document.getElementById('aliasesTabContent');
    const auditTabContent = document.getElementById('auditTabContent');

    if (btnTabSettings && btnTabAliases && btnTabAudit && settingsTabContent && aliasesTabContent && auditTabContent) {
      btnTabSettings.addEventListener('click', () => {
        btnTabSettings.classList.add('active');
        btnTabSettings.style.color = '#0f172a';
        btnTabSettings.style.borderBottomColor = '#0f172a';
        btnTabSettings.style.fontWeight = '600';

        btnTabAliases.classList.remove('active');
        btnTabAliases.style.color = '#64748b';
        btnTabAliases.style.borderBottomColor = 'transparent';
        btnTabAliases.style.fontWeight = '500';

        btnTabAudit.classList.remove('active');
        btnTabAudit.style.color = '#64748b';
        btnTabAudit.style.borderBottomColor = 'transparent';
        btnTabAudit.style.fontWeight = '500';

        settingsTabContent.style.display = 'flex';
        aliasesTabContent.style.display = 'none';
        auditTabContent.style.display = 'none';
        if (saveBtn) saveBtn.style.display = 'block';
      });

      btnTabAliases.addEventListener('click', () => {
        btnTabAliases.classList.add('active');
        btnTabAliases.style.color = '#0f172a';
        btnTabAliases.style.borderBottomColor = '#0f172a';
        btnTabAliases.style.fontWeight = '600';

        btnTabSettings.classList.remove('active');
        btnTabSettings.style.color = '#64748b';
        btnTabSettings.style.borderBottomColor = 'transparent';
        btnTabSettings.style.fontWeight = '500';

        btnTabAudit.classList.remove('active');
        btnTabAudit.style.color = '#64748b';
        btnTabAudit.style.borderBottomColor = 'transparent';
        btnTabAudit.style.fontWeight = '500';

        settingsTabContent.style.display = 'none';
        aliasesTabContent.style.display = 'flex';
        auditTabContent.style.display = 'none';
        if (saveBtn) saveBtn.style.display = 'none';

        updateAliasesUI();
      });

      btnTabAudit.addEventListener('click', () => {
        btnTabAudit.classList.add('active');
        btnTabAudit.style.color = '#0f172a';
        btnTabAudit.style.borderBottomColor = '#0f172a';
        btnTabAudit.style.fontWeight = '600';

        btnTabSettings.classList.remove('active');
        btnTabSettings.style.color = '#64748b';
        btnTabSettings.style.borderBottomColor = 'transparent';
        btnTabSettings.style.fontWeight = '500';

        btnTabAliases.classList.remove('active');
        btnTabAliases.style.color = '#64748b';
        btnTabAliases.style.borderBottomColor = 'transparent';
        btnTabAliases.style.fontWeight = '500';

        settingsTabContent.style.display = 'none';
        aliasesTabContent.style.display = 'none';
        auditTabContent.style.display = 'flex';
        if (saveBtn) saveBtn.style.display = 'none';
        
        updateAuditUI();

        chrome.runtime.sendMessage({ action: 'getAuditLogs', siteType: currentSiteType }, (res) => {
          if (res && res.success) {
            updateAuditUI();
          }
        });
      });
    }

    // Alias Add binding
    const btnAddAlias = document.getElementById('btnAddAlias');
    const aliasEmailInput = document.getElementById('aliasEmailInput');
    const aliasError = document.getElementById('aliasError');
    const aliasOtpArea = document.getElementById('aliasOtpArea');
    const aliasOtpInput = document.getElementById('aliasOtpInput');
    const btnVerifyAlias = document.getElementById('btnVerifyAlias');

    function resetAliasForm() {
      chrome.storage.local.remove(['hvel_alias_otp_pending_email']);
      if (aliasEmailInput) {
        aliasEmailInput.value = '';
        aliasEmailInput.disabled = false;
      }
      if (aliasOtpInput) {
        aliasOtpInput.value = '';
      }
      if (btnAddAlias) {
        btnAddAlias.innerText = 'Link';
        btnAddAlias.disabled = false;
      }
      if (aliasOtpArea) {
        aliasOtpArea.style.display = 'none';
      }
      if (aliasError) {
        aliasError.style.display = 'none';
      }
    }

    if (btnAddAlias && aliasEmailInput) {
      btnAddAlias.addEventListener('click', () => {
        if (aliasError) aliasError.style.display = 'none';

        if (btnAddAlias.innerText === 'Cancel') {
          resetAliasForm();
          return;
        }

        const aliasEmail = aliasEmailInput.value.trim();
        if (!aliasEmail || !aliasEmail.includes('@')) {
          if (aliasError) {
            aliasError.innerText = 'Please enter a valid email address.';
            aliasError.style.display = 'block';
          }
          return;
        }

        btnAddAlias.disabled = true;
        btnAddAlias.innerText = 'Sending...';
        aliasEmailInput.disabled = true;

        chrome.runtime.sendMessage({
          action: 'requestAliasOtp',
          aliasEmail: aliasEmail,
          siteType: currentSiteType
        }, (res) => {
          if (res && res.success) {
            chrome.storage.local.set({ hvel_alias_otp_pending_email: aliasEmail }, () => {
              btnAddAlias.disabled = false;
              btnAddAlias.innerText = 'Cancel';
              if (aliasOtpArea) aliasOtpArea.style.display = 'flex';
              if (aliasOtpInput) aliasOtpInput.focus();
            });
          } else {
            aliasEmailInput.disabled = false;
            btnAddAlias.disabled = false;
            btnAddAlias.innerText = 'Link';
            if (aliasError) {
              aliasError.innerText = res?.error || res?.message || 'Failed to send verification code.';
              aliasError.style.display = 'block';
            }
          }
        });
      });
    }

    if (btnVerifyAlias && aliasOtpInput) {
      btnVerifyAlias.addEventListener('click', () => {
        if (aliasError) aliasError.style.display = 'none';

        const otp = aliasOtpInput.value.trim();
        if (otp.length !== 6 || isNaN(otp)) {
          if (aliasError) {
            aliasError.innerText = 'Please enter a 6-digit verification code.';
            aliasError.style.display = 'block';
          }
          return;
        }

        btnVerifyAlias.disabled = true;
        btnVerifyAlias.innerText = 'Verifying...';
        aliasOtpInput.disabled = true;

        const aliasEmail = aliasEmailInput.value.trim();

        chrome.runtime.sendMessage({
          action: 'addAlias',
          aliasEmail: aliasEmail,
          otp: otp,
          siteType: currentSiteType
        }, (res) => {
          btnVerifyAlias.disabled = false;
          btnVerifyAlias.innerText = 'Verify';
          aliasOtpInput.disabled = false;

          if (res && res.success) {
            chrome.storage.local.remove(['hvel_alias_otp_pending_email'], () => {
              resetAliasForm();
              updateAliasesUI();
            });
          } else {
            if (aliasError) {
              aliasError.innerText = res?.error || res?.message || 'Failed to link email alias.';
              aliasError.style.display = 'block';
            }
          }
        });
      });
    }

    const btnClearAudit = document.getElementById('btnClearAudit');
    if (btnClearAudit) {
      btnClearAudit.addEventListener('click', () => {
        const prefix = currentSiteType;
        chrome.storage.local.set({
          [`${prefix}_hvel_stats_sent_stamped_link`]: 0,
          [`${prefix}_hvel_stats_sent_stamped_hash`]: 0,
          [`${prefix}_hvel_stats_sent_unstamped`]: 0,
          [`${prefix}_hvel_stats_received_stamped`]: 0,
          [`${prefix}_hvel_stats_received_unstamped`]: 0,
          [`${prefix}_hvel_audit_log`]: []
        }, () => {
          updateAuditUI();
          chrome.runtime.sendMessage({ action: 'clearAuditLogs', siteType: currentSiteType });
        });
      });
    }

    // Authentication UI bindings
    initAuthUI();
    checkAuthStatus();

    // Close Audit Log Detail Modal
    const auditDetailModal = document.getElementById('auditDetailModal');
    const closeAuditModal = document.getElementById('closeAuditModal');
    if (closeAuditModal && auditDetailModal) {
      closeAuditModal.addEventListener('click', () => {
        auditDetailModal.style.display = 'none';
      });
      auditDetailModal.addEventListener('click', (e) => {
        if (e.target === auditDetailModal) {
          auditDetailModal.style.display = 'none';
        }
      });
    }
  });
});

function updateSiteTypeUI() {
  const brandSub = document.getElementById('brandSub');
  const statusDot = document.getElementById('statusDot');
  const emailInput = document.getElementById('authEmail');
  const footerText = document.querySelector('.footer-text');

  if (currentSiteType === 'outlook') {
    if (brandSub) brandSub.innerText = 'Attest Outlook Profile';
    if (statusDot) {
      statusDot.setAttribute('title', 'Active on Outlook');
      statusDot.style.background = '#0078d4'; // Outlook Blue
    }
    if (emailInput) {
      emailInput.placeholder = 'you@outlook.com';
    }
    if (footerText) {
      footerText.innerText = 'v1.0.0 · Active on Outlook';
    }
  } else {
    if (brandSub) brandSub.innerText = 'Attest Gmail Profile';
    if (statusDot) {
      statusDot.setAttribute('title', 'Active on Gmail');
      statusDot.style.background = '#10b981'; // Gmail Active Green
    }
    if (emailInput) {
      emailInput.placeholder = 'you@gmail.com';
    }
    if (footerText) {
      footerText.innerText = 'v1.0.0 · Active on Gmail';
    }
  }
}

function selectMode(mode) {
  currentMode = mode;
  applyModeUI(mode);
  saveSettings();
}

function applyModeUI(mode) {
  const linkCard = document.getElementById('optionLink');
  const hashCard = document.getElementById('optionHash');
  if (linkCard && hashCard) {
    if (mode === 'with_link') {
      linkCard.classList.add('active');
      hashCard.classList.remove('active');
    } else {
      hashCard.classList.add('active');
      linkCard.classList.remove('active');
    }
  }
}

function saveSettings() {
  const verifyCheckbox = document.getElementById('verifyReceivedCheckbox');
  const verifyReceived = verifyCheckbox ? verifyCheckbox.checked : false;

  const nudgeCheckbox = document.getElementById('enableNudgeCheckbox');
  const enableNudge = nudgeCheckbox ? nudgeCheckbox.checked : false;

  chrome.storage.local.set({ 
    hvel_stamp_mode: currentMode,
    hvel_verify_received: verifyReceived,
    hvel_enable_nudge: enableNudge
  });
}

// ─── AUTHENTICATION FLOWS ───────────────────────────────────────────────────

function initAuthUI() {
  const authSubmitBtn = document.getElementById('authSubmitBtn');
  const logoutBtn = document.getElementById('logoutBtn');
  const btnChangeEmail = document.getElementById('btnChangeEmail');
  const btnResendOtp = document.getElementById('btnResendOtp');

  if (authSubmitBtn) {
    authSubmitBtn.addEventListener('click', handleAuthSubmit);
  }
  if (logoutBtn) {
    logoutBtn.addEventListener('click', handleLogout);
  }
  if (btnChangeEmail) {
    btnChangeEmail.addEventListener('click', resetAuthForm);
  }
  if (btnResendOtp) {
    btnResendOtp.addEventListener('click', handleResendOtp);
  }

  // Allow enter key submission
  const emailInput = document.getElementById('authEmail');
  if (emailInput) {
    emailInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        handleAuthSubmit();
      }
    });
  }

  const otpInput = document.getElementById('authOtpInput');
  if (otpInput) {
    otpInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        handleAuthSubmit();
      }
    });
  }
}

function resetAuthForm() {
  const emailInput = document.getElementById('authEmail');
  const otpInput = document.getElementById('authOtpInput');
  const authOtpArea = document.getElementById('authOtpArea');
  const authLinksArea = document.getElementById('authLinksArea');
  const authSubmitBtn = document.getElementById('authSubmitBtn');
  const msgDiv = document.getElementById('authMessage');

  if (emailInput) {
    emailInput.disabled = false;
  }
  if (otpInput) {
    otpInput.value = '';
    otpInput.disabled = false;
  }
  if (authOtpArea) {
    authOtpArea.style.display = 'none';
  }
  if (authLinksArea) {
    authLinksArea.style.display = 'none';
  }
  if (authSubmitBtn) {
    authSubmitBtn.innerText = 'Send Verification Code';
    authSubmitBtn.disabled = false;
  }
  if (msgDiv) {
    msgDiv.style.display = 'none';
  }
}

function handleResendOtp() {
  const emailInput = document.getElementById('authEmail');
  if (!emailInput) return;
  const email = emailInput.value.trim();

  showAuthMessage('Sending new code...', false);

  chrome.runtime.sendMessage({
    action: 'sendLoginOtp',
    email: email
  }, (res) => {
    if (res && res.success) {
      showAuthMessage('✓ A new verification code has been sent.', false);
      const otpInput = document.getElementById('authOtpInput');
      if (otpInput) {
        otpInput.value = '';
        otpInput.focus();
      }
    } else {
      showAuthMessage(res?.message || res?.error || 'Failed to resend code.', true);
    }
  });
}

function checkAuthStatus() {
  chrome.storage.local.get(
    [
      'hvel_auth_email',
      'hvel_auth_token',
      'hvel_plan',
      'hvel_usage',
      'hvel_plan_details',
      'hvel_is_alias',
      'hvel_primary_email',
      'hvel_auth_otp_pending_email'
    ],
    (result) => {
      const authView = document.getElementById('authView');
      const mainView = document.getElementById('mainView');
      const saveBtn = document.getElementById('saveBtn');

      const email = result.hvel_auth_email;
      const token = result.hvel_auth_token;
      const plan = result.hvel_plan;
      const usage = result.hvel_usage;
      const planDetails = result.hvel_plan_details;
      const isAlias = result.hvel_is_alias;
      const primaryEmail = result.hvel_primary_email;
      const pendingEmail = result.hvel_auth_otp_pending_email;

      if (token && email) {
        authView.style.display = 'none';
        mainView.style.display = 'block';
        if (saveBtn) saveBtn.style.display = 'block';

        updateAccountUI(email, plan, usage, planDetails, isAlias, primaryEmail);

        // Fetch fresh plan status in background
        chrome.runtime.sendMessage({
          action: 'getPlanStatus',
          email: email,
          siteType: currentSiteType
        }, (res) => {
          if (res && res.success) {
            updateAccountUI(res.email, res.plan, res.usage, res.planDetails, res.isAlias, res.primaryEmail);
          }
        });

        // Fetch fresh audit logs in background
        chrome.runtime.sendMessage({ action: 'getAuditLogs', siteType: currentSiteType }, (res) => {
          if (res && res.success) {
            updateAuditUI();
          }
        });
      } else {
        mainView.style.display = 'none';
        authView.style.display = 'block';
        if (saveBtn) saveBtn.style.display = 'none';

        // Restore pending login OTP state if exists
        if (pendingEmail) {
          const emailInput = document.getElementById('authEmail');
          const otpInput = document.getElementById('authOtpInput');
          const authOtpArea = document.getElementById('authOtpArea');
          const authLinksArea = document.getElementById('authLinksArea');
          const authSubmitBtn = document.getElementById('authSubmitBtn');

          if (emailInput) {
            emailInput.value = pendingEmail;
            emailInput.disabled = true;
          }
          if (authOtpArea) authOtpArea.style.display = 'block';
          if (authLinksArea) authLinksArea.style.display = 'flex';
          if (authSubmitBtn) authSubmitBtn.innerText = 'Verify & Log In';
          showAuthMessage('✓ Verification code sent to your email. Enter it below.', false);
        } else {
          // Explicit reset back to initial state if no active pending OTP request
          const emailInput = document.getElementById('authEmail');
          const otpInput = document.getElementById('authOtpInput');
          const authOtpArea = document.getElementById('authOtpArea');
          const authLinksArea = document.getElementById('authLinksArea');
          const authSubmitBtn = document.getElementById('authSubmitBtn');
          const msgDiv = document.getElementById('authMessage');

          if (emailInput) emailInput.disabled = false;
          if (otpInput) {
            otpInput.value = '';
            otpInput.disabled = false;
          }
          if (authOtpArea) authOtpArea.style.display = 'none';
          if (authLinksArea) authLinksArea.style.display = 'none';
          if (authSubmitBtn) {
            authSubmitBtn.innerText = 'Send Verification Code';
            authSubmitBtn.disabled = false;
          }
          if (msgDiv) msgDiv.style.display = 'none';
        }
      }
    }
  );
}

function updateAccountUI(email, plan, usage, planDetails, isAlias, primaryEmail) {
  const emailSpan = document.getElementById('userEmailSpan');
  const planBadge = document.getElementById('userPlanBadge');
  const usageSpan = document.getElementById('userUsageSpan');
  const upgradeBtn = document.getElementById('upgradeBtn');
  const proActiveLabel = document.getElementById('proActiveLabel');

  if (emailSpan) emailSpan.innerText = email;

  const planKey = plan || 'free';
  if (planBadge) {
    planBadge.innerText = planKey;
    if (planKey.toLowerCase() === 'professional') {
      planBadge.style.background = '#f0fdf4';
      planBadge.style.color = '#166534';
      planBadge.style.borderColor = '#bbf7d0';
      if (upgradeBtn) upgradeBtn.style.display = 'none';
      if (proActiveLabel) proActiveLabel.style.display = 'inline-block';
    } else {
      planBadge.style.background = '#f1f5f9';
      planBadge.style.color = '#475569';
      planBadge.style.borderColor = '#cbd5e1';
      if (upgradeBtn) {
        upgradeBtn.style.display = 'inline-block';
        upgradeBtn.href = `https://attest.page/pricing?email=${encodeURIComponent(email)}`;
      }
      if (proActiveLabel) proActiveLabel.style.display = 'none';
    }
  }

  if (usageSpan) {
    const limit = planDetails?.totp_daily_limit === Infinity || planDetails?.totp_daily_limit === 'unlimited' ? 'unlimited' : (planDetails?.totp_daily_limit || 3);
    const used = usage?.totp_used_today || 0;
    usageSpan.innerText = `Daily verifications: ${used} / ${limit} used`;
  }
  
  // Update the aliases view (locked vs active) based on the loaded plan
  updateAliasesUI(isAlias, primaryEmail);
}

function showAuthMessage(text, isError = true) {
  const msgDiv = document.getElementById('authMessage');
  if (msgDiv) {
    msgDiv.innerText = text;
    msgDiv.style.display = 'block';
    if (isError) {
      msgDiv.style.background = '#fef2f2';
      msgDiv.style.color = '#991b1b';
      msgDiv.style.border = '1px solid #fee2e2';
    } else {
      msgDiv.style.background = '#f0fdf4';
      msgDiv.style.color = '#166534';
      msgDiv.style.border = '1px solid #bbf7d0';
    }
  }
}

function handleAuthSubmit() {
  const emailInput = document.getElementById('authEmail');
  const otpInput = document.getElementById('authOtpInput');
  const authOtpArea = document.getElementById('authOtpArea');
  const authLinksArea = document.getElementById('authLinksArea');
  const authSubmitBtn = document.getElementById('authSubmitBtn');

  if (!emailInput || !authSubmitBtn) return;

  const email = emailInput.value.trim();

  // Basic email validation regex
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email || !emailRegex.test(email)) {
    showAuthMessage('Please enter a valid email address.', true);
    return;
  }

  const isOtpVisible = authOtpArea && authOtpArea.style.display !== 'none';

  if (!isOtpVisible) {
    // Phase 1: Request OTP
    authSubmitBtn.disabled = true;
    authSubmitBtn.innerText = 'Sending Code...';
    emailInput.disabled = true;

    chrome.runtime.sendMessage({
      action: 'sendLoginOtp',
      email: email
    }, (res) => {
      authSubmitBtn.disabled = false;
      if (res && res.success) {
        chrome.storage.local.set({ hvel_auth_otp_pending_email: email }, () => {
          authSubmitBtn.innerText = 'Verify & Log In';
          if (authOtpArea) authOtpArea.style.display = 'block';
          if (authLinksArea) authLinksArea.style.display = 'flex';
          if (otpInput) {
            otpInput.value = '';
            otpInput.focus();
          }
          showAuthMessage('✓ Verification code sent to your email.', false);
        });
      } else {
        emailInput.disabled = false;
        authSubmitBtn.innerText = 'Send Verification Code';
        showAuthMessage(res?.message || res?.error || 'Failed to send verification code.', true);
      }
    });
  } else {
    // Phase 2: Verify OTP
    if (!otpInput) return;
    const otp = otpInput.value.trim();
    if (otp.length !== 6 || isNaN(otp)) {
      showAuthMessage('Please enter a 6-digit verification code.', true);
      return;
    }

    authSubmitBtn.disabled = true;
    authSubmitBtn.innerText = 'Verifying...';
    otpInput.disabled = true;

    chrome.runtime.sendMessage({
      action: 'verifyLoginOtp',
      email: email,
      otp: otp,
      siteType: currentSiteType
    }, (res) => {
      authSubmitBtn.disabled = false;
      otpInput.disabled = false;

      if (res && res.success) {
        chrome.storage.local.remove(['hvel_auth_otp_pending_email'], () => {
          resetAuthForm();
          emailInput.value = '';
          checkAuthStatus();
        });
      } else {
        authSubmitBtn.innerText = 'Verify & Log In';
        showAuthMessage(res?.message || res?.error || 'The code entered is invalid or expired.', true);
      }
    });
  }
}

// Update the Brand Sub header tag in HTML too
document.addEventListener('DOMContentLoaded', () => {
  const brand = document.querySelector('.brand');
  if (brand) {
    // Add id="brandSub" to brand-sub class div if not present
    const sub = brand.querySelector('.brand-sub');
    if (sub && !sub.id) {
      sub.id = 'brandSub';
    }
  }
});

function handleLogout() {
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.disabled = true;
    logoutBtn.innerText = 'Logging out...';
  }

  chrome.runtime.sendMessage({ action: 'logout', siteType: currentSiteType }, (res) => {
    if (logoutBtn) {
      logoutBtn.disabled = false;
      logoutBtn.innerText = 'Log Out';
    }
    checkAuthStatus();
  });
}

function updateAuditUI() {
  const prefix = currentSiteType;
  chrome.storage.local.get([
    `${prefix}_hvel_stats_sent_stamped_link`,
    `${prefix}_hvel_stats_sent_stamped_hash`,
    `${prefix}_hvel_stats_sent_unstamped`,
    `${prefix}_hvel_stats_received_stamped`,
    `${prefix}_hvel_stats_received_unstamped`,
    `${prefix}_hvel_audit_log`
  ], (res) => {
    const auditLog = res[`${prefix}_hvel_audit_log`] || [];

    // Dynamically compute counts from audit log entries as fallback/sync protection
    let computedLink = 0;
    let computedHash = 0;
    let computedSentUnstamped = 0;
    let computedRecvStamped = 0;
    let computedRecvUnstamped = 0;

    auditLog.forEach(entry => {
      if (entry.type === 'sent_stamped_link') computedLink++;
      else if (entry.type === 'sent_stamped_hash') computedHash++;
      else if (entry.type === 'sent_unstamped') computedSentUnstamped++;
      else if (entry.type === 'received_stamped') computedRecvStamped++;
      else if (entry.type === 'received_unstamped') computedRecvUnstamped++;
    });

    const storedLink = res[`${prefix}_hvel_stats_sent_stamped_link`] || 0;
    const storedHash = res[`${prefix}_hvel_stats_sent_stamped_hash`] || 0;
    const totalSentStamped = Math.max(storedLink + storedHash, computedLink + computedHash);

    const storedSentUnstamped = res[`${prefix}_hvel_stats_sent_unstamped`] || 0;
    const totalSentUnstamped = Math.max(storedSentUnstamped, computedSentUnstamped);

    const storedRecvStamped = res[`${prefix}_hvel_stats_received_stamped`] || 0;
    const totalRecvStamped = Math.max(storedRecvStamped, computedRecvStamped);

    const storedRecvUnstamped = res[`${prefix}_hvel_stats_received_unstamped`] || 0;
    const totalRecvUnstamped = Math.max(storedRecvUnstamped, computedRecvUnstamped);

    const elSentStamped = document.getElementById('statSentStamped');
    const elSentUnstamped = document.getElementById('statSentUnstamped');
    const elRecvStamped = document.getElementById('statRecvStamped');
    const elRecvUnstamped = document.getElementById('statRecvUnstamped');

    if (elSentStamped) elSentStamped.innerText = totalSentStamped;
    if (elSentUnstamped) elSentUnstamped.innerText = totalSentUnstamped;
    if (elRecvStamped) elRecvStamped.innerText = totalRecvStamped;
    if (elRecvUnstamped) elRecvUnstamped.innerText = totalRecvUnstamped;

    const logList = document.getElementById('auditLogList');
    if (!logList) return;

    if (auditLog.length === 0) {
      logList.innerHTML = '<div style="font-size: 11px; color: #64748b; padding: 24px; text-align: center;">No audit history found</div>';
      return;
    }

    let html = '';
    auditLog.forEach(entry => {
      const timeStr = new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      const dateStr = new Date(entry.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' });

      let badgeHtml = '';
      let typeLabel = '';
      let rowAccent = '';
      if (entry.type === 'sent_stamped_link') {
        badgeHtml = '<span style="background:#d1fae5;color:#065f46;border:1px solid #a7f3d0;padding:2px 6px;border-radius:4px;font-size:9px;font-weight:700;">STAMP (LINK)</span>';
        typeLabel = 'Sent'; rowAccent = '#10b981';
      } else if (entry.type === 'sent_stamped_hash') {
        badgeHtml = '<span style="background:#e0f2fe;color:#0369a1;border:1px solid #bae6fd;padding:2px 6px;border-radius:4px;font-size:9px;font-weight:700;">STAMP (HASH)</span>';
        typeLabel = 'Sent'; rowAccent = '#0369a1';
      } else if (entry.type === 'sent_unstamped') {
        badgeHtml = '<span style="background:#f1f5f9;color:#475569;border:1px solid #e2e8f0;padding:2px 6px;border-radius:4px;font-size:9px;font-weight:700;">UNSTAMPED</span>';
        typeLabel = 'Sent'; rowAccent = '#94a3b8';
      } else if (entry.type === 'received_stamped') {
        badgeHtml = '<span style="background:#d1fae5;color:#166534;border:1px solid #bbf7d0;padding:2px 6px;border-radius:4px;font-size:9px;font-weight:700;">VERIFIED</span>';
        typeLabel = 'Recv'; rowAccent = '#10b981';
      } else if (entry.type === 'received_unstamped') {
        badgeHtml = '<span style="background:#fffbeb;color:#92400e;border:1px solid #fde68a;padding:2px 6px;border-radius:4px;font-size:9px;font-weight:700;">UNVERIFIED</span>';
        typeLabel = 'Recv'; rowAccent = '#f59e0b';
      }

      const encodedEntry = encodeURIComponent(JSON.stringify(entry));

      html += `
        <div class="audit-log-row"
          data-entry="${encodedEntry}"
          style="display:flex;align-items:center;justify-content:space-between;padding:8px 10px;border-bottom:1px solid #f1f5f9;gap:8px;cursor:pointer;transition:background 0.15s ease;border-left:3px solid ${rowAccent};">
          <div style="display:flex;flex-direction:column;gap:2px;overflow:hidden;flex:1;min-width:0;">
            <div style="font-size:10px;color:#0f172a;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
              <span style="color:#64748b;font-weight:500;">${typeLabel} to/from:</span> ${entry.email}
            </div>
            <div style="font-size:9px;color:#94a3b8;">${dateStr} · ${timeStr}</div>
          </div>
          <div style="display:flex;align-items:center;gap:5px;flex-shrink:0;">
            ${badgeHtml}
            <span style="color:#cbd5e1;font-size:11px;font-weight:600;">›</span>
          </div>
        </div>
      `;
    });

    logList.innerHTML = html;

    // Bind click listeners — use data-entry to avoid ID lookup failures
    logList.querySelectorAll('.audit-log-row').forEach(row => {
      row.addEventListener('mouseenter', () => { row.style.background = '#f8fafc'; });
      row.addEventListener('mouseleave', () => { row.style.background = ''; });
      row.addEventListener('click', () => {
        try {
          const entry = JSON.parse(decodeURIComponent(row.getAttribute('data-entry')));
          if (entry) showAuditDetailModal(entry);
        } catch(e) { console.error('[HVEL Popup] Failed to parse audit entry:', e); }
      });
    });
  });
}

function updateAliasesUI(isAlias, primaryEmail) {
  chrome.storage.local.get(['hvel_plan', 'hvel_is_alias', 'hvel_primary_email'], (res) => {
    const plan = res.hvel_plan || 'free';
    const resolvedIsAlias = typeof isAlias !== 'undefined' ? isAlias : !!res.hvel_is_alias;
    const resolvedPrimaryEmail = primaryEmail || res.hvel_primary_email || '';

    const lockedArea = document.getElementById('aliasesLockedArea');
    const activeArea = document.getElementById('aliasesActiveArea');
    const aliasArea = document.getElementById('aliasesAliasArea');
    const aliasOwnerSpan = document.getElementById('aliasPrimaryOwnerSpan');

    if (lockedArea) lockedArea.style.display = 'none';
    if (activeArea) activeArea.style.display = 'none';
    if (aliasArea) aliasArea.style.display = 'none';

    if (plan !== 'professional') {
      if (lockedArea) lockedArea.style.display = 'flex';
    } else if (resolvedIsAlias) {
      if (aliasArea) aliasArea.style.display = 'flex';
      if (aliasOwnerSpan) aliasOwnerSpan.innerText = resolvedPrimaryEmail;
    } else {
      if (activeArea) activeArea.style.display = 'flex';

      // Restore pending alias OTP state if exists
      chrome.storage.local.get(['hvel_alias_otp_pending_email'], (aliasRes) => {
        const pendingAlias = aliasRes.hvel_alias_otp_pending_email;
        const aliasEmailInput = document.getElementById('aliasEmailInput');
        const btnAddAlias = document.getElementById('btnAddAlias');
        const aliasOtpArea = document.getElementById('aliasOtpArea');
        const aliasOtpInput = document.getElementById('aliasOtpInput');

        if (pendingAlias) {
          if (aliasEmailInput) {
            aliasEmailInput.value = pendingAlias;
            aliasEmailInput.disabled = true;
          }
          if (btnAddAlias) {
            btnAddAlias.innerText = 'Cancel';
            btnAddAlias.disabled = false;
          }
          if (aliasOtpArea) {
            aliasOtpArea.style.display = 'flex';
          }
        }
      });

      // Load aliases from backend
      chrome.runtime.sendMessage({ action: 'getAliases', siteType: currentSiteType }, (res) => {
        const listDiv = document.getElementById('aliasList');
        const countSpan = document.getElementById('aliasCount');
        if (!listDiv) return;

        if (res && res.success && res.aliases) {
          const aliases = res.aliases;
          chrome.storage.local.set({ hvel_linked_aliases: aliases });
          if (countSpan) countSpan.innerText = aliases.length;

          if (aliases.length === 0) {
            listDiv.innerHTML = '<div style="font-size: 11px; color: #64748b; padding: 12px; text-align: center;">No linked email accounts found</div>';
          } else {
            listDiv.innerHTML = aliases.map(email => `
              <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; border-bottom: 1px solid #f1f5f9; font-size: 11px;">
                <span style="font-weight: 500; color: #334155; word-break: break-all; max-width: 180px;">${email}</span>
                <button class="delete-alias-btn" data-email="${email}" style="background: none; border: none; color: #ef4444; font-weight: 600; cursor: pointer; font-size: 10px; font-family: inherit; padding: 0;">Unlink</button>
              </div>
            `).join('');

            // Bind delete button listeners
            listDiv.querySelectorAll('.delete-alias-btn').forEach(btn => {
              btn.addEventListener('click', (e) => {
                const emailToDelete = e.target.getAttribute('data-email');
                if (confirm(`Are you sure you want to unlink ${emailToDelete}?`)) {
                  chrome.runtime.sendMessage({
                    action: 'deleteAlias',
                    aliasEmail: emailToDelete,
                    siteType: currentSiteType
                  }, (deleteRes) => {
                    if (deleteRes && deleteRes.success) {
                      updateAliasesUI();
                    } else {
                      alert(deleteRes?.error || deleteRes?.message || 'Failed to unlink alias.');
                    }
                  });
                }
              });
            });
          }
        } else {
          listDiv.innerHTML = '<div style="font-size: 11px; color: #ef4444; padding: 12px; text-align: center;">Failed to load aliases</div>';
        }
      });
    }
  });
}

function showAuditDetailModal(entry) {
  const modal = document.getElementById('auditDetailModal');
  const headerIcon = document.getElementById('modalHeaderIcon');
  const statusBadge = document.getElementById('modalStatusBadge');
  const eventTypeEl = document.getElementById('modalEventType');
  const sender = document.getElementById('modalSender');
  const recipient = document.getElementById('modalRecipient');
  const timestamp = document.getElementById('modalTimestamp');
  const hashSection = document.getElementById('modalHashSection');
  const hashSpan = document.getElementById('modalHash');
  const urlSection = document.getElementById('modalUrlSection');
  const urlAnchor = document.getElementById('modalUrl');
  const closeBtn = document.getElementById('closeAuditModal');

  if (!modal) return;

  // Wire close button (once)
  if (closeBtn && !closeBtn._hvelBound) {
    closeBtn._hvelBound = true;
    closeBtn.addEventListener('click', () => { modal.style.display = 'none'; });
  }
  // Close on backdrop click
  if (!modal._hvelBound) {
    modal._hvelBound = true;
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.style.display = 'none';
    });
  }

  // Event type definitions
  const TYPE_MAP = {
    sent_stamped_link: {
      label: 'Outgoing — Verified Stamp (Link)',
      icon: '📤',
      badge: '<span style="background:#d1fae5;color:#065f46;border:1px solid #a7f3d0;padding:4px 10px;border-radius:6px;font-size:10px;font-weight:700;display:inline-block;">✅ Secure Stamp (Link)</span>'
    },
    sent_stamped_hash: {
      label: 'Outgoing — Verified Stamp (Hash Only)',
      icon: '📤',
      badge: '<span style="background:#e0f2fe;color:#0369a1;border:1px solid #bae6fd;padding:4px 10px;border-radius:6px;font-size:10px;font-weight:700;display:inline-block;">🔒 Secure Stamp (Hash)</span>'
    },
    sent_unstamped: {
      label: 'Outgoing — Sent Without Stamp',
      icon: '📤',
      badge: '<span style="background:#f1f5f9;color:#475569;border:1px solid #e2e8f0;padding:4px 10px;border-radius:6px;font-size:10px;font-weight:700;display:inline-block;">⬜ Unstamped Email</span>'
    },
    received_stamped: {
      label: 'Incoming — Sender is Human Verified',
      icon: '📥',
      badge: '<span style="background:#d1fae5;color:#166534;border:1px solid #bbf7d0;padding:4px 10px;border-radius:6px;font-size:10px;font-weight:700;display:inline-block;">✅ Verified Human Sender</span>'
    },
    received_unstamped: {
      label: 'Incoming — Sender Not Verified',
      icon: '📥',
      badge: '<span style="background:#fffbeb;color:#92400e;border:1px solid #fde68a;padding:4px 10px;border-radius:6px;font-size:10px;font-weight:700;display:inline-block;">⚠️ Unverified Sender</span>'
    }
  };

  const def = TYPE_MAP[entry.type] || { label: entry.type, icon: '📋', badge: '<span>' + entry.type + '</span>' };

  if (headerIcon) headerIcon.innerText = def.icon;
  if (statusBadge) statusBadge.innerHTML = def.badge;
  if (eventTypeEl) eventTypeEl.innerText = def.label;

  // Resolve Sender & Recipient from extra metadata or fallbacks
  const extra = entry.extra || {};
  chrome.storage.local.get(['hvel_auth_email'], (res) => {
    const userEmail = res.hvel_auth_email || 'You';
    let resolvedSender = extra.sender || '';
    let resolvedRecipient = extra.recipient || '';

    if (!resolvedSender || !resolvedRecipient) {
      if (entry.type && entry.type.startsWith('sent')) {
        resolvedSender = userEmail;
        resolvedRecipient = entry.email;
      } else {
        resolvedSender = entry.email;
        resolvedRecipient = userEmail;
      }
    }

    if (sender) sender.innerText = resolvedSender || '—';
    if (recipient) recipient.innerText = resolvedRecipient || '—';
  });

  // Timestamp — full locale string
  if (timestamp) timestamp.innerText = new Date(entry.timestamp).toLocaleString([], {
    weekday: 'short', year: 'numeric', month: 'short',
    day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit'
  });

  // Crypto Hash
  if (extra.contentHash) {
    if (hashSpan) hashSpan.innerText = extra.contentHash;
    if (hashSection) hashSection.style.display = 'flex';
  } else {
    if (hashSection) hashSection.style.display = 'none';
  }

  // Trust Page URL
  const verificationId = extra.verificationId;
  if (verificationId) {
    const verificationUrl = `https://attest.page/v/${verificationId}`;
    if (urlAnchor) {
      urlAnchor.href = verificationUrl;
      urlAnchor.innerText = `attest.page/v/${verificationId} ↗`;
    }
    if (urlSection) urlSection.style.display = 'flex';
  } else {
    if (urlSection) urlSection.style.display = 'none';
  }

  // Show modal
  modal.style.display = 'flex';
}
