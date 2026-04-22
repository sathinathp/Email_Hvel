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

// Set up PostgreSQL connection
const net = require('net');

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
  ssl: {
    rejectUnauthorized: false
  }
});

// Initialize Database Table
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
  `;
  try {
    await pool.query(createTableQuery);

    // Robust Schema Evolution: Check if recipient_email exists before trying to add it
    const colCheck = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name='verifications' AND column_name='recipient_email'
    `);

    if (colCheck.rows.length === 0) {
      console.log("Adding missing column 'recipient_email' to verifications table...");
      await pool.query('ALTER TABLE verifications ADD COLUMN recipient_email VARCHAR(255)');
    }

    console.log("Database tables ensured.");
  } catch (err) {
    console.error("Error creating tables:", err);
  }
}
initDB();

// Basic health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'HVEL Backend is running' });
});

app.post('/api/heartbeat', (req, res) => {
  console.log(`[HVEL API] 💓 Heartbeat from Ext: ${req.body.url}`);
  res.json({ success: true });
});

// ─────────────────────────────────────────────────────────────────────────────
// TWO transporters:
//   1. mainTransporter  – used for OTP / TOTP / verified-email notifications
//      (uses EMAIL_USER / EMAIL_PASS from .env)
//   2. hrmsTransporter  – used ONLY for the "unverified reply" nudge email
//      sent FROM hrms1928@gmail.com (uses HRMS_EMAIL_PASS from .env)
// ─────────────────────────────────────────────────────────────────────────────

const mainTransporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// Dedicated transporter for the nudge account (now using the same main email)
const hrmsTransporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.HRMS_EMAIL_PASS
  }
});

// Verify SMTP connections on startup
if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
  mainTransporter.verify((error) => {
    if (error) console.error('[HVEL API] Main SMTP Error:', error);
    else console.log(`[HVEL API] ✅ Main SMTP ready — sending as: ${process.env.EMAIL_USER}`);
  });
}
if (process.env.HRMS_EMAIL_PASS) {
  hrmsTransporter.verify((error) => {
    if (error) console.error('[HVEL API] HRMS SMTP Error:', error);
    else console.log(`[HVEL API] ✅ HRMS SMTP ready — nudge emails from: ${process.env.EMAIL_USER}`);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Endpoint to request OTP
// ─────────────────────────────────────────────────────────────────────────────
app.post('/api/request-otp', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required' });

  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expires_at = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  try {
    await pool.query(
      `INSERT INTO otps (email, code, expires_at) VALUES ($1, $2, $3) 
       ON CONFLICT (email) DO UPDATE SET code = $2, expires_at = $3`,
      [email, code, expires_at]
    );

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'HVEL Verification Code',
      text: `Your HVEL verification code is: ${code}. This code will expire in 10 minutes.`
    };

    if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
      await mainTransporter.sendMail(mailOptions);
      console.log(`OTP ${code} sent to ${email}`);
    } else {
      console.warn('EMAIL_USER or EMAIL_PASS not set. Logging OTP to console instead.');
      console.log(`[MOCK EMAIL] To: ${email}, Code: ${code}`);
    }

    res.json({ success: true, message: 'OTP sent successfully' });
  } catch (err) {
    console.error('Error requesting OTP:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Endpoint to verify OTP
// ─────────────────────────────────────────────────────────────────────────────
app.post('/api/verify-otp', async (req, res) => {
  const { email, code } = req.body;
  if (!email || !code) return res.status(400).json({ error: 'Email and code are required' });

  try {
    const result = await pool.query(
      'SELECT * FROM otps WHERE email = $1 AND code = $2 AND expires_at > NOW()',
      [email, code]
    );

    if (result.rows.length > 0) {
      await pool.query('DELETE FROM otps WHERE email = $1', [email]);
      res.json({ success: true, message: 'Verification successful' });
    } else {
      res.status(401).json({ success: false, error: 'Invalid or expired code' });
    }
  } catch (err) {
    console.error('Error verifying OTP:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Endpoint to Setup TOTP (Authenticator App)
// ─────────────────────────────────────────────────────────────────────────────
app.post('/api/totp-setup', async (req, res) => {
  const { email, force } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required' });

  console.log(`[HVEL API] 🛠️ TOTP Setup Request - Email: ${email}, Force: ${force}`);

  try {
    const result = await pool.query('SELECT secret, is_verified FROM totp_secrets WHERE email = $1', [email]);
    let secret;
    let is_verified = false;

    if (result.rows.length > 0 && !force) {
      secret = result.rows[0].secret;
      is_verified = result.rows[0].is_verified;
      console.log(`[HVEL API] Using existing secret for ${email}`);
    } else {
      const g_secret = speakeasy.generateSecret({ 
        length: 20,
        name: `HVEL (${email})`,
        issuer: 'HVEL'
      });
      secret = g_secret.base32;
      
      if (result.rows.length > 0) {
        await pool.query('UPDATE totp_secrets SET secret = $2, is_verified = FALSE WHERE email = $1', [email, secret]);
        console.log(`[HVEL API] Updated secret for ${email} (Force: ${force})`);
      } else {
        await pool.query('INSERT INTO totp_secrets (email, secret) VALUES ($1, $2)', [email, secret]);
        console.log(`[HVEL API] Created new secret for ${email}`);
      }
    }

    // Standard otpauth format: otpauth://totp/Issuer:Label?secret=Secret&issuer=Issuer
    const label = `HVEL:${email}`;
    const otpauth = `otpauth://totp/${encodeURIComponent(label)}?secret=${secret}&issuer=HVEL`;
    
    console.log(`[HVEL API] Generating QR code for: ${otpauth}`);
    const imageUrl = await qrcode.toDataURL(otpauth);
    console.log(`[HVEL API] QR code generated (length: ${imageUrl.length})`);

    res.json({
      success: true,
      alreadyExists: result.rows.length > 0,
      isVerified: is_verified,
      qrcode: imageUrl,
      secret: secret
    });
  } catch (err) {
    console.error('[HVEL API] Error setting up TOTP:', err);
    res.status(500).json({ success: false, error: 'Server error: ' + err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Endpoint to Verify TOTP
// ─────────────────────────────────────────────────────────────────────────────
app.post('/api/totp-verify', async (req, res) => {
  const { email, code } = req.body;
  if (!email || !code) return res.status(400).json({ error: 'Email and code are required' });

  try {
    const result = await pool.query('SELECT secret FROM totp_secrets WHERE email = $1', [email]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'TOTP not set up for this email' });
    }

    const secret = result.rows[0].secret;
    const isValid = speakeasy.totp.verify({
      secret: secret,
      encoding: 'base32',
      token: code,
      window: 1 // Allow 30s drift
    });

    if (isValid) {
      await pool.query('UPDATE totp_secrets SET is_verified = TRUE WHERE email = $1', [email]);
      res.json({ success: true });
    } else {
      res.status(401).json({ success: false, error: 'Invalid authenticator code' });
    }
  } catch (err) {
    console.error('Error verifying TOTP:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// WEBAUTHN (PASSKEY) ENDPOINTS
// ─────────────────────────────────────────────────────────────────────────────

// 1. Generate Registration Options
app.post('/api/passkey/register-options', async (req, res) => {
  const email = req.body.email?.toLowerCase();
  if (!email) return res.status(400).json({ error: 'Email is required' });

  try {
    const result = await pool.query('SELECT cred_id, transports FROM passkeys WHERE email = $1', [email]);
    const userPasskeys = result.rows.map(row => ({
      id: row.cred_id,
      transports: row.transports ? JSON.parse(row.transports) : undefined,
    }));

    const options = await generateRegistrationOptions({
      rpName: RP_NAME,
      rpID: RP_ID,
      userID: new Uint8Array(Buffer.from(email)).slice(0, 32),
      userName: email,
      timeout: 120000, // 2 minutes for mobile setups
      attestationType: 'none',
      excludeCredentials: [], // Don't exclude, always allow fresh setup
      authenticatorSelection: {
        residentKey: 'discouraged',
        userVerification: 'discouraged',
      },
    });

    const expires_at = new Date(Date.now() + 10 * 60 * 1000);
    await pool.query(
      'INSERT INTO challenges (email, challenge, expires_at) VALUES ($1, $2, $3) ON CONFLICT (email) DO UPDATE SET challenge = $2, expires_at = $3',
      [email, options.challenge, expires_at]
    );

    res.json(options);
  } catch (err) {
    console.error('Passkey Reg Options Error:', err);
    res.status(500).json({ error: 'Failed to generate registration options' });
  }
});

// 2. Verify Registration
app.post('/api/passkey/register-verify', async (req, res) => {
  const email = req.body.email?.toLowerCase();
  const { registrationResponse } = req.body;
  if (!email || !registrationResponse) return res.status(400).json({ error: 'Email and response are required' });

  try {
    console.log(`[PASSKEY] Verifying registration for ${email}...`);
    const challResult = await pool.query('SELECT challenge FROM challenges WHERE email = $1 AND expires_at > NOW()', [email]);
    if (challResult.rows.length === 0) {
      console.error('[PASSKEY] Challenge not found or expired');
      return res.status(400).json({ error: 'Challenge expired or not found' });
    }
    const expectedChallenge = challResult.rows[0].challenge;

    let verification;
    try {
      verification = await verifyRegistrationResponse({
        response: registrationResponse,
        expectedChallenge,
        expectedOrigin: ORIGIN,
        expectedRPID: RP_ID,
      });
    } catch (vErr) {
      console.error('[PASSKEY] Registration Library Error:', vErr);
      return res.status(400).json({ error: 'Verification failed: ' + vErr.message });
    }

    if (verification.verified && verification.registrationInfo) {
      const { credential, credentialDeviceType, credentialBackedUp } = verification.registrationInfo;
      const { id, publicKey, counter, transports } = credential;

      // CLEAN START: Remove any old keys for this email to avoid domain mismatch issues
      await pool.query('DELETE FROM passkeys WHERE email = $1', [email]);

      await pool.query(
        `INSERT INTO passkeys (email, cred_id, cred_public_key, counter, backup_eligible, backup_status, transports)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          email,
          id, // use the base64url string directly from the library
          Buffer.from(publicKey),
          counter,
          credentialDeviceType === 'multiDevice',
          credentialBackedUp,
          JSON.stringify(transports || [])
        ]
      );

      console.log(`[PASSKEY] Registration SUCCESS for ${email}`);
      res.json({ success: true });
    } else {
      console.error('[PASSKEY] Registration verification failed');
      res.status(400).json({ error: 'Registration verification failed' });
    }
  } catch (err) {
    console.error('Passkey Verify Error:', err);
    res.status(500).json({ error: 'Server error during passkey verification' });
  }
});

// 3. Generate Authentication Options (Login/Approval)
app.post('/api/passkey/login-options', async (req, res) => {
  const email = req.body.email?.toLowerCase();
  if (!email) return res.status(400).json({ error: 'Email is required' });

  try {
    const result = await pool.query('SELECT cred_id, transports FROM passkeys WHERE email = $1', [email]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'No passkeys found for this email' });

    const options = await generateAuthenticationOptions({
      rpID: RP_ID,
      // Enable Discoverable Credentials (allows the phone to find the key itself)
      allowCredentials: result.rows.map(row => ({
        id: row.cred_id,
        type: 'public-key',
        transports: row.transports ? JSON.parse(row.transports) : undefined,
      })),
      userVerification: 'required',
    });

    const expires_at = new Date(Date.now() + 10 * 60 * 1000);
    await pool.query(
      'INSERT INTO challenges (email, challenge, expires_at) VALUES ($1, $2, $3) ON CONFLICT (email) DO UPDATE SET challenge = $2, expires_at = $3',
      [email, options.challenge, expires_at]
    );

    res.json(options);
  } catch (err) {
    console.error('Passkey Auth Options Error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// 4. Verify Authentication
app.post('/api/passkey/login-verify', async (req, res) => {
  const email = req.body.email?.toLowerCase();
  const { authResponse } = req.body;
  if (!email || !authResponse) return res.status(400).json({ error: 'Email and response are required' });

  try {
    const challResult = await pool.query('SELECT challenge FROM challenges WHERE email = $1 AND expires_at > NOW()', [email]);
    if (challResult.rows.length === 0) return res.status(400).json({ error: 'Challenge expired' });
    const expectedChallenge = challResult.rows[0].challenge;

    const passkeyResult = await pool.query('SELECT * FROM passkeys WHERE cred_id = $1', [authResponse.id]);
    if (passkeyResult.rows.length === 0) return res.status(404).json({ error: 'Passkey not found' });
    const passkey = passkeyResult.rows[0];
    console.log(`[PASSKEY] Found key in DB: ID=${passkey.cred_id}, Counter=${passkey.counter}`);

    let verification;
    try {
      verification = await verifyAuthenticationResponse({
        response: authResponse,
        expectedChallenge,
        expectedOrigin: ORIGIN,
        expectedRPID: RP_ID,
        credential: {
          id: passkey.cred_id,
          publicKey: new Uint8Array(passkey.cred_public_key),
          counter: Number(passkey.counter),
        },
        requireUserVerification: true,
      });
    } catch (vErr) {
      console.error('[PASSKEY] Library Verification Error:', vErr);
      return res.status(400).json({ error: 'Verification failed: ' + vErr.message });
    }

    if (verification.verified) {
      console.log(`[PASSKEY] Authentication SUCCESS for ${email}`);
      await pool.query('UPDATE passkeys SET counter = $1 WHERE cred_id = $2', [verification.authenticationInfo.newCounter, passkey.cred_id]);
      await pool.query('DELETE FROM challenges WHERE email = $1', [email]);
      res.json({ success: true });
    } else {
      res.status(400).json({ error: 'Authentication failed' });
    }
  } catch (err) {
    console.error('Passkey Auth Verify Error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Endpoint to generate a verification record
// When a Human-Verified sender sends an email to a recipient who does NOT have
// the extension, the recipient receives an informational email explaining what
// HVEL is and how to get it.
// ─────────────────────────────────────────────────────────────────────────────
app.post('/api/verify', async (req, res) => {
  const { senderEmail, recipientEmail, type, contentHash } = req.body;

  if (!senderEmail || !type) {
    return res.status(400).json({ error: 'senderEmail and type are required' });
  }

  const verificationId = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

  try {
    const insertQuery = `
      INSERT INTO verifications (id, sender_email, recipient_email, type, content_hash)
      VALUES ($1, $2, $3, $4, $5) RETURNING *
    `;
    const values = [verificationId, senderEmail, recipientEmail || null, type, contentHash || null];

    const result = await pool.query(insertQuery, values);
    const record = result.rows[0];

    const verificationUrl = `${ORIGIN}/v/${verificationId}`;

    // Notify the recipient that they received a Human-Verified email.
    // This fires whenever the sender has the HVEL extension and the recipient
    // does not (the extension passes recipientEmail in the request body).
    if (recipientEmail && process.env.EMAIL_USER && process.env.EMAIL_PASS) {
      const inviteMailOptions = {
        from: `HVEL Security <${process.env.EMAIL_USER}>`,
        to: recipientEmail,
        subject: `🔒 Secure Message Received from ${senderEmail}`,
        html: `
          <div style="font-family: sans-serif; color: #333; max-width: 600px; border: 1px solid #eee; padding: 20px; border-radius: 10px;">
            <h2 style="color: #10b981;">✅ Human Verified Email Received</h2>
            <p>Hello,</p>
            <p>You have just received an email from <strong>${senderEmail}</strong> that has been
               <strong>Human Verified</strong> via the HVEL Security Layer.</p>
            <p>HVEL ensures the sender completed a 2FA identity check and that the message content
               has not been tampered with by AI bots or malicious scripts.</p>
            <div style="background: #f0fdf4; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #10b981;">
              <p style="margin: 0; font-weight: bold;">Why did you receive this?</p>
              <p style="margin: 5px 0 0 0; font-size: 14px;">
                The sender is using HVEL to protect your inbox from AI spam and phishing.
                You can verify this email's authenticity by clicking the button below.
              </p>
            </div>
            <p>To verify your own emails and earn the "Human Verified" trust badge, download the
               free HVEL Chrome extension:</p>
            <a href="https://hvel-backend.onrender.com/hvel-extension.zip"
               style="display:inline-block;background:#6366f1;color:white;padding:12px 25px;
                      text-decoration:none;border-radius:5px;font-weight:bold;">
              Download HVEL Extension
            </a>
            <p style="font-size: 12px; color: #999; margin-top: 30px;">
              Verification ID: ${verificationId}<br/>
              Learn more at <a href="https://hvel.io">hvel.io</a>
            </p>
          </div>
        `
      };

      mainTransporter.sendMail(inviteMailOptions, (err) => {
        if (err) console.error("Error sending invitation email:", err);
        else console.log(`Invitation sent to ${recipientEmail} regarding ${senderEmail}`);
      });
    }

    res.status(201).json({
      success: true,
      data: { record, verificationUrl }
    });
  } catch (err) {
    console.error("Error saving verification:", err);
    res.status(500).json({ error: 'Database error' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Endpoint to validate a verification stamp (used by the recipient's extension)
// ─────────────────────────────────────────────────────────────────────────────
app.post('/api/validate', async (req, res) => {
  const { id, senderEmail, recipientEmail } = req.body;

  if (!id) return res.status(400).json({ error: 'Verification ID is required' });

  try {
    const result = await pool.query('SELECT * FROM verifications WHERE id = $1', [id]);
    const record = result.rows[0];

    if (!record) {
      return res.json({ status: 'invalid', message: 'Verification record not found' });
    }

    const senderMatch = record.sender_email.toLowerCase() === senderEmail?.toLowerCase();
    const recipientMatch = !record.recipient_email ||
      record.recipient_email.toLowerCase() === recipientEmail?.toLowerCase();

    if (senderMatch && recipientMatch) {
      return res.json({
        status: 'verified',
        type: record.type,
        timestamp: record.timestamp
      });
    } else {
      return res.json({
        status: 'tampered',
        message: 'Security Alert: ID mismatch - This stamp may have been copied from another email.'
      });
    }
  } catch (err) {
    console.error('Error validating verification:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Endpoint: notify-unverified-reply  (Viral Nudge)
//
// Flow:
//   • Person A (has HVEL extension) sends a Human-Verified email to Person B.
//   • Person B (no extension) replies WITHOUT a verification stamp.
//   • Person A's extension detects the unverified reply and calls this endpoint.
//   • This endpoint sends an email FROM hrms1928@gmail.com TO Person B with
//     clear steps on how to download and use the HVEL extension so their future
//     emails will also be Human Verified.
// ─────────────────────────────────────────────────────────────────────────────
app.post('/api/notify-unverified-reply', async (req, res) => {
  const { hvelUserEmail, noExtensionEmail } = req.body;
  
  console.log('----------------------------------------------------------------');
  console.log(`[HVEL API] 📥 Incoming Nudge Request:`);
  console.log(`           - From (Ext User): ${hvelUserEmail}`);
  console.log(`           - To   (Target):   ${noExtensionEmail}`);
  console.log('----------------------------------------------------------------');

  // Also accept legacy field names senderEmail / recipientEmail for backwards compatibility
  const verifiedUser = hvelUserEmail || req.body.senderEmail;
  const unverifiedUser = noExtensionEmail || req.body.recipientEmail;

  // ── LOOP GUARD ────────────────────────────────────────────────────────────
  // Block any HVEL-internal/system emails from triggering nudges.
  // This prevents an infinite loop where the nudge email itself is detected
  // as an "unverified reply" by the extension and re-triggers this endpoint.
  const INTERNAL_EMAILS = [
    process.env.EMAIL_USER?.toLowerCase() // main EMAIL_USER
  ].filter(Boolean);

  const IGNORED_DOMAINS = [
    'vercel.com', 'google.com', 'microsoft.com', 'github.com', 'github.io',
    'aws.com', 'amazon.com', 'netflix.com', 'facebook.com', 'linkedin.com',
    'twitter.com', 'x.com'
  ];

  const unverifiedDomain = unverifiedUser?.split('@')[1]?.toLowerCase();

  if (INTERNAL_EMAILS.includes(verifiedUser?.toLowerCase()) ||
    INTERNAL_EMAILS.includes(unverifiedUser?.toLowerCase()) ||
    IGNORED_DOMAINS.includes(unverifiedDomain)) {
    console.log(`[HVEL API] ⛔ Guard triggered — ignoring internal or whitelisted domain. recipient=${unverifiedUser}`);
    return res.status(200).json({ success: false, message: 'Ignored: internal email or whitelisted service domain' });
  }

  // ── SELF-NUDGE GUARD ──────────────────────────────────────────────────────
  if (verifiedUser?.toLowerCase() === unverifiedUser?.toLowerCase()) {
    console.log(`[HVEL API] ⛔ Self-nudge guard triggered — ignoring nudge request for self. user=${verifiedUser}`);
    return res.status(200).json({ success: false, message: 'Ignored: self-nudge — user is looking at their own mail' });
  }
  // ── END SELF-NUDGE GUARD ──────────────────────────────────────────────────
  // ── END LOOP GUARD ────────────────────────────────────────────────────────

  console.log(`[HVEL API] Unverified reply detected. HVEL user: ${verifiedUser} | No-extension user: ${unverifiedUser}`);

  if (!verifiedUser || !unverifiedUser) {
    console.log(`[HVEL API] Missing emails: hvelUser=${verifiedUser}, noExtensionUser=${unverifiedUser}`);
    return res.status(400).json({ error: 'hvelUserEmail and noExtensionEmail are required' });
  }

  if (!process.env.HRMS_EMAIL_PASS) {
    console.error('[HVEL API] HRMS_EMAIL_PASS not set in .env — cannot send nudge email.');
    return res.status(503).json({ error: 'HRMS email service not configured. Add HRMS_EMAIL_PASS to .env' });
  }

  try {
    const nudgeMailOptions = {
      from: `"HVEL Security Hub" <${process.env.EMAIL_USER}>`,
      to: unverifiedUser,
      subject: `Human Verification for your email to ${verifiedUser}`,
      headers: {
        'X-Priority': '1 (Highest)',
        'X-MSMail-Priority': 'High',
        'Importance': 'high',
        'X-Entity-Ref-ID': Date.now().toString()
      },
      html: `
        <div style="font-family: sans-serif; color: #333; max-width: 600px;
                    border: 1px solid #fecaca; padding: 20px; border-radius: 10px;">
          <h3 style="color: #4f46e5;">Verification Secure Context</h3>
          <p>Hello,</p>
          <p>You recently sent an email to <strong>${verifiedUser}</strong>.</p>
          <p>This recipient uses <strong>HVEL (Human-Verified Email Layer)</strong> to ensure they only receive messages from verified humans.</p>
          <p>Professional recipients increasingly filter unverified emails to protect themselves
             from AI-generated spam and phishing attacks. Your message may be flagged or ignored.</p>

          <div style="background:#fef2f2; padding:15px; border-radius:8px;
                      margin:20px 0; border-left:4px solid #ef4444;">
            <p style="margin:0; font-weight:bold;">How to fix this in 3 easy steps:</p>
            <ol style="margin:10px 0 0 0; padding-left:20px; font-size:14px; line-height:2;">
              <li>
                <strong>Download the HVEL Chrome Extension</strong><br/>
                <a href="https://hvel-backend.onrender.com/hvel-extension.zip" style="color:#6366f1;">
                  https://hvel-backend.onrender.com/hvel-extension.zip
                </a>
              </li>
              <li>
                <strong>Install &amp; open Gmail</strong> — you will see the HVEL toolbar
                appear inside your compose window.
              </li>
              <li>
                <strong>Click "Verify as Human"</strong> before sending — HVEL will run a quick
                2-factor identity check (OTP or Authenticator app) and attach a tamper-proof
                trust badge to your email.
              </li>
            </ol>
          </div>

          <p>Once verified, your emails will display a green <strong>✅ Human Verified</strong>
             badge that tells recipients your message is genuine and AI-spam-free.</p>

          <a href="https://hvel-backend.onrender.com/hvel-extension.zip"
             style="display:inline-block;background:#6366f1;color:white;padding:12px 25px;
                    text-decoration:none;border-radius:5px;font-weight:bold;margin-top:10px;">
            Get HVEL for Chrome — It's Free
          </a>

          <p style="font-size:12px; color:#999; margin-top:30px;">
            This notification was sent automatically by the HVEL Security Layer on behalf of
            ${verifiedUser}.<br/>
            Learn more at <a href="https://hvel.io" style="color:#6366f1;">hvel.io</a>
          </p>
        </div>
      `
    };

    await hrmsTransporter.sendMail(nudgeMailOptions);

    // Log to DB
    await pool.query(
      `INSERT INTO nudge_log (hvel_user, no_extension_user) VALUES ($1, $2)`,
      [verifiedUser, unverifiedUser]
    );

    console.log('================================================================');
    console.log(`[HVEL API] ✅ NUDGE EMAIL SENT`);
    console.log(`           HVEL User (Extension):  ${verifiedUser}`);
    console.log(`           Non-Extension User:      ${unverifiedUser}`);
    console.log(`           HVEL Email Sent From:    ${process.env.EMAIL_USER}`);
    console.log(`           Sent At:                 ${new Date().toISOString()}`);
    console.log('================================================================');

    res.json({ success: true, message: `Nudge email sent to ${unverifiedUser} from ${process.env.EMAIL_USER}` });

  } catch (err) {
    console.error('[HVEL API] HRMS SMTP Error:', err);
    res.status(500).json({ error: 'Server error while sending nudge email' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Public endpoint for a recipient to view the verification trust page
// ─────────────────────────────────────────────────────────────────────────────
app.get('/v/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query('SELECT * FROM verifications WHERE id = $1', [id]);
    const record = result.rows[0];

    if (!record) {
      return res.status(404).send('<h1>404 - Verification record not found</h1>');
    }

    let badgeTitle = 'Human Verified';
    let badgeColor = '#10b981';
    let badgeIcon = '🧑';

    if (record.type === 'ai') {
      badgeTitle = 'AI Assisted';
      badgeColor = '#8b5cf6';
      badgeIcon = '🤖';
    } else if (record.type === 'automated') {
      badgeTitle = 'Automated';
      badgeColor = '#6b7280';
      badgeIcon = '⚡';
    }

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>HVEL Trust Record</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                 background: #f3f4f6; display: flex; justify-content: center; padding-top: 50px; }
          .card { background: white; padding: 40px; border-radius: 12px;
                  box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); max-width: 500px;
                  width: 100%; border-top: 6px solid ${badgeColor}; }
          h2 { margin-top: 0; display: flex; align-items: center; gap: 10px; color: ${badgeColor}; }
          .detail { margin-bottom: 15px; border-bottom: 1px solid #e5e7eb; padding-bottom: 15px; }
          .label { font-size: 12px; color: #6b7280; text-transform: uppercase; font-weight: bold;
                   margin-bottom: 5px; display: block; }
          .value { font-size: 16px; color: #111827; word-break: break-all; }
        </style>
      </head>
      <body>
        <div class="card">
          <h2><span>${badgeIcon}</span> ${badgeTitle}</h2>
          <p>This email carries an authentic trust signal verified by HVEL.</p>
          
          <div class="detail">
            <span class="label">Sender Email</span>
            <span class="value">${record.sender_email}</span>
          </div>
          
          <div class="detail">
            <span class="label">Verification ID</span>
            <span class="value" style="font-family: monospace;">${record.id}</span>
          </div>

          <div class="detail">
            <span class="label">Content Hash (SHA-256)</span>
            <span class="value" style="font-family: monospace; font-size: 12px; color: #6b7280;">
              ${record.content_hash || 'Not Available'}
            </span>
          </div>
          
          <div class="detail" style="border: none;">
            <span class="label">Timestamp (UTC)</span>
            <span class="value">${new Date(record.timestamp).toUTCString()}</span>
          </div>
        </div>
      </body>
      </html>
    `;
    res.send(html);
  } catch (err) {
    console.error("Error retrieving verification:", err);
    res.status(500).send('<h1>500 - Server Error</h1>');
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Endpoint for Email Verification Assistant
// ─────────────────────────────────────────────────────────────────────────────
app.post('/api/check-reply-verification', (req, res) => {
  const { emailContent, senderEmail, recipientEmail } = req.body;

  // Check if the email content contains the verification URL
  const verificationBase = ORIGIN.replace(/^https?:\/\//, '');
  const hasVerification = new RegExp(verificationBase + '/v/').test(emailContent);

  if (hasVerification) {
    res.json({
      status: "verified",
      action: "allow",
      message: ""
    });
  } else {
    // Generate the message
    const message = `
      <div style="font-family: sans-serif; color: #333; max-width: 600px;
                  border: 1px solid #fecaca; padding: 20px; border-radius: 10px;">
        <h2 style="color: #991b1b;">⚠️ Trust Alert: Your Reply Was Not Verified</h2>
        <p>Hello,</p>
        <p>You recently replied to <strong>${recipientEmail}</strong>. However, your message
           was sent <strong>without a Human Verified</strong> trust signal.</p>
        <p>Professional recipients increasingly filter unverified emails to protect themselves
           from AI-generated spam and phishing attacks. Your message may be flagged or ignored.</p>

        <div style="background:#fef2f2; padding:15px; border-radius:8px;
                    margin:20px 0; border-left:4px solid #ef4444;">
          <p style="margin:0; font-weight:bold;">How to fix this in 3 easy steps:</p>
          <ol style="margin:10px 0 0 0; padding-left:20px; font-size:14px; line-height:2;">
            <li>
              <strong>Download the HVEL Chrome Extension</strong><br/>
              <a href="https://hvel.io/download" style="color:#6366f1;">
                https://hvel.io/download
              </a>
            </li>
            <li>
              <strong>Install &amp; open Gmail</strong> — you will see the HVEL toolbar
              appear inside your compose window.
            </li>
            <li>
              <strong>Click "Verify as Human"</strong> before sending — HVEL will run a quick
              2-factor identity check (OTP or Authenticator app) and attach a tamper-proof
              trust badge to your email.
            </li>
          </ol>
        </div>

        <p>Once verified, your emails will display a green <strong>✅ Human Verified</strong>
           badge that tells recipients your message is genuine and AI-spam-free.</p>

        <a href="https://hvel.io/download"
           style="display:inline-block;background:#6366f1;color:white;padding:12px 25px;
                  text-decoration:none;border-radius:5px;font-weight:bold;margin-top:10px;">
          Get HVEL for Chrome — It's Free
        </a>

        <p style="font-size:12px; color:#999; margin-top:30px;">
          This notification was sent automatically by the HVEL Security Layer on behalf of
          ${recipientEmail}.<br/>
          Learn more at <a href="https://hvel.io" style="color:#6366f1;">hvel.io</a>
        </p>
      </div>
    `;

    res.json({
      status: "unverified",
      action: "send_warning_email",
      message: message
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Endpoint: nudge-log — View all non-extension users who received nudge emails
// ─────────────────────────────────────────────────────────────────────────────
app.get('/api/nudge-log', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, hvel_user, no_extension_user, nudge_sent_at 
       FROM nudge_log ORDER BY nudge_sent_at DESC`
    );
    console.log(`[HVEL API] 📋 Nudge log requested — ${result.rows.length} records`);
    res.json({ success: true, total: result.rows.length, records: result.rows });
  } catch (err) {
    console.error('[HVEL API] Error fetching nudge log:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.listen(port, () => {
  console.log(`HVEL Backend listening on port ${port}`);
});
