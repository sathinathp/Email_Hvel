# HVEL: Human Verification & Email Lockdown

HVEL is a robust authentication ecosystem designed to ensure "Proof of Humanity" for secure communications. It combines biometric WebAuthn (Passkeys) with TOTP-based 2FA to create a phishing-resistant, human-only verification flow, specifically tailored for Gmail integration.

## 🚀 Overview

The system consists of two primary components:
1.  **HVEL Backend**: A Node.js API that manages user registration, WebAuthn challenges, and TOTP generation.
2.  **HVEL Extension**: A Chrome extension that integrates directly into the Gmail UI to enforce human verification before sensitive actions (like sending emails) are allowed.

## ✨ Features

- **Biometric Authentication**: Leverages WebAuthn for secure, platform-native biometric login (Fingerprint, Face ID, etc.).
- **Multi-Step Verification**: A professional UI flow that transitions from biometric checks to TOTP verification.
- **Gmail Integration**: Seamlessly blocks the "Send" button and compose interface until the user is verified.
- **Security Nudges**: Automatically sends invitation/trust alert emails to unverified recipients, promoting the HVEL ecosystem.
- **QR Code Setup**: Easy TOTP configuration with automatic QR code generation.

## 🛠️ Project Structure

```text
HVEL/
├── hvel-backend/      # Node.js Express server
│   ├── index.js       # Main API logic
│   └── public/        # Verification UI pages
├── hvel-extension/    # Chrome Extension
│   ├── manifest.json  # Extension configuration
│   ├── content.js     # Gmail DOM manipulation & logic
│   └── background.js  # Background service worker
└── HVEL_PROJECT_REPORT.md # Detailed implementation report
```

## ⚙️ Setup & Installation

### Backend
1. Navigate to the `hvel-backend` directory.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create a `.env` file with the following variables:
   ```env
   PORT=3000
   RP_ID=localhost
   RP_NAME="HVEL"
   ORIGIN=http://localhost:3000
   SMTP_HOST=your_smtp_host
   SMTP_USER=your_email
   SMTP_PASS=your_password
   ```
4. Start the server:
   ```bash
   npm start
   ```

### Extension
1. Open Chrome and navigate to `chrome://extensions/`.
2. Enable **Developer mode**.
3. Click **Load unpacked** and select the `hvel-extension` folder.
4. Ensure the extension is communicating with your backend URL (configurable in `content.js`).

## 🛡️ Security

HVEL is built on the principle of **Mandatory Human Intervention**. By requiring physical biometric presence and a time-based token, it effectively prevents automated bots or AI systems from hijacking communication flows.

## 📄 License

[MIT](LICENSE)
