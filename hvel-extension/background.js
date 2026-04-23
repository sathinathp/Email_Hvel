console.log("HVEL Background Service Worker initialized.");

// Listen for messages from the content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'heartbeat') {
    fetch('https://hvel-backend.onrender.com/api/heartbeat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: request.url })
    }).catch(() => {}); // Quietly fail
    return false;
  }

  if (request.action === 'verifyEmail') {
    console.log("Received verification request for type:", request.type);
    
    // Make actual API call to the backend
    fetch('https://hvel-backend.onrender.com/api/verify', {
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
    fetch('https://hvel-backend.onrender.com/api/request-otp', {
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
    fetch('https://hvel-backend.onrender.com/api/verify-otp', {
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
    fetch('https://hvel-backend.onrender.com/api/totp-setup', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': 'true'
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
    fetch('https://hvel-backend.onrender.com/api/totp-verify', {
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
    fetch('https://hvel-backend.onrender.com/api/validate', {
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
    fetch('https://hvel-backend.onrender.com/api/notify-unverified-reply', {
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
    fetch('https://hvel-backend.onrender.com/api/check-user-verified', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: request.email })
    })
    .then(r => r.json())
    .then(data => sendResponse(data))
    .catch(err => sendResponse({ success: false, verified: false, error: err.message }));
    return true;
  }
});
