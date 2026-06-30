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

const Stripe = require('stripe');
const stripe = process.env.STRIPE_SECRET_KEY ? Stripe(process.env.STRIPE_SECRET_KEY) : null;

const RP_NAME = 'HVEL Security';
const RP_ID = process.env.RP_ID || 'localhost';
const ORIGIN = process.env.ORIGIN || `http://${RP_ID}:3000`;

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());

// Raw parser for Stripe Webhook signature validation
app.post('/api/stripe-webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (stripe && endpointSecret && sig) {
      event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
    } else {
      // Fallback for testing without signature verification if secret is not set
      console.log('[STRIPE WEBHOOK] ⚠️ Warning: Processing unverified webhook event.');
      const bodyStr = req.body instanceof Buffer ? req.body.toString() : JSON.stringify(req.body);
      event = JSON.parse(bodyStr);
    }
  } catch (err) {
    console.error(`❌ Webhook Error: ${err.message}`);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  console.log(`[STRIPE WEBHOOK] Received event type: ${event.type}`);

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const email = session.customer_email || session.customer_details?.email;
      if (email) {
        console.log(`[STRIPE WEBHOOK] Upgrading user ${email} to professional`);
        await pool.query(
          `INSERT INTO users (email, plan, stripe_customer_id)
           VALUES ($1, 'professional', $2)
           ON CONFLICT (email) DO UPDATE
           SET plan = 'professional', stripe_customer_id = COALESCE($2, users.stripe_customer_id)`,
          [email.toLowerCase(), session.customer]
        );
      }
    } else if (event.type === 'customer.subscription.deleted') {
      const subscription = event.data.object;
      const customerId = subscription.customer;
      console.log(`[STRIPE WEBHOOK] Subscription deleted for customer: ${customerId}`);
      await pool.query(
        `UPDATE users SET plan = 'free', plan_expires_at = NULL WHERE stripe_customer_id = $1`,
        [customerId]
      );
    }
  } catch (dbErr) {
    console.error('[STRIPE WEBHOOK] Database update failed:', dbErr);
  }

  res.json({ received: true });
});

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

app.get('/health', (req, res) => {
  res.json({ success: true, status: 'ok' });
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

// ─── PLAN DEFINITIONS ───────────────────────────────────────────────────────
const PLANS = {
  free: {
    name: 'Free',
    totp_daily_limit: Infinity,
    gmail_accounts_limit: 1,
    audit_dashboard: false,
    trust_badges: false,
  },
  professional: {
    name: 'Professional',
    totp_daily_limit: Infinity, // Unlimited verifications
    gmail_accounts_limit: 5,   // Up to 5 Gmail accounts
    audit_dashboard: true,
    trust_badges: true,
  }
};

// ─── PLAN GUARD MIDDLEWARE ───────────────────────────────────────────────────
async function planGuard(feature, req, res, next) {
  const email = (req.body?.email || req.query?.email || '').toLowerCase();
  if (!email) return res.status(400).json({ error: 'Email required for plan check' });

  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'AUTHENTICATION_REQUIRED', message: 'Please log in to your Attest account.' });
  }

  try {
    const sessionRes = await pool.query('SELECT email FROM user_sessions WHERE token = $1', [token]);
    if (sessionRes.rows.length === 0) {
      return res.status(401).json({ error: 'INVALID_SESSION', message: 'Session expired or invalid. Please log in again.' });
    }
    const authEmail = sessionRes.rows[0].email.toLowerCase();
    if (authEmail !== email) {
      return res.status(403).json({ error: 'IDENTITY_MISMATCH', message: `Active Attest session (${authEmail}) does not match this email (${email}).` });
    }

    // Ensure user row exists (auto-create as free)
    await pool.query(
      `INSERT INTO users (email, plan) VALUES ($1, 'free')
       ON CONFLICT (email) DO NOTHING`,
      [email]
    );
    const userRes = await pool.query('SELECT plan, gmail_accounts_count FROM users WHERE email = $1', [email]);
    const user = userRes.rows[0];
    const plan = PLANS[user.plan] || PLANS.free;

    // ── Feature-specific quota checks ──────────────────────────────────────
    if (feature === 'gmail_account') {
      const currentCount = parseInt(user.gmail_accounts_count) || 0;
      if (currentCount >= plan.gmail_accounts_limit) {
        console.log(`[PLAN GUARD] 🚫 Gmail account limit for ${email} (${currentCount}/${plan.gmail_accounts_limit}) — Plan: ${user.plan}`);
        return res.status(403).json({
          error: 'PLAN_LIMIT_REACHED',
          feature: 'gmail_account',
          plan: user.plan,
          used: currentCount,
          limit: plan.gmail_accounts_limit,
          message: `Your ${user.plan} plan allows up to ${plan.gmail_accounts_limit} Gmail account(s). Upgrade to add more.`,
          upgrade_url: 'https://hvel.io/pricing'
        });
      }
    }

    if (feature === 'audit_dashboard') {
      if (!plan.audit_dashboard) {
        return res.status(403).json({
          error: 'PLAN_LIMIT_REACHED',
          feature: 'audit_dashboard',
          plan: user.plan,
          message: 'Advanced audit dashboard requires the Professional plan.',
          upgrade_url: 'https://hvel.io/pricing'
        });
      }
    }

    // Attach user + plan info to request for downstream use
    req.hvelUser = user;
    req.hvelPlan = plan;
    next();
  } catch (err) {
    console.error('[PLAN GUARD] Error:', err);
    res.status(500).json({ error: 'Plan check failed' });
  }
}

// Helper: increment quota counter for a feature
async function incrementQuota(email, feature) {
  const today = new Date().toISOString().split('T')[0];
  try {
    await pool.query(
      `INSERT INTO plan_quota_log (email, feature, log_date, count)
       VALUES ($1, $2, $3, 1)
       ON CONFLICT (email, feature, log_date)
       DO UPDATE SET count = plan_quota_log.count + 1`,
      [email, feature, today]
    );
  } catch (err) {
    console.error('[QUOTA] Increment error:', err);
  }
}

async function initDB() {
  const createTableQuery = `
    CREATE TABLE IF NOT EXISTS users (
      email VARCHAR(255) PRIMARY KEY,
      plan VARCHAR(50) DEFAULT 'free' NOT NULL,
      gmail_accounts_count INTEGER DEFAULT 1,
      stripe_customer_id VARCHAR(255),
      plan_expires_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS user_sessions (
      email VARCHAR(255) NOT NULL,
      token VARCHAR(255) PRIMARY KEY,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS plan_quota_log (
      id SERIAL PRIMARY KEY,
      email VARCHAR(255) NOT NULL,
      feature VARCHAR(100) NOT NULL,
      log_date DATE NOT NULL,
      count INTEGER DEFAULT 1,
      UNIQUE(email, feature, log_date)
    );
    CREATE TABLE IF NOT EXISTS verifications (
      id VARCHAR(50) PRIMARY KEY,
      sender_email VARCHAR(255) NOT NULL,
      recipient_email VARCHAR(255),
      type VARCHAR(50) NOT NULL,
      content_hash VARCHAR(255),
      timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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
    CREATE TABLE IF NOT EXISTS audit_logs (
      id SERIAL PRIMARY KEY,
      user_email VARCHAR(255) NOT NULL,
      type VARCHAR(50) NOT NULL,
      email VARCHAR(255) NOT NULL,
      timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;
  try {
    await pool.query(createTableQuery);
    await pool.query('CREATE INDEX IF NOT EXISTS audit_logs_user_email_idx ON audit_logs (user_email)');
    await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255)');
    const colCheck = await pool.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name='verifications' AND column_name='recipient_email'
    `);
    if (colCheck.rows.length === 0) {
      await pool.query('ALTER TABLE verifications ADD COLUMN recipient_email VARCHAR(255)');
    }
    console.log("✅ Database tables ensured (including plan and auth system).");
  } catch (err) {
    console.error("Error creating tables:", err);
  }
}
initDB();

app.get('/health', (req, res) => res.json({ status: 'ok', message: 'HVEL Backend is running' }));
app.post('/api/heartbeat', (req, res) => res.json({ success: true }));

// ─── AUTHENTICATION CRYPTO HELPERS ──────────────────────────────────────────
const crypto = require('crypto');

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, storedValue) {
  if (!storedValue || !storedValue.includes(':')) return false;
  const [salt, hash] = storedValue.split(':');
  const checkHash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return hash === checkHash;
}

// ─── AUTHENTICATION ENDPOINTS ────────────────────────────────────────────────
app.post('/api/auth/signup', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'MISSING_FIELDS', message: 'Email and password are required' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'WEAK_PASSWORD', message: 'Password must be at least 6 characters' });
  }

  const emailLower = email.toLowerCase().trim();

  try {
    // Check if user exists and already has a password set
    const userRes = await pool.query('SELECT password_hash FROM users WHERE email = $1', [emailLower]);

    if (userRes.rows.length > 0) {
      if (userRes.rows[0].password_hash) {
        return res.status(400).json({ error: 'USER_EXISTS', message: 'An account with this email already exists' });
      }

      // If user exists (e.g. from Stripe checkout or auto-created free), but has no password hash set yet
      const passwordHash = hashPassword(password);
      await pool.query(
        `UPDATE users SET password_hash = $1 WHERE email = $2`,
        [passwordHash, emailLower]
      );
    } else {
      // New user registration
      const passwordHash = hashPassword(password);
      await pool.query(
        `INSERT INTO users (email, plan, password_hash) VALUES ($1, 'free', $2)`,
        [emailLower, passwordHash]
      );
    }

    // Auto log in on signup
    const token = crypto.randomBytes(32).toString('hex');
    await pool.query(
      `INSERT INTO user_sessions (email, token) VALUES ($1, $2)`,
      [emailLower, token]
    );

    console.log(`[AUTH] 👤 User signed up and logged in: ${emailLower}`);
    res.json({ success: true, email: emailLower, token });
  } catch (err) {
    console.error('[AUTH SIGNUP] Error:', err);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Signup failed. Please try again.' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'MISSING_FIELDS', message: 'Email and password are required' });
  }

  const emailLower = email.toLowerCase().trim();

  try {
    const userRes = await pool.query('SELECT password_hash FROM users WHERE email = $1', [emailLower]);
    if (userRes.rows.length === 0 || !userRes.rows[0].password_hash) {
      return res.status(401).json({ error: 'INVALID_CREDENTIALS', message: 'Invalid email or password' });
    }

    const isValid = verifyPassword(password, userRes.rows[0].password_hash);
    if (!isValid) {
      return res.status(401).json({ error: 'INVALID_CREDENTIALS', message: 'Invalid email or password' });
    }

    const token = crypto.randomBytes(32).toString('hex');
    await pool.query(
      `INSERT INTO user_sessions (email, token) VALUES ($1, $2)`,
      [emailLower, token]
    );

    console.log(`[AUTH] 🔑 User logged in: ${emailLower}`);
    res.json({ success: true, email: emailLower, token });
  } catch (err) {
    console.error('[AUTH LOGIN] Error:', err);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Login failed. Please try again.' });
  }
});

app.post('/api/auth/logout', async (req, res) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(400).json({ error: 'NO_TOKEN', message: 'No active session token provided' });
  }

  try {
    await pool.query('DELETE FROM user_sessions WHERE token = $1', [token]);
    res.json({ success: true, message: 'Logged out successfully' });
  } catch (err) {
    console.error('[AUTH LOGOUT] Error:', err);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Logout failed.' });
  }
});

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
  'vercel.com', 'google.com', 'microsoft.com', 'github.com', 'github.io',
  'aws.com', 'amazon.com', 'netflix.com', 'facebook.com', 'linkedin.com', 'twitter.com', 'x.com'
];
function isBlockedEmail(email) {
  if (!email || !email.includes('@')) return true;
  const domain = email.split('@')[1]?.toLowerCase();
  const internalEmails = [process.env.EMAIL_USER?.toLowerCase()].filter(Boolean);
  return internalEmails.includes(email.toLowerCase()) || IGNORED_DOMAINS.includes(domain);
}



// ─────────────────────────────────────────────────────────────────────────────
// /api/verify — Save verification record + send one-time invite email
// ─────────────────────────────────────────────────────────────────────────────
app.post('/api/verify', async (req, res) => {
  const { senderEmail, recipientEmail, type, contentHash } = req.body;
  console.log(`[HVEL API] 🛡️ Verification Start — Sender: ${senderEmail} | Recipient: ${recipientEmail || 'N/A'}`);
  if (!senderEmail || !type) return res.status(400).json({ error: 'senderEmail and type are required' });

  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'AUTHENTICATION_REQUIRED', message: 'Please log in to your Attest account.' });
  }

  try {
    const sessionRes = await pool.query('SELECT email FROM user_sessions WHERE token = $1', [token]);
    if (sessionRes.rows.length === 0) {
      return res.status(401).json({ error: 'INVALID_SESSION', message: 'Session expired or invalid. Please log in again.' });
    }
    const authEmail = sessionRes.rows[0].email.toLowerCase();
    if (authEmail !== senderEmail.toLowerCase()) {
      return res.status(403).json({ error: 'IDENTITY_MISMATCH', message: `Active Attest session (${authEmail}) does not match the sender email (${senderEmail}).` });
    }

    const verificationId = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    const result = await pool.query(
      `INSERT INTO verifications (id, sender_email, recipient_email, type, content_hash) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [verificationId, senderEmail, recipientEmail || null, type, contentHash || null]
    );

    // Log / increment the user's daily verification quota
    await incrementQuota(senderEmail.toLowerCase(), 'totp_verify');

    const host = req.get('host') || 'api.attest.page';
    const proto = req.headers['x-forwarded-proto'] || req.protocol;
    const verificationUrl = `${proto}://${host}/v/${verificationId}`;

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
              <p style="margin:0 0 16px;font-size:14px;line-height:1.6;">HVEL automatically verifies real-time physical human intent (via mouse dynamics and natural composition patterns) during sending, confirming the email was sent by a physical human rather than an AI bot or automated script. It also secures the message fingerprint to prevent content tampering.</p>
              <div style="background:#f0fdf4;border-left:4px solid #10b981;border-radius:8px;padding:14px 16px;margin:0 0 20px;">
                <p style="margin:0;font-size:13px;font-weight:600;color:#065f46;">Why did you receive this?</p>
                <p style="margin:6px 0 0;font-size:13px;color:#047857;line-height:1.5;">The sender is using HVEL to protect your inbox from AI spam and phishing.</p>
              </div>
              <p style="margin:0 0 12px;font-size:14px;line-height:1.6;">To verify your own emails and earn the <strong>✅ Human Verified</strong> trust badge, download the free HVEL Chrome extension:</p>
              <div style="text-align:center;margin:20px 0;">
                <a href="https://attest.page/hvel-extension.zip" style="display:inline-block;background:#6366f1;color:white;padding:13px 32px;text-decoration:none;border-radius:8px;font-weight:700;font-size:14px;">Download HVEL Extension — Free</a>
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
  const hvelUserEmail = (req.body.hvelUserEmail || req.body.senderEmail || '').trim().toLowerCase();
  const noExtUserEmail = (req.body.noExtensionEmail || req.body.recipientEmail || '').trim().toLowerCase();

  console.log('----------------------------------------------------------------');
  console.log(`[HVEL API] 📥 Nudge Request — ext-user: ${hvelUserEmail} | target: ${noExtUserEmail}`);
  console.log('----------------------------------------------------------------');

  if (!hvelUserEmail || !noExtUserEmail) return res.status(400).json({ error: 'hvelUserEmail and noExtensionEmail are required' });
  if (!noExtUserEmail.includes('@') || noExtUserEmail === 'unknown-sender@gmail.com') return res.status(400).json({ success: false, message: 'Invalid recipient email' });
  if (isBlockedEmail(noExtUserEmail)) { console.log(`[HVEL API] ⛔ Blocked — whitelisted: ${noExtUserEmail}`); return res.status(200).json({ success: false, message: 'Ignored' }); }
  if (hvelUserEmail === noExtUserEmail) { console.log(`[HVEL API] ⛔ Self-nudge blocked`); return res.status(200).json({ success: false, message: 'Ignored: self-nudge' }); }

  try {
    // 24-hour database gate
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

    // Always insert or update timestamp
    try {
      const existing = await pool.query(
        `SELECT id FROM nudge_log WHERE LOWER(hvel_user) = $1 AND LOWER(no_extension_user) = $2 LIMIT 1`,
        [hvelUserEmail, noExtUserEmail]
      );
      if (existing.rows.length > 0) {
        await pool.query(
          `UPDATE nudge_log SET nudge_sent_at = NOW() WHERE LOWER(hvel_user) = $1 AND LOWER(no_extension_user) = $2`,
          [hvelUserEmail, noExtUserEmail]
        );
      } else {
        await pool.query(
          `INSERT INTO nudge_log (hvel_user, no_extension_user) VALUES ($1, $2)`,
          [hvelUserEmail, noExtUserEmail]
        );
      }
    } catch (dbErr) {
      console.error('[HVEL API] Database error logging nudge:', dbErr);
    }

    // Get sender profile for personalization
    const profileRes = await pool.query('SELECT full_name FROM profiles WHERE email = $1', [hvelUserEmail]);
    const senderName = profileRes.rows[0]?.full_name || hvelUserEmail;

    const nudgeHtml = `
      <div style="font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1f2937;max-width:600px;margin:20px auto;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);">
        <div style="background:linear-gradient(135deg,#007A5E,#059669);padding:40px 30px;text-align:center;color:white;">
          <div style="display:inline-block;background:rgba(255,255,255,0.2);padding:12px;border-radius:12px;margin-bottom:16px;">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
          </div>
          <h2 style="margin:0;font-size:24px;font-weight:800;letter-spacing:-0.025em;">Attest Identity Report</h2>
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
            This is an automated notification from <strong>Attest (Human Verified Email Layer)</strong>. 
            An email sent from your address to <strong>${senderName}</strong> was flagged because it lacked a valid human verification stamp.
          </p>

          <div style="background:#fff7ed;border-left:4px solid #f97316;padding:16px;border-radius:4px 12px 12px 4px;margin-bottom:24px;">
            <p style="margin:0;font-size:14px;color:#9a3412;line-height:1.5;">
              <strong>Why this matters:</strong> To protect against AI-generated spam and phishing, ${senderName} uses Attest to ensure they only interact with verified humans. Unverified emails may be deprioritized or moved to junk.
            </p>
          </div>

          <h3 style="margin:0 0 16px;font-size:16px;font-weight:700;">How to Restore Trust:</h3>
          <div style="display:grid;gap:12px;">
            <div style="background:#f1f5f9;padding:16px;border-radius:12px;">
              <p style="margin:0;font-size:14px;font-weight:600;color:#475569;">1. Download Attest Extension</p>
              <p style="margin:4px 0 0;font-size:13px;color:#64748b;">Get the extension <a href="https://attest.page/hvel-extension.zip" style="color:#007A5E;text-decoration:none;font-weight:600;">from this link</a>.</p>
            </div>
            <div style="background:#f1f5f9;padding:16px;border-radius:12px;">
              <p style="margin:0;font-size:14px;font-weight:600;color:#475569;">2. Link Your Account</p>
              <p style="margin:4px 0 0;font-size:13px;color:#64748b;">Click the Attest toolbar icon and sign in with your email to link your account.</p>
            </div>
            <div style="background:#ecfdf5;padding:16px;border:1px solid #d1fae5;border-radius:12px;">
              <p style="margin:0;font-size:14px;font-weight:600;color:#059669;">3. Seamless Background Verification</p>
              <p style="margin:4px 0 0;font-size:13px;color:#065f46;">Attest automatically verifies your human intent in the background as you type. Simply click "Send" as normal to append your trust stamp.</p>
            </div>
          </div>

          <div style="text-align:center;margin-top:32px;">
            <a href="https://attest.page/verify" style="display:inline-block;background:#007A5E;color:white;padding:12px 32px;text-decoration:none;border-radius:12px;font-weight:700;font-size:14px;box-shadow:0 4px 6px -1px rgba(0, 122, 94, 0.4);">Open Attest Portal</a>
          </div>
        </div>

        <div style="background:#f8fafc;padding:24px;border-top:1px solid #e2e8f0;text-align:center;">
          <p style="margin:0;font-size:12px;color:#94a3b8;line-height:1.6;">
            This security report was generated for communication with ${hvelUserEmail}.<br/>
            Attest Identity Protocol v2.4 | <a href="https://attest.page" style="color:#007A5E;text-decoration:none;">Learn More</a>
          </p>
        </div>
      </div>
    `;

    console.log(`[SMTP] 📤 Sending nudge email to ${noExtUserEmail}...`);
    const info = await hrmsTransporter.sendMail({
      from: `"Attest Security" <${process.env.EMAIL_USER}>`,
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
    const badgeColor = record.type === 'ai' ? '#8b5cf6' : (record.type === 'automated' || record.type === 'robotic') ? '#ef4444' : '#007A5E';
    const badgeTitle = record.type === 'ai' ? 'AI Assisted' : (record.type === 'automated' || record.type === 'robotic') ? 'Robotic / AI Sender' : 'Attest Approved';
    res.send(`<!DOCTYPE html><html><head><title>Attest Trust Record</title><style>body{font-family:-apple-system,sans-serif;background:#f3f4f6;display:flex;justify-content:center;padding-top:50px;}.card{background:white;padding:40px;border-radius:12px;box-shadow:0 4px 6px -1px rgba(0,0,0,0.1);max-width:500px;width:100%;border-top:6px solid ${badgeColor};}h2{margin-top:0;color:${badgeColor};}.detail{margin-bottom:15px;border-bottom:1px solid #e5e7eb;padding-bottom:15px;}.label{font-size:12px;color:#6b7280;text-transform:uppercase;font-weight:bold;margin-bottom:5px;display:block;}.value{font-size:16px;color:#111827;word-break:break-all;}</style></head><body><div class="card"><div style="text-align:center;margin-bottom:20px;"><a href="https://attest.page" target="_blank" style="text-decoration:none;"><img src="/icon-symbol.png" alt="Attest" style="width:48px;border:none;"></a></div><h2>${badgeTitle}</h2><p>This email carries an authentic trust signal verified by Attest.</p><div class="detail"><span class="label">Sender</span><span class="value">${record.sender_email}</span></div><div class="detail"><span class="label">Verification ID</span><span class="value" style="font-family:monospace;">${record.id}</span></div><div class="detail"><span class="label">Content Hash</span><span class="value" style="font-family:monospace;font-size:12px;color:#6b7280;">${record.content_hash || 'N/A'}</span></div><div class="detail" style="border:none;margin-bottom:25px;"><span class="label">Timestamp (UTC)</span><span class="value">${new Date(record.timestamp).toUTCString()}</span></div><div style="text-align:center;"><a href="https://attest.page" target="_blank" style="display:inline-block;background:${badgeColor};color:white;padding:12px 28px;text-decoration:none;border-radius:8px;font-weight:700;font-size:14px;box-shadow:0 4px 6px -1px rgba(0,0,0,0.1);transition:opacity 0.2s;">Verify Portal</a></div></div></body></html>`);
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

  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'AUTHENTICATION_REQUIRED', message: 'Please log in to your Attest account.' });
  }

  try {
    const sessionRes = await pool.query('SELECT email FROM user_sessions WHERE token = $1', [token]);
    if (sessionRes.rows.length === 0) {
      return res.status(401).json({ error: 'INVALID_SESSION', message: 'Session expired or invalid. Please log in again.' });
    }
    const authEmail = sessionRes.rows[0].email.toLowerCase();
    if (authEmail !== email.toLowerCase()) {
      return res.status(403).json({ error: 'IDENTITY_MISMATCH', message: `Active Attest session (${authEmail}) does not match this email (${email}).` });
    }

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

  // 1. Alert to the RECIPIENT (The Attest User)
  const recipientMailOptions = {
    from: `"Attest Security" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: `⚠️ Security Alert: Identity Mismatch Detected`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; border: 1px solid #fecaca; border-radius: 12px; overflow: hidden;">
        <div style="background: #ef4444; color: white; padding: 20px; text-align: center;">
          <h2 style="margin: 0;">Security Alert: ID Mismatch</h2>
        </div>
        <div style="padding: 20px; color: #1f2937;">
          <p>Hello,</p>
          <p>Attest has detected a potential identity mismatch in your conversation with <strong>${attacker}</strong>.</p>
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
    from: `"Attest Identity Service" <${process.env.EMAIL_USER}>`,
    to: attacker,
    subject: `⚠️ Verification Required: 3 Steps to Human Identity`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden;">
        <div style="background: #007A5E; color: white; padding: 24px; text-align: center;">
            <h2 style="margin: 0;">Verify Your Human Identity</h2>
            <p style="margin: 8px 0 0; opacity: 0.9;">Follow these 3 steps to secure your emails</p>
        </div>
        <div style="padding: 30px; color: #1f2937;">
            <p>Hello,</p>
            <p>Your recent email to <strong>${email}</strong> could not be verified as human. Please complete these 3 steps to get your Attest Approved Stamp:</p>
            
            <table style="width:100%; margin-top:20px; border-collapse:collapse;">
                <tr>
                    <td style="width:40px; vertical-align:top; padding-bottom:20px;"><div style="width:28px; height:28px; background:#007A5E; color:white; border-radius:50%; text-align:center; line-height:28px; font-weight:bold;">1</div></td>
                    <td style="padding-bottom:20px;">
                        <strong style="display:block; margin-bottom:4px;">Install Attest Extension</strong>
                        <span style="font-size:14px; color:#6b7280;">Download and load the Attest extension in your Chrome browser.</span>
                    </td>
                </tr>
                <tr>
                    <td style="width:40px; vertical-align:top; padding-bottom:20px;"><div style="width:28px; height:28px; background:#007A5E; color:white; border-radius:50%; text-align:center; line-height:28px; font-weight:bold;">2</div></td>
                    <td style="padding-bottom:20px;">
                        <strong style="display:block; margin-bottom:4px;">Link Your Account</strong>
                        <span style="font-size:14px; color:#6b7280;">Click the Attest toolbar icon and sign in with your email to link your account.</span>
                    </td>
                </tr>
                <tr>
                    <td style="width:40px; vertical-align:top;"><div style="width:28px; height:28px; background:#059669; color:white; border-radius:50%; text-align:center; line-height:28px; font-weight:bold;">3</div></td>
                    <td>
                        <strong style="display:block; margin-bottom:4px;">Verify Every Email</strong>
                        <span style="font-size:14px; color:#6b7280;">Before clicking "Send", click the <strong>"Verify"</strong> button in your Gmail compose window to attach your Attest Approved Stamp.</span>
                    </td>
                </tr>
            </table>

            <div style="margin-top:30px; text-align:center;">
                <a href="https://attest.page/verify" style="display:inline-block; background:#007A5E; color:white; padding:12px 24px; text-decoration:none; border-radius:8px; font-weight:bold;">Open Attest Portal</a>
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
// Proof of Humanity — Mouse Tracking Bot Detection Analyzer
// ─────────────────────────────────────────────────────────────────────────────
function verifyHumanBehavior(points) {
  if (!points || points.length < 20) {
    // If a human clicks without moving their mouse much, we still pass them
    console.log(`[HUMAN VERIFIED] 🧑 Trigger: Few points (${points ? points.length : 0}), assuming stationary human.`);
    return { success: true };
  }

  const start = points[0];
  const end = points[points.length - 1];

  // Calculate straight-line distance (displacement)
  const displacement = Math.sqrt(Math.pow(end.x - start.x, 2) + Math.pow(end.y - start.y, 2));
  if (displacement < 150) {
    // Small movements are allowed to pass immediately
    console.log(`[HUMAN VERIFIED] 🧑 Trigger: Low displacement (${displacement.toFixed(2)}px), assuming short human click path.`);
    return { success: true };
  }

  // 1. Straightness test (Linear deviation)
  const A = end.y - start.y;
  const B = start.x - end.x;
  const C = end.x * start.y - start.x * end.y;
  const denom = Math.sqrt(A * A + B * B);

  let totalDeviation = 0;
  for (let p of points) {
    const dist = denom > 0 ? Math.abs(A * p.x + B * p.y + C) / denom : 0;
    totalDeviation += dist;
  }
  const avgDeviation = totalDeviation / points.length;

  // 2. Velocity variance check (Standard deviation of speed)
  let speeds = [];
  let prevPoint = points[0];
  for (let i = 1; i < points.length; i++) {
    const curr = points[i];
    const dx = curr.x - prevPoint.x;
    const dy = curr.y - prevPoint.y;
    const dt = curr.t - prevPoint.t || 1; // avoid division by 0
    const dist = Math.sqrt(dx * dx + dy * dy);
    speeds.push(dist / dt);
    prevPoint = curr;
  }

  const avgSpeed = speeds.reduce((sum, s) => sum + s, 0) / speeds.length;
  const variance = speeds.reduce((sum, s) => sum + Math.pow(s - avgSpeed, 2), 0) / speeds.length;
  const stdDev = Math.sqrt(variance);

  // 3. Collinearity / Direction changes (Angles between segments)
  let angles = [];
  for (let i = 2; i < points.length; i++) {
    const p1 = points[i - 2];
    const p2 = points[i - 1];
    const p3 = points[i];
    const v1 = { x: p2.x - p1.x, y: p2.y - p1.y };
    const v2 = { x: p3.x - p2.x, y: p3.y - p2.y };
    const dot = v1.x * v2.x + v1.y * v2.y;
    const len1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y);
    const len2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y);
    if (len1 > 0 && len2 > 0) {
      const cos = dot / (len1 * len2);
      const boundedCos = Math.max(-1, Math.min(1, cos));
      angles.push(Math.acos(boundedCos));
    }
  }
  const angleChanges = angles.reduce((sum, a) => sum + a, 0);

  console.log(`[PROOF OF HUMANITY] Points: ${points.length} | Avg Dev: ${avgDeviation.toFixed(3)}px | Speed StdDev: ${stdDev.toFixed(4)}px/ms | Angles: ${angleChanges.toFixed(3)}`);

  // BOT DETECTION thresholds (Extremely permissive so humans never fail):
  // - Perfectly straight line: avgDeviation < 0.1 pixels
  // - Uniform velocity: stdDev < 0.01 px/ms
  // - Collinear movement: angleChanges < 0.01 radians
  if (avgDeviation < 0.1) {
    console.log(`[BOT DETECTED] 🤖 Trigger: Perfect straight line (Avg Dev: ${avgDeviation.toFixed(3)})`);
    return { success: false, error: 'Automated bot movement detected (Linear path).' };
  }
  if (stdDev < 0.01) {
    console.log(`[BOT DETECTED] 🤖 Trigger: Constant velocity (Speed StdDev: ${stdDev.toFixed(4)})`);
    return { success: false, error: 'Automated bot movement detected (Uniform speed).' };
  }
  if (angleChanges < 0.01) {
    console.log(`[BOT DETECTED] 🤖 Trigger: Perfect collinear movement (Angle changes: ${angleChanges.toFixed(3)})`);
    return { success: false, error: 'Automated bot movement detected (Robotic steering).' };
  }

  console.log(`[HUMAN VERIFIED] 🧑 Validation passed successfully.`);
  return { success: true };
}

app.post('/api/verify-human', (req, res) => {
  const { points } = req.body;
  const result = verifyHumanBehavior(points);
  if (result.success) {
    res.json({ success: true, message: 'Identity confirmed as Human' });
  } else {
    res.status(403).json({ success: false, error: result.error });
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

  const subjectLine = subject || `[Attest Contact] ${type || 'General Inquiry'} from ${name}`;
  const receivedAt = new Date().toLocaleString('en-US', { timeZone: 'UTC', dateStyle: 'full', timeStyle: 'long' });

  const html = `
    <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:600px;margin:0 auto;border:1px solid #E2E8F0;border-radius:16px;overflow:hidden;">
      <div style="background:linear-gradient(135deg,#2563EB 0%,#1D4ED8 100%);padding:32px 28px;">
        <h2 style="margin:0;color:white;font-size:20px;font-weight:800;letter-spacing:-0.02em;">📬 New Contact Form Submission</h2>
        <p style="margin:6px 0 0;color:rgba(255,255,255,0.75);font-size:13px;">Attest Website — ${receivedAt}</p>
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
      from: `"Attest Contact" <${process.env.EMAIL_USER}>`,
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

// ─────────────────────────────────────────────────────────────────────────────
// PLAN MANAGEMENT ENDPOINTS
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/plan/status — returns current plan, usage, and limits for a user
app.get('/api/plan/status', async (req, res) => {
  const email = (req.query.email || '').toLowerCase();
  if (!email) return res.status(400).json({ error: 'email query param required' });

  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'AUTHENTICATION_REQUIRED', message: 'Please log in to your Attest account.' });
  }

  try {
    const sessionRes = await pool.query('SELECT email FROM user_sessions WHERE token = $1', [token]);
    if (sessionRes.rows.length === 0) {
      return res.status(401).json({ error: 'INVALID_SESSION', message: 'Session expired or invalid. Please log in again.' });
    }
    const authEmail = sessionRes.rows[0].email.toLowerCase();
    if (authEmail !== email) {
      return res.status(403).json({ error: 'IDENTITY_MISMATCH', message: `Active Attest session (${authEmail}) does not match this email (${email}).` });
    }

    // Auto-create user as free if not exists
    await pool.query(
      `INSERT INTO users (email, plan) VALUES ($1, 'free') ON CONFLICT (email) DO NOTHING`,
      [email]
    );
    const userRes = await pool.query('SELECT plan, gmail_accounts_count, plan_expires_at FROM users WHERE email = $1', [email]);
    const user = userRes.rows[0];
    const planKey = user.plan || 'free';
    const plan = PLANS[planKey] || PLANS.free;

    // Get today's verification quota usage
    const today = new Date().toISOString().split('T')[0];
    const quotaRes = await pool.query(
      `SELECT count FROM plan_quota_log WHERE email = $1 AND feature = 'totp_verify' AND log_date = $2`,
      [email, today]
    );
    const usedToday = quotaRes.rows.length > 0 ? parseInt(quotaRes.rows[0].count) : 0;

    console.log(`[PLAN API] 📊 Status check — ${email} | Plan: ${planKey} | Used Today: ${usedToday}`);

    res.json({
      success: true,
      email,
      plan: planKey,
      planDetails: {
        name: plan.name,
        totp_daily_limit: plan.totp_daily_limit === Infinity ? 'unlimited' : plan.totp_daily_limit,
        gmail_accounts_limit: plan.gmail_accounts_limit,
        webauthn_enabled: false,
        audit_dashboard: plan.audit_dashboard,
        trust_badges: plan.trust_badges,
      },
      usage: {
        totp_used_today: usedToday,
        totp_remaining_today: plan.totp_daily_limit === Infinity ? 'unlimited' : Math.max(0, plan.totp_daily_limit - usedToday),
        gmail_accounts_count: parseInt(user.gmail_accounts_count) || 1,
      },
      plan_expires_at: user.plan_expires_at || null,
      upgrade_url: planKey === 'free' ? 'https://hvel.io/pricing' : null
    });
  } catch (err) {
    console.error('[PLAN API] Error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── AUDIT LOG ENDPOINTS ─────────────────────────────────────────────────────

// GET /api/audit-logs — returns all audit logs and aggregated stats for the user
app.get('/api/audit-logs', async (req, res) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'AUTHENTICATION_REQUIRED', message: 'Please log in to your Attest account.' });
  }

  try {
    const sessionRes = await pool.query('SELECT email FROM user_sessions WHERE token = $1', [token]);
    if (sessionRes.rows.length === 0) {
      return res.status(401).json({ error: 'INVALID_SESSION', message: 'Session expired or invalid. Please log in again.' });
    }
    const email = sessionRes.rows[0].email.toLowerCase();

    // Get all logs for the user, limited to latest 100 for performance
    const logsRes = await pool.query(
      `SELECT type, email, timestamp FROM audit_logs 
       WHERE LOWER(user_email) = $1 
       ORDER BY timestamp DESC LIMIT 100`,
      [email]
    );

    // Get aggregated counts of each log type
    const statsRes = await pool.query(
      `SELECT type, COUNT(*) as count FROM audit_logs 
       WHERE LOWER(user_email) = $1 
       GROUP BY type`,
      [email]
    );

    const stats = {
      sent_stamped_link: 0,
      sent_stamped_hash: 0,
      sent_unstamped: 0,
      received_stamped: 0,
      received_unstamped: 0
    };

    statsRes.rows.forEach(row => {
      const typeKey = row.type.toLowerCase();
      if (typeKey in stats) {
        stats[typeKey] = parseInt(row.count) || 0;
      }
    });

    res.json({
      success: true,
      logs: logsRes.rows.map(row => ({
        type: row.type,
        email: row.email,
        timestamp: new Date(row.timestamp).getTime()
      })),
      stats
    });
  } catch (err) {
    console.error('[AUDIT LOGS GET] Error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/audit-logs/log — logs a new audit event
app.post('/api/audit-logs/log', async (req, res) => {
  const { type, email: targetEmail } = req.body;
  if (!type || !targetEmail) {
    return res.status(400).json({ error: 'type and email are required' });
  }

  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'AUTHENTICATION_REQUIRED', message: 'Please log in to your Attest account.' });
  }

  try {
    const sessionRes = await pool.query('SELECT email FROM user_sessions WHERE token = $1', [token]);
    if (sessionRes.rows.length === 0) {
      return res.status(401).json({ error: 'INVALID_SESSION', message: 'Session expired or invalid. Please log in again.' });
    }
    const userEmail = sessionRes.rows[0].email.toLowerCase();

    const insertRes = await pool.query(
      `INSERT INTO audit_logs (user_email, type, email, timestamp) 
       VALUES ($1, $2, $3, NOW()) 
       RETURNING type, email, timestamp`,
      [userEmail, type, targetEmail.toLowerCase()]
    );

    res.json({
      success: true,
      log: {
        type: insertRes.rows[0].type,
        email: insertRes.rows[0].email,
        timestamp: new Date(insertRes.rows[0].timestamp).getTime()
      }
    });
  } catch (err) {
    console.error('[AUDIT LOGS LOG] Error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/audit-logs/clear — clears all audit logs for the user
app.delete('/api/audit-logs/clear', async (req, res) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'AUTHENTICATION_REQUIRED', message: 'Please log in to your Attest account.' });
  }

  try {
    const sessionRes = await pool.query('SELECT email FROM user_sessions WHERE token = $1', [token]);
    if (sessionRes.rows.length === 0) {
      return res.status(401).json({ error: 'INVALID_SESSION', message: 'Session expired or invalid. Please log in again.' });
    }
    const email = sessionRes.rows[0].email.toLowerCase();

    await pool.query('DELETE FROM audit_logs WHERE LOWER(user_email) = $1', [email]);

    res.json({
      success: true,
      message: 'Audit logs cleared successfully'
    });
  } catch (err) {
    console.error('[AUDIT LOGS CLEAR] Error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/plan/check-quota — lightweight pre-check before performing an action
app.post('/api/plan/check-quota', async (req, res) => {
  const { email, feature } = req.body;
  if (!email || !feature) return res.status(400).json({ error: 'email and feature required' });
  const emailLower = email.toLowerCase();

  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'AUTHENTICATION_REQUIRED', message: 'Please log in to your Attest account.' });
  }

  try {
    const sessionRes = await pool.query('SELECT email FROM user_sessions WHERE token = $1', [token]);
    if (sessionRes.rows.length === 0) {
      return res.status(401).json({ error: 'INVALID_SESSION', message: 'Session expired or invalid. Please log in again.' });
    }
    const authEmail = sessionRes.rows[0].email.toLowerCase();
    if (authEmail !== emailLower) {
      return res.status(403).json({ error: 'IDENTITY_MISMATCH', message: `Active Attest session (${authEmail}) does not match this email (${emailLower}).` });
    }

    await pool.query(
      `INSERT INTO users (email, plan) VALUES ($1, 'free') ON CONFLICT (email) DO NOTHING`,
      [emailLower]
    );
    const userRes = await pool.query('SELECT plan, gmail_accounts_count FROM users WHERE email = $1', [emailLower]);
    const user = userRes.rows[0];
    const plan = PLANS[user.plan] || PLANS.free;

    let allowed = true;
    let reason = null;
    let used = 0;
    let limit = null;

    if (feature === 'totp_verify') {
      const today = new Date().toISOString().split('T')[0];
      const quotaRes = await pool.query(
        `SELECT count FROM plan_quota_log WHERE email = $1 AND feature = 'totp_verify' AND log_date = $2`,
        [emailLower, today]
      );
      used = quotaRes.rows.length > 0 ? parseInt(quotaRes.rows[0].count) : 0;
      limit = plan.totp_daily_limit;
      if (used >= limit) {
        allowed = false;
        reason = `You've used all ${limit} free TOTP verifications for today. Resets at midnight UTC.`;
      }
    } else if (feature === 'webauthn') {
      if (!plan.webauthn_enabled) {
        allowed = false;
        reason = 'Biometric authentication requires the Professional plan.';
      }
    } else if (feature === 'gmail_account') {
      used = parseInt(user.gmail_accounts_count) || 1;
      limit = plan.gmail_accounts_limit;
      if (used >= limit) {
        allowed = false;
        reason = `Your plan allows up to ${limit} Gmail account(s).`;
      }
    }

    res.json({
      success: true,
      allowed,
      feature,
      plan: user.plan,
      used: used || 0,
      limit: limit === Infinity ? 'unlimited' : limit,
      reason: allowed ? null : reason,
      upgrade_url: allowed ? null : 'https://hvel.io/pricing'
    });
  } catch (err) {
    console.error('[PLAN QUOTA CHECK] Error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/create-checkout-session — initiates Stripe Checkout subscription
app.post('/api/create-checkout-session', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'email is required' });

  if (!stripe) {
    console.log('[STRIPE] Stripe secret key not configured. Mocking checkout redirect...');
    // If Stripe is not configured, we return a mock success URL so they can test it end-to-end locally!
    const successUrl = `${req.headers.origin || 'http://localhost:3000'}/pricing?session_id=mock_session_id&email=${encodeURIComponent(email)}`;
    return res.json({ id: 'mock_session', url: successUrl });
  }

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: {
            name: 'Attest Professional Plan',
            description: 'Unlimited Behavioral Verifications, WebAuthn Biometric Support, Up to 5 Gmail Accounts'
          },
          unit_amount: 300, // $3.00 USD
          recurring: {
            interval: 'month'
          }
        },
        quantity: 1
      }],
      mode: 'subscription',
      allow_promotion_codes: true,
      success_url: `${req.headers.origin || 'http://localhost:3000'}/pricing?session_id={CHECKOUT_SESSION_ID}&email=${encodeURIComponent(email)}`,
      cancel_url: `${req.headers.origin || 'http://localhost:3000'}/pricing`,
      customer_email: email.toLowerCase()
    });

    res.json({ id: session.id, url: session.url });
  } catch (err) {
    console.error('[STRIPE] Error creating checkout session:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/plan/upgrade — called by Stripe webhook or manually to upgrade a user
app.post('/api/plan/upgrade', async (req, res) => {
  const { email, plan, stripe_customer_id } = req.body;
  if (!email || !plan) return res.status(400).json({ error: 'email and plan required' });
  if (!PLANS[plan]) return res.status(400).json({ error: `Unknown plan: ${plan}. Valid: ${Object.keys(PLANS).join(', ')}` });

  try {
    const expiresAt = plan === 'free' ? null : new Date(Date.now() + 31 * 24 * 60 * 60 * 1000); // 31 days
    await pool.query(
      `INSERT INTO users (email, plan, stripe_customer_id, plan_expires_at)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (email) DO UPDATE
       SET plan = $2, stripe_customer_id = COALESCE($3, users.stripe_customer_id), plan_expires_at = $4`,
      [email.toLowerCase(), plan, stripe_customer_id || null, expiresAt]
    );
    console.log(`[PLAN API] ⬆️  Plan upgraded: ${email} → ${plan}`);
    res.json({ success: true, email, plan, plan_expires_at: expiresAt });
  } catch (err) {
    console.error('[PLAN API] Upgrade error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/plan/downgrade — called when subscription lapses
app.post('/api/plan/downgrade', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'email required' });
  try {
    await pool.query(
      `UPDATE users SET plan = 'free', plan_expires_at = NULL WHERE email = $1`,
      [email.toLowerCase()]
    );
    console.log(`[PLAN API] ⬇️  Plan downgraded to free: ${email}`);
    res.json({ success: true, email, plan: 'free' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/plan/quota-log — admin: view quota usage per user per day
app.get('/api/plan/quota-log', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT email, feature, log_date, count
       FROM plan_quota_log
       ORDER BY log_date DESC, count DESC
       LIMIT 100`
    );
    res.json({ success: true, total: result.rows.length, records: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/user/delete-account — GDPR & CCPA compliant data deletion
app.post('/api/user/delete-account', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'email is required' });
  const emailLower = email.toLowerCase();

  try {
    // 1. Delete plan quota logs
    await pool.query('DELETE FROM plan_quota_log WHERE LOWER(email) = $1', [emailLower]);

    // Delete audit logs
    await pool.query('DELETE FROM audit_logs WHERE LOWER(user_email) = $1', [emailLower]);

    // 2. Delete security alert logs
    await pool.query('DELETE FROM security_alert_log WHERE LOWER(recipient_email) = $1 OR LOWER(attacker_email) = $2', [emailLower, emailLower]);

    // 3. Delete verifications logs associated with this email
    await pool.query('DELETE FROM verifications WHERE LOWER(sender_email) = $1 OR LOWER(recipient_email) = $2', [emailLower, emailLower]);

    // 4. Delete profile
    await pool.query('DELETE FROM profiles WHERE LOWER(email) = $1', [emailLower]);

    // 5. Delete primary user record
    const result = await pool.query('DELETE FROM users WHERE LOWER(email) = $1', [emailLower]);

    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    console.log(`[GDPR DELETE] 🗑️ User data permanently purged: ${emailLower}`);
    res.json({ success: true, message: 'Your account and all associated data have been permanently deleted.' });
  } catch (err) {
    console.error('[GDPR DELETE] Error deleting user:', err);
    res.status(500).json({ error: 'Server error during data purging.' });
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
