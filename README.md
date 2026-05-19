# HumanAttest (HVEL): Universal Human Verification Protocol

HumanAttest is a robust, zero-trust authentication ecosystem designed to ensure "Proof of Humanity" for secure digital communications. It eliminates session hijacking and bot-driven emails through mandatory physical intent verification and behavioral mouse-tracking analysis, specifically tailored for seamless Gmail integration.

![HumanAttest Logo](logo.png)

## 🚀 Overview

The ecosystem provides a unified security layer across three primary tiers:

1.  **HVEL Backend (Core)**: A Node.js API managing cryptographic audit logs, 2FA pairing via QR codes, mouse behavior bot-detection, and server-side security gates with intelligent reset cycles.
2.  **HVEL Extension (Shield)**: A Chrome extension that natively intercepts Gmail send actions, analyzes mouse trajectories to detect bots, computes content hashes, and enforces verification before any data leaves the browser. It also scans incoming emails to validate trust stamps.
3.  **HVEL Website (Landing)**: A premium Next.js platform providing a dual-track workflow for both verified senders and universal recipients.

## ✨ Key Features

- **Proof of Humanity (Mouse Tracking)**: Analyzes cursor movement, velocity, and jitter when clicking the "Send" button to mathematically detect and block automated scripts or robotic senders.
- **Content Tamper Protection**: Computes a SHA-256 hash of the email body and stores it in the trust record, ensuring the message was not modified in transit.
- **Universal Trust Stamp & Badges**: Senders append a cryptographic "HVEL Trust Stamp". Recipients see visual UI badges (Verified Human, Unverified, or Tampered) injected directly into their Gmail interface.
- **Intelligent Security Nudges**: Automatically sends polite warning emails to unverified senders who reply to a verified user, guiding them to install the extension.
- **Automated Tamper Alerts**: If a recipient receives an email with a copied or mismatched trust stamp, both the recipient and the sender are immediately alerted.
- **Zero-Storage Privacy**: HVEL never reads or stores email content. We only log a one-time SHA-256 hash of the verification event for auditing purposes.

## 🛠️ Project Structure

```text
HVEL/
├── hvel-website/      # Next.js Frontend (Marketing & Docs)
├── hvel-backend/      # Node.js Express server (Security API)
│   ├── index.js       # Main logic, PostgreSQL, & Bot Detection
│   └── public/        # Trust Record & Auth portals
├── hvel-extension/    # Chrome Extension (Gmail Hook)
│   ├── content.js     # Native Gmail UI injection, mouse tracking & interception
│   └── background.js  # Verification state & API communication
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

## 🛡️ The Complete Workflow

### 1. Sending an Email (Proof of Humanity)
1. **Mouse Tracking**: As you compose an email, the extension silently tracks your mouse trajectory.
2. **Send Intercept**: When you click "Send", the click is intercepted. The extension computes a SHA-256 hash of the email body and sends your mouse data to the backend.
3. **Bot Detection**: The backend analyzes the mouse data. If it detects a human, it creates a "Human Verified" trust record. If it detects perfect robotic movement, it flags it as a "Robotic / AI Sender".
4. **Stamp Injection**: The extension injects the appropriate Trust Stamp badge (Green for human, Red for robotic) and the content hash into the email body.
5. **Dispatch & Invite**: The email is sent. If the recipient is new to HVEL, they receive a one-time automated invite explaining the Human Verified Email they just received.

### 2. Receiving an Email (Inbox Protection)
1. **Passive Scanning**: The extension scans your inbox for incoming emails containing HVEL Trust Stamps.
2. **Cryptographic Validation**: It checks the stamp ID against the backend.
3. **Visual UI Injection**:
   - **Verified**: A green "Verified Human" banner is injected into the email UI.
   - **Unverified**: A warning banner is injected if the sender is not verified.
   - **Tampered**: If the stamp doesn't belong to the sender (e.g., copied), a red pulsing "CRITICAL SECURITY ALERT" and a "TAMPERED" watermark are injected.
4. **Automated Alerts**: If an email is tampered with, the backend immediately sends a security alert email to both you and the attacker. If an unverified sender replies to your verified email, they receive an automated "Nudge" email instructing them to install HVEL.

## 📄 License

[MIT](LICENSE)
