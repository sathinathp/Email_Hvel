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
`;
document.head.appendChild(style);

// Track in-flight requests to prevent spamming the server
const pendingRequests = new Set();

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
    }
}

setInterval(sendHeartbeat, 30000); // 30s heartbeat
setInterval(updateProfile, 5 * 60 * 1000); // Sync name/last active every 5m
sendHeartbeat();
updateProfile();
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
    return titleMatch ? titleMatch[0].toLowerCase() : 'unknown-sender@gmail.com';
}

// Function to find the recipient of an incoming message (the current user)
function getCurrentUserEmail() {
    return getSenderEmail();
}


// ─── SILENT MOUSE TRACKING ENGINE ───
let mousePoints = [];
document.addEventListener('mousemove', (e) => {
    mousePoints.push({ x: e.clientX, y: e.clientY, t: Date.now() });
    if (mousePoints.length > 50) {
        mousePoints.shift(); // Keep rolling buffer to last 50 points
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
                chrome.runtime.sendMessage({
                    action: 'verifyHumanity',
                    points: mousePoints
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
                        
                        const emailBodyText = composeBody ? composeBody.innerText : "";
                        const contentHash = await computeHash(emailBodyText);

                        if (isNetworkError) {
                            // Offline / Network Error fallback - let them send, stamp as Offline Unverified
                            isVerifying = false;
                            restoreSendButton(sendBtn);

                            if (composeBody) {
                                const badgeHtml = `
                                    <br/><br/>
                                    <div class="hvel-badge-wrapper" style="font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; display: inline-block;" contenteditable="false">
                                        <div style="display: flex; align-items: center; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 9999px; padding: 4px 12px; gap: 8px; box-shadow: 0 1px 2px rgba(0,0,0,0.05);">
                                            <div style="display: flex; align-items: center; justify-content: center; background: #64748b; color: white; border-radius: 50%; width: 18px; height: 18px; font-size: 10px; font-weight: bold;">
                                                !
                                            </div>
                                            <span style="color: #334155; font-size: 13px; font-weight: 600; letter-spacing: -0.01em;">Unverified Sender (Offline)</span>
                                        </div>
                                        <div style="margin-top: 5px; font-size: 9px; color: #94a3b8;">
                                            <span>Verification Server Offline</span>
                                        </div>
                                    </div>
                                `;
                                composeBody.innerHTML += badgeHtml;
                            }

                            showVerificationWarningToast("Server Offline", "Dispatching email with unverified offline status.");
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
                                        const badgeHtml = `
                                            <br/><br/>
                                            <div class="hvel-badge-wrapper" style="font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; display: inline-block;" contenteditable="false">
                                                <div style="display: flex; align-items: center; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 9999px; padding: 4px 12px; gap: 8px; box-shadow: 0 1px 2px rgba(0,0,0,0.05);">
                                                    <div style="display: flex; align-items: center; justify-content: center; background: #64748b; color: white; border-radius: 50%; width: 18px; height: 18px; font-size: 10px; font-weight: bold;">
                                                        !
                                                    </div>
                                                    <span style="color: #334155; font-size: 13px; font-weight: 600; letter-spacing: -0.01em;">Unverified Sender (Offline)</span>
                                                </div>
                                                <div style="margin-top: 5px; font-size: 9px; color: #94a3b8;">
                                                    <span>Verification Server Offline</span>
                                                </div>
                                            </div>
                                        `;
                                        composeBody.innerHTML += badgeHtml;
                                    }
                                    showVerificationWarningToast("Server Offline", "Dispatching email with unverified offline status.");
                                    sendBtn.setAttribute('data-hvel-verified', 'true');
                                    setTimeout(() => {
                                        sendBtn.click();
                                    }, 800);
                                    return;
                                }

                                // If DB insert succeeded
                                if (isVerifySuccess) {
                                    if (composeBody) {
                                        let badgeHtml;
                                        if (isHuman) {
                                            badgeHtml = `
                                                <br/><br/>
                                                <div class="hvel-badge-wrapper" style="font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; display: inline-block;" contenteditable="false">
                                                    <div style="display: flex; align-items: center; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 9999px; padding: 4px 12px; gap: 8px; box-shadow: 0 1px 2px rgba(0,0,0,0.05);">
                                                        <div style="display: flex; align-items: center; justify-content: center; background: #10b981; color: white; border-radius: 50%; width: 18px; height: 18px;">
                                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                                                                <polyline points="20 6 9 17 4 12"></polyline>
                                                            </svg>
                                                        </div>
                                                        <span style="color: #065f46; font-size: 13px; font-weight: 600; letter-spacing: -0.01em;">Human Verified</span>
                                                        <div style="width: 1px; height: 12px; background: #d1fae5;"></div>
                                                        <a href="${verifyRes.url}" target="_blank" style="color: #059669; font-size: 11px; font-weight: 500; text-decoration: none; display: flex; align-items: center; gap: 3px;">
                                                            <span>Trust Record</span>
                                                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                                                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                                                                <polyline points="15 3 21 3 21 9"></polyline>
                                                                <line x1="10" y1="14" x2="21" y2="3"></line>
                                                            </svg>
                                                        </a>
                                                    </div>
                                                    <div style="margin-top: 5px; font-size: 9px; color: #94a3b8; display: flex; gap: 10px; align-items: center;">
                                                        <span>Hash: ${contentHash.substring(0, 16)}...</span>
                                                        <a href="https://humanattest.com/verify" target="_blank" style="color: #6366f1; text-decoration: underline;">Verify on HVEL Portal</a>
                                                    </div>
                                                </div>
                                            `;
                                        } else {
                                            badgeHtml = `
                                                <br/><br/>
                                                <div class="hvel-badge-wrapper" style="font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; display: inline-block;" contenteditable="false">
                                                    <div style="display: flex; align-items: center; background: #fef2f2; border: 1px solid #fca5a5; border-radius: 9999px; padding: 4px 12px; gap: 8px; box-shadow: 0 1px 2px rgba(0,0,0,0.05);">
                                                        <div style="display: flex; align-items: center; justify-content: center; background: #ef4444; color: white; border-radius: 50%; width: 18px; height: 18px;">
                                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                                                                <circle cx="12" cy="12" r="10"></circle>
                                                                <line x1="15" y1="9" x2="9" y2="15"></line>
                                                                <line x1="9" y1="9" x2="15" y2="15"></line>
                                                            </svg>
                                                        </div>
                                                        <span style="color: #991b1b; font-size: 13px; font-weight: 600; letter-spacing: -0.01em;">Robotic / AI Sender</span>
                                                        <div style="width: 1px; height: 12px; background: #fee2e2;"></div>
                                                        <a href="${verifyRes.url}" target="_blank" style="color: #dc2626; font-size: 11px; font-weight: 500; text-decoration: none; display: flex; align-items: center; gap: 3px;">
                                                            <span>Trust Record</span>
                                                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                                                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                                                                <polyline points="15 3 21 3 21 9"></polyline>
                                                                <line x1="10" y1="14" x2="21" y2="3"></line>
                                                            </svg>
                                                        </a>
                                                    </div>
                                                    <div style="margin-top: 5px; font-size: 9px; color: #94a3b8; display: flex; gap: 10px; align-items: center;">
                                                        <span>Hash: ${contentHash.substring(0, 16)}...</span>
                                                        <a href="https://humanattest.com/verify" target="_blank" style="color: #6366f1; text-decoration: underline;">Verify on HVEL Portal</a>
                                                    </div>
                                                </div>
                                            `;
                                        }
                                        composeBody.innerHTML += badgeHtml;
                                    }

                                    if (isHuman) {
                                        showVerificationSuccessToast("Human intent confirmed! Appending green trust badge...");
                                    } else {
                                        showVerificationWarningToast("Robotic / AI Sender", "Robotic pattern detected. Appending robotic stamp...");
                                    }

                                    sendBtn.setAttribute('data-hvel-verified', 'true');
                                    setTimeout(() => {
                                        sendBtn.click();
                                    }, 800);
                                } else {
                                    // DB save failed but it's not a network error
                                    showVerificationWarningToast("Verification Warning", "Failed to generate trust record, dispatching email.");
                                    sendBtn.setAttribute('data-hvel-verified', 'true');
                                    setTimeout(() => {
                                        sendBtn.click();
                                    }, 800);
                                }
                            } catch (innerErr) {
                                console.error("HVEL Inner Callback Error:", innerErr);
                                isVerifying = false;
                                restoreSendButton(sendBtn);
                                sendBtn.setAttribute('data-hvel-verified', 'true');
                                sendBtn.click();
                            }
                        });
                    } catch (midErr) {
                        console.error("HVEL Mid Callback Error:", midErr);
                        isVerifying = false;
                        restoreSendButton(sendBtn);
                        sendBtn.setAttribute('data-hvel-verified', 'true');
                        sendBtn.click();
                    }
                });
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
}, true); // Capture phase guarantees we intercept before Gmail handlers process the event! // Capture phase guarantees we intercept before Gmail handlers process the event!


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
        background: rgba(15, 23, 42, 0.9);
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
        border: 1px solid rgba(16, 185, 129, 0.35);
        border-radius: 16px;
        padding: 16px 20px;
        color: white;
        z-index: 10000000;
        display: flex;
        align-items: center;
        gap: 14px;
        box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1);
        font-family: 'Segoe UI', system-ui, sans-serif;
        max-width: 380px;
        animation: hvel-toast-slide 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    `;
    toast.innerHTML = `
        <div style="
            width: 36px; height: 36px; border-radius: 10px; 
            background: rgba(16, 185, 129, 0.2); 
            display: flex; align-items: center; justify-content: center;
            font-size: 20px; flex-shrink: 0;
            border: 1px solid rgba(16, 185, 129, 0.3);
        ">✅</div>
        <div style="flex: 1; text-align: left;">
            <div style="font-size: 13px; font-weight: 700; color: #a7f3d0; margin-bottom: 2px;">Identity Verified</div>
            <div style="font-size: 11px; color: #e2e8f0; line-height: 1.4;">${message}</div>
        </div>
        <button style="
            background: transparent; border: none; color: #94a3b8; 
            font-size: 18px; cursor: pointer; padding: 0 4px;
            font-weight: 700; transition: color 0.2s;
        " id="hvel-toast-close">×</button>
    `;
    document.body.appendChild(toast);

    toast.querySelector('#hvel-toast-close').onclick = () => toast.remove();
    
    setTimeout(() => {
        if (toast.parentElement) {
            toast.style.animation = 'hvel-toast-fade 0.4s ease forwards';
            setTimeout(() => toast.remove(), 400);
        }
    }, 4000);
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
        background: rgba(15, 23, 42, 0.9);
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
        border: 1px solid rgba(245, 158, 11, 0.35);
        border-radius: 16px;
        padding: 16px 20px;
        color: white;
        z-index: 10000000;
        display: flex;
        align-items: center;
        gap: 14px;
        box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1);
        font-family: 'Segoe UI', system-ui, sans-serif;
        max-width: 380px;
        animation: hvel-toast-slide 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    `;
    toast.innerHTML = `
        <div style="
            width: 36px; height: 36px; border-radius: 10px; 
            background: rgba(245, 158, 11, 0.2); 
            display: flex; align-items: center; justify-content: center;
            font-size: 20px; flex-shrink: 0;
            border: 1px solid rgba(245, 158, 11, 0.3);
        ">⚠️</div>
        <div style="flex: 1; text-align: left;">
            <div style="font-size: 13px; font-weight: 700; color: #fde047; margin-bottom: 2px;">${title}</div>
            <div style="font-size: 11px; color: #e2e8f0; line-height: 1.4;">${message}</div>
        </div>
        <button style="
            background: transparent; border: none; color: #94a3b8; 
            font-size: 18px; cursor: pointer; padding: 0 4px;
            font-weight: 700; transition: color 0.2s;
        " id="hvel-toast-close">×</button>
    `;
    document.body.appendChild(toast);

    toast.querySelector('#hvel-toast-close').onclick = () => toast.remove();
    
    setTimeout(() => {
        if (toast.parentElement) {
            toast.style.animation = 'hvel-toast-fade 0.4s ease forwards';
            setTimeout(() => toast.remove(), 400);
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
        background: rgba(15, 23, 42, 0.9);
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
        border: 1px solid rgba(239, 68, 68, 0.35);
        border-radius: 16px;
        padding: 16px 20px;
        color: white;
        z-index: 10000000;
        display: flex;
        align-items: center;
        gap: 14px;
        box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1);
        font-family: 'Segoe UI', system-ui, sans-serif;
        max-width: 380px;
        animation: hvel-toast-slide 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    `;
    toast.innerHTML = `
        <div style="
            width: 36px; height: 36px; border-radius: 10px; 
            background: rgba(239, 68, 68, 0.2); 
            display: flex; align-items: center; justify-content: center;
            font-size: 20px; flex-shrink: 0;
            border: 1px solid rgba(239, 68, 68, 0.3);
        ">🛡️</div>
        <div style="flex: 1; text-align: left;">
            <div style="font-size: 13px; font-weight: 700; color: #fca5a5; margin-bottom: 2px;">Verification Blocked</div>
            <div style="font-size: 11px; color: #e2e8f0; line-height: 1.4;">${message}</div>
        </div>
        <button style="
            background: transparent; border: none; color: #94a3b8; 
            font-size: 18px; cursor: pointer; padding: 0 4px;
            font-weight: 700; transition: color 0.2s;
        " id="hvel-toast-close">×</button>
    `;
    document.body.appendChild(toast);

    toast.querySelector('#hvel-toast-close').onclick = () => toast.remove();
    
    setTimeout(() => {
        if (toast.parentElement) {
            toast.style.animation = 'hvel-toast-fade 0.4s ease forwards';
            setTimeout(() => toast.remove(), 400);
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
    const messages = document.querySelectorAll('.adn, .ads, div[role="listitem"]');

    messages.forEach(async (msg) => {
        if (msg.hasAttribute('data-hvel-scanned')) return;
        msg.setAttribute('data-hvel-scanned', 'true');

        const badgeLink = msg.querySelector('a[href*="/v/"]');
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
            'vercel.com', 'google.com', 'microsoft.com', 'github.com',
            'aws.com', 'amazon.com', 'netflix.com'
        ];
        const senderDomain = senderEmail?.split('@')[1]?.toLowerCase();
        const isIgnoredDomain = IGNORED_DOMAINS.includes(senderDomain);

        if (senderEmail && senderEmail.toLowerCase() !== recipientEmail.toLowerCase() && !isIgnoredDomain) {
            if (badgeLink) {
                const url = badgeLink.href;
                const id = url.split('/v/').pop();

                chrome.runtime.sendMessage({
                    action: 'validateVerification',
                    id: id,
                    senderEmail: senderEmail,
                    recipientEmail: recipientEmail
                }, (response) => {
                    if (response && response.status === 'verified') {
                        showTrustStatus(msg, 'verified', `Verified Human (${senderEmail})`);
                    } else if (response && response.status === 'tampered') {
                        showTrustStatus(msg, 'tampered', response.message);
                        
                        const normSender = senderEmail.toLowerCase().trim();
                        const alertKey = `hvel_alerted_${normSender}`;
                        
                        chrome.storage.local.get([alertKey], (result) => {
                            const lastAlert = result[alertKey];
                            const now = Date.now();
                            const dayInMs = 24 * 60 * 60 * 1000;

                            if ((!lastAlert || (now - lastAlert > dayInMs)) && !pendingRequests.has(alertKey)) {
                                const dateSpan = msg.querySelector('span[title]');
                                const msgTime = dateSpan ? dateSpan.getAttribute('title') : new Date().toLocaleString();

                                pendingRequests.add(alertKey);
                                chrome.storage.local.set({ [alertKey]: now });

                                chrome.runtime.sendMessage({
                                    action: 'reportSecurityAlert',
                                    email: recipientEmail,
                                    attacker: normSender,
                                    reason: response.message,
                                    details: { timestamp: msgTime }
                                });
                            }
                        });
                    } else {
                        showTrustStatus(msg, 'invalid', 'Unverifiable Trust Stamp');
                    }
                });
            } else {
                chrome.runtime.sendMessage({ action: 'checkUserVerified', email: senderEmail }, (userStatus) => {
                    if (userStatus && userStatus.verified) {
                        showTrustStatus(msg, 'verified', `Sender is now Human Verified (Legacy Message)`);
                    } else {
                        showTrustStatus(msg, 'unverified', 'This sender is not yet HVEL Verified.');
                        
                        if (msg.offsetParent !== null) {
                            const normSender = senderEmail.toLowerCase().trim();
                            const nudgeKey = `hvel_nudged_${normSender}`;
                            
                            chrome.storage.local.get([nudgeKey], (result) => {
                                const lastNudge = result[nudgeKey];
                                const now = Date.now();
                                const dayInMs = 24 * 60 * 60 * 1000;

                                if ((!lastNudge || (now - lastNudge > dayInMs)) && !pendingRequests.has(nudgeKey)) {
                                    const dateSpan = msg.querySelector('span[title]');
                                    const msgTime = dateSpan ? dateSpan.getAttribute('title') : new Date().toLocaleString();

                                    pendingRequests.add(nudgeKey);
                                    chrome.storage.local.set({ [nudgeKey]: now });

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
        }
    });
}

function showTrustStatus(msgElement, status, text) {
    const existing = msgElement.querySelector('.hvel-trust-notice');
    if (existing) existing.remove();
    const existingStamp = msgElement.querySelector('.hvel-untrusted-stamp');
    if (existingStamp) existingStamp.remove();

    const notice = document.createElement('div');
    notice.className = 'hvel-trust-notice';

    if (status === 'verified') {
        const bg = '#f0fdf4'; const border = '#16a34a'; const color = '#166534'; const icon = '✅';
        notice.innerHTML = `
            <div style="display:flex;align-items:center;gap:10px;background:${bg};color:${color};
                border-left:4px solid ${border};padding:10px 16px;margin:8px 0;
                font-size:13px;font-weight:600;font-family:'Segoe UI',sans-serif;
                border-radius:6px;box-shadow:0 1px 4px rgba(0,0,0,0.08);">
                <span style="font-size:16px;">${icon}</span>
                <span>${text}</span>
            </div>`;
    } else {
        const bg = '#fef2f2'; const border = '#dc2626'; const color = '#991b1b'; const icon = '🚫';
        const title = (status === 'tampered' || status === 'invalid') ? 'CRITICAL SECURITY ALERT: ID MISMATCH' : 'SECURITY ALERT: UNTRUSTED SENDER';
        
        notice.innerHTML = `
            <div style="display:flex;align-items:center;gap:10px;background:${bg};color:${color};
                border-left:4px solid ${border};padding:10px 16px;margin:8px 0;
                font-size:13px;font-weight:800;font-family:'Segoe UI',sans-serif;
                border-radius:6px;box-shadow:0 4px 12px rgba(220, 38, 38, 0.15);
                border: 2px solid #dc2626; animation: hvel-pulse-red 2s infinite;">
                <span style="font-size:18px;">${icon}</span>
                <div style="display:flex; flex-direction:column;">
                    <span style="font-size:14px; text-transform:uppercase; letter-spacing:0.5px;">${title}</span>
                    <span style="font-size:11px; font-weight:500; opacity:0.9;">${text}</span>
                </div>
            </div>
            <style>
                @keyframes hvel-pulse-red {
                    0% { box-shadow: 0 0 0 0 rgba(220, 38, 38, 0.4); }
                    70% { box-shadow: 0 0 0 10px rgba(220, 38, 38, 0); }
                    100% { box-shadow: 0 0 0 0 rgba(220, 38, 38, 0); }
                }
            </style>`;

        const stamp = document.createElement('div');
        stamp.className = 'hvel-untrusted-stamp';
        stamp.style.cssText = `
            position: absolute; top: 60px; right: 50px; border: 5px solid #dc2626;
            color: #dc2626; padding: 10px 20px; font-size: 32px; font-weight: 900;
            text-transform: uppercase; transform: rotate(-20deg); opacity: 0.15;
            border-radius: 12px; z-index: 5; pointer-events: none;
            font-family: 'Impact', 'Arial Black', sans-serif; letter-spacing: 2px;
            user-select: none;
        `;
        stamp.innerText = (status === 'tampered' || status === 'invalid') ? 'TAMPERED' : 'UNTRUSTED';
        msgElement.style.position = 'relative';
        msgElement.style.backgroundColor = 'rgba(254, 242, 242, 0.5)';
        msgElement.appendChild(stamp);
    }

    const insertTarget = msgElement.querySelector('.a3s.aiL') || msgElement.querySelector('.a3s') || msgElement.querySelector('.ii.gt') || msgElement;
    insertTarget.prepend(notice);
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


// Interval loops to catch dynamically loaded view changes
function runHvelIntervals() {
    scanIncomingMessages();
}

setInterval(runHvelIntervals, 1500);

const observer = new MutationObserver(() => {
    runHvelIntervals();
});
observer.observe(document.body, { childList: true, subtree: true });

runHvelIntervals();
