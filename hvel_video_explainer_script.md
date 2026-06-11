# 🎬 Hvel (Human Verified Email Layer) - Product Explainer Video Script & Recording Guide

This document is the master script and production guide for Shubham to create a professional product explainer video for **Hvel (Human Verified Email Layer)**. It includes a scene-by-scene storyboard, voiceover (VO) script, and a step-by-step technical guide to capture the necessary screen recordings.

---

## 📺 Video Concept & Structure
* **Goal**: Explain how Hvel stops automated email fraud and identity mismatch attacks by verifying physical human intent in the background, without introducing friction.
* **Target Audience**: Corporate security teams, Gmail power users, SaaS founders, and anyone looking to protect their inbox from AI-generated spam and phishing.
* **Duration**: ~2 minutes and 30 seconds.
* **Style**: Sleek, modern tech presentation. Upbeat background music, clean transitions, glassmorphic UI close-ups, and smooth cursor motion tracking animations.

---

## 📜 Scene-by-Scene Storyboard & Script

| Time | Visual Scene (Screen Recording & Visuals) | Voiceover (VO) Audio Script | Shubham's Recording Instructions |
| :--- | :--- | :--- | :--- |
| **0:00 - 0:15** | **Scene 1: The Email Crisis**<br>• Visual of an overflowing Gmail inbox.<br>• Subtle red warnings or red-tinted lines highlighting unsolicited automated sales outreach or phishing emails.<br>• Bold text overlay: *"Is that email actually from a human?"* | "Every single day, our inboxes are flooded with automated spam, AI-generated phishing attacks, and identity mismatch scams. The hard truth? It has become impossible to know if the email you just received was written by a real human, or a malicious script running on a server." | • Capture a scroll of a cluttered inbox.<br>• Highlight subject lines that look like AI outreach.<br>• Add zoom-in on red warnings or overlay texts. |
| **0:15 - 0:38** | **Scene 2: Introducing Hvel**<br>• Beautiful transition to the Hvel Landing Page (`hvel.io` or `localhost:3000`).<br>• Smooth scroll highlighting the headline: *"Universal Human Verification Protocol."*<br>• Zoom in on the core features (Proof of Humanity, Inbox Protection). | "Introducing Hvel—the Human Verified Email Layer. Hvel is a universal zero-trust security protocol designed to guarantee human origin for every email sent and received. By analyzing physical behavior and injecting cryptographic trust stamps directly inside Gmail, Hvel ensures your communication remains human." | • Record a clean scrolling capture of the Hvel landing page (`src/app/page.tsx`).<br>• Use smooth easing on cursor movements.<br>• Capture the visual graphics showing the two-way validation. |
| **0:38 - 1:05** | **Scene 3: Seamless Sender Experience**<br>• Switch to Gmail compose dialog.<br>• Show the user typing a brief message.<br>• Zoom in on the bottom toolbar: pointing out the pulsing green indicator: `🟢 HVEL Tracking`.<br>• Click "Send"—the button text turns to a loading spinner saying `"Verifying..."`.<br>• In the top-right, a clean toast says `✅ Human Verified`. | "Using Hvel is entirely frictionless. As you write your email, the Hvel extension silently monitors micro-behaviors, like mouse trajectories and velocities. When you hit 'Send', Hvel's AI analyzer checks for genuine human intent. Once confirmed, a secure trust badge containing a unique content hash is appended to your email." | • Open compose dialog in Gmail.<br>• Highlight the injected `HVEL Tracking` badge in the toolbar.<br>• Type a message naturally, then click send.<br>• Capture the `"Verifying..."` spinner on the send button and the success toast on the top-right. |
| **1:05 - 1:28** | **Scene 4: Injected Trust Badge**<br>• Show the sent/received email.<br>• Highlight the embedded green badge: `✅ Human Verified \| Trust Record [link]`.<br>• Show the cursor clicking `Trust Record`. It opens a new tab with the cryptographic page showing the Sender Email, Timestamp, and Content SHA-256 Hash. | "Every verified email carries a tamper-proof trust stamp. The recipient can click the Trust Record link to access a cryptographic ledger served directly by Hvel's backend. This ledger verifies the sender's identity and checks the SHA-256 content hash, proving the email hasn't been modified in transit." | • Open the sent email in Gmail.<br>• Zoom in on the high-fidelity green badge inside the email body.<br>• Click "Trust Record" and record the verification page (`/v/:id`) showing matching metadata. |
| **1:28 - 1:55** | **Scene 5: Passive Inbox Protection**<br>• Show an incoming unverified email arriving.<br>• Instantly, a bright red banner is prepended at the top: `🚫 SECURITY ALERT: UNTRUSTED SENDER`.<br>• A large diagonal watermark `UNTRUSTED` fades over the email text.<br>• Show the alert log or the automated nudge email sent to the spammer. | "But what happens on the recipient's side? Hvel works in the background, scanning incoming emails. If a message arrives without a trust stamp, Hvel flags it with an 'Untrusted Sender' watermark and sends a polite automated nudge, inviting them to verify their identity. No spam, no intrusion." | • Record the inbox scanning an incoming email with no badge.<br>• Capture the red notice and the diagonal `UNTRUSTED` stamp overlaying the text.<br>• Show the automated nudge email in the target inbox (e.g. `nudgeHtml` layout). |
| **1:55 - 2:15** | **Scene 6: Critical Security Alerts**<br>• Show an email where the cryptographic stamp has been copied or tampered with.<br>• A flashing red border banner appears: `🚫 CRITICAL SECURITY ALERT: ID MISMATCH`.<br>• A dark red diagonal `TAMPERED` watermark overlays the message.<br>• Show a critical warning email notification. | "If a scammer attempts to copy a trust badge or alter the email contents, Hvel's active validation engine immediately catches it. The message is blocked, a 'TAMPERED' warning is stamped across the screen, and both parties are notified instantly of the attack." | • Simulate a tampered verification.<br>• Capture the flashing red warning block and the diagonal `TAMPERED` watermark.<br>• Capture the security alert email (`security_alert_log` triggers). |
| **2:15 - 2:35** | **Scene 7: Monetization & Pro Plan Upgrade**<br>• In compose window, show the user hitting their daily limit.<br>• The premium glassmorphic modal blocks the send button, showing a progress bar, Pro benefits list, and a `Upgrade to Professional` button.<br>• Show the user upgrading and enrolling their biometric passkey (WebAuthn). | "Hvel offers a free tier, but power users can upgrade to Hvel Professional for just three dollars a month. This unlocks unlimited daily human verifications, multi-account support, and passwordless biometric signups using WebAuthn passkeys, making authentication as simple as a fingerprint scan." | • Trigger the `totp_verify` daily quota limit to show the glassmorphic modal.<br>• Capture the progress bar and Pro feature list.<br>• Record the WebAuthn passkey enrollment interface on the authentication portal. |
| **2:35 - 2:50** | **Scene 8: Conclusion**<br>• Visual of the extension being turned on.<br>• Display the brand logo: `HVEL` and the website: `hvel.io`.<br>• Call to action: *Secure Your Inbox Today.* | "Take back control of your email. Protect your brand, verify your sender reputation, and restore trust to your inbox. Download the Hvel Extension today at hvel.io and join the universal human email protocol." | • End on a high-fidelity visual of the Hvel logo with the call to action.<br>• Fade out with clean outro music. |

---

## 🛠️ Step-by-Step Recording Guide for Shubham

To capture the footage in the storyboard, follow these instructions to set up the local developer environment and trigger specific states:

### 1. Developer Environment Setup
1. **Clone & Open Project**: Open the codebase workspace in your terminal or IDE.
2. **Launch the Backend**:
   * Navigate to `hvel-backend`
   * Set up your `.env` file with test database credentials and SMTP details.
   * Run: `npm install` followed by `npm run dev` (running on port `3000`).
3. **Launch the Website**:
   * Navigate to `hvel-website`
   * Run: `npm install` followed by `npm run dev` (running on port `3000` or port `5173`).
4. **Load the Extension in Chrome**:
   * Open Google Chrome and go to `chrome://extensions/`.
   * Enable **Developer Mode** (top-right toggle).
   * Click **Load unpacked** (top-left) and select the `hvel-extension` folder.
   * Note: The extension is now active and injected into Gmail pages.

---

### 2. How to Record Specific Product Scenarios

#### Scenario A: Composing a "Human Verified" Email (Scene 3 & 4)
* **Setup**: Open Gmail and click "Compose".
* **Visuals**: Look at the bottom toolbar. The green indicator `HVEL Tracking` should be visible.
* **Action**: Move the mouse naturally as you type out a subject and body. Click **Send**.
* **Result**: The button will turn into a spinner saying `"Verifying..."` for 200ms, then a toast saying `"Human Verified"` will slide in. Inspect the sent folder—the email will contain the green trust badge with a valid `Trust Record` link.

#### Scenario B: Triggering a "Robotic / AI Sender" Badging (Scene 5)
* **Setup**: Open Gmail and click "Compose".
* **Visuals**: Type your message.
* **Action**: To trigger the bot detection algorithm, the mouse tracking buffer needs to be perfectly linear or stationary. 
  * *Option 1*: Send the email using the keyboard shortcut (`Ctrl + Enter` / `Cmd + Enter`) without moving your mouse at all.
  * *Option 2*: Use the browser console to trigger the click programmatically:
    ```javascript
    document.querySelector('div[role="button"][data-tooltip*="Send"]').click();
    ```
* **Result**: The algorithm inside `verifyHumanBehavior()` in `hvel-backend/index.js` will catch the zero-variance speed or linear trajectory, label the sender as `robotic`, and inject the red **Robotic / AI Sender** badge.

#### Scenario C: Displaying the Plan Limit Modal (Scene 7)
* **Setup**: You want to trigger the premium glassmorphic modal that prompts the user to upgrade to Pro.
* **Action**:
  * Set the daily limit for free users temporarily to `1` or `0` in `hvel-backend/index.js` (line 58).
  * Go to Gmail, compose an email, and click "Send".
* **Result**: The backend will return a `PLAN_LIMIT_REACHED` payload, and the extension will immediately display the premium glassmorphic modal blocking the email release. Record this beautiful window, highlighting the progress bar and Pro feature list.

#### Scenario D: Displaying the "Untrusted Sender" Overlay (Scene 5)
* **Setup**: Log in as a user who has Hvel active. Receive an email from a standard contact who does not have the Hvel extension installed.
* **Result**: Hvel scans the incoming message, finds no trust stamp, and overlays the orange-red banner `SECURITY ALERT: UNTRUSTED SENDER` at the top of the message body, alongside a diagonal `UNTRUSTED` watermark. Record the inbox view showing this alert.

#### Scenario E: Displaying the "TAMPERED" Identity Alert (Scene 6)
* **Setup**: Receive an email with a Hvel badge.
* **Action**: Copy the badge HTML from a valid email, change the verification ID in the URL to a random string (or modify the content hash in the email body), and send it to yourself.
* **Result**: The extension scans the email, queries the API with the verification ID, receives a mismatch result, and renders a bold red border saying `CRITICAL SECURITY ALERT: ID MISMATCH - Tampered Trust Stamp` alongside a large diagonal `TAMPERED` watermark.

---

## 🎵 Video Editing & Audio Assets Notes
* **Color Palette**: 
  * Emerald Green (`#10b981`) for Verified screens.
  * Deep Violet (`#4f46e5`) / Indigo for Hvel branding.
  * Amber/Orange (`#f59e0b`) for Untrusted states.
  * Crimson Red (`#ef4444`) for Tampered states.
* **UI Elements**: Ensure high zoom level on Chrome's interface during compose interactions so the glassmorphic toasts and toolbar badges are crisp and legible.
* **Captions**: Use stylish kinetic typography for on-screen text overlays matching the voiceover.
