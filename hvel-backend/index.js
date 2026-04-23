const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');
const nodemailer = require('nodemailer');
const speakeasy = require('speakeasy');
const qrcode = require('qrcode');
const {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} = require('@simplewebauthn/server');
const { isoUint8Array } = require('@simplewebauthn/server/helpers');
require('dotenv').config();

const RP_NAME = 'HVEL Security';
const RP_ID = process.env.RP_ID || 'localhost';
const ORIGIN = process.env.ORIGIN || `http://${RP_ID}:3000`;

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

app.get('/auth', (req, res) => {
  res.sendFile(__dirname + '/public/auth.html');
});

const net = require('net');
const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
  ssl: { rejectUnauthorized: false }
});

async function initDB() {
  const createTableQuery = `
    CREATE TABLE IF NOT EXISTS verifications (
      id VARCHAR(50) PRIMARY KEY,
      sender_email VARCHAR(255) NOT NULL,
      recipient_email VARCHAR(255),
      type VARCHAR(50) NOT NULL,
      content_hash VARCHAR(255),
      timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS otps (
      email VARCHAR(255) PRIMARY KEY,
      code VARCHAR(10) NOT NULL,
      expires_at TIMESTAMP NOT NULL
    );
    CREATE TABLE IF NOT EXISTS totp_secrets (
      email VARCHAR(255) PRIMARY KEY,
      secret VARCHAR(255) NOT NULL,
      is_verified BOOLEAN DEFAULT FALSE
    );
    CREATE TABLE IF NOT EXISTS passkeys (
      id SERIAL PRIMARY KEY,
      email VARCHAR(255) NOT NULL,
      cred_id TEXT NOT NULL UNIQUE,
      cred_public_key BYTEA NOT NULL,
      counter BIGINT NOT NULL,
      backup_eligible BOOLEAN NOT NULL,
      backup_status BOOLEAN NOT NULL,
      transports TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS challenges (
      email VARCHAR(255) PRIMARY KEY,
      challenge TEXT NOT NULL,
      expires_at TIMESTAMP NOT NULL
    );
    CREATE TABLE IF NOT EXISTS nudge_log (
      id SERIAL PRIMARY KEY,
      hvel_user VARCHAR(255) NOT NULL,
      no_extension_user VARCHAR(255) NOT NULL,
      nudge_sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS invite_log (
      id SERIAL PRIMARY KEY,
      sender_email VARCHAR(255) NOT NULL,
      recipient_email VARCHAR(255) NOT NULL,
      invite_sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;
  try {
    await pool.query(createTableQuery);
    const colCheck = await pool.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name='verifications' AND column_name='recipient_email'
    `);
    if (colCheck.rows.length === 0) {
      await pool.query('ALTER TABLE verifications ADD COLUMN recipient_email VARCHAR(255)');
    }
    console.log("Database tables ensured.");
  } catch (err) {
    console.error("Error creating tables:", err);
  }
}
initDB();

app.get('/health', (req, res) => res.json({ status: 'ok', message: 'HVEL Backend is running' }));
app.post('/api/heartbeat', (req, res) => res.json({ success: true }));

const mainTransporter = nodemailer.createTransport({
  service: 'gmail',
  auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
});
const hrmsTransporter = nodemailer.createTransport({
  service: 'gmail',
  auth: { user: process.env.EMAIL_USER, pass: process.env.HRMS_EMAIL_PASS }
});

if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
  mainTransporter.verify((error) => {
    if (error) console.error('[HVEL API] Main SMTP Error:', error);
    else console.log(`[HVEL API] ✅ Main SMTP ready — ${process.env.EMAIL_USER}`);
  });
}
if (process.env.HRMS_EMAIL_PASS) {
  hrmsTransporter.verify((error) => {
    if (error) console.error('[HVEL API] HRMS SMTP Error:', error);
    else console.log(`[HVEL API] ✅ HRMS SMTP ready — ${process.env.EMAIL_USER}`);
  });
}

// Shared domain/email block helper
const IGNORED_DOMAINS = [
  'vercel.com','google.com','microsoft.com','github.com','github.io',
  'aws.com','amazon.com','netflix.com','facebook.com','linkedin.com','twitter.com','x.com'
];
function isBlockedEmail(email) {
  if (!email || !email.includes('@')) return true;
  const domain = email.split('@')[1]?.toLowerCase();
  const internalEmails = [process.env.EMAIL_USER?.toLowerCase()].filter(Boolean);
  return internalEmails.includes(email.toLowerCase()) || IGNORED_DOMAINS.includes(domain);
}

// OTP endpoints
app.post('/api/request-otp', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required' });
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expires_at = new Date(Date.now() + 10 * 60 * 1000);
  try {
    await pool.query(`INSERT INTO otps (email, code, expires_at) VALUES ($1, $2, $3) ON CONFLICT (email) DO UPDATE SET code = $2, expires_at = $3`, [email, code, expires_at]);
    if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
      await mainTransporter.sendMail({ from: process.env.EMAIL_USER, to: email, subject: 'HVEL Verification Code', text: `Your HVEL verification code is: ${code}. Expires in 10 minutes.` });
      console.log(`OTP sent to ${email}`);
    }
    res.json({ success: true, message: 'OTP sent successfully' });
  } catch (err) { console.error('Error requesting OTP:', err); res.status(500).json({ error: 'Server error' }); }
});

app.post('/api/verify-otp', async (req, res) => {
  const { email, code } = req.body;
  if (!email || !code) return res.status(400).json({ error: 'Email and code are required' });
  try {
    const result = await pool.query('SELECT * FROM otps WHERE email = $1 AND code = $2 AND expires_at > NOW()', [email, code]);
    if (result.rows.length > 0) {
      await pool.query('DELETE FROM otps WHERE email = $1', [email]);
      res.json({ success: true });
    } else { res.status(401).json({ success: false, error: 'Invalid or expired code' }); }
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

// TOTP endpoints
app.post('/api/totp-setup', async (req, res) => {
  const { email, force } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required' });
  console.log(`[HVEL API] 🛠️ TOTP Setup Request - Email: ${email}, Force: ${force}`);
  try {
    const result = await pool.query('SELECT secret, is_verified FROM totp_secrets WHERE email = $1', [email]);
    let secret, is_verified = false;
    if (result.rows.length > 0 && !force) {
      secret = result.rows[0].secret; is_verified = result.rows[0].is_verified;
      console.log(`[HVEL API] Using existing secret for ${email}`);
    } else {
      const g = speakeasy.generateSecret({ length: 20, name: `HVEL (${email})`, issuer: 'HVEL' });
      secret = g.base32;
      if (result.rows.length > 0) await pool.query('UPDATE totp_secrets SET secret = $2, is_verified = FALSE WHERE email = $1', [email, secret]);
      else await pool.query('INSERT INTO totp_secrets (email, secret) VALUES ($1, $2)', [email, secret]);
    }
    const otpauth = `otpauth://totp/${encodeURIComponent(`HVEL:${email}`)}?secret=${secret}&issuer=HVEL`;
    console.log(`[HVEL API] Generating QR code for: ${otpauth}`);
    const imageUrl = await qrcode.toDataURL(otpauth);
    console.log(`[HVEL API] QR code generated (length: ${imageUrl.length})`);
    res.json({ success: true, alreadyExists: result.rows.length > 0, isVerified: is_verified, qrcode: imageUrl, secret });
  } catch (err) { console.error('[HVEL API] Error setting up TOTP:', err); res.status(500).json({ success: false, error: err.message }); }
});

app.post('/api/totp-verify', async (req, res) => {
  const { email, code } = req.body;
  if (!email || !code) return res.status(400).json({ error: 'Email and code are required' });
  try {
    const result = await pool.query('SELECT secret FROM totp_secrets WHERE email = $1', [email]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'TOTP not set up' });
    const isValid = speakeasy.totp.verify({ secret: result.rows[0].secret, encoding: 'base32', token: code, window: 1 });
    if (isValid) { await pool.query('UPDATE totp_secrets SET is_verified = TRUE WHERE email = $1', [email]); res.json({ success: true }); }
    else res.status(401).json({ success: false, error: 'Invalid authenticator code' });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

// Passkey endpoints
app.post('/api/passkey/register-options', async (req, res) => {
  const email = req.body.email?.toLowerCase();
  if (!email) return res.status(400).json({ error: 'Email is required' });
  try {
    const options = await generateRegistrationOptions({
      rpName: RP_NAME, rpID: RP_ID,
      userID: new Uint8Array(Buffer.from(email)).slice(0, 32),
      userName: email, timeout: 120000, attestationType: 'none', excludeCredentials: [],
      authenticatorSelection: { residentKey: 'discouraged', userVerification: 'discouraged' },
    });
    await pool.query('INSERT INTO challenges (email, challenge, expires_at) VALUES ($1, $2, $3) ON CONFLICT (email) DO UPDATE SET challenge = $2, expires_at = $3', [email, options.challenge, new Date(Date.now() + 10 * 60 * 1000)]);
    res.json(options);
  } catch (err) { console.error('Passkey Reg Options Error:', err); res.status(500).json({ error: 'Failed to generate registration options' }); }
});

app.post('/api/passkey/register-verify', async (req, res) => {
  const email = req.body.email?.toLowerCase();
  const { registrationResponse } = req.body;
  if (!email || !registrationResponse) return res.status(400).json({ error: 'Email and response are required' });
  try {
    console.log(`[PASSKEY] Verifying registration for ${email}...`);
    const challResult = await pool.query('SELECT challenge FROM challenges WHERE email = $1 AND expires_at > NOW()', [email]);
    if (challResult.rows.length === 0) return res.status(400).json({ error: 'Challenge expired or not found' });
    let verification;
    try {
      verification = await verifyRegistrationResponse({ response: registrationResponse, expectedChallenge: challResult.rows[0].challenge, expectedOrigin: ORIGIN, expectedRPID: RP_ID });
    } catch (vErr) { return res.status(400).json({ error: 'Verification failed: ' + vErr.message }); }
    if (verification.verified && verification.registrationInfo) {
      const { credential, credentialDeviceType, credentialBackedUp } = verification.registrationInfo;
      const { id, publicKey, counter, transports } = credential;
      await pool.query('DELETE FROM passkeys WHERE email = $1', [email]);
      await pool.query(`INSERT INTO passkeys (email, cred_id, cred_public_key, counter, backup_eligible, backup_status, transports) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [email, id, Buffer.from(publicKey), counter, credentialDeviceType === 'multiDevice', credentialBackedUp, JSON.stringify(transports || [])]);
      console.log(`[PASSKEY] Registration SUCCESS for ${email}`);
      res.json({ success: true });
    } else res.status(400).json({ error: 'Registration verification failed' });
  } catch (err) { console.error('Passkey Verify Error:', err); res.status(500).json({ error: 'Server error' }); }
});

app.post('/api/passkey/login-options', async (req, res) => {
  const email = req.body.email?.toLowerCase();
  if (!email) return res.status(400).json({ error: 'Email is required' });
  try {
    const result = await pool.query('SELECT cred_id, transports FROM passkeys WHERE email = $1', [email]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'No passkeys found' });
    const options = await generateAuthenticationOptions({
      rpID: RP_ID,
      allowCredentials: result.rows.map(r => ({ id: r.cred_id, type: 'public-key', transports: r.transports ? JSON.parse(r.transports) : undefined })),
      userVerification: 'required',
    });
    await pool.query('INSERT INTO challenges (email, challenge, expires_at) VALUES ($1, $2, $3) ON CONFLICT (email) DO UPDATE SET challenge = $2, expires_at = $3', [email, options.challenge, new Date(Date.now() + 10 * 60 * 1000)]);
    res.json(options);
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

app.post('/api/passkey/login-verify', async (req, res) => {
  const email = req.body.email?.toLowerCase();
  const { authResponse } = req.body;
  if (!email || !authResponse) return res.status(400).json({ error: 'Email and response are required' });
  try {
    const challResult = await pool.query('SELECT challenge FROM challenges WHERE email = $1 AND expires_at > NOW()', [email]);
    if (challResult.rows.length === 0) return res.status(400).json({ error: 'Challenge expired' });
    const passkeyResult = await pool.query('SELECT * FROM passkeys WHERE cred_id = $1', [authResponse.id]);
    if (passkeyResult.rows.length === 0) return res.status(404).json({ error: 'Passkey not found' });
    const passkey = passkeyResult.rows[0];
    console.log(`[PASSKEY] Found key in DB: ID=${passkey.cred_id}, Counter=${passkey.counter}`);
    let verification;
    try {
      verification = await verifyAuthenticationResponse({
        response: authResponse, expectedChallenge: challResult.rows[0].challenge,
        expectedOrigin: ORIGIN, expectedRPID: RP_ID,
        credential: { id: passkey.cred_id, publicKey: new Uint8Array(passkey.cred_public_key), counter: Number(passkey.counter) },
        requireUserVerification: true,
      });
    } catch (vErr) { return res.status(400).json({ error: 'Verification failed: ' + vErr.message }); }
    if (verification.verified) {
      console.log(`[PASSKEY] Authentication SUCCESS for ${email}`);
      await pool.query('UPDATE passkeys SET counter = $1 WHERE cred_id = $2', [verification.authenticationInfo.newCounter, passkey.cred_id]);
      await pool.query('DELETE FROM challenges WHERE email = $1', [email]);
      res.json({ success: true });
    } else res.status(400).json({ error: 'Authentication failed' });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

// ─────────────────────────────────────────────────────────────────────────────
// /api/verify — Save verification record + send one-time invite email
// ─────────────────────────────────────────────────────────────────────────────
app.post('/api/verify', async (req, res) => {
  const { senderEmail, recipientEmail, type, contentHash } = req.body;
  if (!senderEmail || !type) return res.status(400).json({ error: 'senderEmail and type are required' });

  const verificationId = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  try {
    const result = await pool.query(
      `INSERT INTO verifications (id, sender_email, recipient_email, type, content_hash) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [verificationId, senderEmail, recipientEmail || null, type, contentHash || null]
    );
    const verificationUrl = `${ORIGIN}/v/${verificationId}`;

    // Send invite email — only once per sender→recipient pair
    if (recipientEmail && !isBlockedEmail(recipientEmail) &&
        senderEmail.toLowerCase() !== recipientEmail.toLowerCase() &&
        process.env.EMAIL_USER && process.env.EMAIL_PASS) {

      const alreadyInvited = await pool.query(
        `SELECT id FROM invite_log WHERE LOWER(sender_email) = LOWER($1) AND LOWER(recipient_email) = LOWER($2) LIMIT 1`,
        [senderEmail, recipientEmail]
      );

      if (alreadyInvited.rows.length === 0) {
        const inviteHtml = `
          <div style="font-family:'Segoe UI',Arial,sans-serif;color:#1f2937;max-width:580px;margin:0 auto;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">
            <div style="background:linear-gradient(135deg,#10b981,#059669);padding:28px 30px;">
              <h2 style="margin:0;color:white;font-size:20px;font-weight:700;">✅ Human Verified Email Received</h2>
              <p style="margin:6px 0 0;color:rgba(255,255,255,0.85);font-size:13px;">HVEL — Human Verified Email Layer</p>
            </div>
            <div style="padding:28px 30px;">
              <p style="margin:0 0 16px;font-size:15px;">Hello,</p>
              <p style="margin:0 0 16px;font-size:14px;line-height:1.6;">You have just received an email from <strong>${senderEmail}</strong> that has been <strong>Human Verified</strong> via the HVEL Security Layer.</p>
              <p style="margin:0 0 16px;font-size:14px;line-height:1.6;">HVEL ensures the sender completed a 2FA identity check and that the message content has not been tampered with by AI bots or malicious scripts.</p>
              <div style="background:#f0fdf4;border-left:4px solid #10b981;border-radius:8px;padding:14px 16px;margin:0 0 20px;">
                <p style="margin:0;font-size:13px;font-weight:600;color:#065f46;">Why did you receive this?</p>
                <p style="margin:6px 0 0;font-size:13px;color:#047857;line-height:1.5;">The sender is using HVEL to protect your inbox from AI spam and phishing.</p>
              </div>
              <p style="margin:0 0 12px;font-size:14px;line-height:1.6;">To verify your own emails and earn the <strong>✅ Human Verified</strong> trust badge, download the free HVEL Chrome extension:</p>
              <div style="text-align:center;margin:20px 0;">
                <a href="https://hvel-backend.onrender.com/hvel-extension.zip" style="display:inline-block;background:#6366f1;color:white;padding:13px 32px;text-decoration:none;border-radius:8px;font-weight:700;font-size:14px;">Download HVEL Extension — Free</a>
              </div>
            </div>
            <div style="background:#f9fafb;padding:16px 30px;border-top:1px solid #e5e7eb;">
              <p style="margin:0;font-size:11px;color:#9ca3af;line-height:1.6;">Verification ID: <strong>${verificationId}</strong><br/>Learn more at <a href="https://hvel.io" style="color:#6366f1;">hvel.io</a></p>
            </div>
          </div>`;

        mainTransporter.sendMail({
          from: `"HVEL Security" <${process.env.EMAIL_USER}>`,
          to: recipientEmail,
          subject: `✅ Human Verified Email Received from ${senderEmail}`,
          html: inviteHtml
        }, async (err) => {
          if (err) { console.error("[HVEL API] ❌ Invite email error:", err); }
          else {
            console.log(`[HVEL API] ✅ Invite sent to ${recipientEmail} from ${senderEmail}`);
            await pool.query(`INSERT INTO invite_log (sender_email, recipient_email) VALUES ($1, $2)`, [senderEmail.toLowerCase(), recipientEmail.toLowerCase()]);
          }
        });
      } else {
        console.log(`[HVEL API] ⏭️ Invite skipped — already sent to ${recipientEmail} from ${senderEmail}`);
      }
    }

    res.status(201).json({ success: true, data: { record: result.rows[0], verificationUrl } });
  } catch (err) { console.error("Error saving verification:", err); res.status(500).json({ error: 'Database error' }); }
});

// /api/validate
app.post('/api/validate', async (req, res) => {
  const { id, senderEmail, recipientEmail } = req.body;
  if (!id) return res.status(400).json({ error: 'Verification ID is required' });
  try {
    const result = await pool.query('SELECT * FROM verifications WHERE id = $1', [id]);
    const record = result.rows[0];
    if (!record) return res.json({ status: 'invalid', message: 'Verification record not found' });
    const senderMatch = record.sender_email.toLowerCase() === senderEmail?.toLowerCase();
    const recipientMatch = !record.recipient_email || record.recipient_email.toLowerCase() === recipientEmail?.toLowerCase();
    if (senderMatch && recipientMatch) return res.json({ status: 'verified', type: record.type, timestamp: record.timestamp });
    else return res.json({ status: 'tampered', message: 'Security Alert: ID mismatch.' });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

// ─────────────────────────────────────────────────────────────────────────────
// /api/notify-unverified-reply — Send nudge email when non-extension user replies
// GATE: Only sends if extension user previously sent a verified email to them
// ─────────────────────────────────────────────────────────────────────────────
app.post('/api/notify-unverified-reply', async (req, res) => {
  const hvelUserEmail  = (req.body.hvelUserEmail  || req.body.senderEmail   || '').trim().toLowerCase();
  const noExtUserEmail = (req.body.noExtensionEmail || req.body.recipientEmail || '').trim().toLowerCase();

  console.log('----------------------------------------------------------------');
  console.log(`[HVEL API] 📥 Nudge Request — ext-user: ${hvelUserEmail} | target: ${noExtUserEmail}`);
  console.log('----------------------------------------------------------------');

  if (!hvelUserEmail || !noExtUserEmail) return res.status(400).json({ error: 'hvelUserEmail and noExtensionEmail are required' });
  if (!noExtUserEmail.includes('@') || noExtUserEmail === 'unknown-sender@gmail.com') return res.status(400).json({ success: false, message: 'Invalid recipient email' });
  if (isBlockedEmail(noExtUserEmail)) { console.log(`[HVEL API] ⛔ Blocked — whitelisted: ${noExtUserEmail}`); return res.status(200).json({ success: false, message: 'Ignored' }); }
  if (hvelUserEmail === noExtUserEmail) { console.log(`[HVEL API] ⛔ Self-nudge blocked`); return res.status(200).json({ success: false, message: 'Ignored: self-nudge' }); }

  // Gate: confirm prior verified email exists
  try {
    const priorVerified = await pool.query(
      `SELECT id FROM verifications WHERE LOWER(sender_email) = $1 AND LOWER(recipient_email) = $2 LIMIT 1`,
      [hvelUserEmail, noExtUserEmail]
    );
    if (priorVerified.rows.length === 0) {
      console.log(`[HVEL API] ⛔ No prior verified email from ${hvelUserEmail} to ${noExtUserEmail}`);
      return res.status(200).json({ success: false, message: 'Ignored: no prior verified email' });
    }
  } catch (err) { return res.status(500).json({ error: 'Server error during gate check' }); }

  if (!process.env.HRMS_EMAIL_PASS) return res.status(503).json({ error: 'HRMS email not configured' });

  try {
    const nudgeHtml = `
      <div style="font-family:'Segoe UI',Arial,sans-serif;color:#1f2937;max-width:580px;margin:0 auto;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">
        <div style="background:linear-gradient(135deg,#6366f1,#4f46e5);padding:28px 30px;">
          <h2 style="margin:0;color:white;font-size:20px;font-weight:700;">⚠️ You Sent an Email Without Verification</h2>
          <p style="margin:6px 0 0;color:rgba(255,255,255,0.85);font-size:13px;">HVEL — Human Verified Email Layer</p>
        </div>
        <div style="padding:28px 30px;">
          <p style="margin:0 0 16px;font-size:15px;">Hello,</p>
          <p style="margin:0 0 16px;font-size:14px;line-height:1.6;">You recently sent an email to <strong>${hvelUserEmail}</strong>.<br/>That person uses <strong>HVEL</strong> — a security layer that ensures emails come from verified humans, not bots or AI.</p>
          <div style="background:#fef3c7;border-left:4px solid #f59e0b;border-radius:8px;padding:14px 16px;margin:0 0 20px;">
            <p style="margin:0;font-size:13px;font-weight:600;color:#92400e;">⚠️ Your email did not carry an HVEL Human Verification badge.</p>
            <p style="margin:6px 0 0;font-size:12px;color:#78350f;line-height:1.5;">Unverified emails may be filtered or ignored. Get verified in 3 steps below.</p>
          </div>
          <p style="margin:0 0 16px;font-size:14px;font-weight:700;color:#111827;">How to get verified — 3 simple steps:</p>
          <table style="width:100%;border-collapse:collapse;">
            <tr>
              <td style="width:40px;vertical-align:top;padding:0 12px 16px 0;"><div style="width:32px;height:32px;background:#6366f1;color:white;border-radius:50%;font-weight:700;font-size:14px;text-align:center;line-height:32px;">1</div></td>
              <td style="vertical-align:top;padding-bottom:16px;"><p style="margin:0;font-size:14px;font-weight:600;color:#111827;">Download the HVEL Chrome Extension</p><a href="https://hvel-backend.onrender.com/hvel-extension.zip" style="color:#6366f1;font-size:13px;">https://hvel-backend.onrender.com/hvel-extension.zip</a></td>
            </tr>
            <tr>
              <td style="width:40px;vertical-align:top;padding:0 12px 16px 0;"><div style="width:32px;height:32px;background:#6366f1;color:white;border-radius:50%;font-weight:700;font-size:14px;text-align:center;line-height:32px;">2</div></td>
              <td style="vertical-align:top;padding-bottom:16px;"><p style="margin:0;font-size:14px;font-weight:600;color:#111827;">Install in Chrome</p><p style="margin:4px 0 0;font-size:13px;color:#6b7280;line-height:1.5;">Open <strong>chrome://extensions</strong> → Enable <strong>Developer mode</strong> → Click <strong>Load unpacked</strong> → Select the extracted folder.</p></td>
            </tr>
            <tr>
              <td style="width:40px;vertical-align:top;padding:0 12px 0 0;"><div style="width:32px;height:32px;background:#10b981;color:white;border-radius:50%;font-weight:700;font-size:14px;text-align:center;line-height:32px;">3</div></td>
              <td style="vertical-align:top;"><p style="margin:0;font-size:14px;font-weight:600;color:#111827;">Verify before sending in Gmail</p><p style="margin:4px 0 0;font-size:13px;color:#6b7280;line-height:1.5;">Open Gmail → Compose → Click <strong>"Verify"</strong> → Complete 2FA → Send with ✅ badge.</p></td>
            </tr>
          </table>
          <div style="text-align:center;margin:28px 0 0;">
            <a href="https://hvel-backend.onrender.com/hvel-extension.zip" style="display:inline-block;background:#6366f1;color:white;padding:13px 32px;text-decoration:none;border-radius:8px;font-weight:700;font-size:14px;">Download HVEL Extension — Free</a>
          </div>
        </div>
        <div style="background:#f9fafb;padding:16px 30px;border-top:1px solid #e5e7eb;">
          <p style="margin:0;font-size:11px;color:#9ca3af;line-height:1.6;">Sent automatically by HVEL because you emailed <strong>${hvelUserEmail}</strong> without a verification badge.<br/>Learn more at <a href="https://hvel.io" style="color:#6366f1;">hvel.io</a></p>
        </div>
      </div>`;

    await hrmsTransporter.sendMail({
      from: `"HVEL Security" <${process.env.EMAIL_USER}>`,
      to: noExtUserEmail,
      subject: `⚠️ Your reply to ${hvelUserEmail} was not Human Verified`,
      headers: { 'X-Priority': '1 (Highest)', 'X-MSMail-Priority': 'High', 'Importance': 'high', 'X-Entity-Ref-ID': Date.now().toString() },
      html: nudgeHtml
    });

    await pool.query(`INSERT INTO nudge_log (hvel_user, no_extension_user) VALUES ($1, $2)`, [hvelUserEmail, noExtUserEmail]);

    console.log('================================================================');
    console.log(`[HVEL API] ✅ NUDGE EMAIL SENT`);
    console.log(`           HVEL User:    ${hvelUserEmail}`);
    console.log(`           Target:       ${noExtUserEmail}`);
    console.log(`           Sent At:      ${new Date().toISOString()}`);
    console.log('================================================================');

    res.json({ success: true, message: `Nudge email sent to ${noExtUserEmail}` });
  } catch (err) { console.error('[HVEL API] ❌ Nudge error:', err.message); res.status(500).json({ error: 'Server error' }); }
});

// Trust record page
app.get('/v/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM verifications WHERE id = $1', [req.params.id]);
    const record = result.rows[0];
    if (!record) return res.status(404).send('<h1>404 - Not found</h1>');
    const badgeColor = record.type === 'ai' ? '#8b5cf6' : record.type === 'automated' ? '#6b7280' : '#10b981';
    const badgeTitle = record.type === 'ai' ? 'AI Assisted' : record.type === 'automated' ? 'Automated' : 'Human Verified';
    res.send(`<!DOCTYPE html><html><head><title>HVEL Trust Record</title><style>body{font-family:-apple-system,sans-serif;background:#f3f4f6;display:flex;justify-content:center;padding-top:50px;}.card{background:white;padding:40px;border-radius:12px;box-shadow:0 4px 6px -1px rgba(0,0,0,0.1);max-width:500px;width:100%;border-top:6px solid ${badgeColor};}h2{margin-top:0;color:${badgeColor};}.detail{margin-bottom:15px;border-bottom:1px solid #e5e7eb;padding-bottom:15px;}.label{font-size:12px;color:#6b7280;text-transform:uppercase;font-weight:bold;margin-bottom:5px;display:block;}.value{font-size:16px;color:#111827;word-break:break-all;}</style></head><body><div class="card"><h2>${badgeTitle}</h2><p>This email carries an authentic trust signal verified by HVEL.</p><div class="detail"><span class="label">Sender</span><span class="value">${record.sender_email}</span></div><div class="detail"><span class="label">Verification ID</span><span class="value" style="font-family:monospace;">${record.id}</span></div><div class="detail"><span class="label">Content Hash</span><span class="value" style="font-family:monospace;font-size:12px;color:#6b7280;">${record.content_hash || 'N/A'}</span></div><div class="detail" style="border:none;"><span class="label">Timestamp (UTC)</span><span class="value">${new Date(record.timestamp).toUTCString()}</span></div></div></body></html>`);
  } catch (err) { res.status(500).send('<h1>500 - Server Error</h1>'); }
});

// Utility endpoints
app.post('/api/check-sent-verified', async (req, res) => {
  const { senderEmail, recipientEmail } = req.body;
  if (!senderEmail || !recipientEmail) return res.status(400).json({ verified: false, error: 'Both emails required' });
  try {
    const result = await pool.query(`SELECT id FROM verifications WHERE LOWER(sender_email) = LOWER($1) AND LOWER(recipient_email) = LOWER($2) LIMIT 1`, [senderEmail, recipientEmail]);
    const verified = result.rows.length > 0;
    console.log(`[HVEL API] 🔎 check-sent-verified: ${senderEmail} → ${recipientEmail} = ${verified}`);
    res.json({ verified });
  } catch (err) { res.status(500).json({ verified: false, error: 'Server error' }); }
});

app.post('/api/check-user-verified', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ verified: false, error: 'Email required' });
  try {
    const totpResult = await pool.query(`SELECT is_verified FROM totp_secrets WHERE LOWER(email) = LOWER($1) LIMIT 1`, [email]);
    const passkeyResult = await pool.query(`SELECT id FROM passkeys WHERE LOWER(email) = LOWER($1) LIMIT 1`, [email]);
    
    const isVerified = (totpResult.rows.length > 0 && totpResult.rows[0].is_verified) || (passkeyResult.rows.length > 0);
    
    console.log(`[HVEL API] 👤 check-user-verified: ${email} = ${isVerified}`);
    res.json({ verified: isVerified });
  } catch (err) { 
    console.error('Error checking user verification:', err);
    res.status(500).json({ verified: false, error: 'Server error' }); 
  }
});

app.get('/api/nudge-log', async (req, res) => {
  try {
    const result = await pool.query(`SELECT id, hvel_user, no_extension_user, nudge_sent_at FROM nudge_log ORDER BY nudge_sent_at DESC`);
    res.json({ success: true, total: result.rows.length, records: result.rows });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

app.delete('/api/clear-nudge-log', async (req, res) => {
  try { await pool.query(`DELETE FROM nudge_log`); res.json({ success: true, message: 'Nudge log cleared' }); }
  catch (err) { res.status(500).json({ error: 'Server error' }); }
});

app.post('/api/test-smtp', async (req, res) => {
  const { to } = req.body;
  if (!to) return res.status(400).json({ error: 'to email required' });
  try {
    await hrmsTransporter.sendMail({ from: `"HVEL Test" <${process.env.EMAIL_USER}>`, to, subject: 'HVEL SMTP Test', text: `SMTP working. ${new Date().toISOString()}` });
    console.log(`[HVEL API] ✅ Test email sent to ${to}`);
    res.json({ success: true, message: `Test email sent to ${to}` });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

app.listen(port, () => console.log(`HVEL Backend listening on port ${port}`));
