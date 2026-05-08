# HumanAttest (HVEL): Universal Human Verification Protocol

HumanAttest is a robust, zero-trust authentication ecosystem designed to ensure "Proof of Humanity" for secure digital communications. It eliminates session hijacking and bot-driven emails through mandatory physical intent verification via 2FA OTP, specifically tailored for seamless Gmail integration.

![HumanAttest Logo](logo.png)

## 🚀 Overview

The ecosystem provides a unified security layer across three primary tiers:

1.  **HVEL Backend (Core)**: A Node.js API managing cryptographic audit logs, 2FA pairing via QR codes, and server-side security gates with a 24-hour reset cycle.
2.  **HVEL Extension (Shield)**: A Chrome extension that natively intercepts Gmail send actions, enforcing 2FA verification before any data leaves the browser.
3.  **HVEL Website (Landing)**: A premium Next.js platform providing a dual-track workflow for both verified senders and universal recipients.

## ✨ Key Features

- **2FA Physical Intent Verification**: Replaces traditional passwords with a mandatory QR/OTP scan using Google Authenticator, ensuring a physical human presence for every sensitive send.
- **24-Hour Security Gate**: An intelligent reset cycle for security nudges and alerts, preventing spam while ensuring continuous re-verification.
- **Universal Trust Stamp**: Recipients see a professional "HVEL Trust Stamp" embedded in emails. Clicking it reveals a cryptographic audit trail hosted on our secure verification portal.
- **Legacy Verification Protection**: Automatically recognizes senders who join the protocol after a thread has started, protecting historical communications from being flagged.
- **Zero-Storage Privacy**: HVEL never reads or stores email content. We only log a one-time SHA-256 hash of the verification event for auditing purposes.

## 🛠️ Project Structure

```text
HVEL/
├── hvel-website/      # Next.js Frontend (Marketing & Docs)
├── hvel-backend/      # Node.js Express server (Security API)
│   ├── index.js       # Main logic & PostgreSQL integration
│   └── public/        # Trust Record & Auth portals
├── hvel-extension/    # Chrome Extension (Gmail Hook)
│   ├── content.js     # Native Gmail UI injection & interception
│   └── background.js  # Verification state management
└── logo.png           # Unified Branding Asset
```

## ⚙️ Setup & Installation

### 1. Backend & Security API
1. Navigate to `hvel-backend` and run `npm install`.
2. Configure `.env` with your SMTP and Database credentials.
3. Start the server: `npm run dev`.

### 2. Website & Landing Page
1. Navigate to `hvel-website` and run `npm install`.
2. Start the dev server: `npm run dev`.
3. The platform will be available at `http://localhost:3000`.

### 3. Chrome Extension
1. Open `chrome://extensions/` and enable **Developer mode**.
2. Click **Load unpacked** and select the `hvel-extension` folder.
3. Pair your device using the QR code in the extension popup.

## 🛡️ The Workflow

### For Senders (Extension Required)
Installation → 2FA Pairing → Send Intercept → OTP Verification → Signed Email Release.

### For Recipients (Universal Support)
Visual Trust Recognition → One-Click Cryptographic Audit → Automatic Security Nudges for Unverified Replies.

## 📄 License

[MIT](LICENSE)
