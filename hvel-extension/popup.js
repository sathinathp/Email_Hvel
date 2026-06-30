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
    chrome.storage.local.get(['hvel_stamp_mode', 'hvel_verify_received'], (result) => {
      currentMode = result.hvel_stamp_mode || 'with_link';
      applyModeUI(currentMode);
      
      const verifyCheckbox = document.getElementById('verifyReceivedCheckbox');
      if (verifyCheckbox) {
        verifyCheckbox.checked = !!result.hvel_verify_received;
      }
    });

    const linkCard = document.getElementById('optionLink');
    const hashCard = document.getElementById('optionHash');
    const saveBtn = document.getElementById('saveBtn');
    const verifyCheckbox = document.getElementById('verifyReceivedCheckbox');

    if (linkCard) {
      linkCard.addEventListener('click', () => selectMode('with_link'));
    }
    if (hashCard) {
      hashCard.addEventListener('click', () => selectMode('hash_only'));
    }
    if (verifyCheckbox) {
      verifyCheckbox.addEventListener('change', saveSettings);
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

    if (btnAddAlias && aliasEmailInput) {
      btnAddAlias.addEventListener('click', () => {
        const aliasEmail = aliasEmailInput.value.trim();
        if (aliasError) aliasError.style.display = 'none';

        if (!aliasEmail || !aliasEmail.includes('@')) {
          if (aliasError) {
            aliasError.innerText = 'Please enter a valid email address.';
            aliasError.style.display = 'block';
          }
          return;
        }

        btnAddAlias.disabled = true;
        btnAddAlias.innerText = 'Linking...';

        chrome.runtime.sendMessage({
          action: 'addAlias',
          aliasEmail: aliasEmail,
          siteType: currentSiteType
        }, (res) => {
          btnAddAlias.disabled = false;
          btnAddAlias.innerText = 'Link';

          if (res && res.success) {
            aliasEmailInput.value = '';
            updateAliasesUI();
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

  chrome.storage.local.set({ 
    hvel_stamp_mode: currentMode,
    hvel_verify_received: verifyReceived
  }, () => {
    const toast = document.getElementById('toast');
    if (toast) {
      toast.classList.add('show');
      setTimeout(() => toast.classList.remove('show'), 2000);
    }
  });
}

// ─── AUTHENTICATION FLOWS ───────────────────────────────────────────────────

function initAuthUI() {
  const tabLogin = document.getElementById('tabLogin');
  const tabSignup = document.getElementById('tabSignup');
  const authSubmitBtn = document.getElementById('authSubmitBtn');
  const logoutBtn = document.getElementById('logoutBtn');

  if (tabLogin) {
    tabLogin.addEventListener('click', () => switchTab('login'));
  }
  if (tabSignup) {
    tabSignup.addEventListener('click', () => switchTab('signup'));
  }
  if (authSubmitBtn) {
    authSubmitBtn.addEventListener('click', handleAuthSubmit);
  }
  if (logoutBtn) {
    logoutBtn.addEventListener('click', handleLogout);
  }

  // Allow enter key submission
  const inputs = ['authEmail', 'authPassword'];
  inputs.forEach(id => {
    const input = document.getElementById(id);
    if (input) {
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          handleAuthSubmit();
        }
      });
    }
  });
}

function switchTab(tab) {
  activeTab = tab;
  const tabLogin = document.getElementById('tabLogin');
  const tabSignup = document.getElementById('tabSignup');
  const authSubmitBtn = document.getElementById('authSubmitBtn');
  const msgDiv = document.getElementById('authMessage');

  if (msgDiv) msgDiv.style.display = 'none';

  if (tab === 'login') {
    tabLogin.classList.add('active');
    tabLogin.style.borderBottom = '2px solid #0f172a';
    tabLogin.style.color = '#0f172a';
    tabLogin.style.fontWeight = '600';

    tabSignup.classList.remove('active');
    tabSignup.style.borderBottom = '2px solid transparent';
    tabSignup.style.color = '#64748b';
    tabSignup.style.fontWeight = '500';

    authSubmitBtn.innerText = 'Sign In';
  } else {
    tabSignup.classList.add('active');
    tabSignup.style.borderBottom = '2px solid #0f172a';
    tabSignup.style.color = '#0f172a';
    tabSignup.style.fontWeight = '600';

    tabLogin.classList.remove('active');
    tabLogin.style.borderBottom = '2px solid transparent';
    tabLogin.style.color = '#64748b';
    tabLogin.style.fontWeight = '500';

    authSubmitBtn.innerText = 'Create Account';
  }
}

function checkAuthStatus() {
  const prefix = currentSiteType;
  chrome.storage.local.get(
    [
      `${prefix}_hvel_auth_email`,
      `${prefix}_hvel_auth_token`,
      `${prefix}_hvel_plan`,
      `${prefix}_hvel_usage`,
      `${prefix}_hvel_plan_details`
    ],
    (result) => {
      const authView = document.getElementById('authView');
      const mainView = document.getElementById('mainView');
      const saveBtn = document.getElementById('saveBtn');

      const email = result[`${prefix}_hvel_auth_email`];
      const token = result[`${prefix}_hvel_auth_token`];
      const plan = result[`${prefix}_hvel_plan`];
      const usage = result[`${prefix}_hvel_usage`];
      const planDetails = result[`${prefix}_hvel_plan_details`];

      if (token && email) {
        authView.style.display = 'none';
        mainView.style.display = 'block';
        if (saveBtn) saveBtn.style.display = 'block';

        updateAccountUI(email, plan, usage, planDetails);

        // Fetch fresh plan status in background
        chrome.runtime.sendMessage({
          action: 'getPlanStatus',
          email: email,
          siteType: currentSiteType
        }, (res) => {
          if (res && res.success) {
            updateAccountUI(res.email, res.plan, res.usage, res.planDetails);
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
      }
    }
  );
}

function updateAccountUI(email, plan, usage, planDetails) {
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
  updateAliasesUI();
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
  const passwordInput = document.getElementById('authPassword');
  const authSubmitBtn = document.getElementById('authSubmitBtn');

  if (!emailInput || !passwordInput) return;

  const email = emailInput.value.trim();
  const password = passwordInput.value;

  if (!email || !password) {
    showAuthMessage('Please fill in all fields.');
    return;
  }

  // Basic email validation regex
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    showAuthMessage('Please enter a valid email address.');
    return;
  }

  if (password.length < 6) {
    showAuthMessage('Password must be at least 6 characters.');
    return;
  }

  // Disable button and inputs during loading
  authSubmitBtn.disabled = true;
  authSubmitBtn.innerText = activeTab === 'login' ? 'Signing In...' : 'Registering...';

  const action = activeTab === 'login' ? 'login' : 'signup';

  chrome.runtime.sendMessage({
    action,
    email,
    password,
    siteType: currentSiteType
  }, (res) => {
    authSubmitBtn.disabled = false;
    authSubmitBtn.innerText = activeTab === 'login' ? 'Sign In' : 'Create Account';

    if (res && res.success) {
      // Clear password field
      passwordInput.value = '';
      checkAuthStatus();
    } else {
      showAuthMessage(res?.message || res?.error || 'Authentication request failed.');
    }
  });
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
    const linkSent = res[`${prefix}_hvel_stats_sent_stamped_link`] || 0;
    const hashSent = res[`${prefix}_hvel_stats_sent_stamped_hash`] || 0;
    const totalSentStamped = linkSent + hashSent;

    const elSentStamped = document.getElementById('statSentStamped');
    const elSentUnstamped = document.getElementById('statSentUnstamped');
    const elRecvStamped = document.getElementById('statRecvStamped');
    const elRecvUnstamped = document.getElementById('statRecvUnstamped');

    if (elSentStamped) elSentStamped.innerText = totalSentStamped;
    if (elSentUnstamped) elSentUnstamped.innerText = res[`${prefix}_hvel_stats_sent_unstamped`] || 0;
    if (elRecvStamped) elRecvStamped.innerText = res[`${prefix}_hvel_stats_received_stamped`] || 0;
    if (elRecvUnstamped) elRecvUnstamped.innerText = res[`${prefix}_hvel_stats_received_unstamped`] || 0;

    const logList = document.getElementById('auditLogList');
    if (!logList) return;

    const auditLog = res[`${prefix}_hvel_audit_log`] || [];
    if (auditLog.length === 0) {
      logList.innerHTML = '<div style="font-size: 11px; color: #64748b; padding: 24px; text-align: center;">No audit history found</div>';
      return;
    }

    let html = '';
    auditLog.forEach(entry => {
      const timeStr = new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      
      let badgeHtml = '';
      let typeLabel = '';
      if (entry.type === 'sent_stamped_link') {
        badgeHtml = '<span style="background:#d1fae5;color:#065f46;border:1px solid #a7f3d0;padding:2px 6px;border-radius:4px;font-size:9px;font-weight:600;">STAMP (LINK)</span>';
        typeLabel = 'Sent';
      } else if (entry.type === 'sent_stamped_hash') {
        badgeHtml = '<span style="background:#e0f2fe;color:#0369a1;border:1px solid #bae6fd;padding:2px 6px;border-radius:4px;font-size:9px;font-weight:600;">STAMP (HASH)</span>';
        typeLabel = 'Sent';
      } else if (entry.type === 'sent_unstamped') {
        badgeHtml = '<span style="background:#f1f5f9;color:#475569;border:1px solid #e2e8f0;padding:2px 6px;border-radius:4px;font-size:9px;font-weight:600;">UNSTAMPED</span>';
        typeLabel = 'Sent';
      } else if (entry.type === 'received_stamped') {
        badgeHtml = '<span style="background:#d1fae5;color:#166534;border:1px solid #bbf7d0;padding:2px 6px;border-radius:4px;font-size:9px;font-weight:600;">VERIFIED</span>';
        typeLabel = 'Recv';
      } else if (entry.type === 'received_unstamped') {
        badgeHtml = '<span style="background:#fffbeb;color:#92400e;border:1px solid #fde68a;padding:2px 6px;border-radius:4px;font-size:9px;font-weight:600;">UNVERIFIED</span>';
        typeLabel = 'Recv';
      }

      html += `
        <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 10px;border-bottom:1px solid #f1f5f9;gap:8px;">
          <div style="display:flex;flex-direction:column;gap:2px;overflow:hidden;flex:1;">
            <div style="font-size:10px;color:#0f172a;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
              <span style="color:#64748b;font-weight:500;">${typeLabel} to/from:</span> ${entry.email}
            </div>
            <div style="font-size:9px;color:#94a3b8;">${timeStr}</div>
          </div>
          <div style="flex-shrink:0;">
            ${badgeHtml}
          </div>
        </div>
      `;
    });

    logList.innerHTML = html;
  });
}

function updateAliasesUI() {
  const prefix = currentSiteType;
  chrome.storage.local.get([`${prefix}_hvel_plan`], (res) => {
    const plan = res[`${prefix}_hvel_plan`] || 'free';
    const lockedArea = document.getElementById('aliasesLockedArea');
    const activeArea = document.getElementById('aliasesActiveArea');

    if (plan !== 'professional') {
      if (lockedArea) lockedArea.style.display = 'flex';
      if (activeArea) activeArea.style.display = 'none';
    } else {
      if (lockedArea) lockedArea.style.display = 'none';
      if (activeArea) activeArea.style.display = 'flex';

      // Load aliases from backend
      chrome.runtime.sendMessage({ action: 'getAliases', siteType: currentSiteType }, (res) => {
        const listDiv = document.getElementById('aliasList');
        const countSpan = document.getElementById('aliasCount');
        if (!listDiv) return;

        if (res && res.success && res.aliases) {
          const aliases = res.aliases;
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
