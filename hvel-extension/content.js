console.log("HVEL Content Script loaded into Gmail.");

// --- HEARTBEAT FOR DEBUGGING ---
function sendHeartbeat() {
    chrome.runtime.sendMessage({ action: 'heartbeat', url: window.location.href });
}
setInterval(sendHeartbeat, 10000); // Pulse every 10 seconds
sendHeartbeat(); // First pulse immediately
// -------------------------------

const SESSION_DURATION_MS = 2 * 60 * 1000; // 2 minutes (for testing)

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

// Extract actual user email from Gmail DOM — tries multiple selectors
function getSenderEmail() {
    // Attempt 1: Google Account button aria-label (most reliable)
    const accountBtn = document.querySelector('a[href*="accounts.google.com/SignOutOptions"]');
    if (accountBtn) {
        const label = accountBtn.getAttribute('aria-label') || '';
        const emailMatch = label.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
        if (emailMatch) return emailMatch[0].toLowerCase();
    }

    // Attempt 2: data-email attribute on account switcher
    const accountEl = document.querySelector('[data-email]');
    if (accountEl) {
        const e = accountEl.getAttribute('data-email');
        if (e && e.includes('@')) return e.toLowerCase();
    }

    // Attempt 3: Gmail header profile image alt text
    const profileImg = document.querySelector('img.gb_P[alt]');
    if (profileImg) {
        const alt = profileImg.getAttribute('alt') || '';
        const m = alt.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
        if (m) return m[0].toLowerCase();
    }

    // Attempt 4: Title bar (Gmail sets title to "Inbox (N) - email@domain - Gmail")
    const titleMatch = document.title.match(/[\w._%+-]+@[\w.-]+\.[a-zA-Z]{2,}/);
    if (titleMatch) return titleMatch[0].toLowerCase();

    // Could not detect — return null so callers can bail out safely
    return null;
}

// Function to find the recipient of an incoming message (the current user)
function getCurrentUserEmail() {
    return getSenderEmail();
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
                
                <!-- Step Indicator -->
                <div style="display:flex; justify-content:center; gap:8px; margin-bottom:15px;">
                    <div id="hvel-dot-1" style="width:30px; height:5px; border-radius:3px; background:#6366f1; transition:0.3s;"></div>
                    <div id="hvel-dot-2" style="width:30px; height:5px; border-radius:3px; background:#e2e8f0; transition:0.3s;"></div>
                </div>

                <!-- STEP 1 View: Biometrics -->
                <div id="hvel-view-bio">
                    <div id="hvel-step-txt" style="font-size:10px; font-weight:800; color:#6366f1; text-transform:uppercase; letter-spacing:1px; margin-bottom:12px;">
                        Step 1: Physical Identity Proof
                    </div>
                    <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:15px; padding:15px; margin-bottom:18px;">
                        <div style="font-size:36px; margin-bottom:8px;">👤</div>
                        <p style="font-size:13px; font-weight:700; color:#1e293b; margin:0 0 5px 0;">Verify your presence</p>
                        <p style="font-size:11px; color:#64748b; line-height:1.4; margin:0;">Confirm you are the authorized sender using your device biometrics.</p>
                    </div>

                    <button id="hvel-bio-btn" style="
                        width:100%; background:linear-gradient(135deg,#6366f1,#4f46e5); color:white;
                        border:none; padding:13px; border-radius:12px; font-size:13px; font-weight:700;
                        cursor:pointer; box-shadow:0 8px 16px -4px rgba(99,102,241,0.4); transition:0.2s;
                    " onmouseover="this.style.transform='translateY(-1px)'" onmouseout="this.style.transform=''">
                        🛡️ Start Biometric Check
                    </button>
                    <p id="hvel-no-passkey" style="font-size:11px; color:#6366f1; margin-top:12px; cursor:pointer; text-decoration:none; font-weight:600;">
                        No passkey? <span style="text-decoration:underline;">Setup now</span>
                    </p>
                </div>

                <!-- STEP 2 View: Combined Setup/Verify -->
                <div id="hvel-view-step2" style="display:none;">
                    
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
                                <strong>Google Authenticator</strong> → tap <strong>+</strong> → <strong>Scan QR code</strong>
                            </span>
                        </div>

                        <div style="background:white; border:1.5px solid #f1f5f9; border-radius:16px; padding:12px; display:inline-block; margin-bottom:12px;">
                            <img id="hvel-qr-img" style="width:150px; height:150px; display:block;">
                        </div>

                        <div id="hvel-manual-key-btn" style="font-size:10px; color:#6366f1; margin-bottom:15px; cursor:pointer; font-weight:600;">
                            🔑 Can't scan? Show manual key
                        </div>
                        
                        <div id="hvel-manual-key-area" style="display:none; background:#f8fafc; padding:8px; border-radius:8px; margin-bottom:15px; word-break:break-all; font-family:monospace; font-size:11px; border:1px dashed #cbd5e1;">
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

                    <!-- Actions -->
                    <div style="margin-top:15px; border-top:1px solid #f1f5f9; padding-top:12px;">
                        <button id="hvel-regenerate-btn" style="
                            background:transparent; border:1px solid #e2e8f0; color:#64748b;
                            padding:6px 12px; border-radius:8px; font-size:10px; font-weight:600;
                            cursor:pointer; transition:0.2s; display:flex; align-items:center; gap:5px; margin:0 auto;
                        " onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='transparent'">
                            🔄 Generate new secret
                        </button>
                    </div>
                </div>

            </div>
        </div>
    `;
    
    document.body.appendChild(overlay);

    const viewBio = overlay.querySelector('#hvel-view-bio');
    const viewStep2 = overlay.querySelector('#hvel-view-step2');
    const secScan = overlay.querySelector('#hvel-sec-scan');
    const secCode = overlay.querySelector('#hvel-sec-code');
    const tabScan = overlay.querySelector('#hvel-tab-scan');
    const tabCode = overlay.querySelector('#hvel-tab-code');
    
    const dot1    = overlay.querySelector('#hvel-dot-1');
    const dot2    = overlay.querySelector('#hvel-dot-2');
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

    function showStep2() {
        viewBio.style.display = 'none';
        viewStep2.style.display = 'block';
        dot1.style.background = '#10b981'; // Green for success
        dot2.style.background = '#6366f1'; // Active blue
    }

    overlay.querySelector('#hvel-bio-btn').onclick = () => {
        window.open(`https://hvel-backend.onrender.com/auth?action=verify&email=${encodeURIComponent(realEmail)}`, 'HVELAuth', 'width=450,height=610,left=500,top=100');
    };

    overlay.querySelector('#hvel-no-passkey').onclick = () => {
        window.open(`https://hvel-backend.onrender.com/auth?action=register&email=${encodeURIComponent(realEmail)}`, 'HVELAuth', 'width=450,height=610,left=500,top=100');
    };

    const handleMessage = (e) => {
        if (e.data.type === 'hvel_auth_success' && e.data.email === realEmail) {
            if (e.data.action === 'login' || e.data.action === 'register') {
                showStep2();
                // We keep the listener until OTP is done
            }
        }
    };
    window.addEventListener('message', handleMessage);

    function loadTOTP(forceNew = false) {
        const qrImg = overlay.querySelector('#hvel-qr-img');
        const manualKeyArea = overlay.querySelector('#hvel-manual-key-area');
        
        // Show loading state
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
                manualKeyArea.innerText = response.secret;
                
                // if they already have it verified, default to code entry
                if (response.isVerified && !forceNew) {
                    switchToCode();
                } else {
                    switchToScan();
                }
            } else {
                console.error("[HVEL] Failed to load TOTP:", response ? response.error : 'No response');
                qrImg.src = ''; // Clear image
                qrImg.alt = 'Failed to load QR code';
                
                const errDiv = document.createElement('div');
                errDiv.style.color = '#ef4444';
                errDiv.style.fontSize = '10px';
                errDiv.style.marginTop = '10px';
                errDiv.innerText = 'Failed to connect to security server. Please try again.';
                qrImg.parentNode.appendChild(errDiv);
            }
        });
    }
    loadTOTP();

    overlay.querySelector('#hvel-manual-key-btn').onclick = () => {
        const area = overlay.querySelector('#hvel-manual-key-area');
        area.style.display = area.style.display === 'none' ? 'block' : 'none';
    };

    overlay.querySelector('#hvel-regenerate-btn').onclick = () => {
        if(confirm('Are you sure? This will invalidate your old authenticator key.')) {
            loadTOTP(true);
            switchToScan();
        }
    };

    overlay.querySelector('#hvel-scan-done-btn').onclick = switchToCode;

    overlay.querySelector('#hvel-otp-btn').onclick = () => {
        const code = otpInput.value.trim();
        if (code.length !== 6) return;
        
        chrome.runtime.sendMessage({ action: 'verifyTOTP', senderEmail: realEmail, code: code }, (response) => {
            if (response && response.success) {
                markVerified(realEmail).then(() => {
                    overlay.remove();
                    window.removeEventListener('message', handleMessage);
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

// Scanning Incoming Emails for Trust Signals
// Logic: When viewing a thread, check if the backend has a verification record
// showing the logged-in user sent a verified email to someone in this thread.
// If yes, and that person replies without a badge → send nudge.
async function scanIncomingMessages() {
    // Skip sent/drafts/spam/trash folders
    const url = window.location.href;
    const skipFolders = ['#sent', '/sent', '#drafts', '/drafts', '#spam', '/spam', '#trash', '/trash', '#outbox'];
    if (skipFolders.some(f => url.includes(f))) return;

    const myEmail = getCurrentUserEmail();
    if (!myEmail) return;

    const allMessages = document.querySelectorAll('.adn, .ads');
    if (allMessages.length === 0) return;

    // ── PASS 1: collect all senders in this thread ────────────────────────────
    const msgData = [];
    allMessages.forEach((msg) => {
        let senderEmail = null;

        const gD = msg.querySelector('.gD');
        if (gD) senderEmail = gD.getAttribute('email') || gD.getAttribute('data-hovercard-id');
        if (!senderEmail || !senderEmail.includes('@')) {
            const emailEl = msg.querySelector('[email]');
            if (emailEl) senderEmail = emailEl.getAttribute('email');
        }
        if (!senderEmail || !senderEmail.includes('@')) {
            const hoverEl = msg.querySelector('[data-hovercard-id]');
            if (hoverEl) {
                const val = hoverEl.getAttribute('data-hovercard-id');
                if (val && val.includes('@')) senderEmail = val;
            }
        }

        // HVEL badge = link to hvel-backend.onrender.com/v/
        const badgeLink = msg.querySelector('a[href*="hvel-backend.onrender.com/v/"]');
        const isFromMe = senderEmail && senderEmail.toLowerCase() === myEmail.toLowerCase();

        msgData.push({ msg, senderEmail, badgeLink, isFromMe });
    });

    // Collect unique non-me senders in this thread
    const IGNORED_DOMAINS = [
        'vercel.com', 'google.com', 'microsoft.com', 'github.com', 'github.io',
        'aws.com', 'amazon.com', 'netflix.com', 'facebook.com', 'linkedin.com',
        'twitter.com', 'x.com', 'noreply.com', 'mailer.com', 'accounts.google.com'
    ];

    const otherSenders = [...new Set(
        msgData
            .filter(d => !d.isFromMe && d.senderEmail && d.senderEmail.includes('@'))
            .map(d => d.senderEmail.toLowerCase())
            .filter(e => !IGNORED_DOMAINS.includes(e.split('@')[1]))
    )];

    if (otherSenders.length === 0) return;

    console.log(`[HVEL] 🔍 Thread senders (not me): ${otherSenders.join(', ')} | My email: ${myEmail}`);

    // ── PASS 2: for each other sender, check backend if I sent them a verified email
    otherSenders.forEach(async (senderEmail) => {
        try {
            // Ask backend: did myEmail ever send a verified email to senderEmail?
            const resp = await fetch('https://hvel-backend.onrender.com/api/check-sent-verified', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ senderEmail: myEmail, recipientEmail: senderEmail })
            });
            const data = await resp.json();

            console.log(`[HVEL] 🔎 check-sent-verified (${myEmail} → ${senderEmail}): ${data.verified}`);

            if (!data.verified) return;

            // I DID send them a verified email — check if their reply has a badge
            const theirMessages = msgData.filter(d =>
                d.senderEmail && d.senderEmail.toLowerCase() === senderEmail && !d.isFromMe
            );

            if (theirMessages.length === 0) return;

            const theyRepliedWithoutBadge = theirMessages.some(d => !d.badgeLink);
            const theyRepliedWithBadge    = theirMessages.some(d => !!d.badgeLink);

            console.log(`[HVEL] 📨 ${senderEmail} — withoutBadge:${theyRepliedWithoutBadge} withBadge:${theyRepliedWithBadge}`);

            if (theyRepliedWithoutBadge) {
                // Find unscanned messages only — avoid re-nudging same message
                const unscanned = theirMessages.filter(d => !d.badgeLink && !d.msg.hasAttribute('data-hvel-nudged'));
                if (unscanned.length === 0) return; // all already nudged

                console.log(`[HVEL] 📤 Nudging ${senderEmail} for ${unscanned.length} unverified message(s)...`);

                chrome.runtime.sendMessage({
                    action: 'reportUnverifiedReply',
                    hvelUserEmail: myEmail,
                    noExtensionEmail: senderEmail
                }, (response) => {
                    console.log(`[HVEL] 📬 Nudge response for ${senderEmail}:`, JSON.stringify(response));
                    if (response && response.success) {
                        console.log(`[HVEL] ✅ Nudge email sent to ${senderEmail}`);
                        // Mark these messages so we don't nudge them again
                        unscanned.forEach(d => d.msg.setAttribute('data-hvel-nudged', 'true'));
                    } else {
                        console.warn(`[HVEL] ⚠️ Nudge not sent: ${response?.message || response?.error || 'no response'}`);
                    }
                });

                unscanned.forEach(d => {
                    d.msg.setAttribute('data-hvel-scanned', 'true');
                    showTrustStatus(d.msg, 'unverified', `⚠️ ${senderEmail} replied without HVEL verification`);
                });
            }

            if (theyRepliedWithBadge) {
                theirMessages.forEach(d => {
                    if (d.badgeLink && !d.msg.hasAttribute('data-hvel-scanned')) {
                        d.msg.setAttribute('data-hvel-scanned', 'true');
                        const id = d.badgeLink.href.split('/v/').pop();
                        chrome.runtime.sendMessage({
                            action: 'validateVerification',
                            id, senderEmail, recipientEmail: myEmail
                        }, (response) => {
                            if (response && response.status === 'verified') {
                                showTrustStatus(d.msg, 'verified', `✅ Human Verified — ${senderEmail}`);
                            } else {
                                showTrustStatus(d.msg, 'tampered', 'Trust stamp could not be verified');
                            }
                        });
                    }
                });
            }

        } catch (err) {
            console.error(`[HVEL] ❌ Error:`, err.message);
        }
    });
}

function showTrustStatus(msgElement, status, text) {
    const existing = msgElement.querySelector('.hvel-trust-notice');
    if (existing) existing.remove();

    const notice = document.createElement('div');
    notice.className = 'hvel-trust-notice';
    
    let bgColor = '#f8fafc';
    let textColor = '#64748b';
    let borderColor = '#e2e8f0';
    let icon = 'ℹ️';
    let extraHtml = '';

    if (status === 'verified') {
        bgColor = '#f0fdf4';
        textColor = '#166534';
        borderColor = '#bbf7d0';
        icon = '✅';
    } else if (status === 'tampered' || status === 'invalid') {
        bgColor = '#fef2f2';
        textColor = '#991b1b';
        borderColor = '#fecaca';
        icon = '⚠️';
    } else if (status === 'unverified') {
        extraHtml = `<a href="https://hvel.io/invite" target="_blank" style="margin-left:10px; color:#6366f1; text-decoration:underline;">Invite them to Verify</a>`;
    }

    notice.innerHTML = `
        <div style="
            display: flex; align-items: center; gap: 8px;
            background: ${bgColor}; color: ${textColor}; border: 1px solid ${borderColor};
            padding: 6px 15px; border-radius: 8px; margin-bottom: 10px;
            font-size: 11px; font-weight: 500; font-family: sans-serif;
        ">
            <span>${icon}</span>
            <span>${text}</span>
            ${extraHtml}
        </div>
    `;

    // Insert at the top of the message content
    const msgBody = msgElement.querySelector('.a3s.aiL') || msgElement;
    msgBody.prepend(notice);
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

// Extract recipient emails from the "To" field — returns ONLY valid email addresses
function getRecipientEmail(sendBtn) {
    const dialog = sendBtn.closest('div[role="dialog"]');
    if (!dialog) return null;

    // Method 1: chips with email attribute (most reliable)
    const chips = dialog.querySelectorAll('[email]');
    for (const chip of chips) {
        const email = chip.getAttribute('email');
        if (email && email.includes('@') && email.includes('.')) return email.toLowerCase();
    }

    // Method 2: data-hovercard-id on recipient spans
    const hoverCards = dialog.querySelectorAll('[data-hovercard-id]');
    for (const el of hoverCards) {
        const val = el.getAttribute('data-hovercard-id');
        if (val && val.includes('@')) return val.toLowerCase();
    }

    // Method 3: .vT elements (Gmail recipient chips)
    const vt = dialog.querySelectorAll('.vT');
    for (const el of vt) {
        const txt = el.innerText.trim();
        if (txt.includes('@') && txt.includes('.')) return txt.toLowerCase();
    }

    // Method 4: input/textarea with name="to" — parse email from value
    const toInput = dialog.querySelector('textarea[name="to"], input[name="to"], div[data-hovercard-id]');
    if (toInput) {
        const val = toInput.value || toInput.getAttribute('data-hovercard-id') || '';
        const match = val.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
        if (match) return match[0].toLowerCase();
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

