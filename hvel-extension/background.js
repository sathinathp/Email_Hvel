let API_BASE_URL = 'https://api.attest.page'; // Defaults to production; auto-switches to http://localhost:5000 if local server is running

// Helper to determine site context (gmail vs outlook)
function getSiteType(request, sender) {
  if (request && request.siteType) return request.siteType;
  if (sender && sender.tab && sender.tab.url) {
    const url = sender.tab.url;
    if (
      url.includes('outlook.live.com') ||
      url.includes('outlook.office.com') ||
      url.includes('outlook.office365.com') ||
      url.includes('outlook.cloud.microsoft') ||
      url.includes('mail.dialog.office.com')
    ) {
      return 'outlook';
    }
  }
  return 'gmail';
}

const SITE_SPECIFIC_KEYS = [
  'hvel_stats_sent_stamped_link',
  'hvel_stats_sent_stamped_hash',
  'hvel_stats_sent_unstamped',
  'hvel_stats_received_stamped',
  'hvel_stats_received_unstamped',
  'hvel_audit_log'
];

function getPrefixedValues(siteType, keys, callback) {
  const prefixedKeys = keys.map(k => SITE_SPECIFIC_KEYS.includes(k) ? `${siteType}_${k}` : k);
  chrome.storage.local.get(prefixedKeys, (res) => {
    const result = {};
    keys.forEach(k => {
      const realKey = SITE_SPECIFIC_KEYS.includes(k) ? `${siteType}_${k}` : k;
      result[k] = res[realKey];
    });
    callback(result);
  });
}

function setPrefixedValues(siteType, obj, callback) {
  const prefixedObj = {};
  for (let k in obj) {
    const realKey = SITE_SPECIFIC_KEYS.includes(k) ? `${siteType}_${k}` : k;
    prefixedObj[realKey] = obj[k];
  }
  chrome.storage.local.set(prefixedObj, callback);
}

function removePrefixedValues(siteType, keys, callback) {
  const prefixedKeys = keys.map(k => SITE_SPECIFIC_KEYS.includes(k) ? `${siteType}_${k}` : k);
  chrome.storage.local.remove(prefixedKeys, callback);
}

// Set default extension settings upon initial installation (Sender Trust Dots ON by default)
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(['hvel_verify_received', 'hvel_stamp_mode', 'hvel_enable_nudge'], (res) => {
    if (typeof res.hvel_verify_received === 'undefined') {
      chrome.storage.local.set({ hvel_verify_received: true });
    }
    if (typeof res.hvel_stamp_mode === 'undefined') {
      chrome.storage.local.set({ hvel_stamp_mode: 'with_link' });
    }
    if (typeof res.hvel_enable_nudge === 'undefined') {
      chrome.storage.local.set({ hvel_enable_nudge: false });
    }
  });
});

// Dynamically check if the local server is running on port 5000; if so, route requests to it first
function checkBackendUrl() {
  fetch('http://localhost:5000/health')
    .then((r) => {
      if (!r.ok) throw new Error('Not OK');
      return r.json();
    })
    .then((data) => {
      if (data && (data.service === 'hvel-backend' || data.message === 'HVEL Backend is running')) {
        if (API_BASE_URL !== 'http://localhost:5000') {
          API_BASE_URL = 'http://localhost:5000';
          console.log('[HVEL BG] 📡 Localhost HVEL backend detected! Routing API requests to: http://localhost:5000');
        }
      } else {
        if (API_BASE_URL !== 'https://api.attest.page') {
          API_BASE_URL = 'https://api.attest.page';
          console.log('[HVEL BG] 🌐 Service on port 5000 is not HVEL backend. Using production API: https://api.attest.page');
        }
      }
    })
    .catch(() => {
      if (API_BASE_URL !== 'https://api.attest.page') {
        API_BASE_URL = 'https://api.attest.page';
        console.log('[HVEL BG] 🌐 Localhost offline. Using production API: https://api.attest.page');
      }
    });
}

// Run check immediately and periodically (every 10 seconds)
checkBackendUrl();
setInterval(checkBackendUrl, 10000);

fetchAndCacheAliases('outlook');
fetchAndCacheAliases('gmail');

// Safe fetch helper that handles HTML / 502 Bad Gateway error pages from Nginx/Cloudflare gracefully
async function safeFetchJson(url, options = {}) {
  const r = await fetch(url, options);
  const ct = r.headers.get('content-type') || '';
  if (!ct.includes('application/json')) {
    const text = await r.text().catch(() => '');
    if (r.status === 502 || r.status === 503 || r.status === 504) {
      throw new Error(`Server is temporarily unavailable (${r.status} Bad Gateway). The Attest API service is offline.`);
    }
    if (r.status === 404) {
      throw new Error(`API endpoint not found (${r.status}).`);
    }
    if (r.status >= 400) {
      throw new Error(`Server returned error (${r.status}): ${text.substring(0, 100)}`);
    }
    throw new Error(`Non-JSON response (${r.status})`);
  }
  return r.json();
}

function fetchAndCacheAliases(siteType) {
  getPrefixedValues(siteType, ['hvel_auth_token'], (res) => {
    if (!res.hvel_auth_token) return;
    safeFetchJson(`${API_BASE_URL}/api/aliases`, {
      headers: { 'Authorization': `Bearer ${res.hvel_auth_token}` }
    })
    .then(data => {
      if (data && data.success && Array.isArray(data.aliases)) {
        chrome.storage.local.set({ hvel_linked_aliases: data.aliases });
        console.log(`[HVEL BG] 📧 Aliases cached for ${siteType}:`, data.aliases);
      }
    })
    .catch(() => {});
  });
}

// ─── PLAN STATUS: fetch on startup and cache for 10 mins ───────────────────────
function fetchAndCachePlanStatus(email, siteType) {
  if (!email || !siteType) return;
  fetchAndCacheAliases(siteType);
  getPrefixedValues(siteType, ['hvel_auth_token'], (res) => {
    const headers = { 'Content-Type': 'application/json' };
    if (res.hvel_auth_token) {
      headers['Authorization'] = `Bearer ${res.hvel_auth_token}`;
    }
    safeFetchJson(`${API_BASE_URL}/api/plan/status?email=${encodeURIComponent(email)}`, { headers })
      .then(data => {
        if (data.success) {
          setPrefixedValues(siteType, {
            hvel_plan: data.plan,
            hvel_plan_details: data.planDetails,
            hvel_usage: data.usage,
            hvel_plan_cached_at: Date.now(),
            hvel_is_alias: !!data.isAlias,
            hvel_primary_email: data.primaryEmail || null
          });
          console.log(`[HVEL BG] 📊 [${siteType}] Plan cached: ${data.plan} | TOTP today: ${data.usage.totp_used_today}/${data.planDetails.totp_daily_limit}`);
        }
      })
      .catch(() => {});
  });
}

// Listen for messages from the content script and popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  const siteType = getSiteType(request, sender);

  if (request.action === 'heartbeat') {
    fetch(`${API_BASE_URL}/api/heartbeat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: request.url })
    }).catch(() => {}); // Quietly fail
    return false;
  }

  if (request.action === 'forgotPassword') {
    safeFetchJson(`${API_BASE_URL}/api/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: request.email })
    })
    .then(data => sendResponse(data))
    .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }

  // ─── AUTHENTICATION ACTIONS ────────────────────────────────────────────────
  if (request.action === 'login') {
    safeFetchJson(`${API_BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: request.email, password: request.password })
    })
    .then(data => {
      if (data.success) {
        setPrefixedValues(siteType, {
          hvel_auth_email: data.email,
          hvel_auth_token: data.token
        }, () => {
          fetchAndCachePlanStatus(data.email, siteType);
          sendResponse(data);
        });
      } else {
        sendResponse(data);
      }
    })
    .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (request.action === 'sendLoginOtp') {
    safeFetchJson(`${API_BASE_URL}/api/auth/send-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': '1' },
      body: JSON.stringify({ email: request.email })
    })
    .then(data => sendResponse(data))
    .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (request.action === 'verifyLoginOtp') {
    safeFetchJson(`${API_BASE_URL}/api/auth/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: request.email, otp: request.otp })
    })
    .then(data => {
      if (data.success) {
        setPrefixedValues(siteType, {
          hvel_auth_email: data.email,
          hvel_auth_token: data.token
        }, () => {
          fetchAndCachePlanStatus(data.email, siteType);
          sendResponse(data);
        });
      } else {
        sendResponse(data);
      }
    })
    .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (request.action === 'signup') {
    safeFetchJson(`${API_BASE_URL}/api/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: request.email, password: request.password })
    })
    .then(data => {
      if (data.success) {
        setPrefixedValues(siteType, {
          hvel_auth_email: data.email,
          hvel_auth_token: data.token
        }, () => {
          fetchAndCachePlanStatus(data.email, siteType);
          sendResponse(data);
        });
      } else {
        sendResponse(data);
      }
    })
    .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (request.action === 'logout') {
    getPrefixedValues(siteType, ['hvel_auth_token'], (res) => {
      const headers = {};
      if (res.hvel_auth_token) {
        headers['Authorization'] = `Bearer ${res.hvel_auth_token}`;
      }
      fetch(`${API_BASE_URL}/api/auth/logout`, {
        method: 'POST',
        headers
      }).catch(() => {});
      
      removePrefixedValues(siteType, [
        'hvel_auth_email',
        'hvel_auth_token',
        'hvel_plan',
        'hvel_plan_details',
        'hvel_usage',
        'hvel_plan_cached_at',
        'hvel_stats_sent_stamped_link',
        'hvel_stats_sent_stamped_hash',
        'hvel_stats_sent_unstamped',
        'hvel_stats_received_stamped',
        'hvel_stats_received_unstamped',
        'hvel_audit_log'
      ], () => {
        sendResponse({ success: true });
      });
    });
    return true;
  }

  if (request.action === 'updateProfile') {
    getPrefixedValues(siteType, ['hvel_auth_token'], (res) => {
      const headers = { 'Content-Type': 'application/json' };
      if (res.hvel_auth_token) {
        headers['Authorization'] = `Bearer ${res.hvel_auth_token}`;
      }
      fetch(`${API_BASE_URL}/api/profile/update`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ 
          email: request.email, 
          name: request.name 
        })
      }).catch(() => {});
    });
    return false;
  }

  if (request.action === 'verifyEmail') {
    console.log(`[HVEL BG] Received verification request for ${siteType} type:`, request.type);
    
    getPrefixedValues(siteType, ['hvel_auth_token'], (res) => {
      const headers = { 'Content-Type': 'application/json' };
      if (res.hvel_auth_token) {
        headers['Authorization'] = `Bearer ${res.hvel_auth_token}`;
      }
      
      safeFetchJson(`${API_BASE_URL}/api/verify`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          senderEmail: request.senderEmail || 'unknown-sender@gmail.com',
          recipientEmail: request.recipientEmail,
          subject: request.subject,
          type: request.type,
          contentHash: request.contentHash
        })
      })
      .then(data => {
        if(data.success) {
          sendResponse({ success: true, url: data.data.verificationUrl });
        } else {
          sendResponse({ success: false, error: data.error || data.message });
        }
      })
      .catch(error => {
        console.error("Error connecting to HVEL API:", error);
        sendResponse({ success: false, error: error.message || 'Network Error' });
      });
    });
    
    return true;
  }

  if (request.action === 'validateVerification') {
    safeFetchJson(`${API_BASE_URL}/api/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        id: request.id, 
        senderEmail: request.senderEmail,
        recipientEmail: request.recipientEmail
      })
    })
    .then(data => sendResponse(data))
    .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (request.action === 'reportUnverifiedReply') {
    console.log(`[HVEL EXT] Reporting unverified reply from: ${request.noExtensionEmail}`);
    safeFetchJson(`${API_BASE_URL}/api/notify-unverified-reply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        hvelUserEmail: request.hvelUserEmail,
        noExtensionEmail: request.noExtensionEmail
      })
    })
    .then(data => sendResponse(data))
    .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }

const userVerificationCache = new Map();

  if (request.action === 'checkUserVerified') {
    const normEmail = (request.email || '').toLowerCase().trim();
    if (userVerificationCache.has(normEmail)) {
      sendResponse({ success: true, verified: userVerificationCache.get(normEmail) });
      return true;
    }

    safeFetchJson(`${API_BASE_URL}/api/check-user-verified`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: normEmail })
    })
    .then(data => {
      const isVerified = !!(data && data.verified);
      userVerificationCache.set(normEmail, isVerified);
      sendResponse(data);
    })
    .catch(err => sendResponse({ success: false, verified: false, error: err.message }));
    return true;
  }

  if (request.action === 'verifyHumanity') {
    safeFetchJson(`${API_BASE_URL}/api/verify-human`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ points: request.points })
    })
    .then(data => sendResponse(data))
    .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (request.action === 'reportSecurityAlert') {
    safeFetchJson(`${API_BASE_URL}/api/report-security-alert`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        email: request.email,
        attacker: request.attacker,
        reason: request.reason
      })
    }).catch(() => {});
    return false;
  }

  // ─── PLAN: get current plan status + usage for the current user ──────────────
  if (request.action === 'getPlanStatus') {
    const email = request.email;
    if (!email) { sendResponse({ success: false, error: 'No email' }); return false; }
    
    getPrefixedValues(siteType, ['hvel_auth_token'], (res) => {
      const headers = { 'Content-Type': 'application/json' };
      if (res.hvel_auth_token) {
        headers['Authorization'] = `Bearer ${res.hvel_auth_token}`;
      }
      
      safeFetchJson(`${API_BASE_URL}/api/plan/status?email=${encodeURIComponent(email)}`, { headers })
        .then(data => {
          if (data.success) {
            setPrefixedValues(siteType, {
              hvel_plan: data.plan,
              hvel_plan_details: data.planDetails,
              hvel_usage: data.usage,
              hvel_plan_cached_at: Date.now(),
              hvel_is_alias: !!data.isAlias,
              hvel_primary_email: data.primaryEmail || null
            });
          }
          sendResponse(data);
        })
        .catch(err => sendResponse({ success: false, error: err.message }));
    });
    return true;
  }

  // ─── PLAN: lightweight pre-check before an action ────────────────────────
  if (request.action === 'checkPlanQuota') {
    getPrefixedValues(siteType, ['hvel_auth_token'], (res) => {
      const headers = { 'Content-Type': 'application/json' };
      if (res.hvel_auth_token) {
        headers['Authorization'] = `Bearer ${res.hvel_auth_token}`;
      }
      
      safeFetchJson(`${API_BASE_URL}/api/plan/check-quota`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ email: request.email, feature: request.feature })
      })
      .then(data => sendResponse(data))
      .catch(err => sendResponse({ success: false, allowed: true, error: err.message }));
    });
    return true;
  }

  // ─── PLAN: trigger fetch + cache on profile sync ────────────────────────
  if (request.action === 'syncPlan') {
    fetchAndCachePlanStatus(request.email, siteType);
    return false;
  }

  // ─── AUDIT LOG SYNC ACTIONS ──────────────────────────────────────────────
  if (request.action === 'getAuditLogs') {
    getPrefixedValues(siteType, ['hvel_auth_token'], (res) => {
      if (!res.hvel_auth_token) {
        sendResponse({ success: false, error: 'Not authenticated' });
        return;
      }
      safeFetchJson(`${API_BASE_URL}/api/audit-logs`, {
        headers: {
          'Authorization': `Bearer ${res.hvel_auth_token}`
        }
      })
      .then(data => {
        if (data.success) {
          setPrefixedValues(siteType, {
            hvel_stats_sent_stamped_link: data.stats?.sent_stamped_link || 0,
            hvel_stats_sent_stamped_hash: data.stats?.sent_stamped_hash || 0,
            hvel_stats_sent_unstamped: data.stats?.sent_unstamped || 0,
            hvel_stats_received_stamped: data.stats?.received_stamped || 0,
            hvel_stats_received_unstamped: data.stats?.received_unstamped || 0,
            hvel_audit_log: data.logs || []
          }, () => {
            sendResponse({ success: true, logs: data.logs, stats: data.stats });
          });
        } else {
          sendResponse({ success: false, error: data.error });
        }
      })
      .catch(err => sendResponse({ success: false, error: err.message }));
    });
    return true;
  }

  if (request.action === 'verifyHumanity') {
    const points = request.points || [];
    const keystrokes = request.keystrokes || [];
    const tabNavigations = request.tabNavigations || 0;

    // 1. Mouse movement validation
    let mouseValid = false;
    if (points.length >= 5) {
      let nonZeroCount = 0;
      for (let i = 1; i < points.length; i++) {
        const dx = points[i].x - points[i-1].x;
        const dy = points[i].y - points[i-1].y;
        if (Math.sqrt(dx*dx + dy*dy) > 0) nonZeroCount++;
      }
      if (nonZeroCount >= 3) mouseValid = true;
    }

    // 2. Keyboard & Tab key biometric validation
    let keyboardValid = false;
    if (tabNavigations > 0 || keystrokes.length >= 2) {
      keyboardValid = true;
    }

    const isHuman = mouseValid || keyboardValid || (points.length + keystrokes.length + tabNavigations) >= 2;
    sendResponse({ success: isHuman });
    return false;
  }

  if (request.action === 'logAuditEvent') {
    chrome.storage.local.get([
      'hvel_auth_token',
      `${siteType}_hvel_auth_token`,
      'gmail_hvel_auth_token',
      'outlook_hvel_auth_token',
      'hvel_auth_email',
      `${siteType}_hvel_auth_email`,
      'gmail_hvel_auth_email',
      'outlook_hvel_auth_email',
      'hvel_user_aliases',
      `${siteType}_hvel_user_aliases`
    ], (res) => {
      const token = res[`${siteType}_hvel_auth_token`] || res.hvel_auth_token || res.gmail_hvel_auth_token || res.outlook_hvel_auth_token;
      const userEmail = res[`${siteType}_hvel_auth_email`] || res.hvel_auth_email || res.gmail_hvel_auth_email || res.outlook_hvel_auth_email;
      if (!token && !userEmail) {
        return;
      }
      const rawExtra = request.extra || {};
      const extraPayload = Object.assign({}, rawExtra, {
        siteType: siteType,
        provider: rawExtra.provider || (siteType === 'outlook' ? 'outlook' : 'gmail'),
        client: rawExtra.client || (siteType === 'outlook' ? 'outlook' : 'gmail')
      });

      const aliases = res[`${siteType}_hvel_user_aliases`] || res.hvel_user_aliases;
      if (siteType === 'outlook' && Array.isArray(aliases)) {
        const outlookAlias = aliases.find(a => {
          const low = (a || '').toLowerCase();
          return !low.endsWith('@gmail.com') && !low.endsWith('@googlemail.com');
        });
        if (outlookAlias && (!extraPayload.account || extraPayload.account.endsWith('@gmail.com') || extraPayload.account === 'unknown-outlook-sender@outlook.com')) {
          extraPayload.account = outlookAlias.toLowerCase().trim();
        }
      }

      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      if (userEmail) headers['X-User-Email'] = userEmail;

      safeFetchJson(`${API_BASE_URL}/api/audit-logs/log`, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({
          type: request.type,
          email: request.email,
          extra: extraPayload
        })
      }).catch(() => {});
    });
    return false;
  }

  if (request.action === 'clearAuditLogs') {
    getPrefixedValues(siteType, ['hvel_auth_token'], (res) => {
      if (!res.hvel_auth_token) {
        sendResponse({ success: false });
        return;
      }
      safeFetchJson(`${API_BASE_URL}/api/audit-logs/clear`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${res.hvel_auth_token}`
        }
      })
      .then(data => sendResponse(data))
      .catch(() => sendResponse({ success: false }));
    });
    return true;
  }

  // ─── EMAIL ALIAS SYNC ACTIONS ────────────────────────────────────────────
  if (request.action === 'getAliases') {
    getPrefixedValues(siteType, ['hvel_auth_token'], (res) => {
      if (!res.hvel_auth_token) {
        sendResponse({ success: false, error: 'Not authenticated' });
        return;
      }
      safeFetchJson(`${API_BASE_URL}/api/aliases`, {
        headers: {
          'Authorization': `Bearer ${res.hvel_auth_token}`
        }
      })
      .then(data => {
        if (data && data.success && Array.isArray(data.aliases)) {
          chrome.storage.local.set({ hvel_linked_aliases: data.aliases });
        }
        sendResponse(data);
      })
      .catch(err => sendResponse({ success: false, error: err.message }));
    });
    return true;
  }

  if (request.action === 'requestAliasOtp') {
    getPrefixedValues(siteType, ['hvel_auth_token'], (res) => {
      if (!res.hvel_auth_token) {
        sendResponse({ success: false, error: 'Not authenticated' });
        return;
      }
      safeFetchJson(`${API_BASE_URL}/api/aliases/request-otp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${res.hvel_auth_token}`
        },
        body: JSON.stringify({ aliasEmail: request.aliasEmail })
      })
      .then(data => sendResponse(data))
      .catch(err => sendResponse({ success: false, error: err.message }));
    });
    return true;
  }

  if (request.action === 'addAlias') {
    getPrefixedValues(siteType, ['hvel_auth_token'], (res) => {
      if (!res.hvel_auth_token) {
        sendResponse({ success: false, error: 'Not authenticated' });
        return;
      }
      safeFetchJson(`${API_BASE_URL}/api/aliases`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${res.hvel_auth_token}`
        },
        body: JSON.stringify({ aliasEmail: request.aliasEmail, otp: request.otp })
      })
      .then(data => sendResponse(data))
      .catch(err => sendResponse({ success: false, error: err.message }));
    });
    return true;
  }

  if (request.action === 'deleteAlias') {
    getPrefixedValues(siteType, ['hvel_auth_token'], (res) => {
      if (!res.hvel_auth_token) {
        sendResponse({ success: false, error: 'Not authenticated' });
        return;
      }
      safeFetchJson(`${API_BASE_URL}/api/aliases`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${res.hvel_auth_token}`
        },
        body: JSON.stringify({ aliasEmail: request.aliasEmail })
      })
      .then(data => sendResponse(data))
      .catch(err => sendResponse({ success: false, error: err.message }));
    });
    return true;
  }
});
