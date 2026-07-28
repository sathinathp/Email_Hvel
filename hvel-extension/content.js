console.log("HVEL Content Script loaded into Gmail.");

// Inject animations and styles for premium toasts and button effects
const style = document.createElement('style');
style.textContent = `
    @keyframes hvel-spin {
        to { transform: rotate(360deg); }
    }
    @keyframes hvel-shake {
        0%, 100% { transform: translateX(0); }
        20%, 60% { transform: translateX(-6px); }
        40%, 80% { transform: translateX(6px); }
    }
    @keyframes hvel-toast-slide {
        from { opacity: 0; transform: translateY(-20px) scale(0.95); }
        to { opacity: 1; transform: translateY(0) scale(1); }
    }
    @keyframes hvel-toast-fade {
        to { opacity: 0; transform: translateY(-10px) scale(0.95); }
    }
    @keyframes hvel-pop-in {
        0% { opacity: 0; transform: translateY(-30px) scale(0.9); }
        70% { transform: translateY(4px) scale(1.03); }
        100% { opacity: 1; transform: translateY(0) scale(1); }
    }
    @keyframes hvel-ring-pulse {
        0% { transform: scale(0.95); opacity: 0.8; box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.4); }
        70% { transform: scale(1); opacity: 1; box-shadow: 0 0 0 10px rgba(16, 185, 129, 0); }
        100% { transform: scale(0.95); opacity: 0.8; box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
    }
`;
document.head.appendChild(style);

// Track in-flight requests to prevent spamming the server
const pendingRequests = new Set();


// Cache for checked email verification statuses to optimize API calls
const checkedEmailsCache = new Map();

// --- HEARTBEAT & PROFILE SYNC ---
function sendHeartbeat() {
    chrome.runtime.sendMessage({ action: 'heartbeat', url: window.location.href });
}

function updateProfile() {
    const profile = getSenderProfile();
    if (profile.email) {
        chrome.runtime.sendMessage({
            action: 'updateProfile',
            email: profile.email,
            name: profile.name
        });
        // Sync plan status to local cache whenever profile is refreshed
        chrome.runtime.sendMessage({ action: 'syncPlan', email: profile.email });
    }
}

setInterval(sendHeartbeat, 30000); // 30s heartbeat
setInterval(updateProfile, 5 * 60 * 1000); // Sync name/last active every 5m
sendHeartbeat();
updateProfile();
// Keep a cached copy of the authenticated user's email from chrome.storage
let cachedUserEmail = 'unknown-sender@gmail.com';

chrome.storage.local.get(['hvel_auth_email'], (res) => {
    if (res && res.hvel_auth_email) {
        cachedUserEmail = res.hvel_auth_email.toLowerCase().trim();
    }
});

chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local' && changes.hvel_auth_email) {
        cachedUserEmail = changes.hvel_auth_email.newValue ? changes.hvel_auth_email.newValue.toLowerCase().trim() : 'unknown-sender@gmail.com';
    }
});

// -------------------------------

const SESSION_DURATION_MS = 60 * 60 * 1000; // 1 hour

async function isSessionValid() {
    return new Promise((resolve) => {
        chrome.storage.local.get(['hvel_last_verified', 'hvel_verified_email'], (result) => {
            if (!result.hvel_last_verified) return resolve(false);
            const now = Date.now();
            const isValid = (now - result.hvel_last_verified) < SESSION_DURATION_MS;
            resolve(isValid);
        });
    });
}

async function markVerified(email) {
    return new Promise((resolve) => {
        chrome.storage.local.set({
            hvel_last_verified: Date.now(),
            hvel_verified_email: email
        }, resolve);
    });
}

// Extract actual user email and name from Gmail DOM
function getSenderProfile() {
    const accountBtn = document.querySelector('a[href*="accounts.google.com/SignOutOptions"]');
    if (accountBtn) {
        const label = accountBtn.getAttribute('aria-label') || "";
        // Format: "Google Account: Name (email@gmail.com)"
        const nameMatch = label.match(/Google Account:\s*(.*?)\s*\(/);
        const emailMatch = label.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
        
        return {
            email: emailMatch ? emailMatch[0].toLowerCase() : null,
            name: nameMatch ? nameMatch[1] : null
        };
    }
    return { email: null, name: null };
}

function getSenderEmail() {
    const profile = getSenderProfile();
    if (profile.email) return profile.email;

    const titleMatch = document.title.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
    if (titleMatch) return titleMatch[0].toLowerCase();

    // Fallback ONLY if cachedUserEmail is not an Outlook/Microsoft/Hotmail email
    const isOutlookEmail = cachedUserEmail && (
        cachedUserEmail.endsWith('@outlook.com') ||
        cachedUserEmail.endsWith('@hotmail.com') ||
        cachedUserEmail.endsWith('@live.com') ||
        cachedUserEmail.endsWith('@msn.com') ||
        cachedUserEmail.endsWith('@office.com')
    );
    if (cachedUserEmail && !isOutlookEmail && cachedUserEmail !== 'unknown-gmail-sender@gmail.com') {
        return cachedUserEmail;
    }

    return 'unknown-gmail-sender@gmail.com';
}

// Function to find the recipient of an incoming message (the current user)
function getCurrentUserEmail() {
    return getSenderEmail();
}


// ─── SILENT MOUSE TRACKING ENGINE ───
let mousePoints = [];
document.addEventListener('mousemove', (e) => {
    mousePoints.push({ x: e.clientX, y: e.clientY, t: Date.now() });
    if (mousePoints.length > 50) mousePoints.shift();
});


// ─── COMPOSE SESSION TRACKING ENGINE ───
let composeMousePoints = [];
let activeComposeDialog = null;

// Inject compose-specific styles
const composeTrackStyle = document.createElement('style');
composeTrackStyle.textContent = `
    @keyframes hvel-pulse-dot {
        0%,100% { opacity: 1; transform: scale(1); }
        50% { opacity: 0.4; transform: scale(0.75); }
    }
    @keyframes hvel-compose-in {
        from { opacity: 0; transform: translateX(-8px); }
        to { opacity: 1; transform: translateX(0); }
    }
`;
document.head.appendChild(composeTrackStyle);

function injectComposeIndicator(dialog) {
    if (dialog.querySelector('#hvel-compose-indicator')) return;
    const toolbar = dialog.querySelector('.btC') ||
                    dialog.querySelector('[gh="mtb"]') ||
                    dialog.querySelector('.aFe') ||
                    dialog.querySelector('.gU');
    if (!toolbar) return;
    const indicator = document.createElement('span');
    indicator.id = 'hvel-compose-indicator';
    indicator.style.cssText = `
        display: inline-flex; align-items: center; gap: 5px;
        padding: 3px 10px 3px 7px;
        background: rgba(16,185,129,0.1);
        border: 1px solid rgba(16,185,129,0.25);
        border-radius: 9999px;
        font-size: 11px; font-weight: 600; color: #059669;
        font-family: 'Segoe UI', system-ui, sans-serif;
        margin-left: 10px; pointer-events: none;
        vertical-align: middle;
        animation: hvel-compose-in 0.3s ease forwards;
    `;
    indicator.innerHTML = `
        <span style="width:7px;height:7px;background:#10b981;border-radius:50%;
            display:inline-block;animation:hvel-pulse-dot 1.5s ease infinite;flex-shrink:0;"></span>
        <span>HVEL Tracking</span>
    `;
    toolbar.appendChild(indicator);
}

function flashComposeVerified(dialog) {
    const indicator = dialog?.querySelector('#hvel-compose-indicator');
    if (!indicator) return;
    indicator.innerHTML = `<span style="font-size:12px;">✅</span> <span>HVEL Verified</span>`;
    indicator.style.background = 'rgba(16,185,129,0.15)';
    indicator.style.borderColor = 'rgba(16,185,129,0.5)';
    setTimeout(() => indicator.remove(), 2000);
}

function updateOrAppendStamp(composeBody, badgeInnerHtml) {
    if (!composeBody) return;
    const existing = composeBody.querySelector('.hvel-badge-wrapper');
    if (existing) {
        existing.innerHTML = badgeInnerHtml;
    } else {
        const stampContainer = document.createElement('div');
        stampContainer.className = 'hvel-badge-wrapper';
        stampContainer.setAttribute('contenteditable', 'false');
        stampContainer.style.cssText = "font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; display: inline-block; margin-top: 20px;";
        stampContainer.innerHTML = badgeInnerHtml;
        composeBody.appendChild(document.createElement('br'));
        composeBody.appendChild(document.createElement('br'));
        composeBody.appendChild(stampContainer);
    }
}

let hashUpdateTimeout = null;
async function updateComposeStampLive(composeBody) {
    if (hashUpdateTimeout) clearTimeout(hashUpdateTimeout);
    hashUpdateTimeout = setTimeout(async () => {
        if (!composeBody || !document.body.contains(composeBody)) return;
        
        // Extract clean body text and compute the hash
        const clone = composeBody.cloneNode(true);
        clone.querySelectorAll('.hvel-badge-wrapper').forEach(el => el.remove());
        const emailBodyText = clone.innerText || "";
        const contentHash = await computeHash(emailBodyText);
        
        chrome.storage.local.get(['hvel_stamp_mode'], (prefs) => {
            const stampMode = prefs.hvel_stamp_mode || 'with_link';
            
            const existing = composeBody.querySelector('.hvel-badge-wrapper');
            if (!existing) return;
            
            let badgeInnerHtml = '';
            if (stampMode === 'hash_only') {
                badgeInnerHtml = `
                    <div style="display: inline-flex; align-items: center; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 9999px; padding: 4px 12px; gap: 6px; box-shadow: 0 1px 2px rgba(0,0,0,0.05);">
                        <img src="https://api.attest.page/stamp-icon.png" style="width: 18px; height: 18px; border-radius: 50%; object-fit: contain; vertical-align: middle; flex-shrink: 0;" />
                        <span style="color: #065f46; font-size: 13px; font-weight: 600; letter-spacing: -0.01em;">Attest</span>
                    </div>
                    <div style="margin-top: 5px; font-size: 9px; color: #94a3b8;" class="hvel-stamp-hash-container">
                        <span class="hvel-stamp-hash">Hash: ${contentHash}</span>
                    </div>
                `;
            } else {
                badgeInnerHtml = `
                    <a href="#" onclick="return false;" style="display: inline-flex; align-items: center; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 9999px; padding: 4px 12px; gap: 6px; box-shadow: 0 1px 2px rgba(0,0,0,0.05); text-decoration: none; cursor: default;" title="Attest Trust Record">
                        <img src="https://api.attest.page/stamp-icon.png" style="width: 18px; height: 18px; border-radius: 50%; object-fit: contain; vertical-align: middle; flex-shrink: 0;" />
                        <span style="color: #065f46; font-size: 13px; font-weight: 600; letter-spacing: -0.01em;">Attest</span>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#059669" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-left: 1px;"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
                    </a>
                `;
            }
            updateOrAppendStamp(composeBody, badgeInnerHtml);
        });
    }, 300);
}

async function injectComposeStamp(dialog) {
    const composeBody = dialog.querySelector('div[aria-label="Message Body"]');
    if (!composeBody) return;

    const senderEmail = getSenderEmail();

    // Check if sender is authorized for current session (primary or linked alias)
    chrome.runtime.sendMessage({
        action: 'checkPlanQuota',
        email: senderEmail,
        feature: 'totp_verify'
    }, async (res) => {
        if (res && (res.error === 'IDENTITY_MISMATCH' || res.error === 'AUTHENTICATION_REQUIRED' || res.error === 'INVALID_SESSION')) {
            // Unlinked sender account or unauthenticated session: remove any stamp
            composeBody.querySelectorAll('.hvel-badge-wrapper').forEach(el => el.remove());
            
            const indicator = dialog.querySelector('#hvel-compose-indicator');
            if (indicator) {
                indicator.style.background = 'rgba(239, 68, 68, 0.1)';
                indicator.style.borderColor = 'rgba(239, 68, 68, 0.3)';
                indicator.style.color = '#dc2626';
                indicator.innerHTML = `<span style="font-size:11px;">⚠️</span> <span>Unlinked Account (${senderEmail})</span>`;
            }
            return;
        }

        // Prevent duplicate signature if already injected
        if (composeBody.querySelector('.hvel-badge-wrapper')) return;

        const clone = composeBody.cloneNode(true);
        clone.querySelectorAll('.hvel-badge-wrapper').forEach(el => el.remove());
        const emailBodyText = clone.innerText || "";
        const contentHash = await computeHash(emailBodyText);

        chrome.storage.local.get(['hvel_stamp_mode'], (prefs) => {
            const stampMode = prefs.hvel_stamp_mode || 'with_link';
            
            let badgeInnerHtml = '';
            if (stampMode === 'hash_only') {
                badgeInnerHtml = `
                    <div style="display: inline-flex; align-items: center; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 9999px; padding: 4px 12px; gap: 6px; box-shadow: 0 1px 2px rgba(0,0,0,0.05);">
                        <img src="https://api.attest.page/stamp-icon.png" style="width: 18px; height: 18px; border-radius: 50%; object-fit: contain; vertical-align: middle; flex-shrink: 0;" />
                        <span style="color: #065f46; font-size: 13px; font-weight: 600; letter-spacing: -0.01em;">Attest</span>
                    </div>
                    <div style="margin-top: 5px; font-size: 9px; color: #94a3b8;" class="hvel-stamp-hash-container">
                        <span class="hvel-stamp-hash">Hash: ${contentHash}</span>
                    </div>
                `;
            } else {
                badgeInnerHtml = `
                    <a href="#" onclick="return false;" style="display: inline-flex; align-items: center; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 9999px; padding: 4px 12px; gap: 6px; box-shadow: 0 1px 2px rgba(0,0,0,0.05); text-decoration: none; cursor: default;" title="Attest Trust Record">
                        <img src="https://api.attest.page/stamp-icon.png" style="width: 18px; height: 18px; border-radius: 50%; object-fit: contain; vertical-align: middle; flex-shrink: 0;" />
                        <span style="color: #065f46; font-size: 13px; font-weight: 600; letter-spacing: -0.01em;">Attest</span>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#059669" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-left: 1px;"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
                    </a>
                `;
            }
            
            updateOrAppendStamp(composeBody, badgeInnerHtml);
            
            // Add live typing/update listeners
            composeBody.addEventListener('input', () => updateComposeStampLive(composeBody));
            composeBody.addEventListener('keyup', () => updateComposeStampLive(composeBody));
        });
    });
}

// Watch for compose dialogs opening/closing
const composeSessionObserver = new MutationObserver(() => {
    const dialogs = document.querySelectorAll('div[role="dialog"]');
    dialogs.forEach(dialog => {
        const hasBody = dialog.querySelector('div[aria-label="Message Body"]');
        if (hasBody && dialog !== activeComposeDialog) {
            activeComposeDialog = dialog;
            composeMousePoints = []; // Fresh buffer per compose session
            injectComposeIndicator(dialog);
            injectComposeStamp(dialog);
            console.log('[HVEL] 📝 Compose detected — focused tracking active');
        }
    });
    // Cleanup if compose was closed
    if (activeComposeDialog && !document.contains(activeComposeDialog)) {
        activeComposeDialog = null;
        composeMousePoints = [];
    }
});
composeSessionObserver.observe(document.body, { childList: true, subtree: true });

// Richer focused mouse buffer during compose
document.addEventListener('mousemove', (e) => {
    if (activeComposeDialog) {
        composeMousePoints.push({ x: e.clientX, y: e.clientY, t: Date.now() });
        if (composeMousePoints.length > 150) composeMousePoints.shift();
    }
});


// ─── FRICTIONLESS CLICK INTERCEPTION ───
let isVerifying = false;

// Helper to restore send button state safely
function restoreSendButton(btn) {
    if (btn) {
        btn.style.pointerEvents = 'auto';
        btn.style.width = '';
        const originalHTML = btn.getAttribute('data-original-html');
        if (originalHTML) {
            btn.innerHTML = originalHTML;
            btn.removeAttribute('data-original-html');
        }
    }
}

document.addEventListener('click', async (e) => {
    const sendBtn = e.target.closest('div[role="button"]');
    if (!sendBtn) return;

    const tooltip = sendBtn.getAttribute('data-tooltip') || '';
    if (!tooltip.includes('Send') && !tooltip.includes('send') && sendBtn.innerText.toLowerCase() !== 'send') return;

    // 1. If this is a programmatic click initiated after successful verification, bypass the check
    if (sendBtn.getAttribute('data-hvel-verified') === 'true') {
        sendBtn.removeAttribute('data-hvel-verified');
        return;
    }

    // 2. Intercept the click completely
    e.preventDefault();
    e.stopPropagation();

    if (isVerifying) return;
    isVerifying = true;

    try {
        // 3. Show dynamic premium spinner state on the Send button
        const originalHTML = sendBtn.innerHTML;
        const originalWidth = sendBtn.offsetWidth;
        
        sendBtn.setAttribute('data-original-html', originalHTML);
        sendBtn.style.width = `${originalWidth}px`;
        sendBtn.style.pointerEvents = 'none';
        sendBtn.innerHTML = `
            <span style="display:inline-flex; align-items:center; gap:6px;">
                <div style="width: 12px; height: 12px; border: 2px solid white; border-top-color: transparent; border-radius: 50%; animation: hvel-spin 0.6s linear infinite; box-sizing: border-box;"></div>
                Verifying...
            </span>
        `;

        // Wait a brief 200ms to capture the final cursor movements leading directly to the button
        setTimeout(() => {
            try {
                const realEmailForCheck = getSenderEmail();

                // ── PLAN QUOTA & IDENTITY PRE-CHECK ────────────────────────
                chrome.runtime.sendMessage({
                    action: 'checkPlanQuota',
                    email: realEmailForCheck,
                    feature: 'totp_verify'
                }, (quotaRes) => {
                    const isAuthError = quotaRes && (quotaRes.error === 'AUTHENTICATION_REQUIRED' || quotaRes.error === 'INVALID_SESSION');
                    if (isAuthError) {
                        isVerifying = false;
                        restoreSendButton(sendBtn);
                        let composeBody = document.querySelector('div[aria-label="Message Body"]');
                        const dialog = sendBtn.closest('div[role="dialog"]');
                        if (dialog) composeBody = dialog.querySelector('div[aria-label="Message Body"]');
                        if (composeBody) composeBody.querySelectorAll('.hvel-badge-wrapper').forEach(el => el.remove());
                        showVerificationWarningToast("Authentication Required", "Please log in to HVEL via the extension popup.");
                        return; // Stop — do NOT send the email
                    }

                    const isIdentityMismatch = quotaRes && quotaRes.error === 'IDENTITY_MISMATCH';
                    if (isIdentityMismatch) {
                        isVerifying = false;
                        restoreSendButton(sendBtn);
                        let composeBody = document.querySelector('div[aria-label="Message Body"]');
                        const dialog = sendBtn.closest('div[role="dialog"]');
                        if (dialog) composeBody = dialog.querySelector('div[aria-label="Message Body"]');
                        if (composeBody) composeBody.querySelectorAll('.hvel-badge-wrapper').forEach(el => el.remove());
                        showVerificationWarningToast("Unlinked Sender Account", quotaRes.message || "Active Attest login does not match this sender email.");
                        return; // Stop — do NOT send the unlinked email with stamp!
                    }

                    // If quota check failed network-side, fail open (let it proceed)
                    const quotaBlocked = quotaRes && quotaRes.allowed === false;
                    if (quotaBlocked) {
                        isVerifying = false;
                        restoreSendButton(sendBtn);
                        showPlanLimitModal('totp_verify', {
                            used:    quotaRes.used,
                            limit:   quotaRes.limit,
                            plan:    quotaRes.plan,
                            message: quotaRes.reason || `You've used all ${quotaRes.limit} free human verifications for today.`
                        });
                        return; // Stop — do NOT send the email
                    }

                    // Quota & Identity OK — proceed with mouse tracking
                    const pointsToSend = (activeComposeDialog && composeMousePoints.length >= 10)
                        ? composeMousePoints
                        : mousePoints;
                    chrome.runtime.sendMessage({
                        action: 'verifyHumanity',
                        points: pointsToSend
                    }, async (response) => {
                    try {
                        const isHuman = !!(response && response.success);
                        const isNetworkError = !!(response && response.error && (
                            response.error.toLowerCase().includes('fetch') || 
                            response.error.toLowerCase().includes('network') || 
                            response.error.toLowerCase().includes('failed to connect')
                        ));

                        const realEmail = getSenderEmail();
                        const recipientEmail = getRecipientEmail(sendBtn);
                        
                        // Find compose body related to this send button
                        let composeBody = document.querySelector('div[aria-label="Message Body"]');
                        const dialog = sendBtn.closest('div[role="dialog"]');
                        if (dialog) {
                            composeBody = dialog.querySelector('div[aria-label="Message Body"]');
                        }
                        
                        let emailBodyText = "";
                        if (composeBody) {
                            const clone = composeBody.cloneNode(true);
                            clone.querySelectorAll('.hvel-badge-wrapper').forEach(el => el.remove());
                            emailBodyText = clone.innerText;
                        }
                        const contentHash = await computeHash(emailBodyText);

                        if (isNetworkError) {
                            // Offline / Network Error fallback - let them send, stamp as Offline Unverified
                            isVerifying = false;
                            restoreSendButton(sendBtn);

                            if (composeBody) {
                                chrome.storage.local.get(['hvel_stamp_mode'], (prefs) => {
                                    const stampMode = prefs.hvel_stamp_mode || 'with_link';
                                    let badgeInnerHtml = '';
                                    if (stampMode === 'hash_only') {
                                        badgeInnerHtml = `
                                            <div style="display: inline-flex; align-items: center; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 9999px; padding: 4px 12px; gap: 8px; box-shadow: 0 1px 2px rgba(0,0,0,0.05);">
                                                <img src="https://api.attest.page/stamp-icon.png" style="width: 18px; height: 18px; border-radius: 50%; object-fit: contain; vertical-align: middle; flex-shrink: 0;" />
                                                <span style="color: #334155; font-size: 13px; font-weight: 600; letter-spacing: -0.01em;">Unverified Sender (Offline)</span>
                                            </div>
                                            <div style="margin-top: 5px; font-size: 9px; color: #94a3b8;">
                                                <span>Hash: ${contentHash}</span>
                                            </div>
                                        `;
                                    } else {
                                        badgeInnerHtml = `
                                            <div style="display: inline-flex; align-items: center; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 9999px; padding: 4px 12px; gap: 8px; box-shadow: 0 1px 2px rgba(0,0,0,0.05);">
                                                <img src="https://api.attest.page/stamp-icon.png" style="width: 18px; height: 18px; border-radius: 50%; object-fit: contain; vertical-align: middle; flex-shrink: 0;" />
                                                <span style="color: #334155; font-size: 13px; font-weight: 600; letter-spacing: -0.01em;">Unverified Sender (Offline)</span>
                                            </div>
                                        `;
                                    }
                                    updateOrAppendStamp(composeBody, badgeInnerHtml);
                                });
                            }

                            showVerificationWarningToast("Server Offline", "Dispatching email with unverified offline status.");
                            logAuditEvent('sent_unstamped', recipientEmail, { sender: realEmail, recipient: recipientEmail });
                            sendBtn.setAttribute('data-hvel-verified', 'true');
                            setTimeout(() => {
                                sendBtn.click();
                            }, 800);
                            return;
                        }

                        // Not a network error: can be either verified human or detected robotic bot
                        const verificationType = isHuman ? 'human' : 'robotic';

                        // Call background verifyEmail API to save verification record in DB and get the Trust Record URL
                        chrome.runtime.sendMessage({
                            action: 'verifyEmail',
                            type: verificationType,
                            senderEmail: realEmail,
                            recipientEmail: recipientEmail,
                            contentHash: contentHash
                        }, (verifyRes) => {
                            try {
                                isVerifying = false;
                                restoreSendButton(sendBtn);

                                // Handle verify response
                                const isVerifySuccess = !!(verifyRes && verifyRes.success);
                                const isVerifyNetworkErr = !!(verifyRes && verifyRes.error && (
                                    verifyRes.error.toLowerCase().includes('fetch') || 
                                    verifyRes.error.toLowerCase().includes('network') || 
                                    verifyRes.error.toLowerCase().includes('failed to connect')
                                ));

                                if (isVerifyNetworkErr) {
                                    if (composeBody) {
                                        chrome.storage.local.get(['hvel_stamp_mode'], (prefs) => {
                                            const stampMode = prefs.hvel_stamp_mode || 'with_link';
                                            let badgeInnerHtml = '';
                                            if (stampMode === 'hash_only') {
                                                badgeInnerHtml = `
                                                    <div style="display: inline-flex; align-items: center; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 9999px; padding: 4px 12px; gap: 8px; box-shadow: 0 1px 2px rgba(0,0,0,0.05);">
                                                        <img src="https://api.attest.page/stamp-icon.png" style="width: 18px; height: 18px; border-radius: 50%; object-fit: contain; vertical-align: middle; flex-shrink: 0;" />
                                                        <span style="color: #334155; font-size: 13px; font-weight: 600; letter-spacing: -0.01em;">Unverified Sender (Offline)</span>
                                                    </div>
                                                    <div style="margin-top: 5px; font-size: 9px; color: #94a3b8;">
                                                        <span>Hash: ${contentHash}</span>
                                                    </div>
                                                `;
                                            } else {
                                                badgeInnerHtml = `
                                                    <div style="display: inline-flex; align-items: center; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 9999px; padding: 4px 12px; gap: 8px; box-shadow: 0 1px 2px rgba(0,0,0,0.05);">
                                                        <img src="https://api.attest.page/stamp-icon.png" style="width: 18px; height: 18px; border-radius: 50%; object-fit: contain; vertical-align: middle; flex-shrink: 0;" />
                                                        <span style="color: #334155; font-size: 13px; font-weight: 600; letter-spacing: -0.01em;">Unverified Sender (Offline)</span>
                                                    </div>
                                                `;
                                            }
                                            updateOrAppendStamp(composeBody, badgeInnerHtml);
                                        });
                                    }
                                    showVerificationWarningToast("Server Offline", "Dispatching email with unverified offline status.");
                                    logAuditEvent('sent_unstamped', recipientEmail, { sender: realEmail, recipient: recipientEmail });
                                    sendBtn.setAttribute('data-hvel-verified', 'true');
                                    setTimeout(() => {
                                        sendBtn.click();
                                    }, 800);
                                    return;
                                }

                                const finalizeSend = (recordUrl) => {
                                    chrome.storage.local.get(['hvel_stamp_mode'], (prefs) => {
                                        const stampMode = prefs.hvel_stamp_mode || 'with_link';
                                        const extraData = {
                                            sender: realEmail,
                                            recipient: recipientEmail,
                                            verificationId: recordUrl ? recordUrl.split('/v/').pop() : null,
                                            contentHash: contentHash
                                        };

                                        if (stampMode === 'hash_only' || !recordUrl) {
                                            logAuditEvent('sent_stamped_hash', recipientEmail, extraData);
                                        } else {
                                            logAuditEvent('sent_stamped_link', recipientEmail, extraData);
                                        }

                                        if (composeBody) {
                                            let badgeInnerHtml;
                                            if (isHuman) {
                                                if (stampMode === 'hash_only' || !recordUrl) {
                                                    badgeInnerHtml = `
                                                        <div style="display: inline-flex; align-items: center; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 9999px; padding: 4px 12px; gap: 6px; box-shadow: 0 1px 2px rgba(0,0,0,0.05);">
                                                            <img src="https://api.attest.page/stamp-icon.png" style="width: 18px; height: 18px; border-radius: 50%; object-fit: contain; vertical-align: middle; flex-shrink: 0;" />
                                                            <span style="color: #065f46; font-size: 13px; font-weight: 600; letter-spacing: -0.01em;">Attest</span>
                                                        </div>
                                                        <div style="margin-top: 5px; font-size: 9px; color: #94a3b8;">
                                                            <span>Hash: ${contentHash}</span>
                                                        </div>
                                                    `;
                                                } else {
                                                    badgeInnerHtml = `
                                                        <a href="${recordUrl}" target="_blank" style="display: inline-flex; align-items: center; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 9999px; padding: 4px 12px; gap: 6px; box-shadow: 0 1px 2px rgba(0,0,0,0.05); text-decoration: none; cursor: pointer;" title="Click to view Attest Trust Record">
                                                            <img src="https://api.attest.page/stamp-icon.png" style="width: 18px; height: 18px; border-radius: 50%; object-fit: contain; vertical-align: middle; flex-shrink: 0;" />
                                                            <span style="color: #065f46; font-size: 13px; font-weight: 600; letter-spacing: -0.01em;">Attest</span>
                                                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#059669" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-left: 1px;"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
                                                        </a>
                                                    `;
                                                }
                                            } else {
                                                if (stampMode === 'hash_only' || !recordUrl) {
                                                    badgeInnerHtml = `
                                                        <div style="display: inline-flex; align-items: center; background: #fef2f2; border: 1px solid #fca5a5; border-radius: 9999px; padding: 4px 12px; gap: 6px; box-shadow: 0 1px 2px rgba(0,0,0,0.05);">
                                                            <img src="https://api.attest.page/stamp-icon.png" style="width: 18px; height: 18px; border-radius: 50%; object-fit: contain; vertical-align: middle; flex-shrink: 0;" />
                                                            <span style="color: #991b1b; font-size: 13px; font-weight: 600; letter-spacing: -0.01em;">Robotic Sender</span>
                                                        </div>
                                                        <div style="margin-top: 5px; font-size: 9px; color: #94a3b8;">
                                                            <span>Hash: ${contentHash}</span>
                                                        </div>
                                                    `;
                                                } else {
                                                    badgeInnerHtml = `
                                                        <a href="${recordUrl}" target="_blank" style="display: inline-flex; align-items: center; background: #fef2f2; border: 1px solid #fca5a5; border-radius: 9999px; padding: 4px 12px; gap: 6px; box-shadow: 0 1px 2px rgba(0,0,0,0.05); text-decoration: none; cursor: pointer;" title="Click to view Attest Trust Record">
                                                            <img src="https://api.attest.page/stamp-icon.png" style="width: 18px; height: 18px; border-radius: 50%; object-fit: contain; vertical-align: middle; flex-shrink: 0;" />
                                                            <span style="color: #991b1b; font-size: 13px; font-weight: 600; letter-spacing: -0.01em;">Robotic Sender</span>
                                                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-left: 1px;"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
                                                        </a>
                                                    `;
                                                }
                                            }
                                            updateOrAppendStamp(composeBody, badgeInnerHtml);
                                        }

                                        // Flash compose indicator → Verified
                                        if (activeComposeDialog) {
                                            flashComposeVerified(activeComposeDialog);
                                            activeComposeDialog = null;
                                            composeMousePoints = [];
                                        }

                                        if (isHuman) {
                                            showVerificationSuccessToast("Human intent confirmed! Appending green trust badge...");
                                        } else {
                                            showVerificationWarningToast("Robotic / AI Sender", "Robotic pattern detected. Appending robotic stamp...");
                                        }

                                        sendBtn.setAttribute('data-hvel-verified', 'true');
                                        setTimeout(() => { sendBtn.click(); }, 800);
                                    });
                                };

                                if (isVerifySuccess) {
                                    finalizeSend(verifyRes.url);
                                } else {
                                    if (composeBody) {
                                        composeBody.querySelectorAll('.hvel-badge-wrapper').forEach(el => el.remove());
                                    }
                                    showVerificationWarningToast("Verification Blocked", verifyRes.error || "Sender email is not authorized for this Attest session.");
                                }
                            } catch (innerErr) {
                                console.error("HVEL Inner Callback Error:", innerErr);
                                isVerifying = false;
                                restoreSendButton(sendBtn);
                            }
                        });
                    } catch (midErr) {
                        console.error("HVEL Mid Callback Error:", midErr);
                        isVerifying = false;
                        restoreSendButton(sendBtn);
                    }
                }); // end verifyHumanity
                }); // end checkPlanQuota
            } catch (msgErr) {
                console.error("HVEL Message Send Error:", msgErr);
                isVerifying = false;
                restoreSendButton(sendBtn);
                sendBtn.setAttribute('data-hvel-verified', 'true');
                sendBtn.click();
            }
        }, 200);
    } catch (outerErr) {
        console.error("HVEL Outer Handler Error:", outerErr);
        isVerifying = false;
        restoreSendButton(sendBtn);
        sendBtn.setAttribute('data-hvel-verified', 'true');
        sendBtn.click();
    }
}, true);


// ─── PLAN LIMIT MODAL ──────────────────────────────────────────────────
// Shows a premium blocking modal when the user hits their plan quota
// featureKey: 'totp_verify' | 'webauthn' | 'gmail_account'
// usageData: { used, limit, message, plan }
function showPlanLimitModal(featureKey, usageData = {}) {
    const existing = document.getElementById('hvel-plan-limit-modal');
    if (existing) existing.remove();

    const FEATURE_LABELS = {
        totp_verify:   { icon: '🛡️', title: 'Daily Verification Limit Reached', color: '#f59e0b' },
        webauthn:      { icon: '👂', title: 'Biometric is a Pro Feature',       color: '#8b5cf6' },
        gmail_account: { icon: '📧', title: 'Gmail Account Limit Reached',      color: '#3b82f6' },
        audit_dashboard:{ icon: '📊', title: 'Advanced Audit is a Pro Feature', color: '#10b981' },
    };
    const meta = FEATURE_LABELS[featureKey] || { icon: '🚧', title: 'Plan Limit Reached', color: '#ef4444' };

    const used  = usageData.used  ?? '';
    const limit = usageData.limit ?? '';
    const plan  = usageData.plan  || 'free';
    const msg   = usageData.message || 'You have reached the limit for your current plan.';

    const usageBar = (featureKey === 'totp_verify' && typeof used === 'number' && limit)
        ? `<div style="margin:12px 0 0;">
            <div style="display:flex;justify-content:space-between;font-size:11px;color:#94a3b8;margin-bottom:4px;">
                <span>Daily verifications</span><span>${used} / ${limit}</span>
            </div>
            <div style="background:#1e293b;border-radius:9999px;height:6px;overflow:hidden;">
                <div style="background:linear-gradient(90deg,#f59e0b,#ef4444);height:100%;width:100%;border-radius:9999px;"></div>
            </div>
           </div>`
        : '';

    const overlay = document.createElement('div');
    overlay.id = 'hvel-plan-limit-modal';
    overlay.style.cssText = `
        position: fixed; inset: 0; z-index: 99999999;
        background: rgba(8, 10, 15, 0.75);
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
        display: flex; align-items: center; justify-content: center;
        opacity: 0;
        animation: hvelFadeIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    `;

    // Add keyframe animations to document if not already present
    if (!document.getElementById('hvel-modal-animations')) {
        const style = document.createElement('style');
        style.id = 'hvel-modal-animations';
        style.innerHTML = `
            @keyframes hvelFadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }
            @keyframes hvelScaleUp {
                from { transform: scale(0.95); opacity: 0; }
                to { transform: scale(1); opacity: 1; }
            }
            #hvel-modal-upgrade-btn:hover {
                transform: translateY(-1px);
                box-shadow: 0 8px 24px rgba(16, 185, 129, 0.4) !important;
                filter: brightness(1.05);
            }
            #hvel-modal-close:hover {
                background: rgba(255, 255, 255, 0.12) !important;
                color: #f8fafc !important;
            }
            #hvel-modal-later:hover {
                color: #94a3b8 !important;
                text-decoration: underline;
            }
        `;
        document.head.appendChild(style);
    }

    overlay.innerHTML = `
        <div style="
            background: linear-gradient(160deg, #131b2e 0%, #0b0f19 100%);
            border: 1px solid rgba(255, 255, 255, 0.08);
            border-radius: 24px;
            padding: 36px 32px 30px;
            max-width: 440px; width: 90%;
            box-shadow: 0 30px 60px rgba(0, 0, 0, 0.8), inset 0 1px 0 rgba(255, 255, 255, 0.1);
            position: relative;
            transform: scale(0.95);
            animation: hvelScaleUp 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards;
            color: #f1f5f9;
        ">
            <!-- Close Button -->
            <button id="hvel-modal-close" style="
                position: absolute; top: 20px; right: 20px;
                background: rgba(255, 255, 255, 0.05); border: none;
                color: #94a3b8; font-size: 18px; cursor: pointer;
                width: 32px; height: 32px; border-radius: 50%;
                display: flex; align-items: center; justify-content: center;
                transition: all 0.2s ease;
            ">×</button>

            <!-- Icon Header -->
            <div style="display: flex; align-items: center; gap: 16px; margin-bottom: 24px;">
                <div style="
                    width: 52px; height: 52px; border-radius: 16px;
                    background: linear-gradient(135deg, rgba(16, 185, 129, 0.2) 0%, rgba(5, 150, 105, 0.05) 100%);
                    border: 1px solid rgba(16, 185, 129, 0.3);
                    display: flex; align-items: center; justify-content: center;
                    font-size: 26px; flex-shrink: 0;
                    box-shadow: 0 4px 12px rgba(16, 185, 129, 0.1);
                ">${meta.icon}</div>
                <div>
                    <h2 style="font-size: 18px; font-weight: 700; color: #ffffff; margin: 0; letter-spacing: -0.02em;">${meta.title}</h2>
                    <span style="font-size: 10px; font-weight: 700; color: #10b981; text-transform: uppercase; letter-spacing: 0.05em; display: inline-block; margin-top: 4px; background: rgba(16, 185, 129, 0.1); padding: 2px 8px; border-radius: 6px;">
                        ${plan.charAt(0).toUpperCase() + plan.slice(1)} Plan
                    </span>
                </div>
            </div>

            <!-- Description -->
            <p style="font-size: 14px; color: #94a3b8; line-height: 1.6; margin: 0 0 8px; font-weight: 400;">
                ${msg}
            </p>
            ${usageBar}

            <!-- Divider -->
            <div style="height: 1px; background: linear-gradient(90deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.02) 100%); margin: 24px 0;"></div>

            <!-- Pro benefits -->
            <div style="margin-bottom: 28px;">
                <h3 style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.08em; margin: 0 0 14px;">Professional plan includes</h3>
                <div style="display: grid; gap: 10px;">
                    ${[
                        '♾️ Unlimited human verifications',
                        '🔑 WebAuthn biometric login support',
                        '📧 Up to 5 connected Gmail accounts',
                        '📊 Advanced activity & audit dashboard',
                        '🛡️ Enterprise-grade data protection'
                    ].map(feature => `
                        <div style="display: flex; align-items: flex-start; gap: 10px; font-size: 13px; color: #cbd5e1;">
                            <span style="color: #10b981; font-size: 12px; margin-top: 2px; flex-shrink: 0;">✦</span>
                            <span style="line-height: 1.4; font-weight: 500;">${feature.substring(3)}</span>
                        </div>
                    `).join('')}
                </div>
            </div>

            <!-- Pricing & Call to Action -->
            <div style="
                background: linear-gradient(135deg, rgba(16, 185, 129, 0.12) 0%, rgba(5, 150, 105, 0.03) 100%);
                border: 1px solid rgba(16, 185, 129, 0.25);
                border-radius: 16px;
                padding: 16px 20px;
                margin-bottom: 20px;
                display: flex;
                align-items: center;
                justify-content: space-between;
            ">
                <div>
                    <div style="display: flex; align-items: baseline; gap: 4px;">
                        <span style="font-size: 26px; font-weight: 800; color: #10b981; letter-spacing: -0.03em;">$3</span>
                        <span style="font-size: 13px; color: #64748b; font-weight: 500;">/month</span>
                    </div>
                    <div style="margin-top: 2px;">
                        <span style="font-size: 11px; color: #64748b; text-decoration: line-through;">$12</span>
                        <span style="font-size: 10px; font-weight: 700; color: #10b981; margin-left: 6px;">75% OFF</span>
                    </div>
                </div>
                <div style="background: rgba(16, 185, 129, 0.15); color: #10b981; font-size: 11px; font-weight: 700; padding: 4px 10px; border-radius: 9999px; letter-spacing: -0.01em;">
                    🎉 Launch Special
                </div>
            </div>

            <a href="https://attest.page/pricing" target="_blank" id="hvel-modal-upgrade-btn" style="
                display: block; text-align: center;
                background: linear-gradient(135deg, #10b981 0%, #059669 100%);
                color: #ffffff; font-size: 14px; font-weight: 700;
                padding: 14px; border-radius: 14px;
                text-decoration: none;
                box-shadow: 0 4px 16px rgba(16, 185, 129, 0.25);
                transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
            ">Upgrade to Professional →</a>

            <button id="hvel-modal-later" style="
                display: block; width: 100%; margin-top: 14px;
                background: transparent; border: none;
                color: #475569; font-size: 13px; font-weight: 500;
                cursor: pointer; padding: 8px;
                transition: color 0.2s ease;
            ">Maybe later</button>
        </div>
    `;
    document.body.appendChild(overlay);
    overlay.querySelector('#hvel-modal-close').onclick  = () => overlay.remove();
    overlay.querySelector('#hvel-modal-later').onclick  = () => overlay.remove();
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
    console.log(`[HVEL] 🚧 Plan limit modal shown — feature: ${featureKey}`);
}


// ─── PREMIUM INTERFACE UTILITIES ───

// Show premium emerald green success toast notification
function showVerificationSuccessToast(message) {
    const existing = document.getElementById('hvel-success-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.id = 'hvel-success-toast';
    toast.style.cssText = `
        position: fixed;
        top: 24px;
        right: 24px;
        background: linear-gradient(135deg, #ffffff 0%, #f0fdf4 100%);
        border: 1.5px solid #10b981;
        border-radius: 12px;
        padding: 14px 20px;
        color: #065f46;
        z-index: 10000000;
        display: flex;
        align-items: center;
        gap: 12px;
        box-shadow: 0 10px 25px -5px rgba(16, 185, 129, 0.15), 0 8px 10px -6px rgba(16, 185, 129, 0.15);
        font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        animation: hvel-pop-in 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
    `;
    
    toast.innerHTML = `
        <div style="position: relative; display: flex; align-items: center; justify-content: center; width: 28px; height: 28px; background: #e6fbf1; border-radius: 50%; border: 1px solid #a7f3d0; animation: hvel-ring-pulse 2s infinite; flex-shrink: 0;">
            <img src="https://api.attest.page/stamp-icon.png" style="width: 18px; height: 18px; border-radius: 50%; object-fit: contain;" />
        </div>
        <div style="display: flex; flex-direction: column; gap: 2px;">
            <span style="font-size: 14px; font-weight: 700; color: #065f46; letter-spacing: -0.01em;">Attest Verified</span>
            <span style="font-size: 11px; color: #047857; font-weight: 500; opacity: 0.9;">Secure human intent verified</span>
        </div>
    `;
    document.body.appendChild(toast);
    
    setTimeout(() => {
        if (toast.parentElement) {
            toast.style.animation = 'hvel-toast-fade 0.3s ease forwards';
            setTimeout(() => toast.remove(), 300);
        }
    }, 3500);
}

// Show premium warning toast notification for robotic or offline conditions
function showVerificationWarningToast(title, message) {
    const existing = document.getElementById('hvel-warning-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.id = 'hvel-warning-toast';
    toast.style.cssText = `
        position: fixed;
        top: 24px;
        right: 24px;
        background: #ffffff;
        border: 1px solid #fed7aa;
        border-radius: 8px;
        padding: 12px 16px;
        color: #9a3412;
        z-index: 10000000;
        display: flex;
        align-items: center;
        gap: 12px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        max-width: 320px;
        animation: hvel-toast-slide 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    `;
    toast.innerHTML = `
        <span style="font-size: 16px; display: inline-flex; align-items: center; user-select: none;">⚠️</span>
        <div style="flex: 1; text-align: left;">
            <div style="font-size: 13px; font-weight: 600; color: #c2410c; margin-bottom: 2px;">${title}</div>
            <div style="font-size: 11px; color: #64748b; line-height: 1.4;">${message}</div>
        </div>
        <button style="
            background: transparent; border: none; color: #cbd5e1; 
            font-size: 16px; cursor: pointer; padding: 0 2px;
            font-weight: 700; transition: color 0.2s;
        " id="hvel-toast-close">×</button>
    `;
    document.body.appendChild(toast);

    const closeBtn = toast.querySelector('#hvel-toast-close');
    closeBtn.onclick = () => toast.remove();
    closeBtn.onmouseenter = () => closeBtn.style.color = '#64748b';
    closeBtn.onmouseleave = () => closeBtn.style.color = '#cbd5e1';
    
    setTimeout(() => {
        if (toast.parentElement) {
            toast.style.animation = 'hvel-toast-fade 0.3s ease forwards';
            setTimeout(() => toast.remove(), 300);
        }
    }, 5000);
}

// Show premium glassmorphic toast notification
function showBotBlockedToast(message) {
    const existing = document.getElementById('hvel-bot-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.id = 'hvel-bot-toast';
    toast.style.cssText = `
        position: fixed;
        top: 24px;
        right: 24px;
        background: #ffffff;
        border: 1px solid #fca5a5;
        border-radius: 8px;
        padding: 12px 16px;
        color: #991b1b;
        z-index: 10000000;
        display: flex;
        align-items: center;
        gap: 12px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        max-width: 320px;
        animation: hvel-toast-slide 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    `;
    toast.innerHTML = `
        <span style="font-size: 16px; display: inline-flex; align-items: center; user-select: none;">🛡️</span>
        <div style="flex: 1; text-align: left;">
            <div style="font-size: 13px; font-weight: 600; color: #b91c1c; margin-bottom: 2px;">Verification Blocked</div>
            <div style="font-size: 11px; color: #64748b; line-height: 1.4;">${message}</div>
        </div>
        <button style="
            background: transparent; border: none; color: #cbd5e1; 
            font-size: 16px; cursor: pointer; padding: 0 2px;
            font-weight: 700; transition: color 0.2s;
        " id="hvel-toast-close">×</button>
    `;
    document.body.appendChild(toast);

    const closeBtn = toast.querySelector('#hvel-toast-close');
    closeBtn.onclick = () => toast.remove();
    closeBtn.onmouseenter = () => closeBtn.style.color = '#64748b';
    closeBtn.onmouseleave = () => closeBtn.style.color = '#cbd5e1';
    
    setTimeout(() => {
        if (toast.parentElement) {
            toast.style.animation = 'hvel-toast-fade 0.3s ease forwards';
            setTimeout(() => toast.remove(), 300);
        }
    }, 6000);
}

// Shake an element visually to indicate blocking
function shakeElement(el) {
    el.style.animation = 'none';
    void el.offsetWidth; // Force reflow
    el.style.animation = 'hvel-shake 0.4s ease';
}


// ─── PASSIVE INCOMING INBOX SCANNER ───
async function scanIncomingMessages() {
    const messages = document.querySelectorAll('.adn, .ads');

    messages.forEach(async (msg) => {
        if (msg.hasAttribute('data-hvel-scanned')) return;
        // Ignore autocomplete dropdown lists, compose dialogs, and suggestions popups
        if (msg.closest('[role="listbox"]') || msg.closest('[role="dialog"]') || msg.closest('.am') || msg.closest('.aqj')) return;
        msg.setAttribute('data-hvel-scanned', 'true');

        const badgeLinkElement = msg.querySelector('a[href*="/v/"]');
        const badgeLink = (badgeLinkElement && !badgeLinkElement.closest('.gmail_quote, blockquote')) ? badgeLinkElement : null;
        let senderEmail = null;

        const gD = msg.querySelector('.gD');
        if (gD) {
            senderEmail = gD.getAttribute('email') || gD.getAttribute('data-hovercard-id');
        }

        if (!senderEmail || !senderEmail.includes('@')) {
            const emailSpan = msg.querySelector('span[email]');
            if (emailSpan) senderEmail = emailSpan.getAttribute('email');
        }

        if (!senderEmail || !senderEmail.includes('@')) {
            const headerText = msg.innerText.substring(0, 500);
            const match = headerText.match(/[a-zA-Z0-9._%+-]+@gmail\.com/);
            if (match) senderEmail = match[0];
        }

        const recipientEmail = getCurrentUserEmail();
        const IGNORED_DOMAINS = [
            // ── Big Tech & Cloud ──────────────────────────────────────────
            'google.com', 'googleapis.com', 'googlemail.com',
            'microsoft.com', 'outlook.com', 'hotmail.com', 'live.com', 'msn.com', 'office.com', 'azure.com',
            'apple.com', 'icloud.com', 'me.com',
            'amazon.com', 'amazonaws.com', 'aws.com', 'awsapps.com',
            'meta.com', 'facebook.com', 'instagram.com', 'whatsapp.com', 'threads.net',
            'twitter.com', 'x.com',
            'linkedin.com', 'lnkd.in',
            'netflix.com', 'youtube.com',
            'github.com', 'githubapp.com',
            'vercel.com', 'vercel.app',
            'cloudflare.com', 'workers.dev',
            'digitalocean.com',
            'heroku.com',
            'atlassian.com', 'jira.com', 'confluence.com', 'bitbucket.org',
            'oracle.com', 'oraclecloud.com',
            'ibm.com',
            'salesforce.com', 'force.com', 'exacttarget.com',
            'adobe.com', 'adobecc.com',
            'sap.com',
            'twilio.com',
            'sendgrid.com', 'sendgrid.net',
            'mailgun.com', 'mailgun.net',
            'postmarkapp.com',
            'sparkpost.com',

            // ── Finance & Banking ─────────────────────────────────────────
            'paypal.com', 'paypalobjects.com',
            'stripe.com',
            'square.com', 'squareup.com',
            'visa.com',
            'mastercard.com',
            'americanexpress.com', 'amex.com',
            'discover.com', 'services.discover.com',
            'chase.com', 'jpmorgan.com', 'jpmchase.com',
            'bankofamerica.com', 'bac.com',
            'wellsfargo.com',
            'citibank.com', 'citi.com',
            'capitalone.com',
            'usbank.com',
            'tdbank.com', 'td.com',
            'pnc.com',
            'synchrony.com',
            'ally.com',
            'schwab.com',
            'fidelity.com',
            'vanguard.com',
            'coinbase.com',
            'binance.com',
            'robinhood.com',
            'klarna.com',
            'affirm.com',
            'razorpay.com',
            'paytm.com',
            'phonepe.com',
            'googlepay.com',

            // ── Retail & E-Commerce ───────────────────────────────────────
            'walmart.com',
            'target.com',
            'bestbuy.com',
            'ebay.com',
            'etsy.com',
            'shopify.com', 'myshopify.com',
            'aliexpress.com', 'alibaba.com',
            'flipkart.com',
            'myntra.com',
            'nykaa.com',
            'costco.com',
            'homedepot.com',
            'ikea.com',
            'zara.com',
            'hm.com',
            'gap.com',
            'nike.com',
            'adidas.com',
            'samsung.com',
            'sony.com',
            'dell.com',
            'hp.com', 'hpe.com',
            'lenovo.com',

            // ── Travel & Transport ────────────────────────────────────────
            'uber.com', 'ubereats.com',
            'lyft.com',
            'airbnb.com',
            'booking.com',
            'expedia.com',
            'tripadvisor.com',
            'makemytrip.com',
            'goibibo.com',
            'ola.com', 'olacabs.com',
            'doordash.com',
            'grubhub.com',
            'swiggy.com',
            'zomato.com',
            'fedex.com',
            'ups.com',
            'dhl.com',

            // ── Communication & Productivity ──────────────────────────────
            'slack.com',
            'notion.so',
            'dropbox.com',
            'zoom.us',
            'webex.com',
            'teams.microsoft.com',
            'hubspot.com',
            'mailchimp.com',
            'zendesk.com',
            'freshdesk.com', 'freshworks.com',
            'intercom.com', 'intercom.io',
            'calendly.com',
            'asana.com',
            'monday.com',
            'trello.com',
            'airtable.com',
            'box.com',
            'docusign.com',

            // ── Media & Entertainment ─────────────────────────────────────
            'spotify.com',
            'discord.com',
            'twitch.tv',
            'tiktok.com',
            'snapchat.com',
            'reddit.com',
            'quora.com',
            'medium.com',
            'substack.com',
            'wordpress.com', 'wordpress.org',
            'wix.com',
            'squarespace.com',

            // ── Education ─────────────────────────────────────────────────
            'coursera.org',
            'udemy.com',
            'edx.org',
            'khanacademy.org',
            'duolingo.com',
            'skillshare.com',
            'udacity.com',

            // ── Government & Public Services ──────────────────────────────
            'irs.gov', 'usps.gov', 'ssa.gov', 'cdc.gov', 'fbi.gov',
            'gov.uk', 'gov.in', 'nic.in', 'india.gov.in',
            'nhs.uk',
            'europa.eu',

            // ── Security & Identity Providers ─────────────────────────────
            'okta.com', 'oktapreview.com',
            'auth0.com',
            'onelogin.com',
            'duo.com',
            'lastpass.com',
            '1password.com',
            'norton.com',
            'mcafee.com',
            'crowdstrike.com',
        ];
        const senderDomain = senderEmail?.split('@')[1]?.toLowerCase();
        // Also match subdomains (e.g. services.discover.com)
                const isIgnoredDomain = IGNORED_DOMAINS.some(d => senderDomain === d || senderDomain?.endsWith('.' + d));

        console.log(`[HVEL Gmail] Message detected. Sender: "${senderEmail}", Domain Ignored: ${isIgnoredDomain}, Recipient: "${recipientEmail}"`);

        if (senderEmail && senderEmail.toLowerCase() !== recipientEmail.toLowerCase() && !isIgnoredDomain) {
            chrome.storage.local.get(['hvel_verify_received'], (res) => {
                const verifyReceived = res.hvel_verify_received !== false;
                console.log(`[HVEL Gmail] Checking storage for hvel_verify_received: ${verifyReceived}`);
                if (!verifyReceived) {
                    return;
                }

                if (badgeLink) {
                    const url = badgeLink.href;
                    const id = url.split('/v/').pop();
                    console.log(`[HVEL Gmail] Found trust badge link for ID: ${id}. Validating verification...`);

                    chrome.runtime.sendMessage({
                        action: 'validateVerification',
                        id: id,
                        senderEmail: senderEmail,
                        recipientEmail: recipientEmail
                    }, (response) => {
                        console.log(`[HVEL Gmail] Validation result for ID ${id}:`, response);
                        // Even if mismatch (tampered) or verified, show the normal Attest Verified stamp
                        if (response && (response.status === 'verified' || response.status === 'tampered')) {
                            showTrustStatus(msg, 'verified', `Verified Human (${senderEmail})`);
                            if (!msg.hasAttribute('data-hvel-audited')) {
                                msg.setAttribute('data-hvel-audited', 'true');
                                logAuditEvent('received_stamped', senderEmail, { sender: senderEmail, recipient: recipientEmail, verificationId: id });
                            }
                        } else {
                            // If invalid (not found / user does not have extension), show as unverified
                            showTrustStatus(msg, 'unverified', 'Not registered with Attest. This does not mean the email is fake — we just have no trust record on file for this sender.');
                            if (!msg.hasAttribute('data-hvel-audited')) {
                                msg.setAttribute('data-hvel-audited', 'true');
                                logAuditEvent('received_unstamped', senderEmail, { sender: senderEmail, recipient: recipientEmail });
                            }
                        }
                    });
                } else {
                    console.log(`[HVEL Gmail] No trust badge link found. Showing unverified notice for: ${senderEmail}`);
                    showTrustStatus(msg, 'unverified', 'Not registered with Attest. This does not mean the email is fake — we just have no trust record on file for this sender.');
                    if (!msg.hasAttribute('data-hvel-audited')) {
                        msg.setAttribute('data-hvel-audited', 'true');
                        logAuditEvent('received_unstamped', senderEmail, { sender: senderEmail, recipient: recipientEmail });
                    }
                    
                    if (msg.offsetParent !== null) {
                        const normSender = senderEmail.toLowerCase().trim();
                        const nudgeKey = `hvel_nudged_${normSender}`;
                        
                        chrome.storage.local.get([nudgeKey], (nudgeResult) => {
                            const lastNudge = nudgeResult[nudgeKey];
                            const now = Date.now();
                            const dayInMs = 24 * 60 * 60 * 1000;

                            if ((!lastNudge || (now - lastNudge > dayInMs)) && !pendingRequests.has(nudgeKey)) {
                                const dateSpan = msg.querySelector('span[title]');
                                const msgTime = dateSpan ? dateSpan.getAttribute('title') : new Date().toLocaleString();

                                pendingRequests.add(nudgeKey);
                                chrome.storage.local.set({ [nudgeKey]: now });

                                console.log(`[HVEL Gmail] Triggering unverified reply nudge email to: ${normSender}`);
                                chrome.runtime.sendMessage({
                                    action: 'reportUnverifiedReply',
                                    hvelUserEmail: recipientEmail,
                                    noExtensionEmail: normSender,
                                    details: { timestamp: msgTime, url: window.location.href }
                                });
                            }
                        });
                    }
                }
            });
        }
    });
}

function showTrustStatus(msgElement, status, text) {
    const existing = msgElement.querySelector('.hvel-trust-notice');
    if (existing) existing.remove();
    const existingStamp = msgElement.querySelector('.hvel-untrusted-stamp');
    if (existingStamp) existingStamp.remove();

    // Ensure we clean up any legacy background styling from previous sessions
    msgElement.style.removeProperty('background-color');
    msgElement.style.removeProperty('backgroundColor');

    const notice = document.createElement('div');
    notice.className = 'hvel-trust-notice';
    notice.style.cssText = 'display: block !important; width: 100% !important; clear: both !important; margin: 12px 0 !important;';

    if (status === 'verified') {
        notice.innerHTML = `
            <div style="
                margin: 8px 0;
                font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
                display: block;
                clear: both;
            ">
                <div style="
                    display: inline-flex;
                    align-items: center;
                    background: #f0fdf4;
                    border: 1px solid #bbf7d0;
                    border-radius: 9999px;
                    padding: 4px 12px;
                    gap: 6px;
                    box-shadow: 0 1px 2px rgba(0,0,0,0.05);
                ">
                    <span style="font-size: 11px; display: inline-flex; align-items: center; user-select: none;">✅</span>
                    <span style="color: #166534; font-size: 12px; font-weight: 600; letter-spacing: -0.01em;">Attest Verified</span>
                </div>
                <div style="margin-top: 5px; font-size: 10px; color: #14532d; opacity: 0.85; line-height: 1.4;">
                    ${text}
                </div>
            </div>`;
    } else if (status === 'tampered' || status === 'invalid') {
        const title = 'Critical: ID Mismatch Detected';
        notice.innerHTML = `
            <div style="
                margin: 8px 0;
                font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
                display: block;
                clear: both;
            ">
                <div style="
                    display: inline-flex;
                    align-items: center;
                    background: #fff1f2;
                    border: 1px solid #fecaca;
                    border-radius: 9999px;
                    padding: 4px 12px;
                    gap: 6px;
                    box-shadow: 0 1px 2px rgba(0,0,0,0.05);
                ">
                    <span style="font-size: 11px; display: inline-flex; align-items: center; user-select: none;">⚠️</span>
                    <span style="color: #991b1b; font-size: 12px; font-weight: 600; letter-spacing: -0.01em;">${title}</span>
                </div>
                <div style="margin-top: 5px; font-size: 10px; color: #7f1d1d; opacity: 0.9; line-height: 1.4;">
                    ${text}
                </div>
            </div>`;
    } else {
        // 'unverified' — not a threat, just not registered. Small stamp style at the bottom of the email.
        notice.innerHTML = `
            <div style="
                margin: 8px 0;
                font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
                display: block;
                clear: both;
            ">
                <div style="
                    display: inline-flex;
                    align-items: center;
                    background: #fffbeb;
                    border: 1px solid #fde68a;
                    border-radius: 9999px;
                    padding: 4px 12px;
                    gap: 6px;
                    box-shadow: 0 1px 2px rgba(0,0,0,0.05);
                ">
                    <span style="font-size: 11px; display: inline-flex; align-items: center; user-select: none;">⚠️</span>
                    <span style="color: #b45309; font-size: 12px; font-weight: 600; letter-spacing: -0.01em;">Sender Not Yet Verified</span>
                </div>
                <div style="margin-top: 5px; font-size: 10px; color: #78350f; opacity: 0.75; line-height: 1.4;">
                    This sender hasn't installed Attest yet. Treat with normal caution.
                </div>
            </div>`;
    }

    const insertTarget = msgElement.querySelector('.a3s.aiL') || msgElement.querySelector('.a3s') || msgElement.querySelector('.ii.gt') || msgElement;
    insertTarget.insertBefore(notice, insertTarget.firstChild);
}

// Compute SHA-256 hash of email body contents
async function computeHash(text) {
    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Extract recipient emails from the "To" field
function getRecipientEmail(sendBtn) {
    const dialog = sendBtn.closest('div[role="dialog"]');
    if (!dialog) return null;

    const recipientChips = dialog.querySelectorAll('div[role="listitem"] span[email], .vT');
    if (recipientChips.length > 0) {
        const email = recipientChips[0].getAttribute('email') || recipientChips[0].innerText.trim();
        return email.includes('@') ? email : null;
    }

    const recipientArea = dialog.querySelector('textarea[name="to"], input[name="to"]');
    if (recipientArea && recipientArea.value) {
        const match = recipientArea.value.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
        return match ? match[0] : null;
    }

    return null;
}


function updateListBadge(badge, isVerified) {
    if (isVerified) {
        badge.innerText = 'Attest';
        badge.style.setProperty('background', '#e6fbf1', 'important');
        badge.style.setProperty('border', '1px solid #a7f3d0', 'important');
        badge.style.setProperty('color', '#065f46', 'important');
    } else {
        badge.innerText = 'Not Verified';
        badge.style.setProperty('background', '#fff1f2', 'important');
        badge.style.setProperty('border', '1px solid #fecaca', 'important');
        badge.style.setProperty('color', '#991b1b', 'important');
    }
}

function scanGmailInboxList() {
    const rows = document.querySelectorAll('tr.zA');
    rows.forEach(row => {
        const senderEl = row.querySelector('[email], [data-hovercard-id], span.zF');
        let email = null;
        if (senderEl) {
            email = senderEl.getAttribute('email') || senderEl.getAttribute('data-hovercard-id');
        }
        if (!email || !email.includes('@')) {
            const childWithEmail = row.querySelector('[email]');
            if (childWithEmail) email = childWithEmail.getAttribute('email');
        }

        if (!email || !email.includes('@')) return;
        email = email.toLowerCase().trim();

        const dateCell = row.querySelector('td.xW');
        if (!dateCell) return;

        let badge = dateCell.querySelector('.hvel-list-badge');
        if (badge) {
            if (badge.getAttribute('data-email') === email) {
                return;
            }
            badge.setAttribute('data-email', email);
        } else {
            badge = document.createElement('span');
            badge.className = 'hvel-list-badge';
            badge.setAttribute('data-email', email);
            badge.style.cssText = `
                display: inline-flex;
                align-items: center;
                justify-content: center;
                padding: 2px 6px;
                border-radius: 4px;
                font-size: 10px;
                font-weight: 700;
                margin-right: 8px;
                vertical-align: middle;
                user-select: none;
                line-height: 1;
                font-family: Roboto, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
            `;
            dateCell.insertBefore(badge, dateCell.firstChild);
        }

        dateCell.style.setProperty('min-width', '150px', 'important');
        dateCell.style.setProperty('text-align', 'right', 'important');
        dateCell.style.setProperty('white-space', 'nowrap', 'important');

        if (checkedEmailsCache.has(email)) {
            const cached = checkedEmailsCache.get(email);
            if (!cached.checking) {
                updateListBadge(badge, cached.verified);
            }
        } else {
            updateListBadge(badge, false);
            checkedEmailsCache.set(email, { verified: false, checking: true });
            
            chrome.runtime.sendMessage({ action: 'checkUserVerified', email: email }, (response) => {
                const isVerified = !!(response && response.verified);
                checkedEmailsCache.set(email, { verified: isVerified, checking: false });
                if (badge.parentElement && badge.getAttribute('data-email') === email) {
                    updateListBadge(badge, isVerified);
                }
            });
        }
    });
}

// Interval loops to catch dynamically loaded view changes
function runHvelIntervals() {
    scanIncomingMessages();
    scanAndStyleComposeRecipients();
    scanGmailInboxList();
}

setInterval(runHvelIntervals, 1500);

let mutationTimeout = null;
const observer = new MutationObserver(() => {
    if (mutationTimeout) return;
    mutationTimeout = setTimeout(() => {
        runHvelIntervals();
        mutationTimeout = null;
    }, 150);
});
observer.observe(document.body, { childList: true, subtree: true });

runHvelIntervals();

// ─── RECIPIENT TYPING VERIFICATION & STYLE ENGINE ───

function styleChip(chipElement, isVerified) {
    if (isVerified) {
        chipElement.style.setProperty('border', '1px solid #10b981', 'important');
        chipElement.style.setProperty('background-color', '#f0fdf4', 'important');
        chipElement.style.setProperty('background', '#f0fdf4', 'important');
        chipElement.style.setProperty('color', '#065f46', 'important');
        chipElement.querySelectorAll('*').forEach(el => {
            el.style.setProperty('color', '#065f46', 'important');
        });
        chipElement.setAttribute('title', 'HVEL Approved Recipient');
    } else {
        chipElement.style.removeProperty('border');
        chipElement.style.removeProperty('background-color');
        chipElement.style.removeProperty('background');
        chipElement.style.removeProperty('color');
        chipElement.querySelectorAll('*').forEach(el => {
            el.style.removeProperty('color');
        });
        chipElement.removeAttribute('title');
    }
}

function styleInput(input, isVerified) {
    if (isVerified) {
        input.style.setProperty('color', '#059669', 'important');
        input.style.setProperty('background-color', '#f0fdf4', 'important');
    } else {
        resetInputStyle(input);
    }
}

function resetInputStyle(input) {
    input.style.removeProperty('color');
    input.style.removeProperty('background-color');
}

function getRecipientInputs(dialog) {
    const found = [];
    dialog.querySelectorAll('input, textarea').forEach(input => {
        const role = input.getAttribute('role') || '';
        const name = input.getAttribute('name') || '';
        const label = input.getAttribute('aria-label') || '';
        const className = input.className || '';
        
        if (role === 'combobox' || 
            name === 'to' || 
            label.toLowerCase().includes('to') || 
            label.toLowerCase().includes('cc') || 
            label.toLowerCase().includes('bcc') ||
            className.includes('vO')) {
            found.push(input);
        }
    });
    return found;
}

function checkInputValue(input) {
    const val = input.value.trim().toLowerCase();
    const emailMatch = val.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
    if (emailMatch) {
        const email = emailMatch[0];
        if (checkedEmailsCache.has(email)) {
            const cached = checkedEmailsCache.get(email);
            if (!cached.checking) {
                styleInput(input, cached.verified);
            }
        } else {
            checkedEmailsCache.set(email, { verified: false, checking: true });
            chrome.runtime.sendMessage({ action: 'checkUserVerified', email: email }, (response) => {
                const isVerified = !!(response && response.verified);
                checkedEmailsCache.set(email, { verified: isVerified, checking: false });
                styleInput(input, isVerified);
            });
        }
    } else {
        resetInputStyle(input);
    }
}

function scanAndStyleComposeRecipients() {
    const dialogs = document.querySelectorAll('div[role="dialog"]');
    dialogs.forEach(dialog => {
        // 1. Style existing recipient chips
        const chips = dialog.querySelectorAll('div[role="listitem"], .vT');
        let hasUnverified = false;
        let hasVerified = false;

        chips.forEach(chip => {
            // Extract email
            const emailSpan = chip.querySelector('[email]');
            let email = emailSpan ? emailSpan.getAttribute('email') : null;
            if (!email) {
                email = chip.getAttribute('email');
            }
            if (!email) {
                const match = chip.innerText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
                if (match) email = match[0];
            }
            
            if (email) {
                email = email.toLowerCase().trim();
                if (checkedEmailsCache.has(email)) {
                    const cached = checkedEmailsCache.get(email);
                    if (!cached.checking) {
                        styleChip(chip, cached.verified);
                        if (cached.verified) hasVerified = true;
                        else hasUnverified = true;
                    }
                } else {
                    // Query and cache
                    checkedEmailsCache.set(email, { verified: false, checking: true });
                    chrome.runtime.sendMessage({ action: 'checkUserVerified', email: email }, (response) => {
                        const isVerified = !!(response && response.verified);
                        checkedEmailsCache.set(email, { verified: isVerified, checking: false });
                        styleChip(chip, isVerified);
                    });
                }
            }
        });
        
        // 2. Attach listeners to input fields for instant typing feedback
        const inputs = getRecipientInputs(dialog);
        inputs.forEach(input => {
            if (input.getAttribute('data-hvel-listener') === 'true') {
                checkInputValue(input);
                return;
            }
            input.setAttribute('data-hvel-listener', 'true');
            
            const handler = () => {
                checkInputValue(input);
            };
            input.addEventListener('input', handler);
            input.addEventListener('keyup', handler);
            input.addEventListener('blur', () => {
                if (!input.value.trim()) {
                    resetInputStyle(input);
                }
            });
        });

        // 3. Update the compose indicator based on verification status
        const indicator = dialog.querySelector('#hvel-compose-indicator');
        if (indicator) {
            const currentState = indicator.getAttribute('data-hvel-state');
            let newState = 'tracking';
            if (hasVerified && !hasUnverified) newState = 'verified';

            if (currentState !== newState) {
                indicator.setAttribute('data-hvel-state', newState);
                if (newState === 'verified') {
                    indicator.innerHTML = `
                        <span style="width:7px;height:7px;background:#10b981;border-radius:50%;
                            display:inline-block;animation:hvel-pulse-dot 1.5s ease infinite;flex-shrink:0;"></span>
                        <span>HVEL: Approved Recipient</span>
                    `;
                    indicator.style.setProperty('background', 'rgba(16,185,129,0.1)', 'important');
                    indicator.style.setProperty('border-color', 'rgba(16,185,129,0.25)', 'important');
                    indicator.style.setProperty('color', '#059669', 'important');
                } else {
                    indicator.innerHTML = `
                        <span style="width:7px;height:7px;background:#10b981;border-radius:50%;
                            display:inline-block;animation:hvel-pulse-dot 1.5s ease infinite;flex-shrink:0;"></span>
                        <span>HVEL Tracking</span>
                    `;
                    indicator.style.setProperty('background', 'rgba(16,185,129,0.1)', 'important');
                    indicator.style.setProperty('border-color', 'rgba(16,185,129,0.25)', 'important');
                    indicator.style.setProperty('color', '#059669', 'important');
                }
            }
        }
    });
}

function logAuditEvent(type, emailDetail, extra = null) {
    const key = `gmail_hvel_stats_${type}`;
    chrome.storage.local.get([key, 'gmail_hvel_audit_log', 'hvel_auth_token'], (res) => {
        const count = (res[key] || 0) + 1;
        const rawLog = res.gmail_hvel_audit_log || [];
        const newEntry = {
            id: Math.random().toString(36).substring(2, 9),
            type: type,
            email: emailDetail || 'Unknown',
            timestamp: Date.now(),
            extra: extra
        };
        const updatedLog = [newEntry, ...rawLog].slice(0, 100);
        chrome.storage.local.set({
            [key]: count,
            gmail_hvel_audit_log: updatedLog
        }, () => {
            if (res.hvel_auth_token) {
                chrome.runtime.sendMessage({
                    action: 'logAuditEvent',
                    type: type,
                    email: emailDetail,
                    extra: extra
                });
            }
        });
    });
}
