console.log("HVEL Content Script loaded into Gmail.");

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

// Handle clicks outside dropdown to close it
document.addEventListener('click', (e) => {
    if (!e.target.closest('.hvel-dropdown-container')) {
        document.querySelectorAll('.hvel-dropdown-menu.show').forEach(menu => {
            menu.classList.remove('show');
        });
    }
});

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
    return getSenderEmail(); // In Gmail, your own email is the one you're logged into
}

function showOTPModal(sendBtn, onVerified) {
    const existing = document.querySelector('.hvel-otp-overlay');
    if (existing) return;

    const overlay = document.createElement('div');
    overlay.className = 'hvel-modal-overlay hvel-otp-overlay';

    const realEmail = getSenderEmail();

    overlay.innerHTML = `
        <div class="hvel-modal hvel-otp-modal" style="
            width: 370px; border-radius: 20px; background: #ffffff; color: #1f2937;
            text-align: center; box-shadow: 0 30px 70px -12px rgba(0,0,0,0.2);
            overflow: hidden; font-family: 'Inter', 'Segoe UI', sans-serif;
            animation: hvel-modal-pop 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
        ">
            <!-- Header -->
            <div style="background: linear-gradient(135deg, #6366f1, #3b82f6); padding: 18px 20px; position: relative;">
                <div style="display:flex; align-items:center; gap:12px; position:relative; z-index:1;">
                    <div style="width:40px; height:40px; border-radius:12px; background:rgba(255,255,255,0.15); display:flex; align-items:center; justify-content:center; backdrop-filter: blur(10px);">
                        <span style="font-size:20px;">🔐</span>
                    </div>
                    <div style="text-align:left;">
                        <div style="font-size:15px; font-weight:700; color:white; letter-spacing:-0.4px;">Gmail 2FA Verification</div>
                        <div style="background:rgba(255,255,255,0.2); display:inline-flex; align-items:center; gap:4px; padding:2px 8px; border-radius:20px; margin-top:3px;">
                            <div style="width:5px; height:5px; background:#10b981; border-radius:50%;"></div>
                            <span style="font-size:10px; color:white; font-weight:600;">${realEmail}</span>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Body -->
            <div style="padding: 20px;">
                
                <!-- Verification View -->
                <div id="hvel-view-step2">
                    
                    <!-- Tabs -->
                    <div style="display:flex; background:#f1f5f9; padding:3px; border-radius:10px; margin-bottom:15px;">
                        <button id="hvel-tab-scan" style="flex:1; padding:6px; border:none; border-radius:7px; background:white; color:#1e293b; font-size:12px; font-weight:700; box-shadow:0 1px 2px rgba(0,0,0,0.1); cursor:pointer; display:flex; align-items:center; justify-content:center; gap:5px;">
                            📷 Scan QR
                        </button>
                        <button id="hvel-tab-code" style="flex:1; padding:6px; border:none; border-radius:7px; background:transparent; color:#64748b; font-size:12px; font-weight:600; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:5px;">
                            ⌨️ Enter Code
                        </button>
                    </div>

                    <!-- Scan QR Section -->
                    <div id="hvel-sec-scan">
                        <div style="background:#f0f9ff; border:1px solid #bae6fd; border-radius:10px; padding:10px; margin-bottom:15px; display:flex; align-items:center; gap:8px; text-align:left;">
                            <span style="font-size:16px;">📱</span>
                            <span style="font-size:10px; color:#0369a1; line-height:1.3; font-weight:500;">
                                <strong>Authenticator</strong> → tap <strong>+</strong> → <strong>Scan QR code</strong>
                            </span>
                        </div>

                        <div style="background:white; border:1.5px solid #f1f5f9; border-radius:16px; padding:12px; display:inline-block; margin-bottom:12px;">
                            <img id="hvel-qr-img" style="width:150px; height:150px; display:block;">
                        </div>

                        <button id="hvel-scan-done-btn" style="
                            width:100%; background:#6366f1; color:white; border:none; padding:13px;
                            border-radius:12px; font-size:13px; font-weight:700; cursor:pointer;
                            transition:0.2s; box-shadow:0 4px 6px rgba(99,102,241,0.2);
                        ">✅ I've added it — Continue</button>
                    </div>

                    <!-- Enter Code Section -->
                    <div id="hvel-sec-code" style="display:none;">
                        <p style="font-size:12px; color:#64748b; margin-bottom:15px;">Enter the 6-digit code:</p>
                        
                        <div style="position:relative; margin-bottom:15px;">
                            <input type="text" id="hvel-otp-in" maxlength="6" placeholder="000 000" style="
                                width:100%; border:2px solid #e2e8f0; font-size:28px; text-align:center;
                                letter-spacing:6px; padding:12px; border-radius:14px; outline:none;
                                font-weight:700; box-sizing:border-box; color:#1e293b; transition:0.3s;
                            ">
                        </div>
                        
                        <div id="hvel-otp-err" style="color:#ef4444; font-size:10px; font-weight:600; margin-bottom:15px; display:none; background:#fef2f2; padding:8px; border-radius:8px; border:1px solid #fecaca;"></div>

                        <button id="hvel-otp-btn" style="
                            width:100%; background:linear-gradient(135deg,#10b981,#059669); color:white;
                            border:none; padding:13px; border-radius:12px; font-size:13px; font-weight:700;
                            cursor:pointer; box-shadow:0 8px 16px -4px rgba(16,185,129,0.3);
                        ">🔓 Complete Verification</button>
                    </div>
                </div>

            </div>
        </div>
    `;

    document.body.appendChild(overlay);

    const secScan = overlay.querySelector('#hvel-sec-scan');
    const secCode = overlay.querySelector('#hvel-sec-code');
    const tabScan = overlay.querySelector('#hvel-tab-scan');
    const tabCode = overlay.querySelector('#hvel-tab-code');
    const otpInput = overlay.querySelector('#hvel-otp-in');
    const otpError = overlay.querySelector('#hvel-otp-err');

    function switchToScan() {
        secScan.style.display = 'block';
        secCode.style.display = 'none';
        tabScan.style.background = 'white';
        tabScan.style.color = '#1e293b';
        tabScan.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
        tabCode.style.background = 'transparent';
        tabCode.style.color = '#64748b';
        tabCode.style.boxShadow = 'none';
    }

    function switchToCode() {
        secScan.style.display = 'none';
        secCode.style.display = 'block';
        tabCode.style.background = 'white';
        tabCode.style.color = '#1e293b';
        tabCode.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
        tabScan.style.background = 'transparent';
        tabScan.style.color = '#64748b';
        tabScan.style.boxShadow = 'none';
        otpInput.focus();
    }

    tabScan.onclick = switchToScan;
    tabCode.onclick = switchToCode;
    overlay.querySelector('#hvel-scan-done-btn').onclick = switchToCode;

    function loadTOTP(forceNew = false) {
        const qrImg = overlay.querySelector('#hvel-qr-img');
        if (!qrImg) return;

        qrImg.style.opacity = '0.3';

        chrome.runtime.sendMessage({
            action: 'setupTOTP',
            senderEmail: realEmail,
            force: forceNew
        }, (response) => {
            qrImg.style.opacity = '1';

            if (response && response.success) {
                console.log("[HVEL] TOTP loaded successfully");
                qrImg.src = response.qrcode;
                
                // if they already have it verified, default to code entry
                if (response.isVerified && !forceNew) {
                    switchToCode();
                } else {
                    switchToScan();
                }
            } else {
                console.error("[HVEL] Failed to load TOTP:", response ? response.error : 'No response');
                qrImg.src = ''; 
                qrImg.alt = 'Failed to load QR code';
            }
        });
    }
    loadTOTP();

    overlay.querySelector('#hvel-otp-btn').onclick = () => {
        const code = otpInput.value.trim();
        if (code.length !== 6) return;

        chrome.runtime.sendMessage({ action: 'verifyTOTP', senderEmail: realEmail, code: code }, (response) => {
            if (response && response.success) {
                markVerified(realEmail).then(() => {
                    overlay.remove();
                    if (onVerified) onVerified();
                });
            } else {
                otpError.innerText = response.error || 'Invalid code.';
                otpError.style.display = 'block';
                otpInput.style.borderColor = '#ef4444';
            }
        });
    };

    otpInput.oninput = (e) => {
        e.target.value = e.target.value.replace(/[^0-9]/g, '');
        if (e.target.value.length === 6) overlay.querySelector('#hvel-otp-btn').click();
    };
}


async function injectHvelUI() {
    // Look for the "Send" button.
    const sendButtons = Array.from(document.querySelectorAll('div[role="button"]')).filter(
        btn => btn.getAttribute('data-tooltip') && btn.getAttribute('data-tooltip').includes('Send')
    );

    const verified = await isSessionValid();

    sendButtons.forEach(sendBtn => {
        // Handle Blocking
        if (!verified) {
            if (!sendBtn.classList.contains('hvel-blocked')) {
                sendBtn.classList.add('hvel-blocked');
                sendBtn.style.opacity = '0.5';
                sendBtn.style.pointerEvents = 'none';
                sendBtn.style.filter = 'grayscale(1)';

                // Add a tooltip or message
                sendBtn.setAttribute('data-hvel-original-tooltip', sendBtn.getAttribute('data-tooltip'));
                sendBtn.setAttribute('data-tooltip', 'Verification Required to Send');

                // Show the modal when this compose window is detected/focused
                showOTPModal(sendBtn, () => {
                    // Unblock ALL send buttons when one is verified (session-wide)
                    document.querySelectorAll('.hvel-blocked').forEach(btn => {
                        btn.classList.remove('hvel-blocked');
                        btn.style.opacity = '1';
                        btn.style.pointerEvents = 'auto';
                        btn.style.filter = 'none';
                        btn.setAttribute('data-tooltip', btn.getAttribute('data-hvel-original-tooltip'));
                    });
                });
            }
        }

        const row = sendBtn.closest('tr');

        // If we found the row and haven't injected our button yet
        if (row && !row.querySelector('.hvel-verify-btn')) {

            const hvelContainer = document.createElement('td');
            hvelContainer.className = 'hvel-container';
            hvelContainer.style.verticalAlign = 'bottom';
            hvelContainer.style.paddingLeft = '10px';

            // Create a dropdown container
            hvelContainer.innerHTML = `
                <div class="hvel-dropdown-container">
                    <button class="hvel-verify-btn" type="button">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                            <polyline points="22 4 12 14.01 9 11.01"></polyline>
                        </svg>
                        <span>Verify</span>
                    </button>
                    <div class="hvel-dropdown-menu">
                        <div class="hvel-dropdown-item" data-type="human">
                            <span>🧑</span> Human Verified
                        </div>
                    </div>
                </div>
            `;

            const mainBtn = hvelContainer.querySelector('.hvel-verify-btn');
            const menu = hvelContainer.querySelector('.hvel-dropdown-menu');
            const items = hvelContainer.querySelectorAll('.hvel-dropdown-item');

            mainBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                // Toggle this menu, hide others
                document.querySelectorAll('.hvel-dropdown-menu.show').forEach(m => {
                    if (m !== menu) m.classList.remove('show');
                });
                menu.classList.toggle('show');
            });

            items.forEach(item => {
                item.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const type = item.getAttribute('data-type');
                    menu.classList.remove('show');

                    handleVerifyClick(sendBtn, mainBtn, type);
                });
            });

            // Insert our <td> right after the Send button's <td>
            const sendTd = sendBtn.closest('td');
            if (sendTd && sendTd.parentNode) {
                sendTd.parentNode.insertBefore(hvelContainer, sendTd.nextSibling);
            }
        }
    });
}

// NEW: Scanning Incoming Emails for Trust Signals
async function scanIncomingMessages() {
    // Broaden the search: scan any element that looks like a message container
    const messages = document.querySelectorAll('.adn, .ads, div[role="listitem"]');

    messages.forEach(async (msg) => {
        if (msg.hasAttribute('data-hvel-scanned')) return;
        msg.setAttribute('data-hvel-scanned', 'true');

        const badgeLink = msg.querySelector('a[href*="/v/"]');

        // Improved Sender Detection: Highly robust for Gmail
        let senderEmail = null;

        // 1. Look for .gD (the actual name/email element)
        const gD = msg.querySelector('.gD');
        if (gD) {
            senderEmail = gD.getAttribute('email') || gD.getAttribute('data-hovercard-id');
        }

        // 2. Look for any element with an 'email' attribute in the header
        if (!senderEmail || !senderEmail.includes('@')) {
            const emailSpan = msg.querySelector('span[email]');
            if (emailSpan) senderEmail = emailSpan.getAttribute('email');
        }

        // 3. Fallback: Parse from the header text/names
        if (!senderEmail || !senderEmail.includes('@')) {
            const headerText = msg.innerText.substring(0, 500); // Check first 500 chars
            const match = headerText.match(/[a-zA-Z0-9._%+-]+@gmail\.com/); // Gmail specific for now
            if (match) senderEmail = match[0];
        }

        const recipientEmail = getCurrentUserEmail();

        const IGNORED_DOMAINS = [
            'vercel.com', 'google.com', 'microsoft.com', 'github.com',
            'aws.com', 'amazon.com', 'netflix.com'
        ];
        const senderDomain = senderEmail?.split('@')[1]?.toLowerCase();
        const isIgnoredDomain = IGNORED_DOMAINS.includes(senderDomain);

        // Only proceed if we have a valid sender, they are NOT the current user, and NOT a whitelisted domain
        if (senderEmail && senderEmail.toLowerCase() !== recipientEmail.toLowerCase() && !isIgnoredDomain) {
            console.log(`[HVEL] Processing message from: ${senderEmail}`);

            if (badgeLink) {
                const url = badgeLink.href;
                const id = url.split('/v/').pop();

                // Validate the stamp
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
                        // Trigger security alert email to the recipient
                        chrome.runtime.sendMessage({
                            action: 'reportSecurityAlert',
                            email: recipientEmail,
                            attacker: senderEmail,
                            reason: response.message
                        });
                    } else {
                        showTrustStatus(msg, 'invalid', 'Unverifiable Trust Stamp');
                    }
                });
            } else {
                // No HVEL found on a reply - Trigger Mandatory Nudge
                const nudgeKey = `hvel_nudged_${senderEmail}`;
                if (!sessionStorage.getItem(nudgeKey)) {
                    console.log(`[HVEL] Mandatory nudge triggered for: ${senderEmail}`);
                    chrome.runtime.sendMessage({
                        action: 'reportUnverifiedReply',
                        hvelUserEmail: recipientEmail,
                        noExtensionEmail: senderEmail
                    }, (response) => {
                        if (response && response.success) {
                            sessionStorage.setItem(nudgeKey, 'true');
                        }
                    });
                }
                showTrustStatus(msg, 'unverified', 'This sender is not yet HVEL Verified.');
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

        // Add the dramatic Stamp Overlay
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
        msgElement.style.backgroundColor = 'rgba(254, 242, 242, 0.5)'; // Subtle red tint
        msgElement.appendChild(stamp);
    }

    const insertTarget = msgElement.querySelector('.a3s.aiL') || msgElement.querySelector('.a3s') || msgElement.querySelector('.ii.gt') || msgElement;
    insertTarget.prepend(notice);
}

// Compute SHA-256 hash of a string
async function computeHash(text) {
    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Extract the raw text from the compose body
function getEmailBody(sendBtn) {
    let composeBody = document.querySelector('div[aria-label="Message Body"]');
    const dialog = sendBtn.closest('div[role="dialog"]');
    if (dialog) {
        composeBody = dialog.querySelector('div[aria-label="Message Body"]');
    }
    return composeBody ? composeBody.innerText : "";
}

// Extract recipient emails from the "To" field
function getRecipientEmail(sendBtn) {
    const dialog = sendBtn.closest('div[role="dialog"]');
    if (!dialog) return null;

    // Look for elements that look like emails in the Recipient list
    const recipientChips = dialog.querySelectorAll('div[role="listitem"] span[email], .vT');
    if (recipientChips.length > 0) {
        // Just grab the first one for the invitation
        const email = recipientChips[0].getAttribute('email') || recipientChips[0].innerText.trim();
        return email.includes('@') ? email : null;
    }

    // Fallback: search for any email-like string in the Recipient area
    const recipientArea = dialog.querySelector('textarea[name="to"], input[name="to"]');
    if (recipientArea && recipientArea.value) {
        const match = recipientArea.value.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
        return match ? match[0] : null;
    }

    return null;
}

async function handleVerifyClick(sendBtn, btnElement, type) {
    const btnText = btnElement.querySelector('span');
    btnText.innerText = 'Verifying...';
    btnElement.disabled = true;

    // Get the real email of the user typing this message
    const realEmail = getSenderEmail();

    // Get email content and hash it for security
    const emailBody = getEmailBody(sendBtn);
    const contentHash = await computeHash(emailBody);

    // Get recipient email for the automated invitation
    const recipientEmail = getRecipientEmail(sendBtn);

    // Send message to background script to trigger real API call
    chrome.runtime.sendMessage({
        action: 'verifyEmail',
        type: type,
        senderEmail: realEmail,
        recipientEmail: recipientEmail,
        contentHash: contentHash
    }, (response) => {
        if (response && response.success) {

            // Set badge styling based on type
            let badgeTitle = 'Human Verified';
            let badgeIcon = '🧑';
            let badgeColor = '#10b981'; // green

            if (type === 'ai') {
                badgeTitle = 'AI Assisted';
                badgeIcon = '🤖';
                badgeColor = '#8b5cf6'; // purple
            } else if (type === 'automated') {
                badgeTitle = 'Automated';
                badgeIcon = '⚡';
                badgeColor = '#6b7280'; // gray
            }

            btnText.innerText = 'Verified';
            btnElement.classList.add('hvel-verified');
            btnElement.style.borderColor = badgeColor;
            btnElement.style.color = badgeColor;

            // Find the compose body related to this send button
            let composeBody = document.querySelector('div[aria-label="Message Body"]');
            const dialog = sendBtn.closest('div[role="dialog"]');
            if (dialog) {
                composeBody = dialog.querySelector('div[aria-label="Message Body"]');
            }

            if (composeBody) {
                const badgeHtml = `
                    <br/><br/>
                    <div class="hvel-badge-wrapper" style="font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; display: inline-block;" contenteditable="false">
                        <div style="display: flex; align-items: center; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 9999px; padding: 4px 12px; gap: 8px; box-shadow: 0 1px 2px rgba(0,0,0,0.05);">
                            <div style="display: flex; align-items: center; justify-content: center; background: #10b981; color: white; border-radius: 50%; width: 18px; height: 18px;">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                                    <polyline points="20 6 9 17 4 12"></polyline>
                                </svg>
                            </div>
                            <span style="color: #065f46; font-size: 13px; font-weight: 600; letter-spacing: -0.01em;">${badgeTitle}</span>
                            <div style="width: 1px; height: 12px; background: #d1fae5;"></div>
                            <a href="${response.url}" target="_blank" style="color: #059669; font-size: 11px; font-weight: 500; text-decoration: none; display: flex; align-items: center; gap: 3px;">
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
                            <a href="https://unmagnetized-unprudential-beth.ngrok-free.dev/verify.html" target="_blank" style="color: #6366f1; text-decoration: underline;">Verify on HVEL Portal</a>
                        </div>
                    </div>
                `;
                composeBody.innerHTML += badgeHtml;
            }
        } else {
            btnText.innerText = 'Error';
            btnElement.disabled = false;
        }
    });
}

// Fallback interval to ensure we catch dynamically rendered windows
function runHvelIntervals() {
    injectHvelUI();
    scanIncomingMessages();
}

setInterval(runHvelIntervals, 1500);

// Use observer for quick reaction
const observer = new MutationObserver((mutations) => {
    runHvelIntervals();
});

observer.observe(document.body, { childList: true, subtree: true });

runHvelIntervals();

