const API_BASE_URL = 'https://api.humanattest.com';

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

  if (request.action === 'requestOTP') {
    fetch(`${API_BASE_URL}/api/request-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: request.senderEmail })
    })
    .then(r => r.json())
    .then(data => sendResponse(data))
    .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (request.action === 'verifyOTP') {
    fetch(`${API_BASE_URL}/api/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: request.senderEmail, code: request.code })
    })
    .then(r => r.json())
    .then(data => sendResponse(data))
    .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (request.action === 'setupTOTP') {
    console.log(`[HVEL EXT] Setting up TOTP for ${request.senderEmail} (Force: ${request.force})`);
    fetch(`${API_BASE_URL}/api/totp-setup`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ 
        email: request.senderEmail,
        force: request.force
      })
    })
    .then(r => {
      console.log(`[HVEL EXT] TOTP Setup Status: ${r.status}`);
      return r.json();
    })
    .then(data => {
      console.log(`[HVEL EXT] TOTP Setup Response Success: ${data.success}`);
      sendResponse(data);
    })
    .catch(err => {
      console.error('[HVEL EXT] TOTP Setup Network Error:', err);
      sendResponse({ success: false, error: err.message });
    });
    return true;
  }

  if (request.action === 'verifyTOTP') {
    fetch(`${API_BASE_URL}/api/totp-verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: request.senderEmail, code: request.code })
    })
    .then(r => r.json())
    .then(data => sendResponse(data))
    .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
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
});
