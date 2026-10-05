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
    @keyframes hvel-dot-green-pulse {
        0%, 100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.6); }
        50% { transform: scale(1.15); box-shadow: 0 0 0 4px rgba(16, 185, 129, 0); }
    }
    @keyframes hvel-dot-red-pulse {
        0%, 100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.5); }
        50% { transform: scale(1.15); box-shadow: 0 0 0 4px rgba(239, 68, 68, 0); }
    }
    @keyframes hvel-guide-slide-in {
        from { opacity: 0; transform: translateX(20px); }
        to   { opacity: 1; transform: translateX(0); }
    }
    @keyframes hvel-guide-fade-out {
        to { opacity: 0; transform: translateY(-8px); }
    }
    @keyframes hvel-cursor-blink {
        0%, 100% { opacity: 1; } 50% { opacity: 0; }
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


// ─── SILENT MOUSE & KEYBOARD TRACKING ENGINE ───
let mousePoints = [];
document.addEventListener('mousemove', (e) => {
    mousePoints.push({ x: e.clientX, y: e.clientY, t: Date.now() });
    if (mousePoints.length > 50) mousePoints.shift();
});

let keyboardEvents = [];
let tabNavigations = 0;
window.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') {
        tabNavigations++;
    }
    keyboardEvents.push({
        key: e.key,
        code: e.code,
        time: Date.now()
    });
    if (keyboardEvents.length > 50) {
        keyboardEvents.shift();
    }
}, true);


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

// ─── STAMP HTML GENERATOR ───
function generateStampHTML({ status = 'human', recordUrl = null, contentHash = '', stampMode = 'with_link' } = {}) {
    const isRobotic = status === 'robotic' || status === 'ai' || status === 'automated';
    const isOffline = status === 'offline' || status === 'unverified';
    
    let bg = '#f0fdf4';
    let border = '#bbf7d0';
    let textColor = '#065f46';
    let label = 'Attest';
    let title = 'Attest Verified Human Sender';
    let arrowColor = '#059669';

    if (isRobotic) {
        bg = '#fef2f2';
        border = '#fca5a5';
        textColor = '#991b1b';
        label = 'Robotic Sender';
        title = 'Attest Security: Robotic Sender Detected';
        arrowColor = '#dc2626';
    } else if (isOffline) {
        bg = '#f8fafc';
        border = '#cbd5e1';
        textColor = '#334155';
        label = 'Attest (Unverified)';
        title = 'Attest Trust Record';
        arrowColor = '#64748b';
    }

    const targetUrl = recordUrl || 'https://attest.page/verify';

    return `
        <a href="${targetUrl}" target="_blank" rel="noopener noreferrer" style="display: inline-flex; align-items: center; background: ${bg}; border: 1px solid ${border}; border-radius: 9999px; padding: 4px 12px; gap: 6px; box-shadow: 0 1px 2px rgba(0,0,0,0.05); text-decoration: none; cursor: pointer; vertical-align: middle; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;" title="${title}">
            <img src="https://attest.page/favicon-32x32.png" alt="✓" width="16" height="16" style="width: 16px; height: 16px; border-radius: 50%; vertical-align: middle; display: inline-block; border: 0;" />
            <span style="color: ${textColor}; font-size: 13px; font-weight: 600; letter-spacing: -0.01em; vertical-align: middle;">${label}</span>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="${arrowColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-left: 1px; vertical-align: middle;"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
        </a>
        ${contentHash ? `<div style="margin-top: 5px; font-size: 9px; color: #94a3b8;" class="hvel-stamp-hash-container"><span class="hvel-stamp-hash">Hash: ${contentHash}</span></div>` : ''}
    `;
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
            
            const badgeInnerHtml = generateStampHTML({
                status: 'human',
                recordUrl: 'https://attest.page/verify',
                contentHash: contentHash,
                stampMode: stampMode
            });
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
            
            const badgeInnerHtml = generateStampHTML({
                status: 'human',
                recordUrl: 'https://attest.page/verify',
                contentHash: contentHash,
                stampMode: stampMode
            });
            
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

                    // Quota & Identity OK — proceed with combined mouse & keyboard biometric verification
                    const pointsToSend = (activeComposeDialog && composeMousePoints.length >= 10)
                        ? composeMousePoints
                        : mousePoints;
                    chrome.runtime.sendMessage({
                        action: 'verifyHumanity',
                        points: pointsToSend,
                        keystrokes: keyboardEvents,
                        tabNavigations: tabNavigations
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
                                    const badgeInnerHtml = generateStampHTML({
                                        status: 'offline',
                                        recordUrl: 'https://attest.page/verify',
                                        contentHash: contentHash,
                                        stampMode: stampMode
                                    });
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
                                            const badgeInnerHtml = generateStampHTML({
                                                status: 'offline',
                                                recordUrl: 'https://attest.page/verify',
                                                contentHash: contentHash,
                                                stampMode: stampMode
                                            });
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
                                        const effectiveRecordUrl = recordUrl || 'https://attest.page/verify';
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
                                            const badgeInnerHtml = generateStampHTML({
                                                status: isHuman ? 'human' : 'robotic',
                                                recordUrl: effectiveRecordUrl,
                                                contentHash: contentHash,
                                                stampMode: stampMode
                                            });
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
            <img src="https://attest.page/favicon-32x32.png" style="width: 18px; height: 18px; border-radius: 50%; object-fit: contain;" />
        </div>
        <div style="display: flex; flex-direction: column; gap: 2px;">
            <span style="font-size: 14px; font-weight: 700; color: #065f46; letter-spacing: -0.01em;">Attest</span>
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
        const existingBadge = msg.querySelector('.hvel-header-badge');
        if (msg.hasAttribute('data-hvel-scanned') && existingBadge) return;
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

        if (senderEmail && !isIgnoredDomain) {
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
                    console.log(`[HVEL Gmail] No trust badge link found. Checking user verification status for: ${senderEmail}`);
                    chrome.runtime.sendMessage({ action: 'checkUserVerified', email: senderEmail }, (userRes) => {
                        const isVerifiedSender = !!(userRes && userRes.verified);
                        if (isVerifiedSender) {
                            showTrustStatus(msg, 'verified', `Verified Human (${senderEmail})`);
                            if (!msg.hasAttribute('data-hvel-audited')) {
                                msg.setAttribute('data-hvel-audited', 'true');
                                logAuditEvent('received_stamped', senderEmail, { sender: senderEmail, recipient: recipientEmail });
                            }
                        } else {
                            showTrustStatus(msg, 'unverified', 'Not registered with Attest. This does not mean the email is fake — we just have no trust record on file for this sender.');
                            if (!msg.hasAttribute('data-hvel-audited')) {
                                msg.setAttribute('data-hvel-audited', 'true');
                                logAuditEvent('received_unstamped', senderEmail, { sender: senderEmail, recipient: recipientEmail });
                            }
                        }
                    });
                    
                    if (msg.offsetParent !== null) {
                        const normSender = senderEmail.toLowerCase().trim();
                        const nudgeKey = `hvel_nudged_${normSender}`;
                        
                        chrome.storage.local.get([nudgeKey, 'hvel_enable_nudge'], (storageRes) => {
                            const enableNudge = storageRes.hvel_enable_nudge === true;
                            if (!enableNudge) return;

                            const lastNudge = storageRes[nudgeKey];
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
    const existing = msgElement.querySelectorAll('.hvel-trust-notice, .hvel-untrusted-stamp, .hvel-header-badge');
    existing.forEach(el => el.remove());

    // Ensure we clean up any legacy background styling from previous sessions
    msgElement.style.removeProperty('background-color');
    msgElement.style.removeProperty('backgroundColor');

    const badge = document.createElement('span');
    badge.className = 'hvel-header-badge';

    if (status === 'verified') {
        badge.style.cssText = `
            display: inline-flex;
            align-items: center;
            gap: 4px;
            margin-left: 8px;
            padding: 2px 8px;
            background: #f0fdf4;
            border: 1px solid #bbf7d0;
            border-radius: 9999px;
            font-size: 11px;
            font-weight: 600;
            color: #166534;
            vertical-align: middle;
            user-select: none;
            box-shadow: 0 1px 2px rgba(0,0,0,0.04);
        `;
        badge.title = text || 'Verified Human Sender with Attest';
        badge.innerHTML = `<span>✅</span><span>Attest</span>`;
    } else if (status === 'tampered' || status === 'invalid') {
        badge.style.cssText = `
            display: inline-flex;
            align-items: center;
            gap: 4px;
            margin-left: 8px;
            padding: 2px 8px;
            background: #fff1f2;
            border: 1px solid #fecaca;
            border-radius: 9999px;
            font-size: 11px;
            font-weight: 600;
            color: #991b1b;
            vertical-align: middle;
            user-select: none;
            box-shadow: 0 1px 2px rgba(0,0,0,0.04);
        `;
        badge.title = text || 'Critical: ID Mismatch Detected';
        badge.innerHTML = `<span>⚠️</span><span>ID Mismatch</span>`;
    } else {
        badge.style.cssText = `
            display: inline-flex;
            align-items: center;
            gap: 4px;
            margin-left: 8px;
            padding: 2px 8px;
            background: #fffbeb;
            border: 1px solid #fde68a;
            border-radius: 9999px;
            font-size: 11px;
            font-weight: 600;
            color: #b45309;
            vertical-align: middle;
            user-select: none;
            box-shadow: 0 1px 2px rgba(0,0,0,0.04);
        `;
        badge.title = 'This sender hasn\'t installed Attest yet. Treat with normal caution.';
        badge.innerHTML = `<span>⚠️</span><span>Sender Not Yet Verified</span>`;
    }

    // Target the email header row element right next to <sender@email.com>
    const headerSenderEl = msgElement.querySelector('span.go') || 
                           msgElement.querySelector('span.gD') || 
                           msgElement.querySelector('h3.iw') || 
                           msgElement.querySelector('.gE.iv.gt') ||
                           msgElement.querySelector('.gD');

    if (headerSenderEl) {
        headerSenderEl.after(badge);
    } else {
        // Fallback: top of email body
        const notice = document.createElement('div');
        notice.className = 'hvel-trust-notice';
        notice.style.cssText = 'display: block !important; width: 100% !important; clear: both !important; margin: 12px 0 !important;';
        notice.appendChild(badge);
        const insertTarget = msgElement.querySelector('.a3s.aiL') || msgElement.querySelector('.a3s') || msgElement.querySelector('.ii.gt') || msgElement;
        insertTarget.insertBefore(notice, insertTarget.firstChild);
    }
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
    badge.innerHTML = '';
    const dot = document.createElement('span');
    dot.className = isVerified ? 'hvel-dot-green' : 'hvel-dot-red';
    if (isVerified) {
        dot.title = 'Attest Verified — confirmed human sender';
        dot.style.cssText = `
            display: block;
            width: 7px;
            height: 7px;
            border-radius: 50%;
            background: #10b981;
            box-shadow: 0 0 5px rgba(16, 185, 129, 0.5);
            flex-shrink: 0;
        `;
    } else {
        dot.title = 'Sender not verified by Attest';
        dot.style.cssText = `
            display: block;
            width: 7px;
            height: 7px;
            border-radius: 50%;
            background: #ef4444;
            box-shadow: 0 0 4px rgba(239, 68, 68, 0.4);
            flex-shrink: 0;
        `;
    }
    badge.appendChild(dot);
    badge.style.removeProperty('background');
    badge.style.removeProperty('border');
    badge.style.removeProperty('color');
}

function scanGmailInboxList() {
    // Proactively clean up any legacy row pills from the list view
    document.querySelectorAll('.hvel-row-pill').forEach(pill => pill.remove());

    chrome.storage.local.get(['hvel_verify_received'], (res) => {
        const isEnabled = res.hvel_verify_received !== false;
        if (!isEnabled) {
            document.querySelectorAll('.hvel-list-badge').forEach(badge => badge.remove());
            return;
        }

        const rows = document.querySelectorAll('tr.zA');
        rows.forEach(row => {
            const senderEl = row.querySelector('[email], [data-hovercard-id], span.zF, span.yP, span.bAq, td.yX span');
            let email = null;
            if (senderEl) {
                email = senderEl.getAttribute('email') || senderEl.getAttribute('data-hovercard-id');
            }
            if (!email || !email.includes('@')) {
                const childWithEmail = row.querySelector('[email], [data-hovercard-id], a[href^="mailto:"]');
                if (childWithEmail) {
                    email = childWithEmail.getAttribute('email') || 
                            childWithEmail.getAttribute('data-hovercard-id') || 
                            childWithEmail.getAttribute('href')?.replace('mailto:', '');
                }
            }
            if (!email || !email.includes('@')) {
                const titleEl = row.querySelector('[title*="@"], [aria-label*="@"]');
                if (titleEl) {
                    const titleStr = titleEl.getAttribute('title') || titleEl.getAttribute('aria-label') || '';
                    const match = titleStr.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
                    if (match) email = match[0];
                }
            }
            // Fallback: Handle senders like "me", "Google", "Attest" where Gmail does not attach email attributes
            if (!email) {
                const senderTextEl = row.querySelector('span.zF, span.yP, span.bAq, td.yX span, td.yX');
                if (senderTextEl) {
                    const rawName = senderTextEl.innerText.trim();
                    if (rawName) {
                        if (rawName.toLowerCase() === 'me') {
                            email = (typeof getCurrentUserEmail === 'function' ? getCurrentUserEmail() : null) || cachedUserEmail || 'me@gmail.com';
                        } else {
                            const safeSlug = rawName.toLowerCase().replace(/[^a-z0-9]/g, '');
                            email = safeSlug ? `${safeSlug}@domain.com` : 'unknown@domain.com';
                        }
                    }
                }
            }

            if (!email) return;
            email = email.toLowerCase().trim();

            const dateCell = row.querySelector('td.xW');
            if (!dateCell) return;

            // Enable relative positioning on dateCell to anchor absolute dot placement
            dateCell.style.setProperty('position', 'relative', 'important');

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
                    position: absolute;
                    right: 82px;
                    top: 50%;
                    transform: translateY(-50%);
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    user-select: none;
                    z-index: 2;
                    pointer-events: auto;
                `;
                dateCell.appendChild(badge);
            }

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
    });
}

// Real-time listener: remove or render dots immediately when user toggles setting
chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local' && changes.hvel_verify_received) {
        if (changes.hvel_verify_received.newValue === false) {
            document.querySelectorAll('.hvel-list-badge, .hvel-row-pill').forEach(badge => badge.remove());
        } else {
            scanGmailInboxList();
        }
    }
});

// Fast interval loops and instant scroll listener to eliminate latency completely
function runHvelIntervals() {
    scanIncomingMessages();
    scanAndStyleComposeRecipients();
    scanGmailInboxList();
}

setInterval(runHvelIntervals, 300);

// Instant scroll listener for zero-latency dot rendering
window.addEventListener('scroll', () => {
    requestAnimationFrame(scanGmailInboxList);
}, { passive: true, capture: true });

let mutationTimeout = null;
const observer = new MutationObserver(() => {
    if (mutationTimeout) return;
    mutationTimeout = setTimeout(() => {
        runHvelIntervals();
        mutationTimeout = null;
    }, 16);
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

// ─── FIRST-TIME ONBOARDING GUIDE ──────────────────────────────────────────
// Shows a single, dismissible tooltip with a typing animation explaining the
// green/red dot system and the Attest stamp — only on the very first install.
function showFirstTimeGuide() {
    chrome.storage.local.get(['hvel_guide_shown'], (res) => {
        if (res.hvel_guide_shown) return; // Already shown — skip
        chrome.storage.local.set({ hvel_guide_shown: true });

        // Wait briefly for Gmail UI to fully settle
        setTimeout(() => _renderGuide(), 1800);
    });
}

function _renderGuide() {
    if (document.getElementById('hvel-onboard-guide')) return;

    const overlay = document.createElement('div');
    overlay.id = 'hvel-onboard-guide';
    overlay.style.cssText = `position:fixed;inset:0;z-index:99999999;background:rgba(0,0,0,0.42);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;padding:16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;animation:hvel-guide-slide-in 0.35s cubic-bezier(0.16,1,0.3,1) forwards;`;

    const modal = document.createElement('div');
    modal.style.cssText = `background:#fff;border-radius:24px;width:100%;max-width:660px;box-shadow:0 40px 80px rgba(0,0,0,0.25);position:relative;overflow:hidden;`;

    modal.innerHTML = `
    <button id="hvel-gc" style="position:absolute;top:14px;right:14px;width:34px;height:34px;border-radius:50%;background:#f3f4f6;border:none;cursor:pointer;font-size:19px;color:#6b7280;display:flex;align-items:center;justify-content:center;z-index:2;">×</button>
    <!-- HERO -->
    <div style="display:flex;align-items:center;padding:32px 32px 24px;gap:20px;border-bottom:1px solid #f0f0f0;position:relative;overflow:hidden;">
      <div style="position:absolute;top:-40px;left:-40px;width:180px;height:180px;border-radius:50%;background:radial-gradient(circle,rgba(16,185,129,0.07),transparent 70%);pointer-events:none;"></div>
      <div style="flex:1;">
        <div style="width:58px;height:58px;border-radius:50%;background:linear-gradient(135deg,#d1fae5,#a7f3d0);display:flex;align-items:center;justify-content:center;margin-bottom:14px;box-shadow:0 4px 14px rgba(16,185,129,0.2);">
          <img src="https://attest.page/favicon-32x32.png" style="width:34px;height:34px;border-radius:50%;object-fit:contain;" onerror="this.style.display='none'" />
        </div>
        <div style="font-size:16px;font-weight:600;color:#374151;">Welcome to</div>
        <div style="font-size:42px;font-weight:900;color:#059669;letter-spacing:-0.04em;line-height:1;margin-bottom:8px;">Attest</div>
        <div style="font-size:13px;color:#9ca3af;margin-bottom:20px;">Human-first email verification</div>
        <button id="hvel-qsg" style="display:inline-flex;align-items:center;gap:8px;border:1.5px solid #10b981;border-radius:9999px;background:#fff;color:#059669;font-size:13px;font-weight:600;padding:8px 18px;cursor:pointer;transition:all 0.2s;">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#059669" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M9 9h6M9 12h6M9 15h4"/></svg>
          Quick Start Guide &nbsp;→
        </button>
      </div>
      <div style="flex-shrink:0;width:230px;position:relative;">
        <div style="position:absolute;top:-6px;left:-6px;z-index:1;background:#fff;border:1.5px solid #bbf7d0;border-radius:12px;padding:7px 11px;display:flex;align-items:center;gap:8px;box-shadow:0 4px 14px rgba(0,0,0,0.09);">
          <img src="https://attest.page/favicon-32x32.png" style="width:18px;height:18px;border-radius:50%;object-fit:contain;" onerror="this.style.display='none'" />
          <div><div style="font-size:11px;font-weight:700;color:#065f46;">Attest</div><div style="font-size:10px;color:#10b981;font-weight:600;">Verified ✓</div></div>
        </div>
        <svg viewBox="0 0 230 185" width="230" height="185" xmlns="http://www.w3.org/2000/svg">
          <circle cx="122" cy="103" r="74" fill="#f0fdf4"/>
          <rect x="50" y="122" width="124" height="7" rx="3" fill="#d1d5db"/>
          <rect x="60" y="89" width="104" height="36" rx="5" fill="#e5e7eb"/>
          <rect x="63" y="92" width="98" height="30" rx="4" fill="#fff"/>
          <rect x="69" y="97" width="52" height="3" rx="2" fill="#d1fae5"/>
          <rect x="69" y="103" width="38" height="3" rx="2" fill="#e5e7eb"/>
          <rect x="69" y="109" width="46" height="3" rx="2" fill="#e5e7eb"/>
          <rect x="98" y="55" width="48" height="62" rx="11" fill="#059669"/>
          <circle cx="122" cy="43" r="18" fill="#fde68a"/>
          <path d="M105 36 Q110 19 122 17 Q135 15 142 34 Q133 24 122 26 Q111 28 105 36" fill="#1f2937"/>
          <circle cx="117" cy="41" r="2" fill="#1f2937"/>
          <circle cx="127" cy="41" r="2" fill="#1f2937"/>
          <path d="M117 50 Q122 55 127 50" stroke="#92400e" stroke-width="1.5" fill="none" stroke-linecap="round"/>
          <rect x="140" y="90" width="16" height="9" rx="4" fill="#059669"/>
          <rect x="147" y="85" width="14" height="17" rx="4" fill="#fff" stroke="#d1d5db" stroke-width="1.5"/>
          <rect x="38" y="75" width="24" height="17" rx="3" fill="#fff" stroke="#10b981" stroke-width="1.5"/>
          <path d="M38 78 L50 86 L62 78" stroke="#10b981" stroke-width="1.5" fill="none" stroke-linecap="round"/>
          <path d="M176 55 L185 65 L166 72 Z" fill="#10b981" opacity="0.7"/>
          <circle cx="154" cy="35" r="3" fill="#10b981" opacity="0.5"/>
          <circle cx="45" cy="50" r="2" fill="#10b981" opacity="0.4"/>
          <circle cx="190" cy="84" r="2.5" fill="#10b981" opacity="0.5"/>
        </svg>
      </div>
    </div>
    <!-- TWO CARDS -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;padding:20px 24px 24px;">
      <div style="background:#fafafa;border:1px solid #e5e7eb;border-radius:14px;padding:16px 14px;">
        <div style="font-size:10px;font-weight:800;color:#374151;text-transform:uppercase;letter-spacing:0.07em;margin-bottom:12px;">What the dots mean</div>
        <div style="display:flex;align-items:center;gap:10px;padding:9px 11px;background:#f0fdf4;border-radius:9px;margin-bottom:8px;">
          <span style="width:12px;height:12px;border-radius:50%;background:#10b981;display:inline-block;flex-shrink:0;animation:hvel-dot-green-pulse 1.8s ease-in-out infinite;"></span>
          <span style="font-size:12px;color:#374151;font-weight:500;">Sender is <strong style="color:#059669;">Attest verified</strong> — confirmed human</span>
        </div>
        <div style="display:flex;align-items:center;gap:10px;padding:9px 11px;background:#fff5f5;border-radius:9px;">
          <span style="width:12px;height:12px;border-radius:50%;background:#ef4444;display:inline-block;flex-shrink:0;animation:hvel-dot-red-pulse 2.2s ease-in-out infinite;"></span>
          <span style="font-size:12px;color:#374151;font-weight:500;">Sender has <strong style="color:#dc2626;">not been verified</strong> by Attest yet</span>
        </div>
      </div>
      <div style="background:#fafafa;border:1px solid #e5e7eb;border-radius:14px;padding:16px 14px;">
        <div style="font-size:10px;font-weight:800;color:#374151;text-transform:uppercase;letter-spacing:0.07em;margin-bottom:10px;">The Attest Stamp</div>
        <div style="font-size:12px;color:#374151;line-height:1.65;">● When you compose an email, Attest automatically adds a stamp at the bottom.<br/><br/>● The stamp proves you are a real human — not a bot.</div>
      </div>
    </div>
    <!-- GOT IT -->
    <div style="padding:0 24px 24px;">
      <button id="hvel-gg" style="width:100%;background:linear-gradient(135deg,#16a34a,#059669);color:#fff;font-size:15px;font-weight:700;border:none;border-radius:12px;padding:14px;cursor:pointer;box-shadow:0 5px 20px rgba(16,185,129,0.35);display:flex;align-items:center;justify-content:center;gap:10px;transition:all 0.2s;">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M22 2L11 13" stroke="white" stroke-width="2" stroke-linecap="round"/><path d="M22 2L15 22L11 13L2 9L22 2Z" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
        Got it, let's go!
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
      </button>
    </div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    const dismiss = () => { overlay.style.animation='hvel-guide-fade-out 0.3s ease forwards'; setTimeout(()=>overlay.remove(),300); };
    modal.querySelector('#hvel-gc').onclick = dismiss;
    modal.querySelector('#hvel-gg').onclick = dismiss;
    overlay.onclick = (e) => { if(e.target===overlay) dismiss(); };

    const qsg = modal.querySelector('#hvel-qsg');
    qsg.onmouseenter = ()=>qsg.style.background='#f0fdf4';
    qsg.onmouseleave = ()=>qsg.style.background='#fff';
    qsg.onclick = () => { dismiss(); setTimeout(()=>_runQuickStartTour(), 350); };

    const gg = modal.querySelector('#hvel-gg');
    gg.onmouseenter = ()=>{gg.style.filter='brightness(1.08)';gg.style.transform='translateY(-1px)';};
    gg.onmouseleave = ()=>{gg.style.filter='';gg.style.transform='';};  
}
// ─── INTERACTIVE QUICK START TOUR ────────────────────────────────────────────
function _runQuickStartTour() {
    if (document.getElementById('hvel-tour-backdrop')) return;

    if (!document.getElementById('hvel-tour-styles')) {
        const style = document.createElement('style');
        style.id = 'hvel-tour-styles';
        style.textContent = `
            @keyframes hvel-tour-fade-in {
                from { opacity: 0; transform: translate(-50%, -46%) scale(0.96); }
                to { opacity: 1; transform: translate(-50%, -50%) scale(1); }
            }
            @keyframes hvel-stamp-pop {
                0% { opacity: 0; transform: translateY(10px) scale(0.9); }
                100% { opacity: 1; transform: translateY(0) scale(1); }
            }
        `;
        document.head.appendChild(style);
    }

    const backdrop = document.createElement('div');
    backdrop.id = 'hvel-tour-backdrop';
    backdrop.style.cssText = 'position:fixed;inset:0;z-index:99999990;background:rgba(0,0,0,0.52);backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);';

    const card = document.createElement('div');
    card.id = 'hvel-tour-card';
    card.style.cssText = `
        position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);
        z-index:99999999;width:460px;max-width:92vw;
        background:#ffffff;border-radius:24px;
        box-shadow:0 30px 70px rgba(0,0,0,0.3);
        padding:28px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;
        box-sizing:border-box;animation:hvel-tour-fade-in 0.3s cubic-bezier(0.16,1,0.3,1) forwards;
    `;

    document.body.appendChild(backdrop);
    document.body.appendChild(card);

    let currentStep = 0;

    const steps = [
        {
            title: '1. Unverified Senders (Red Dot)',
            subtitle: 'INBOX VERIFICATION SYSTEM',
            desc: 'Senders who have <strong>not verified with Attest</strong> appear with a small red dot in your Gmail inbox.',
            preview: `
                <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:14px;padding:14px 16px;margin:18px 0;">
                    <div style="display:flex;align-items:center;gap:12px;background:#fff;padding:12px 14px;border-radius:10px;box-shadow:0 2px 8px rgba(0,0,0,0.05);border:1px solid #f3f4f6;">
                        <span style="width:10px;height:10px;border-radius:50%;background:#ef4444;display:inline-block;flex-shrink:0;animation:hvel-dot-red-pulse 2s ease-in-out infinite;"></span>
                        <div style="flex:1;min-width:0;">
                            <div style="font-weight:600;font-size:13px;color:#1f2937;">unverified-sender@external.com</div>
                            <div style="font-size:11px;color:#9ca3af;margin-top:2px;">Not verified by Attest</div>
                        </div>
                        <span style="font-size:11px;color:#9ca3af;">10:42 AM</span>
                    </div>
                </div>
            `
        },
        {
            title: '2. Verified Humans (Green Dot)',
            subtitle: 'INBOX VERIFICATION SYSTEM',
            desc: 'Senders verified by Attest show a <strong>pulsing green dot</strong>, confirming they are real human senders.',
            preview: `
                <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:14px;padding:14px 16px;margin:18px 0;">
                    <div style="display:flex;align-items:center;gap:12px;background:#fff;padding:12px 14px;border-radius:10px;box-shadow:0 2px 8px rgba(16,185,129,0.1);border:1px solid #d1fae5;">
                        <span style="width:10px;height:10px;border-radius:50%;background:#10b981;display:inline-block;flex-shrink:0;animation:hvel-dot-green-pulse 1.8s ease-in-out infinite;"></span>
                        <div style="flex:1;min-width:0;">
                            <div style="font-weight:600;font-size:13px;color:#111827;">verified-human@company.com</div>
                            <div style="font-size:11px;color:#059669;font-weight:500;margin-top:2px;">✓ Verified Human by Attest</div>
                        </div>
                        <span style="font-size:11px;color:#9ca3af;">10:45 AM</span>
                    </div>
                </div>
            `
        },
        {
            title: '3. Composing & Auto-Stamping',
            subtitle: 'AUTOMATIC ATTEST STAMP INJECTION',
            desc: 'When you click <strong>Compose</strong>, Attest automatically injects a verified trust stamp into your email.',
            preview: `
                <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:14px;padding:16px;margin:18px 0;position:relative;overflow:hidden;">
                    <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;">
                        <div style="background:#059669;color:#fff;font-size:12px;font-weight:700;padding:6px 14px;border-radius:20px;display:flex;align-items:center;gap:6px;">
                            <span>+ Compose</span>
                        </div>
                        <span style="font-size:11px;color:#6b7280;">Clicking Compose...</span>
                    </div>
                    <div style="background:#fff;border:1px dashed #10b981;padding:12px;border-radius:10px;animation:hvel-stamp-pop 0.6s cubic-bezier(0.16,1,0.3,1) forwards;">
                        <div style="font-size:11px;color:#6b7280;margin-bottom:6px;">Email Body:</div>
                        <div style="display:inline-flex;align-items:center;gap:8px;background:#f0fdf4;border:1px solid #a7f3d0;border-radius:9999px;padding:5px 12px;">
                            <img src="https://attest.page/favicon-32x32.png" style="width:16px;height:16px;border-radius:50%;" onerror="this.style.display='none'" />
                            <span style="font-size:13px;font-weight:800;color:#065f46;">Attest</span>
                        </div>
                    </div>
                </div>
            `
        },
        {
            title: '4. Ready to Use Attest!',
            subtitle: 'YOU ARE ALL SET',
            desc: 'Your emails will now be automatically verified as human-sent. Enjoy bot-free, trusted communication.',
            preview: `
                <div style="text-align:center;padding:24px 16px;background:linear-gradient(135deg, #f0fdf4, #ecfdf5);border-radius:16px;margin:18px 0;border:1px solid #a7f3d0;">
                    <div style="width:54px;height:54px;border-radius:50%;background:#10b981;color:#fff;display:flex;align-items:center;justify-content:center;margin:0 auto 12px;font-size:26px;box-shadow:0 8px 20px rgba(16,185,129,0.3);">✓</div>
                    <div style="font-size:16px;font-weight:800;color:#065f46;">Attest Security Active</div>
                    <div style="font-size:12px;color:#047857;margin-top:4px;">Protected against automated email spoofing</div>
                </div>
            `
        }
    ];

    function renderStep() {
        const s = steps[currentStep];
        card.innerHTML = `
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
                <span style="font-size:10px;font-weight:800;color:#10b981;letter-spacing:0.08em;text-transform:uppercase;">${s.subtitle}</span>
                <span style="font-size:11px;font-weight:700;color:#9ca3af;">Step ${currentStep + 1} of ${steps.length}</span>
            </div>
            <h3 style="font-size:18px;font-weight:800;color:#111827;margin:0 0 8px;line-height:1.3;">${s.title}</h3>
            <p style="font-size:13px;color:#4b5563;line-height:1.55;margin:0;">${s.desc}</p>
            ${s.preview}
            <div style="display:flex;align-items:center;justify-content:space-between;margin-top:20px;gap:10px;">
                ${currentStep > 0 ? `<button id="hvel-tour-prev" style="background:#f3f4f6;color:#374151;border:none;padding:10px 18px;border-radius:10px;font-size:13px;font-weight:700;cursor:pointer;">← Back</button>` : '<div></div>'}
                <div style="display:flex;gap:8px;">
                    <button id="hvel-tour-skip" style="background:transparent;color:#9ca3af;border:none;padding:10px 14px;font-size:12px;font-weight:600;cursor:pointer;">Skip</button>
                    <button id="hvel-tour-next" style="background:linear-gradient(135deg,#16a34a,#059669);color:#ffffff;border:none;padding:10px 22px;border-radius:10px;font-size:13px;font-weight:700;cursor:pointer;box-shadow:0 4px 14px rgba(16,185,129,0.3);">
                        ${currentStep === steps.length - 1 ? 'Finish Tour' : 'Next →'}
                    </button>
                </div>
            </div>
        `;

        const prevBtn = card.querySelector('#hvel-tour-prev');
        if (prevBtn) prevBtn.onclick = () => { currentStep--; renderStep(); };

        card.querySelector('#hvel-tour-next').onclick = () => {
            if (currentStep < steps.length - 1) {
                currentStep++;
                renderStep();
            } else {
                closeTour();
            }
        };

        card.querySelector('#hvel-tour-skip').onclick = closeTour;
    }

    function closeTour() {
        card.remove();
        backdrop.remove();
    }

    renderStep();
}

showFirstTimeGuide();

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
