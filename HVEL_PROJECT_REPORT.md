# Executive Project Report: Human Verified Email Layer (HVEL)

## 1. Project Overview
**HVEL** is a "Trust-as-a-Service" layer for Gmail that ensures professional communication is backed by verified human identity. By requiring a cryptographic handshake (Passkeys/Biometrics) and injecting a tamper-proof digital stamp, HVEL helps senders bypass the "AI Spam Filter" and proves to recipients that the message is authentic and intentionally sent.

## 2. The Core Problem: The AI Spam Crisis
In the age of generative AI, automated bots can send millions of high-quality emails that look perfectly human. This has led to:
*   **Trust Deficit:** Recipients treat every stranger's email as potential AI spam.
*   **Security Gaps:** Traditional email signatures can be easily copied and forged (The "Copy-Paste" Fraud).
*   **Engagement Friction:** Legitimate outreach is lost in the noise of automated "bot" lists.

## 3. The HVEL Solution: Verified Session Auth
Instead of passive signatures, HVEL introduces **Active Verification** via a multi-layered security protocol:
1.  **Session Lock:** A security timer that requires the sender to "check-in" (default every 60 minutes).
2.  **Dual-Layer Multi-Factor Authentication (MFA):**
    *   **Phase 1 (Biometric):** Proof of physical presence via WebAuthn (Passkeys/Fingerprint/FaceID).
    *   **Phase 2 (Knowledge):** 6-digit TOTP (Google Authenticator) verification.
3.  **Dynamic Stamp Injection:** A live-generated certification badge added directly to the email body at the time of sending.

---

## 4. System Workflow: The Proof of Humanity Flow
The HVEL implementation follows a strict "Zero-Trust" sender protocol to ensure 100% human authenticity.

### Phase 1: The Compose Intercept
*   **Event:** A user opens a "Compose" window or draft in Gmail.
*   **Blocking Logic:** The HVEL Chrome Extension detects the "Send" button and immediate applies a "Locked" state (grayscale, pointer-events: none) if the current session is unverified.
*   **UI Trigger:** A high-end verification modal automatically pops up, requiring the user to prove their identity before they can send any email.

### Phase 2: The Multi-Step Handshake
*   **Step 1: Physical Identity Proof (WebAuthn):**
    *   The user clicks **"Start Biometric Check"**.
    *   A secure auth popup (localhost:3000) triggers a WebAuthn challenge.
    *   The user provides a biometric signal (Fingerprint or FaceID) or a hardware key.
*   **Step 2: 2FA Authentication (TOTP):**
    *   Upon biometric success, the modal shifts to the TOTP challenge.
    *   The user enters a 6-digit code from their **Authenticator App**.
*   **Result:** A verified session token is granted to the extension, and the Gmail "Send" button is unlocked.

### Phase 3: Digital DNA Injection (Content Integrity)
To prevent "Bait and Switch" fraud, the system executes a final security check:
*   **SHA-256 Hashing:** When the user clicks the "Verify" badge button, HVEL creates a cryptographic hash of the *entire* email text.
*   **Uniquie Record ID:** A global trust record is created in the PostgreSQL backend, linking the Content Hash, Sender, and Recipient.
*   **Tamper-Proof Badge:** A visual badge is injected into the email. If the recipient's extension detects that even one character in the email body has changed compared to the hash, it flags the email as **"TAMPERED."**

### Phase 4: Viral Growth & Recipient Validation
*   **Direct Validation:** The recipient's extension automatically validates the "Trust Record" against the backend API.
*   **Trust Alerts (The Nudge):** If a user receives a reply from someone *without* HVEL, the system automatically triggers a "Trust Alert" nudge email (sent via a dedicated SMTP account) informing the sender that their reply lacked a trust signal and providing a download link for the extension.

---

## 5. Security Protocols & Technical Architecture
| Feature | Security Purpose | Technical Implementation |
| :--- | :--- | :--- |
| **Identity Proof** | Prevents account hijacking. | WebAuthn (Passkeys) + TOTP (Speakeasy). |
| **Anti-Impersonation** | Stops "Copy-Paste" fraud. | Unique ID lookup in PostgreSQL + Recipient Matching. |
| **Content Integrity** | Stops "Bait & Switch" edits. | SHA-256 hashing of draft body via Web Crypto API. |
| **Viral Nudge** | Drives network trust. | Automated SMTP triggers via Nodemailer (Dedicated HRMS account). |

---

## 6. Advantages & Value Proposition
*   **Proof of Intent:** Recipients know the email required deliberate human effort (Biometric + 2FA), making it nearly impossible for bots to replicate.
*   **Phishing Resistance:** WebAuthn is inherently phishing-resistant, protecting the sender's account even if they are targeted.
*   **Network Effect:** Every verified email acts as a trust signal, inviting recipients to join the secure HVEL network.
*   **Session-Based Security:** The session expiry ensures that even if a computer is left unattended, the "Human Verified" status cannot be misused.

## 7. Drawbacks & System Constraints
*   **High Friction:** The 2-step verification is an intentional hurdle; while secure, it adds time to the initial send.
*   **Environment Specific:** Currently optimized for Chrome/Gmail; expansion to Outlook/Mobile is a roadmap item.
*   **Backend Dependent:** Requires low-latency access to the HVEL API for real-time validation.

---

## 8. Development Roadmap (The Next 1,000+ Miles)
*   **Phase 2:** Multi-Entity Support: Unified payroll and HRMS integration for corporate accounts.
*   **Phase 3:** Behavioral AI Scoring: Detecting headless browsers and automation tools at the extension level.
*   **Phase 4:** HVEL Public Audit Explorer: A transparency portal for verifying trust records without installing the extension.

---
**Prepared By:** HVEL Core Engineering Team  
**Status:** V2.0 - Biometric & Multi-Factor Integrated Flow
