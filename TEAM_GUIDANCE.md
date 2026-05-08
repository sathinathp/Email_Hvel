# 🛡️ HumanAttest: Complete Team Guidance & Project Blueprint

## 1. Project Vision
HumanAttest (HVEL) is a **Universal Human Verification Protocol**. It is designed to stop "Identity Mismatch" attacks and automated email fraud by requiring a **physical handshake** (2FA OTP) before a sender can release an email from their browser.

**The Goal:** Every email received with a HumanAttest Trust Stamp is guaranteed to have been sent by a verified human who was physically present at their device.

---

## 2. Architecture Overview
The project is split into three core repositories, working in a synchronized loop:

### A. HVEL Backend (The Brain)
*   **Role**: Handles the cryptographic heavy lifting and security gating.
*   **Key Logic**: 
    *   **24-Hour Reset Cycle**: Prevents notification spam by ensuring users/recipients only receive one nudge or security alert every 24 hours per unique thread.
    *   **Trust Portal**: Serves the hosted `/v/:id` pages where recipients can view the audit trail.
    *   **PostgreSQL**: Stores verification hashes and notification timestamps.

### B. HVEL Extension (The Shield)
*   **Role**: Native injection into the Gmail interface.
*   **Key Logic**:
    *   **Intercept Engine**: Listens for "Send" button clicks and blocks the action until a physical 2FA scan is completed.
    *   **Identity Guard**: If a sender switches their "From" email to one they aren't verified for, the extension triggers a **Security Alert** immediately.
    *   **Legacy Thread Handling**: If a sender joins the protocol *after* a conversation starts, the extension automatically recognizes them as verified for historical messages.

### C. HVEL Website (The Interface)
*   **Role**: Marketing, Documentation, and extension distribution.
*   **Key Logic**:
    *   **Dual-Track Workflow**: Visualizes the experience for both extension users and universal recipients.
    *   **Instant Sync Navbar**: Uses IntersectionObservers to track user focus and highlight sections accurately.

---

## 3. The Security Protocol (Step-by-Step)

### Phase 1: The Handshake (Sender Side)
1.  **Intercept**: User clicks "Send" in Gmail.
2.  **Handshake**: HVEL blocks the send. A popup requests a 2FA OTP from Google Authenticator.
3.  **Sign**: Upon correct OTP, the extension generates a unique SHA-256 hash of the verification event.
4.  **Release**: The email is released. The hash is sent to the backend for logging.

### Phase 2: The Verification (Recipient Side)
1.  **Trust Stamp**: Recipient (even without the extension) sees a professional HVEL Trust Stamp in the email footer.
2.  **Audit**: Recipient clicks the stamp and is taken to our secure portal to see the time, date, and "Proof of Humanity" status.
3.  **Nudge**: If the recipient replies with an unverified email, they receive a polite nudge to join the protocol.

---

## 4. Technical deep-dive: 24-Hour Gate
To ensure a premium user experience, we implemented a **24-hour notification gate**.
*   **Implementation**: In `hvel-backend/index.js`, every nudge and alert uses an `ON CONFLICT` SQL trigger.
*   **Logic**: If an alert was sent < 24 hours ago, the request is ignored. If > 24 hours, the timestamp is updated and a new email is sent.
*   **Extension Sync**: The extension also stores these timestamps in `chrome.storage.local` to prevent duplicate UI alerts across different tabs.

---

## 5. Developer Setup Guide

### Prerequisites
*   Node.js (v18+)
*   PostgreSQL
*   `ngrok` (for local tunneling)

### Steps for the Team
1.  **Clone all folders**: Ensure `hvel-backend`, `hvel-extension`, and `hvel-website` are in the same parent directory.
2.  **Initialize Database**: Run the provided SQL schema to create `verifications`, `nudge_log`, and `security_alert_log` tables.
3.  **Start Backend**: 
    ```bash
    cd hvel-backend && npm install && npm run dev
    ```
4.  **Start Website**: 
    ```bash
    cd hvel-website && npm install && npm run dev
    ```
5.  **Load Extension**: Open `chrome://extensions`, enable Developer Mode, and "Load Unpacked" the `hvel-extension` folder.

---

## 6. Branding Guidelines
*   **Logo**: Always use the provided `logo.png`.
*   **Colors**: Use the HVEL Blue (`#2563EB`) for primary actions and HVEL Emerald (`#059669`) for verified states.
*   **Tone**: The language should be "Zero-Trust" but "User-Friendly." Avoid overly technical jargon when communicating with recipients.

---

## 7. Future Roadmap
1.  **Chrome Web Store**: Move from unpacked loading to official store distribution.
2.  **Native Mobile Hooks**: Expanding the protocol to the Gmail mobile app.
3.  **Enterprise Dashboard**: A portal for companies to see their "Humanity Score" across all employee communications.

---

*This document is maintained by the HumanAttest Development Team. Last updated: May 2026.*
