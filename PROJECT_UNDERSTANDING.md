# 🛡️ HumanAttest: Complete Team Guidance & Project Blueprint

## 1. Project Vision
HumanAttest (HVEL) is a **Universal Human Verification Protocol**. It is designed to stop "Identity Mismatch" attacks and automated email fraud by requiring a **Proof of Humanity** (behavioral mouse-tracking analysis and physical intent verification) before a sender can release an email from their browser.

**The Goal:** Every email received with a HumanAttest Trust Stamp is guaranteed to have been sent by a verified human, with mathematically validated interactions, protecting against AI scripts and automated bots.

---

## 2. Architecture Overview
The project is split into three core repositories, working in a synchronized loop:

### A. HVEL Backend (The Brain)
*   **Role**: Handles the cryptographic heavy lifting, bot detection, and security gating.
*   **Key Logic**: 
    *   **Bot Detection Analyzer**: Processes mouse trajectory, velocity, and jitter to differentiate between humans and robots.
    *   **24-Hour Reset Cycle**: Prevents notification spam by ensuring users/recipients only receive one nudge or security alert every 24 hours per unique thread.
    *   **Trust Portal**: Serves the hosted `/v/:id` pages where recipients can view the audit trail.
    *   **PostgreSQL**: Stores verification hashes, sender/recipient records, and notification timestamps.

### B. HVEL Extension (The Shield)
*   **Role**: Native injection into the Gmail interface.
*   **Key Logic**:
    *   **Intercept & Tracker Engine**: Silently records mouse movements and intercepts "Send" button clicks to initiate humanity checks.
    *   **Content Hashing**: Computes a SHA-256 hash of the email body to ensure it hasn't been tampered with.
    *   **Identity Guard & Validation**: Scans incoming emails, validates Trust Stamps, and triggers **Security Alerts** if a tampered ID is detected.
    *   **UI Injection**: Displays premium glassmorphic toast notifications and inline "Verified Human" or "Robotic" badges directly inside Gmail.

### C. HVEL Website (The Interface)
*   **Role**: Marketing, Documentation, and extension distribution.
*   **Key Logic**:
    *   **Dual-Track Workflow**: Visualizes the experience for both extension users and universal recipients.
    *   **Instant Sync Navbar**: Uses IntersectionObservers to track user focus and highlight sections accurately.

---

## 3. The Security Protocol (Step-by-Step)

### Phase 1: Proof of Humanity (Sender Side)
1.  **Passive Tracking**: User composes an email while the extension monitors mouse trajectories.
2.  **Intercept**: User clicks "Send" in Gmail. HVEL intercepts the click and displays a "Verifying..." spinner.
3.  **Analysis**: The extension hashes the email content and sends it along with the mouse data to the backend. The backend's AI detection algorithm checks for human intent.
4.  **Stamp Injection**: Based on the result, a green "Verified Human" or red "Robotic Sender" badge is injected into the email body, along with the cryptographic Trust Stamp.
5.  **Release**: The email is finally released and sent to the recipient.

### Phase 2: Inbox Protection (Recipient Side)
1.  **Passive Scanning**: When an email arrives, the extension scans the inbox for HVEL Trust Stamps.
2.  **Validation**: The extension checks the stamp ID against the backend.
3.  **UI Feedback**:
    *   **Valid**: A green banner confirms the sender is verified.
    *   **Tampered**: If the stamp was copied, a red "TAMPERED" watermark and critical security alert are injected, triggering warning emails to both parties.
    *   **Unverified**: If no stamp exists but the recipient is verified, they receive an "Untrusted" warning.
4.  **Nudge**: If an unverified sender replies to a verified user, they receive a polite automated nudge to join the protocol.

---

## 4. Detailed File Directory & Responsibilities

### A. hvel-backend/
*   **`index.js`**: The core engine. Contains all Express routes, PostgreSQL logic, SMTP email configuration, the Bot Detection analyzer, and the **24-hour gating logic** for nudges/alerts.
*   **`public/auth.html`**: The user-facing portal for identity registration.
*   **`public/trust_record.html`**: The dynamic template served to recipients when they verify a cryptographic hash.
*   **`public/hvel-extension.zip`**: The packaged extension available for direct download.
*   **`.env`**: (Sensitive) Contains SMTP credentials, DB connection strings, and the `RP_ID` for authentication.

### B. hvel-extension/
*   **`manifest.json`**: Defines permissions for Gmail (`https://mail.google.com/*`) and declares the background service worker.
*   **`content.js`**: The most critical file. It scans the Gmail DOM, tracks mouse data, intercepts the "Send" button, computes content hashes, manages local storage for the 24h gate, and injects the trust badges and premium toasts.
*   **`background.js`**: Acts as a bridge between the content script and the backend API, handling verification state.

### C. hvel-website/ (Next.js)
*   **`src/app/page.tsx`**: The main high-fidelity landing page. Contains the protocol descriptions, workflow tracks, and inbox mockups.
*   **`src/components/Navbar.tsx`**: Implements the advanced `IntersectionObserver` logic for scroll-sync highlighting.
*   **`src/lib/constants.ts`**: The single source of truth for global URLs (Backend API, Extension Download Link).
*   **`public/logo.png`**: The master branding asset used across the entire ecosystem.

---

## 5. Technical deep-dive: 24-Hour Gate & Security Locks
To ensure a premium user experience and prevent spam, we implemented a **24-hour notification gate**.
*   **Implementation**: In `hvel-backend/index.js`, every nudge and alert uses an atomic `ON CONFLICT` SQL trigger.
*   **Logic**: If an alert or nudge was sent < 24 hours ago, the request is ignored. If > 24 hours, the timestamp is updated and a new email is sent.
*   **Extension Sync**: The extension also uses `Set` structures (`pendingRequests`) and local storage timestamps to prevent race conditions and duplicate API calls when multiple emails are scanned simultaneously.

---

## 6. Developer Setup Guide

### Prerequisites
*   Node.js (v18+)
*   PostgreSQL

### Steps for the Team
1.  **Clone all folders**: Ensure `hvel-backend`, `hvel-extension`, and `hvel-website` are in the same parent directory.
2.  **Initialize Database**: The backend `initDB()` runs automatically to ensure all tables exist (`verifications`, `nudge_log`, `security_alert_log`, etc.).
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

## 7. Branding Guidelines
*   **Logo**: Always use the provided `logo.png`.
*   **Colors**: Use the HVEL Blue (`#4f46e5`) for primary actions, HVEL Emerald (`#10b981`) for verified states, and Red (`#ef4444`) for tampered/robotic states.
*   **Tone**: The language should be "Zero-Trust" but "User-Friendly." Avoid overly technical jargon when communicating with recipients.

---

## 8. Future Roadmap
1.  **Chrome Web Store**: Move from unpacked loading to official store distribution.
2.  **Native Mobile Hooks**: Expanding the protocol to the Gmail mobile app.
3.  **Enterprise Dashboard**: A portal for companies to see their "Humanity Score" across all employee communications.

---

*This document is maintained by the HumanAttest Development Team. Last updated: May 2026.*
