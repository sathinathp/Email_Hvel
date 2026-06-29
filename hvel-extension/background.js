let API_BASE_URL = 'https://api.attest.page';

// Dynamically check if the local server is running on port 5000; if so, route requests to it first
function checkBackendUrl() {
  fetch('http://localhost:5000/health')
    .then(() => {
      if (API_BASE_URL !== 'http://localhost:5000') {
        API_BASE_URL = 'http://localhost:5000';
        console.log('[HVEL BG] 📡 Localhost backend detected! Routing API requests to: http://localhost:5000');
      }
    })
    .catch(() => {
      if (API_BASE_URL !== 'https://api.attest.page') {
        API_BASE_URL = 'https://api.attest.page';
        console.log('[HVEL BG] 📡 Localhost down. Falling back to production backend: https://api.attest.page');
      }
    });
}

// Run check immediately and periodically (every 10 seconds)
checkBackendUrl();
setInterval(checkBackendUrl, 10000);

// ─── PLAN STATUS: fetch on startup and cache for 10 mins ───────────────────────
function fetchAndCachePlanStatus(email) {
  if (!email) return;
  fetch(`${API_BASE_URL}/api/plan/status?email=${encodeURIComponent(email)}`)
    .then(r => r.json())
    .then(data => {
      if (data.success) {
        chrome.storage.local.set({
          hvel_plan: data.plan,
          hvel_plan_details: data.planDetails,
          hvel_usage: data.usage,
          hvel_plan_cached_at: Date.now()
        });
        console.log(`[HVEL BG] 📊 Plan cached: ${data.plan} | TOTP today: ${data.usage.totp_used_today}/${data.planDetails.totp_daily_limit}`);
      }
    })
    .catch(() => {});
}

// Listen for messages from the content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'heartbeat') {
    fetch(`${API_BASE_URL}/api/heartbeat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: request.url })
    }).catch(() => {}); // Quietly fail
    return false;
  }

  if (request.action === 'updateProfile') {
    fetch(`${API_BASE_URL}/api/profile/update`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        email: request.email, 
        name: request.name 
      })
    }).catch(() => {});
    return false;
  }

  if (request.action === 'verifyEmail') {
    console.log("Received verification request for type:", request.type);
    
    // Make actual API call to the backend
    fetch(`${API_BASE_URL}/api/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        senderEmail: request.senderEmail || 'unknown-sender@gmail.com',
        recipientEmail: request.recipientEmail,
        type: request.type,
        contentHash: request.contentHash // Pass the cryptographic hash
      })
    })
    .then(response => response.json())
    .then(data => {
      if(data.success) {
        sendResponse({ success: true, url: data.data.verificationUrl });
      } else {
        sendResponse({ success: false, error: data.error });
      }
    })
    .catch(error => {
      console.error("Error connecting to HVEL API:", error);
      sendResponse({ success: false, error: 'Network Error' });
    });
    
    return true; // Keep the message channel open for the async response
  }

  if (request.action === 'validateVerification') {
    fetch(`${API_BASE_URL}/api/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        id: request.id, 
        senderEmail: request.senderEmail,
        recipientEmail: request.recipientEmail
      })
    })
    .then(r => r.json())
    .then(data => sendResponse(data))
    .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (request.action === 'reportUnverifiedReply') {
    console.log(`[HVEL EXT] Reporting unverified reply from: ${request.noExtensionEmail}`);
    fetch(`${API_BASE_URL}/api/notify-unverified-reply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        hvelUserEmail: request.hvelUserEmail,
        noExtensionEmail: request.noExtensionEmail
      })
    })

    .then(r => r.json())
    .then(data => sendResponse(data))
    .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (request.action === 'checkUserVerified') {
    fetch(`${API_BASE_URL}/api/check-user-verified`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: request.email })
    })
    .then(r => r.json())
    .then(data => sendResponse(data))
    .catch(err => sendResponse({ success: false, verified: false, error: err.message }));
    return true;
  }

  if (request.action === 'verifyHumanity') {
    fetch(`${API_BASE_URL}/api/verify-human`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ points: request.points })
    })
    .then(r => r.json())
    .then(data => sendResponse(data))
    .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (request.action === 'reportSecurityAlert') {
    fetch(`${API_BASE_URL}/api/report-security-alert`, {
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
    // Fetch fresh from server (bypass cache for explicit status requests)
    fetch(`${API_BASE_URL}/api/plan/status?email=${encodeURIComponent(email)}`)
      .then(r => r.json())
      .then(data => {
        if (data.success) {
          chrome.storage.local.set({
            hvel_plan: data.plan,
            hvel_plan_details: data.planDetails,
            hvel_usage: data.usage,
            hvel_plan_cached_at: Date.now()
          });
        }
        sendResponse(data);
      })
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }

  // ─── PLAN: lightweight pre-check before an action ────────────────────────
  if (request.action === 'checkPlanQuota') {
    fetch(`${API_BASE_URL}/api/plan/check-quota`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: request.email, feature: request.feature })
    })
    .then(r => r.json())
    .then(data => sendResponse(data))
    .catch(err => sendResponse({ success: false, allowed: true, error: err.message })); // fail open
    return true;
  }

  // ─── PLAN: trigger fetch + cache on profile sync ────────────────────────
  if (request.action === 'syncPlan') {
    fetchAndCachePlanStatus(request.email);
    return false;
  }
});
