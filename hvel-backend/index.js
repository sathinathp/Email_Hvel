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

// Global Activity Logger
app.use((req, res, next) => {
  if (req.path !== '/health') {
    console.log(`[ACTIVITY] 📥 ${req.method} ${req.path} | Time: ${new Date().toLocaleTimeString()}`);
    if (req.body && Object.keys(req.body).length > 0) {
      console.log(`           Payload:`, JSON.stringify(req.body));
    }
  }
  next();
});

app.get('/auth', (req, res) => {
  res.sendFile(__dirname + '/public/auth.html');
});

const net = require('net');
const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: parseInt(process.env.DB_PORT || '5432'),
  ssl: false
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
      nudge_sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(hvel_user, no_extension_user)
    );
    CREATE TABLE IF NOT EXISTS invite_log (
      id SERIAL PRIMARY KEY,
      sender_email VARCHAR(255) NOT NULL,
      recipient_email VARCHAR(255) NOT NULL,
      invite_sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(sender_email, recipient_email)
    );
    CREATE TABLE IF NOT EXISTS profiles (
      email VARCHAR(255) PRIMARY KEY,
      full_name VARCHAR(255),
      last_active TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS security_alert_log (
      id SERIAL PRIMARY KEY,
      recipient_email VARCHAR(255) NOT NULL,
      attacker_email VARCHAR(255) NOT NULL,
      alert_sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(recipient_email, attacker_email)
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
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,
  auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
  connectionTimeout: 30000,
  greetingTimeout: 30000,
  socketTimeout: 30000,
  pool: true,
  maxConnections: 5,
  maxMessages: 100
});

const hrmsTransporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,
  auth: { user: process.env.EMAIL_USER, pass: process.env.HRMS_EMAIL_PASS },
  connectionTimeout: 30000,
  greetingTimeout: 30000,
  socketTimeout: 30000,
  pool: true,
  maxConnections: 5,
  maxMessages: 100
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
      console.log(`[SMTP] 📤 Sending OTP to ${email}...`);
      const info = await mainTransporter.sendMail({ from: process.env.EMAIL_USER, to: email, subject: 'HVEL Verification Code', text: `Your HVEL verification code is: ${code}. Expires in 10 minutes.` });
      console.log(`[SMTP] ✅ OTP sent to ${email}: ${info.messageId}`);
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
  console.log(`[HVEL API] 🛡️ Verification Start — Sender: ${senderEmail} | Recipient: ${recipientEmail || 'N/A'}`);
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
                <a href="https://humanattest.com/hvel-extension.zip" style="display:inline-block;background:#6366f1;color:white;padding:13px 32px;text-decoration:none;border-radius:8px;font-weight:700;font-size:14px;">Download HVEL Extension — Free</a>
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

    // NEW: Permanent "Once Ever" Gate
    const alreadyNudged = await pool.query(
      `SELECT id FROM nudge_log 
       WHERE LOWER(hvel_user) = $1 AND LOWER(no_extension_user) = $2 
       AND nudge_sent_at > NOW() - INTERVAL '24 hours' 
       LIMIT 1`,
      [hvelUserEmail, noExtUserEmail]
    );
    if (alreadyNudged.rows.length > 0) {
      console.log(`[HVEL API] ⛔ Nudged recently. Skipping.`);
      return res.status(200).json({ success: true, message: 'Already notified recently.' });
    }
  } catch (err) { return res.status(500).json({ error: 'Server error during gate checks' }); }

  try {
    const details = req.body.details || {};
    const timestamp = details.timestamp || new Date().toLocaleString();
    
    // Atomic Block - Insert or Update timestamp if older than 24h
    try {
      await pool.query(
        `INSERT INTO nudge_log (hvel_user, no_extension_user) VALUES ($1, $2)
         ON CONFLICT (hvel_user, no_extension_user) 
         DO UPDATE SET nudge_sent_at = NOW() 
         WHERE nudge_log.nudge_sent_at < NOW() - INTERVAL '24 hours'`,
        [hvelUserEmail, noExtUserEmail]
      );
    } catch (dbErr) {
      if (dbErr.code === '23505') { // Unique violation
        console.log(`[HVEL API] ⛔ Race condition blocked: Nudge already logged for ${noExtUserEmail}`);
        return res.json({ success: true, message: 'Already notified once.' });
      }
      throw dbErr;
    }

    // Get sender profile for personalization
    const profileRes = await pool.query('SELECT full_name FROM profiles WHERE email = $1', [hvelUserEmail]);
    const senderName = profileRes.rows[0]?.full_name || hvelUserEmail;

    const nudgeHtml = `
      <div style="font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1f2937;max-width:600px;margin:20px auto;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);">
        <div style="background:linear-gradient(135deg,#4f46e5,#7c3aed);padding:40px 30px;text-align:center;color:white;">
          <div style="display:inline-block;background:rgba(255,255,255,0.2);padding:12px;border-radius:12px;margin-bottom:16px;">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
          </div>
          <h2 style="margin:0;font-size:24px;font-weight:800;letter-spacing:-0.025em;">HVEL Identity Report</h2>
          <p style="margin:8px 0 0;font-size:14px;opacity:0.9;font-weight:500;">Securing Your Communication with ${senderName}</p>
        </div>
        
        <div style="padding:32px;">
          <div style="margin-bottom:24px;">
            <p style="margin:0 0 8px;font-size:13px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;">Incident Details</p>
            <div style="background:#f8fafc;border:1px solid #f1f5f9;border-radius:12px;padding:16px;">
              <table style="width:100%;font-size:14px;">
                <tr><td style="color:#64748b;padding-bottom:4px;width:100px;">Recipient:</td><td style="font-weight:600;">${senderName}</td></tr>
                <tr><td style="color:#64748b;padding-bottom:4px;">Time Detected:</td><td style="font-weight:600;">${timestamp}</td></tr>
                <tr><td style="color:#64748b;">Status:</td><td><span style="background:#fee2e2;color:#991b1b;padding:2px 8px;border-radius:9999px;font-size:11px;font-weight:700;">UNVERIFIED</span></td></tr>
              </table>
            </div>
          </div>

          <p style="margin:0 0 20px;font-size:15px;line-height:1.6;">
            Hello,<br/><br/>
            This is an automated notification from <strong>HVEL (Human Verified Email Layer)</strong>. 
            An email sent from your address to <strong>${senderName}</strong> was flagged because it lacked a valid human verification stamp.
          </p>

          <div style="background:#fff7ed;border-left:4px solid #f97316;padding:16px;border-radius:4px 12px 12px 4px;margin-bottom:24px;">
            <p style="margin:0;font-size:14px;color:#9a3412;line-height:1.5;">
              <strong>Why this matters:</strong> To protect against AI-generated spam and phishing, ${senderName} uses HVEL to ensure they only interact with verified humans. Unverified emails may be deprioritized or moved to junk.
            </p>
          </div>

          <h3 style="margin:0 0 16px;font-size:16px;font-weight:700;">How to Restore Trust:</h3>
          <div style="display:grid;gap:12px;">
            <div style="background:#f1f5f9;padding:16px;border-radius:12px;">
              <p style="margin:0;font-size:14px;font-weight:600;color:#475569;">1. Download HVEL Extension</p>
              <p style="margin:4px 0 0;font-size:13px;color:#64748b;">Get the extension <a href="https://humanattest.com/hvel-extension.zip" style="color:#4f46e5;text-decoration:none;font-weight:600;">from this link</a>.</p>
            </div>
            <div style="background:#f1f5f9;padding:16px;border-radius:12px;">
              <p style="margin:0;font-size:14px;font-weight:600;color:#475569;">2. Activate Your Identity</p>
              <p style="margin:4px 0 0;font-size:13px;color:#64748b;">Load the extension in Chrome and complete the 2FA setup.</p>
            </div>
            <div style="background:#ecfdf5;padding:16px;border:1px solid #d1fae5;border-radius:12px;">
              <p style="margin:0;font-size:14px;font-weight:600;color:#059669;">3. Verify in Gmail</p>
              <p style="margin:4px 0 0;font-size:13px;color:#065f46;">Look for the <strong>"Verify"</strong> button in your Gmail compose window before sending.</p>
            </div>
          </div>

          <div style="text-align:center;margin-top:32px;">
            <a href="https://humanattest.com/verify" style="display:inline-block;background:#4f46e5;color:white;padding:12px 32px;text-decoration:none;border-radius:12px;font-weight:700;font-size:14px;box-shadow:0 4px 6px -1px rgba(79, 70, 229, 0.4);">Open HVEL Portal</a>
          </div>
        </div>

        <div style="background:#f8fafc;padding:24px;border-top:1px solid #e2e8f0;text-align:center;">
          <p style="margin:0;font-size:12px;color:#94a3b8;line-height:1.6;">
            This security report was generated for communication with ${hvelUserEmail}.<br/>
            HVEL Identity Protocol v2.4 | <a href="https://hvel.io" style="color:#4f46e5;text-decoration:none;">Learn More</a>
          </p>
        </div>
      </div>
    `;

    console.log(`[SMTP] 📤 Sending nudge email to ${noExtUserEmail}...`);
    const info = await hrmsTransporter.sendMail({
      from: `"HVEL Security" <${process.env.EMAIL_USER}>`,
      to: noExtUserEmail,
      subject: `⚠️ Your reply to ${hvelUserEmail} was not Human Verified`,
      headers: { 'X-Priority': '1 (Highest)', 'X-MSMail-Priority': 'High', 'Importance': 'high', 'X-Entity-Ref-ID': Date.now().toString() },
      html: nudgeHtml
    });
    console.log(`[SMTP] ✅ Nudge email sent: ${info.messageId}`);



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
    res.send(`<!DOCTYPE html><html><head><title>HVEL Trust Record</title><style>body{font-family:-apple-system,sans-serif;background:#f3f4f6;display:flex;justify-content:center;padding-top:50px;}.card{background:white;padding:40px;border-radius:12px;box-shadow:0 4px 6px -1px rgba(0,0,0,0.1);max-width:500px;width:100%;border-top:6px solid ${badgeColor};}h2{margin-top:0;color:${badgeColor};}.detail{margin-bottom:15px;border-bottom:1px solid #e5e7eb;padding-bottom:15px;}.label{font-size:12px;color:#6b7280;text-transform:uppercase;font-weight:bold;margin-bottom:5px;display:block;}.value{font-size:16px;color:#111827;word-break:break-all;}</style></head><body><div class="card"><div style="text-align:center;margin-bottom:20px;"><img src="/logo.png" alt="HVEL" style="width:48px;"></div><h2>${badgeTitle}</h2><p>This email carries an authentic trust signal verified by HVEL.</p><div class="detail"><span class="label">Sender</span><span class="value">${record.sender_email}</span></div><div class="detail"><span class="label">Verification ID</span><span class="value" style="font-family:monospace;">${record.id}</span></div><div class="detail"><span class="label">Content Hash</span><span class="value" style="font-family:monospace;font-size:12px;color:#6b7280;">${record.content_hash || 'N/A'}</span></div><div class="detail" style="border:none;"><span class="label">Timestamp (UTC)</span><span class="value">${new Date(record.timestamp).toUTCString()}</span></div></div></body></html>`);
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

app.post('/api/profile/update', async (req, res) => {
  const { email, name } = req.body;
  if (!email) return res.status(400).json({ error: 'Email required' });
  try {
    await pool.query(
      `INSERT INTO profiles (email, full_name, last_active) 
       VALUES ($1, $2, NOW()) 
       ON CONFLICT (email) DO UPDATE SET full_name = COALESCE($2, profiles.full_name), last_active = NOW()`,
      [email.toLowerCase(), name]
    );
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

app.post('/api/verify-hash', async (req, res) => {
  const { hash } = req.body;
  if (!hash) return res.status(400).json({ error: 'Hash required' });
  try {
    const result = await pool.query(`
      SELECT v.sender_email, v.timestamp, v.type, p.full_name, p.last_active
      FROM verifications v
      LEFT JOIN profiles p ON v.sender_email = p.email
      WHERE v.content_hash = $1
      ORDER BY v.timestamp DESC
      LIMIT 1
    `, [hash]);

    if (result.rows.length === 0) {
      return res.json({ success: false, message: 'No verification found for this hash.' });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

app.post('/api/report-security-alert', async (req, res) => {
  const { email, attacker, reason } = req.body;
  if (!email || !attacker) return res.status(400).json({ error: 'Data missing' });

  try {
    // NEW: Atomic Block - Insert BEFORE sending alerts
    try {
      const alreadyAlerted = await pool.query(
        `SELECT id FROM security_alert_log 
         WHERE LOWER(recipient_email) = $1 AND LOWER(attacker_email) = $2 
         AND alert_sent_at > NOW() - INTERVAL '24 hours'
         LIMIT 1`,
        [email.toLowerCase(), attacker.toLowerCase()]
      );

      if (alreadyAlerted.rows.length > 0) {
        console.log(`[HVEL API] ⛔ Alerted recently. Skipping.`);
        return res.json({ success: true, message: 'Already notified recently.' });
      }

      await pool.query(
        `INSERT INTO security_alert_log (recipient_email, attacker_email) VALUES ($1, $2)
         ON CONFLICT (recipient_email, attacker_email) 
         DO UPDATE SET alert_sent_at = NOW() 
         WHERE security_alert_log.alert_sent_at < NOW() - INTERVAL '24 hours'`,
        [email.toLowerCase(), attacker.toLowerCase()]
      );
    } catch (dbErr) {
      console.error("[HVEL API] DB Error in security lock:", dbErr);
    }
  } catch (err) { 
    return res.status(500).json({ error: 'Server error during security lock' }); 
  }

  console.log(`[HVEL API] 🚨 SECURITY ALERT for ${email}: ${reason} by ${attacker}`);

  // 1. Alert to the RECIPIENT (The HVEL User)
  const recipientMailOptions = {
    from: `"HVEL Security" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: `⚠️ Security Alert: Identity Mismatch Detected`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; border: 1px solid #fecaca; border-radius: 12px; overflow: hidden;">
        <div style="background: #ef4444; color: white; padding: 20px; text-align: center;">
          <h2 style="margin: 0;">Security Alert: ID Mismatch</h2>
        </div>
        <div style="padding: 20px; color: #1f2937;">
          <p>Hello,</p>
          <p>HVEL has detected a potential identity mismatch in your conversation with <strong>${attacker}</strong>.</p>
          <div style="background: #fef2f2; border-left: 4px solid #ef4444; padding: 15px; margin: 20px 0;">
            <p style="margin: 0; font-weight: bold; color: #991b1b;">Issue: ${reason}</p>
          </div>
          <p>This occurs when a sender uses a verification badge that doesn't belong to them or has been modified.</p>
          <p>We have automatically sent <strong>${attacker}</strong> the instructions to get properly human-verified.</p>
        </div>
      </div>
    `
  };

  // 2. Instructions to the SENDER (The suspicious user)
  const senderMailOptions = {
    from: `"HVEL Identity Service" <${process.env.EMAIL_USER}>`,
    to: attacker,
    subject: `⚠️ Verification Required: 3 Steps to Human Identity`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden;">
        <div style="background: #6366f1; color: white; padding: 24px; text-align: center;">
            <h2 style="margin: 0;">Verify Your Human Identity</h2>
            <p style="margin: 8px 0 0; opacity: 0.9;">Follow these 3 steps to secure your emails</p>
        </div>
        <div style="padding: 30px; color: #1f2937;">
            <p>Hello,</p>
            <p>Your recent email to <strong>${email}</strong> could not be verified as human. Please complete these 3 steps to get your HVEL Human Stamp:</p>
            
            <table style="width:100%; margin-top:20px; border-collapse:collapse;">
                <tr>
                    <td style="width:40px; vertical-align:top; padding-bottom:20px;"><div style="width:28px; height:28px; background:#6366f1; color:white; border-radius:50%; text-align:center; line-height:28px; font-weight:bold;">1</div></td>
                    <td style="padding-bottom:20px;">
                        <strong style="display:block; margin-bottom:4px;">Install HVEL Extension</strong>
                        <span style="font-size:14px; color:#6b7280;">Download and load the HVEL extension in your Chrome browser.</span>
                    </td>
                </tr>
                <tr>
                    <td style="width:40px; vertical-align:top; padding-bottom:20px;"><div style="width:28px; height:28px; background:#6366f1; color:white; border-radius:50%; text-align:center; line-height:28px; font-weight:bold;">2</div></td>
                    <td style="padding-bottom:20px;">
                        <strong style="display:block; margin-bottom:4px;">Setup Identity (TOTP)</strong>
                        <span style="font-size:14px; color:#6b7280;">Open Gmail, click the HVEL icon, and link your Google Authenticator app.</span>
                    </td>
                </tr>
                <tr>
                    <td style="width:40px; vertical-align:top;"><div style="width:28px; height:28px; background:#10b981; color:white; border-radius:50%; text-align:center; line-height:28px; font-weight:bold;">3</div></td>
                    <td>
                        <strong style="display:block; margin-bottom:4px;">Verify Every Email</strong>
                        <span style="font-size:14px; color:#6b7280;">Before clicking "Send", click the <strong>"Verify"</strong> button in your Gmail compose window to attach your Human Stamp.</span>
                    </td>
                </tr>
            </table>

            <div style="margin-top:30px; text-align:center;">
                <a href="https://humanattest.com/verify" style="display:inline-block; background:#6366f1; color:white; padding:12px 24px; text-decoration:none; border-radius:8px; font-weight:bold;">Open HVEL Portal</a>
            </div>
        </div>
      </div>
    `
  };
  try {
    console.log(`[SMTP] 📤 Sending security alerts for ${email}...`);
    // Send both emails
    const info1 = await mainTransporter.sendMail(recipientMailOptions);
    console.log(`[SMTP] ✅ Alert sent to recipient: ${info1.messageId}`);
    
    const info2 = await mainTransporter.sendMail(senderMailOptions);
    console.log(`[SMTP] ✅ Alert sent to attacker: ${info2.messageId}`);
    
    res.json({ success: true });
  } catch (err) {
    console.error('[HVEL API] ❌ Error sending security alerts:', err);
    res.status(500).json({ error: 'Failed to send alerts', details: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// /api/contact — Contact form submission → forwards to noreply.hvel@gmail.com
// ─────────────────────────────────────────────────────────────────────────────
app.post('/api/contact', async (req, res) => {
  const { name, email, company, subject, message, type } = req.body;

  if (!name || !email || !message) {
    return res.status(400).json({ success: false, error: 'Name, email, and message are required.' });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ success: false, error: 'Invalid email address.' });
  }

  const subjectLine = subject || `[HumanAttest Contact] ${type || 'General Inquiry'} from ${name}`;
  const receivedAt = new Date().toLocaleString('en-US', { timeZone: 'UTC', dateStyle: 'full', timeStyle: 'long' });

  const html = `
    <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:600px;margin:0 auto;border:1px solid #E2E8F0;border-radius:16px;overflow:hidden;">
      <div style="background:linear-gradient(135deg,#2563EB 0%,#1D4ED8 100%);padding:32px 28px;">
        <h2 style="margin:0;color:white;font-size:20px;font-weight:800;letter-spacing:-0.02em;">📬 New Contact Form Submission</h2>
        <p style="margin:6px 0 0;color:rgba(255,255,255,0.75);font-size:13px;">HumanAttest Website — ${receivedAt}</p>
      </div>
      <div style="padding:28px;">
        <table style="width:100%;border-collapse:collapse;font-size:14px;">
          <tr style="border-bottom:1px solid #F1F5F9;">
            <td style="padding:10px 0;color:#94A3B8;font-weight:600;width:120px;">Name</td>
            <td style="padding:10px 0;color:#0F172A;font-weight:700;">${name}</td>
          </tr>
          <tr style="border-bottom:1px solid #F1F5F9;">
            <td style="padding:10px 0;color:#94A3B8;font-weight:600;">Email</td>
            <td style="padding:10px 0;"><a href="mailto:${email}" style="color:#2563EB;font-weight:700;">${email}</a></td>
          </tr>
          ${company ? `<tr style="border-bottom:1px solid #F1F5F9;"><td style="padding:10px 0;color:#94A3B8;font-weight:600;">Company</td><td style="padding:10px 0;color:#0F172A;font-weight:700;">${company}</td></tr>` : ''}
          <tr style="border-bottom:1px solid #F1F5F9;">
            <td style="padding:10px 0;color:#94A3B8;font-weight:600;">Type</td>
            <td style="padding:10px 0;"><span style="background:#EFF6FF;color:#2563EB;padding:3px 10px;border-radius:9999px;font-size:12px;font-weight:700;">${type || 'General Inquiry'}</span></td>
          </tr>
          <tr style="border-bottom:1px solid #F1F5F9;">
            <td style="padding:10px 0;color:#94A3B8;font-weight:600;">Subject</td>
            <td style="padding:10px 0;color:#0F172A;font-weight:600;">${subject || '—'}</td>
          </tr>
        </table>
        <div style="margin-top:20px;">
          <p style="font-size:12px;font-weight:600;color:#94A3B8;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:10px;">Message</p>
          <div style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:10px;padding:18px;font-size:14px;color:#334155;line-height:1.7;white-space:pre-wrap;">${message}</div>
        </div>
      </div>
      <div style="background:#F8FAFC;padding:16px 28px;border-top:1px solid #E2E8F0;">
        <p style="margin:0;font-size:11px;color:#94A3B8;">Reply directly to this email to respond to ${name} at ${email}</p>
      </div>
    </div>`;

  try {
    await mainTransporter.sendMail({
      from: `"HumanAttest Contact" <${process.env.EMAIL_USER}>`,
      to: 'noreply.hvel@gmail.com',
      replyTo: email,
      subject: subjectLine,
      html,
      text: `New contact from ${name} (${email})\nCompany: ${company || 'N/A'}\nType: ${type || 'General'}\nSubject: ${subject || 'N/A'}\n\nMessage:\n${message}\n\nReceived: ${receivedAt}`,
    });

    console.log(`[CONTACT] ✅ Contact form submitted by ${name} <${email}> — forwarded to noreply.hvel@gmail.com`);
    res.json({ success: true, message: 'Message received. We will get back to you within 24 hours.' });
  } catch (err) {
    console.error('[CONTACT] ❌ Failed to send contact email:', err);
    res.status(500).json({ success: false, error: 'Failed to send message. Please try again or email us directly.' });
  }
});

const server = app.listen(port, () => {
  console.log(`HVEL Backend listening on port ${port}`);
  // Keep-alive heartbeat every 60 seconds
  setInterval(() => {
    console.log(`[SYSTEM] 🛡️ Backend Heartbeat — Time: ${new Date().toLocaleTimeString()} | Status: Active`);
  }, 60000);
});

server.on('error', (err) => {
  console.error('[SERVER CRITICAL ERROR]', err);
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${port} is already in use. Please kill the other process or change the PORT in .env`);
  }
});
