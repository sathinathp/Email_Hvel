console.log("HVEL Content Script loaded into Outlook.");

// Inject animations and styles for premium toasts and button effects
const style = document.createElement('style');
style.textContent = `
    @keyframes hvel-spin {
        to { transform: rotate(360deg); }
    }
    @keyframes hvel-shake {
        0%, 100% { transform: translateX(0); }
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
    @keyframes hvel-compose-in {
        from { opacity: 0; transform: translateX(-8px); }
        to { opacity: 1; transform: translateX(0); }
    }
    @keyframes hvel-dot-green-pulse {
        0%   { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.55); }
        70%  { box-shadow: 0 0 0 5px rgba(16, 185, 129, 0); }
        100% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
    }
    @keyframes hvel-dot-red-pulse {
        0%   { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.45); }
        70%  { box-shadow: 0 0 0 5px rgba(239, 68, 68, 0); }
        100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
    }
    .hvel-dot-green {
        animation: hvel-dot-green-pulse 2s ease infinite;
    }
    .hvel-dot-red {
        animation: hvel-dot-red-pulse 2.5s ease infinite;
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
let cachedUserEmail = 'unknown-outlook-sender@outlook.com';

function updateCachedUserEmail() {
    chrome.storage.local.get(['hvel_auth_email', 'hvel_linked_aliases'], (res) => {
        const primary = res.hvel_auth_email ? res.hvel_auth_email.toLowerCase().trim() : null;
        const aliases = res.hvel_linked_aliases || [];

        if (primary) {
            cachedUserEmail = primary;
            // If primary is Gmail, prefer any linked non-Gmail alias for Outlook operations
            if (primary.endsWith('@gmail.com') || primary.endsWith('@googlemail.com')) {
                const outlookAlias = aliases.find(a => a && !a.endsWith('@gmail.com') && !a.endsWith('@googlemail.com'));
                if (outlookAlias) {
                    cachedUserEmail = outlookAlias.toLowerCase().trim();
                    console.log(`[HVEL OWA] 🎯 Using linked Outlook alias as active identity: ${cachedUserEmail}`);
                }
            }
        }
    });
}

updateCachedUserEmail();

chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local' && (changes.hvel_auth_email || changes.hvel_linked_aliases)) {
        updateCachedUserEmail();
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

// Extract actual user email and name from Outlook DOM
function getSenderProfile() {
    // Try all known selectors for the account manager / profile button in old & new OWA
    const selectors = [
        '#O365_MainLink_Me',
        'button[aria-label*="Account manager"]',
        'button[title*="Account manager"]',
        '[data-automationid="meControl"]',
        '[aria-label*="My account"]',
        '[aria-label*="your account"]',
        'button[class*="meControl"]',
        'button[class*="MeControl"]',
        // New Outlook on cloud.microsoft uses a different button
        'button[aria-label*="profile"]',
        'button[aria-label*="Profile"]',
        '[data-testid="meControl"]',
    ];

    for (const sel of selectors) {
        const el = document.querySelector(sel);
        if (!el) continue;
        const label = el.getAttribute('aria-label') || el.getAttribute('title') || el.textContent || '';
        const emailMatch = label.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
        if (emailMatch) {
            return { email: emailMatch[0].toLowerCase(), name: null };
        }
    }
    return { email: null, name: null };
}

function getComposeFromEmail(container) {
    if (!container) return null;
    // Look for a From dropdown or text
    const fromButton = container.querySelector('button[aria-label*="From"], [role="combobox"][aria-label*="From"]');
    if (fromButton) {
        const text = fromButton.innerText || '';
        const match = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
        if (match) return match[0].toLowerCase().trim();
    }
    // Check all buttons or dropdowns inside compose header that might display the sender email
    const elements = container.querySelectorAll('.ms-ComposeHeader, [class*="composeHeader"], [class*="From"]');
    for (let el of elements) {
        const text = el.innerText || '';
        const match = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
        if (match) return match[0].toLowerCase().trim();
    }
    return null;
}

function getSenderEmail() {
    // 1. Profile button (account manager)
    const profile = getSenderProfile();
    if (profile.email) return profile.email;

    // 2. Scan the full O365 header / nav bar area for any email
    const headerSelectors = [
        '#o365header', '#O365_HeaderLeftRegion', 'header',
        '[role="banner"]', '[data-automationid="AppHeader"]',
        'div[class*="header"]', 'nav[class*="nav"]'
    ];
    for (const sel of headerSelectors) {
        const hdr = document.querySelector(sel);
        if (!hdr) continue;
        const match = hdr.innerHTML.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
        if (match) return match[0].toLowerCase().trim();
    }

    // 3. Meta tags (some OWA versions embed user email here)
    const metas = document.querySelectorAll('meta[name], meta[property]');
    for (const meta of metas) {
        const content = meta.getAttribute('content') || '';
        const match = content.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
        if (match) return match[0].toLowerCase().trim();
    }

    // 4. Compose From field
    if (activeComposeDialog) {
        const composeFrom = getComposeFromEmail(activeComposeDialog);
        if (composeFrom) return composeFrom;
    }

    // 5. Document title
    const titleMatch = document.title.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
    if (titleMatch) return titleMatch[0].toLowerCase();

    // 6. URL-embedded user hint (some OWA URLs contain the UPN or tenant hints)
    const urlMatch = window.location.href.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
    if (urlMatch) return urlMatch[0].toLowerCase();

    // 7. cachedUserEmail if it's a real email (not placeholder or gmail)
    if (cachedUserEmail &&
        !cachedUserEmail.endsWith('@gmail.com') &&
        !cachedUserEmail.endsWith('@googlemail.com') &&
        cachedUserEmail !== 'unknown-outlook-sender@outlook.com') {
        return cachedUserEmail;
    }

    return 'unknown-outlook-sender@outlook.com';
}

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

function isEmailBodyEditor(editor) {
    if (!editor) return false;
    const label = (editor.getAttribute('aria-label') || '').toLowerCase();
    const placeholder = (editor.getAttribute('placeholder') || '').toLowerCase();
    const role = (editor.getAttribute('role') || '').toLowerCase();

    if (label.includes('search') || placeholder.includes('search')) return false;
    if (label.includes('subject') || placeholder.includes('subject') || label === 'to' || label === 'cc' || label === 'bcc' || label.includes('recipient')) return false;
    if (role === 'combobox') return false;

    // If inside a recipient line or header row, reject unless it's explicitly "message body"
    const recipientContainer = editor.closest('[aria-label*="To"], [aria-label*="Cc"], [aria-label*="Bcc"], [aria-label*="Subject"], [class*="recipient"], [class*="ToLine"], [class*="CcLine"], [class*="BccLine"], [class*="Subject"]');
    if (recipientContainer && !label.includes('message body') && !label.includes('email body')) {
        return false;
    }

    return true;
}

function injectComposeIndicator(container) {
    // Remove accidental indicators from recipient fields (To, Cc, Bcc)
    document.querySelectorAll('[aria-label*="To"] #hvel-compose-indicator, [aria-label*="Cc"] #hvel-compose-indicator, [aria-label*="Bcc"] #hvel-compose-indicator, [class*="ToLine"] #hvel-compose-indicator, [class*="CcLine"] #hvel-compose-indicator').forEach(el => el.remove());

    // Look for Outlook compose toolbar next to the main commands or Send button (bottom bar)
    const composeWindow = container.closest('div[role="region"]') || container.closest('div[role="dialog"]') || container;
    const toolbar = composeWindow.querySelector('.ms-CommandBar, div[role="toolbar"], div[class*="footer"], div[class*="Footer"]') || composeWindow.querySelector('#hvel-tracking-footer') || composeWindow;
    
    if (!toolbar || toolbar.querySelector('#hvel-compose-indicator')) return;
    
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

function flashComposeVerified(container) {
    const indicator = container?.querySelector('#hvel-compose-indicator');
    if (!indicator) return;
    indicator.innerHTML = `<span style="font-size:12px;">✅</span> <span>HVEL Verified</span>`;
    indicator.style.background = 'rgba(16,185,129,0.15)';
    indicator.style.borderColor = 'rgba(16,185,129,0.5)';
    setTimeout(() => indicator.remove(), 2000);
}

function updateOrAppendStamp(composeBody, badgeInnerHtml) {
    if (!composeBody || !isEmailBodyEditor(composeBody)) return;

    // Clean up any accidentally placed stamps in To / Cc / Bcc fields
    document.querySelectorAll('[aria-label*="To"] .hvel-badge-wrapper, [aria-label*="Cc"] .hvel-badge-wrapper, [aria-label*="Bcc"] .hvel-badge-wrapper, [class*="ToLine"] .hvel-badge-wrapper, [class*="CcLine"] .hvel-badge-wrapper').forEach(el => el.remove());

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
        if (!composeBody || !document.body.contains(composeBody) || !isEmailBodyEditor(composeBody)) return;
        
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
                        <img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAGF0lEQVR4AaRWCVSNaRh+7p0WGbJMKCq3VKIiZCsSbcMhdEVajBFHzAzOnIMsd44GmWTPjOFkO84c24xCtBhnCMMYRxFKSLpCyhRqhim3eb9/mft3lxb+c/9veb93eb53+69co9E0aDQf8L4TZMW5lbrk+NBHRgoaGgA2Q3jYXljqTTpn7wdARwlkgnWRLu71rBOBnYl8tH0/AEwJCev9jNF1GSV8TQMgzzaSlSBvRP+AjXEAzDjzrNQoIS99UYFNGccQ+X0ipm//DuHb12FqcgKWHd6La8VF+lCk8vqnaAxAysyMMwEyyqbK1y8RuycZCccPwcNWgc9HBSHIYyAC3Dwxi9aTvbxx/PoVTNm6BkXPypgI/wrykOrmT7ixMQCRmTvSDrkl9xGzazMivf3Q1swcKeeyUFBWCpuOnaGwsoa6sgKbM1PxsrYGq0KjyBt7kHXzGq9Aali65k/JA8zVwoabdJgePn+GxPSjmB84ARtOH4NyiA+8HJ1xvjAf+y/8SmAykEnGfHu7I3pEABYfTIFqUgR3dvXBXfxfIexy7EXjRw5ZYwJ0mKzplnPHjMOBS2exICgEiSePor+9I7k9GB52CgxydMGS8WH4pL0lVqf9hK3RsVhO+bAmbCa2Z5/glN94VMzNhgY5R9T1Akfkh7p39diSmYZZvkHYRzdeSsaSSxFZX5UIdB+IkS5uSM+7iowbf2ItGV18cDcSw2Ow82w6ds/5GmvSDsKybVtemYGRB6DrBQnjxtO/YGHwRGzOSMVXgSFIzjoO1cRwnLmdi23ZaUg69TM+kssR5e2PHWdPYcqQEbipfoi4CeEI27YW/m794dDFGjBySR6AxKB0qaF8uEPJlq8uwfyA8Ug4eRiq0AisO3kEKwiEU7fuCBvqyxnIe/QAcgrfMCdXDO3liuCklVAO9ka3Dp14lUYu2SSAasrqUCqvHEq4Hp2t0LeHHfaez8Y3kyMQsjEe35J7I3espwrT4GLRbSwLmcbdNHTrangTkAifMVh5ZD8PwMhoGADdnPFX/10L1+72ZKABd8oewbNnLxQ8UcPc1BSPqyoYC2fw4t3b8HHw8APGm4kwH3E/ILW79nkNzYv8BAAD//5GoiggAAAAGSURBVAMAMV6HfcKh9B0AAAAASUVORK5CYII=" style="width: 18px; height: 18px; border-radius: 50%; object-fit: contain; vertical-align: middle; flex-shrink: 0;" />
                        <span style="color: #065f46; font-size: 13px; font-weight: 600; letter-spacing: -0.01em;">Attest</span>
                    </div>
                    <div style="margin-top: 5px; font-size: 9px; color: #94a3b8;" class="hvel-stamp-hash-container">
                        <span class="hvel-stamp-hash">Hash: ${contentHash}</span>
                    </div>
                `;
            } else {
                badgeInnerHtml = `
                    <a href="#" onclick="return false;" style="display: inline-flex; align-items: center; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 9999px; padding: 4px 12px; gap: 6px; box-shadow: 0 1px 2px rgba(0,0,0,0.05); text-decoration: none; cursor: default;" title="Attest Trust Record">
                        <img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAGF0lEQVR4AaRWCVSNaRh+7p0WGbJMKCq3VKIiZCsSbcMhdEVajBFHzAzOnIMsd44GmWTPjOFkO84c24xCtBhnCMMYRxFKSLpCyhRqhim3eb9/mft3lxb+c/9veb93eb53+69co9E0aDQf8L4TZMW5lbrk+NBHRgoaGgA2Q3jYXljqTTpn7wdARwlkgnWRLu71rBOBnYl8tH0/AEwJCev9jNF1GSV8TQMgzzaSlSBvRP+AjXEAzDjzrNQoIS99UYFNGccQ+X0ipm//DuHb12FqcgKWHd6La8VF+lCk8vqnaAxAysyMMwEyyqbK1y8RuycZCccPwcNWgc9HBSHIYyAC3Dwxi9aTvbxx/PoVTNm6BkXPypgI/wrykOrmT7ixMQCRmTvSDrkl9xGzazMivf3Q1swcKeeyUFBWCpuOnaGwsoa6sgKbM1PxsrYGq0KjyBt7kHXzGq9Aali65k/JA8zVwoabdJgePn+GxPSjmB84ARtOH4NyiA+8HJ1xvjAf+y/8SmAykEnGfHu7I3pEABYfTIFqUgR3dvXBXfxfIexy7EXjRw5ZYwJ0mKzplnPHjMOBS2exICgEiSePor+9I7k9GB52CgxydMGS8WH4pL0lVqf9hK3RsVhO+bAmbCa2Z5/glN94VMzNhgY5R9T1Akfkh7p39diSmYZZvkHYRzdeSsaSSxFZX5UIdB+IkS5uSM+7iowbf2ItGV18cDcSw2Ow82w6ds/5GmvSDsKybVtemYGRB6DrBQnjxtO/YGHwRGzOSMVXgSFIzjoO1cRwnLmdi23ZaUg69TM+kssR5e2PHWdPYcqQEbipfoi4CeEI27YW/m794dDFGjBySR6AxKB0qaF8uEPJlq8uwfyA8Ug4eRiq0AisO3kEKwiEU7fuCBvqyxnIe/QAcgrfMCdXDO3liuCklVAO9ka3Dp14lUYu2SSAasrqUCqvHEq4Hp2t0LeHHfaez8Y3kyMQsjEe35J7I3espwrT4GLRbSwLmcbdNHTrangTkAifMVh5ZD8PwMhoGADdnPFX/10L1+72ZKABd8oewbNnLxQ8UcPc1BSPqyoYC2fw4t3b8HHw8APGm4kwH3E/ILW79nkNzYv8BAAD//5GoiggAAAAGSURBVAMAMV6HfcKh9B0AAAAASUVORK5CYII=" style="width: 18px; height: 18px; border-radius: 50%; object-fit: contain; vertical-align: middle; flex-shrink: 0;" />
                        <span style="color: #065f46; font-size: 13px; font-weight: 600; letter-spacing: -0.01em;">Attest</span>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#059669" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-left: 1px;"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
                    </a>
                `;
            }
            updateOrAppendStamp(composeBody, badgeInnerHtml);
        });
    }, 300);
}

async function injectComposeStamp(container) {
    // Locate ONLY the main message body editor inside container
    const allEditors = container.querySelectorAll ? container.querySelectorAll('div[role="textbox"], div[contenteditable="true"]') : [];
    let composeBody = null;
    for (let ed of allEditors) {
        if (isEmailBodyEditor(ed)) {
            composeBody = ed;
            break;
        }
    }
    if (!composeBody && isEmailBodyEditor(container)) {
        composeBody = container;
    }
    if (!composeBody) return;

    const senderEmail = getSenderEmail();

    // Check if sender is authorized for current session (primary or linked alias)
    chrome.runtime.sendMessage({
        action: 'checkPlanQuota',
        email: senderEmail,
        feature: 'totp_verify'
    }, async (res) => {
        if (res && (res.error === 'IDENTITY_MISMATCH' || res.error === 'AUTHENTICATION_REQUIRED' || res.error === 'INVALID_SESSION')) {
            composeBody.querySelectorAll('.hvel-badge-wrapper').forEach(el => el.remove());
            
            const indicator = container.querySelector('#hvel-compose-indicator');
            if (indicator) {
                indicator.style.background = 'rgba(239, 68, 68, 0.1)';
                indicator.style.borderColor = 'rgba(239, 68, 68, 0.3)';
                indicator.style.color = '#dc2626';
                indicator.innerHTML = `<span style="font-size:11px;">⚠️</span> <span>Unlinked Account (${senderEmail})</span>`;
            }
            return;
        }

        // Prevent duplicate signature
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
                        <img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAGF0lEQVR4AaRWCVSNaRh+7p0WGbJMKCq3VKIiZCsSbcMhdEVajBFHzAzOnIMsd44GmWTPjOFkO84c24xCtBhnCMMYRxFKSLpCyhRqhim3eb9/mft3lxb+c/9veb93eb53+69co9E0aDQf8L4TZMW5lbrk+NBHRgoaGgA2Q3jYXljqTTpn7wdARwlkgnWRLu71rBOBnYl8tH0/AEwJCev9jNF1GSV8TQMgzzaSlSBvRP+AjXEAzDjzrNQoIS99UYFNGccQ+X0ipm//DuHb12FqcgKWHd6La8VF+lCk8vqnaAxAysyMMwEyyqbK1y8RuycZCccPwcNWgc9HBSHIYyAC3Dwxi9aTvbxx/PoVTNm6BkXPypgI/wrykOrmT7ixMQCRmTvSDrkl9xGzazMivf3Q1swcKeeyUFBWCpuOnaGwsoa6sgKbM1PxsrYGq0KjyBt7kHXzGq9Aali65k/JA8zVwoabdJgePn+GxPSjmB84ARtOH4NyiA+8HJ1xvjAf+y/8SmAykEnGfHu7I3pEABYfTIFqUgR3dvXBXfxfIexy7EXjRw5ZYwJ0mKzplnPHjMOBS2exICgEiSePor+9I7k9GB52CgxydMGS8WH4pL0lVqf9hK3RsVhO+bAmbCa2Z5/glN94VMzNhgY5R9T1Akfkh7p39diSmYZZvkHYRzdeSsaSSxFZX5UIdB+IkS5uSM+7iowbf2ItGV18cDcSw2Ow82w6ds/5GmvSDsKybVtemYGRB6DrBQnjxtO/YGHwRGzOSMVXgSFIzjoO1cRwnLmdi23ZaUg69TM+kssR5e2PHWdPYcqQEbipfoi4CeEI27YW/m794dDFGjBySR6AxKB0qaF8uEPJlq8uwfyA8Ug4eRiq0AisO3kEKwiEU7fuCBvqyxnIe/QAcgrfMCdXDO3liuCklVAO9ka3Dp14lUYu2SSAasrqUCqvHEq4Hp2t0LeHHfaez8Y3kyMQsjEe35J7I3espwrT4GLRbSwLmcbdNHTrangTkAifMVh5ZD8PwMhoGADdnPFX/10L1+72ZKABd8oewbNnLxQ8UcPc1BSPqyoYC2fw4t3b8HHw8APGm4kwH3E/ILW79nkNzYv8BAAD//5GoiggAAAAGSURBVAMAMV6HfcKh9B0AAAAASUVORK5CYII=" style="width: 18px; height: 18px; border-radius: 50%; object-fit: contain; vertical-align: middle; flex-shrink: 0;" />
                        <span style="color: #065f46; font-size: 13px; font-weight: 600; letter-spacing: -0.01em;">Attest</span>
                    </div>
                    <div style="margin-top: 5px; font-size: 9px; color: #94a3b8;" class="hvel-stamp-hash-container">
                        <span class="hvel-stamp-hash">Hash: ${contentHash}</span>
                    </div>
                `;
            } else {
                badgeInnerHtml = `
                    <a href="#" onclick="return false;" style="display: inline-flex; align-items: center; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 9999px; padding: 4px 12px; gap: 6px; box-shadow: 0 1px 2px rgba(0,0,0,0.05); text-decoration: none; cursor: default;" title="Attest Trust Record">
                        <img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAGF0lEQVR4AaRWCVSNaRh+7p0WGbJMKCq3VKIiZCsSbcMhdEVajBFHzAzOnIMsd44GmWTPjOFkO84c24xCtBhnCMMYRxFKSLpCyhRqhim3eb9/mft3lxb+c/9veb93eb53+69co9E0aDQf8L4TZMW5lbrk+NBHRgoaGgA2Q3jYXljqTTpn7wdARwlkgnWRLu71rBOBnYl8tH0/AEwJCev9jNF1GSV8TQMgzzaSlSBvRP+AjXEAzDjzrNQoIS99UYFNGccQ+X0ipm//DuHb12FqcgKWHd6La8VF+lCk8vqnaAxAysyMMwEyyqbK1y8RuycZCccPwcNWgc9HBSHIYyAC3Dwxi9aTvbxx/PoVTNm6BkXPypgI/wrykOrmT7ixMQCRmTvSDrkl9xGzazMivf3Q1swcKeeyUFBWCpuOnaGwsoa6sgKbM1PxsrYGq0KjyBt7kHXzGq9Aali65k/JA8zVwoabdJgePn+GxPSjmB84ARtOH4NyiA+8HJ1xvjAf+y/8SmAykEnGfHu7I3pEABYfTIFqUgR3dvXBXfxfIexy7EXjRw5ZYwJ0mKzplnPHjMOBS2exICgEiSePor+9I7k9GB52CgxydMGS8WH4pL0lVqf9hK3RsVhO+bAmbCa2Z5/glN94VMzNhgY5R9T1Akfkh7p39diSmYZZvkHYRzdeSsaSSxFZX5UIdB+IkS5uSM+7iowbf2ItGV18cDcSw2Ow82w6ds/5GmvSDsKybVtemYGRB6DrBQnjxtO/YGHwRGzOSMVXgSFIzjoO1cRwnLmdi23ZaUg69TM+kssR5e2PHWdPYcqQEbipfoi4CeEI27YW/m794dDFGjBySR6AxKB0qaF8uEPJlq8uwfyA8Ug4eRiq0AisO3kEKwiEU7fuCBvqyxnIe/QAcgrfMCdXDO3liuCklVAO9ka3Dp14lUYu2SSAasrqUCqvHEq4Hp2t0LeHHfaez8Y3kyMQsjEe35J7I3espwrT4GLRbSwLmcbdNHTrangTkAifMVh5ZD8PwMhoGADdnPFX/10L1+72ZKABd8oewbNnLxQ8UcPc1BSPqyoYC2fw4t3b8HHw8APGm4kwH3E/ILW79nkNzYv8BAAD//5GoiggAAAAGSURBVAMAMV6HfcKh9B0AAAAASUVORK5CYII=" style="width: 18px; height: 18px; border-radius: 50%; object-fit: contain; vertical-align: middle; flex-shrink: 0;" />
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
    const editors = document.querySelectorAll('div[role="textbox"], div[contenteditable="true"]');
    editors.forEach(editor => {
        if (!isEmailBodyEditor(editor)) return;

        const container = editor.closest('div[role="region"]') || editor.closest('div[role="dialog"]') || editor.parentElement;
        if (container) {
            activeComposeDialog = container;
            composeMousePoints = []; // Fresh buffer per compose session
            injectComposeIndicator(container);
            injectComposeStamp(container);
        }
    });
});
composeSessionObserver.observe(document.body, { childList: true, subtree: true });

// Periodic safety scanner for open compose windows
setInterval(() => {
    const editors = document.querySelectorAll('div[role="textbox"], div[contenteditable="true"]');
    editors.forEach(editor => {
        if (!isEmailBodyEditor(editor)) return;

        const container = editor.closest('div[role="region"]') || editor.closest('div[role="dialog"]') || editor.parentElement;
        if (container) {
            injectComposeIndicator(container);
            injectComposeStamp(container);
        }
    });
}, 2000);

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
    const sendBtn = e.target.closest('button[title^="Send"], button[aria-label^="Send"], button.splitButton-send, button[data-unique-id*="Send"], [role="button"][aria-label^="Send"]');
    if (!sendBtn) return;

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

                // ─── PLAN QUOTA & IDENTITY PRE-CHECK ───
                chrome.runtime.sendMessage({
                    action: 'checkPlanQuota',
                    email: realEmailForCheck,
                    feature: 'totp_verify'
                }, (quotaRes) => {
                    const isAuthError = quotaRes && (quotaRes.error === 'AUTHENTICATION_REQUIRED' || quotaRes.error === 'INVALID_SESSION');
                    if (isAuthError) {
                        isVerifying = false;
                        restoreSendButton(sendBtn);
                        let composeBody = document.querySelector('div[role="textbox"][aria-label="Message body"], div[contenteditable="true"][aria-label="Message body"]');
                        if (composeBody) composeBody.querySelectorAll('.hvel-badge-wrapper').forEach(el => el.remove());
                        showVerificationWarningToast("Authentication Required", "Please log in to HVEL via the extension popup.");
                        return; // Stop — do NOT send the email
                    }

                    const isIdentityMismatch = quotaRes && quotaRes.error === 'IDENTITY_MISMATCH';
                    if (isIdentityMismatch) {
                        isVerifying = false;
                        restoreSendButton(sendBtn);
                        let composeBody = document.querySelector('div[role="textbox"][aria-label="Message body"], div[contenteditable="true"][aria-label="Message body"]');
                        if (composeBody) composeBody.querySelectorAll('.hvel-badge-wrapper').forEach(el => el.remove());
                        showVerificationWarningToast("Unlinked Sender Account", quotaRes.message || "Active Attest login does not match this sender email.");
                        return; // Stop — do NOT send the unlinked email with stamp!
                    }

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

                    // Quota OK — proceed with mouse tracking
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
                        let composeBody = document.querySelector('div[role="textbox"][aria-label="Message body"], div[contenteditable="true"][aria-label="Message body"]');
                        const container = sendBtn.closest('div[role="region"]') || sendBtn.closest('.Ms-BasePicker') || document;
                        if (container) {
                            composeBody = container.querySelector('div[role="textbox"][aria-label="Message body"], div[contenteditable="true"][aria-label="Message body"]');
                        }
                        
                        let emailBodyText = "";
                        if (composeBody) {
                            const clone = composeBody.cloneNode(true);
                            clone.querySelectorAll('.hvel-badge-wrapper').forEach(el => el.remove());
                            emailBodyText = clone.innerText;
                        }
                        const contentHash = await computeHash(emailBodyText);

                        if (isNetworkError) {
                            isVerifying = false;
                            restoreSendButton(sendBtn);

                            if (composeBody) {
                                chrome.storage.local.get(['hvel_stamp_mode'], (prefs) => {
                                    const stampMode = prefs.hvel_stamp_mode || 'with_link';
                                    let badgeInnerHtml = '';
                                    if (stampMode === 'hash_only') {
                                        badgeInnerHtml = `
                                            <div style="display: inline-flex; align-items: center; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 9999px; padding: 4px 12px; gap: 8px; box-shadow: 0 1px 2px rgba(0,0,0,0.05);">
                                                <img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAGF0lEQVR4AaRWCVSNaRh+7p0WGbJMKCq3VKIiZCsSbcMhdEVajBFHzAzOnIMsd44GmWTPjOFkO84c24xCtBhnCMMYRxFKSLpCyhRqhim3eb9/mft3lxb+c/9veb93eb53+69co9E0aDQf8L4TZMW5lbrk+NBHRgoaGgA2Q3jYXljqTTpn7wdARwlkgnWRLu71rBOBnYl8tH0/AEwJCev9jNF1GSV8TQMgzzaSlSBvRP+AjXEAzDjzrNQoIS99UYFNGccQ+X0ipm//DuHb12FqcgKWHd6La8VF+lCk8vqnaAxAysyMMwEyyqbK1y8RuycZCccPwcNWgc9HBSHIYyAC3Dwxi9aTvbxx/PoVTNm6BkXPypgI/wrykOrmT7ixMQCRmTvSDrkl9xGzazMivf3Q1swcKeeyUFBWCpuOnaGwsoa6sgKbM1PxsrYGq0KjyBt7kHXzGq9Aali65k/JA8zVwoabdJgePn+GxPSjmB84ARtOH4NyiA+8HJ1xvjAf+y/8SmAykEnGfHu7I3pEABYfTIFqUgR3dvXBXfxfIexy7EXjRw5ZYwJ0mKzplnPHjMOBS2exICgEiSePor+9I7k9GB52CgxydMGS8WH4pL0lVqf9hK3RsVhO+bAmbCa2Z5/glN94VMzNhgY5R9T1Akfkh7p39diSmYZZvkHYRzdeSsaSSxFZX5UIdB+IkS5uSM+7iowbf2ItGV18cDcSw2Ow82w6ds/5GmvSDsKybVtemYGRB6DrBQnjxtO/YGHwRGzOSMVXgSFIzjoO1cRwnLmdi23ZaUg69TM+kssR5e2PHWdPYcqQEbipfoi4CeEI27YW/m794dDFGjBySR6AxKB0qaF8uEPJlq8uwfyA8Ug4eRiq0AisO3kEKwiEU7fuCBvqyxnIe/QAcgrfMCdXDO3liuCklVAO9ka3Dp14lUYu2SSAasrqUCqvHEq4Hp2t0LeHHfaez8Y3kyMQsjEe35J7I3espwrT4GLRbSwLmcbdNHTrangTkAifMVh5ZD8PwMhoGADdnPFX/10L1+72ZKABd8oewbNnLxQ8UcPc1BSPqyoYC2fw4t3b8HHw8APGm4kwH3E/ILW79nkNzYv8BAAD//5GoiggAAAAGSURBVAMAMV6HfcKh9B0AAAAASUVORK5CYII=" style="width: 18px; height: 18px; border-radius: 50%; object-fit: contain; vertical-align: middle; flex-shrink: 0;" />
                                                <span style="color: #334155; font-size: 13px; font-weight: 600; letter-spacing: -0.01em;">Unverified Sender (Offline)</span>
                                            </div>
                                            <div style="margin-top: 5px; font-size: 9px; color: #94a3b8;">
                                                <span>Hash: ${contentHash}</span>
                                            </div>
                                        `;
                                    } else {
                                        badgeInnerHtml = `
                                            <div style="display: inline-flex; align-items: center; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 9999px; padding: 4px 12px; gap: 8px; box-shadow: 0 1px 2px rgba(0,0,0,0.05);">
                                                <img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAGF0lEQVR4AaRWCVSNaRh+7p0WGbJMKCq3VKIiZCsSbcMhdEVajBFHzAzOnIMsd44GmWTPjOFkO84c24xCtBhnCMMYRxFKSLpCyhRqhim3eb9/mft3lxb+c/9veb93eb53+69co9E0aDQf8L4TZMW5lbrk+NBHRgoaGgA2Q3jYXljqTTpn7wdARwlkgnWRLu71rBOBnYl8tH0/AEwJCev9jNF1GSV8TQMgzzaSlSBvRP+AjXEAzDjzrNQoIS99UYFNGccQ+X0ipm//DuHb12FqcgKWHd6La8VF+lCk8vqnaAxAysyMMwEyyqbK1y8RuycZCccPwcNWgc9HBSHIYyAC3Dwxi9aTvbxx/PoVTNm6BkXPypgI/wrykOrmT7ixMQCRmTvSDrkl9xGzazMivf3Q1swcKeeyUFBWCpuOnaGwsoa6sgKbM1PxsrYGq0KjyBt7kHXzGq9Aali65k/JA8zVwoabdJgePn+GxPSjmB84ARtOH4NyiA+8HJ1xvjAf+y/8SmAykEnGfHu7I3pEABYfTIFqUgR3dvXBXfxfIexy7EXjRw5ZYwJ0mKzplnPHjMOBS2exICgEiSePor+9I7k9GB52CgxydMGS8WH4pL0lVqf9hK3RsVhO+bAmbCa2Z5/glN94VMzNhgY5R9T1Akfkh7p39diSmYZZvkHYRzdeSsaSSxFZX5UIdB+IkS5uSM+7iowbf2ItGV18cDcSw2Ow82w6ds/5GmvSDsKybVtemYGRB6DrBQnjxtO/YGHwRGzOSMVXgSFIzjoO1cRwnLmdi23ZaUg69TM+kssR5e2PHWdPYcqQEbipfoi4CeEI27YW/m794dDFGjBySR6AxKB0qaF8uEPJlq8uwfyA8Ug4eRiq0AisO3kEKwiEU7fuCBvqyxnIe/QAcgrfMCdXDO3liuCklVAO9ka3Dp14lUYu2SSAasrqUCqvHEq4Hp2t0LeHHfaez8Y3kyMQsjEe35J7I3espwrT4GLRbSwLmcbdNHTrangTkAifMVh5ZD8PwMhoGADdnPFX/10L1+72ZKABd8oewbNnLxQ8UcPc1BSPqyoYC2fw4t3b8HHw8APGm4kwH3E/ILW79nkNzYv8BAAD//5GoiggAAAAGSURBVAMAMV6HfcKh9B0AAAAASUVORK5CYII=" style="width: 18px; height: 18px; border-radius: 50%; object-fit: contain; vertical-align: middle; flex-shrink: 0;" />
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

                        const verificationType = isHuman ? 'human' : 'robotic';

                        // Call background verifyEmail API
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
                                                        <img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAGF0lEQVR4AaRWCVSNaRh+7p0WGbJMKCq3VKIiZCsSbcMhdEVajBFHzAzOnIMsd44GmWTPjOFkO84c24xCtBhnCMMYRxFKSLpCyhRqhim3eb9/mft3lxb+c/9veb93eb53+69co9E0aDQf8L4TZMW5lbrk+NBHRgoaGgA2Q3jYXljqTTpn7wdARwlkgnWRLu71rBOBnYl8tH0/AEwJCev9jNF1GSV8TQMgzzaSlSBvRP+AjXEAzDjzrNQoIS99UYFNGccQ+X0ipm//DuHb12FqcgKWHd6La8VF+lCk8vqnaAxAysyMMwEyyqbK1y8RuycZCccPwcNWgc9HBSHIYyAC3Dwxi9aTvbxx/PoVTNm6BkXPypgI/wrykOrmT7ixMQCRmTvSDrkl9xGzazMivf3Q1swcKeeyUFBWCpuOnaGwsoa6sgKbM1PxsrYGq0KjyBt7kHXzGq9Aali65k/JA8zVwoabdJgePn+GxPSjmB84ARtOH4NyiA+8HJ1xvjAf+y/8SmAykEnGfHu7I3pEABYfTIFqUgR3dvXBXfxfIexy7EXjRw5ZYwJ0mKzplnPHjMOBS2exICgEiSePor+9I7k9GB52CgxydMGS8WH4pL0lVqf9hK3RsVhO+bAmbCa2Z5/glN94VMzNhgY5R9T1Akfkh7p39diSmYZZvkHYRzdeSsaSSxFZX5UIdB+IkS5uSM+7iowbf2ItGV18cDcSw2Ow82w6ds/5GmvSDsKybVtemYGRB6DrBQnjxtO/YGHwRGzOSMVXgSFIzjoO1cRwnLmdi23ZaUg69TM+kssR5e2PHWdPYcqQEbipfoi4CeEI27YW/m794dDFGjBySR6AxKB0qaF8uEPJlq8uwfyA8Ug4eRiq0AisO3kEKwiEU7fuCBvqyxnIe/QAcgrfMCdXDO3liuCklVAO9ka3Dp14lUYu2SSAasrqUCqvHEq4Hp2t0LeHHfaez8Y3kyMQsjEe35J7I3espwrT4GLRbSwLmcbdNHTrangTkAifMVh5ZD8PwMhoGADdnPFX/10L1+72ZKABd8oewbNnLxQ8UcPc1BSPqyoYC2fw4t3b8HHw8APGm4kwH3E/ILW79nkNzYv8BAAD//5GoiggAAAAGSURBVAMAMV6HfcKh9B0AAAAASUVORK5CYII=" style="width: 18px; height: 18px; border-radius: 50%; object-fit: contain; vertical-align: middle; flex-shrink: 0;" />
                                                        <span style="color: #334155; font-size: 13px; font-weight: 600; letter-spacing: -0.01em;">Unverified Sender (Offline)</span>
                                                    </div>
                                                    <div style="margin-top: 5px; font-size: 9px; color: #94a3b8;">
                                                        <span>Hash: ${contentHash}</span>
                                                    </div>
                                                `;
                                            } else {
                                                badgeInnerHtml = `
                                                    <div style="display: inline-flex; align-items: center; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 9999px; padding: 4px 12px; gap: 8px; box-shadow: 0 1px 2px rgba(0,0,0,0.05);">
                                                        <img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAGF0lEQVR4AaRWCVSNaRh+7p0WGbJMKCq3VKIiZCsSbcMhdEVajBFHzAzOnIMsd44GmWTPjOFkO84c24xCtBhnCMMYRxFKSLpCyhRqhim3eb9/mft3lxb+c/9veb93eb53+69co9E0aDQf8L4TZMW5lbrk+NBHRgoaGgA2Q3jYXljqTTpn7wdARwlkgnWRLu71rBOBnYl8tH0/AEwJCev9jNF1GSV8TQMgzzaSlSBvRP+AjXEAzDjzrNQoIS99UYFNGccQ+X0ipm//DuHb12FqcgKWHd6La8VF+lCk8vqnaAxAysyMMwEyyqbK1y8RuycZCccPwcNWgc9HBSHIYyAC3Dwxi9aTvbxx/PoVTNm6BkXPypgI/wrykOrmT7ixMQCRmTvSDrkl9xGzazMivf3Q1swcKeeyUFBWCpuOnaGwsoa6sgKbM1PxsrYGq0KjyBt7kHXzGq9Aali65k/JA8zVwoabdJgePn+GxPSjmB84ARtOH4NyiA+8HJ1xvjAf+y/8SmAykEnGfHu7I3pEABYfTIFqUgR3dvXBXfxfIexy7EXjRw5ZYwJ0mKzplnPHjMOBS2exICgEiSePor+9I7k9GB52CgxydMGS8WH4pL0lVqf9hK3RsVhO+bAmbCa2Z5/glN94VMzNhgY5R9T1Akfkh7p39diSmYZZvkHYRzdeSsaSSxFZX5UIdB+IkS5uSM+7iowbf2ItGV18cDcSw2Ow82w6ds/5GmvSDsKybVtemYGRB6DrBQnjxtO/YGHwRGzOSMVXgSFIzjoO1cRwnLmdi23ZaUg69TM+kssR5e2PHWdPYcqQEbipfoi4CeEI27YW/m794dDFGjBySR6AxKB0qaF8uEPJlq8uwfyA8Ug4eRiq0AisO3kEKwiEU7fuCBvqyxnIe/QAcgrfMCdXDO3liuCklVAO9ka3Dp14lUYu2SSAasrqUCqvHEq4Hp2t0LeHHfaez8Y3kyMQsjEe35J7I3espwrT4GLRbSwLmcbdNHTrangTkAifMVh5ZD8PwMhoGADdnPFX/10L1+72ZKABd8oewbNnLxQ8UcPc1BSPqyoYC2fw4t3b8HHw8APGm4kwH3E/ILW79nkNzYv8BAAD//5GoiggAAAAGSURBVAMAMV6HfcKh9B0AAAAASUVORK5CYII=" style="width: 18px; height: 18px; border-radius: 50%; object-fit: contain; vertical-align: middle; flex-shrink: 0;" />
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
                                                            <img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAGF0lEQVR4AaRWCVSNaRh+7p0WGbJMKCq3VKIiZCsSbcMhdEVajBFHzAzOnIMsd44GmWTPjOFkO84c24xCtBhnCMMYRxFKSLpCyhRqhim3eb9/mft3lxb+c/9veb93eb53+69co9E0aDQf8L4TZMW5lbrk+NBHRgoaGgA2Q3jYXljqTTpn7wdARwlkgnWRLu71rBOBnYl8tH0/AEwJCev9jNF1GSV8TQMgzzaSlSBvRP+AjXEAzDjzrNQoIS99UYFNGccQ+X0ipm//DuHb12FqcgKWHd6La8VF+lCk8vqnaAxAysyMMwEyyqbK1y8RuycZCccPwcNWgc9HBSHIYyAC3Dwxi9aTvbxx/PoVTNm6BkXPypgI/wrykOrmT7ixMQCRmTvSDrkl9xGzazMivf3Q1swcKeeyUFBWCpuOnaGwsoa6sgKbM1PxsrYGq0KjyBt7kHXzGq9Aali65k/JA8zVwoabdJgePn+GxPSjmB84ARtOH4NyiA+8HJ1xvjAf+y/8SmAykEnGfHu7I3pEABYfTIFqUgR3dvXBXfxfIexy7EXjRw5ZYwJ0mKzplnPHjMOBS2exICgEiSePor+9I7k9GB52CgxydMGS8WH4pL0lVqf9hK3RsVhO+bAmbCa2Z5/glN94VMzNhgY5R9T1Akfkh7p39diSmYZZvkHYRzdeSsaSSxFZX5UIdB+IkS5uSM+7iowbf2ItGV18cDcSw2Ow82w6ds/5GmvSDsKybVtemYGRB6DrBQnjxtO/YGHwRGzOSMVXgSFIzjoO1cRwnLmdi23ZaUg69TM+kssR5e2PHWdPYcqQEbipfoi4CeEI27YW/m794dDFGjBySR6AxKB0qaF8uEPJlq8uwfyA8Ug4eRiq0AisO3kEKwiEU7fuCBvqyxnIe/QAcgrfMCdXDO3liuCklVAO9ka3Dp14lUYu2SSAasrqUCqvHEq4Hp2t0LeHHfaez8Y3kyMQsjEe35J7I3espwrT4GLRbSwLmcbdNHTrangTkAifMVh5ZD8PwMhoGADdnPFX/10L1+72ZKABd8oewbNnLxQ8UcPc1BSPqyoYC2fw4t3b8HHw8APGm4kwH3E/ILW79nkNzYv8BAAD//5GoiggAAAAGSURBVAMAMV6HfcKh9B0AAAAASUVORK5CYII=" style="width: 18px; height: 18px; border-radius: 50%; object-fit: contain; vertical-align: middle; flex-shrink: 0;" />
                                                            <span style="color: #065f46; font-size: 13px; font-weight: 600; letter-spacing: -0.01em;">Attest</span>
                                                        </div>
                                                        <div style="margin-top: 5px; font-size: 9px; color: #94a3b8;">
                                                            <span>Hash: ${contentHash}</span>
                                                        </div>
                                                    `;
                                                } else {
                                                    badgeInnerHtml = `
                                                        <a href="${recordUrl}" target="_blank" style="display: inline-flex; align-items: center; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 9999px; padding: 4px 12px; gap: 6px; box-shadow: 0 1px 2px rgba(0,0,0,0.05); text-decoration: none; cursor: pointer;" title="Click to view Attest Trust Record">
                                                            <img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAGF0lEQVR4AaRWCVSNaRh+7p0WGbJMKCq3VKIiZCsSbcMhdEVajBFHzAzOnIMsd44GmWTPjOFkO84c24xCtBhnCMMYRxFKSLpCyhRqhim3eb9/mft3lxb+c/9veb93eb53+69co9E0aDQf8L4TZMW5lbrk+NBHRgoaGgA2Q3jYXljqTTpn7wdARwlkgnWRLu71rBOBnYl8tH0/AEwJCev9jNF1GSV8TQMgzzaSlSBvRP+AjXEAzDjzrNQoIS99UYFNGccQ+X0ipm//DuHb12FqcgKWHd6La8VF+lCk8vqnaAxAysyMMwEyyqbK1y8RuycZCccPwcNWgc9HBSHIYyAC3Dwxi9aTvbxx/PoVTNm6BkXPypgI/wrykOrmT7ixMQCRmTvSDrkl9xGzazMivf3Q1swcKeeyUFBWCpuOnaGwsoa6sgKbM1PxsrYGq0KjyBt7kHXzGq9Aali65k/JA8zVwoabdJgePn+GxPSjmB84ARtOH4NyiA+8HJ1xvjAf+y/8SmAykEnGfHu7I3pEABYfTIFqUgR3dvXBXfxfIexy7EXjRw5ZYwJ0mKzplnPHjMOBS2exICgEiSePor+9I7k9GB52CgxydMGS8WH4pL0lVqf9hK3RsVhO+bAmbCa2Z5/glN94VMzNhgY5R9T1Akfkh7p39diSmYZZvkHYRzdeSsaSSxFZX5UIdB+IkS5uSM+7iowbf2ItGV18cDcSw2Ow82w6ds/5GmvSDsKybVtemYGRB6DrBQnjxtO/YGHwRGzOSMVXgSFIzjoO1cRwnLmdi23ZaUg69TM+kssR5e2PHWdPYcqQEbipfoi4CeEI27YW/m794dDFGjBySR6AxKB0qaF8uEPJlq8uwfyA8Ug4eRiq0AisO3kEKwiEU7fuCBvqyxnIe/QAcgrfMCdXDO3liuCklVAO9ka3Dp14lUYu2SSAasrqUCqvHEq4Hp2t0LeHHfaez8Y3kyMQsjEe35J7I3espwrT4GLRbSwLmcbdNHTrangTkAifMVh5ZD8PwMhoGADdnPFX/10L1+72ZKABd8oewbNnLxQ8UcPc1BSPqyoYC2fw4t3b8HHw8APGm4kwH3E/ILW79nkNzYv8BAAD//5GoiggAAAAGSURBVAMAMV6HfcKh9B0AAAAASUVORK5CYII=" style="width: 18px; height: 18px; border-radius: 50%; object-fit: contain; vertical-align: middle; flex-shrink: 0;" />
                                                            <span style="color: #065f46; font-size: 13px; font-weight: 600; letter-spacing: -0.01em;">Attest</span>
                                                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#059669" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-left: 1px;"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
                                                        </a>
                                                    `;
                                                }
                                            } else {
                                                if (stampMode === 'hash_only' || !recordUrl) {
                                                    badgeInnerHtml = `
                                                        <div style="display: inline-flex; align-items: center; background: #fef2f2; border: 1px solid #fca5a5; border-radius: 9999px; padding: 4px 12px; gap: 6px; box-shadow: 0 1px 2px rgba(0,0,0,0.05);">
                                                            <img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAGF0lEQVR4AaRWCVSNaRh+7p0WGbJMKCq3VKIiZCsSbcMhdEVajBFHzAzOnIMsd44GmWTPjOFkO84c24xCtBhnCMMYRxFKSLpCyhRqhim3eb9/mft3lxb+c/9veb93eb53+69co9E0aDQf8L4TZMW5lbrk+NBHRgoaGgA2Q3jYXljqTTpn7wdARwlkgnWRLu71rBOBnYl8tH0/AEwJCev9jNF1GSV8TQMgzzaSlSBvRP+AjXEAzDjzrNQoIS99UYFNGccQ+X0ipm//DuHb12FqcgKWHd6La8VF+lCk8vqnaAxAysyMMwEyyqbK1y8RuycZCccPwcNWgc9HBSHIYyAC3Dwxi9aTvbxx/PoVTNm6BkXPypgI/wrykOrmT7ixMQCRmTvSDrkl9xGzazMivf3Q1swcKeeyUFBWCpuOnaGwsoa6sgKbM1PxsrYGq0KjyBt7kHXzGq9Aali65k/JA8zVwoabdJgePn+GxPSjmB84ARtOH4NyiA+8HJ1xvjAf+y/8SmAykEnGfHu7I3pEABYfTIFqUgR3dvXBXfxfIexy7EXjRw5ZYwJ0mKzplnPHjMOBS2exICgEiSePor+9I7k9GB52CgxydMGS8WH4pL0lVqf9hK3RsVhO+bAmbCa2Z5/glN94VMzNhgY5R9T1Akfkh7p39diSmYZZvkHYRzdeSsaSSxFZX5UIdB+IkS5uSM+7iowbf2ItGV18cDcSw2Ow82w6ds/5GmvSDsKybVtemYGRB6DrBQnjxtO/YGHwRGzOSMVXgSFIzjoO1cRwnLmdi23ZaUg69TM+kssR5e2PHWdPYcqQEbipfoi4CeEI27YW/m794dDFGjBySR6AxKB0qaF8uEPJlq8uwfyA8Ug4eRiq0AisO3kEKwiEU7fuCBvqyxnIe/QAcgrfMCdXDO3liuCklVAO9ka3Dp14lUYu2SSAasrqUCqvHEq4Hp2t0LeHHfaez8Y3kyMQsjEe35J7I3espwrT4GLRbSwLmcbdNHTrangTkAifMVh5ZD8PwMhoGADdnPFX/10L1+72ZKABd8oewbNnLxQ8UcPc1BSPqyoYC2fw4t3b8HHw8APGm4kwH3E/ILW79nkNzYv8BAAD//5GoiggAAAAGSURBVAMAMV6HfcKh9B0AAAAASUVORK5CYII=" style="width: 18px; height: 18px; border-radius: 50%; object-fit: contain; vertical-align: middle; flex-shrink: 0;" />
                                                            <span style="color: #991b1b; font-size: 13px; font-weight: 600; letter-spacing: -0.01em;">Attest (Robotic)</span>
                                                        </div>
                                                        <div style="margin-top: 5px; font-size: 9px; color: #94a3b8;">
                                                            <span>Hash: ${contentHash}</span>
                                                        </div>
                                                    `;
                                                } else {
                                                    badgeInnerHtml = `
                                                        <a href="${recordUrl}" target="_blank" style="display: inline-flex; align-items: center; background: #fef2f2; border: 1px solid #fca5a5; border-radius: 9999px; padding: 4px 12px; gap: 6px; box-shadow: 0 1px 2px rgba(0,0,0,0.05); text-decoration: none; cursor: pointer;" title="Click to view Attest Trust Record">
                                                            <img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAGF0lEQVR4AaRWCVSNaRh+7p0WGbJMKCq3VKIiZCsSbcMhdEVajBFHzAzOnIMsd44GmWTPjOFkO84c24xCtBhnCMMYRxFKSLpCyhRqhim3eb9/mft3lxb+c/9veb93eb53+69co9E0aDQf8L4TZMW5lbrk+NBHRgoaGgA2Q3jYXljqTTpn7wdARwlkgnWRLu71rBOBnYl8tH0/AEwJCev9jNF1GSV8TQMgzzaSlSBvRP+AjXEAzDjzrNQoIS99UYFNGccQ+X0ipm//DuHb12FqcgKWHd6La8VF+lCk8vqnaAxAysyMMwEyyqbK1y8RuycZCccPwcNWgc9HBSHIYyAC3Dwxi9aTvbxx/PoVTNm6BkXPypgI/wrykOrmT7ixMQCRmTvSDrkl9xGzazMivf3Q1swcKeeyUFBWCpuOnaGwsoa6sgKbM1PxsrYGq0KjyBt7kHXzGq9Aali65k/JA8zVwoabdJgePn+GxPSjmB84ARtOH4NyiA+8HJ1xvjAf+y/8SmAykEnGfHu7I3pEABYfTIFqUgR3dvXBXfxfIexy7EXjRw5ZYwJ0mKzplnPHjMOBS2exICgEiSePor+9I7k9GB52CgxydMGS8WH4pL0lVqf9hK3RsVhO+bAmbCa2Z5/glN94VMzNhgY5R9T1Akfkh7p39diSmYZZvkHYRzdeSsaSSxFZX5UIdB+IkS5uSM+7iowbf2ItGV18cDcSw2Ow82w6ds/5GmvSDsKybVtemYGRB6DrBQnjxtO/YGHwRGzOSMVXgSFIzjoO1cRwnLmdi23ZaUg69TM+kssR5e2PHWdPYcqQEbipfoi4CeEI27YW/m794dDFGjBySR6AxKB0qaF8uEPJlq8uwfyA8Ug4eRiq0AisO3kEKwiEU7fuCBvqyxnIe/QAcgrfMCdXDO3liuCklVAO9ka3Dp14lUYu2SSAasrqUCqvHEq4Hp2t0LeHHfaez8Y3kyMQsjEe35J7I3espwrT4GLRbSwLmcbdNHTrangTkAifMVh5ZD8PwMhoGADdnPFX/10L1+72ZKABd8oewbNnLxQ8UcPc1BSPqyoYC2fw4t3b8HHw8APGm4kwH3E/ILW79nkNzYv8BAAD//5GoiggAAAAGSURBVAMAMV6HfcKh9B0AAAAASUVORK5CYII=" style="width: 18px; height: 18px; border-radius: 50%; object-fit: contain; vertical-align: middle; flex-shrink: 0;" />
                                                            <span style="color: #991b1b; font-size: 13px; font-weight: 600; letter-spacing: -0.01em;">Attest (Robotic)</span>
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
                                console.error("HVEL Outer Send Catch Callback Error:", innerErr);
                                isVerifying = false;
                                restoreSendButton(sendBtn);
                            }
                        });
                    } catch (midErr) {
                        console.error("HVEL Send Verification Core Error:", midErr);
                        isVerifying = false;
                        restoreSendButton(sendBtn);
                        sendBtn.setAttribute('data-hvel-verified', 'true');
                        sendBtn.click();
                    }
                });
                });
            } catch (msgErr) {
                console.error("HVEL Sending Message Pipeline Error:", msgErr);
                isVerifying = false;
                restoreSendButton(sendBtn);
                sendBtn.setAttribute('data-hvel-verified', 'true');
                sendBtn.click();
            }
        }, 200);
    } catch (outerErr) {
        console.error("HVEL Top Send Intercept Error:", outerErr);
        isVerifying = false;
        restoreSendButton(sendBtn);
        sendBtn.setAttribute('data-hvel-verified', 'true');
        sendBtn.click();
    }
}, true);

// ─── PLAN LIMIT MODAL ──────────────────────────────────────────────────
function showPlanLimitModal(featureKey, usageData = {}) {
    const existing = document.getElementById('hvel-plan-limit-modal');
    if (existing) existing.remove();

    const FEATURE_LABELS = {
        totp_verify:   { icon: '🛡️', title: 'Daily Verification Limit Reached', color: '#f59e0b' },
        webauthn:      { icon: '🔑', title: 'Biometric is a Pro Feature',       color: '#8b5cf6' },
        gmail_account: { icon: '📧', title: 'Account Limit Reached',            color: '#3b82f6' },
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
            <button id="hvel-modal-close" style="
                position: absolute; top: 20px; right: 20px;
                background: rgba(255, 255, 255, 0.05); border: none;
                color: #94a3b8; font-size: 18px; cursor: pointer;
                width: 32px; height: 32px; border-radius: 50%;
                display: flex; align-items: center; justify-content: center;
                transition: all 0.2s ease;
            ">×</button>

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

            <p style="font-size: 14px; color: #94a3b8; line-height: 1.6; margin: 0 0 8px; font-weight: 400;">
                ${msg}
            </p>
            ${usageBar}

            <div style="height: 1px; background: linear-gradient(90deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.02) 100%); margin: 24px 0;"></div>

            <div style="margin-bottom: 28px;">
                <h3 style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.08em; margin: 0 0 14px;">Professional plan includes</h3>
                <div style="display: grid; gap: 10px;">
                    ${[
                        '♾️ Unlimited human verifications',
                        '🔑 WebAuthn biometric login support',
                        '📧 Up to 5 connected accounts',
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
            <img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAGF0lEQVR4AaRWCVSNaRh+7p0WGbJMKCq3VKIiZCsSbcMhdEVajBFHzAzOnIMsd44GmWTPjOFkO84c24xCtBhnCMMYRxFKSLpCyhRqhim3eb9/mft3lxb+c/9veb93eb53+69co9E0aDQf8L4TZMW5lbrk+NBHRgoaGgA2Q3jYXljqTTpn7wdARwlkgnWRLu71rBOBnYl8tH0/AEwJCev9jNF1GSV8TQMgzzaSlSBvRP+AjXEAzDjzrNQoIS99UYFNGccQ+X0ipm//DuHb12FqcgKWHd6La8VF+lCk8vqnaAxAysyMMwEyyqbK1y8RuycZCccPwcNWgc9HBSHIYyAC3Dwxi9aTvbxx/PoVTNm6BkXPypgI/wrykOrmT7ixMQCRmTvSDrkl9xGzazMivf3Q1swcKeeyUFBWCpuOnaGwsoa6sgKbM1PxsrYGq0KjyBt7kHXzGq9Aali65k/JA8zVwoabdJgePn+GxPSjmB84ARtOH4NyiA+8HJ1xvjAf+y/8SmAykEnGfHu7I3pEABYfTIFqUgR3dvXBXfxfIexy7EXjRw5ZYwJ0mKzplnPHjMOBS2exICgEiSePor+9I7k9GB52CgxydMGS8WH4pL0lVqf9hK3RsVhO+bAmbCa2Z5/glN94VMzNhgY5R9T1Akfkh7p39diSmYZZvkHYRzdeSsaSSxFZX5UIdB+IkS5uSM+7iowbf2ItGV18cDcSw2Ow82w6ds/5GmvSDsKybVtemYGRB6DrBQnjxtO/YGHwRGzOSMVXgSFIzjoO1cRwnLmdi23ZaUg69TM+kssR5e2PHWdPYcqQEbipfoi4CeEI27YW/m794dDFGjBySR6AxKB0qaF8uEPJlq8uwfyA8Ug4eRiq0AisO3kEKwiEU7fuCBvqyxnIe/QAcgrfMCdXDO3liuCklVAO9ka3Dp14lUYu2SSAasrqUCqvHEq4Hp2t0LeHHfaez8Y3kyMQsjEe35J7I3espwrT4GLRbSwLmcbdNHTrangTkAifMVh5ZD8PwMhoGADdnPFX/10L1+72ZKABd8oewbNnLxQ8UcPc1BSPqyoYC2fw4t3b8HHw8APGm4kwH3E/ILW79nkNzYv8BAAD//5GoiggAAAAGSURBVAMAMV6HfcKh9B0AAAAASUVORK5CYII=" style="width: 18px; height: 18px; border-radius: 50%; object-fit: contain;" />
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

// Helper to detect if an element is inside quoted/reply text or draft composition areas
function isInsideQuotedText(el) {
    if (!el) return false;
    
    // 1. Check standard class names and tags for quoted/reply content
    const quoteSelector = 'blockquote, .gmail_quote, .x_gmail_quote, .x_x_gmail_quote, .ms-quote, .x_ms-quote, .quotedText, .x_quotedText, .outlook_quote, .x_outlook_quote';
    if (el.closest(quoteSelector)) return true;
    
    // 2. Walk up parents to detect visual cues of quoted sections
    let parent = el.parentElement;
    while (parent && parent !== document.body) {
        // Check for inline border-left style which visually signifies a quoted section
        const style = parent.getAttribute('style') || '';
        if (style.includes('border-left') || style.includes('border-Left')) {
            return true;
        }
        
        // Specifically check for known Outlook sanitizer classes (not broad substring match)
        const className = parent.className || '';
        if (typeof className === 'string') {
            const classes = className.split(/\s+/);
            const hasQuoteClass = classes.some(c => 
                c === 'x_ap' || 
                c === 'divRTEContent' || 
                c === 'gmail_quote' || 
                c === 'x_gmail_quote' || 
                c === 'x_ms-quote' || 
                c === 'quotedText'
            );
            if (hasQuoteClass) return true;
        }
        parent = parent.parentElement;
    }
    return false;
}

// Inject a compact Attest pill directly next to the sender's email address in the Outlook header.
// Searches specifically in the HEADER area (cardContainer minus bodyEl) for the sender email element.
function injectHeaderBadge(cardContainer, bodyEl, senderEmail, status) {
    if (!cardContainer || !senderEmail) return;

    // Remove any existing badge in this card to avoid duplicates
    cardContainer.querySelectorAll('.hvel-header-badge').forEach(el => el.remove());

    // ── Find the sender element specifically in the HEADER (not body) ──
    let target = null;
    const normEmail = senderEmail.toLowerCase().trim();

    for (const el of cardContainer.querySelectorAll('*')) {
        // Skip anything inside the email body itself
        if (bodyEl && bodyEl.contains(el)) continue;
        // Skip our own injected elements
        if (el.classList.contains('hvel-header-badge') || el.classList.contains('hvel-trust-notice')) continue;

        // Match via explicit email attributes (most reliable)
        const emailAttr = (
            el.getAttribute('data-hovercard-id') ||
            el.getAttribute('email') ||
            (el.getAttribute('href') || '').replace('mailto:', '')
        ).toLowerCase();
        if (emailAttr === normEmail) { target = el; break; }

        // Match via aria-label or title containing the email
        const labelStr = ((el.getAttribute('aria-label') || '') + ' ' + (el.getAttribute('title') || '')).toLowerCase();
        if (labelStr.includes(normEmail)) { target = el; break; }

        // Match via visible text content (leaf nodes only — avoids matching large containers)
        if (el.children.length === 0) {
            const text = (el.textContent || '').toLowerCase();
            if (text.includes(normEmail)) { target = el; break; }
        }
    }

    if (!target) return;

    // Build the badge pill
    const badge = document.createElement('span');
    badge.className = 'hvel-header-badge';
    badge.style.cssText = `
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 2px 8px;
        border-radius: 9999px;
        font-size: 11px;
        font-weight: 600;
        margin-left: 8px;
        vertical-align: middle;
        user-select: none;
        font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
        white-space: nowrap;
    `;

    if (status === 'verified') {
        badge.style.background = '#e6fbf1';
        badge.style.border = '1px solid #a7f3d0';
        badge.style.color = '#065f46';
        badge.innerHTML = '✅ Attest';
    } else if (status === 'tampered' || status === 'invalid') {
        badge.style.background = '#fff1f2';
        badge.style.border = '1px solid #fecaca';
        badge.style.color = '#991b1b';
        badge.innerHTML = '⚠️ ID Mismatch';
    } else {
        badge.style.background = '#fffbeb';
        badge.style.border = '1px solid #fde68a';
        badge.style.color = '#b45309';
        badge.innerHTML = '⚠️ Unverified';
    }

    // Insert badge immediately after the sender element
    target.after(badge);
}

// ─── PASSIVE INCOMING INBOX SCANNER ───
async function scanIncomingMessages() {
    // 1. Find all email body containers in the page — cover old OWA, new OWA (cloud.microsoft), and Outlook.com
    const bodies = document.querySelectorAll([
        '.allowTextSelection',
        'div.customBody',
        'div.ReadingPane',
        '[class*="ReadingPane"]',
        '[class*="readingPane"]',
        '[class*="messageBody"]',
        '[class*="MessageBody"]',
        '[class*="ItemContent"]',
        'div[class*="readingPaneContent"]',
        'div[class*="ReadingPaneContent"]',
        '[data-app-section="MessageBody"]',
        'div[role="document"] > div > div'
    ].join(', '));

    // Deduplicate — some selectors may match same elements
    const uniqueBodies = [...new Set([...bodies])];

    console.log(`[HVEL OWA] scanIncomingMessages running. Found ${uniqueBodies.length} body element(s).`);

    uniqueBodies.forEach(async (bodyEl, idx) => {
        // Skip compose windows
        if (bodyEl.querySelector('[contenteditable="true"]') || bodyEl.getAttribute('contenteditable') === 'true' || bodyEl.closest('[contenteditable="true"]')) {
            return;
        }

        // ── DEDUP: skip if already fully processed (survives SPA re-renders) ──
        if (bodyEl.getAttribute('data-hvel-scanned') === 'true') return;

        // Traverse up from bodyEl to find the message card container containing sender info outside bodyEl
        let cardContainer = null;
        let senderEmail = null;
        let senderEl = null;
        
        let current = bodyEl;
        while (current && current.tagName !== 'BODY') {
            const parent = current.parentElement;
            if (!parent) break;

            // Stop walking up if parent is the main conversation thread container (contains multiple bodies)
            if (parent.querySelectorAll('.allowTextSelection').length > 1) {
                break;
            }

            // Search for potential sender elements inside parent but outside current
            const elements = parent.querySelectorAll('*');
            for (let el of elements) {
                if (!current.contains(el) && el !== current) {
                    // Ignore recipient containers (To, Cc, CC, recipient chips) to avoid misidentifying recipients as the sender
                    if (el.closest('[aria-label*="To"], [aria-label*="Cc"], [class*="recipient"], [class*="ToLine"], [class*="CcLine"]')) {
                        continue;
                    }

                    // Try data-hovercard-id, email, href="mailto:..."
                    const emailAttr = el.getAttribute('data-hovercard-id') || el.getAttribute('email') || el.getAttribute('href')?.replace('mailto:', '');
                    if (emailAttr && emailAttr.includes('@')) {
                        senderEmail = emailAttr;
                        senderEl = el;
                        break;
                    }
                    
                    // Try avatar images
                    if (el.tagName === 'IMG') {
                        const src = el.src || '';
                        const emailParamMatch = src.match(/email=([^&]+)/);
                        if (emailParamMatch) {
                            senderEmail = decodeURIComponent(emailParamMatch[1]);
                            senderEl = el;
                            break;
                        }
                        const userParamMatch = src.match(/\/users\/([^/]+)/);
                        if (userParamMatch) {
                            senderEmail = decodeURIComponent(userParamMatch[1]);
                            senderEl = el;
                            break;
                        }
                    }

                    // Try aria-label or title
                    const ariaLabel = el.getAttribute('aria-label') || '';
                    const title = el.getAttribute('title') || '';
                    const match = (ariaLabel + ' ' + title).match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
                    if (match) {
                        senderEmail = match[0];
                        senderEl = el;
                        break;
                    }
                }
            }

            if (senderEmail) {
                cardContainer = parent;
                break;
            }

            // Fallback: Parse raw text from elements outside current
            let headerText = '';
            for (let el of elements) {
                if (!current.contains(el) && el !== current && el.children.length === 0) {
                    // Ignore recipient container text
                    if (el.closest('[aria-label*="To"], [aria-label*="Cc"], [class*="recipient"], [class*="ToLine"], [class*="CcLine"]')) {
                        continue;
                    }
                    headerText += (el.innerText || '') + ' ';
                }
            }
            const textMatch = headerText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
            if (textMatch) {
                senderEmail = textMatch[0];
                cardContainer = parent;
                
                // Find the leaf element matching the email or name prefix
                for (let el of elements) {
                    if (!current.contains(el) && el !== current && el.children.length === 0 && (el.textContent?.includes(senderEmail) || el.textContent?.includes(senderEmail.split('@')[0]))) {
                        senderEl = el;
                        break;
                    }
                }
                break;
            }

            current = parent;
        }

        console.log(`[HVEL OWA] Body #${idx}: Resolved senderEmail: "${senderEmail}", senderEl: ${senderEl ? senderEl.tagName + '.' + senderEl.className : 'null'}`);

        if (!senderEmail || !senderEmail.includes('@') || !cardContainer) {
            return;
        }

        // Mark this body element as permanently processed so it is never stamped twice
        bodyEl.setAttribute('data-hvel-scanned', 'true');

        const badgeLinkElement = cardContainer.querySelector('a[href*="/v/"]');
        const badgeLink = (badgeLinkElement && !isInsideQuotedText(badgeLinkElement)) ? badgeLinkElement : null;

        senderEmail = senderEmail.toLowerCase().trim();

        // Fallback: If we still don't have a senderEl, default to bodyEl's parent/previous sibling
        if (!senderEl) {
            senderEl = bodyEl.previousElementSibling || bodyEl.parentElement || bodyEl;
        }

        // Resolve recipient: prefer DOM resolution, fall back to cached auth email
        let recipientEmail = getCurrentUserEmail() || '';
        if (!recipientEmail || recipientEmail === 'unknown-outlook-sender@outlook.com') {
            recipientEmail = cachedUserEmail || '';
        }
        if (!recipientEmail || recipientEmail === 'unknown-outlook-sender@outlook.com') {
            // Last resort: try storage directly
            recipientEmail = await new Promise(resolve => {
                chrome.storage.local.get(['hvel_auth_email'], r => resolve(r.hvel_auth_email || ''));
            });
        }
        const IGNORED_DOMAINS = [
            'google.com', 'googleapis.com', 'googlemail.com',
            'microsoft.com', 'outlook.com', 'hotmail.com', 'live.com', 'msn.com', 'office.com', 'azure.com',
            'apple.com', 'icloud.com', 'me.com',
            'amazon.com', 'amazonaws.com', 'aws.com', 'awsapps.com',
            'meta.com', 'facebook.com', 'instagram.com', 'whatsapp.com', 'threads.net',
            'twitter.com', 'x.com', 'linkedin.com', 'lnkd.in', 'netflix.com', 'youtube.com',
            'github.com', 'githubapp.com', 'vercel.com', 'vercel.app', 'cloudflare.com', 'workers.dev',
            'digitalocean.com', 'heroku.com', 'atlassian.com', 'jira.com', 'confluence.com',
            'stripe.com', 'square.com', 'squareup.com', 'visa.com', 'mastercard.com', 'paypal.com'
        ];
        const senderDomain = senderEmail?.split('@')[1]?.toLowerCase();
        const isIgnoredDomain = IGNORED_DOMAINS.some(d => senderDomain === d || senderDomain?.endsWith('.' + d));

        console.log(`[HVEL OWA] Body #${idx}: Message detected. Sender: "${senderEmail}", Domain Ignored: ${isIgnoredDomain}, Recipient: "${recipientEmail}"`);

        // Only skip if sender matches recipient exactly (self-send) or domain is ignored
        const isSelfSend = recipientEmail && senderEmail.toLowerCase() === recipientEmail.toLowerCase();
        if (senderEmail && !isSelfSend && !isIgnoredDomain) {
            chrome.storage.local.get(['hvel_verify_received'], (res) => {
                const verifyReceived = res.hvel_verify_received !== false;
                console.log(`[HVEL OWA] Body #${idx}: Checking storage for hvel_verify_received: ${verifyReceived}`);
                if (!verifyReceived) {
                    return;
                }

                if (badgeLink) {
                    const url = badgeLink.href;
                    const id = url.split('/v/').pop();
                    console.log(`[HVEL OWA] Body #${idx}: Found trust badge link for ID: ${id}. Validating verification...`);

                    chrome.runtime.sendMessage({
                        action: 'validateVerification',
                        id: id,
                        senderEmail: senderEmail,
                        recipientEmail: recipientEmail
                    }, (response) => {
                        console.log(`[HVEL OWA] Body #${idx}: Validation result for ID ${id}:`, response);
                        if (response && (response.status === 'verified' || response.status === 'tampered')) {
                            injectHeaderBadge(cardContainer, bodyEl, senderEmail, 'verified');
                            if (!bodyEl.hasAttribute('data-hvel-audited')) {
                                bodyEl.setAttribute('data-hvel-audited', 'true');
                                logAuditEvent('received_stamped', senderEmail, { sender: senderEmail, recipient: recipientEmail, verificationId: id });
                            }
                        } else {
                            injectHeaderBadge(cardContainer, bodyEl, senderEmail, 'unverified');
                            if (!bodyEl.hasAttribute('data-hvel-audited')) {
                                bodyEl.setAttribute('data-hvel-audited', 'true');
                                logAuditEvent('received_unstamped', senderEmail, { sender: senderEmail, recipient: recipientEmail });
                            }
                        }
                    });
                } else {
                    console.log(`[HVEL OWA] Body #${idx}: No trust badge link found. Checking user verification status for: ${senderEmail}`);
                    chrome.runtime.sendMessage({ action: 'checkUserVerified', email: senderEmail }, (userRes) => {
                        const isVerifiedSender = !!(userRes && userRes.verified);
                        if (isVerifiedSender) {
                            injectHeaderBadge(cardContainer, bodyEl, senderEmail, 'verified');
                            if (!bodyEl.hasAttribute('data-hvel-audited')) {
                                bodyEl.setAttribute('data-hvel-audited', 'true');
                                logAuditEvent('received_stamped', senderEmail, { sender: senderEmail, recipient: recipientEmail });
                            }
                        } else {
                            injectHeaderBadge(cardContainer, bodyEl, senderEmail, 'unverified');
                            if (!bodyEl.hasAttribute('data-hvel-audited')) {
                                bodyEl.setAttribute('data-hvel-audited', 'true');
                                logAuditEvent('received_unstamped', senderEmail, { sender: senderEmail, recipient: recipientEmail });
                            }
                        }
                    });
                    
                    if (bodyEl.offsetParent !== null) {
                        const normSender = senderEmail.toLowerCase().trim();
                        const nudgeKey = `hvel_nudged_${normSender}`;
                        
                        chrome.storage.local.get([nudgeKey], (nudgeResult) => {
                            const lastNudge = nudgeResult[nudgeKey];
                            const now = Date.now();
                            const dayInMs = 24 * 60 * 60 * 1000;

                            if ((!lastNudge || (now - lastNudge > dayInMs)) && !pendingRequests.has(nudgeKey)) {
                                pendingRequests.add(nudgeKey);
                                chrome.storage.local.set({ [nudgeKey]: now });

                                console.log(`[HVEL OWA] Body #${idx}: Triggering unverified reply nudge email to: ${normSender}`);
                                chrome.runtime.sendMessage({
                                    action: 'reportUnverifiedReply',
                                    hvelUserEmail: recipientEmail,
                                    noExtensionEmail: normSender,
                                    details: { timestamp: new Date().toLocaleString(), url: window.location.href }
                                });
                            }
                        });
                    }
                }
            });
        } else {
            console.log(`[HVEL OWA] Body #${idx}: Ignored self-send, empty emails, or ignored domains.`);
        }
    });
}

function showTrustStatus(bodyEl, status, text) {
    const existing = bodyEl.querySelector('.hvel-trust-notice');
    if (existing) existing.remove();

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
                    <span style="color: #166534; font-size: 12px; font-weight: 600; letter-spacing: -0.01em;">Attest</span>
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

    bodyEl.insertBefore(notice, bodyEl.firstChild);
}

// Compute SHA-256 hash of email body contents
async function computeHash(text) {
    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Extract recipient email from Compose elements
function getRecipientEmail(sendBtn) {
    const container = sendBtn.closest('div[role="region"]') || sendBtn.closest('.Ms-BasePicker') || document;
    
    // Look for Persona chips or elements with data-email
    const chips = container.querySelectorAll('span[data-email], .ms-PickerPersona-container, .persona-chip, [role="listitem"] span[email]');
    if (chips.length > 0) {
        for (let chip of chips) {
            let email = chip.getAttribute('data-email') || chip.getAttribute('email');
            if (!email) {
                const match = chip.innerText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
                if (match) email = match[0];
            }
            if (email && email.includes('@')) return email.toLowerCase().trim();
        }
    }
    
    // Fallback to text area inputs
    const inputs = getRecipientInputs(container);
    for (let input of inputs) {
        const val = input.value.trim();
        const match = val.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
        if (match) return match[0].toLowerCase().trim();
    }

    return null;
}

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

function getRecipientInputs(container) {
    const found = [];
    container.querySelectorAll('input[role="combobox"], div[role="combobox"] input, input.ms-BasePicker-input, textarea').forEach(input => {
        const id = input.getAttribute('id') || '';
        const name = input.getAttribute('name') || '';
        const label = input.getAttribute('aria-label') || '';
        
        // Skip Subject input
        if (label.toLowerCase().includes('subject') || name.toLowerCase().includes('subject') || id.toLowerCase().includes('subject')) return;
        found.push(input);
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
    const editors = document.querySelectorAll('div[role="textbox"][aria-label="Message body"], div[contenteditable="true"][aria-label="Message body"]');
    editors.forEach(editor => {
        const container = editor.closest('div[role="region"]') || editor.closest('.ms-ComposeHeader') || editor.closest('div.ms-CommandBar')?.parentElement || editor.parentElement;
        if (!container) return;

        // 1. Style recipient chips
        const chips = container.querySelectorAll('span[data-email], .ms-PickerPersona-container, .persona-chip, [role="listitem"] span[email]');
        let hasUnverified = false;
        let hasVerified = false;

        chips.forEach(chip => {
            let email = chip.getAttribute('data-email') || chip.getAttribute('email');
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
                    checkedEmailsCache.set(email, { verified: false, checking: true });
                    chrome.runtime.sendMessage({ action: 'checkUserVerified', email: email }, (response) => {
                        const isVerified = !!(response && response.verified);
                        checkedEmailsCache.set(email, { verified: isVerified, checking: false });
                        styleChip(chip, isVerified);
                    });
                }
            }
        });
        
        // 2. Attach listeners to input fields
        const inputs = getRecipientInputs(container);
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

        // 3. Update compose tracking indicator
        const indicator = container.querySelector('#hvel-compose-indicator');
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
    const key = `outlook_hvel_stats_${type}`;
    chrome.storage.local.get([key, 'outlook_hvel_audit_log', 'hvel_auth_token'], (res) => {
        const count = (res[key] || 0) + 1;
        const rawLog = res.outlook_hvel_audit_log || [];
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
            outlook_hvel_audit_log: updatedLog
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

function scanOutlookInboxList() {
    chrome.storage.local.get(['hvel_verify_received'], (res) => {
        const isEnabled = res.hvel_verify_received !== false;
        if (!isEnabled) {
            document.querySelectorAll('.hvel-list-badge').forEach(badge => badge.remove());
            return;
        }

        const rows = document.querySelectorAll([
            'div[role="option"]',
            'div[data-lpos]',
            '[class*="customListItem"]',
            '[class*="listItem"]',
            '[class*="mailListItem"]',
            '[class*="MailListItem"]',
            'div[data-convid]',
            'div[data-item-id]'
        ].join(', '));

        rows.forEach(row => {
            // Skip already-processed rows (persists across SPA renders)
            if (row.getAttribute('data-hvel-row-scanned') === 'true') return;

            // ── 4-strategy email extraction ──
            let email = null;

            // Strategy 1: explicit email attributes
            const emailEl = row.querySelector('[data-hovercard-id], [email], a[href^="mailto:"]');
            if (emailEl) {
                email = emailEl.getAttribute('data-hovercard-id') ||
                        emailEl.getAttribute('email') ||
                        (emailEl.getAttribute('href') || '').replace('mailto:', '');
            }
            // Strategy 2: title attribute
            if (!email || !email.includes('@')) {
                const titleEl = row.querySelector('[title*="@"]');
                if (titleEl) {
                    const m = (titleEl.getAttribute('title') || '').match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
                    if (m) email = m[0];
                }
            }
            // Strategy 3: aria-label
            if (!email || !email.includes('@')) {
                const ariaEl = row.querySelector('[aria-label*="@"]');
                if (ariaEl) {
                    const m = (ariaEl.getAttribute('aria-label') || '').match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
                    if (m) email = m[0];
                }
            }
            // Strategy 4: raw text scan of the entire row
            if (!email || !email.includes('@')) {
                const m = (row.innerText || '').match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
                if (m) email = m[0];
            }

            if (!email || !email.includes('@')) return;
            email = email.toLowerCase().trim();

            // Mark row before async call so duplicate runs are skipped
            row.setAttribute('data-hvel-row-scanned', 'true');

            // ── Find anchor element for the dot ──
            let anchorEl = row.querySelector([
                '[style*="grid-area: time"]',
                '[class*="itemTime"]', '[class*="ItemTime"]',
                '[class*="Time"]', '[class*="time"]',
                'span[time]', 'div[time]',
                '[data-testid*="time"]', '[data-testid*="date"]',
                'span[class*="date"]', 'div[class*="date"]'
            ].join(', '));

            // Fallback: element whose text looks like a date/time
            if (!anchorEl) {
                for (const el of row.querySelectorAll('span, div')) {
                    if (el.children.length === 0) {
                        const t = (el.innerText || '').trim();
                        if (/\d{1,2}:\d{2}|(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/i.test(t)) {
                            anchorEl = el;
                            break;
                        }
                    }
                }
            }

            // ── Create dot badge ──
            let badge = row.querySelector('.hvel-list-badge');
            if (!badge) {
                badge = document.createElement('span');
                badge.className = 'hvel-list-badge';
                badge.setAttribute('data-email', email);

                if (anchorEl && anchorEl.parentElement) {
                    // Inline: insert dot just before the time element
                    badge.style.cssText = `
                        display: inline-flex; align-items: center; justify-content: center;
                        width: 9px; height: 9px; margin-right: 5px;
                        vertical-align: middle; flex-shrink: 0; user-select: none;
                    `;
                    anchorEl.parentElement.insertBefore(badge, anchorEl);
                } else {
                    // Fallback: absolute position on right side of row (like Gmail td.xW)
                    row.style.position = 'relative';
                    badge.style.cssText = `
                        position: absolute; right: 72px; top: 50%; transform: translateY(-50%);
                        display: inline-flex; align-items: center; justify-content: center;
                        width: 9px; height: 9px; z-index: 10; user-select: none;
                    `;
                    row.appendChild(badge);
                }
            } else {
                badge.setAttribute('data-email', email);
            }

            // ── Verify and render dot color ──
            if (checkedEmailsCache.has(email)) {
                const cached = checkedEmailsCache.get(email);
                if (!cached.checking) updateListBadge(badge, cached.verified);
            } else {
                updateListBadge(badge, false); // red immediately while checking
                checkedEmailsCache.set(email, { verified: false, checking: true });
                chrome.runtime.sendMessage({ action: 'checkUserVerified', email }, (response) => {
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
            document.querySelectorAll('.hvel-list-badge').forEach(badge => badge.remove());
        } else {
            scanOutlookInboxList();
        }
    }
});

// Dynamic poll loops
function runHvelIntervals() {
    scanIncomingMessages();
    scanAndStyleComposeRecipients();
    scanOutlookInboxList();
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


